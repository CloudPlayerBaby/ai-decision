package qg.po.midterm.workflow.node;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bsc.langgraph4j.action.NodeAction;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.prompt.PromptTemplate;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Value;
import qg.po.midterm.workflow.event.NodeExecutionEvent;
import qg.po.midterm.workflow.state.DecisionState;
import qg.po.midterm.workflow.state.Option;
import qg.po.midterm.workflow.utils.AnalysisResultValidator;
import qg.po.midterm.workflow.utils.LlmRetryUtils;
import tools.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Completes newly added options without regenerating or overwriting existing options. */
@Slf4j
@Component
@RequiredArgsConstructor
public class OptionEnrichmentNode implements NodeAction<DecisionState> {

    private final ChatClient chatClient;
    private final ApplicationEventPublisher eventPublisher;
    private final ObjectMapper objectMapper;

    @Value("classpath:prompts/option_enrichment.st")
    private Resource promptResource;

    public record OptionEnrichmentResult(String summary, String content, List<Option> options) {}

    @Override
    public Map<String, Object> apply(DecisionState state) throws Exception {
        qg.po.midterm.workflow.context.TaskContextHolder.setContext(state.getTaskId(), state.getDecisionId());
        try {
            eventPublisher.publishEvent(new NodeExecutionEvent(
                    this, "OptionEnrichment", state.getDecisionId(), state.getTaskId(), "RUNNING"));

            List<String> targetIds = state.getOptionIdsToEnrich();
            List<Option> allOptions = state.getOptions() == null ? List.of() : state.getOptions();
            List<Option> targetOptions = allOptions.stream()
                    .filter(option -> option != null && targetIds.contains(option.getId()))
                    .toList();
            if (targetIds.isEmpty() || targetOptions.size() != new LinkedHashSet<>(targetIds).size()) {
                throw new IllegalStateException("待补全方案与最新画布不一致");
            }

            String prompt = new PromptTemplate(promptResource).create(Map.of(
                    "background", valueOrEmpty(state.getBackground()),
                    "goal", valueOrEmpty(state.getGoal()),
                    "constraints", valueOrEmpty(state.getConstraints()),
                    "factors", objectMapper.writeValueAsString(
                            state.getFactors() == null ? List.of() : state.getFactors()),
                    "options", objectMapper.writeValueAsString(targetOptions)
            )).getContents();

            LlmRetryUtils.ExecutionResult<OptionEnrichmentResult> execution =
                    LlmRetryUtils.executeWithRepairResult(
                            chatClient,
                            prompt,
                            null,
                            OptionEnrichmentResult.class,
                            result -> validateEnrichment(result, targetIds)
                    );

            List<Option> merged = mergeEnrichedOptions(allOptions, execution.value().options(), targetIds);
            List<String> mergedErrors = AnalysisResultValidator.validateOptions(merged);
            if (!mergedErrors.isEmpty()) {
                throw new IllegalArgumentException("补全后的方案校验失败: " + String.join(", ", mergedErrors));
            }

            String outputData = objectMapper.writeValueAsString(new OptionEnrichmentResult(
                    execution.value().summary(), execution.value().content(), merged));
            eventPublisher.publishEvent(new NodeExecutionEvent(
                    this, "OptionEnrichment", state.getDecisionId(), state.getTaskId(),
                    "SUCCEEDED", null, outputData));

            return Map.of(
                    "options", merged,
                    "repairAttempted", state.isRepairAttempted() || execution.repaired()
            );
        } finally {
            qg.po.midterm.workflow.context.TaskContextHolder.clear();
        }
    }

    static List<String> validateEnrichment(OptionEnrichmentResult result, List<String> targetIds) {
        List<String> errors = new ArrayList<>();
        if (result == null) {
            return List.of("result (整体为空)");
        }
        errors.addAll(AnalysisResultValidator.validateOptionDetails(result.options()));
        Set<String> expected = new LinkedHashSet<>(targetIds);
        Set<String> actual = new LinkedHashSet<>();
        if (result.options() != null) {
            result.options().stream().filter(option -> option != null)
                    .map(Option::getId).forEach(actual::add);
        }
        if (!actual.equals(expected)) {
            errors.add("options.id (必须与待补全方案 ID 完全一致)");
        }
        if (result.options() != null) {
            for (int index = 0; index < result.options().size(); index++) {
                Option option = result.options().get(index);
                if (option == null) continue;
                if (option.getDescription() == null || option.getDescription().isBlank()) {
                    errors.add("options[" + index + "].description (不可为空)");
                }
                requireNonEmpty(option.getPros(), "options[" + index + "].pros", errors);
                requireNonEmpty(option.getCons(), "options[" + index + "].cons", errors);
                requireNonEmpty(option.getRisks(), "options[" + index + "].risks", errors);
            }
        }
        return errors;
    }

    private static void requireNonEmpty(List<String> values, String path, List<String> errors) {
        if (values == null || values.isEmpty() || values.stream().allMatch(value -> value == null || value.isBlank())) {
            errors.add(path + " (至少需要一项)");
        }
    }

    static List<Option> mergeEnrichedOptions(
            List<Option> existing, List<Option> enriched, List<String> targetIds) {
        Map<String, Option> enrichedById = new LinkedHashMap<>();
        if (enriched != null) {
            for (Option option : enriched) enrichedById.put(option.getId(), option);
        }
        List<Option> merged = new ArrayList<>();
        for (Option option : existing) {
            if (option != null && targetIds.contains(option.getId())) {
                Option replacement = enrichedById.get(option.getId());
                if (replacement == null) throw new IllegalArgumentException("缺少待补全方案: " + option.getId());
                replacement.setId(option.getId());
                replacement.setName(option.getName());
                if (option.getDescription() != null && !option.getDescription().isBlank()) {
                    replacement.setDescription(option.getDescription());
                }
                merged.add(replacement);
            } else {
                merged.add(option);
            }
        }
        return merged;
    }

    private String valueOrEmpty(String value) {
        return value == null ? "" : value;
    }
}
