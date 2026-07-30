package qg.po.midterm.workflow.node;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bsc.langgraph4j.action.NodeAction;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Component;
import org.springframework.context.ApplicationEventPublisher;
import qg.po.midterm.workflow.event.NodeExecutionEvent;
import qg.po.midterm.workflow.state.DecisionState;

import java.util.Map;

/** 工作流节点：理解用户的决策问题和目标。 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RequirementAnalysisNode implements NodeAction<DecisionState> {

    private final ChatClient chatClient;
    private final ApplicationEventPublisher eventPublisher;

    @Override
    public Map<String, Object> apply(DecisionState state) throws Exception {
        eventPublisher.publishEvent(new NodeExecutionEvent(this, "RequirementAnalysis", state.getDecisionId(), state.getTaskId(), "RUNNING"));
        log.info("Node [RequirementAnalysis] executing for decision: {}", state.getDecisionId());

        String background = state.getBackground() != null ? state.getBackground() : "无";
        String goal = state.getGoal() != null ? state.getGoal() : "未明确";
        String constraints = state.getConstraints() != null ? state.getConstraints() : "无";

        String prompt = String.format(
            "你是一个专业的商业分析师。请仔细阅读用户提供的决策问题背景、目标和约束条件。\n" +
            "背景：%s\n" +
            "目标：%s\n" +
            "约束：%s\n" +
            "请用一段精炼的文字总结你对这个决策问题的理解，包括核心矛盾和关键挑战，不超过200字。",
            background, goal, constraints
        );

        String understanding = chatClient.prompt()
                .user(prompt)
                .call()
                .content();

        eventPublisher.publishEvent(new NodeExecutionEvent(this, "RequirementAnalysis", state.getDecisionId(), state.getTaskId(), "SUCCEEDED"));
        return Map.of("understanding", understanding);
    }
}
