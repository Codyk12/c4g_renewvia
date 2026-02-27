# backend/mst.py
from scipy.spatial.distance import cdist

from candidate_generation import *
from build_graph import *


def compute_mst(request: OptimizationRequest) -> Dict[str, Any]:
    """Compute a realistic power distribution network using MST with intermediate poles.

    Uses Voronoi vertices as candidate pole locations.
    Enforces no direct terminal-to-terminal connections.
    Dynamically identifies the "Power Source" point by name.
    Returns edges, nodes, lengths, and cost estimates.

    Args:
        request (OptimizationRequest): Input from frontend containing points and costs.

    Returns:
        Dict[str, Any]: Result with edges, nodes, totals, costs, and debug info.
    """
    # ─── Process input ────────────────────────────────────────────────
    coords, terminal_indices, source_idx, original_names, costs = parse_input(request)

    debug = request.debug

    # ─── Generate candidates ────────────────────────────────────────────────
    # candidates = generate_voronoi_candidates(coords)
    candidates = generate_fermat_candidates(coords, max_candidates=100)

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
        terminal_indices=terminal_indices,
        pole_indices=pole_indices,
        dist_matrix=dist_matrix,  # you already compute this
        costs=costs,
    )

    arbo = nx.minimum_spanning_arborescence(DG, attr="weight", preserve_attrs=True, default=1e18)

    # ─── Remove 0 degree poles ────────────────────────────────────────────────
    mst = prune_dead_end_pole_branches(arbo, pole_indices, terminal_indices)

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
                "name": f"Candidate {i}",
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
                "type": "source" if i == source_idx else "terminal" if i < pole_start_idx else "pole"
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
