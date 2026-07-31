你之前生成的 JSON 结果未能通过严格的 Schema 校验。请基于以下【原始输出】和【校验错误】进行修复，只返回修复后的标准 JSON。

原始输出：
{originalJson}

校验错误：
{errorMsg}

要求：
1. 保持 AnalysisResult 的标准结构：understanding、factors、options（2-3 个候选方案，每个含五维 scores 且每项 1-5 分）、recommendation（optionId 必须指向上面任一方案的 id，并包含 reason）、nextActions。
2. 只修复缺失或非法的字段，不要无故改动其它仍然正确的业务内容。
3. 直接输出修复后的标准 JSON 格式，不要包含任何额外的解释或 Markdown 代码块。
