package qg.po.midterm.service;

import qg.po.midterm.vo.AnalysisTaskVO;
import qg.po.midterm.vo.CreateTaskVO;
import qg.po.midterm.vo.RetryStepVO;

/**
 * 分析任务业务接口。
 */
public interface AnalysisTaskService {

    CreateTaskVO startFullAnalysis(String decisionId);

    AnalysisTaskVO getTask(String taskId);

    RetryStepVO retryStep(String taskId, String stepId);
}
