import math
import numpy as np
from typing import Dict, Union, Any, List

from pydantic import BaseModel


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


def parse_input(request: OptimizationRequest):
    """
    Parses input request containing information about geographical points, costs, and their attributes to generate structured
    data suitable for optimization tasks.

    This function processes the input `OptimizationRequest` to extract coordinates, their names, and classify one of the
    locations as the "Power Source". It ensures that the input contains at least two valid points, assigns a "Power Source"
    if not explicitly provided, and organizes the remaining points as terminals. The function also validates and cleans input
    data for consistency.

    Args:
        request: Input request containing points and their associated costs

    Returns:
        A tuple containing coords, terminal_indices, source_idx, original_names, costs
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

    terminal_indices = [i for i in range(len(coords)) if i != source_idx]

    return coords, terminal_indices, source_idx, names, costs


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
