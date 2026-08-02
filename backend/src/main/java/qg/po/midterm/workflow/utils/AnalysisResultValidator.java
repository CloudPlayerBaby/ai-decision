package qg.po.midterm.workflow.utils;

import qg.po.midterm.dto.result.AnalysisResultDto;
import qg.po.midterm.workflow.state.Factor;
import qg.po.midterm.workflow.state.Option;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * AI 结果强校验（PRD v2.0 第 12 章 / 4.2 / 4.3）。
 *
 * <p>返回 PRD 12.1 风格的字段路径列表，例如 "options[1].scores.feasibility"；
 * 空列表代表结果完全符合 Schema，可以入库。</p>
 */
public final class AnalysisResultValidator {

    private static final Set<String> SCORE_KEYS = Set.of("cost", "time", "benefit", "risk", "feasibility");
    private static final int OPTION_NAME_MAX = 80;
    private static final int LIST_ITEM_MAX = 8;
    private static final int LIST_ITEM_LENGTH_MAX = 200;

    private AnalysisResultValidator() {
    }

    /**
     * 校验一份 AI 分析结果，返回缺失/非法字段列表。
     *
     * @param dto 待校验结果
     * @return 字段路径列表；空列表表示校验通过
     */
    public static List<String> validate(AnalysisResultDto dto) {
        List<String> errors = new ArrayList<>();
        if (dto == null) {
            errors.add("result (整体为空)");
            return errors;
        }

        if (isBlank(dto.getUnderstanding())) {
            errors.add("understanding (不可为空)");
        }

        validateFactors(dto.getFactors(), errors);

        List<Option> options = dto.getOptions();
        validateOptions(options, errors);

        validateRecommendation(dto.getRecommendation(), options, errors);

        List<String> nextActions = dto.getNextActions();
        if (nextActions == null || nextActions.isEmpty()
                || nextActions.stream().allMatch(AnalysisResultValidator::isBlank)) {
            errors.add("nextActions (至少需要1条行动建议)");
        }

        return errors;
    }

    private static void validateFactors(List<Factor> factors, List<String> errors) {
        if (factors == null || factors.isEmpty()) {
            errors.add("factors (至少需要1个因素)");
            return;
        }
        for (int i = 0; i < factors.size(); i++) {
            Factor factor = factors.get(i);
            if (factor == null) {
                errors.add("factors[" + i + "] (为空)");
                continue;
            }
            if (isBlank(factor.getId())) {
                errors.add("factors[" + i + "].id (不可为空)");
            }
            if (isBlank(factor.getName())) {
                errors.add("factors[" + i + "].name (不可为空)");
            }
            if (factor.getWeight() < 0 || factor.getWeight() > 1) {
                errors.add("factors[" + i + "].weight (需在0-1之间)");
            }
        }
    }

    private static void validateOptions(List<Option> options, List<String> errors) {
        if (options == null || options.size() < 2 || options.size() > 3) {
            errors.add("options (必须包含2到3个候选方案)");
            return;
        }
        Set<String> ids = new HashSet<>();
        for (int i = 0; i < options.size(); i++) {
            Option option = options.get(i);
            if (option == null) {
                errors.add("options[" + i + "] (为空)");
                continue;
            }
            if (isBlank(option.getId())) {
                errors.add("options[" + i + "].id (不可为空)");
            } else if (!ids.add(option.getId())) {
                errors.add("options[" + i + "].id (与其他方案重复)");
            }
            if (isBlank(option.getName())) {
                errors.add("options[" + i + "].name (不可为空)");
            } else if (option.getName().length() > OPTION_NAME_MAX) {
                errors.add("options[" + i + "].name (超出" + OPTION_NAME_MAX + "字)");
            }
            validateStringList(option.getPros(), "options[" + i + "].pros", errors);
            validateStringList(option.getCons(), "options[" + i + "].cons", errors);
            validateStringList(option.getRisks(), "options[" + i + "].risks", errors);
            validateScores(option.getScores(), "options[" + i + "].scores", errors);
        }
    }

    private static void validateRecommendation(
            AnalysisResultDto.Recommendation recommendation,
            List<Option> options,
            List<String> errors) {
        if (recommendation == null) {
            errors.add("recommendation (缺失)");
            return;
        }
        if (isBlank(recommendation.getOptionId())) {
            errors.add("recommendation.optionId (不可为空)");
        } else if (options != null && !options.isEmpty()
                && options.stream().noneMatch(o -> recommendation.getOptionId().equals(o.getId()))) {
            errors.add("recommendation.optionId (未指向任何候选方案)");
        }
        if (isBlank(recommendation.getReason())) {
            errors.add("recommendation.reason (不可为空)");
        }
    }

    private static void validateStringList(List<String> items, String path, List<String> errors) {
        if (items == null) {
            return;
        }
        if (items.size() > LIST_ITEM_MAX) {
            errors.add(path + " (最多" + LIST_ITEM_MAX + "项)");
        }
        for (int i = 0; i < items.size(); i++) {
            if (items.get(i) != null && items.get(i).length() > LIST_ITEM_LENGTH_MAX) {
                errors.add(path + "[" + i + "] (单项超出" + LIST_ITEM_LENGTH_MAX + "字)");
            }
        }
    }

    private static void validateScores(Map<String, Integer> scores, String path, List<String> errors) {
        if (scores == null) {
            errors.add(path + " (五维评分缺失)");
            return;
        }
        for (String key : SCORE_KEYS) {
            Integer value = scores.get(key);
            if (value == null) {
                errors.add(path + "." + key + " (缺失)");
            } else if (value < 1 || value > 5) {
                errors.add(path + "." + key + " (需为1-5)");
            }
        }
    }

    private static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
