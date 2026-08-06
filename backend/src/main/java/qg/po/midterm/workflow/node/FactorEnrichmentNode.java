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
import qg.po.midterm.workflow.utils.LlmRetryUtils;
import tools.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 为用户新增的因素生成分析描述。
 *
 * <p>新增方案有 {@link OptionEnrichmentNode} 补全，新增因素此前只保留占位描述
 * （"用户新增的决策影响因素：xxx"）。本节点基于决策上下文分析新因素，
 * 生成与 AI 因素一致的 description，且不修改已有因素的名称与权重。</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class FactorEnrichmentNode implements NodeAction<DecisionState> {

    private final ChatClient chatClient;
    private final ApplicationEventPublisher eventPublisher;
    private final ObjectMapper objectMapper;

    @Value("classpath:prompts/factor_enrichment.st")
    private Resource promptResource;

    public record FactorEnrichmentResult(String summary, String content, List<Factor> factors) {}

    @Override
    public Map<String, Object> apply(DecisionState state) throws Exception {
        qg.po.midterm.workflow.context.TaskContextHolder.setContext(state.getTaskId(), state.getDecisionId());
        try {
            eventPublisher.publishEvent(new NodeExecutionEvent(
                    this, "FactorEnrichment", state.getDecisionId(), state.getTaskId(), "RUNNING"));

            List<String> targetIds = state.getFactorIdsToEnrich();
            List<Factor> allFactors = state.getFactors() == null ? List.of() : state.getFactors();
            List<Factor> targetFactors = allFactors.stream()
                    .filter(factor -> factor != null && targetIds.contains(factor.getId()))
                    .toList();
            if (targetIds.isEmpty() || targetFactors.size() != new LinkedHashSet<>(targetIds).size()) {
                throw new IllegalStateException("待分析因素与最新画布不一致");
            }

            String title = state.data().containsKey("title")
                    ? String.valueOf(state.data().get("title")) : null;
            String prompt = new PromptTemplate(promptResource).create(Map.of(
                    "title", valueOrEmpty(title),
                    "background", valueOrEmpty(state.getBackground()),
                    "goal", valueOrEmpty(state.getGoal()),
                    "constraints", valueOrEmpty(state.getConstraints()),
                    "understanding", valueOrEmpty(state.getUnderstanding()),
                    "factors", objectMapper.writeValueAsString(targetFactors)
            )).getContents();

            LlmRetryUtils.ExecutionResult<FactorEnrichmentResult> execution =
                    LlmRetryUtils.executeWithRepairResult(
                            chatClient,
                            prompt,
                            null,
                            FactorEnrichmentResult.class,
                            result -> validateEnrichment(result, targetIds)
                    );

            List<Factor> merged = mergeEnrichedFactors(allFactors, execution.value().factors(), targetIds);

            String outputData = objectMapper.writeValueAsString(new FactorEnrichmentResult(
                    execution.value().summary(), execution.value().content(), merged));
            eventPublisher.publishEvent(new NodeExecutionEvent(
                    this, "FactorEnrichment", state.getDecisionId(), state.getTaskId(),
                    "SUCCEEDED", null, outputData));

            return Map.of(
                    "factors", merged,
                    "repairAttempted", state.isRepairAttempted() || execution.repaired()
            );
        } finally {
            qg.po.midterm.workflow.context.TaskContextHolder.clear();
        }
    }

    static List<String> validateEnrichment(FactorEnrichmentResult result, List<String> targetIds) {
        List<String> errors = new ArrayList<>();
        if (result == null) {
            return List.of("result (整体为空)");
        }
        if (result.factors() == null) {
            return List.of("factors (不能为空)");
        }
        Set<String> expected = new LinkedHashSet<>(targetIds);
        Set<String> actual = new LinkedHashSet<>();
        for (Factor factor : result.factors()) {
            if (factor != null && factor.getId() != null) actual.add(factor.getId());
        }
        if (!actual.equals(expected)) {
            errors.add("factors.id (必须与待分析因素 ID 完全一致)");
        }
        for (int index = 0; index < result.factors().size(); index++) {
            Factor factor = result.factors().get(index);
            if (factor == null) continue;
            if (factor.getDescription() == null || factor.getDescription().isBlank()) {
                errors.add("factors[" + index + "].description (不可为空)");
            }
        }
        return errors;
    }

    static List<Factor> mergeEnrichedFactors(List<Factor> existing, List<Factor> enriched, List<String> targetIds) {
        Map<String, Factor> enrichedById = new LinkedHashMap<>();
        if (enriched != null) {
            for (Factor factor : enriched) {
                if (factor != null && factor.getId() != null) enrichedById.put(factor.getId(), factor);
            }
        }
        List<Factor> merged = new ArrayList<>();
        for (Factor factor : existing) {
            if (factor != null && targetIds.contains(factor.getId())) {
                Factor replacement = enrichedById.get(factor.getId());
                if (replacement == null) throw new IllegalArgumentException("缺少待分析因素: " + factor.getId());
                // 保留原 id/name/weight，只用 agent 生成的 description
                replacement.setId(factor.getId());
                replacement.setName(factor.getName());
                replacement.setWeight(factor.getWeight());
                merged.add(replacement);
            } else {
                merged.add(factor);
            }
        }
        return merged;
    }

    private String valueOrEmpty(String value) {
        return value == null ? "" : value;
    }
}
