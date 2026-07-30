AI 情景推演决策系统

REST API · SSE 事件协议 · 数据契约 · 联调规范

  文档属性	内容                                  
  版本  	v2.0                                
  状态  	已定稿，可直接用于开发                         
  适用对象	前端、后端                               
  基准日期	2026-07-30                          
  接口前缀	/api/v1                             
  数据格式	JSON（UTF-8）；SSE 使用 text/event-stream

使用说明：本文档是团队唯一接口口径。字段、枚举、错误码、状态流转及 SSE 事件以本文档为准；任何修改需经前后端双方确认。

1. 文档目标与范围

本手册定义"AI 情景推演决策系统"的前后端 API 契约，覆盖认证、决策问题、异步 Agent 推演、SSE 进度、决策画布、局部重推、结果确认与报告。

1.1 业务主流程

1. 用户注册并登录，获取 JWT。
2. 创建一个决策问题，状态为 PENDING。
3. 发起异步推演，状态进入 ANALYZING；前端连接 SSE 并展示步骤日志。
4. 后端校验 Agent 的结构化结果，创建一份待确认的 AnalysisResult，成功后进入 WAITING_CONFIRM。
5. 用户选择倾向方案并确认，系统生成正式报告，状态变为 COMPLETED。
6. 用户可查看历史记录、报告、完整过程；失败步骤可单独重试。
7. 用户编辑画布后可局部重推受影响子树；局部重推创建新的待确认结果，用户确认该结果后才覆盖正式结论与报告。

1.2 关键边界

- AI 的最终结果必须是结构化 JSON；纯文本不能作为正式分析结果入库。
- 面向用户的"思考过程"是步骤日志、阶段性说明和工具调用摘要，不展示模型内部原始推理链。
- 所有决策数据必须按当前 userId 做资源归属校验；越权统一返回 404（避免资源枚举）。
- SSE 仅负责实时通知；刷新恢复以 REST 查询到的持久化任务/步骤状态为准。
- 前端按钮点击后需 disabled 防止重复提交。
- 每份 AI 分析草案均有 analysisResultId；它不是乐观锁，而是用户确认“具体哪一份草案”的最小标识。

2. 通用约定

2.1 域名、版本与请求头

  项目          	约定                                      
  Base URL    	开发环境：http://localhost:8080/api/v1；生产环境由 Nginx 反向代理到 /api/v1
  Content-Type	application/json; charset=UTF-8         
  认证头         	Authorization: Bearer <accessToken>     
  时间格式        	ISO 8601，示例：2026-07-30T21:30:00+08:00   
  分页          	page 从 1 开始；pageSize 默认 10，最大 100       
  删除策略        	物理删除；删除后不可恢复                            

2.2 统一响应包裹

    {
      "code": 0,
      "message": "success",
      "data": {}
    }

  字段     	类型                     	说明                                     
  code   	integer                	业务码。0 表示成功；非 0 表示业务失败。HTTP 状态码仍表达协议层结果。
  message	string                 	给用户/开发者阅读的简短说明。                        
  data   	object \| array \| null	成功时返回业务数据；失败通常为 null 或错误详情。            

2.3 HTTP 状态与业务错误码

  HTTP   	业务码  	场景          	前端处理             
  200/201	0    	请求成功        	渲染 data。         
  400    	40001	参数校验失败      	显示字段错误；不重试。      
  401    	40101	未登录、Token 失效	清除登录态，跳转登录页。     
  404    	40401	资源不存在/已删除   	提示资源不存在。         
  409    	40901	状态冲突/重复提交   	刷新详情状态，禁止重复操作。   
  422    	42201	AI 结果结构校验失败 	展示失败详情；允许重试任务或步骤。
  500    	50001	服务端错误       	展示兜底错误，提示稍后重试。   

3. 核心枚举与状态机

