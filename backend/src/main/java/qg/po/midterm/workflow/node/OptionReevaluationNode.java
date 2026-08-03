package qg.po.midterm.workflow.node;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bsc.langgraph4j.action.NodeAction;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.prompt.PromptTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;
import qg.po.midterm.workflow.event.NodeExecutionEvent;
import qg.po.midterm.workflow.state.DecisionState;
import qg.po.midterm.workflow.state.Option;
import qg.po.midterm.workflow.utils.LlmRetryUtils;
import tools.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Recalculates scores after factor changes without replacing option content. */
@Slf4j
@Component
@RequiredArgsConstructor
public class OptionReevaluationNode implements NodeAction<DecisionState> {

    private static final Set<String> SCORE_KEYS = Set.of("cost", "time", "benefit", "risk", "feasibility");

    private final ChatClient chatClient;
    private final ApplicationEventPublisher eventPublisher;
    private final ObjectMapper objectMapper;

    @Value("classpath:prompts/option_reevaluation.st")
    private Resource promptResource;

    public record ScoreUpdate(String id, Map<String, Integer> scores) {}
    public record OptionReevaluationResult(String summary, String content, List<ScoreUpdate> options) {}

    @Override
    public Map<String, Object> apply(DecisionState state) throws Exception {
        qg.po.midterm.workflow.context.TaskContextHolder.setContext(state.getTaskId(), state.getDecisionId());
        try {
            eventPublisher.publishEvent(new NodeExecutionEvent(
                    this, "OptionReevaluation", state.getDecisionId(), state.getTaskId(), "RUNNING"));
            List<Option> existing = state.getOptions() == null ? List.of() : state.getOptions();
            if (existing.isEmpty()) throw new IllegalStateException("没有可重评分的候选方案");

            String prompt = new PromptTemplate(promptResource).create(Map.of(
                    "factors", objectMapper.writeValueAsString(state.getFactors() == null ? List.of() : state.getFactors()),
                    "options", objectMapper.writeValueAsString(existing)
            )).getContents();
            LlmRetryUtils.ExecutionResult<OptionReevaluationResult> execution = LlmRetryUtils.executeWithRepairResult(
                    chatClient, prompt, null, OptionReevaluationResult.class,
                    result -> validate(result, existing));
            List<Option> merged = mergeScores(existing, execution.value().options());
            String output = objectMapper.writeValueAsString(execution.value());
            eventPublisher.publishEvent(new NodeExecutionEvent(
                    this, "OptionReevaluation", state.getDecisionId(), state.getTaskId(), "SUCCEEDED", null, output));
            return Map.of("options", merged, "repairAttempted", state.isRepairAttempted() || execution.repaired());
        } finally {
            qg.po.midterm.workflow.context.TaskContextHolder.clear();
        }
    }

    static List<String> validate(OptionReevaluationResult result, List<Option> existing) {
        List<String> errors = new ArrayList<>();
        if (result == null || result.options() == null) return List.of("options (不能为空)");
        Set<String> expected = new LinkedHashSet<>();
        for (Option option : existing) if (option != null && option.getId() != null) expected.add(option.getId());
        Map<String, ScoreUpdate> updates = new LinkedHashMap<>();
        for (ScoreUpdate update : result.options()) {
            if (update == null || update.id() == null || updates.put(update.id(), update) != null) {
                errors.add("options.id (必须唯一且非空)");
                continue;
            }
            if (update.scores() == null || !update.scores().keySet().equals(SCORE_KEYS)
                    || update.scores().values().stream().anyMatch(score -> score == null || score < 1 || score > 5)) {
                errors.add("options[" + update.id() + "].scores (必须包含五维 1-5 整数评分)");
            }
        }
        if (!updates.keySet().equals(expected)) errors.add("options.id (必须与当前方案 ID 完全一致)");
        return errors;
    }

    static List<Option> mergeScores(List<Option> existing, List<ScoreUpdate> updates) {
        Map<String, Map<String, Integer>> scoresById = new LinkedHashMap<>();
        for (ScoreUpdate update : updates) scoresById.put(update.id(), update.scores());
        for (Option option : existing) option.setScores(scoresById.get(option.getId()));
        return existing;
    }
}
