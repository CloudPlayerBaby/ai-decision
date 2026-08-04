package qg.po.midterm.service.impl;

import qg.po.midterm.workflow.state.Factor;

import java.util.ArrayList;
import java.util.List;

/** Normalizes canvas factor weights before starting a partial analysis. */
final class FactorWeightNormalizer {

    private static final double EPSILON = 0.000001d;

    private FactorWeightNormalizer() {
    }

    /**
     * 应用用户手动调整权重后的编辑规则：
     * <ol>
     *   <li>任一因素权重达到 100% 时，删除其余所有因素，仅保留该因素（权重置为 1）。</li>
     *   <li>权重为 0% 的因素直接删除；全部为 0 时保留原列表，交由 {@link #normalize} 平均分配。</li>
     * </ol>
     */
    static void applyWeightEditRules(List<Factor> factors) {
        if (factors == null || factors.isEmpty()) return;

        for (Factor factor : factors) {
            if (factor != null && factor.getWeight() >= 1d - EPSILON) {
                factors.removeIf(candidate -> candidate != factor);
                factor.setWeight(1d);
                return;
            }
        }

        List<Factor> kept = new ArrayList<>();
        for (Factor factor : factors) {
            if (factor != null && factor.getWeight() > EPSILON) {
                kept.add(factor);
            }
        }
        if (kept.isEmpty() || kept.size() == factors.size()) return;

        factors.clear();
        factors.addAll(kept);
    }

    static void normalize(List<Factor> factors) {
        if (factors == null || factors.isEmpty()) return;

        double total = 0d;
        for (Factor factor : factors) {
            if (factor == null) continue;
            double weight = factor.getWeight();
            if (!Double.isFinite(weight) || weight < 0d) {
                factor.setWeight(0d);
            }
            total += factor.getWeight();
        }

        if (Math.abs(total - 1d) <= EPSILON) return;

        if (total <= EPSILON) {
            double equalWeight = 1d / factors.size();
            factors.forEach(factor -> {
                if (factor != null) factor.setWeight(equalWeight);
            });
            return;
        }

        for (Factor factor : factors) {
            if (factor != null) factor.setWeight(factor.getWeight() / total);
        }
    }

    static String descriptionForNewFactor(String factorName, String description) {
        if (description != null && !description.isBlank()) return description;
        return factorName == null || factorName.isBlank()
                ? "用户新增的决策影响因素"
                : "用户新增的决策影响因素：" + factorName;
    }
}
