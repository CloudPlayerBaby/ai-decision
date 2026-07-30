import {
  Handle,
  Position,
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
} from '@xyflow/react'
import type { Node, Edge, NodeProps } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useLayoutStore } from '../../stores/layoutStore'
import { mockCanvas } from '../../mocks/canvas.mock'
import type {
  DecisionNodeData,
  FactorNodeData,
  OptionNodeData,
} from '../../types/canvas'

type FlowNode = Node<DecisionNodeData | FactorNodeData | OptionNodeData>

/** 决策问题节点 */
function DecisionNode({ data }: NodeProps<FlowNode>) {
  const nodeData = data as DecisionNodeData
  return (
    <div className="canvas-node canvas-node--decision">
      <div className="canvas-node__label">决策问题</div>
      <div className="canvas-node__title">{nodeData.label}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

/** 影响因素节点 */
function FactorNode({ data }: NodeProps<FlowNode>) {
  const nodeData = data as FactorNodeData
  const weightPercent = Math.round(nodeData.weight * 100)
  return (
    <div className="canvas-node canvas-node--factor">
      <Handle type="target" position={Position.Left} />
      <div className="canvas-node__label">
        <span className="canvas-node__factor-weight">{weightPercent}%</span>
        <span>关键因素</span>
      </div>
      <div className="canvas-node__title">{nodeData.label}</div>
      {nodeData.description ? (
        <div className="canvas-node__subtitle">{nodeData.description}</div>
      ) : null}
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

/** 候选方案节点 */
function OptionNode({ data }: NodeProps<FlowNode>) {
  const nodeData = data as OptionNodeData
  const { scores, recommendationBadge } = nodeData

  return (
    <div className="canvas-node canvas-node--option">
      <Handle type="target" position={Position.Left} />
      <div className="canvas-node__label">
        <span>候选方案</span>
        {recommendationBadge ? (
          <span className="canvas-node__badge">{recommendationBadge}</span>
        ) : null}
      </div>
      <div className="canvas-node__title">{nodeData.label}</div>

      <div className="canvas-node__scores">
        <div className="canvas-node__score-item">
          <span className="canvas-node__score-label">成本</span>
          <span className="canvas-node__score-value">{scores.cost}</span>
        </div>
        <div className="canvas-node__score-item">
          <span className="canvas-node__score-label">时间</span>
          <span className="canvas-node__score-value">{scores.time}</span>
        </div>
        <div className="canvas-node__score-item">
          <span className="canvas-node__score-label">收益</span>
          <span className="canvas-node__score-value">{scores.benefit}</span>
        </div>
        <div className="canvas-node__score-item">
          <span className="canvas-node__score-label">风险</span>
          <span className="canvas-node__score-value">{scores.risk}</span>
        </div>
        <div className="canvas-node__score-item">
          <span className="canvas-node__score-label">可行</span>
          <span className="canvas-node__score-value">{scores.feasibility}</span>
        </div>
      </div>
    </div>
  )
}

const nodeTypes = {
  decision: DecisionNode,
  factor: FactorNode,
  option: OptionNode,
}

/**
 * 决策画布面板
 * 展示决策问题、影响因素和候选方案的节点关系图
 * 数据来源：mocks/canvas.mock.ts（后续对接 GET /decisions/{id}/canvas）
 */
export function DecisionCanvasPanel() {
  // 从 Mock 数据初始化
  const initialNodes: FlowNode[] = mockCanvas.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: n.data,
  }))

  const initialEdges: Edge[] = mockCanvas.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
  }))

  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, , onEdgesChange] = useEdgesState(initialEdges)
  const themeMode = useLayoutStore((state) => state.themeMode)
  const dotColor = themeMode === 'eyeCare' ? '#2f3644' : '#d9dee7'

  return (
    <div className="canvas-panel">
      <div className="canvas-panel__toolbar">
        <span>编辑模式：拖拽移动 · 点击节点查看详情</span>
        <span className="canvas-panel__hint">
          保存后将提交完整 nodes + edges 至 /canvas 接口
        </span>
      </div>
      <div className="canvas-panel__flow">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable
          colorMode={themeMode === 'eyeCare' ? 'dark' : 'light'}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={18} size={1} color={dotColor} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  )
}
