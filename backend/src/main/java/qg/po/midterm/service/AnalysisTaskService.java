package qg.po.midterm.service;

import qg.po.midterm.dto.request.PartialAnalysisRequest;
import qg.po.midterm.vo.AnalysisTaskVO;
import qg.po.midterm.vo.CreateTaskVO;
import qg.po.midterm.vo.PartialTaskVO;
import qg.po.midterm.vo.RetryStepVO;

/**
 * 分析任务业务接口。
 */
public interface AnalysisTaskService {

    CreateTaskVO startFullAnalysis(String decisionId);

    PartialTaskVO startPartialAnalysis(String decisionId, PartialAnalysisRequest request);

    AnalysisTaskVO getTask(String taskId);

    RetryStepVO retryStep(String taskId, String stepId);
}