3.1 决策问题状态

  枚举               	含义               	允许操作                            
  PENDING          	已创建，尚未推演         	开始推演、编辑、删除。                     
  ANALYZING        	整轮推演进行中          	查看进度、刷新恢复。                      
  PARTIAL_ANALYZING	局部重推进行中          	查看局部范围和进度；原已确认结果仍可展示但标识为旧版本。    
  WAITING_CONFIRM  	结构化结果已通过校验，等待用户确认	查看/编辑画布、选择倾向方案、确认、局部重推、重新发起整轮推演。
  COMPLETED        	报告已正式生成          	查看报告、重新生成报告、编辑画布并局部重推。          
  FAILED           	推演或报告生成失败        	查看失败步骤、重试步骤或整轮推演。               

3.2 推演步骤状态

  枚举       	说明                                
  WAITING  	尚未执行，等待前置步骤。                      
  RUNNING  	执行中。                              
  SUCCEEDED	已成功，结果持久化。                        
  FAILED   	失败，记录 errorCode、errorMessage、错误时间。

标准步骤：UNDERSTAND（问题理解）→ EXTRACT_FACTORS（因素提取）→ TOOL_CALL（外部工具，可选）→ GENERATE_OPTIONS（方案生成）→ COMPARE_OPTIONS（方案对比）→ GENERATE_REPORT（确认后执行）。

结构校验与一次修复在后端 Agent 层内部完成，不单独暴露为推演步骤。

4. 数据模型（API 视图）

4.1 DecisionProblem

  字段                 	类型            	必填  	说明                      
  id                 	string        	是   	UUID，JSON 中按字符串返回。      
  title              	string        	是   	1–100 字。                
  background         	string        	否   	问题背景，最大 2000 字。         
  goal               	string        	是   	决策目标，1–1000 字。          
  constraints        	string        	否   	约束条件，自由文本。              
  status             	DecisionStatus	是   	见 3.1。                  
  preferredOptionId  	string \| null	否   	用户当前倾向方案。               
  latestTaskId       	string \| null	否   	最近一次推演任务。               
  hasPendingResult   	boolean       	是   	是否存在待用户确认的新分析草案。        
  pendingResultId    	string \| null	否   	待确认草案的 analysisResultId。
  createdAt/updatedAt	datetime      	是   	服务端生成。                  

4.2 AnalysisResult（通过校验的草案）

  字段            	类型      	说明                                   
  id            	string  	analysisResultId，用于选择倾向方案和最终确认。      
  status        	string  	PENDING_CONFIRM（待确认）或 CONFIRMED（已确认）。
  understanding 	string  	对问题和目标的理解。                           
  factors       	Factor[]	关键因素；每项含 id、name、weight、description。 
  options       	Option[]	2–3 个候选方案；每项含优点、缺点、风险、五维评分。          
  recommendation	object  	推荐 optionId、reason。                  
  nextActions   	string[]	下一步行动建议。                             
  canvas        	Canvas  	画布节点和边。                              
  validation    	object  	schemaValid、repaired、warnings。       

4.3 Option 与五维评分

  字段                                      	类型      	规则                      
  id/name                                 	string  	同一结果内唯一；name 1–80 字。    
  pros/cons/risks                         	string[]	各 0–8 项；每项 ≤ 200 字。     
  scores.cost/time/benefit/risk/feasibility	integer 	均为 1–5；5 更优。风险分 5 表示低风险。

5. 认证与用户接口

5.1 注册

POST /auth/register

Request

    { "username": "pearl", "email": "pearl@example.com", "password": "Abc123456" }

Response data

    {
      "id": "u_10001",
      "username": "pearl",
      "email": "pearl@example.com",
      "createdAt": "2026-07-30T21:30:00+08:00"
    }

  校验项     	规则                       
  username	3–30 位，仅字母、数字、下划线；唯一。    
  email   	合法邮箱且唯一。                 
  password	8–64 位，至少包含字母和数字；服务端仅存哈希。

5.2 登录

POST /auth/login

Request

    { "account": "pearl@example.com", "password": "Abc123456" }

account 支持邮箱或用户名。

Response data

    {
      "accessToken": "eyJ...",
      "tokenType": "Bearer",
      "expiresIn": 7200,
      "user": { "id": "u_10001", "username": "pearl", "email": "pearl@example.com" }
    }

5.3 当前用户

GET /users/me（需要 Bearer Token）

5.4 登出

