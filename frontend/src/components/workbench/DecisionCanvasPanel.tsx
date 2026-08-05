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
import { Modal, Form, Input, Slider, Rate, Button, Space, Divider, Popconfirm, Popover, Spin, Tooltip, message } from 'antd'
import { DeleteOutlined, CloseOutlined, PlusOutlined, LoadingOutlined, MenuOutlined } from '@ant-design/icons'
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
import type { AnalysisStep } from '../../types/analysis'
import { toFlowNodes, buildCanvasData, rebalanceWeights, redistributeWeightsOnDelete, rebalanceWithNewFactor } from '../../utils/canvasMapper'
import { applyDagreLayout, estimateNodeHeight } from '../../utils/canvasLayout'
import { CanvasActionsContext, useCanvasActions } from '../../contexts/CanvasActionsContext'
import { createContext, useContext } from 'react'
import type { Node } from '@xyflow/react'

// ── 局部推演上下文 ─────────────────────────────────────────────
const PartialAnalysisContext = createContext<{
  partialAnalysisInfo: PartialAnalysisInfo | null | undefined
  partialSteps: AnalysisStep[] | undefined
}>({ partialAnalysisInfo: null, partialSteps: undefined })

// ── 边聚焦上下文 ───────────────────────────────────────────────
// 用于悬停高亮和"显示全部关系线"开关，不触发任何持久化操作
const EdgeFocusContext = createContext<{
  hoveredNodeId: string | null
  showAllEdges: boolean
}>({ hoveredNodeId: null, showAllEdges: false })

// ── 节点悬停上下文 ─────────────────────────────────────────────
// 用于相关节点的轻微高亮，不修改持久化数据
const NodeHoverContext = createContext<{
  hoveredNodeId: string | null
}>({ hoveredNodeId: null })

// ── 边删除上下文 ───────────────────────────────────────────────
// 在 ReactFlow 外部渲染确认框时，需要知道边的源节点类型
const EdgeDeleteContext = createContext<{
  nodes: Node[]
} | null>(null)

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
function FactorNode({ data, id }: FactorNodeProps) {
  const { partialAnalysisInfo } = useContext(PartialAnalysisContext)
  const { hoveredNodeId } = useContext(NodeHoverContext)
  const isAffected = partialAnalysisInfo?.affectedNodeIds.includes(id) ?? false
  const isHovered = hoveredNodeId === id
  const weightPercent = Math.round(data.weight * 100)
  return (
    <div className={`canvas-node canvas-node--factor${isAffected ? ' canvas-node--partial-loading' : ''}${isHovered ? ' canvas-node--hovered' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="canvas-node__label">
        <span className="canvas-node__factor-weight">{weightPercent}%</span>
        <span>关键因素</span>
        {isAffected && <Spin size="small" indicator={<LoadingOutlined spin />} style={{ marginLeft: 4 }} />}
      </div>
      <div className="canvas-node__title">{data.label}</div>
      {data.description ? (
        <div className="canvas-node__subtitle canvas-node__subtitle--clamp-4">{data.description}</div>
      ) : null}
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

/** 候选方案节点 */
function OptionNode({ data, id }: OptionNodeProps) {
  const { partialAnalysisInfo } = useContext(PartialAnalysisContext)
  const { hoveredNodeId } = useContext(NodeHoverContext)
  const isAffected = partialAnalysisInfo?.affectedNodeIds.includes(id) ?? false
  const isHovered = hoveredNodeId === id
  const { openOptionAnalysis } = useCanvasActions()

  const { scores, pros, cons, risks, isRecommended } = data

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
    <div className={`canvas-node canvas-node--option${isRecommended ? ' canvas-node--option-recommended' : ''}${isAffected ? ' canvas-node--partial-loading' : ''}${isHovered ? ' canvas-node--hovered' : ''}`}>
      {isRecommended && <span className="canvas-node__badge canvas-node__badge--corner">推荐</span>}
      {isAffected && <Spin size="small" indicator={<LoadingOutlined spin />} className="canvas-node__partial-spinner" />}
      <Handle type="target" position={Position.Left} />
      <div className="canvas-node__label">
        <span>候选方案</span>
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

// ── 方案→因素 AFFECTS 连线组件（带删除按钮）──────────────────
import type { EdgeProps } from '@xyflow/react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  MarkerType,
} from '@xyflow/react'

/** AFFECTS 类型的连线：可删除，鼠标悬停显示删除按钮，支持边聚焦高亮 */
function AffectsEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  source,
  target,
  style,
}: EdgeProps) {
  const { hoveredNodeId, showAllEdges } = useContext(EdgeFocusContext)
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  // 判断是否为相关边
  const isRelated = hoveredNodeId === source || hoveredNodeId === target

  // 计算透明度：默认低透明度，悬停相关边高亮，悬停其他边更淡
  let opacity = showAllEdges ? 1 : 0.25
  let strokeWidth = showAllEdges ? undefined : 1
  if (hoveredNodeId !== null) {
    opacity = isRelated ? 1 : 0.15
    strokeWidth = isRelated ? 2.5 : 1
  }

  const computedStyle = {
    ...style,
    opacity,
    strokeWidth: strokeWidth ?? style?.strokeWidth,
  }

  // AFFECTS 边不允许删除，悬停时显示禁止提示
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={MarkerType.ArrowClosed}
        style={computedStyle}
      />
      <EdgeLabelRenderer>
        <div
          className="edge-delete-btn nodrag nopan"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
            opacity: hoveredNodeId === null ? 0.7 : 0,
            cursor: 'not-allowed',
          }}
        >
          <DeleteOutlined style={{ color: '#999' }} />
        </div>
        {showTooltip && hoveredNodeId === null && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -150%) translate(${labelX}px,${labelY}px)`,
              background: 'rgba(0,0,0,0.8)',
              color: '#fff',
              padding: '4px 8px',
              borderRadius: 4,
              fontSize: 12,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              zIndex: 1000,
            }}
          >
            因素与方案的影响关系由推演结果生成，不支持手动删除
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  )
}

// Tab key 类型
type OptionModalTab = 'settings' | 'analysis'

