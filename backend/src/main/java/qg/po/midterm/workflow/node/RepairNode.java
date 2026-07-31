package qg.po.midterm.workflow.node;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bsc.langgraph4j.action.NodeAction;
import org.springframework.stereotype.Component;
import qg.po.midterm.workflow.AnalysisResultRepairer;
import qg.po.midterm.dto.result.AnalysisResultDto;
import qg.po.midterm.workflow.state.DecisionState;

import java.util.List;
import java.util.Map;

/** 工作流节点：接收 ValidateNode 打回的错题本 (errorMsg)，带原 JSON 交给 AI 修复一次。 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RepairNode implements NodeAction<DecisionState> {

    private final AnalysisResultRepairer resultRepairer;

    @Override
    public Map<String, Object> apply(DecisionState state) throws Exception {
        // 注：遵循 PRD 12 节，Repair 节点为引擎内部节点，不抛出 NodeExecutionEvent。
        log.info("Node [Repair] executing for decision: {}", state.getDecisionId());

        // 把之前大模型写错的结构化数据 + 错误提示，原样交给修复组件请求 AI 修补
        AnalysisResultDto broken = new AnalysisResultDto();
        broken.setUnderstanding(state.getUnderstanding());
        broken.setFactors(state.getFactors());
        broken.setOptions(state.getOptions());
        broken.setRecommendation(state.getRecommendation());
        broken.setNextActions(state.getNextActions());

        AnalysisResultDto repaired = resultRepairer.repair(state.getErrorMsg(), broken);

        int retryCount = state.getRetryCount();

        // 修复后清空 errorMsg，流转回 ValidateNode 进行二次校验
        return Map.of(
                "understanding", repaired.getUnderstanding() != null ? repaired.getUnderstanding() : "",
                "factors", repaired.getFactors() != null ? repaired.getFactors() : List.of(),
                "options", repaired.getOptions() != null ? repaired.getOptions() : List.of(),
                "recommendation", repaired.getRecommendation() != null
                        ? repaired.getRecommendation()
                        : new AnalysisResultDto.Recommendation(),
                "nextActions", repaired.getNextActions() != null ? repaired.getNextActions() : List.of(),
                "retryCount", retryCount + 1,
                "errorMsg", ""
        );
    }
}
