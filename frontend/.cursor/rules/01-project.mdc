# AI 开发规则

## 先读什么
每次编码前先阅读：
1. docs/00-current-rules.md
2. docs/02-api-contract-v2.0.md
3. 当前 feature 的 types 与已有代码

## 技术栈
- React + TypeScript
- Ant Design
- React Flow
- React Query
- Zustand
- Axios
- React Router

禁止新增 Redux、MobX、Tailwind、Element Plus、第二套 UI 库或第二个请求库。
禁止使用 any。

## 数据规则
- 组件内禁止直接请求 Axios，必须调用 services 层。
- 服务端数据用 React Query。
- 跨页面 UI 状态用 Zustand。
- constraints 是 string。
- 画布保存提交完整 nodes 和 edges。
- 局部重推只提交 changedNodeIds。
- analysisResultId 用于选择方案与确认结果。
- EventSource 前先获取 SSE Ticket。
- 同 stepId 的 content 以最新值覆盖，禁止拼接重复文本。
- 不展示模型内部推理。

## 工作规则
- 先说明准备修改哪些文件，再编码。
- 不修改任务范围外的目录。
- 不重构无关文件。
- 完成后运行 npm run lint。