前端清除 localStorage 中的 token 即可。JWT 无状态，无需后端登出接口。

6. 决策问题 CRUD 接口

6.1 创建问题

POST /decisions；成功返回 HTTP 201。

Request

    {
      "title": "我应该优先学习 Redis 还是 Docker？",
      "background": "我在准备 Java 后端面试。",
      "goal": "一周内提升求职竞争力",
      "constraints": "每天 2 小时，已有 Java 基础"
    }

Response data

    {
      "id": "d_20001",
      "status": "PENDING",
      "title": "我应该优先学习 Redis 还是 Docker？",
      "createdAt": "2026-07-30T21:30:00+08:00"
    }

6.2 分页列表

GET /decisions?page=1&pageSize=10&status=COMPLETED&keyword=Redis

Response data

    {
      "list": [{ "id": "d_20001", "title": "...", "status": "COMPLETED", "preferredOptionId": "opt_1", "updatedAt": "..." }],
      "page": 1, "pageSize": 10, "total": 21, "totalPages": 3
    }

6.3 详情

GET /decisions/{decisionId}。返回 DecisionProblem、latestTask 摘要、当前已确认结果摘要、待确认结果摘要、reportId；前端刷新详情时以此接口恢复页面基础状态。

Response data（节选）

    {
      "decision": {
        "id": "d_20001",
        "title": "我应该优先学习 Redis 还是 Docker？",
        "status": "COMPLETED",
        "latestTaskId": "t_30002",
        "hasPendingResult": true,
        "pendingResultId": "ar_40002"
      },
      "latestTask": { "id": "t_30002", "status": "SUCCEEDED", "progress": 100 },
      "confirmedResultId": "ar_40001",
      "pendingResultId": "ar_40002",
      "reportId": "r_50001"
    }

6.4 删除

DELETE /decisions/{decisionId}。成功返回 200。仅 PENDING、WAITING_CONFIRM、COMPLETED、FAILED 状态可删除；ANALYZING/PARTIAL_ANALYZING 时返回 409。

7. Agent 异步推演与任务接口

7.1 发起整轮推演

POST /decisions/{decisionId}/analysis。若当前已有运行任务，返回 40901。

Response data

    {
      "taskId": "t_30001",
      "decisionId": "d_20001",
      "taskType": "FULL_ANALYSIS",
      "status": "RUNNING",
      "startedAt": "2026-07-30T21:31:00+08:00"
    }

7.2 查询任务与恢复进度

GET /analysis-tasks/{taskId}。页面首次进入、刷新、SSE 断线重连前都应先调用此接口。SSE 断线后直接调此接口拿完整步骤列表即可。

Response data

    {
      "id": "t_30001", "status": "RUNNING", "progress": 42,
      "steps": [
        { "id": "s_1", "name": "UNDERSTAND", "displayName": "理解问题", "status": "SUCCEEDED", "startedAt": "...", "endedAt": "...", "summary": "已识别学习路径与时间约束", "content": "你只有一周时间准备 Java 后端面试，每天 2 小时，共 14 小时可用。核心矛盾在于有限时间内是追求覆盖面还是单点深度。" },
        { "id": "s_2", "name": "EXTRACT_FACTORS", "displayName": "提取关键因素", "status": "RUNNING", "summary": "正在分析时间、收益与风险", "content": "关键因素包括：时间成本（每天仅 2 小时）、求职收益（面试高频度）、项目实践（能否形成可验证成果）" }
      ],
      "lastEventId": "evt_102"
    }

7.3 重试失败步骤

POST /analysis-tasks/{taskId}/steps/{stepId}/retry。仅当该步骤为 FAILED 且前置步骤成功时允许；已成功步骤不得重跑。

Response data

    {
      "taskId": "t_30001",
      "stepId": "s_4",
      "status": "WAITING",
      "message": "已加入重试队列"
    }

7.4 任务失败的错误详情

任务或步骤失败时，GET 任务详情中应返回 error：{ code, message, retryable, failedStepId }。前端仅在 retryable=true 时展示"重试"按钮。

8. SSE 事件协议

