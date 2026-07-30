package qg.po.midterm.workflow.node;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bsc.langgraph4j.action.NodeAction;
import org.springframework.stereotype.Component;
import qg.po.midterm.workflow.state.DecisionState;
import qg.po.midterm.workflow.state.Factor;
import qg.po.midterm.workflow.state.Option;
import qg.po.midterm.dto.result.AnalysisResultDto;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** 工作流节点：内部拦截校验节点。不向外抛出事件，用于拦截校验错误并触发重试。 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ValidateNode implements NodeAction<DecisionState> {

    @Override
    public Map<String, Object> apply(DecisionState state) throws Exception {
        log.info("Node [ValidateNode] executing for decision: {}", state.getDecisionId());

        // -----------------------------------------------------------------------------------
        // 第一阶段：执行严格的字段审查（对应 PRD 12.1）
        // -----------------------------------------------------------------------------------
        List<String> missingFields = new ArrayList<>();

        if (state.getUnderstanding() == null || state.getUnderstanding().trim().isEmpty()) {
            missingFields.add("understanding (不可为空)");
        }
        
        List<Factor> factors = state.getFactors();
        if (factors == null || factors.isEmpty()) {
            missingFields.add("factors (至少需要1个因素)");
        }
        
        List<Option> options = state.getOptions();
        if (options == null || options.size() < 2 || options.size() > 3) {
            missingFields.add("options (必须包含2到3个候选方案)");
        } else {
            for (int i = 0; i < options.size(); i++) {
                Option opt = options.get(i);
                if (opt.getScores() == null) {
                    missingFields.add("options[" + i + "].scores (五维评分缺失)");
                } else {
                    Map<String, Integer> scores = opt.getScores();
                    String[] requiredScores = {"cost", "time", "benefit", "risk", "feasibility"};
                    for (String key : requiredScores) {
                        if (!scores.containsKey(key) || scores.get(key) == null) {
                            missingFields.add("options[" + i + "].scores." + key + " (评分项缺失)");
                        }
                    }
                }
            }
        }
        
        AnalysisResultDto.Recommendation rec = state.getRecommendation();
        if (rec == null || rec.getOptionId() == null || rec.getOptionId().trim().isEmpty()) {
            missingFields.add("recommendation.optionId (推荐方案ID缺失)");
        }
        
        List<String> nextActions = state.getNextActions();
        if (nextActions == null || nextActions.isEmpty()) {
            missingFields.add("nextActions (下一步行动建议不可为空)");
        }

        int retryCount = state.getRetryCount();

        // -----------------------------------------------------------------------------------
        // 第二阶段：根据审查结果决定命运 (放行 / 驳回修复 / 彻底封杀)
        // -----------------------------------------------------------------------------------
        if (!missingFields.isEmpty()) {
            String errorDetails = "校验失败，缺少以下必填项:\n" + String.join("\n- ", missingFields);
            log.warn(">>> [ValidateNode] 发现不合法结构: \n{}", errorDetails);
            
            if (retryCount >= 1) {
                // 彻底封杀：已经给过一次机会（被 RepairNode 抢救过），依然不合格。
                // 抛出异常会直接中止整个工作流任务，抛给上层统一异常处理，标记状态为 FAILED (42201)。
                log.error(">>> [ValidateNode] 一次修复失败，任务彻底终止！");
                throw new RuntimeException("AI 分析结果结构校验彻底失败: " + errorDetails);
            } else {
                // 驳回修复：第一次犯错，把错题本（errorMsg）存入状态。
                // 图引擎（DecisionWorkflow）的条件路由发现 errorMsg 不为空，会自动将其踢到 RepairNode。
                return Map.of("errorMsg", errorDetails);
            }
        }
        
        // 绿灯放行：完全符合结构，清空 errorMsg（尤其是在被 RepairNode 修复成功的情况下），图引擎会流向 GENERATE_REPORT。
        log.info(">>> [ValidateNode] 校验完美通过！");
        return Map.of("errorMsg", "");
    }
}
