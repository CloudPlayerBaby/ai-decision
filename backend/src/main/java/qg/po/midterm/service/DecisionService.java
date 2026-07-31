package qg.po.midterm.service;

import qg.po.midterm.dto.request.ConfirmDecisionRequest;
import qg.po.midterm.dto.request.CreateDecisionRequest;
import qg.po.midterm.dto.request.PreferredOptionRequest;
import qg.po.midterm.dto.request.SaveCanvasRequest;
import qg.po.midterm.dto.result.Canvas;
import qg.po.midterm.vo.*;

/**
 * 决策问题服务接口（API v2.0 第 6、9、10 节）
 *
 * <p>10.3 局部重推由 AnalysisTaskService 负责，见 AnalysisEventController</p>
 */
public interface DecisionService {

    /** 6.1 创建决策问题 */
    DecisionVO create(CreateDecisionRequest request);

    /** 6.2 分页查询决策问题列表，支持按状态和关键词筛选 */
    PageVO<DecisionVO> list(int page, int pageSize, String status, String keyword);

    /** 6.3 查询决策问题详情 */
    DecisionDetailVO getDetail(String decisionId);

    /** 6.4 删除决策问题 */
    void delete(String decisionId);

    /** 9.1 获取分析结果（待确认或已确认） */
    AnalysisResultVO getAnalysisResult(String decisionId, String resultId);

    /** 9.2 选择倾向方案（不生成报告） */
    void setPreferredOption(String decisionId, PreferredOptionRequest request);

    /** 9.3 确认分析并生成报告 */
    ConfirmResultVO confirm(String decisionId, ConfirmDecisionRequest request);

    /** 10.1 获取决策画布 */
    Canvas getCanvas(String decisionId);

    /** 10.2 保存画布编辑，返回变更节点ID列表 */
    SaveCanvasVO saveCanvas(String decisionId, SaveCanvasRequest request);
}
