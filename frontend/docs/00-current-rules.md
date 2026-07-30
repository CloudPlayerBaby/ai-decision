# 当前开发规则

- API 唯一口径：docs/02-api-contract-v2.0.md
- 旧版接口手册失效；如其他文档与 v2.0 冲突，以 v2.0 为准。
- constraints 是 string，不是 string[]。
- 通用响应为：{ code, message, data }。
- 画布保存提交完整 nodes 与 edges。
- 保存画布后，使用后端返回的 changedNodeIds 发起局部重推。
- 局部重推草案由 analysisResultId 标识。
- 选择倾向方案和确认报告都必须携带 analysisResultId。
- SSE 先请求 ticket，再用返回的 sseUrl 建立 EventSource。
- 同一 stepId 的 content 是完整最新文本，前端覆盖旧值，不字符串拼接。
- 展示步骤日志、工具摘要和阶段文本；不展示模型内部推理。