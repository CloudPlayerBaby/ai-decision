package qg.po.midterm.workflow.utils;

import org.junit.jupiter.api.Test;
import org.springframework.ai.openai.OpenAiChatOptions;

import java.time.Duration;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class JsonOutputOptionsTest {

    @Test
    void boundsStructuredModelCallsAndDisablesThinking() {
        OpenAiChatOptions options = JsonOutputOptions.create().build();

        assertEquals(4096, options.getMaxTokens());
        assertEquals(Duration.ofSeconds(60), options.getTimeout());
        assertEquals(0, options.getMaxRetries());
        assertEquals(Map.of("thinking", Map.of("type", "disabled")), options.getExtraBody());
    }
}
