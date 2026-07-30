package qg.po.midterm.service;

import qg.po.midterm.dto.request.CreateDecisionRequest;
import qg.po.midterm.vo.DecisionDetailVO;
import qg.po.midterm.vo.DecisionVO;
import qg.po.midterm.vo.PageVO;

/**
 * 决策问题服务接口（API v2.0 第 6 节）
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
}
