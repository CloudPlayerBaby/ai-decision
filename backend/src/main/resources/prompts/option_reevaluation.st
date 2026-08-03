根据最新影响因素，重新评估每个已有候选方案的五维评分。只能返回评分，不能修改方案名称、描述、优点、缺点、风险或方案数量。

<factors>
{factors}
</factors>
<options>
{options}
</options>

要求：
1. options 必须包含所有且仅包含输入方案的 id，每个 id 必须逐字复制，不得生成新 id。
2. 每个 options 项只能包含 id 和 scores；scores 必须且只能包含 cost、time、benefit、risk、feasibility，取值均为 1-5 的整数。
3. 5 分代表更优：cost 为成本负担最低，time 为时间投入最低，benefit 为收益最高，risk 为风险最低，feasibility 为可行性最高。
4. summary 不超过 15 个字；content 简要说明因素变化如何影响评分，不得复述或改写方案内容。
