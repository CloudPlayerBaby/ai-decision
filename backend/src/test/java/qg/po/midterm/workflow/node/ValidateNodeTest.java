package qg.po.midterm.workflow.node;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import qg.po.midterm.dto.result.AnalysisResultDto;
import qg.po.midterm.workflow.state.DecisionState;
import qg.po.midterm.workflow.state.Factor;
import qg.po.midterm.workflow.state.Option;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * ValidateNode 单元测试
 *
 * 专门针对《接口文档 2.0》第 12 节 “AI 结果强校验拦截” 的核心规则进行边界测试。
 */
class ValidateNodeTest {

    private ValidateNode validateNode;

    @BeforeEach
    void setUp() {
        validateNode = new ValidateNode();
    }

    /**
     * 构建一个全字段完美的满血状态（完美匹配 PRD 12 节约束 + 4.2/4.3 数据契约）。
     */
    private Map<String, Object> buildPerfectInitData() {
        Map<String, Object> initData = new HashMap<>();

        // 1. 必填理解
        initData.put("understanding", "完美理解了业务背景和目标。");

        // 2. 至少1个因素，含 id/name/weight
        Factor f1 = new Factor();
        f1.setId("f_1");
        f1.setName("性能");
        f1.setWeight(0.3);
        initData.put("factors", List.of(f1));

        // 3. 2 个候选方案，五维分数均为 1-5，且含 name
        Option opt1 = new Option();
        opt1.setId("opt_1");
        opt1.setName("优先学习 Redis");
        Map<String, Integer> scores1 = new HashMap<>();
        scores1.put("cost", 4);
        scores1.put("time", 4);
        scores1.put("benefit", 5);
        scores1.put("risk", 3);
        scores1.put("feasibility", 4);
        opt1.setScores(scores1);

        Option opt2 = new Option();
        opt2.setId("opt_2");
        opt2.setName("优先学习 Docker");
        opt2.setScores(new HashMap<>(scores1));

        initData.put("options", Arrays.asList(opt1, opt2));

        // 4. 必填推荐，optionId 必须指向存在的方案
        AnalysisResultDto.Recommendation rec = new AnalysisResultDto.Recommendation();
        rec.setOptionId("opt_1");
        rec.setReason("Redis 是 Java 后端面试高频考点");
        initData.put("recommendation", rec);

        // 5. 必填下一步行动
        initData.put("nextActions", List.of("立刻启动项目"));

        // 6. 重试次数初始化为 0
        initData.put("retryCount", 0);

        return initData;
    }

    /**
     * 测试场景 1：大模型生成了完美、完整的数据。
     * 预期：errorMsg 为空字符串 ""，图引擎放行。
     */
    @Test
    void testValidate_AllFieldsPresent_ShouldPass() throws Exception {
        DecisionState state = new DecisionState(buildPerfectInitData());
        Map<String, Object> result = validateNode.apply(state);

        assertEquals("", result.get("errorMsg"), "所有必填项存在，errorMsg 应该为空");
    }

    /**
     * 测试场景 2：大模型只生成了 1 个方案（PRD 约束是 2-3 个）。
     * 预期：返回包含 "必须包含2到3个候选方案" 的 errorMsg，触发图引擎路由至 RepairNode。
     */
    @Test
    void testValidate_MissingOptions_ShouldReturnErrorMsg() throws Exception {
        Map<String, Object> initData = buildPerfectInitData();

        // 故意只保留 1 个方案
        @SuppressWarnings("unchecked")
        List<Option> options = (List<Option>) initData.get("options");
        initData.put("options", options.subList(0, 1));

        DecisionState state = new DecisionState(initData);
        Map<String, Object> result = validateNode.apply(state);

        assertTrue(result.containsKey("errorMsg"));
        String errorMsg = (String) result.get("errorMsg");
        assertTrue(errorMsg.contains("必须包含2到3个候选方案"), "错误信息应该指出方案数量不足");
    }

    /**
     * 测试场景 3：大模型生成的 options 数量是对的，但是某个 option 漏打了 feasibility（可行性）分数。
     * 预期：返回包含 "options[0].scores.feasibility" 的 errorMsg。
     */
    @Test
    void testValidate_MissingScores_ShouldReturnErrorMsg() throws Exception {
        Map<String, Object> initData = buildPerfectInitData();

        // 故意删掉第 1 个方案的 feasibility 分数
        @SuppressWarnings("unchecked")
        List<Option> options = (List<Option>) initData.get("options");
        options.get(0).getScores().remove("feasibility");

        DecisionState state = new DecisionState(initData);
        Map<String, Object> result = validateNode.apply(state);

        assertTrue(result.containsKey("errorMsg"));
        String errorMsg = (String) result.get("errorMsg");
        assertTrue(errorMsg.contains("options[0].scores.feasibility"), "错误信息应精确定位到缺少的打分维度");
    }

