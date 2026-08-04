根据最新影响因素，重新评估每个已有候选方案：结合因素变化调整方案内容（名称、描述、优点、缺点、风险、关联因素）与五维评分。方案的数量和 id 保持不变。

<factors>
{factors}
</factors>
<options>
{options}
</options>

要求：
1. options 必须包含所有且仅包含输入方案的 id，每个 id 必须逐字复制，不得生成新 id，不得增删方案。
2. 每个 options 项必须完整包含 id、name、description、pros、cons、risks、relativeFactor、scores；即使某个字段未变化，也必须原样返回，不得省略。
3. scores 必须且只能包含 cost、time、benefit、risk、feasibility，取值均为 1-5 的整数。
4. 5 分代表更优：cost 为成本负担最低，time 为时间投入最低，benefit 为收益最高，risk 为风险最低，feasibility 为可行性最高。
5. 每个 pros、cons、risks 至少提供一项。
6. relativeFactor 必须从上方 factors 列表中的 id 字段选择；若该方案没有特别突出的强相关因素，可以为空字符串。
7. summary 不超过 15 个字；content 简要说明因素变化如何影响方案的调整与评分，不得逐字复述方案内容。
