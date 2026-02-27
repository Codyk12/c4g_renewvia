from scipy.spatial import Voronoi, Delaunay
import pandas as pd

from shapely.geometry import Point
from shapely.wkt import loads

from utils import *


# For Voronoi candidates:
MIN_DIST_TO_TERMINAL = 8.0,
MAX_CIRCUMRADIUS = 300.0
MIN_CANDIDATE_SEPARATION = 10.0


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


def fermat_torricelli_point(pts: np.ndarray) -> np.ndarray:
    """
    Compute approximate Fermat-Torricelli point for a triangle (3 points).
    If any angle ≥ 120°, returns the vertex with that angle.
    Otherwise returns a rough approximation (centroid fallback for simplicity).
    """
    if len(pts) != 3:
        raise ValueError("Need exactly 3 points")

    A, B, C = pts

    # Compute side lengths
    a = np.linalg.norm(B - C)
    b = np.linalg.norm(A - C)
    c = np.linalg.norm(A - B)

    # Cosines of angles
    cosA = (b**2 + c**2 - a**2) / (2 * b * c) if b * c != 0 else 1
    cosB = (a**2 + c**2 - b**2) / (2 * a * c) if a * c != 0 else 1
    cosC = (a**2 + b**2 - c**2) / (2 * a * b) if a * b != 0 else 1

    # If any angle ≥ 120° (cos ≤ -0.5), minimum is at that vertex
    if cosA <= -0.5:
        return A
    if cosB <= -0.5:
        return B
    if cosC <= -0.5:
        return C

    # Otherwise: simple centroid approximation (good enough for our purpose)
    # (Real 120° construction is more involved — this is fast & reasonable)
    return np.mean(pts, axis=0)


def generate_fermat_candidates(coords: np.ndarray, max_candidates: int = 30) -> np.ndarray:
    """
    Generate candidate pole locations using approximate Fermat-Torricelli points
    from Delaunay triangles. These are more "Steiner-like" than Voronoi vertices.

    Args:
        coords: (n, 2) array of terminal points [lat, lon]
        max_candidates: limit number of generated points (avoid too many)

    Returns:
        np.ndarray: candidate points (m, 2)
    """
    if len(coords) < 3:
        return np.empty((0, 2), dtype=float)

    # Compute Delaunay triangulation
    tri = Delaunay(coords)

    candidates = []

    for simplex in tri.simplices:
        if len(candidates) >= max_candidates:
            break
        pts = coords[simplex]
        # Get approximate Steiner/Fermat point for this triangle
        st_pt = fermat_torricelli_point(pts)
        candidates.append(st_pt)

    if not candidates:
        return np.empty((0, 2), dtype=float)

    candidates = np.array(candidates)

    # Optional: apply your existing separation filter
    # (you can reuse the same greedy logic from generate_voronoi_candidates)
    if len(candidates) > 1:
        sort_idx = np.argsort(candidates[:, 0])
        candidates = candidates[sort_idx]

        kept = []
        kept_array = np.empty((0, 2))

        for pt in candidates:
            if len(kept_array) == 0:
                kept.append(pt)
                kept_array = np.array([pt])
                continue

            dists_to_kept = haversine_vec(np.array([pt]), kept_array)[0]
            if np.all(dists_to_kept >= MIN_CANDIDATE_SEPARATION):
                kept.append(pt)
                kept_array = np.vstack([kept_array, pt])

        candidates = np.array(kept)

    print(f"Generated {len(candidates)} Fermat-Steiner candidate poles "
          f"(limited to {max_candidates}, after min separation filter)")

    return candidates


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
