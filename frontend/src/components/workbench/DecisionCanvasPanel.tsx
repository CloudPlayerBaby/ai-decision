import { useState, useEffect, useRef } from 'react'
import {
  Handle,
  Position,
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  applyNodeChanges,
  applyEdgeChanges,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type Node,
  type Edge,
  type NodeProps,
} from '@xyflow/react'
import { Drawer, Form, Input, Slider, Rate, Button, Space, Divider, Popconfirm } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import '@xyflow/react/dist/style.css'
import { useLayoutStore } from '@/stores/layoutStore'
import { mockCanvas } from '@/mocks/canvas.mock'
import type { WorkbenchSlotProps } from '@/components/workbench/workbenchContracts'
import type {
  DecisionNodeData,
  FactorNodeData,
  OptionNodeData,
  CanvasData,
  EdgeRelation,
} from '@/types/canvas'

type FlowNodeData = (DecisionNodeData | FactorNodeData | OptionNodeData) &
  Record<string, unknown>
type FlowNode = Node<FlowNodeData>
type FlowEdge = Edge & { relation?: EdgeRelation }

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

export interface DecisionCanvasPanelProps extends WorkbenchSlotProps {
  onDirtyChange?: (dirty: boolean) => void
  onCanvasChange?: (canvas: CanvasData) => void
}

/** 生成语义化快照字符串（忽略 React Flow UI 临时字段） */
function buildSemanticSignature(nodes: FlowNode[], edges: FlowEdge[]): string {
  const snapshot: CanvasData = {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type as 'decision' | 'factor' | 'option',
      position: n.position,
      data: n.data as DecisionNodeData | FactorNodeData | OptionNodeData,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      relation: e.relation,
    })),
  }
  return JSON.stringify(snapshot)
}

/** 从语义化快照构建 CanvasData */
function buildCanvasData(nodes: FlowNode[], edges: FlowEdge[]): CanvasData {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type as 'decision' | 'factor' | 'option',
      position: n.position,
      data: n.data as DecisionNodeData | FactorNodeData | OptionNodeData,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      relation: e.relation,
    })),
  }
}

/** 根据节点类型组合确定边的 relation */
function getEdgeRelation(
  sourceType?: string,
  targetType?: string,
): EdgeRelation | null {
  if (sourceType === 'decision' && targetType === 'factor') {
    return 'HAS_FACTOR'
  }
  if (sourceType === 'factor' && targetType === 'option') {
    return 'AFFECTS'
  }
  return null
}

