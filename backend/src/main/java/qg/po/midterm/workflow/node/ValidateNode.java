package qg.po.midterm.workflow.node;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bsc.langgraph4j.action.NodeAction;
import org.springframework.stereotype.Component;
import qg.po.midterm.common.exception.AiValidationException;
import qg.po.midterm.dto.result.AnalysisResultDto;
import qg.po.midterm.dto.result.ValidationResult;
import qg.po.midterm.workflow.state.DecisionState;
import qg.po.midterm.workflow.state.Factor;
import qg.po.midterm.workflow.state.Option;
import qg.po.midterm.workflow.utils.AnalysisResultValidator;

import java.util.*;

/**
 * 工作流节点：内部拦截校验节点。不向外抛出事件，用于拦截校验错误并触发重试。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ValidateNode implements NodeAction<DecisionState> {

    @Override
    public Map<String, Object> apply(DecisionState state) throws Exception {
        log.info("Node [ValidateNode] executing for decision: {}", state.getDecisionId());

        // -----------------------------------------------------------------------------------
        // 第一阶段：执行严格的字段审查（对应 PRD 12.1）
        // -----------------------------------------------------------------------------------
        List<String> missingFields = new ArrayList<>();

        if (isBlank(state.getUnderstanding())) missingFields.add("understanding");

        List<Factor> factors = state.getFactors();
        if (factors == null || factors.isEmpty()) {
            missingFields.add("factors");
        } else {
            Set<String> factorIds = new HashSet<>();
            double totalWeight = 0;
            for (int index = 0; index < factors.size(); index++) {
                Factor factor = factors.get(index);
                String path = "factors[" + index + "]";
                if (factor == null) {
                    missingFields.add(path);
                    continue;
                }
                if (isBlank(factor.getId()) || !factorIds.add(factor.getId())) {
                    missingFields.add(path + ".id");
                }
                if (isBlank(factor.getName())) missingFields.add(path + ".name");
                if (isBlank(factor.getDescription())) missingFields.add(path + ".description");
                if (factor.getWeight() < 0 || factor.getWeight() > 1) {
                    missingFields.add(path + ".weight");
                }
                totalWeight += factor.getWeight();
            }
            if (Math.abs(totalWeight - 1.0d) > 0.05d) missingFields.add("factors.weightSum");
        }

        List<Option> options = state.getOptions();
        Set<String> optionIds = new HashSet<>();
        if (options == null || options.size() < 2
                || options.size() > AnalysisResultValidator.OPTION_COUNT_MAX) {
            missingFields.add("options");
        } else {
            for (int i = 0; i < options.size(); i++) {
                Option opt = options.get(i);
                String path = "options[" + i + "]";
                if (opt == null) {
                    missingFields.add(path);
                    continue;
                }
                if (isBlank(opt.getId()) || !opt.getId().matches("^opt_[A-Za-z0-9_-]+$")
                        || !optionIds.add(opt.getId())) {
                    missingFields.add(path + ".id");
                }
                if (isBlank(opt.getName()) || opt.getName().length() > 80) {
                    missingFields.add(path + ".name");
                }
                validateList(opt.getPros(), path + ".pros", missingFields);
                validateList(opt.getCons(), path + ".cons", missingFields);
                validateList(opt.getRisks(), path + ".risks", missingFields);
                if (opt.getScores() == null) {
                    missingFields.add(path + ".scores");
                } else {
                    Map<String, Integer> scores = opt.getScores();
                    String[] requiredScores = {"cost", "time", "benefit", "risk", "feasibility"};
                    for (String key : requiredScores) {
                        Integer score = scores.get(key);
                        if (score == null || score < 1 || score > 5) {
                            missingFields.add(path + ".scores." + key);
                        }
                    }
                }
            }
        }

        AnalysisResultDto.Recommendation rec = state.getRecommendation();
        if (rec == null) {
            missingFields.add("recommendation");
        } else {
            if (isBlank(rec.getOptionId()) || !optionIds.contains(rec.getOptionId())) {
                missingFields.add("recommendation.optionId");
            }
            if (isBlank(rec.getReason())) missingFields.add("recommendation.reason");
        }

        List<String> nextActions = state.getNextActions();
        if (nextActions == null || nextActions.isEmpty()
                || nextActions.stream().anyMatch(this::isBlank)) missingFields.add("nextActions");

        int retryCount = state.getRetryCount();

        // -----------------------------------------------------------------------------------
        // 第二阶段：根据审查结果决定命运 (放行 / 驳回修复 / 彻底封杀)
        // -----------------------------------------------------------------------------------
        if (!missingFields.isEmpty()) {
            String errorDetails = "校验失败，字段不符合要求:\n- " + String.join("\n- ", missingFields);
            log.warn(">>> [ValidateNode] 发现不合法结构: \n{}", errorDetails);

            if (retryCount >= 1) {
                // 彻底封杀：已经给过一次机会（被 RepairNode 抢救过），依然不合格。
                // 抛出异常会直接中止整个工作流任务，抛给上层统一异常处理，标记状态为 FAILED (42201)。
                log.error(">>> [ValidateNode] 一次修复失败，任务彻底终止！");
                throw new AiValidationException(
                        "AI 分析结果结构校验彻底失败",
                        missingFields,
                        true
                );
            } else {
                // 驳回修复：第一次犯错，把错题本（errorMsg）存入状态。
                // 图引擎（DecisionWorkflow）的条件路由发现 errorMsg 不为空，会自动将其踢到 RepairNode。
                return Map.of("errorMsg", errorDetails);
            }
        }

        // 绿灯放行：完全符合结构，清空 errorMsg（尤其是在被 RepairNode 修复成功的情况下），图引擎会流向 GENERATE_REPORT。
        log.info(">>> [ValidateNode] 校验完美通过！");
        ValidationResult validation = new ValidationResult(
                true,
                state.isRepairAttempted(),
                null,
                List.of()
        );
        return Map.of("errorMsg", "", "validation", validation);
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private void validateList(List<String> values, String path, List<String> errors) {
        if (values == null || values.size() > 8
                || values.stream().anyMatch(item -> isBlank(item) || item.length() > 200)) {
            errors.add(path);
        }
    }
}