// ── 局部推演状态（由 WorkbenchPage 管理）────────────────────────
interface PartialAnalysisInfo {
  taskId: string
  affectedNodeIds: string[]
  status: 'RUNNING'
}

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
  /** 保存权重：触发保存画布 + 自动局部重推 */
  onWeightSave?: (canvas: CanvasData) => void
  /** 编辑已有 option 节点并保存：触发保存画布 + 自动局部重推 */
  onOptionEditSave?: (canvas: CanvasData) => void
  /** 保存画布（不触发局部重推）。用于新增因素等仅修改节点内容的场景 */
  onCanvasSave?: (canvas: CanvasData) => void
  /** 删除因素→方案连线后保存并自动局部重推 */
  onEdgeDelete?: (canvas: CanvasData) => void
  /** 删除候选方案节点后保存并自动局部重推；失败时返回 Promise reject 供调用方回滚 */
  onOptionDelete?: (canvas: CanvasData, deletedOptionId: string, rollback: () => void) => Promise<void>
  /** 删除因素节点后保存并自动局部重推；失败时返回 Promise reject 供调用方回滚 */
  onFactorDelete?: (canvas: CanvasData, rollback: () => void) => Promise<void>
  /** 新增节点或连线后标记结构变更（由父组件决定何时触发局部重推） */
  onStructuralChangePending?: (reason: 'OPTION_ADDED' | 'FACTOR_ADDED' | 'FACTOR_OPTION_EDGE_ADDED') => void
  /** 以下为 WorkbenchSlot 契约槽位 props（DecisionCanvasPanel 目前不直接使用，由父组件按需传递） */
  decisionId?: string
  taskId?: string | null
  pendingResultId?: string | null
  hasPendingResult?: boolean
  decisionStatus?: string
  onRequestRefresh?: () => void
  /** 局部推演信息（WorkbenchPage 管理） */
  partialAnalysisInfo?: PartialAnalysisInfo | null
  /** 当前 SSE 步骤（直接复用 useAnalysisStream 返回值） */
  partialSteps?: AnalysisStep[]
  /**
   * 强制同步标识。当此值变化时（通常是新的 analysisResultId），
   * 忽略 hasLocalEdit 保护，强制用服务端 Canvas 覆盖本地编辑。
   * 用于局部推演完成后强制刷新画布。
   */
  forceSyncKey?: string | null
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

/**
 * 生成唯一 ID。
 * 优先使用 Web Crypto API 的 randomUUID，不可用时回退为时间戳+随机数。
 * 用于前端生成节点和边的唯一 ID。
 */
function genId(prefix: string): string {
  const uuid = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  return `${prefix}_${uuid.slice(0, 8)}`
}

