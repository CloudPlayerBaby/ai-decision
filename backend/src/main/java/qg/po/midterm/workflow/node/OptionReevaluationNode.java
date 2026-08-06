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
import qg.po.midterm.workflow.state.Factor;
import qg.po.midterm.workflow.state.Option;
import qg.po.midterm.workflow.utils.AnalysisResultValidator;
import qg.po.midterm.workflow.utils.LlmRetryUtils;
import tools.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Re-tunes option content and scores after factor changes while keeping ids and count stable. */
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

    public record OptionUpdate(String id, String name, String description,
                               List<String> pros, List<String> cons, List<String> risks,
                               String relativeFactor, Map<String, Integer> scores) {}
    public record OptionReevaluationResult(String summary, String content, List<OptionUpdate> options) {}

    @Override
    public Map<String, Object> apply(DecisionState state) throws Exception {
        qg.po.midterm.workflow.context.TaskContextHolder.setContext(state.getTaskId(), state.getDecisionId());
        try {
            eventPublisher.publishEvent(new NodeExecutionEvent(
                    this, "OptionReevaluation", state.getDecisionId(), state.getTaskId(), "RUNNING"));
            List<Option> existing = state.getOptions() == null ? List.of() : state.getOptions();
            if (existing.isEmpty()) throw new IllegalStateException("没有可重评分的候选方案");

            String prompt = new PromptTemplate(promptResource).create(Map.of(
                    "previousFactors", objectMapper.writeValueAsString(state.getPreviousFactors()),
                    "factors", objectMapper.writeValueAsString(state.getFactors() == null ? List.of() : state.getFactors()),
                    "options", objectMapper.writeValueAsString(existing)
            )).getContents();
            LlmRetryUtils.ExecutionResult<OptionReevaluationResult> execution = LlmRetryUtils.executeWithRepairResult(
                    chatClient, prompt, null, OptionReevaluationResult.class,
                    result -> validate(result, existing, state.getFactors()));
            List<Option> merged = merge(existing, execution.value().options());
            // 兜底：确保每个方案都有非空 relativeFactor，保证前端高亮连线
            AnalysisResultValidator.ensureRelativeFactor(merged, state.getFactors());
            String output = objectMapper.writeValueAsString(execution.value());
            eventPublisher.publishEvent(new NodeExecutionEvent(
                    this, "OptionReevaluation", state.getDecisionId(), state.getTaskId(), "SUCCEEDED", null, output));
            return Map.of("options", merged, "repairAttempted", state.isRepairAttempted() || execution.repaired());
        } finally {
            qg.po.midterm.workflow.context.TaskContextHolder.clear();
        }
    }

    static List<String> validate(OptionReevaluationResult result, List<Option> existing, List<Factor> factors) {
        List<String> errors = new ArrayList<>();
        if (result == null || result.options() == null) return List.of("options (不能为空)");
        Set<String> expected = new LinkedHashSet<>();
        for (Option option : existing) if (option != null && option.getId() != null) expected.add(option.getId());
        Set<String> factorIds = new HashSet<>();
        if (factors != null) {
            for (Factor factor : factors) if (factor != null && factor.getId() != null) factorIds.add(factor.getId());
        }
        Map<String, OptionUpdate> updates = new LinkedHashMap<>();
        for (OptionUpdate update : result.options()) {
            if (update == null || update.id() == null || updates.put(update.id(), update) != null) {
                errors.add("options.id (必须唯一且非空)");
                continue;
            }
            String id = update.id();
            Option existingOption = existing.stream()
                    .filter(option -> option != null && id.equals(option.getId()))
                    .findFirst()
                    .orElse(null);
            if (isBlank(update.name())) errors.add("options[" + id + "].name (不可为空)");
            else if (existingOption != null && !update.name().equals(existingOption.getName())) {
                errors.add("options[" + id + "].name (方案身份不可修改)");
            }
            if (isBlank(update.description())) errors.add("options[" + id + "].description (不可为空)");
            if (isEmpty(update.pros())) errors.add("options[" + id + "].pros (至少一项)");
            if (isEmpty(update.cons())) errors.add("options[" + id + "].cons (至少一项)");
            if (isEmpty(update.risks())) errors.add("options[" + id + "].risks (至少一项)");
            if (update.scores() == null || !update.scores().keySet().equals(SCORE_KEYS)
                    || update.scores().values().stream().anyMatch(score -> score == null || score < 1 || score > 5)) {
                errors.add("options[" + id + "].scores (必须包含五维 1-5 整数评分)");
            }
            if (!isBlank(update.relativeFactor()) && !factorIds.contains(update.relativeFactor())) {
                errors.add("options[" + id + "].relativeFactor (未指向任何关键因素)");
            }
        }
        if (!updates.keySet().equals(expected)) errors.add("options.id (必须与当前方案 ID 完全一致)");
        return errors;
    }

    static List<Option> merge(List<Option> existing, List<OptionUpdate> updates) {
        Map<String, OptionUpdate> updatesById = new LinkedHashMap<>();
        for (OptionUpdate update : updates) updatesById.put(update.id(), update);
        for (Option option : existing) {
            OptionUpdate update = updatesById.get(option.getId());
            if (update == null) continue;
            option.setDescription(update.description());
            option.setPros(update.pros());
            option.setCons(update.cons());
            option.setRisks(update.risks());
            // 重评分只在该轮明确给出 relativeFactor 时更新，避免模型返回空串时清空已有绑定
            if (!isBlank(update.relativeFactor())) {
                option.setRelativeFactor(update.relativeFactor());
            }
            option.setScores(update.scores());
        }
        return existing;
    }

    private static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private static boolean isEmpty(List<String> items) {
        return items == null || items.isEmpty()
                || items.stream().allMatch(item -> item == null || item.trim().isEmpty());
    }
}
