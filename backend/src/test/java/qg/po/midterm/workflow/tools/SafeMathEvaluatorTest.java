package qg.po.midterm.workflow.tools;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class SafeMathEvaluatorTest {

    @Test
    void evaluatesArithmetic() {
        assertEquals(14.0, SafeMathEvaluator.evaluate("2 + 3 * 4"));
        assertEquals(20.0, SafeMathEvaluator.evaluate("(2 + 3) * 4"));
        assertEquals(-2.5, SafeMathEvaluator.evaluate("-(10 / 4)"));
    }

    @Test
    void rejectsUnsafeOrInvalidExpressions() {
        assertThrows(IllegalArgumentException.class, () -> SafeMathEvaluator.evaluate("10 / 0"));
        assertThrows(IllegalArgumentException.class,
                () -> SafeMathEvaluator.evaluate("T(java.lang.Runtime).getRuntime().exec('calc')"));
        assertThrows(IllegalArgumentException.class, () -> SafeMathEvaluator.evaluate("1 + (2 * 3"));
    }
}
