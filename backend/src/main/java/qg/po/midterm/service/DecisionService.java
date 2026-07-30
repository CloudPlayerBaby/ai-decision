package qg.po.midterm.service;

import qg.po.midterm.dto.request.CreateDecisionRequest;
import qg.po.midterm.vo.DecisionVO;

/**
 * 决策问题服务接口
 */
public interface DecisionService {

    /**
     * 创建决策问题，返回带格式化ID的视图
     */
    DecisionVO create(CreateDecisionRequest request);
}
