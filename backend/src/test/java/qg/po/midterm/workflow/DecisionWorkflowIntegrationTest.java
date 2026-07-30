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
    public void testTravelScenario() throws Exception {
        runWorkflow(
            "【个人规划】周末三亚穷游规划",
            "我准备这周末去三亚旅行，预算仅仅只有 3000 块，帮我规划下方案，一定要算清楚每笔钱够不够。",
            "只能花3000元，不能超支。需要列出交通和住宿等花销。"
        );
    }

    @Test
    public void testInvestmentScenario() throws Exception {
        runWorkflow(
            "【商业决策】是否投资固态电池初创公司",
            "公司账上有 5000 万闲置资金，有一家叫‘超能固态’的初创企业在寻求融资，请出具风险回报推演。",
            "需要客观的行业数据支撑，严格进行风险收益期望计算。"
        );
    }

    @Test
    public void testTechArchitectureScenario() throws Exception {
        runWorkflow(
            "【技术选型】Vue 3 还是 React 18",
            "我们要重构一个拥有 200 多个表单的复杂企业级中后台，技术栈选 Vue 3 还是 React 18？",
            "需要长期维护，团队大多是刚毕业的后端开发转全栈。请给出可维护性和性能评估。"
        );
    }

    private void runWorkflow(String title, String goal, String constraints) throws Exception {
        String decisionId = "TEST-" + UUID.randomUUID().toString().substring(0, 8);
        log.info("=================================================");
        log.info("🚀 开始执行 AI 决策工作流场景测试: {}", title);
        log.info("目标: {}", goal);
        log.info("约束: {}", constraints);
        log.info("=================================================");
        
        Map<String, Object> initData = new HashMap<>();
        initData.put("decisionId", decisionId);
        initData.put("taskId", UUID.randomUUID().toString());
        initData.put("background", title);
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
