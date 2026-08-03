package qg.po.midterm.service.impl;

import qg.po.midterm.workflow.state.Factor;

import java.util.List;

/** Normalizes canvas factor weights before starting a partial analysis. */
final class FactorWeightNormalizer {

    private static final double EPSILON = 0.000001d;

    private FactorWeightNormalizer() {
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
