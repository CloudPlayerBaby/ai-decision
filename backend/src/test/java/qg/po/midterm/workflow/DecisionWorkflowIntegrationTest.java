package qg.po.midterm.workflow;

import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import qg.po.midterm.workflow.event.NodeExecutionEvent;

import java.util.UUID;

@Slf4j
@SpringBootTest
public class DecisionWorkflowIntegrationTest {

    @Autowired
    private WorkflowExecutor workflowExecutor;

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
        
        String taskId = workflowExecutor.startAnalysis(decisionId, background, goal, constraints);
        
        log.info("✅ 任务已提交，taskId: {}", taskId);
        log.info("⏳ 正在等待大模型推演完毕（最大等待 120 秒）...");
        
        Thread.sleep(120000);
        log.info("🏁 测试结束");
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