原生 EventSource 不能携带 Bearer Header。本项目统一采用 SSE Ticket：前端先携带 JWT 请求 ticket，再用 ticket 建立 EventSource。不得在 URL 中直接携带长期 accessToken。

8.1 获取 SSE Ticket

POST /analysis-tasks/{taskId}/sse-ticket（需要 Bearer Token）。

Response data

    {
      "sseUrl": "/api/v1/analysis-tasks/t_30001/events?ticket=sse_tk_xxx",
      "expiresIn": 60
    }

Ticket 仅限当前用户、当前任务、一次连接使用，有效期 60 秒；前端重连时重新获取 ticket。

8.2 连接与恢复

1. 前端先 GET /analysis-tasks/{taskId} 渲染持久化步骤。
2. 再请求 SSE Ticket，并用返回的 sseUrl 连接 SSE；重连时重新获取 ticket。
3. 服务端每 15–30 秒发送 ping 事件防止代理超时。
4. 连接异常不等于任务失败。前端显示"连接恢复中"，按指数退避重连。

8.3 标准事件

  event       	何时发送     	data 核心字段                               
  step_update 	步骤状态/内容变化	stepId、status、summary、content、progress、occurredAt
  tool_call   	开始/完成工具调用	toolName、status、inputSummary、outputSummary
  result_ready	结构化结果校验通过	decisionId、analysisResultId、decisionStatus、resultStatus=PENDING_CONFIRM
  task_failed 	任务最终失败   	errorCode、message、failedStepId、retryable
  ping        	心跳       	serverTime                              

    event: step_update
    id: evt_102
    data: {"taskId":"t_30001","stepId":"s_2","status":"RUNNING","progress":42,"summary":"正在提取关键因素","content":"你只有一周时间准备 Java 后端面试，每天 2 小时，共 14 小时可用。Redis 和 Docker 都是高频考点，但考察方式不同——Redis 侧重缓存场景和数据结构，Docker 侧重工程化和部署能力。核心矛盾在于有限时间内是追求覆盖面还是单点深度。","occurredAt":"2026-07-30T21:31:12+08:00"}
    
    event: tool_call
    id: evt_103
    data: {"taskId":"t_30001","stepId":"s_3","toolName":"calculator","status":"SUCCEEDED","inputSummary":"比较每日学习时长","outputSummary":"两种方案均可在 14 小时内完成基础学习"}
    
    event: result_ready
    id: evt_120
    data: {"taskId":"t_30001","decisionId":"d_20001","analysisResultId":"ar_40002","decisionStatus":"COMPLETED","resultStatus":"PENDING_CONFIRM"}

summary 与 content 的区别：

- summary：简短标题，步骤卡片折叠时显示。始终存在。
- content：AI 分析的详细长文本，步骤卡片展开后显示。流式推送时后端对同一 stepId 多次发送，每次均为“当前完整最新文本”，前端以最新值覆盖本地该步骤的 content；打字机效果仅是 UI 动画。
- 流式推送期间 content 可能不完整；最终 status 变为 SUCCEEDED 时 content 为完整内容。

9. 结果、方案与确认接口

9.1 获取待确认分析结果

GET /decisions/{decisionId}/analysis-result?resultId=ar_40002。仅返回已通过校验的结果。resultId 可选；不传时优先返回待确认结果，其次返回已确认结果。决策处于 ANALYZING / PARTIAL_ANALYZING 且不存在结果时，统一返回 HTTP 200、data: null。

    {
      "id": "ar_40002",
      "status": "PENDING_CONFIRM",
      "understanding": "用户希望在一周内选择优先学习方向。",
      "factors": [{"id":"f_time","name":"时间成本","weight":0.30,"description":"一周内可获得的掌握程度"}],
      "options": [{"id":"opt_redis","name":"优先学习 Redis","pros":["面试高频"],"cons":["需理解缓存场景"],"risks":["缺少项目实践"],"scores":{"cost":4,"time":4,"benefit":5,"risk":3,"feasibility":4}}],
      "recommendation": {"optionId":"opt_redis","reason":"..."},
      "nextActions": ["完成缓存基础", "做一个缓存穿透演示"],
      "validation": {"schemaValid":true,"repaired":false,"warnings":[]},
      "createdAt": "2026-07-30T21:38:00+08:00"
    }

