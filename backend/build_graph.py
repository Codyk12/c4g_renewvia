import networkx as nx

MIN_POLE_TO_TERMINAL = 10.0
MAX_POLE_TO_TERMINAL = 100.0

MIN_POLE_TO_POLE = 10.0
MAX_POLE_TO_POLE = 150.0


def build_directed_graph_for_arborescence(
        source_idx,
        terminal_indices,
        pole_indices,
        dist_matrix,
        costs,
) -> nx.DiGraph:
    """
    Builds a directed graph for use in finding a minimum-cost arborescence given
    a set of coordinates, indices, and constraints.

    This function constructs a directed graph where poles and terminals are represented
    as nodes, and edges represent potential connections between them. Different weight
    and voltage attributes are applied to the edges depending on their type (pole-to-terminal,
    pole-to-pole, or source-to-pole/terminal connections).

    Args:
        source_idx: Integer index representing the source node (e.g., a substation).
        terminal_indices: List of integers representing indices of all terminals.
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

    # Directed: poles → terminals (service drops)
    for p in pole_indices:
        for h in terminal_indices:
            d = dist_matrix[p, h]
            if 0.1 < d <= MAX_POLE_TO_TERMINAL:
                w = d  # TODO: Adjust weight based on costs
                DG.add_edge(p, h, weight=w, length=d, voltage="low")

    # Bidirectional pole ↔ pole (undirected spans)
    for i in range(len(pole_indices)):
        for j in range(i + 1, len(pole_indices)):
            p1, p2 = pole_indices[i], pole_indices[j]
            d = dist_matrix[p1, p2]
            w = d + 100 # TODO: Adjust weight based on costs
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


def prune_dead_end_pole_branches(arbo: nx.DiGraph, pole_indices: list, terminal_indices) -> nx.DiGraph:
    """
    Prunes dead-end pole branches in a Directed Graph (DiGraph).

    This function removes leaf nodes in the provided graph that represent poles and do not serve
    any terminal nodes in their subtree. The pruning process continues iteratively until no such
    dead-end poles remain in the graph. It modifies a copy of the input graph without affecting
    the original.

    Args:
        arbo (nx.DiGraph): A directed graph representing the network structure.
        pole_indices (list): A list of node indices representing poles in the graph.
        terminal_indices (list): A list of node indices representing terminals in the graph.

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
                # Check if this leaf (or its subtree) serves any terminal
                descendants = nx.descendants(arbo, leaf) | {leaf}
                if not any(d in terminal_indices for d in descendants):
                    # No terminal served → safe to remove
                    predecessors = list(arbo.predecessors(leaf))
                    for pred in predecessors:
                        arbo.remove_edge(pred, leaf)
                    arbo.remove_node(leaf)
                    removed = True
    return arbo