    /**
     * 测试场景 4：经过了 RepairNode 抢救（即传入的 retryCount >= 1），但修复后的数据依然缺少字段。
     * 预期：必须抛出带有 "彻底失败" 字眼的 RuntimeException。
     */
    @Test
    void testValidate_RetryCountExceeded_ShouldThrowException() {
        Map<String, Object> initData = buildPerfectInitData();
        initData.put("understanding", ""); // 故意设为空，制造校验失败
        initData.put("retryCount", 1);     // 模拟已经重试过一次

        DecisionState state = new DecisionState(initData);

        RuntimeException exception = assertThrows(
            RuntimeException.class,
            () -> validateNode.apply(state),
            "重试次数到达上限，必须抛出异常结束工作流"
        );

        assertTrue(exception.getMessage().contains("彻底失败"), "异常信息中应该包含 '彻底失败' 提示词");
    }

    /**
     * 测试场景 5：因素缺少 name（PRD 4.2 要求每项含 id/name/weight/description）。
     * 预期：返回包含 "factors[0].name" 的 errorMsg。
     */
    @Test
    void testValidate_MissingFactorName_ShouldReturnErrorMsg() throws Exception {
        Map<String, Object> initData = buildPerfectInitData();

        @SuppressWarnings("unchecked")
        List<Factor> factors = (List<Factor>) initData.get("factors");
        factors.get(0).setName("");

        DecisionState state = new DecisionState(initData);
        Map<String, Object> result = validateNode.apply(state);

        assertTrue(result.containsKey("errorMsg"));
        assertTrue(((String) result.get("errorMsg")).contains("factors[0].name"));
    }

    /**
     * 测试场景 6：五维分数超出 1-5 值域（PRD 4.3 要求均为 1-5）。
     * 预期：返回包含 "options[0].scores.cost" 的 errorMsg。
     */
    @Test
    void testValidate_ScoreOutOfRange_ShouldReturnErrorMsg() throws Exception {
        Map<String, Object> initData = buildPerfectInitData();

        @SuppressWarnings("unchecked")
        List<Option> options = (List<Option>) initData.get("options");
        options.get(0).getScores().put("cost", 8);

        DecisionState state = new DecisionState(initData);
        Map<String, Object> result = validateNode.apply(state);

        assertTrue(result.containsKey("errorMsg"));
        assertTrue(((String) result.get("errorMsg")).contains("options[0].scores.cost"));
    }

    /**
     * 测试场景 7：推荐方案指向不存在的方案 id（PRD 4.2 要求推荐必须引用候选方案之一）。
     * 预期：返回包含 "recommendation.optionId" 的 errorMsg。
     */
    @Test
    void testValidate_RecommendationNotReferencingOption_ShouldReturnErrorMsg() throws Exception {
        Map<String, Object> initData = buildPerfectInitData();

        AnalysisResultDto.Recommendation rec =
                (AnalysisResultDto.Recommendation) initData.get("recommendation");
        rec.setOptionId("opt_999");

        DecisionState state = new DecisionState(initData);
        Map<String, Object> result = validateNode.apply(state);

        assertTrue(result.containsKey("errorMsg"));
        assertTrue(((String) result.get("errorMsg")).contains("recommendation.optionId"));
    }

    /**
     * 测试场景 8：推荐理由缺失（PRD 4.2 recommendation 含 optionId 和 reason）。
     * 预期：返回包含 "recommendation.reason" 的 errorMsg。
     */
    @Test
    void testValidate_MissingRecommendationReason_ShouldReturnErrorMsg() throws Exception {
        Map<String, Object> initData = buildPerfectInitData();

        AnalysisResultDto.Recommendation rec =
                (AnalysisResultDto.Recommendation) initData.get("recommendation");
        rec.setReason("  ");

        DecisionState state = new DecisionState(initData);
        Map<String, Object> result = validateNode.apply(state);

        assertTrue(result.containsKey("errorMsg"));
        assertTrue(((String) result.get("errorMsg")).contains("recommendation.reason"));
    }
}
