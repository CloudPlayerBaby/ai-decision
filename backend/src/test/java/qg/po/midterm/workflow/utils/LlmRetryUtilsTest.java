package qg.po.midterm.workflow.utils;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertTrue;

class LlmRetryUtilsTest {

    @Test
    void repairPromptContainsErrorsOriginalJsonAndRequiredFormat() {
        String prompt = LlmRetryUtils.buildRepairPrompt(
                "- factors.weightSum",
                "{\"factors\":[]}",
                "required schema"
        );

        assertTrue(prompt.contains("- factors.weightSum"));
        assertTrue(prompt.contains("{\"factors\":[]}"));
        assertTrue(prompt.contains("required schema"));
        assertTrue(prompt.contains("只修复错误涉及的字段"));
    }
}
