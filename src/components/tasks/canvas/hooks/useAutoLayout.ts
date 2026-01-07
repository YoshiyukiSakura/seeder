import dagre from 'dagre'
import { Node, Edge } from '@xyflow/react'

const NODE_WIDTH = 280
const NODE_HEIGHT = 150

interface LayoutOptions {
  direction?: 'LR' | 'TB'  // Left-Right or Top-Bottom
  nodeSpacing?: number
  rankSpacing?: number
}

export function useAutoLayout() {
  const getLayoutedElements = (
    nodes: Node[],
    edges: Edge[],
    options: LayoutOptions = {}
  ): { nodes: Node[]; edges: Edge[] } => {
    const {
      direction = 'LR',
      nodeSpacing = 50,
      rankSpacing = 100,
    } = options

    const dagreGraph = new dagre.graphlib.Graph()
    dagreGraph.setDefaultEdgeLabel(() => ({}))
    dagreGraph.setGraph({
      rankdir: direction,
      nodesep: nodeSpacing,
      ranksep: rankSpacing,
    })

    // Add nodes to dagre
    nodes.forEach((node) => {
      dagreGraph.setNode(node.id, {
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      })
    })

    // Add edges to dagre
    edges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target)
    })

    // Run layout
    dagre.layout(dagreGraph)

    // Apply positions to nodes
    const layoutedNodes = nodes.map((node) => {
      const nodeWithPosition = dagreGraph.node(node.id)
      return {
        ...node,
        position: {
          x: nodeWithPosition.x - NODE_WIDTH / 2,
          y: nodeWithPosition.y - NODE_HEIGHT / 2,
        },
      }
    })

    return { nodes: layoutedNodes, edges }
  }

  return { getLayoutedElements, NODE_WIDTH, NODE_HEIGHT }
}
