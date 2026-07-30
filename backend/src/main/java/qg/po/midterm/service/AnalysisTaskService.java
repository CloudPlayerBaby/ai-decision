package qg.po.midterm.service;

import qg.po.midterm.vo.AnalysisLogVO;
import qg.po.midterm.vo.AnalysisTaskVO;
import qg.po.midterm.vo.CreateTaskVO;
import qg.po.midterm.vo.RetryStepVO;

import java.util.List;

/**
 * 分析任务应用服务。具体的持久化、并发冲突和重试规则由实现类负责。
 */
public interface AnalysisTaskService {

    CreateTaskVO startFullAnalysis(String decisionId, String idempotencyKey);

    AnalysisTaskVO getTask(String taskId);

    List<AnalysisLogVO> getTaskLogs(String taskId, String afterEventId, int limit);

    RetryStepVO retryStep(String taskId, String stepId);
}
