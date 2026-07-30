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

type PlaceholderNodeData = {
  title: string
  subtitle?: string
  badge?: string
  lines?: string[]
  weight?: string
}

function DecisionNode({ data }: NodeProps<Node<PlaceholderNodeData>>) {
  return (
    <div className="canvas-node canvas-node--decision">
      <div className="canvas-node__label">决策问题</div>
      <div className="canvas-node__title">{data.title}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

function FactorNode({ data }: NodeProps<Node<PlaceholderNodeData>>) {
  return (
    <div className="canvas-node canvas-node--factor">
      <Handle type="target" position={Position.Left} />
      <div className="canvas-node__label">
        关键因素{data.weight ? ` · ${data.weight}` : ''}
      </div>
      <div className="canvas-node__title">{data.title}</div>
      {data.subtitle ? (
        <div className="canvas-node__subtitle">{data.subtitle}</div>
      ) : null}
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

function OptionNode({ data }: NodeProps<Node<PlaceholderNodeData>>) {
  return (
    <div className="canvas-node canvas-node--option">
      <Handle type="target" position={Position.Left} />
      <div className="canvas-node__label">
        候选方案
        {data.badge ? (
          <span className="canvas-node__badge">{data.badge}</span>
        ) : null}
      </div>
      <div className="canvas-node__title">{data.title}</div>
      {data.lines?.map((line) => (
        <div key={line} className="canvas-node__subtitle">
          {line}
        </div>
      ))}
    </div>
  )
}

const nodeTypes = {
  decision: DecisionNode,
  factor: FactorNode,
  option: OptionNode,
}

const initialNodes: Node<PlaceholderNodeData>[] = [
  {
    id: 'root',
    type: 'decision',
    position: { x: 24, y: 180 },
    data: { title: '优先学习 Redis 还是 Docker？' },
  },
  {
    id: 'f_time',
    type: 'factor',
    position: { x: 300, y: 40 },
    data: {
      title: '时间成本',
      weight: '30%',
      subtitle: '每天 2 小时，共 14 小时可用',
    },
  },
  {
    id: 'f_benefit',
    type: 'factor',
    position: { x: 300, y: 180 },
    data: {
      title: '求职收益',
      weight: '35%',
      subtitle: '面试高频度与项目可展示性',
    },
  },
  {
    id: 'f_practice',
    type: 'factor',
    position: { x: 300, y: 320 },
    data: {
      title: '项目实践',
      weight: '20%',
      subtitle: '能否形成可验证成果',
    },
  },
  {
    id: 'opt_docker',
    type: 'option',
    position: { x: 580, y: 40 },
    data: {
      title: '方案 A：优先 Docker',
      lines: ['优点：工程化与部署能力', '风险：面试题偏场景化'],
    },
  },
  {
    id: 'opt_redis',
    type: 'option',
    position: { x: 580, y: 180 },
    data: {
      title: '方案 B：优先 Redis',
      badge: '推荐',
      lines: ['优点：面试高频缓存考点', '风险：缺少项目实践'],
    },
  },
  {
    id: 'opt_both',
    type: 'option',
    position: { x: 580, y: 320 },
    data: {
      title: '方案 C：双轨轻量',
      lines: ['优点：覆盖更广', '风险：两周内深度不足'],
    },
  },
]

const initialEdges: Edge[] = [
  { id: 'e1', source: 'root', target: 'f_time' },
  { id: 'e2', source: 'root', target: 'f_benefit' },
  { id: 'e3', source: 'root', target: 'f_practice' },
  { id: 'e4', source: 'f_time', target: 'opt_docker' },
  { id: 'e5', source: 'f_benefit', target: 'opt_redis' },
  { id: 'e6', source: 'f_practice', target: 'opt_both' },
]

/** 画布占位：示意节点，后续对接 GET/PUT canvas */
export function DecisionCanvasPanel() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, , onEdgesChange] = useEdgesState(initialEdges)
  const themeMode = useLayoutStore((state) => state.themeMode)
  const dotColor = themeMode === 'eyeCare' ? '#2f3644' : '#d9dee7'

  return (
    <div className="canvas-panel">
      <div className="canvas-panel__toolbar">
        <span>编辑模式：拖拽移动 · 点击节点编辑 · 双击空白新增（占位）</span>
        <span>画布数据待接入 · 保存提交完整 nodes + edges</span>
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
