import { useState, useEffect, useRef, useCallback } from 'react'
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
import { Modal, Form, Input, Slider, Rate, Button, Space, Divider, Popconfirm, Popover } from 'antd'
import { DeleteOutlined, CloseOutlined, PlusOutlined } from '@ant-design/icons'
import '@xyflow/react/dist/style.css'
import { useLayoutStore } from '../../stores/layoutStore'
import { mockCanvas } from '../../mocks/canvas.mock'
import { buildMockCanvasViewModel } from '../../mocks/analysis-result.mock'
import type {
  DecisionNodeData,
  FactorNodeData,
  OptionNodeData,
  CanvasData,
  EdgeRelation,
  CanvasViewModel,
} from '../../types/canvas'

type FlowNode = Node<DecisionNodeData | FactorNodeData | OptionNodeData>
type FlowEdge = Edge<{ relation?: EdgeRelation }>

/** 方案摘要（优 N · 缺 N · 风险 N） */
interface OptionSummary {
  pros: string[]
  cons: string[]
  risks: string[]
  isRecommended: boolean
}

/** Props 类型扩展，支持从外部传入 ViewModel 或单独的 optionsDetail */
export interface DecisionCanvasPanelProps {
  onDirtyChange?: (dirty: boolean) => void
  onCanvasChange?: (canvas: CanvasData) => void
  /** 画布展示模型（由 DecisionProblem + AnalysisResult + Canvas 组装） */
  viewModel?: CanvasViewModel
  /** 方案详情（pros / cons / risks），key = option 节点 id */
  optionsDetail?: Record<string, { pros: string[]; cons: string[]; risks: string[] }>
  /** 推荐方案 id（由 AnalysisResult.recommendation.optionId 派生） */
  recommendedOptionId?: string | null
  /** 因素描述，key = factor 节点 id */
  factorsDetail?: Record<string, { description: string }>
}

/** 节点组件 Props 扩展 */
interface FactorNodeProps extends NodeProps<FlowNode> {
  description?: string
}

interface OptionNodeProps extends NodeProps<FlowNode> {
  summary?: OptionSummary
  /** 外部传入的分析详情，用于 Popover 和 Modal */
  detail?: { pros: string[]; cons: string[]; risks: string[] }
  /** 点击"查看分析"或 Popover 内"查看完整分析"时调用，默认打开方案分析 Tab */
  onViewAnalysis?: (nodeId: string) => void
}

