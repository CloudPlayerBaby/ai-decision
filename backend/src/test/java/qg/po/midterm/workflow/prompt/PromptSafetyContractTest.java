package qg.po.midterm.workflow.prompt;

import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.prompt.PromptTemplate;
import org.springframework.core.io.ClassPathResource;
import qg.po.midterm.workflow.node.OptionGenerationNode;
import qg.po.midterm.workflow.node.RequirementAnalysisResult;
import qg.po.midterm.workflow.utils.MarkdownStrippingConverter;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PromptSafetyContractTest {

    @Test
    void safetyPromptsRenderWithHarmfulInputWithoutBreakingTemplateVariables() {
        String requirement = render("prompts/requirement.st", Map.of(
                "title", "我应该先抢劫还是先打架",
                "background", "无",
                "goal", "未明确",
                "constraints", "无"
        ));
        String option = render("prompts/option.st", Map.of(
                "title", "我应该先抢劫还是先打架",
                "understanding", "原选项均不可取，应安全退出冲突",
                "constraints", "无",
                "factors", "人身安全、法律风险"
        ));
        String risk = render("prompts/risk.st", Map.of(
                "title", "学习 Redis 还是 Docker",
                "understanding", "比较学习路径",
                "options", "候选方案数据"
        ));

        assertTrue(requirement.contains("原选项均不可取"));
        assertTrue(requirement.contains("如何安全退出冲突并寻求帮助"));
        assertTrue(option.contains("立即停止并脱离现场"));
        assertTrue(option.contains("opt_1 格式正确"));
        assertTrue(risk.contains("时间评分为4分"));
        assertTrue(risk.contains("收益评分为4分"));
        assertTrue(risk.contains("cost 写作“成本”"));
        assertTrue(risk.contains("不得写成“time=4、benefit=4”"));
        assertTrue(risk.contains("字段名仍须严格遵循 Schema"));
    }

    @Test
    void existingConvertersStillParseStructuredSafetyResponses() {
        RequirementAnalysisResult requirement = new MarkdownStrippingConverter<>(RequirementAnalysisResult.class)
                .convert("{\"summary\":\"原选项均不可取\",\"content\":\"请停止行动并离开现场\",\"understanding\":\"目标重构为安全退出冲突并寻求帮助\"}");
        OptionGenerationNode.OptionGenerationResult option =
                new MarkdownStrippingConverter<>(OptionGenerationNode.OptionGenerationResult.class)
                        .convert("{\"summary\":\"已生成安全方案\",\"content\":\"优先停止行动并求助\",\"options\":[{\"id\":\"opt_1\",\"name\":\"安全离场\",\"description\":\"停止行动并前往安全位置\",\"pros\":[\"降低伤害风险\"],\"cons\":[\"需要立即中止当前行为\"],\"risks\":[\"离场途中仍需保持警觉\"],\"scores\":{\"cost\":5,\"time\":5,\"benefit\":5,\"risk\":5,\"feasibility\":5}}]}");

        assertEquals("原选项均不可取", requirement.summary());
        assertEquals("opt_1", option.options().getFirst().getId());
    }

    private String render(String path, Map<String, Object> values) {
        return new PromptTemplate(new ClassPathResource(path)).create(values).getContents();
    }
}
