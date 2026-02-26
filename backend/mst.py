# backend/mst.py
import math
from typing import Dict, Union, Any
from typing import List

import networkx as nx
import numpy as np
import pandas as pd
from pydantic import BaseModel
from scipy.spatial import Voronoi
from scipy.spatial.distance import cdist
from shapely.geometry import Point
from shapely.wkt import loads

EXCLUSION_RADIUS_METERS = 15.0
MIN_CANDIDATE_SEPARATION = 10.0

# CONSTANTS in METERS
MIN_POLE_TO_DESTINATION = 10.0
MAX_POLE_TO_DESTINATION = 100.0

MIN_POLE_TO_POLE = 10.0
MAX_POLE_TO_POLE = 150.0

MIN_DIST_TO_TERMINAL = 8.0,
MAX_CIRCUMRADIUS = 300.0


def haversine_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate the great-circle distance between two points on Earth in meters.

    Uses the Haversine formula to compute distance between two latitude/lnggitude pairs.

    Args:
        lat1 (float): Latitude of the first point in degrees.
        lng1 (float): longitude of the first point in degrees.
        lat2 (float): Latitude of the second point in degrees.
        lng2 (float): longitude of the second point in degrees.

    Returns:
        float: Distance in meters.
    """
    R = 6371000.0  # Earth mean radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)

    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def haversine_vec(A, B):
    # A, B: (n, 2) arrays of [lat, lon]
    lat1, lon1 = np.radians(A[:, 0]), np.radians(A[:, 1])
    lat2, lon2 = np.radians(B[:, 0]), np.radians(B[:, 1])
    dlat = lat2 - lat1[:, None]
    dlon = lon2 - lon1[:, None]
    a = np.sin(dlat / 2) ** 2 + np.cos(lat1[:, None]) * np.cos(lat2) * np.sin(dlon / 2) ** 2
    c = 2 * np.arctan2(np.sqrt(a), np.sqrt(1 - a))
    return 6371000 * c  # shape (n_candidates, n_buildings)


def generate_voronoi_candidates(coords: np.ndarray) -> np.ndarray:
    """
    Generates candidate pole locations from Voronoi vertices with filtering.
    Final step: removes candidates closer than MIN_CANDIDATE_SEPARATION meters.
    """
    if len(coords) < 3:
        return np.empty((0, 2), dtype=float)

    vor = Voronoi(coords)
    if len(vor.vertices) == 0:
        return np.empty((0, 2), dtype=float)

    verts = vor.vertices  # shape (n_vertices, 2)

    # Vectorized haversine distances from vertices to original points
    dists = haversine_vec(verts, coords)  # assume you have this function

    nearest_dists = np.partition(dists, 2, axis=1)[:, :3]
    min_dists = nearest_dists[:, 0]
    third_min_dists = nearest_dists[:, 2]

    mask = min_dists >= MIN_DIST_TO_TERMINAL

    if MAX_CIRCUMRADIUS is not None:
        mask &= (third_min_dists <= MAX_CIRCUMRADIUS)

    candidates = verts[mask]

    if len(candidates) == 0:
        print("No Voronoi candidates after initial filtering")
        return candidates

    # ─── Step 1: Deduplicate with rounding (existing) ───────────────────────
    candidates = np.unique(np.round(candidates, decimals=6), axis=0)

    if len(candidates) <= 1:
        print(f"Generated {len(candidates)} unique Voronoi candidate poles")
        return candidates

    # ─── Step 2: Enforce minimum separation (new) ───────────────────────────
    # Sort by latitude for somewhat spatial order (helps greedy algorithm)
    sort_idx = np.argsort(candidates[:, 0])
    candidates = candidates[sort_idx]

    # Greedy filter: keep point only if >= MIN distance from all kept points
    kept = []
    kept_array = np.empty((0, 2))

    for pt in candidates:
        if len(kept_array) == 0:
            kept.append(pt)
            kept_array = np.array([pt])
            continue

        # Compute distances to already kept points
        dists_to_kept = haversine_vec(np.array([pt]), kept_array)[0]

        if np.all(dists_to_kept >= MIN_CANDIDATE_SEPARATION):
            kept.append(pt)
            kept_array = np.vstack([kept_array, pt])

    candidates = np.array(kept)

    print(f"Generated {len(candidates)} Voronoi candidate poles "
          f"after min {MIN_CANDIDATE_SEPARATION}m separation filter "
          f"(from {len(vor.vertices)} vertices)")

    return candidates

def build_directed_graph_for_arborescence(
        source_idx,
        destination_indices,
        pole_indices,
        dist_matrix,
        costs,
) -> nx.DiGraph:
    """
    Builds a directed graph for use in finding a minimum-cost arborescence given
    a set of coordinates, indices, and constraints.

    This function constructs a directed graph where poles and destinations are represented
    as nodes, and edges represent potential connections between them. Different weight
    and voltage attributes are applied to the edges depending on their type (pole-to-destination,
    pole-to-pole, or source-to-pole/destination connections).

    Args:
        source_idx: Integer index representing the source node (e.g., a substation).
        destination_indices: List of integers representing indices of all destinations.
        pole_indices: List of integers representing indices of all poles.
        dist_matrix: 2D matrix where each element represents the distance between nodes.
        costs: Dictionary storing cost values for graph construction. Specifically,
               it should include the `"poleCost"` key to determine the cost addition
               for pole-to-pole connections.

    Returns:
        nx.DiGraph: A directed graph with the defined nodes and edges.

    """
    # pole_cost = float(costs.get("poleCost", 1000.0))
    # low_voltage_cost_per_meter = float(costs.get("lowVoltageCostPerMeter", 4.0))
    # high_voltage_cost_per_meter = float(costs.get("highVoltageCostPerMeter", 10.0))

    DG = nx.DiGraph()

    # Directed: poles → destinations (service drops)
    for p in pole_indices:
        for h in destination_indices:
            d = dist_matrix[p, h]
            if 0.1 < d <= MAX_POLE_TO_DESTINATION:
                w = d  # TODO: Adjust weight based on costs
                DG.add_edge(p, h, weight=w, length=d, voltage="low")

    # Bidirectional pole ↔ pole (undirected spans)
    for i in range(len(pole_indices)):
        for j in range(i + 1, len(pole_indices)):
            p1, p2 = pole_indices[i], pole_indices[j]
            d = dist_matrix[p1, p2]
            w = d  # TODO: Adjust weight based on costs
            if 0.1 < d <= MAX_POLE_TO_POLE:
                DG.add_edge(p1, p2, weight=w, length=d, voltage="high")
                DG.add_edge(p2, p1, weight=w, length=d, voltage="high")

    # Directed: source → poles (main trunk)
    for p in pole_indices:
        d = dist_matrix[source_idx, p]
        if 0.1 < d <= MAX_POLE_TO_POLE:
            w = d  # TODO: Adjust weight based on costs
            DG.add_edge(source_idx, p, weight=w, length=d, voltage="high")

    return DG


def prune_dead_end_pole_branches(arbo: nx.DiGraph, pole_indices: list, destination_indices) -> nx.DiGraph:
    """
    Prunes dead-end pole branches in a Directed Graph (DiGraph).

    This function removes leaf nodes in the provided graph that represent poles and do not serve
    any destination nodes in their subtree. The pruning process continues iteratively until no such
    dead-end poles remain in the graph. It modifies a copy of the input graph without affecting
    the original.

    Args:
        arbo (nx.DiGraph): A directed graph representing the network structure.
        pole_indices (list): A list of node indices representing poles in the graph.
        destination_indices (list): A list of node indices representing destinations in the graph.

    Returns:
        nx.DiGraph: A new directed graph with dead-end pole branches removed.
    """
    arbo = arbo.copy()
    removed = True
    while removed:
        removed = False
        leaves = [n for n in arbo.nodes() if arbo.out_degree(n) == 0]
        for leaf in leaves:
            if leaf in pole_indices:
                # Check if this leaf (or its subtree) serves any destination
                descendants = nx.descendants(arbo, leaf) | {leaf}
                if not any(d in destination_indices for d in descendants):
                    # No destination served → safe to remove
                    predecessors = list(arbo.predecessors(leaf))
                    for pred in predecessors:
                        arbo.remove_edge(pred, leaf)
                    arbo.remove_node(leaf)
                    removed = True
    return arbo


class OptimizationRequest(BaseModel):
    """Pydantic model for incoming optimization request from frontend.

    Args:
        points: List of dicts with 'lat', 'lng', and optional 'name'.
        costs: Dict with poleCost, lowVoltageCostPerMeter, highVoltageCostPerMeter.
        debug: Optional flag to enable debug output.
    """
    points: List[Dict[str, Union[float, str, None]]]
    costs: Dict[str, float]
    debug: bool = False


def build_bounding_box(coords):
    """
    Compute axis-aligned bounding box from array of [lat, lon] points.

    Args:
        coords: np.ndarray of shape (n, 2) where each row is [latitude, longitude]
                or list of [lat, lon] pairs

    Returns:
        dict: {'min_lat': float, 'max_lat': float, 'min_lon': float, 'max_lon': float}
              or None if input is empty/invalid
    """
    if len(coords) == 0:
        return None

    # Convert to numpy array if it's a list
    coords = np.asarray(coords)

    if coords.ndim != 2 or coords.shape[1] != 2:
        raise ValueError("coords must be (n, 2) array or list of [lat, lon] pairs")

    min_lat = np.min(coords[:, 0])
    max_lat = np.max(coords[:, 0])
    min_lon = np.min(coords[:, 1])
    max_lon = np.max(coords[:, 1])

    return {
        'min_lat': float(min_lat),
        'max_lat': float(max_lat),
        'min_lon': float(min_lon),
        'max_lon': float(max_lon)
    }


def filter_candidates_by_buildings(
        candidates: Union[np.ndarray, list[tuple[float, float]]],
        coords: Union[np.ndarray, list[tuple[float, float]]],
        padding_deg: float = 0.0001  # tiny buffer ~11 m at equator
) -> np.ndarray:
    """
    1. Compute bounding box from candidates (with small padding)
    2. Keep only buildings whose CENTROID is INSIDE that bounding box
    3. Parse geometry → shapely Polygon for those buildings only
    4. Remove candidates that lie inside any of those building polygons

    Returns filtered candidates as numpy array (n, 2)
    """
    coords = np.asarray(coords)
    if coords.ndim != 2 or coords.shape[1] != 2:
        raise ValueError("coords must be (n, 2) [[lat, lon], ...]")

    if len(coords) == 0:
        return coords

    # ─── 1. Bounding box from coords ────────────────────────────────
    min_lat = np.min(coords[:, 0])
    max_lat = np.max(coords[:, 0])
    min_lon = np.min(coords[:, 1])
    max_lon = np.max(coords[:, 1])

    # Optional small padding so buildings exactly on the edge are included
    min_lat -= padding_deg
    max_lat += padding_deg
    min_lon -= padding_deg
    max_lon += padding_deg

    print(f"Candidates bbox (padded): "
          f"lat [{min_lat:.8f}, {max_lat:.8f}], "
          f"lon [{min_lon:.8f}, {max_lon:.8f}]")

    # ─── 2. Load CSV and filter buildings by centroid inside bbox ────────
    df = pd.read_csv("179_buildings.csv", usecols=['latitude', 'longitude', 'geometry'])

    # Drop rows missing required columns
    df = df.dropna(subset=['latitude', 'longitude', 'geometry'])

    # Keep only buildings whose centroid is inside the bbox
    inside_mask = (
            (df['latitude'] >= min_lat) & (df['latitude'] <= max_lat) &
            (df['longitude'] >= min_lon) & (df['longitude'] <= max_lon)
    )

    df_filtered = df[inside_mask].copy()

    if df_filtered.empty:
        print("No building centroids inside coords bbox → all candidates kept")
        return candidates

    print(f"Found {len(df_filtered)} buildings with centroid inside bbox")

    # ─── 3. Parse geometry for the filtered buildings only ───────────────
    df_filtered['poly'] = df_filtered['geometry'].apply(loads)

    # Drop invalid geometries
    df_filtered = df_filtered[df_filtered['poly'].apply(lambda g: g.is_valid if g else False)]

    if df_filtered.empty:
        print("No valid building polygons after filtering → all candidates kept")
        return candidates

    # ─── 4. Remove candidates inside any remaining building polygon ──────
    polygons = df_filtered['poly'].values

    def is_covered(lat: float, lon: float) -> bool:
        pt = Point(lon, lat)  # shapely uses (x=lon, y=lat)
        for poly in polygons:
            if poly.contains(pt):
                return True
        return False

    # Vectorized-ish check (still loop, but only over relevant buildings)
    keep_mask = np.ones(len(candidates), dtype=bool)
    for i, (lat, lon) in enumerate(candidates):
        if is_covered(lat, lon):
            keep_mask[i] = False

    filtered = candidates[keep_mask]

    removed = len(candidates) - len(filtered)
    removed_nodes = [c for c in candidates if c not in filtered]
    if removed > 0:
        print(f"Removed {removed} candidates inside building footprints: {removed_nodes}")

    return filtered


def parse_input(request: OptimizationRequest):
    """
    Parses input request containing information about geographical points, costs, and their attributes to generate structured
    data suitable for optimization tasks.

    This function processes the input `OptimizationRequest` to extract coordinates, their names, and classify one of the
    locations as the "Power Source". It ensures that the input contains at least two valid points, assigns a "Power Source"
    if not explicitly provided, and organizes the remaining points as destinations. The function also validates and cleans input
    data for consistency.

    Args:
        request: Input request containing points and their associated costs

    Returns:
        A tuple containing coords, destination_indices, source_idx, original_names, costs
    """

    points = request.points
    costs = request.costs.copy()  # defensive copy

    if len(points) < 2:
        raise ValueError("At least 2 points required")

    coords_list = []
    names = []
    source_idx = None

    SOURCE_KEYWORDS = {
        "power source", "powersource", "source", "substation", "main source",
        "primary", "generator", "grid tie", "utility"
    }

    for i, p in enumerate(points):
        try:
            lat = float(p["lat"])
            lng = float(p["lng"])
        except (KeyError, TypeError, ValueError) as e:
            raise ValueError(f"Point {i + 1} missing/invalid lat/lng: {p}") from e

        if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
            raise ValueError(f"Point {i + 1} has invalid coordinates: ({lat}, {lng})")

        coords_list.append([lat, lng])

        # Name handling
        raw_name = p.get("name")
        name = str(raw_name).strip() if raw_name is not None else f"Location {i + 1}"
        names.append(name)

        # Source detection (case-insensitive, more flexible)
        name_lower = name.lower()
        if any(kw in name_lower for kw in SOURCE_KEYWORDS) or "source" in name_lower:
            if source_idx is not None:
                print(f"Warning: Multiple potential sources detected; using first (index {source_idx})")
            else:
                source_idx = i
                names[i] = "Power Source"  # canonical name

    coords = np.array(coords_list, dtype=np.float64)

    if source_idx is None:
        print("No explicit power source found → using first point (index 0)")
        source_idx = 0
        names[0] = "Power Source"

    destination_indices = [i for i in range(len(coords)) if i != source_idx]

    return coords, destination_indices, source_idx, names, costs


def compute_mst(request: OptimizationRequest) -> Dict[str, Any]:
    """Compute a realistic power distribution network using MST with intermediate poles.

    Uses Voronoi vertices as candidate pole locations.
    Enforces no direct destination-to-destination connections.
    Dynamically identifies the "Power Source" point by name.
    Returns edges, nodes, lengths, and cost estimates.

    Args:
        request (OptimizationRequest): Input from frontend containing points and costs.

    Returns:
        Dict[str, Any]: Result with edges, nodes, totals, costs, and debug info.
    """
    # ─── Process input ────────────────────────────────────────────────
    coords, destination_indices, source_idx, original_names, costs = parse_input(request)

    debug = request.debug

    # ─── Generate candidates ────────────────────────────────────────────────
    candidates = generate_voronoi_candidates(coords)

    # remove candidates that fall inside any building
    # candidates = filter_candidates_by_buildings(candidates, coords)

    if len(candidates) > 0:
        extended_coords = np.vstack([coords, candidates])
        pole_start_idx = len(coords)
        pole_indices = list(range(pole_start_idx, len(extended_coords)))
    else:
        extended_coords = coords
        pole_indices = []
        pole_start_idx = len(coords)

    # ─── Build & compute MST ────────────────────────────────────────────────
    dist_matrix = cdist(
        extended_coords,
        extended_coords,
        metric=lambda u, v: haversine_meters(u[0], u[1], v[0], v[1])
    )

    DG = build_directed_graph_for_arborescence(
        source_idx=source_idx,
        destination_indices=destination_indices,
        pole_indices=pole_indices,
        dist_matrix=dist_matrix,  # you already compute this
        costs=costs,
    )

    arbo = nx.minimum_spanning_arborescence(DG, attr="weight", preserve_attrs=True, default=1e18)

    # ─── Remove 0 degree poles ────────────────────────────────────────────────
    mst = prune_dead_end_pole_branches(arbo, pole_indices, destination_indices)

    # ─── Extract used nodes & name poles ────────────────────────────────────
    used_nodes = {u for u, v in mst.edges()} | {v for u, v in mst.edges()}
    used_pole_indices = [i for i in pole_indices if i in used_nodes]

    node_names = dict(enumerate(original_names))
    for idx, pole_i in enumerate(used_pole_indices, 1):
        node_names[pole_i] = f"Pole {idx}"

    # ─── Collect edges & totals ─────────────────────────────────────────────
    edges = []
    total_low_m = 0.0
    total_high_m = 0.0

    for u, v, data in mst.edges(data=True):
        length_m = data.get("length")
        voltage = data.get("voltage")

        start_name = node_names.get(u, f"Node {u}")
        end_name = node_names.get(v, f"Node {v}")

        edges.append({
            "start": {
                "lat": float(extended_coords[u][0]),
                "lng": float(extended_coords[u][1]),
                "name": start_name
            },
            "end": {
                "lat": float(extended_coords[v][0]),
                "lng": float(extended_coords[v][1]),
                "name": end_name
            },
            "lengthMeters": round(length_m, 2),
            "voltage": voltage,
        })

        if voltage == "low":
            total_low_m += length_m
        else:
            total_high_m += length_m

    # ─── Cost calculation ───────────────────────────────────────────────────
    pole_cost = float(costs.get("poleCost", 1500.0))
    low_cost_m = float(costs.get("lowVoltageCostPerMeter", 8.0))
    high_cost_m = float(costs.get("highVoltageCostPerMeter", 25.0))

    num_poles = len(used_pole_indices)
    pole_cost_est = num_poles * pole_cost
    low_wire_est = total_low_m * low_cost_m
    high_wire_est = total_high_m * high_cost_m
    total_wire_est = low_wire_est + high_wire_est
    total_cost_est = pole_cost_est + total_wire_est

    # ─── Return structured result ───────────────────────────────────────────
    if debug:
        return_nodes = [
            {
                "index": i,
                "lat": float(coord[0]),
                "lng": float(coord[1]),
                "name":  f"Candidate {i}",
                "type": "pole"
            }
            for i, coord in enumerate(extended_coords)
        ]
    else:
        return_nodes = [
            {
                "index": i,
                "lat": float(extended_coords[i][0]),
                "lng": float(extended_coords[i][1]),
                "name": node_names.get(i, f"Unused {i}"),
                "type": "source" if i == source_idx else "destination" if i < pole_start_idx else "pole"
            }
            for i in sorted(used_nodes)
        ]

    return {
        "edges": edges,
        "nodes": return_nodes,
        "totalLowVoltageMeters": round(total_low_m, 2),
        "totalHighVoltageMeters": round(total_high_m, 2),
        "numPolesUsed": num_poles,
        "poleCostEstimate": round(pole_cost_est, 2),
        "lowWireCostEstimate": round(low_wire_est, 2),
        "highWireCostEstimate": round(high_wire_est, 2),
        "totalWireCostEstimate": round(total_wire_est, 2),
        "totalCostEstimate": round(total_cost_est, 2),
        "debug": {
            "sourceIndex": source_idx,
            "sourceName": node_names.get(source_idx, "Power Source"),
            "originalPoints": len(coords),
            "candidatesGenerated": len(candidates),
            "candidatesUsed": num_poles,
        }
    }