9.2 选择倾向方案（草稿）

PUT /decisions/{decisionId}/preferred-option。不生成正式报告，仅保存用户倾向。

Request

    { "analysisResultId": "ar_40002", "optionId": "opt_redis" }

9.3 确认分析并生成报告

POST /decisions/{decisionId}/confirm。只允许确认 status=PENDING_CONFIRM 的草案；成功后该草案成为正式结果并生成报告。

Request

    { "analysisResultId": "ar_40002", "selectedOptionId": "opt_redis" }

Response data

    {
      "decisionId": "d_20001",
      "status": "COMPLETED",
      "analysisResultId": "ar_40002",
      "reportId": "r_50001",
      "reportStatus": "READY"
    }

10. 决策画布与局部重推接口

10.1 获取画布

GET /decisions/{decisionId}/canvas。画布数据应独立于前端图形库；不要将 React Flow 等库的内部字段直接当作唯一数据模型。

Response data

    {
      "nodes": [
        {"id":"root","type":"decision","label":"优先学习 Redis 还是 Docker","position":{"x":360,"y":40},"data":{}},
        {"id":"f_time","type":"factor","label":"时间成本","position":{"x":140,"y":180},"data":{"weight":0.30}},
        {"id":"opt_redis","type":"option","label":"优先学习 Redis","position":{"x":420,"y":340},"data":{"scores":{"cost":4,"time":4,"benefit":5,"risk":3,"feasibility":4}}}
      ],
      "edges": [{"id":"e1","source":"root","target":"f_time","relation":"HAS_FACTOR"}]
    }

10.2 保存画布编辑

PUT /decisions/{decisionId}/canvas。前端编辑完成后传完整的 nodes + edges 数组覆盖保存。

Request

    {
      "nodes": [
        {"id":"root","type":"decision","label":"优先学习 Redis 还是 Docker","position":{"x":360,"y":40},"data":{}},
        {"id":"f_time","type":"factor","label":"时间成本","position":{"x":160,"y":190},"data":{"weight":0.40}},
        {"id":"opt_redis","type":"option","label":"优先学习 Redis","position":{"x":420,"y":340},"data":{"scores":{"cost":4,"time":4,"benefit":5,"risk":3,"feasibility":4}}}
      ],
      "edges": [{"id":"e1","source":"root","target":"f_time","relation":"HAS_FACTOR"}]
    }

Response data

    {
      "changedNodeIds": ["f_time"],
      "canvas": { "nodes": [], "edges": [] }
    }

后端根据保存前后的画布计算 changedNodeIds；前端以该字段作为局部重推入参，不自行猜测受影响方案。

10.3 发起局部重推

POST /decisions/{decisionId}/partial-analysis。后端根据 changedNodeIds 确定受影响子树。

Request

    { "changedNodeIds": ["f_time", "tmp_1"] }

Response data

    { "taskId": "t_30002", "taskType": "PARTIAL_ANALYSIS", "status": "RUNNING", "affectedNodeIds": ["f_time", "opt_redis", "opt_docker"] }

局部重推完成后：

- 若原状态是 WAITING_CONFIRM，决策保持 WAITING_CONFIRM，并创建新的 AnalysisResult(status=PENDING_CONFIRM)。
- 若原状态是 COMPLETED，决策恢复 COMPLETED，但 hasPendingResult=true；旧报告继续有效，新草案必须被用户确认后才替换正式结果与报告。
- result_ready SSE 事件会带回新 analysisResultId，前端据此拉取新草案。

11. 报告接口

11.1 获取最终报告

GET /reports/{reportId} 或 GET /decisions/{decisionId}/report。报告由已确认的 AnalysisResult 生成。

Response data

    {
      "id":"r_50001", "decisionId":"d_20001", "analysisResultId":"ar_40002", "status":"READY",
      "content": {"background":"...", "objective":"...", "factorAnalysis":[], "optionComparison":[], "conclusion":"...", "riskAnalysis":[], "nextActions":[]},
      "generatedAt":"2026-07-30T21:40:00+08:00"
    }

11.2 重新生成报告

