package qg.po.midterm.workflow.node;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bsc.langgraph4j.action.NodeAction;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Component;
import org.springframework.context.ApplicationEventPublisher;
import qg.po.midterm.workflow.event.NodeExecutionEvent;
import qg.po.midterm.workflow.state.DecisionState;
import qg.po.midterm.workflow.state.Factor;
import qg.po.midterm.workflow.state.Option;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** 工作流节点：生成候选决策方案。 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OptionGenerationNode implements NodeAction<DecisionState> {

    private final ChatClient chatClient;
    private final ApplicationEventPublisher eventPublisher;

    public record OptionGenerationResult(List<Option> options) {}

    @Override
    public Map<String, Object> apply(DecisionState state) throws Exception {
        eventPublisher.publishEvent(new NodeExecutionEvent(this, "OptionGeneration", state.getDecisionId(), state.getTaskId(), "STARTED"));
        log.info("Node [OptionGeneration] executing for decision: {}", state.getDecisionId());

        String understanding = state.getUnderstanding();
        String constraints = state.getConstraints();
        List<Factor> factors = state.getFactors();
        
        String factorStr = factors == null ? "无" : factors.stream()
            .map(f -> String.format("- %s (权重: %.2f): %s", f.getName(), f.getWeight(), f.getDescription()))
            .collect(Collectors.joining("\n"));

        String prompt = String.format(
            "基于以下决策核心理解、约束条件以及提取出的关键因素，请生成 2 到 3 个切实可行的候选方案。\n" +
            "核心理解：%s\n" +
            "约束条件：%s\n" +
            "关键因素：\n%s\n\n" +
            "要求：\n" +
            "1. 每个方案必须包含 id, name, description, pros(优点), cons(缺点), risks(风险)。\n" +
            "2. 必须包含五维打分 scores (cost, time, benefit, risk, feasibility)，每项分数为 1-5 分整数，5 分代表更优（如 risk 为 5 表示风险极低）。\n" +
            "3. 方案必须明显区别于彼此，提供不同的解决思路。\n" +
            "4. 以标准的 JSON 格式输出，不要包含任何额外的解释或Markdown格式。",
            understanding != null ? understanding : "无",
            constraints != null ? constraints : "无",
            factorStr
        );

        OptionGenerationResult result = chatClient.prompt()
                .user(prompt)
                .call()
                .entity(OptionGenerationResult.class);

        eventPublisher.publishEvent(new NodeExecutionEvent(this, "OptionGeneration", state.getDecisionId(), state.getTaskId(), "FINISHED"));
        return Map.of("options", result.options());
    }
}
