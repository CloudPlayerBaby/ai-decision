package qg.po.midterm.workflow;

import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import tools.jackson.databind.ObjectMapper;
import org.bsc.langgraph4j.RunnableConfig;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import qg.po.midterm.workflow.event.NodeExecutionEvent;
import qg.po.midterm.mapper.SysUserMapper;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Slf4j
@SpringBootTest
public class DecisionWorkflowIntegrationTest {

    @Autowired
    private WorkflowExecutor workflowExecutor;
    
    @MockitoBean
    private SysUserMapper sysUserMapper;
    
    @MockitoBean
    private qg.po.midterm.mapper.DecisionMapper decisionMapper;

    @Test
    public void testFullWorkflow() throws Exception {
        String decisionId = "TEST-" + UUID.randomUUID().toString().substring(0, 8);
        String background = "大三学生，准备秋招。";
        String goal = "我应该优先学习 Redis 还是 Docker？";
        String constraints = "只有2周时间，每天2小时。Java基础扎实，无中间件或容器经验。";

        log.info("=================================================");
        log.info("🚀 开始执行 AI 决策工作流端到端集成测试");
        log.info("目标: {}", goal);
        log.info("=================================================");
        
        Map<String, Object> initData = new HashMap<>();
        initData.put("decisionId", decisionId);
        initData.put("taskId", UUID.randomUUID().toString());
        initData.put("background", background);
        initData.put("goal", goal);
        initData.put("constraints", constraints);
        
        qg.po.midterm.workflow.state.DecisionState state = new qg.po.midterm.workflow.state.DecisionState(initData);
        RunnableConfig config = RunnableConfig.builder().threadId(decisionId).build();
        
        var result = workflowExecutor.getCompiledGraph().invoke(state.data(), config);
        
        log.info("✅ 推演结束，输出最终结果：");
        log.info("=================================================");
        result.ifPresent(s -> {
            try {
                ObjectMapper mapper = new ObjectMapper();
                log.info("\n{}", mapper.writerWithDefaultPrettyPrinter().writeValueAsString(s.data()));
            } catch (Exception e) {
                log.error("Failed to format JSON", e);
            }
        });
        log.info("=================================================");
    }
    
    @Component
    @Slf4j
    public static class TestEventListener {
        @EventListener
        public void handleEvent(NodeExecutionEvent event) {
            if ("FAILED".equals(event.getStatus())) {
                log.error(">>> [SSE 推送模拟] ❌ 节点 {} 报错: {}", event.getNodeName(), event.getErrorMessage());
            } else if ("RUNNING".equals(event.getStatus())) {
                log.info(">>> [SSE 推送模拟] 🔄 节点 {} 开始执行...", event.getNodeName());
            } else if ("SUCCEEDED".equals(event.getStatus())) {
                log.info(">>> [SSE 推送模拟] ✅ 节点 {} 执行成功！", event.getNodeName());
            }
        }
    }
}