POST /decisions/{decisionId}/regenerate-report。基于当前已确认的结果重新生成报告展示内容，不重新调用分析 Agent。若要重新分析，应使用 7.1 重新发起推演。

12. AI 结果校验与后端实现约束

1. Agent 输出必须先解析为 JSON，再进行 JSON Schema / DTO 校验。
2. 必填项至少包括 understanding、factors、2–3 个 options、每方案五维 scores、recommendation、nextActions。
3. 校验失败时，将"校验错误列表 + 原 JSON"发给 AI 修复一次；修复结果仍不合格，任务进入 FAILED 状态。（硬性要求，不可省略）
4. 只有 schemaValid=true 的结果可写入 decision_results，生成 status=PENDING_CONFIRM 的草案并进入 WAITING_CONFIRM。
5. 报告只能由用户确认后生成；不得把流式文本当正式报告依据。
6. 记录每步输入摘要、输出摘要、错误、耗时和工具调用摘要；敏感信息不得落库或发送给前端。

12.1 校验失败响应

    HTTP 422
    {
      "code": 42201,
      "message": "AI 结果结构校验失败",
      "data": {
        "taskId": "t_30001",
        "failedStepId": "s_6",
        "missingFields": ["options[1].scores.feasibility"],
        "repairAttempted": true,
        "retryable": true
      }
    }

13. 前端联调与验收清单

13.1 每个接口的联调最小检查

- 请求参数与字段类型严格符合文档；ID 为 string、时间为 ISO 8601。
- 成功、空数据、参数错误、未登录、无权限五条路径均测试。
- 发起任务后刷新页面：先用任务详情恢复，再连 SSE；不得从 0% 重新展示。
- SSE 断开时不把任务直接标为 FAILED；重连后从 7.2 接口恢复完整步骤，再重新获取 SSE Ticket。
- 局部重推时检查 affectedNodeIds；收到 result_ready.analysisResultId 后拉取新草案并再次确认。

13.2 角色责任边界

  角色      	交付物                    	验收口径                        
  前端      	页面、接口调用封装、SSE 管理、状态兜底  	不依赖 Mock 也能完整走主流程；错误可理解、可恢复。
  后端      	API、鉴权、持久化、任务、SSE、AI 校验	接口文档字段一致；刷新恢复；越权不可访问。       
  AI/Agent	步骤编排、工具调用、结构化结果和修复     	正常和失败路径均可复现；不输出未校验正式结果。     

13.3 联调问题单格式

  字段    	示例                                     
  接口    	POST /api/v1/decisions/d_20001/analysis
  环境与时间 	dev，2026-07-30 22:10                   
  请求    	参数、Header                              
  预期/实际 	预期 status=RUNNING；实际返回 40901           
  复现步骤  	创建问题后连续点击两次开始推演                        
  负责人/状态	后端 B / 待修复                             

附录：v1.0 → v1.1 变更记录

