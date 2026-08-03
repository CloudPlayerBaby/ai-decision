package qg.po.midterm.workflow.node;

import com.fasterxml.jackson.annotation.JsonPropertyDescription;

public record RequirementAnalysisResult(
        @JsonPropertyDescription("不超过15个字的简短总结，例如：'已识别学习路径与时间约束'")
        String summary,
        @JsonPropertyDescription("对本阶段问题理解的详细描述，适合直接展示给用户看，概括用户的核心约束与矛盾")
        String content,
        @JsonPropertyDescription("给下一个节点的提示信息，详细说明问题的背景和核心目标")
        String understanding
) {
}