/** 决策问题节点 */
function DecisionNode({ data }: NodeProps<FlowNode>) {
  const nodeData = data as DecisionNodeData & { _goal?: string; _constraints?: string }
  return (
    <div className="canvas-node canvas-node--decision">
      <div className="canvas-node__label">决策问题</div>
      <div className="canvas-node__title">{nodeData.label}</div>
      {nodeData._goal ? (
        <div className="canvas-node__subtitle">目标：{nodeData._goal}</div>
      ) : null}
      {nodeData._constraints ? (
        <div className="canvas-node__subtitle canvas-node__subtitle--constraints">
          约束：{nodeData._constraints}
        </div>
      ) : null}
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

/** 影响因素节点 */
function FactorNode({ data }: FactorNodeProps) {
  const nodeData = data as FactorNodeData
  const weightPercent = Math.round(nodeData.weight * 100)
  // description 可由 factorsDetail 注入到 data._description（前端展示用，不回写）
  const description = (data as FactorNodeData & { _description?: string })._description
  return (
    <div className="canvas-node canvas-node--factor">
      <Handle type="target" position={Position.Left} />
      <div className="canvas-node__label">
        <span className="canvas-node__factor-weight">{weightPercent}%</span>
        <span>关键因素</span>
      </div>
      <div className="canvas-node__title">{nodeData.label}</div>
      {description ? (
        <div className="canvas-node__subtitle">{description}</div>
      ) : null}
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

/** 候选方案节点 */
function OptionNode({ data, id, detail, onViewAnalysis }: OptionNodeProps) {
  const nodeData = data as OptionNodeData
  const { scores } = nodeData
  const summary = (data as OptionNodeData & { _summary?: OptionSummary })._summary
  const isRecommended = summary?.isRecommended ?? false
  const hasDetail = Boolean(detail)
  const firstPros = detail?.pros[0]
  const firstCons = detail?.cons[0]
  const firstRisks = detail?.risks[0]

  const popoverContent = (
    <div className="canvas-option-popover">
      <div className="canvas-option-popover__row">
        <span className="canvas-option-popover__label">优势：</span>
        <span>{firstPros ?? '暂无'}</span>
      </div>
      <div className="canvas-option-popover__row">
        <span className="canvas-option-popover__label">局限：</span>
        <span>{firstCons ?? '暂无'}</span>
      </div>
      <div className="canvas-option-popover__row">
        <span className="canvas-option-popover__label">风险：</span>
        <span>{firstRisks ?? '暂无'}</span>
      </div>
      <div
        className="canvas-option-popover__link"
        onClick={(e) => {
          e.stopPropagation()
          onViewAnalysis?.(id)
        }}
      >
        查看完整分析
      </div>
    </div>
  )

  return (
    <div className="canvas-node canvas-node--option">
      <Handle type="target" position={Position.Left} />
      <div className="canvas-node__label">
        <span>候选方案</span>
        {isRecommended ? (
          <span className="canvas-node__badge">推荐</span>
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

      {hasDetail && summary ? (
        <Popover
          content={popoverContent}
          trigger="hover"
          placement="bottom"
          overlayClassName="canvas-option-popover-overlay"
        >
          <div className="canvas-node__option-summary">
            <span>优 {summary.pros.length}</span>
            <span> · 缺 {summary.cons.length}</span>
            <span> · 风险 {summary.risks.length}</span>
            <span
              className="canvas-node__option-summary-link"
              onClick={(e) => {
                e.stopPropagation()
                onViewAnalysis?.(id)
              }}
            >
              查看分析
            </span>
          </div>
        </Popover>
      ) : (
        <div className="canvas-node__option-summary">
          <span className="canvas-node__option-empty">尚未生成方案分析</span>
        </div>
      )}
    </div>
  )
}

// Tab key 类型
type OptionModalTab = 'settings' | 'analysis'

export interface DecisionCanvasPanelProps {
  onDirtyChange?: (dirty: boolean) => void
  onCanvasChange?: (canvas: CanvasData) => void
  /** 画布展示模型（由 DecisionProblem + AnalysisResult + Canvas 组装） */
  viewModel?: CanvasViewModel
  /** 方案详情（pros / cons / risks），key = option 节点 id */
  optionsDetail?: Record<string, { pros: string[]; cons: string[]; risks: string[] }>
  /** 推荐方案 id（由 AnalysisResult.recommendation.optionId 派生） */
  recommendedOptionId?: string | null
  /** 因素描述，key = factor 节点 id */
  factorsDetail?: Record<string, { description: string }>
}

/** 去掉节点 data 中的展示注入字段（_goal/_constraints/_description/_summary），仅保留可保存的契约字段 */
function stripInjectedFields(data: Record<string, unknown>): Record<string, unknown> {
  const { _goal, _constraints, _description, _summary, ...rest } = data
  return rest
}

/** 生成语义化快照字符串（忽略 React Flow UI 临时字段和展示注入字段） */
function buildSemanticSignature(nodes: FlowNode[], edges: FlowEdge[]): string {
  const snapshot: CanvasData = {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type as 'decision' | 'factor' | 'option',
      position: n.position,
      data: stripInjectedFields(n.data as unknown as Record<string, unknown>),
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
      data: stripInjectedFields(n.data as unknown as Record<string, unknown>),
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
      } as FactorNodeData,
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
    } as OptionNodeData,
  }
}

export function DecisionCanvasPanel({
  onDirtyChange,
  onCanvasChange,
  viewModel,
  optionsDetail,
  recommendedOptionId,
  factorsDetail,
}: DecisionCanvasPanelProps) {
  // 优先使用外部注入的 optionsDetail / recommendedOptionId / factorsDetail
  // 若传入 viewModel，则从中提取；否则使用独立参数
  const resolvedOptionsDetail = viewModel?.optionsDetail ?? optionsDetail ?? {}
  const resolvedRecommendedId = viewModel?.recommendedOptionId ?? recommendedOptionId ?? null
  const resolvedFactorsDetail = viewModel?.factorsDetail ?? factorsDetail ?? {}

  // 无外部 viewModel 时，组装 mock ViewModel 以注入 goal/constraints
  const mockViewModel = viewModel ?? buildMockCanvasViewModel()

  // 从 Mock 数据初始化，并将 factorsDetail / optionsDetail / recommendedOptionId 注入到节点 data
  const initialNodes: FlowNode[] = mockCanvas.nodes.map((n) => {
    const node: FlowNode = {
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data,
    }
    // 注入 factorsDetail.description 到 factor 节点
    if (n.type === 'factor' && resolvedFactorsDetail[n.id]) {
      (node.data as FactorNodeData & { _description?: string })._description =
        resolvedFactorsDetail[n.id].description
    }
    // 注入 goal / constraints 到决策根节点
    if (n.id === 'root' && mockViewModel.decision) {
      ;(node.data as DecisionNodeData & { _goal?: string; _constraints?: string })._goal =
        mockViewModel.decision.goal
      ;(node.data as DecisionNodeData & { _goal?: string; _constraints?: string })._constraints =
        mockViewModel.decision.constraints
    }
    // 注入 optionsDetail.summary + isRecommended 到 option 节点
    if (n.type === 'option' && resolvedOptionsDetail[n.id]) {
      const detail = resolvedOptionsDetail[n.id]
      ;(node.data as OptionNodeData & { _summary?: OptionSummary })._summary = {
        pros: detail.pros,
        cons: detail.cons,
        risks: detail.risks,
        isRecommended: n.id === resolvedRecommendedId,
      }
    }
    return node
  })

  const initialEdges: FlowEdge[] = mockCanvas.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    relation: e.relation,
  }))

  const [nodes, setNodes] = useNodesState(initialNodes)
  const [edges, setEdges] = useEdgesState(initialEdges)
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

  // Modal 状态
  const [modalOpen, setModalOpen] = useState(false)
  const [editingNode, setEditingNode] = useState<FlowNode | null>(null)
  const [isNewNode, setIsNewNode] = useState(false)
  const [form] = Form.useForm()
  const [weightValue, setWeightValue] = useState(0.1)
  /** 候选方案 Modal 当前激活的 Tab：点击节点主体默认 settings，点击"查看分析"/Popover 默认 analysis */
  const [activeTabKey, setActiveTabKey] = useState<OptionModalTab>('settings')
  const openModalFnRef = useRef<(node: FlowNode | null, isNew: boolean) => void>(() => {})
  const openModalForAnalysisRef = useRef<(nodeId: string) => void>(() => {})

  /** 打开编辑/新增 Modal */
  const openModal = (node: FlowNode | null, isNew: boolean) => {
    setEditingNode(node)
    setIsNewNode(isNew)
    setModalOpen(true)

    if (node) {
      if (node.type === 'factor') {
        const d = node.data as FactorNodeData
        setWeightValue(d.weight)
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
  openModalFnRef.current = openModal

  openModalForAnalysisRef.current = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) return
    setActiveTabKey('analysis')
    openModalFnRef.current(node, false)
  }

  /** 打开方案 Modal 并定位到方案分析 Tab */
  const openModalForAnalysis = useCallback(
    (nodeId: string) => openModalForAnalysisRef.current(nodeId),
    [],
  )

  /** 组件内 nodeTypes：option 节点额外注入 detail 和 onViewAnalysis */
  const resolvedNodeTypes = {
    decision: DecisionNode,
    factor: FactorNode,
    option: (props: React.ComponentProps<typeof OptionNode>) => (
      <OptionNode
        {...props}
        detail={props.detail ?? resolvedOptionsDetail[props.id]}
        onViewAnalysis={props.onViewAnalysis ?? openModalForAnalysis}
      />
    ),
  }

  /** 关闭 Modal */
  const closeModal = () => {
    setModalOpen(false)
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
                    weight: weightValue,
                    description: values.description,
                  } as FactorNodeData,
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
                  } as OptionNodeData,
                }
              : n,
          ),
        )
      }

      setModalOpen(false)
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
      setModalOpen(false)
      setEditingNode(null)
    }
  }

  /** 处理节点点击 */
  const handleNodeClick = (_: React.MouseEvent, node: FlowNode) => {
    if (node.type === 'decision') return
    if (node.type === 'option') setActiveTabKey('settings')
    openModal(node, false)
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
    openModal(node, true)
  }

  /** 新增方案 */
  const addOption = () => {
    const node = createNode('option', nodes)
    setNodes((prev) => [...prev, node])
    setActiveTabKey('settings')
    openModal(node, true)
  }

  const isFactor = editingNode?.type === 'factor'
  const isOption = editingNode?.type === 'option'
  const detail = isOption ? resolvedOptionsDetail[editingNode?.id ?? ''] : undefined

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
          nodeTypes={resolvedNodeTypes}
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

        <div className="canvas-legend">
          <span className="canvas-legend__item">
            <span className="canvas-legend__dot canvas-legend__dot--decision" />
            决策问题
          </span>
          <span className="canvas-legend__item">
            <span className="canvas-legend__dot canvas-legend__dot--factor" />
            影响因素
          </span>
          <span className="canvas-legend__item">
            <span className="canvas-legend__dot canvas-legend__dot--option" />
            候选方案
          </span>
          <span className="canvas-legend__separator" />
          <span className="canvas-legend__item">
            <span className="canvas-legend__arrow canvas-legend__arrow--has-factor" />
            包含因素
          </span>
          <span className="canvas-legend__item">
            <span className="canvas-legend__arrow canvas-legend__arrow--affects" />
            影响方案
          </span>
        </div>
      </div>

      {/* 节点上下文栏 */}
      {editingNode && modalOpen && (
        <div className="canvas-modal-context">
          <span className="canvas-modal-context__dot" />
          <span>
            {isFactor ? '影响因素' : '候选方案'}
            {editingNode.data.label ? ` · ${editingNode.data.label}` : ''}
            {isFactor
              ? ` · 已连接至 ${edges.filter((e) => e.target === editingNode.id).length} 个候选方案`
              : ` · 关联 ${edges.filter((e) => e.source === editingNode.id).length} 个影响因素`}
          </span>
        </div>
      )}

      <Modal
        centered
        open={modalOpen}
        onCancel={closeModal}
        footer={null}
        width={720}
        closable={false}
        maskClosable={false}
        keyboard={false}
        className="canvas-modal"
        styles={{ body: { maxHeight: 'calc(90vh - 120px)', overflowY: 'auto' } }}
      >
        {editingNode && (
          <>
            {/* 自定义头部 */}
            <div className="canvas-modal__header">
              <div className="canvas-modal__header-left">
                <span className={`canvas-modal__type-badge canvas-modal__type-badge--${editingNode.type}`} />
                <div className="canvas-modal__header-text">
                  <span className="canvas-modal__title">
                    {editingNode.type === 'factor' ? '编辑影响因素' : '编辑候选方案'}
                  </span>
                  <span className="canvas-modal__subtitle">调整后将标记画布为"未保存"</span>
                </div>
              </div>
              <Button type="text" icon={<CloseOutlined />} onClick={closeModal} className="canvas-modal__close" />
            </div>

            <Divider className="canvas-modal__divider" />

            {/* 表单内容 */}
            <Form form={form} layout="vertical" onFinish={submitForm}>
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
                    label="影响权重"
                  >
                    <div className="canvas-modal__weight-card">
                      <Slider
                        min={0}
                        max={1}
                        step={0.01}
                        value={weightValue}
                        onChange={setWeightValue}
                        tooltip={{ formatter: (v) => `${Math.round((v ?? 0) * 100)}%` }}
                      />
                      <span className="canvas-modal__weight-value">
                        {Math.round(weightValue * 100)}%
                      </span>
                    </div>
                  </Form.Item>
                  <Form.Item name="description" label="描述">
                    <Input.TextArea rows={3} placeholder="可选" />
                  </Form.Item>
                </>
              )}

              {isOption && (
                <>
                  {/* 自定义 Tab 切换 */}
                  <div className="canvas-option-tabs">
                    <button
                      type="button"
                      className={`canvas-option-tabs__btn ${activeTabKey === 'settings' ? 'canvas-option-tabs__btn--active' : ''}`}
                      onClick={() => setActiveTabKey('settings')}
                    >
                      方案设置
                    </button>
                    <button
                      type="button"
                      className={`canvas-option-tabs__btn ${activeTabKey === 'analysis' ? 'canvas-option-tabs__btn--active' : ''}`}
                      onClick={() => setActiveTabKey('analysis')}
                    >
                      方案分析
                    </button>
                  </div>

                  {activeTabKey === 'settings' && (
                    <>
                      <Form.Item name="cost" label="成本（1=高成本，5=低成本）">
                        <Rate count={5} />
                      </Form.Item>
                      <Form.Item name="time" label="时间（1=耗时久，5=耗时短）">
                        <Rate count={5} />
                      </Form.Item>
                      <Form.Item name="benefit" label="收益（1=收益低，5=收益高）">
                        <Rate count={5} />
                      </Form.Item>
                      <Form.Item name="risk" label="风险（1=高风险，5=低风险）">
                        <Rate count={5} />
                      </Form.Item>
                      <Form.Item name="feasibility" label="可行性（1=难实现，5=易实现）">
                        <Rate count={5} />
                      </Form.Item>
                    </>
                  )}

                  {activeTabKey === 'analysis' && (
                    <div className="canvas-modal-analysis">
                      <div className="canvas-modal-analysis__hint">
                        推演生成 · 保存画布不会直接修改以下内容
                      </div>
                      {detail ? (
                        <>
                          <div className="canvas-modal-analysis__section">
                            <div className="canvas-modal-analysis__section-title">优势</div>
                            {detail.pros.length > 0 ? (
                              <ul className="canvas-modal-analysis__list">
                                {detail.pros.map((p, i) => (
                                  <li key={i}>{p}</li>
                                ))}
                              </ul>
                            ) : (
                              <span className="canvas-modal-analysis__empty">暂无</span>
                            )}
                          </div>
                          <div className="canvas-modal-analysis__section">
                            <div className="canvas-modal-analysis__section-title">局限</div>
                            {detail.cons.length > 0 ? (
                              <ul className="canvas-modal-analysis__list">
                                {detail.cons.map((c, i) => (
                                  <li key={i}>{c}</li>
                                ))}
                              </ul>
                            ) : (
                              <span className="canvas-modal-analysis__empty">暂无</span>
                            )}
                          </div>
                          <div className="canvas-modal-analysis__section">
                            <div className="canvas-modal-analysis__section-title">风险</div>
                            {detail.risks.length > 0 ? (
                              <ul className="canvas-modal-analysis__list">
                                {detail.risks.map((r, i) => (
                                  <li key={i}>{r}</li>
                                ))}
                              </ul>
                            ) : (
                              <span className="canvas-modal-analysis__empty">暂无</span>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="canvas-modal-analysis__empty-state">
                          <div className="canvas-modal-analysis__empty-title">尚未生成方案分析</div>
                          <div className="canvas-modal-analysis__empty-hint">
                            保存画布并发起局部重推后，系统将补充该方案的优势、局限与风险。
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* 底部操作栏 */}
              <div className="canvas-modal__footer">
                <Popconfirm
                  title={`删除此${isFactor ? '因素' : '方案'}？`}
                  onConfirm={() => deleteNode(editingNode.id)}
                  okText="删除"
                  cancelText="取消"
                  disabled={editingNode.id === 'root'}
                >
                  <Button danger type="text" icon={<DeleteOutlined />} disabled={editingNode.id === 'root'}>
                    删除此{isFactor ? '因素' : '方案'}
                  </Button>
                </Popconfirm>
                <Space>
                  <Button onClick={closeModal}>取消</Button>
                  <Button type="primary" onClick={submitForm}>
                    保存修改
                  </Button>
                </Space>
              </div>
            </Form>
          </>
        )}
      </Modal>
    </div>
  )
}