/** 生成唯一 ID */
function genId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`
}

/** 创建新节点 */
function createNode(
  type: 'factor' | 'option',
  existingNodes: FlowNode[],
): FlowNode {
  const sameTypeNodes = existingNodes.filter((n) => n.type === type)
  const lastY =
    sameTypeNodes.length > 0
      ? Math.max(...sameTypeNodes.map((n) => n.position.y))
      : 0

  const id = genId(type === 'factor' ? 'factor' : 'option')
  const x = type === 'factor' ? 300 : 580
  const y = lastY + 120

  if (type === 'factor') {
    return {
      id,
      type: 'factor',
      position: { x, y },
      data: {
        nodeType: 'factor',
        label: '',
        weight: 0.1,
        description: '',
      } as FlowNodeData,
    }
  }

  return {
    id,
    type: 'option',
    position: { x, y },
    data: {
      nodeType: 'option',
      label: '',
      scores: { cost: 3, time: 3, benefit: 3, risk: 3, feasibility: 3 },
    } as FlowNodeData,
  }
}

/** 画布挂载点：A 组渲染与编辑；C 注入 decisionId / taskId */
export function DecisionCanvasPanel({
  decisionId: _decisionId,
  onDirtyChange,
  onCanvasChange,
}: DecisionCanvasPanelProps) {
  // 从 Mock 数据初始化
  const initialNodes: FlowNode[] = mockCanvas.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: n.data as FlowNodeData,
  }))

  const initialEdges: FlowEdge[] = mockCanvas.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    relation: e.relation,
  }))

  const [nodes, setNodes] = useNodesState<FlowNode>(initialNodes)
  const [edges, setEdges] = useEdgesState<FlowEdge>(initialEdges)
  const themeMode = useLayoutStore((state) => state.themeMode)
  const dotColor = themeMode === 'eyeCare' ? '#2f3644' : '#d9dee7'

  // 初始语义快照
  const initialSignature = useRef(buildSemanticSignature(initialNodes, initialEdges))

  // 上次已通知的快照（用于去重）
  const lastNotifiedSignature = useRef<string | null>(null)

  // 跳过首次渲染（由 mock 初始化产生）
  const didMount = useRef(false)

  // 用 ref 持有回调，避免 useEffect 依赖函数引用
  const onDirtyChangeRef = useRef(onDirtyChange)
  const onCanvasChangeRef = useRef(onCanvasChange)
  // eslint-disable-next-line react-hooks/static-lifecycle
  useEffect(() => {
    onDirtyChangeRef.current = onDirtyChange
    onCanvasChangeRef.current = onCanvasChange
  })

  // 统一脏检测与通知
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true
      return
    }

    const currentSignature = buildSemanticSignature(nodes, edges)
    const isDirty = currentSignature !== initialSignature.current

    if (currentSignature !== lastNotifiedSignature.current) {
      lastNotifiedSignature.current = currentSignature
      onCanvasChangeRef.current?.(buildCanvasData(nodes, edges))
    }

    onDirtyChangeRef.current?.(isDirty)
  }, [nodes, edges])

  // 始终保存最新 nodes/edges 供 handleConnect 读取
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  nodesRef.current = nodes
  edgesRef.current = edges

  // Drawer 状态
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingNode, setEditingNode] = useState<FlowNode | null>(null)
  const [isNewNode, setIsNewNode] = useState(false)
  const [form] = Form.useForm()

  /** 打开编辑/新增 Drawer */
  const openDrawer = (node: FlowNode | null, isNew: boolean) => {
    setEditingNode(node)
    setIsNewNode(isNew)
    setDrawerOpen(true)

    if (node) {
      if (node.type === 'factor') {
        const d = node.data as FactorNodeData
        form.setFieldsValue({
          label: d.label,
          weight: d.weight,
          description: d.description ?? '',
        })
      } else if (node.type === 'option') {
        const d = node.data as OptionNodeData
        form.setFieldsValue({
          label: d.label,
          ...d.scores,
        })
      }
    } else {
      form.resetFields()
      if (nodes.find((n) => n.type === 'option')) {
        form.setFieldsValue({
          cost: 3,
          time: 3,
          benefit: 3,
          risk: 3,
          feasibility: 3,
        })
      }
    }
  }

  /** 关闭 Drawer */
  const closeDrawer = () => {
    setDrawerOpen(false)
    setEditingNode(null)

    if (isNewNode && editingNode) {
      setNodes((prev) => prev.filter((n) => n.id !== editingNode.id))
    }
  }

  /** 提交表单 */
  const submitForm = () => {
    form.validateFields().then((values) => {
      if (!editingNode) return

      if (editingNode.type === 'factor') {
        setNodes((prev) =>
          prev.map((n) =>
            n.id === editingNode.id
              ? {
                  ...n,
                  data: {
                    ...(n.data as FactorNodeData),
                    label: values.label,
                    weight: values.weight,
                    description: values.description,
                  } as FlowNodeData,
                }
              : n,
          ),
        )
      } else if (editingNode.type === 'option') {
        setNodes((prev) =>
          prev.map((n) =>
            n.id === editingNode.id
              ? {
                  ...n,
                  data: {
                    ...(n.data as OptionNodeData),
                    label: values.label,
                    scores: {
                      cost: values.cost,
                      time: values.time,
                      benefit: values.benefit,
                      risk: values.risk,
                      feasibility: values.feasibility,
                    },
                  } as FlowNodeData,
                }
              : n,
          ),
        )
      }

      setDrawerOpen(false)
      setEditingNode(null)
    })
  }

  /** 删除节点 */
  const deleteNode = (nodeId: string) => {
    if (nodeId === 'root') return

    setNodes((prev) => prev.filter((n) => n.id !== nodeId))
    setEdges((prev) =>
      prev.filter((e) => e.source !== nodeId && e.target !== nodeId),
    )

    if (editingNode?.id === nodeId) {
      setDrawerOpen(false)
      setEditingNode(null)
    }
  }

  /** 处理节点点击 */
  const handleNodeClick = (_: React.MouseEvent, node: FlowNode) => {
    if (node.type === 'decision') return
    openDrawer(node, false)
  }

  /** 处理边变更（仅处理 remove） */
  const handleEdgesChange = (changes: EdgeChange[]) => {
    const nextEdges = applyEdgeChanges(changes, edges)
    setEdges(nextEdges)
  }

  /** 处理节点变更（仅处理 remove、position 完成） */
  const handleNodesChange = (changes: NodeChange<FlowNode>[]) => {
    const nextNodes = applyNodeChanges(changes, nodes)
    setNodes(nextNodes)
  }

  /** 处理新增边 */
  const handleConnect = (connection: Connection) => {
    if (!connection.source || !connection.target) return
    if (connection.source === connection.target) return

    const duplicate = edgesRef.current.some(
      (e) => e.source === connection.source && e.target === connection.target,
    )
    if (duplicate) return

    const sourceNode = nodesRef.current.find((n) => n.id === connection.source)
    const targetNode = nodesRef.current.find((n) => n.id === connection.target)
    const relation = getEdgeRelation(sourceNode?.type, targetNode?.type)
    if (!relation) return

    const newEdge: FlowEdge = {
      id: genId('e'),
      source: connection.source,
      target: connection.target,
      relation,
    }

    setEdges((prev) => [...prev, newEdge])
  }

  /** 新增因素 */
  const addFactor = () => {
    const node = createNode('factor', nodes)
    setNodes((prev) => [...prev, node])
    openDrawer(node, true)
  }

  /** 新增方案 */
  const addOption = () => {
    const node = createNode('option', nodes)
    setNodes((prev) => [...prev, node])
    openDrawer(node, true)
  }

  const drawerTitle =
    editingNode?.type === 'factor'
      ? isNewNode
        ? '新增影响因素'
        : '编辑影响因素'
      : isNewNode
        ? '新增候选方案'
        : '编辑候选方案'

  const isFactor = editingNode?.type === 'factor'
  const isOption = editingNode?.type === 'option'

  return (
    <div className="canvas-panel">
      <div className="canvas-panel__toolbar">
        <Space>
          <Button
            size="small"
            icon={<PlusOutlined />}
            onClick={addFactor}
          >
            新增因素
          </Button>
          <Button
            size="small"
            icon={<PlusOutlined />}
            onClick={addOption}
          >
            新增方案
          </Button>
        </Space>
        <span className="canvas-panel__hint">
          点击节点编辑 · 选中边按 Delete 删除
        </span>
      </div>

      <div className="canvas-panel__flow">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={handleConnect}
          onNodeClick={handleNodeClick}
          nodeTypes={nodeTypes}
          fitView
          nodesDraggable
          nodesConnectable
          elementsSelectable
          colorMode={themeMode === 'eyeCare' ? 'dark' : 'light'}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={18} size={1} color={dotColor} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      <Drawer
        title={drawerTitle}
        placement="right"
        open={drawerOpen}
        onClose={closeDrawer}
        width={380}
        extra={
          isNewNode && isOption && editingNode ? (
            <Popconfirm
              title="删除此方案？"
              onConfirm={() => {
                setDrawerOpen(false)
                deleteNode(editingNode.id)
              }}
              okText="删除"
              cancelText="取消"
            >
              <Button danger size="small" icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          ) : isNewNode && isFactor && editingNode ? (
            <Popconfirm
              title="删除此因素？"
              onConfirm={() => {
                setDrawerOpen(false)
                deleteNode(editingNode.id)
              }}
              okText="删除"
              cancelText="取消"
            >
              <Button danger size="small" icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          ) : isOption && editingNode && editingNode.id !== 'root' ? (
            <Popconfirm
              title="删除此方案？"
              onConfirm={() => {
                deleteNode(editingNode.id)
              }}
              okText="删除"
              cancelText="取消"
            >
              <Button danger size="small" icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          ) : isFactor && editingNode && editingNode.id !== 'root' ? (
            <Popconfirm
              title="删除此因素？"
              onConfirm={() => {
                deleteNode(editingNode.id)
              }}
              okText="删除"
              cancelText="取消"
            >
              <Button danger size="small" icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          ) : null
        }
      >
        {editingNode && (
          <Form
            form={form}
            layout="vertical"
            onFinish={submitForm}
          >
            <Form.Item
              name="label"
              label="名称"
              rules={[{ required: true, message: '请输入名称' }]}
            >
              <Input placeholder={isFactor ? '如：时间成本' : '如：方案 A：优先 Docker'} />
            </Form.Item>

            {isFactor && (
              <>
                <Form.Item
                  name="weight"
                  label={`权重：${form.getFieldValue('weight') !== undefined ? Math.round((form.getFieldValue('weight') as number) * 100) : 10}%`}
                >
                  <Slider
                    min={0}
                    max={1}
                    step={0.05}
                    tooltip={{ formatter: (v) => `${Math.round((v ?? 0) * 100)}%` }}
                  />
                </Form.Item>
                <Form.Item name="description" label="描述">
                  <Input.TextArea rows={3} placeholder="可选" />
                </Form.Item>
              </>
            )}

            {isOption && (
              <>
                <Divider plain>五维评分</Divider>
                <Form.Item
                  name="cost"
                  label="成本（1=高成本，5=低成本）"
                >
                  <Rate count={5} />
                </Form.Item>
                <Form.Item
                  name="time"
                  label="时间（1=耗时久，5=耗时短）"
                >
                  <Rate count={5} />
                </Form.Item>
                <Form.Item
                  name="benefit"
                  label="收益（1=收益低，5=收益高）"
                >
                  <Rate count={5} />
                </Form.Item>
                <Form.Item
                  name="risk"
                  label="风险（1=高风险，5=低风险）"
                >
                  <Rate count={5} />
                </Form.Item>
                <Form.Item
                  name="feasibility"
                  label="可行性（1=难实现，5=易实现）"
                >
                  <Rate count={5} />
                </Form.Item>
              </>
            )}

            <Form.Item style={{ marginBottom: 0, marginTop: 16 }}>
              <Space>
                <Button type="primary" onClick={submitForm}>
                  保存
                </Button>
                <Button onClick={closeDrawer}>取消</Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Drawer>
    </div>
  )
}
