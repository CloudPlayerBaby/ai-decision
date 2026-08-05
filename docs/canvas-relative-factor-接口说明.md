# 画布 option 节点 `relativeFactor` 字段 — 前端接口说明

> 配套《AI 情景推演决策系统_企业级PRD接口手册_v2.0.md》第 10 章（决策画布与局部重推接口）。
> 本文档只描述新增的 `relativeFactor` 字段对前端的影响；其余画布契约不变。

## 1. 一句话说明

画布中 **`type=option` 的方案节点新增了一个顶层字段 `relativeFactor`**，值是同一画布中某个 **`type=factor` 因素节点的 id**，表示"这个方案与哪个因素相关性最强"。前端据此对"因素 → 方案"的连线做高亮/暗淡渲染。

- 有强相关 → `relativeFactor` = 因素节点 id
- 无强相关 → 字段为 `null` / 缺失

## 2. 字段位置与示例

`relativeFactor` 是 **option 节点 JSON 的顶层字段**（与 `id/type/label/position/data` 平级），**不是** `data` 里的子字段。

```json
{
  "nodes": [
    {
      "id": "root",
      "type": "decision",
      "label": "优先学习 Redis 还是 Docker",
      "position": { "x": 360, "y": 40 },
      "data": {}
    },
    {
      "id": "f_time",
      "type": "factor",
      "label": "时间成本",
      "position": { "x": 140, "y": 180 },
      "data": { "weight": 0.30 }
    },
    {
      "id": "opt_redis",
      "type": "option",
      "label": "优先学习 Redis",
      "position": { "x": 420, "y": 340 },
      "data": { "scores": { "cost": 4, "time": 4, "benefit": 5, "risk": 3, "feasibility": 4 } },
      "relativeFactor": "f_time"
    },
    {
      "id": "opt_docker",
      "type": "option",
      "label": "优先学习 Docker",
      "position": { "x": 560, "y": 340 },
      "data": { "scores": { "cost": 3, "time": 3, "benefit": 4, "risk": 4, "feasibility": 4 } },
      "relativeFactor": null
    }
  ],
  "edges": [
    { "id": "e1", "source": "root", "target": "f_time", "relation": "HAS_FACTOR" },
    { "id": "e2", "source": "f_time", "target": "opt_redis", "relation": "AFFECTS" },
    { "id": "e3", "source": "f_time", "target": "opt_docker", "relation": "AFFECTS" }
  ]
}
```

上例中：
- `opt_redis.relativeFactor = "f_time"` → 高亮 `f_time → opt_redis` 这条 AFFECTS 连线。
- `opt_docker.relativeFactor = null` → 该方案无强相关因素，连线保持暗淡。

## 3. 受影响的接口

| 接口 | 说明 |
| --- | --- |
| `GET /decisions/{decisionId}/canvas` | 返回的 option 节点可能带 `relativeFactor`；旧数据会缺失/为 null，前端需兼容 |
| `PUT /decisions/{decisionId}/canvas` | **保存时必须把 `relativeFactor` 原样带回**，否则该字段会被丢弃（见第 4 节） |
| 分析结果草案接口（AnalysisResult） | `options[].relativeFactor` 同步携带该值 |
| SSE `result_ready` → 新 `analysisResultId` | 拉取新草案后，option 同样带 `relativeFactor` |

## 4. ⚠️ 前端保存画布时必须保留该字段

字段由后端 agent 推演生成，**前端不可编辑**，但保存画布时**必须原样带回**。

当前 `frontend/src/utils/canvasMapper.ts` 的 `optionToCanvas` 采用白名单投影，只保存 `data.scores`，**会把 `relativeFactor` 丢掉**。必须改为同时保留顶层字段：

```ts
function optionToCanvas(node: OptionFlowNode): OptionCanvasNode {
  return {
    id: node.id,
    type: 'option',
    label: node.data.label,
    position: node.position,
    data: { scores: node.data.scores },
    relativeFactor: node.relativeFactor ?? null,   // ← 新增：原样保留
  }
}
```

`optionToFlow`（Canvas → Flow）同样需要读入该字段供渲染：

```ts
data: {
  nodeType: 'option',
  label: node.label,
  scores: node.data.scores,
  relativeFactor: node.relativeFactor ?? null,     // ← 新增
  ...
}
```

丢失后果：用户保存一次画布后 `relativeFactor` 从 `canvas_data` 消失；后续局部推演（新增方案/改因素）从画布恢复状态时也无法找回，高亮功能失效。

## 5. 类型定义建议

`frontend/src/types/canvas.ts`：

```ts
export type OptionCanvasNode = {
  id: string
  type: 'option'
  label: string
  position: Position
  data: OptionCanvasData
  /** 方案相关性最强的因素节点 id；无强相关时为 null */
  relativeFactor?: string | null
}
```

`frontend/src/types/flow.ts`：

```ts
export interface OptionFlowData extends Record<string, unknown> {
  nodeType: 'option'
  label: string
  scores: OptionScores
  pros: string[]
  cons: string[]
  risks: string[]
  isRecommended: boolean
  /** 方案相关性最强的因素节点 id；无强相关时为 null（仅展示，不回写表单） */
  relativeFactor?: string | null
}
```

## 6. 渲染建议（高亮"因素→方案"连线）

以 `relativeFactor` 为锚，把该方案与其对应因素节点的 AFFECTS 连线高亮，其余连线暗淡：

```ts
// 伪代码：构建 option → 强相关因素 id 的映射
const strongMap = new Map<string, string>()
canvas.nodes.forEach((n) => {
  if (n.type === 'option' && n.relativeFactor) {
    strongMap.set(n.id, n.relativeFactor)
  }
})
// 渲染时：若 edge.source === strongMap.get(edge.target) → 高亮该边
```

注意事项：
- `relativeFactor` 引用的因素节点一定存在于同一画布中（后端校验保证），但旧数据可能无该字段。
- 方案节点本身、因素节点本身的结构不变；高亮只作用于连线。

## 7. 数据来源与生命周期

| 场景 | relativeFactor 来源 |
| --- | --- |
| 完整推演 | agent 生成方案时判断强相关因素并写入 |
| 局部推演·新增方案（ENRICH_OPTIONS） | 补全 agent 为新方案判断强相关因素 |
| 局部推演·改因素/改方案（REEVALUATE/COMPARE） | 沿用画布中已保存的旧值，不会丢失 |

## 8. 后端兼容性说明（供前端参考）

- 后端 Java 模型（`Option`、`Canvas.CanvasNode`）已加 `relativeFactor` 字段并加 `@JsonIgnoreProperties(ignoreUnknown = true)`，新旧数据双向兼容。
- `canvas_data` 为 JSON 列，无 DDL 迁移；历史画布中该字段为 `null`。
