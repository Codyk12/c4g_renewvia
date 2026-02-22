import random as rand
import numpy as np
import matplotlib.pyplot as plt


class minimum_spanning_tree(object):  		  	   		 	 	 			  		 			     			  	 
    """
    This is a minimum spanning tree. 
    from: https://www.geeksforgeeks.org/dsa/what-is-minimum-spanning-tree-mst/
    'A spanning tree is defined as a tree-like subgraph of a connected, undirected graph that includes all the vertices of the graph.' 
    in other words, its a subset of edges tthat connects all the graph nodes. A minimum spanning tree connects the nodes in the minimum possible
    distance/weights (hello GA lol)
    
    So, I should be able to take nodes and the possible edges, and output the minimum number of edges. 

    In this case, we have the nodes as coordinates and the weight is the euclidian distance. We can adjust this over time to exclude specific regions.
    In addition, it is important that we be able to create new nodes as needed (not true nodes, but divergences in the edges. This should be a flag as it
    breaks the MST and it is possible that node regions must be set in specific locations for maintenance (tho they do mention that that shouldn't be an issue).
    
 
    :param nodes: A list of tples containing the x,y locations of the nodes
    :type nodes: int  
    :parem source: A tuple with the source of the tree
    :type source: tuple 
    :param edge_splits: whether edges can split into new edges (we add a pole)
    :type edge_splits: bool 
    """
    
    def __init__( 
        self,  
        nodes=None,
        source=None,
	verbose=False,
        ):
        """ 
        Constructor method  		  	   		 	 	 			  		 			     			  	 
        """  		  	   		 	 	 			  		 			     			  	 
        # Make all the inputs self guys
        self.verbose = verbose  		  	   		 	 	 			  		 			     			  	 
        self.nodes = nodes 
        self.source = source

        # Define source
        if self.source == None and self.nodes != None:
           self.source = self.nodes[0]

    def get_distance(self, node1, node2):
        """
        Honestly this may be too slow to do but we shall see
        """
        x1, y1 = node1
        x2, y2 = node2
        return ((x2 - x1)**2 + (y2 - y1)**2)**0.5

    def build_mst(self):
        """
        We copy GA.. what an apropriate lecture series to overlap with! 
        """

        # Base case: if we dont have any nodes, then we don't have any edges to use
        if self.nodes == None:
           return []

        # Ok So we want to connect everythign
        seen = set()
        mst = []

        seen.add(self.source)
        total_distance = 0
        # Remove any duplicates
        all_nodes = set(self.nodes)
        all_nodes.add(source)
        total_nodes = len(all_nodes)

        while len(seen) < total_nodes:
              # Restart our coparison from the last seen nodes (so we are branching out from thecenter/source
              min_edge = None
              min_dist = float('inf')

              # we need to go to all the nodes we havent seen and pick the shortest distance
              for v in seen:
                  for node in self.nodes:
                      if node not in seen:
                         dist = self.get_distance(v, node)
                         # Save the min edge so far
                         if dist < min_dist:
                            min_dist = dist
                            min_edge = (v, node)

              # Add best edge found
              from_node = min_edge[0]
              to_node = min_edge[1]
              # And once we picked the shortst distance we add it to what we have seen
              seen.add(to_node)
              # and to the tree
              mst.append((from_node, to_node, min_dist))
              total_distance += min_dist

        if self.verbose == True:
           print('Total wire length:', total_distance)
        return mst


    # Ok next up! drawing.. I'm terrible at plotting except with my fav seaborn so I've compiled from the interwebs: 
    # 
    def draw(self, edges):
        xs = [node[0] for node in self.nodes]
        ys = [node[1] for node in self.nodes]

        plt.figure(figsize=(12, 8))
        plt.scatter(xs, ys, color='black')
        # Source: https://www.w3schools.com/python/matplotlib_markers.asp
        plt.scatter(self.source[0], self.source[1], color='yellow', s=120, marker='*', label='Source')

        # Block below is from: https://stackoverflow.com/questions/67248771/how-is-zorder-used-in-matplotlib
        for node1, node2, dist in edges:
            x = [node1[0], node2[0]]
            y = [node1[1], node2[1]]
            plt.plot(x, y, color='skyblue', zorder=1)

        plt.title('Minimum Spanning Tree for input nodes')
        plt.legend()
        plt.grid(True)
        plt.show()

  		  	   		 	 	 			  		 			     			  	 

# make ten random nodesa
nodes = [(rand.randint(0, 100), rand.randint(0, 100)) for i in range(10)]
source = (25,25)

mst = minimum_spanning_tree(nodes=nodes, source=source, verbose=True)
mst_edges = mst.build_mst()

print('Edges:')
for edge in mst_edges:
    print(edge)

mst.draw(mst_edges)
