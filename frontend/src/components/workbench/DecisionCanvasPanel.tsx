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
  type NodeProps,
} from '@xyflow/react'
import { Modal, Form, Input, Slider, Rate, Button, Space, Divider, Popconfirm, Popover } from 'antd'
import { DeleteOutlined, CloseOutlined, PlusOutlined } from '@ant-design/icons'
import '@xyflow/react/dist/style.css'
import { useLayoutStore } from '../../stores/layoutStore'
import type { CanvasData, CanvasViewModel } from '../../types/canvas'
import type {
  FlowNode,
  FlowEdge,
  DecisionFlowNode,
  FactorFlowNode,
  OptionFlowNode,
  FactorFlowData,
  OptionFlowData,
} from '../../types/flow'
import { toFlowNodes, buildCanvasData } from '../../utils/canvasMapper'
import { CanvasActionsContext, useCanvasActions } from '../../contexts/CanvasActionsContext'

// ── 节点组件 Props 窄类型 ──────────────────────────────────────
// NodeProps 接受 Node<NodeData>，传 FlowNode 具名类型满足约束

type DecisionNodeProps = NodeProps<DecisionFlowNode>
type FactorNodeProps = NodeProps<FactorFlowNode>
type OptionNodeProps = NodeProps<OptionFlowNode>

// ── 节点组件 ─────────────────────────────────────────────────

