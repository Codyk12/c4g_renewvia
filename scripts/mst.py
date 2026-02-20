# mst.py
import sys
import json
import pandas as pd
import numpy as np
import networkx as nx
from itertools import combinations

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(json.dumps({"error": "Usage: python mst.py <csv_path> <costs_json>"}))
        sys.exit(1)

    csv_path = sys.argv[1]
    costs_json_str = sys.argv[2]

    try:
        costs = json.loads(costs_json_str)
        # For now, just receive and echo them back
        received_costs = {
            "poleCost": float(costs.get("poleCost", 0)),
            "lowVoltageCostPerMeter": float(costs.get("lowVoltageCostPerMeter", 0)),
            "highVoltageCostPerMeter": float(costs.get("highVoltageCostPerMeter", 0)),
        }

        # ────────────────────────────────────────────────
        # Existing MST computation (unchanged)
        # ────────────────────────────────────────────────
        coords = pd.read_csv(csv_path)
        coords = coords[['Latitude', 'Longitude']].dropna().reset_index(drop=True)

        if len(coords) < 2:
            print(json.dumps({"error": "Need at least 2 points"}))
            sys.exit(1)

        G = nx.Graph()
        for i, row in coords.iterrows():
            G.add_node(i, pos=(row['Longitude'], row['Latitude']))

        for (i, j) in combinations(coords.index, 2):
            lat1, lon1 = coords.loc[i, ['Latitude', 'Longitude']]
            lat2, lon2 = coords.loc[j, ['Latitude', 'Longitude']]
            dist = np.sqrt((lat2 - lat1)**2 + (lon2 - lon1)**2)
            G.add_edge(i, j, weight=dist)

        mst = nx.minimum_spanning_tree(G, algorithm='kruskal')

        edges = []
        for u, v, d in mst.edges(data=True):
            p1 = coords.loc[u]
            p2 = coords.loc[v]
            edges.append({
                "start": {"lat": float(p1['Latitude']), "lng": float(p1['Longitude'])},
                "end":   {"lat": float(p2['Latitude']), "lng": float(p2['Longitude'])},
                "weight": float(d['weight'])
            })

        total_weight = sum(d['weight'] for _, _, d in mst.edges(data=True))

        result = {
            "edges": edges,
            "total_weight": float(total_weight),
            "point_count": len(coords),
            "receivedCosts": received_costs,   # echo back
            "note": "Costs received but not yet used in calculation"
        }

        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)