以下为本次简化所做的所有修改及理由，供团队确认：

  #   	位置  	修改内容                                    	理由                                      
  1   	2.1 	去掉 X-Idempotency-Key                    	学生项目无需幂等性设计，前端按钮 disabled 即可防止重复提交      
  2   	2.2 	统一响应去掉 requestId、timestamp              	联调阶段非必须，保留 code + message + data 三个字段已足够
  3   	2.3 	去掉 429（限流）和 503（服务不可用）                  	学生项目无需限流；AI 不可用时归入 500 统一处理             
  4   	3.1 	去掉 DELETED 状态，改为物理删除                    	数据量不大，物理删除更简单，省去逻辑删除的过滤逻辑               
  5   	3.2 	去掉 SKIPPED 步骤状态                         	只保留 WAITING / RUNNING / SUCCEEDED / FAILED 四种，够用
  6   	3.2 	VALIDATE_RESULT 不单独暴露为步骤                	校验逻辑在后端 Agent 层内部完成，前端不需要看到这一步          
  7   	4.1 	constraints 从 string[] 改为 string        	数组处理麻烦，纯文本交给 AI 解析更简单                   
  8   	4.2 	AnalysisResult 去掉 version 字段            	去掉乐观锁，后端每次覆盖写入，前端无需传版本号                 
  9   	4.3 	Option 去掉 scoreRationale 字段             	AI 生成的解释经常不准，分数本身足够表达，也减少校验工作量          
  10  	5.4 	去掉 POST /auth/logout 接口                 	JWT 无状态，前端删 token 即可，不需要后端接口            
  11  	6.4 	去掉 PATCH 更新接口                           	需求里没有"编辑已有决策问题"的功能，不满意删了重建即可            
  12  	6.1 	创建问题 constraints 示例改为字符串                	配合 #7，保持一致                              
  13  	7.1 	去掉 X-Idempotency-Key                    	配合 #1                                   
  14  	7.3 	去掉 GET /logs 增量日志接口                     	推演仅 5-6 步，SSE 断线后直接调 7.2 任务详情拿完整步骤列表即可  
  15  	8.2 	SSE 事件从 7 种精简为 5 种                      	合并 display_message 到 step_update；task_snapshot 用 7.2 REST 接口替代
  16  	8.2 	step_update 新增 content 字段               	承载 AI 分析的详细长文本，步骤卡片展开后显示；v2.0 明确以完整文本覆盖更新
  17  	9.1 	接口去掉 version 查询参数                       	配合 #8 去掉乐观锁                             
  18  	9.2 	选择倾向方案去掉 resultVersion                  	配合 #8                                   
  19  	9.3 	确认接口去掉 resultVersion 和 409 冲突处理         	配合 #8                                   
  20  	10.1	画布返回数据去掉 version 字段                     	配合 #8                                   
  21  	10.2	画布保存从 operations 数组改为完整 nodes+edges     	操作码（MOVE_NODE 等）太复杂，直接覆盖保存简单直接          
  22  	10.3	局部重推去掉 baseVersion 和 reason             	baseVersion 配合乐观锁去掉；reason 用户不会认真填      
  23  	11.1	报告返回数据去掉 resultVersion                  	配合 #8                                   
  24  	12.1	校验失败响应去掉 requestId                      	配合 #2                                   
  25  	13.1	联调清单去掉 resultVersion 和 409 检查项          	配合 #8                                   
  26  	14  	去掉 Swagger/Apifox/OpenAPI/TypeScript 生成建议	markdown 文档 + 口头沟通足够，不需多学一套工具链          

保留的功能（硬性要求不可删）：

- 邮箱注册 + 邮箱/用户名登录（5.1、5.2）
- AI 结果一次修复流程（12 第 3 条）
- 重新生成报告（11.2）
- SSE 流式输出 + 步骤持久化 + 单步重试
- 局部重推 + 结果校验 + 用户确认

附录：v1.1 → v2.0 变更记录

  #   	位置                  	v2.0 调整                            	目的                                      
  1   	AnalysisResult      	新增 id 与 status                     	保留 v1.1 的简化，但让用户能确认具体一份局部重推草案。          
  2   	DecisionProblem / 详情	新增 hasPendingResult、pendingResultId	已完成决策出现新草案时，前端能同时展示旧正式报告与新待确认结果。        
  3   	确认相关接口              	提交 analysisResultId                	避免确认操作误确认到另一份结果。                        
  4   	SSE                 	新增 SSE Ticket 接口                   	解决 JWT 与原生 EventSource 不能自定义 Header 的冲突。
  5   	SSE content         	明确为完整文本覆盖更新                        	避免同一 stepId 的流式文本重复拼接。                  
  6   	画布保存                	返回 changedNodeIds                  	局部重推入参由保存结果确定，前端不猜测修改范围。                
  7   	状态码                 	删除资源越权的 403                        	决策资源越权统一返回 404，避免资源枚举。                  
  8   	JSON 示例             	移除 ... 占位符                         	保证示例可直接用于 Mock 和联调。                     

v2.0 仍保留 v1.1 的简化原则：无乐观锁、无幂等键、constraints 为 string、画布整图保存、SSE 断线后整任务恢复、步骤仅四种状态。保留的硬性能力包括：结构化 AI 结果与一次修复、SSE 流式过程、单步重试、局部重推、用户确认和报告生成。
