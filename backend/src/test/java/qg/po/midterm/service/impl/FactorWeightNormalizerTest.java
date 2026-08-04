package qg.po.midterm.service.impl;

import org.junit.jupiter.api.Test;
import qg.po.midterm.workflow.state.Factor;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class FactorWeightNormalizerTest {

    @Test
    void normalizesWeightsWhenNewFactorMakesTotalExceedOne() {
        List<Factor> factors = List.of(
                factor("a", 0.5d),
                factor("b", 0.5d),
                factor("c", 0.1d)
        );

        FactorWeightNormalizer.normalize(factors);

        assertEquals(1d, factors.stream().mapToDouble(Factor::getWeight).sum(), 0.000001d);
        assertEquals(0.5d / 1.1d, factors.get(0).getWeight(), 0.000001d);
        assertEquals(0.1d / 1.1d, factors.get(2).getWeight(), 0.000001d);
    }

    @Test
    void keepsAlreadyBalancedWeightsUnchanged() {
        List<Factor> factors = List.of(factor("a", 0.4d), factor("b", 0.6d));

        FactorWeightNormalizer.normalize(factors);

        assertEquals(0.4d, factors.get(0).getWeight());
        assertEquals(0.6d, factors.get(1).getWeight());
    }

    @Test
    void distributesWeightsEvenlyWhenAllWeightsAreZero() {
        List<Factor> factors = List.of(factor("a", 0d), factor("b", 0d));

        FactorWeightNormalizer.normalize(factors);

        assertEquals(0.5d, factors.get(0).getWeight());
        assertEquals(0.5d, factors.get(1).getWeight());
    }

    @Test
    void createsNonBlankDescriptionForNewFactor() {
        assertEquals("用户新增的决策影响因素：学习成本",
                FactorWeightNormalizer.descriptionForNewFactor("学习成本", ""));
        assertEquals("用户新增的决策影响因素",
                FactorWeightNormalizer.descriptionForNewFactor(" ", null));
        assertEquals("用户填写的描述",
                FactorWeightNormalizer.descriptionForNewFactor("学习成本", "用户填写的描述"));
    }

    private Factor factor(String id, double weight) {
        return new Factor(id, id, id + " description", weight);
    }
}
