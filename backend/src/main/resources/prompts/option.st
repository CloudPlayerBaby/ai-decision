基于以下决策问题主题、核心理解、约束条件以及提取出的关键因素，请生成 2 到 3 个切实可行的候选方案：
主题：{title}
核心理解：{understanding}
约束条件：{constraints}
关键因素：
{factors}

要求：
1. 每个方案必须包含 id, name, description, pros(优点), cons(缺点), risks(风险)。注意：id 必须严格采用 "opt_" + 纯数字 的格式（例如 "opt_1", "opt_2"），千万不要使用包含英文单词的 ID（错误示范："opt_focused_depth"）。
2. 必须包含五维打分 scores (cost, time, benefit, risk, feasibility)，每项分数为 1-5 分整数，5 分代表更优（如 risk 为 5 表示风险极低）。
3. 方案必须明显区别于彼此，提供不同的解决思路。
4. 以标准的 JSON 格式输出，不要包含任何额外的解释或Markdown格式。

提示：
1. 如果你需要精准计算成本、时间分配等数值型数据来确保方案的可行性，请调用 calculator 工具。
2. 你可以连续或多次调用工具。例如，先调用 searchWeb 获取信息后，若需要计算数值，可直接调用 calculator 进行计算。不要急于输出结论，直到你收集了充分的数据。
