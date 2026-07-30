package qg.po.midterm.service.impl;

import org.springframework.stereotype.Service;
import qg.po.midterm.service.AnalysisTaskService;
import qg.po.midterm.vo.AnalysisLogVO;
import qg.po.midterm.vo.AnalysisTaskVO;
import qg.po.midterm.vo.CreateTaskVO;
import qg.po.midterm.vo.RetryStepVO;

import java.util.List;

/**
 * 分析任务服务的默认实现。
 */
@Service
public class AnalysisTaskServiceImpl implements AnalysisTaskService {

    @Override
    public CreateTaskVO startFullAnalysis(String decisionId, String idempotencyKey) {
        return null;
    }

    @Override
    public AnalysisTaskVO getTask(String taskId) {
        return null;
    }

    @Override
    public List<AnalysisLogVO> getTaskLogs(String taskId, String afterEventId, int limit) {
        return null;
    }

    @Override
    public RetryStepVO retryStep(String taskId, String stepId) {
        return null;
    }
}