function createNode(type: 'factor' | 'option', existingNodes: FlowNode[]): FlowNode {
  const sameTypeNodes = existingNodes.filter((n) => n.type === type)
  const lastY =
    sameTypeNodes.length > 0
      ? Math.max(...sameTypeNodes.map((n) => n.position.y))
      : 0

  const id = genId(type === 'option' ? 'opt' : type)
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

// ── 外层：仅处理 viewModel 缺失的 early return ──────────────────
// React 19 要求所有 hooks 在所有条件 return 之后调用，
// 因此把内层组件拆分出来，保证 hooks 调用顺序稳定。
function DecisionCanvasPanelEmpty() {
  return (
    <div className="canvas-panel">
      <div className="canvas-panel__empty">
        <span>暂无画布数据</span>
      </div>
    </div>
  )
}

// ── 内层：包含所有 hooks，hooks 永远在 return 之前调用 ────────
function DecisionCanvasPanelInner(props: DecisionCanvasPanelProps) {
  const {
    viewModel,
    onDirtyChange,
    onCanvasChange,
    onWeightSave,
    onEdgeDelete,
    onOptionDelete,
    onFactorDelete,
    onStructuralChangePending,
    onOptionEditSave,
    onCanvasSave,
    partialAnalysisInfo,
    partialSteps,
    forceSyncKey,
  } = props

  const vm = viewModel as import('../../types/canvas').CanvasViewModel
  const { canvas, factorsDetail = {}, optionsDetail = {}, recommendedOptionId = null } = vm
  const decisionInfo = vm.decision

  // ── 初始化策略 ─────────────────────────────────────────────
  // 不再在初始化时对完整 canvas 调用 applyDagreLayout（会覆盖用户拖动后的位置）。
  // 改为：
  //   1. 以空数组初始化 state，让 ReactFlow 先挂载；
  //   2. canvas sync effect 进入后，用 toFlowNodes(canvas.nodes) 提取服务端 position，
  //      并仅对没有有效 position 的节点用 applyDagreLayout 补全（仅在首次初始化时）。
  // 这样服务端已保存的 position 会被完整保留，用户拖动后刷新页面不会再被覆盖。

  const [nodes, setNodes] = useNodesState<FlowNode>([])
  const [edges, setEdges] = useEdgesState<FlowEdge>([])

  // ── refs ─────────────────────────────────────────────────
  // 跟踪初始同步是否已完成（防止首次渲染 effect 误触发脏检测）
  const didInitialSync = useRef(false)
  // 跟踪初始脏基线：保存成功时与服务端同步，用于判断"用户是否修改过"
  const initialSignature = useRef<string | null>(null)
  const lastNotifiedDirty = useRef(false)
  // 跟踪服务端数据签名（用于区分"服务端数据变化"和"用户拖动"）
  const lastServerSignature = useRef<string | null>(null)
  // 跟踪上一次的 forceSyncKey，用于检测 forceSyncKey 变化
  const lastForceSyncKey = useRef<string | null>(null)
  // ref 版本，供 effect 内部同步最新值
  const forceSyncKeyRef = useRef<string | null>(null)
  const themeMode = useLayoutStore((state) => state.themeMode)
  const dotColor = themeMode === 'eyeCare' ? '#2f3644' : '#d9dee7'

  const nodesRef = useRef<FlowNode[]>(nodes)
  const edgesRef = useRef<FlowEdge[]>(edges)
  nodesRef.current = nodes
  edgesRef.current = edges

  // ── props refs（保持最新） ─────────────────────────────────
  const onDirtyChangeRef = useRef(onDirtyChange)
  const onCanvasChangeRef = useRef(onCanvasChange)
  const onWeightSaveRef = useRef(onWeightSave)
  // onEdgeDelete：保留 prop 和 ref 以维持 API 兼容，但由于 AFFECTS 边已禁止删除，此回调不会被触发
  const onEdgeDeleteRef = useRef(onEdgeDelete)
  const onOptionDeleteRef = useRef<((canvas: CanvasData, deletedOptionId: string, rollback: () => void) => Promise<void>) | undefined>(undefined)
  const onFactorDeleteRef = useRef<((canvas: CanvasData, rollback: () => void) => Promise<void>) | undefined>(undefined)
  const onStructuralChangePendingRef = useRef<((reason: 'OPTION_ADDED' | 'FACTOR_ADDED' | 'FACTOR_OPTION_EDGE_ADDED') => void) | undefined>(undefined)
  const onOptionEditSaveRef = useRef<((canvas: CanvasData) => void) | undefined>(undefined)
  const onCanvasSaveRef = useRef<((canvas: CanvasData) => void) | undefined>(undefined)
  // eslint-disable-next-line react-hooks/static-lifecycle
  useEffect(() => {
    onDirtyChangeRef.current = onDirtyChange
    onCanvasChangeRef.current = onCanvasChange
    onWeightSaveRef.current = onWeightSave
    onEdgeDeleteRef.current = onEdgeDelete
    onOptionDeleteRef.current = onOptionDelete
    onFactorDeleteRef.current = onFactorDelete
    onStructuralChangePendingRef.current = onStructuralChangePending
    onOptionEditSaveRef.current = onOptionEditSave
    onCanvasSaveRef.current = onCanvasSave
  })

  // ── 同步 forceSyncKey ──────────────────────────────────────
  // eslint-disable-next-line react-hooks/static-lifecycle
  useEffect(() => {
    forceSyncKeyRef.current = forceSyncKey ?? null
  })

  // ── 用户编辑 → 脏检测 effect ───────────────────────────────
  // 仅在用户实际拖动/编辑节点时触发脏检测。
  // 服务端同步（canvas/factorsDetail 等变化）不会触发脏检测。
  // initialSignature 在以下情况被更新：保存成功、forceSyncKey 触发同步。
  useEffect(() => {
    if (!didInitialSync.current) return

    const currentSig = JSON.stringify(buildCanvasData(nodes, edges))
    const isDirty = initialSignature.current !== null && currentSig !== initialSignature.current

    if (isDirty) {
      onCanvasChangeRef.current?.(buildCanvasData(nodes, edges))
    }
    if (isDirty !== lastNotifiedDirty.current) {
      lastNotifiedDirty.current = isDirty
      console.log('[dirty-to-parent]', isDirty)
      onDirtyChangeRef.current?.(isDirty)
    }
  }, [nodes, edges])

  // ── 服务端 canvas 同步 effect ──────────────────────────────
  // 核心规则：
  //   1. 直接使用 toFlowNodes(canvas.nodes) 提取服务端 position，不调用 applyDagreLayout；
  //   2. 只在首次初始化（nodes 为空）且存在无 position 节点时，才用 applyDagreLayout 补全；
  //   3. 保存后刷新、forceSyncKey 触发时，直接用服务端 position，不覆盖；
  //   4. 同步后更新 initialSignature，使脏状态与服务端对齐。
  useEffect(() => {
    // 同步最新的 forceSyncKey（保持与组件 prop 同步）
    const currentForceSyncKey = forceSyncKey ?? null
    const isForceSync = currentForceSyncKey !== null && currentForceSyncKey !== lastForceSyncKey.current

    // 构建 viewModel 对应的节点和边（使用服务端 canvas.nodes 的 position）
    const newRawNodes: FlowNode[] = toFlowNodes(canvas.nodes, {
      factorsDetail,
      optionsDetail,
      recommendedOptionId,
      decisionInfo,
    })
    const newRawEdges = canvas.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: e.relation ?? '',
      relation: e.relation ?? '',
      selectable: true,
    })) as FlowEdge[]

    // 计算服务端数据的 signature（包含 business 数据用于变化检测）
    const factorsDetailKeys = Object.keys(factorsDetail).join(',')
    const optionsDetailKeys = Object.keys(optionsDetail).join(',')
    const vmSignature = JSON.stringify({
      ...buildCanvasData(newRawNodes, newRawEdges),
      factorsDetailKeys,
      optionsDetailKeys,
    })

    // 如果服务端数据没有变化，跳过同步（forceSync 时也要同步）
    if (vmSignature === lastServerSignature.current && !isForceSync) {
      return
    }

    lastServerSignature.current = vmSignature

    // forceSyncKey 变化：清除 forceSyncKey ref 状态
    if (isForceSync) {
      console.log('[CanvasPanel] forceSyncKey changed, forcing sync')
      lastForceSyncKey.current = currentForceSyncKey
    }

    // 首次同步（nodes 为空）：需要将 canvas.nodes 水合到 ReactFlow
    const isFirstSync = nodes.length === 0 && !didInitialSync.current
    let nodesToSet: FlowNode[]
    let edgesToSet: FlowEdge[] = newRawEdges

    if (isFirstSync) {
      didInitialSync.current = true
      console.log('[CanvasPanel] initial sync from server, hydrating canvas')

      // 检查是否所有节点都有有效 position
      const allHavePosition = newRawNodes.every((n) =>
        n.position?.x != null && n.position?.y != null,
      )

      if (allHavePosition) {
        // 服务端已有完整 position，直接使用（保留用户上次拖动的位置）
        nodesToSet = newRawNodes
      } else {
        nodesToSet = newRawNodes
        edgesToSet = newRawEdges
      }

      // 设置初始脏基线（以服务端数据为基准，刷新后不会误判为脏）
      initialSignature.current = JSON.stringify(buildCanvasData(nodesToSet, edgesToSet))
      lastNotifiedDirty.current = false
    } else {
      // 非首次同步：直接使用服务端 canvas.nodes 的 position
      // 不调用 applyDagreLayout，避免覆盖用户拖动后的位置
      nodesToSet = newRawNodes

      // forceSyncKey 触发时，也更新脏基线
      if (isForceSync) {
        initialSignature.current = JSON.stringify(buildCanvasData(nodesToSet, edgesToSet))
        lastNotifiedDirty.current = false
      }
    }

    setNodes(nodesToSet)
    setEdges(edgesToSet)
  }, [canvas, factorsDetail, optionsDetail, recommendedOptionId, decisionInfo, forceSyncKey])

  // ── 删除候选方案节点状态 ─────────────────────────────────────
  // 暂存待确认删除的方案节点信息（显示确认 Modal）
  const [pendingOptionDelete, setPendingOptionDelete] = useState<{
    nodeId: string
    nodeLabel: string
  } | null>(null)
  // 保存删除前的 nodes 和 edges 快照，用于失败时回滚
  const optionDeleteNodesSnapshotRef = useRef<FlowNode[]>([])
  const optionDeleteEdgesSnapshotRef = useRef<FlowEdge[]>([])

  // ── 删除因素节点状态 ─────────────────────────────────────────
  // 暂存待确认删除的因素节点信息（显示确认 Modal）
  const [pendingFactorDelete, setPendingFactorDelete] = useState<{
    nodeId: string
    nodeLabel: string
  } | null>(null)
  // 保存删除前的 nodes 和 edges 快照，用于失败时回滚
  const factorDeleteNodesSnapshotRef = useRef<FlowNode[]>([])
  const factorDeleteEdgesSnapshotRef = useRef<FlowEdge[]>([])

  // 跟踪 factor 节点的初始权重（用于判断用户是否修改了权重）
  const initialWeightRef = useRef<number>(0.1)
  // 跟踪当前是否正在编辑已有 factor（区别于新建因素）
  const isEditingFactorRef = useRef(false)

  // Modal 状态
  const [modalOpen, setModalOpen] = useState(false)
  const [editingNode, setEditingNode] = useState<FlowNode | null>(null)
  const [isNewNode, setIsNewNode] = useState(false)
  const [form] = Form.useForm()
  const [weightValue, setWeightValue] = useState(0.1)
  const [sliderMin, setSliderMin] = useState(5)
  const [sliderMax, setSliderMax] = useState(80)
  const [activeTabKey, setActiveTabKey] = useState<OptionModalTab>('settings')

  // 边聚焦状态（仅影响渲染样式，不触发持久化）
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)

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
          const w = factorData.weight
          setWeightValue(w)
          initialWeightRef.current = w
          isEditingFactorRef.current = !isNew
          // 新增因素：固定 5%~80% 范围；已有因素：使用越界恢复逻辑
          if (isNew) {
            // 新增时默认权重 = 平均权重（1 / (已有因素数 + 1)）
            const existingFactorCount = nodes.filter((n) => n.type === 'factor').length
            const avgWeight = 1 / (existingFactorCount + 1)
            setWeightValue(avgWeight)
            setSliderMin(5)
            setSliderMax(80)
          } else {
            // 已有因素越界时设置单向拖动范围
            if (w < 0.05) {
              setSliderMin(Math.round(w * 100))
              setSliderMax(80)
            } else if (w > 0.80) {
              setSliderMin(5)
              setSliderMax(Math.round(w * 100))
            } else {
              setSliderMin(5)
              setSliderMax(80)
            }
          }
          form.setFieldsValue({
            label: factorData.label,
            weight: isNew ? (1 / (nodes.filter((n) => n.type === 'factor').length + 1)) : factorData.weight,
            description: factorData.description ?? '',
          })
        } else if (node.type === 'option') {
          const optionData = node.data as OptionFlowData
          isEditingFactorRef.current = false
          form.setFieldsValue({
            label: optionData.label,
            ...optionData.scores,
          })
        }
      } else {
        isEditingFactorRef.current = false
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
    setEditingNode(null)
    isEditingFactorRef.current = false
  }, [])

  // 确认保存因素：仅更新权重，名称保留为节点原 label
  const handleSaveFactor = useCallback(
    () => {
      if (!editingNode || editingNode.type !== 'factor' || isNewNode) return

      const weightChanged = Math.abs(weightValue - initialWeightRef.current) > 1e-6
      const factorData = editingNode.data as FactorFlowData

      if (!weightChanged) {
        closeModal()
        return
      }

      // 名称必须保留为节点原 label，禁止从表单覆盖已有 factor 的 label
      const labelPreservedNodes = nodesRef.current.map((n) =>
        n.id === editingNode.id
          ? ({
              ...n,
              data: {
                ...n.data,
                label: factorData.label,
              },
            } as FactorFlowNode)
          : n,
      )

      const allFactorNodes = labelPreservedNodes.filter((n) => n.type === 'factor')
      const rebalanced = rebalanceWeights(allFactorNodes, editingNode.id, weightValue)
      const nextNodes = labelPreservedNodes.map((n) => {
        if (n.type !== 'factor') return n
        const updated = rebalanced.find((r: FlowNode) => r.id === n.id)
        return updated ?? n
      })

      setNodes(nextNodes)
      setModalOpen(false)
      setEditingNode(null)
      isEditingFactorRef.current = false

      const updatedCanvas = buildCanvasData(nextNodes, edgesRef.current)
      onWeightSaveRef.current?.(updatedCanvas)
    },
    [editingNode, isNewNode, weightValue, setNodes, closeModal],
  )

  // 处理普通保存：仅更新当前节点（label / scores）
  const handleSaveNormal = useCallback(
    (values: Record<string, unknown>) => {
      if (!editingNode) return
      const label = String(values.label ?? '').trim()

      if (editingNode.type === 'factor') {
        if (isNewNode) {
          if (!label) {
            message.warning('请输入因素名称')
            return
          }

          // 已有因素
          const existingFactors = nodesRef.current.filter((n) => n.type === 'factor')
          const newWeight = weightValue

          // 其余已有因素按比例配平（带 5%-80% 边界约束）
          const rebalancedExisting = rebalanceWithNewFactor(existingFactors, newWeight)

          // 构造新 factor：保留 id / position，仅覆盖 label / weight
          const newFactorNode: FlowNode = {
            ...editingNode,
            data: {
              ...editingNode.data,
              label,
              weight: newWeight,
            },
          } as FactorFlowNode

          // 完整 nextNodes：root 原样 + options 原样 + 重新配平的旧 factors + 新 factor
          const idToRebalanced = new Map<FlowNode['id'], FlowNode>(rebalancedExisting.map((n: FlowNode) => [n.id, n]))
          const nextNodes: FlowNode[] = nodesRef.current.map((n) => {
            if (n.type !== 'factor') return n
            const updated = idToRebalanced.get(n.id)
            return updated ?? n
          })
          nextNodes.push(newFactorNode)

          // 2) 先更新 nodesRef，保证后续 onCanvasChange 看到的是最新值
          nodesRef.current = nextNodes
          // 3) setNodes
          setNodes(nextNodes)

          // 4) 用完整 nextNodes + edgesRef.current 调用 buildCanvasData
          const completeCanvas = buildCanvasData(nextNodes, edgesRef.current)
          // 5) onCanvasChange
          onCanvasChangeRef.current?.(completeCanvas)
          // 6) 标记 dirty
          onDirtyChangeRef.current?.(true)
          // 7) FACTOR_ADDED 结构变更通知（由父组件决定后续 partial-analysis）
          onStructuralChangePendingRef.current?.('FACTOR_ADDED')

          // 8) 关闭 Modal
          setModalOpen(false)
          setEditingNode(null)
          isEditingFactorRef.current = false
          return
        } else {
          // 编辑已有 factor：仅更新权重，必须保留节点原 label，禁止从表单读取并覆盖
          const factorData = editingNode.data as FactorFlowData
          setNodes((prev) =>
            prev.map((n) =>
              n.id === editingNode.id
                ? ({
                  ...n,
                  data: {
                    ...n.data,
                    label: factorData.label,
                    weight: weightValue,
                  },
                } as FactorFlowNode)
                : n,
            ),
          )
        }
      } else if (editingNode.type === 'option') {
        if (isNewNode) {
          const newNode: FlowNode = {
            ...editingNode,
            data: {
              ...editingNode.data,
              label,
              scores: {
                cost: Number(values.cost) || 3,
                time: Number(values.time) || 3,
                benefit: Number(values.benefit) || 3,
                risk: Number(values.risk) || 3,
                feasibility: Number(values.feasibility) || 3,
              },
            },
          }
          setNodes((prev) => [...prev, newNode])
          onStructuralChangePendingRef.current?.('OPTION_ADDED')
        } else {
          // 先构造 nextNodes，避免在 setNodes 回调之外使用 nodesRef
          const nextNodes = nodesRef.current.map((n) =>
            n.id === editingNode.id
              ? ({
                ...n,
                data: {
                  ...n.data,
                  label,
                  scores: {
                    cost: Number(values.cost) || 3,
                    time: Number(values.time) || 3,
                    benefit: Number(values.benefit) || 3,
                    risk: Number(values.risk) || 3,
                    feasibility: Number(values.feasibility) || 3,
                  },
                },
              } as OptionFlowNode)
              : n,
          )
          setNodes(nextNodes)
          setModalOpen(false)
          setEditingNode(null)
          isEditingFactorRef.current = false
          onOptionEditSaveRef.current?.(buildCanvasData(nextNodes, edgesRef.current))
          return
        }
      }

      setModalOpen(false)
      setEditingNode(null)
      isEditingFactorRef.current = false
    },
    [editingNode, isNewNode, weightValue, setNodes],
  )

  // 提交表单：新建节点走普通保存；编辑已有因素走统一确认保存
  const submitForm = useCallback(() => {
    form.validateFields().then((values) => {
      if (!editingNode) return

      if (editingNode.type === 'factor' && !isNewNode) {
        handleSaveFactor()
        return
      }

      handleSaveNormal(values)
    })
  }, [editingNode, isNewNode, form, handleSaveFactor, handleSaveNormal])

  // 仅允许删除 option 节点；弹出确认框而非直接删除
  const handleOptionDeleteClick = useCallback(
    (nodeId: string) => {
      if (nodeId === 'root') return
      const node = nodesRef.current.find((n) => n.id === nodeId)
      if (!node || node.type !== 'option') return

      // 至少保留 2 个方案
      const optionCount = nodesRef.current.filter((n) => n.type === 'option').length
      if (optionCount <= 2) return

      // 保存快照，用于失败时回滚
      optionDeleteNodesSnapshotRef.current = nodesRef.current
      optionDeleteEdgesSnapshotRef.current = edgesRef.current
      setPendingOptionDelete({ nodeId, nodeLabel: node.data?.label ?? '' })
    },
    [],
  )

  // 确认删除方案：执行删除 + 保存画布 + 局部重推
  const confirmOptionDelete = useCallback(() => {
    if (!pendingOptionDelete) return
    const { nodeId } = pendingOptionDelete
    setPendingOptionDelete(null)

    // 快照已在上一步保存，这里乐观删除
    setNodes((prev) => prev.filter((n) => n.id !== nodeId))
    setEdges((prev) => {
      const newEdges = prev.filter((e) => e.source !== nodeId && e.target !== nodeId)
      // 用 setTimeout 确保 nodesRef 已更新
      setTimeout(() => {
        const updatedCanvas = buildCanvasData(nodesRef.current, newEdges)
        const rollback = () => {
          const nodesSnap = optionDeleteNodesSnapshotRef.current
          const edgesSnap = optionDeleteEdgesSnapshotRef.current
          setNodes(nodesSnap)
          setEdges(edgesSnap)
        }
        // 传给父组件，由父组件决定何时回滚
        onOptionDeleteRef.current?.(updatedCanvas, nodeId, rollback).catch(() => {
          rollback()
        })
      }, 0)
      return newEdges
    })

    if (editingNode?.id === nodeId) {
      setModalOpen(false)
      setEditingNode(null)
    }
  }, [pendingOptionDelete, setNodes, setEdges])

  // 取消删除：恢复 nodes 和 edges
  const cancelOptionDelete = useCallback(() => {
    const nodesSnap = optionDeleteNodesSnapshotRef.current
    const edgesSnap = optionDeleteEdgesSnapshotRef.current
    if (nodesSnap.length > 0 || edgesSnap.length > 0) {
      setNodes(nodesSnap)
      setEdges(edgesSnap)
    }
    setPendingOptionDelete(null)
  }, [setNodes, setEdges])

  // ── 删除因素节点 ─────────────────────────────────────────────

  // 统一的删除因素入口：点击按钮 / 删除 HAS_FACTOR 连线共用
  const initiateFactorDelete = useCallback(
    (nodeId: string, nodeLabel: string) => {
      const factorCount = nodesRef.current.filter((n) => n.type === 'factor').length
      // 至少保留 2 个因素
      if (factorCount <= 2) return

      // 保存快照，用于失败时回滚
      factorDeleteNodesSnapshotRef.current = nodesRef.current
      factorDeleteEdgesSnapshotRef.current = edgesRef.current
      setPendingFactorDelete({ nodeId, nodeLabel })
    },
    [],
  )

  // 点击"删除此因素"按钮
  const handleFactorDeleteClick = useCallback(
    (nodeId: string) => {
      const node = nodesRef.current.find((n) => n.id === nodeId)
      if (!node || node.type !== 'factor') return
      initiateFactorDelete(nodeId, node.data?.label ?? '')
    },
    [initiateFactorDelete],
  )

  // 确认删除因素：权重重分配 + 删除节点和连线 + 保存画布 + 局部重推
  const confirmFactorDelete = useCallback(() => {
    if (!pendingFactorDelete) return
    const { nodeId } = pendingFactorDelete
    setPendingFactorDelete(null)

    // 快照已在上一步保存，这里执行乐观删除 + 权重重分配
    setNodes((prev) => {
      const allFactors = prev.filter((n) => n.type === 'factor')

      // 计算删除后剩余因素的权重（按比例重分配）
      const rebalanced = redistributeWeightsOnDelete(allFactors, nodeId)

      // 删除 factor 节点，同时更新剩余 factor 权重
      const newNodes = prev
        .filter((n) => n.id !== nodeId)
        .map((n) => {
          const updated = rebalanced.find((r: FlowNode) => r.id === n.id)
          return updated ?? n
        })

      // 用 setTimeout 确保 nodesRef 已更新
      setTimeout(() => {
        const rollback = () => {
          setNodes(factorDeleteNodesSnapshotRef.current)
          setEdges(factorDeleteEdgesSnapshotRef.current)
        }
        const updatedCanvas = buildCanvasData(newNodes, edgesRef.current)
        // 传给父组件，由父组件决定何时回滚
        onFactorDeleteRef.current?.(updatedCanvas, rollback).catch(() => {
          rollback()
        })
      }, 0)

      return newNodes
    })

    setEdges((prev) =>
      prev.filter((e) => e.source !== nodeId && e.target !== nodeId),
    )

    if (editingNode?.id === nodeId) {
      setModalOpen(false)
      setEditingNode(null)
    }
  }, [pendingFactorDelete, setNodes, setEdges])

  // 取消删除因素：恢复快照
  const cancelFactorDelete = useCallback(() => {
    const nodesSnap = factorDeleteNodesSnapshotRef.current
    const edgesSnap = factorDeleteEdgesSnapshotRef.current
    if (nodesSnap.length > 0 || edgesSnap.length > 0) {
      setNodes(nodesSnap)
      setEdges(edgesSnap)
    }
    setPendingFactorDelete(null)
  }, [setNodes, setEdges])

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: FlowNode) => {
      if (node.type === 'decision') return
      if (node.type === 'option') setActiveTabKey('settings')
      openModal(node, false)
    },
    [openModal],
  )

  const handleEdgeClick = useCallback(
    (_: React.MouseEvent, edge: FlowEdge) => {
      console.log('[Canvas] Edge clicked:', edge.id, edge)
    },
    [],
  )

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      // 分离 HAS_FACTOR 边的删除操作（需级联删除因素节点）
      const hasFactorRemovals = changes.filter(
        (c): c is Extract<EdgeChange, { type: 'remove' }> =>
          c.type === 'remove' &&
          edgesRef.current.find((e) => e.id === c.id)?.relation === 'HAS_FACTOR',
      )
      // 分离 AFFECTS 边的删除操作（需弹出确认框）
      const affectsRemovals = changes.filter(
        (c): c is Extract<EdgeChange, { type: 'remove' }> =>
          c.type === 'remove' &&
          edgesRef.current.find((e) => e.id === c.id)?.relation === 'AFFECTS',
      )
      // 非 HAS_FACTOR / AFFECTS 边的操作正常处理
      const otherChanges = changes.filter(
        (c) =>
          !(
            (c.type === 'remove' &&
              (edgesRef.current.find((e) => e.id === c.id)?.relation === 'HAS_FACTOR' ||
                edgesRef.current.find((e) => e.id === c.id)?.relation === 'AFFECTS'))
          ),
      )

      if (hasFactorRemovals.length > 0) {
        // HAS_FACTOR 删除：级联删除因素节点
        const first = hasFactorRemovals[0]
        const edge = edgesRef.current.find((e) => e.id === first.id)!
        const factorNode = nodesRef.current.find((n) => n.id === edge.target)
        const factorId = factorNode?.id
        if (factorId) {
          // 先正常应用其他变更（包括移除该边的选中状态）
          if (otherChanges.length > 0) {
            setEdges((prev) => applyEdgeChanges(otherChanges, prev) as FlowEdge[])
          }
          // 调用统一的删除因素函数
          initiateFactorDelete(factorId, factorNode?.data?.label ?? '')
        }
        return
      }

      if (affectsRemovals.length > 0) {
        // AFFECTS 边不允许删除，提示用户
        message.warning('因素与方案的影响关系由推演结果生成，不支持手动删除')
        // 静默丢弃 AFFECTS 删除操作，但保留其他非删除变化（如取消选中）
        if (otherChanges.length > 0) {
          setEdges((prev) => applyEdgeChanges(otherChanges, prev) as FlowEdge[])
        }
        return
      }

      setEdges((prev) => applyEdgeChanges(changes, prev) as FlowEdge[])
    },
    [setEdges],
  )

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const dragFinishes = changes.filter(c => c.type === 'position' && !c.dragging)
      const nextNodes = applyNodeChanges(changes, nodesRef.current) as FlowNode[]

      if (dragFinishes.length > 0) {
        console.log('[user-drag-finished]', changes)
        nodesRef.current = nextNodes
        setNodes(nextNodes)
        onCanvasChangeRef.current?.(buildCanvasData(nextNodes, edgesRef.current))
        console.log('[dirty-to-parent]', true)
        onDirtyChangeRef.current?.(true)
      } else {
        setNodes(nextNodes)
      }
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
        type: relation,
        relation,
        selectable: true,
      }

      setEdges((prev) => [...prev, newEdge])

      // 判断结构变更类型并通知父组件
      if (relation === 'HAS_FACTOR') {
        // root → factor 连线：检查该 factor 是否已有 root 连线
        const hasExistingRootConnection = edgesRef.current.some(
          (e) => e.source === connection.source && e.target === connection.target && e.relation === 'HAS_FACTOR',
        )
        if (!hasExistingRootConnection) {
          // 新增 root → factor 连线，等同于 FACTOR_ADDED
          onStructuralChangePendingRef.current?.('FACTOR_ADDED')
        }
      } else if (relation === 'AFFECTS') {
        // factor → option 连线
        onStructuralChangePendingRef.current?.('FACTOR_OPTION_EDGE_ADDED')
      }
    },
    [],
  )

  const addFactor = useCallback(() => {
    const currentFactors = nodes.filter((n) => n.type === 'factor')
    if (currentFactors.length >= 5) return  // 达到 5 个时静默拦截
    const node = createNode('factor', nodes)
    openModal(node, true)
  }, [nodes, openModal])

  const MAX_OPTIONS = 5

  const addOption = useCallback(() => {
    const currentOptions = nodes.filter((n) => n.type === 'option')
    if (currentOptions.length >= MAX_OPTIONS) {
      message.warning(`候选方案最多 ${MAX_OPTIONS} 个`)
      return
    }
    const node = createNode('option', nodes)
    setActiveTabKey('settings')
    openModal(node, true)
  }, [nodes, openModal])

  // "自动整理布局"：对当前完整 nodes + edges 调用 applyDagreLayout，
  // setNodes 后通过 onCanvasChange 更新 canvasRef，标记 dirty，提示用户保存。
  const autoArrangeLayout = useCallback(() => {
    if (nodes.length === 0) return
    const { nodes: layoutedNodes, edges: layoutedEdges } = applyDagreLayout(nodes, edges, {
      direction: 'LR',
      rankSeparation: 300,
      nodeSeparation: 100,
      customHeightFn: estimateNodeHeight,
    })
    setNodes(layoutedNodes)
    setEdges(layoutedEdges)
    // 通知父组件画布已变化，触发脏检测和 canvasRef 更新
    onCanvasChangeRef.current?.(buildCanvasData(layoutedNodes, layoutedEdges))
  }, [nodes, edges])

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

  const edgeTypes = {
    AFFECTS: AffectsEdge,
  }

  // 派生局部推演状态：取最近 3 个非 WAITING 步骤
  const recentSteps = (partialSteps ?? [])
    .filter((s) => s.status !== 'WAITING')
    .slice(-3)
  const currentStep = partialSteps?.find((s) => s.status === 'RUNNING')
  const partialFailed = partialSteps?.some((s) => s.status === 'FAILED')

  // 计算统计信息
  const factorCount = nodes.filter((n) => n.type === 'factor').length
  const optionCount = nodes.filter((n) => n.type === 'option').length
  const affectsCount = edges.filter((e) => e.relation === 'AFFECTS').length

  // 悬停处理（仅更新局部状态，不触发持久化）
  const handleNodeMouseEnter = useCallback((_: React.MouseEvent, node: FlowNode) => {
    if (node.type === 'factor' || node.type === 'option') {
      setHoveredNodeId(node.id)
    }
  }, [])

  const handleNodeMouseLeave = useCallback(() => {
    setHoveredNodeId(null)
  }, [])

  const nodeHoverValue = { hoveredNodeId }

  return (
    <PartialAnalysisContext.Provider value={{ partialAnalysisInfo, partialSteps: partialSteps ?? [] }}>
      <CanvasActionsContext.Provider value={canvasActions}>
          <EdgeDeleteContext.Provider value={{ nodes: nodes as Node[] }}>
            <EdgeFocusContext.Provider value={{ hoveredNodeId, showAllEdges: false }}>
              <NodeHoverContext.Provider value={nodeHoverValue}>
              <div className="canvas-panel">
                <div className="canvas-panel__toolbar">
                  <Space>
                    <Button size="small" icon={<PlusOutlined />} onClick={addFactor} disabled={factorCount >= 5}>
                      新增因素
                    </Button>
                    <Tooltip title={nodes.filter((n) => n.type === 'option').length >= MAX_OPTIONS ? `候选方案最多 ${MAX_OPTIONS} 个` : ''}>
                      <Button
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={addOption}
                        disabled={nodes.filter((n) => n.type === 'option').length >= MAX_OPTIONS}
                      >
                        新增方案
                      </Button>
                    </Tooltip>
                    <Tooltip title="自动计算最优布局，保存画布后生效">
                      <Button size="small" icon={<MenuOutlined />} onClick={autoArrangeLayout}>
                        自动整理
                      </Button>
                    </Tooltip>
                  </Space>
                  <span className="canvas-panel__stats">
                    因素 {factorCount} · 方案 {optionCount} · AFFECTS {affectsCount}
                  </span>
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
                    onEdgeClick={handleEdgeClick}
                    onNodeMouseEnter={handleNodeMouseEnter}
                    onNodeMouseLeave={handleNodeMouseLeave}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    fitView
                    nodesDraggable
                    nodesConnectable
                    elementsSelectable
                    colorMode={themeMode === 'eyeCare' ? 'dark' : 'light'}
                    defaultEdgeOptions={{
                      style: {
                        stroke:
                          themeMode === 'eyeCare' ? '#b6c4d8' : '#94a3b8',
                        strokeWidth: themeMode === 'eyeCare' ? 2.5 : 1.75,
                      },
                      selectable: true,
                    }}
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

                {/* 局部推演状态面板 */}
                {partialAnalysisInfo && (
                  <div className="canvas-partial-status">
                    <div className="canvas-partial-status__header">
                      <Spin size="small" indicator={<LoadingOutlined spin />} />
                      <span className="canvas-partial-status__title">
                        {partialFailed ? '局部推演失败' : '局部推演中'}
                      </span>
                      <span className="canvas-partial-status__nodes">
                        影响节点：{partialAnalysisInfo.affectedNodeIds.join(', ')}
                      </span>
                    </div>
                    {currentStep && (
                      <div className="canvas-partial-status__current">
                        当前步骤：{currentStep.displayName}
                      </div>
                    )}
                    {recentSteps.length > 0 && (
                      <div className="canvas-partial-status__recent">
                        {recentSteps.map((step) => (
                          <div key={step.id} className="canvas-partial-status__step">
                            <span className={`canvas-partial-status__step-dot canvas-partial-status__step-dot--${step.status.toLowerCase()}`} />
                            <span>{step.displayName}: {step.summary ?? step.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

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
                  mask={{ closable: false }}
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
                              {(() => {
                                if (editingNode.type === 'factor') {
                                  return isNewNode ? '新增影响因素' : '编辑影响因素'
                                }
                                return '编辑候选方案'
                              })()}
                            </span>
                            <span className="canvas-modal__subtitle">
                              {isNewNode && editingNode.type === 'factor'
                                ? '确认后将添加到画布，其余影响因素将按比例自动调整'
                                : '调整后将标记画布为"未保存"'}
                            </span>
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
                          rules={[
                            { required: true, message: '请输入名称' },
                            {
                              validator: (_rule, value) => {
                                const trimmed = typeof value === 'string' ? value.trim() : ''
                                if (!trimmed) {
                                  return Promise.reject(new Error('请输入名称'))
                                }
                                return Promise.resolve()
                              },
                            },
                          ]}
                          normalize={(value: unknown) => (typeof value === 'string' ? value.trim() : value)}
                        >
                          {editingNode.type === 'factor' && !isNewNode ? (
                            <Input
                              readOnly
                              placeholder="如：时间成本"
                            />
                          ) : (
                            <Input placeholder={editingNode.type === 'factor' ? '如：时间成本' : '如：方案 A：优先 Docker'} />
                          )}
                        </Form.Item>

                        {editingNode.type === 'factor' && !isNewNode && (
                          <>
                            <Form.Item name="weight" label="影响权重">
                              <div className="canvas-modal__weight-card">
                                <Slider
                                  min={sliderMin}
                                  max={sliderMax}
                                  step={1}
                                  value={Math.round(weightValue * 100)}
                                  onChange={(val) => {
                                    const w = val / 100
                                    setWeightValue(w)
                                    // 越界恢复：每次拖动后 min/max 跟随当前值
                                    if (w < 0.05) {
                                      setSliderMin(Math.round(w * 100))
                                      setSliderMax(80)
                                    } else if (w > 0.80) {
                                      setSliderMin(5)
                                      setSliderMax(Math.round(w * 100))
                                    } else {
                                      setSliderMin(5)
                                      setSliderMax(80)
                                    }
                                  }}
                                  tooltip={{ formatter: (v) => `${v}%` }}
                                  marks={{
                                    5: '5%',
                                    10: '10%',
                                    60: '60%',
                                    80: '80%',
                                  }}
                                />
                                <span className="canvas-modal__weight-value">
                                  {Math.round(weightValue * 100)}%
                                </span>
                              </div>
                              <div className="canvas-modal__weight-hint">
                                当前总权重：100%
                                {weightValue < 0.05 && (
                                  <span className="canvas-modal__weight-error"> · 权重不能低于 5%</span>
                                )}
                                {weightValue > 0.80 && (
                                  <span className="canvas-modal__weight-error"> · 权重不能超过 80%</span>
                                )}
                                {weightValue >= 0.05 && weightValue <= 0.80 && weightValue > 0.60 && (
                                  <span className="canvas-modal__weight-warning"> · 推荐范围为 10%~60%</span>
                                )}
                                {weightValue >= 0.05 && weightValue <= 0.80 && (
                                  <span> · 修改后其余因素将按比例自动调整</span>
                                )}
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

                        {editingNode.type === 'factor' && isNewNode && (
                          <>
                            <Form.Item name="weight" label="影响权重">
                              <div className="canvas-modal__weight-card">
                                <Slider
                                  min={5}
                                  max={80}
                                  step={1}
                                  value={Math.round(weightValue * 100)}
                                  onChange={(val) => {
                                    setWeightValue(val / 100)
                                  }}
                                  tooltip={{ formatter: (v) => `${v}%` }}
                                  marks={{
                                    5: '5%',
                                    10: '10%',
                                    60: '60%',
                                    80: '80%',
                                  }}
                                />
                                <span className="canvas-modal__weight-value">
                                  {Math.round(weightValue * 100)}%
                                </span>
                              </div>
                              <div className="canvas-modal__weight-hint">
                                当前总权重：100%
                                {weightValue >= 0.60 && weightValue <= 0.80 && (
                                  <span className="canvas-modal__weight-warning"> · 权重较高，建议控制在 60% 以内</span>
                                )}
                                <span> · 其余因素将按比例自动调整</span>
                              </div>
                            </Form.Item>
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
                          {editingNode.type === 'option' ? (
                            <>
                              {(() => {
                                const optionCount = nodesRef.current.filter((n) => n.type === 'option').length
                                const canDelete = optionCount > 2
                                return (
                                  <Popconfirm
                                    title={canDelete
                                      ? `删除后，该方案及其关联关系将不再参与方案对比。是否继续？`
                                      : '至少保留两个候选方案用于对比'}
                                    disabled={!canDelete}
                                    onConfirm={() => handleOptionDeleteClick(editingNode.id)}
                                    okText="删除"
                                    cancelText="取消"
                                  >
                                    <Button
                                      danger
                                      type="text"
                                      icon={<DeleteOutlined />}
                                      disabled={!canDelete}
                                    >
                                      删除此方案
                                    </Button>
                                  </Popconfirm>
                                )
                              })()}
                            </>
                          ) : editingNode.type === 'factor' && !isNewNode ? (
                            (() => {
                              const factorCount = nodesRef.current.filter((n) => n.type === 'factor').length
                              const canDelete = factorCount > 2
                              return (
                                <Popconfirm
                                  title={canDelete
                                    ? `删除后，该因素的权重将按比例分配给其余因素，并重新评估受影响方案。是否继续？`
                                    : '至少保留两个关键影响因素'}
                                  onConfirm={() => handleFactorDeleteClick(editingNode.id)}
                                  okText="删除"
                                  cancelText="取消"
                                  disabled={!canDelete}
                                >
                                  <Button danger type="text" icon={<DeleteOutlined />} disabled={!canDelete}>
                                    删除此因素
                                  </Button>
                                </Popconfirm>
                              )
                            })()
                          ) : null}
                          <Space>
                            <Button onClick={closeModal}>取消</Button>
                            {editingNode.type === 'factor' && !isNewNode ? (
                              <Button
                                type="primary"
                                onClick={() => {
                                  if (weightValue < 0.05 || weightValue > 0.80) {
                                    message.warning('请先将权重拖回合法范围（5%~80%）后再保存')
                                    return
                                  }
                                  submitForm()
                                }}
                              >
                                保存权重
                              </Button>
                            ) : editingNode.type === 'factor' && isNewNode ? (
                              <Button type="primary" onClick={submitForm}>
                                确认添加
                              </Button>
                            ) : (
                              <Button type="primary" onClick={submitForm}>
                                保存修改
                              </Button>
                            )}
                          </Space>
                        </div>
                      </Form>
                    </>
                  )}
                </Modal>

                {/* 删除候选方案确认 */}
                <Modal
                  title="确认删除方案"
                  open={pendingOptionDelete !== null}
                  onCancel={cancelOptionDelete}
                  footer={null}
                  width={420}
                >
                  <p style={{ margin: '0 0 16px', lineHeight: 1.6 }}>
                    删除后，该方案及其关联关系将不再参与方案对比。是否继续？
                  </p>
                  <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button onClick={cancelOptionDelete}>取消</Button>
                    <Button danger type="primary" onClick={confirmOptionDelete}>
                      确认删除
                    </Button>
                  </Space>
                </Modal>

                {/* 删除因素确认 */}
                <Modal
                  title="确认删除因素及其连线"
                  open={pendingFactorDelete !== null}
                  onCancel={cancelFactorDelete}
                  footer={null}
                  width={420}
                >
                  <p style={{ margin: '0 0 16px', lineHeight: 1.6 }}>
                    删除后，该影响因素及其关联关系将从当前决策中移除，剩余因素权重将按比例重新分配。是否继续？
                  </p>
                  <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button onClick={cancelFactorDelete}>取消</Button>
                    <Button danger type="primary" onClick={confirmFactorDelete}>
                      确认删除
                    </Button>
                  </Space>
                </Modal>
              </div>
            </NodeHoverContext.Provider>
          </EdgeFocusContext.Provider>
        </EdgeDeleteContext.Provider>
      </CanvasActionsContext.Provider>
    </PartialAnalysisContext.Provider>
  )
}

// ── 出口组件：根据 viewModel 有无决定渲染空状态还是完整画布 ──────
export function DecisionCanvasPanel(props: DecisionCanvasPanelProps) {
  if (!props.viewModel) {
    return <DecisionCanvasPanelEmpty />
  }
  return <DecisionCanvasPanelInner {...props} />
}
