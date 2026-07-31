package qg.po.midterm.workflow.node;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bsc.langgraph4j.action.NodeAction;
import org.springframework.stereotype.Component;
import qg.po.midterm.dto.result.AnalysisResultDto;
import qg.po.midterm.workflow.state.DecisionState;
import qg.po.midterm.workflow.utils.AnalysisResultValidator;

import java.util.List;
import java.util.Map;

/** 工作流节点：内部拦截校验节点。不向外抛出事件，用于拦截校验错误并触发一次修复。 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ValidateNode implements NodeAction<DecisionState> {

    @Override
    public Map<String, Object> apply(DecisionState state) throws Exception {
        log.info("Node [ValidateNode] executing for decision: {}", state.getDecisionId());

        // 由状态流中的各字段组装为一份待校验的 AnalysisResult，规则统一走 AnalysisResultValidator
        AnalysisResultDto dto = new AnalysisResultDto();
        dto.setUnderstanding(state.getUnderstanding());
        dto.setFactors(state.getFactors());
        dto.setOptions(state.getOptions());
        dto.setRecommendation(state.getRecommendation());
        dto.setNextActions(state.getNextActions());

        List<String> missingFields = AnalysisResultValidator.validate(dto);

        int retryCount = state.getRetryCount();

        if (!missingFields.isEmpty()) {
            String errorDetails = "校验失败，以下字段缺失或非法:\n- " + String.join("\n- ", missingFields);
            log.warn(">>> [ValidateNode] 发现不合法结构: \n{}", errorDetails);

            if (retryCount >= 1) {
                // 已经给过一次机会（被 RepairNode 抢救过）依然不合格：彻底封杀，
                // 抛异常中止整个工作流，由上层统一处理并标记任务 FAILED (42201)。
                log.error(">>> [ValidateNode] 一次修复失败，任务彻底终止！");
                throw new RuntimeException("AI 分析结果结构校验彻底失败: " + errorDetails);
            }

            // 第一次犯错：把错题本（errorMsg）存入状态，图路由到 RepairNode 让 AI 带原 JSON 修复。
            return Map.of("errorMsg", errorDetails);
        }

        // 绿灯放行：清空 errorMsg（尤其是 RepairNode 修复成功的情况下），图引擎流向 END。
        log.info(">>> [ValidateNode] 校验完美通过！");
        return Map.of("errorMsg", "");
    }
}