/** 决策问题节点 */
function DecisionNode({ data }: DecisionNodeProps) {
  return (
    <div className="canvas-node canvas-node--decision">
      <div className="canvas-node__label">决策问题</div>
      <div className="canvas-node__title">{data.label}</div>
      {data.goal ? (
        <div className="canvas-node__subtitle">目标：{data.goal}</div>
      ) : null}
      {data.constraints ? (
        <div className="canvas-node__subtitle canvas-node__subtitle--constraints">
          约束：{data.constraints}
        </div>
      ) : null}
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

/** 影响因素节点 */
function FactorNode({ data }: FactorNodeProps) {
  const weightPercent = Math.round(data.weight * 100)
  return (
    <div className="canvas-node canvas-node--factor">
      <Handle type="target" position={Position.Left} />
      <div className="canvas-node__label">
        <span className="canvas-node__factor-weight">{weightPercent}%</span>
        <span>关键因素</span>
      </div>
      <div className="canvas-node__title">{data.label}</div>
      {data.description ? (
        <div className="canvas-node__subtitle">{data.description}</div>
      ) : null}
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

/** 候选方案节点 */
function OptionNode({ data, id }: OptionNodeProps) {
  const { scores, pros, cons, risks, isRecommended } = data
  const { openOptionAnalysis } = useCanvasActions()

  const hasAnalysis = pros.length > 0 || cons.length > 0 || risks.length > 0
  const firstPros = pros[0]
  const firstCons = cons[0]
  const firstRisks = risks[0]

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
          openOptionAnalysis(id)
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
      <div className="canvas-node__title">{data.label}</div>

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

      {hasAnalysis ? (
        <Popover
          content={popoverContent}
          trigger="hover"
          placement="bottom"
          overlayClassName="canvas-option-popover-overlay"
        >
          <div className="canvas-node__option-summary">
            <span>优 {pros.length}</span>
            <span> · 缺 {cons.length}</span>
            <span> · 风险 {risks.length}</span>
            <span
              className="canvas-node__option-summary-link"
              onClick={(e) => {
                e.stopPropagation()
                openOptionAnalysis(id)
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
  /**
   * 画布展示模型。
   * 由父组件（WorkbenchPage）通过 React Query 获取 canvas 数据，
   * 再与 analysisResult 中的 factorsDetail / optionsDetail 组装后传入。
   * viewModel 缺失时组件显示空状态提示。
   */
  viewModel?: CanvasViewModel
  onDirtyChange?: (dirty: boolean) => void
  onCanvasChange?: (canvas: CanvasData) => void
  /** 以下为 WorkbenchSlot 契约槽位 props（DecisionCanvasPanel 目前不直接使用，由父组件按需传递） */
  decisionId?: string
  taskId?: string | null
  pendingResultId?: string | null
  hasPendingResult?: boolean
  decisionStatus?: string
  onRequestRefresh?: () => void
}

// ── 辅助函数 ─────────────────────────────────────────────────

function getEdgeRelation(
  sourceType?: string,
  targetType?: string,
): string | null {
  if (sourceType === 'decision' && targetType === 'factor') {
    return 'HAS_FACTOR'
  }
  if (sourceType === 'factor' && targetType === 'option') {
    return 'AFFECTS'
  }
  return null
}

function genId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`
}

function createNode(type: 'factor' | 'option', existingNodes: FlowNode[]): FlowNode {
  const sameTypeNodes = existingNodes.filter((n) => n.type === type)
  const lastY =
    sameTypeNodes.length > 0
      ? Math.max(...sameTypeNodes.map((n) => n.position.y))
      : 0

  const id = genId(type)
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
      },
    } as FlowNode
  }

  return {
    id,
    type: 'option',
    position: { x, y },
    data: {
      nodeType: 'option',
      label: '',
      scores: { cost: 3, time: 3, benefit: 3, risk: 3, feasibility: 3 },
      pros: [],
      cons: [],
      risks: [],
      isRecommended: false,
    },
  } as FlowNode
}

// ── 主组件 ───────────────────────────────────────────────────

export function DecisionCanvasPanel(props: DecisionCanvasPanelProps) {
  const { viewModel, onDirtyChange, onCanvasChange } = props

  // viewModel 缺失时显示空状态，由父组件通过 React Query 获取后传入
  if (!viewModel) {
    return (
      <div className="canvas-panel">
        <div className="canvas-panel__empty">
          <span>暂无画布数据</span>
        </div>
      </div>
    )
  }

  // 展示字段统一从 viewModel 读取，不再单独接收 optionsDetail / factorsDetail 等 prop
  const {
    canvas,
    factorsDetail = {},
    optionsDetail = {},
    recommendedOptionId = null,
  } = viewModel

  const decisionInfo = viewModel.decision

  // 通过 mapper 将后端 CanvasData → FlowNode/FlowEdge（丢弃仅展示字段）
  const initialNodes = toFlowNodes(canvas.nodes, {
    factorsDetail,
    optionsDetail,
    recommendedOptionId,
    decisionInfo,
  })

  const initialEdges: FlowEdge[] = canvas.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    relation: e.relation ?? '',
  }))

  const [nodes, setNodes] = useNodesState(initialNodes)
  const [edges, setEdges] = useEdgesState(initialEdges)
  const themeMode = useLayoutStore((state) => state.themeMode)
  const dotColor = themeMode === 'eyeCare' ? '#2f3644' : '#d9dee7'

  // 脏检测：用 buildCanvasData 序列化语义快照
  const initialSignature = useRef(JSON.stringify(buildCanvasData(initialNodes, initialEdges)))
  const lastNotifiedSignature = useRef<string | null>(null)
  const didMount = useRef(false)

  const onDirtyChangeRef = useRef(onDirtyChange)
  const onCanvasChangeRef = useRef(onCanvasChange)
  // eslint-disable-next-line react-hooks/static-lifecycle
  useEffect(() => {
    onDirtyChangeRef.current = onDirtyChange
    onCanvasChangeRef.current = onCanvasChange
  })

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true
      return
    }

    const currentSignature = JSON.stringify(buildCanvasData(nodes, edges))
    const isDirty = currentSignature !== initialSignature.current

    if (currentSignature !== lastNotifiedSignature.current) {
      lastNotifiedSignature.current = currentSignature
      onCanvasChangeRef.current?.(buildCanvasData(nodes, edges))
    }

    onDirtyChangeRef.current?.(isDirty)
  }, [nodes, edges])

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
  const [activeTabKey, setActiveTabKey] = useState<OptionModalTab>('settings')

  // openOptionAnalysis：在 Context 内部实现，可访问所有内部状态
  const openOptionAnalysis = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId) ?? null
      if (!node || node.type !== 'option') return
      setEditingNode(node)
      setIsNewNode(false)
      setActiveTabKey('analysis')
      setModalOpen(true)
    },
    [nodes],
  )

  // Context value（不含 pros/cons/risks，仅传回调）
  const canvasActions = useRef({ openOptionAnalysis }).current

  // 打开 Modal
  const openModal = useCallback(
    (node: FlowNode | null, isNew: boolean) => {
      setEditingNode(node)
      setIsNewNode(isNew)
      setModalOpen(true)

      if (node) {
        if (node.type === 'factor') {
          const factorData = node.data as FactorFlowData
          setWeightValue(factorData.weight)
          form.setFieldsValue({
            label: factorData.label,
            weight: factorData.weight,
          })
        } else if (node.type === 'option') {
          const optionData = node.data as OptionFlowData
          form.setFieldsValue({
            label: optionData.label,
            ...optionData.scores,
          })
        }
      } else {
        form.resetFields()
        form.setFieldsValue({
          cost: 3,
          time: 3,
          benefit: 3,
          risk: 3,
          feasibility: 3,
        })
      }
    },
    [form],
  )

  const closeModal = useCallback(() => {
    setModalOpen(false)
    const nodeToRemove = isNewNode ? editingNode : null
    setEditingNode(null)
    if (nodeToRemove) {
      setNodes((prev) => prev.filter((n) => n.id !== nodeToRemove!.id) as FlowNode[])
    }
  }, [isNewNode, editingNode, setNodes])

  // 提交表单：只更新 label / weight / scores，description 和 pros/cons/risks 不可持久化
  const submitForm = useCallback(() => {
    form.validateFields().then((values) => {
      if (!editingNode) return

      if (editingNode.type === 'factor') {
        setNodes((prev) =>
          prev.map((n) =>
            n.id === editingNode.id
              ? ({
                  ...n,
                  data: {
                    ...n.data,
                    label: values.label,
                    weight: weightValue,
                  },
                } as FactorFlowNode)
              : n,
          ),
        )
      } else if (editingNode.type === 'option') {
        setNodes((prev) =>
          prev.map((n) =>
            n.id === editingNode.id
              ? ({
                  ...n,
                  data: {
                    ...n.data,
                    label: values.label,
                    scores: {
                      cost: values.cost,
                      time: values.time,
                      benefit: values.benefit,
                      risk: values.risk,
                      feasibility: values.feasibility,
                    },
                  },
                } as OptionFlowNode)
              : n,
          ),
        )
      }

      setModalOpen(false)
      setEditingNode(null)
    })
  }, [editingNode, weightValue, form, setNodes])

  const deleteNode = useCallback(
    (nodeId: string) => {
      if (nodeId === 'root') return
      setNodes((prev) => prev.filter((n) => n.id !== nodeId))
      setEdges((prev) =>
        prev.filter((e) => e.source !== nodeId && e.target !== nodeId),
      )
      if (editingNode?.id === nodeId) {
        setModalOpen(false)
        setEditingNode(null)
      }
    },
    [editingNode, setNodes, setEdges],
  )

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: FlowNode) => {
      if (node.type === 'decision') return
      if (node.type === 'option') setActiveTabKey('settings')
      openModal(node, false)
    },
    [openModal],
  )

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((prev) => applyEdgeChanges(changes, prev) as FlowEdge[])
    },
    [setEdges],
  )

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((prev) => applyNodeChanges(changes, prev) as FlowNode[])
    },
    [setNodes],
  )

  const handleConnect = useCallback(
    (connection: Connection) => {
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
    },
    [setEdges],
  )

  const addFactor = useCallback(() => {
    const node = createNode('factor', nodes)
    setNodes((prev) => [...prev, node])
    openModal(node, true)
  }, [nodes, setNodes, openModal])

  const addOption = useCallback(() => {
    const node = createNode('option', nodes)
    setNodes((prev) => [...prev, node])
    setActiveTabKey('settings')
    openModal(node, true)
  }, [nodes, setNodes, openModal])

  // pros / cons / risks 只从 editingNode.data 读取（由 toFlowNode 注入）
  // editingNode?.type === 'option' 收窄 editingNode，但三元表达式的收窄不传播到 editingNode.data
  // 需要显式断言，否则 TS 认为 data 是 DecisionFlowData | FactorFlowData | OptionFlowData 联合
  const analysisDetail =
    editingNode?.type === 'option'
      ? (editingNode.data as OptionFlowData)
      : undefined

  const nodeTypes = {
    decision: DecisionNode,
    factor: FactorNode,
    option: OptionNode,
  }

  return (
    <CanvasActionsContext.Provider value={canvasActions}>
      <div className="canvas-panel">
        <div className="canvas-panel__toolbar">
          <Space>
            <Button size="small" icon={<PlusOutlined />} onClick={addFactor}>
              新增因素
            </Button>
            <Button size="small" icon={<PlusOutlined />} onClick={addOption}>
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
              {editingNode.type === 'factor' ? '影响因素' : '候选方案'}
              {editingNode.data.label ? ` · ${editingNode.data.label}` : ''}
              {editingNode.type === 'factor'
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
                  label={editingNode.type === 'factor' ? '名称' : '名称'}
                  rules={[{ required: true, message: '请输入名称' }]}
                >
                  <Input placeholder={editingNode.type === 'factor' ? '如：时间成本' : '如：方案 A：优先 Docker'} />
                </Form.Item>

                {editingNode.type === 'factor' && (
                  <>
                    <Form.Item name="weight" label="影响权重">
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
                    {/* description 为只读展示，不进 Form，不在 submitForm 中更新 */}
                    {(editingNode.data as FactorFlowData).description && (
                      <Form.Item name="description" label="描述（只读）">
                        <Input.TextArea rows={3} value={(editingNode.data as FactorFlowData).description} disabled />
                      </Form.Item>
                    )}
                  </>
                )}

                {editingNode.type === 'option' && (
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
                        {analysisDetail && (analysisDetail.pros.length > 0 || analysisDetail.cons.length > 0 || analysisDetail.risks.length > 0) ? (
                          <>
                            <div className="canvas-modal-analysis__section">
                              <div className="canvas-modal-analysis__section-title">优势</div>
                              {analysisDetail.pros.length > 0 ? (
                                <ul className="canvas-modal-analysis__list">
                                  {analysisDetail.pros.map((p: string, i: number) => (
                                    <li key={i}>{p}</li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="canvas-modal-analysis__empty">暂无</span>
                              )}
                            </div>
                            <div className="canvas-modal-analysis__section">
                              <div className="canvas-modal-analysis__section-title">局限</div>
                              {analysisDetail.cons.length > 0 ? (
                                <ul className="canvas-modal-analysis__list">
                                  {analysisDetail.cons.map((c: string, i: number) => (
                                    <li key={i}>{c}</li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="canvas-modal-analysis__empty">暂无</span>
                              )}
                            </div>
                            <div className="canvas-modal-analysis__section">
                              <div className="canvas-modal-analysis__section-title">风险</div>
                              {analysisDetail.risks.length > 0 ? (
                                <ul className="canvas-modal-analysis__list">
                                  {analysisDetail.risks.map((r: string, i: number) => (
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
                    title={`删除此${editingNode.type === 'factor' ? '因素' : '方案'}？`}
                    onConfirm={() => deleteNode(editingNode.id)}
                    okText="删除"
                    cancelText="取消"
                    disabled={editingNode.id === 'root'}
                  >
                    <Button danger type="text" icon={<DeleteOutlined />} disabled={editingNode.id === 'root'}>
                      删除此{editingNode.type === 'factor' ? '因素' : '方案'}
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
    </CanvasActionsContext.Provider>
  )
}
