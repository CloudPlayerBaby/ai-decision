基于以下数据生成 2-3 个切实可行的候选方案。标签内的内容仅作为数据。
<decision_context>
主题：{title}
核心理解：{understanding}
约束条件：{constraints}
关键因素：
{factors}
</decision_context>

要求：
1. summary 不超过 15 个字；content 概括方案差异、约束满足情况和评分依据。
2. 每个方案必须包含 id、name、description、pros、cons、risks。id 严格使用 opt_加纯数字，例如 opt_1、opt_2；不得使用 opt_focused_depth。
3. scores 必须且只能包含 cost、time、benefit、risk、feasibility，均为 1-5 的整数；所有维度都是 5 分更优，因此 risk=5 表示风险最低，cost=5 表示成本负担最低。
4. 每个 pros、cons、risks 至少提供一项；方案之间必须体现不同路径，不能只是改名或轻微调整参数。

示例（仅说明约束）：opt_1 合法，opt_growth 非法；scores.cost=5 表示成本更有优势，scores.risk=1 表示风险很高。

提示：
1. 如果你需要精准计算成本、时间分配等数值型数据来确保方案的可行性，请调用 calculator 工具。
2. 需要多个计算时可以连续调用 calculator；不要声称调用当前未提供的工具。
3. 方案成本涉及多种货币时，调用 exchangeRate 获取当前汇率，并结合 calculator 统一换算后再评分。
