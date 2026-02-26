# backend/mst.py
from typing import List, Dict, Union, Any
import networkx as nx
import math
import numpy as np
from scipy.spatial import Voronoi
from scipy.spatial.distance import cdist
from pydantic import BaseModel

# CONSTANTS
MAX_DESTINATION_TO_POLE = 100.0  # METERS
MAX_POLE_TO_POLE = 150.0  # METERS


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


def generate_voronoi_candidates(coords: np.ndarray, min_dist_to_terminal=8.0, max_circumradius=None):
    if len(coords) < 3:
        return np.empty((0, 2), dtype=float)

    vor = Voronoi(coords)
    if len(vor.vertices) == 0:
        return np.empty((0, 2), dtype=float)

    verts = vor.vertices  # shape (n_vertices, 2)

    # ─── Vectorized haversine: all vertices → all original points ───────
    lat_v = verts[:, 0, np.newaxis]           # (n_v, 1)
    lng_v = verts[:, 1, np.newaxis]
    lat_o = coords[:, 0]                      # (n_o,)
    lng_o = coords[:, 1]

    phi_v = np.radians(lat_v)
    phi_o = np.radians(lat_o)
    dphi = np.radians(lat_o - lat_v)
    dlam = np.radians(lng_o - lng_v)

    a = np.sin(dphi/2)**2 + np.cos(phi_v)*np.cos(phi_o)*np.sin(dlam/2)**2
    c = 2 * np.arctan2(np.sqrt(a), np.sqrt(1 - a))
    dists = 6371000.0 * c                     # shape (n_vertices, n_original)

    # For each vertex: distance to its 3 nearest terminals
    nearest_dists = np.partition(dists, 2, axis=1)[:, :3]   # (n_v, 3)
    min_dists = nearest_dists[:, 0]
    third_min_dists = nearest_dists[:, 2]

    mask = min_dists >= min_dist_to_terminal

    if max_circumradius is not None:
        mask &= (third_min_dists <= max_circumradius)

    candidates = verts[mask]

    if len(candidates) > 0:
        # Deduplicate (rounding still reasonable for geographic use)
        candidates = np.unique(np.round(candidates, decimals=6), axis=0)

    print(f"Generated {len(candidates)} Voronoi candidate poles (from {len(verts)} vertices)")
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
        max_destination_to_pole: Optional; Maximum distance (float) allowed between a pole
                           and a destination for adding an edge. Default is 80.0.
        max_pole_to_pole: Optional; Maximum distance (float) allowed between two poles
                          for adding an edge. Default is 150.0.

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
            if 0.1 < d <= MAX_DESTINATION_TO_POLE:
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
        if 0.1 < d <= MAX_POLE_TO_POLE * 1.5:
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
    """
    points: List[Dict[str, Union[float, str, None]]]
    costs: Dict[str, float]


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
            raise ValueError(f"Point {i+1} missing/invalid lat/lng: {p}") from e

        if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
            raise ValueError(f"Point {i+1} has invalid coordinates: ({lat}, {lng})")

        coords_list.append([lat, lng])

        # Name handling
        raw_name = p.get("name")
        name = str(raw_name).strip() if raw_name is not None else f"Location {i+1}"
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

    # ─── Generate candidates ────────────────────────────────────────────────
    candidates = generate_voronoi_candidates(
        coords,
        min_dist_to_terminal=8.0,
        max_circumradius=300.0
    )

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
    return {
        "edges": edges,
        "nodes": [
            {
                "index": i,
                "lat": float(extended_coords[i][0]),
                "lng": float(extended_coords[i][1]),
                "name": node_names.get(i, f"Unused {i}"),
                "type": "source" if i == source_idx else "destination" if i < pole_start_idx else "pole"
            }
            for i in sorted(used_nodes)
        ],
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
