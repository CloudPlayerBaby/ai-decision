对比旧版和最新版影响因素，重新评估每个已有候选方案。方案 id 和名称是方案身份，必须保持不变；描述、优点、缺点、风险、关联因素和五维评分必须基于最新版因素重新推导，不能机械复制旧结果。

<previous_factors>
{previousFactors}
</previous_factors>
<latest_factors>
{factors}
</latest_factors>
<options>
{options}
</options>

要求：
1. options 必须包含所有且仅包含输入方案的 id，每个 id 必须逐字复制，不得生成新 id，不得增删方案。
2. 每个 options 项必须完整包含 id、name、description、pros、cons、risks、relativeFactor、scores；id 和 name 必须原样返回，其他评估字段必须结合最新因素重新分析后返回。
3. scores 必须且只能包含 cost、time、benefit、risk、feasibility，取值均为 1-5 的整数。
4. 5 分代表更优：cost 为成本负担最低，time 为时间投入最低，benefit 为收益最高，risk 为风险最低，feasibility 为可行性最高。
5. 每个 pros、cons、risks 至少提供一项。
6. relativeFactor 必须从上方 factors 列表中的 id 字段选择（取 id 本身，不要加方括号）；即使相关性不显著，也必须选择最相关的一个因素 id，relativeFactor 不得为空。
7. 必须先比较 previous_factors 与 latest_factors 的权重和描述变化，再判断每个方案受影响的维度；不得直接照抄输入方案的旧 scores、pros、cons 或 risks。
8. summary 不超过 15 个字；content 简要说明因素变化如何影响方案的调整与评分，不得逐字复述方案内容。
