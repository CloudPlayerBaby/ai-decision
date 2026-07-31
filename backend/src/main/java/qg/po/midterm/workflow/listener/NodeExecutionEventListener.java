package qg.po.midterm.workflow.listener;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import qg.po.midterm.common.enums.ErrorCode;
import qg.po.midterm.common.enums.DecisionStatus;
import qg.po.midterm.entity.AnalysisResult;
import qg.po.midterm.entity.AnalysisStep;
import qg.po.midterm.entity.AnalysisTask;
import qg.po.midterm.entity.Decision;
import qg.po.midterm.mapper.AnalysisResultMapper;
import qg.po.midterm.mapper.AnalysisStepMapper;
import qg.po.midterm.mapper.AnalysisTaskMapper;
import qg.po.midterm.mapper.DecisionMapper;
import qg.po.midterm.service.AnalysisEventService;
import qg.po.midterm.workflow.event.NodeExecutionEvent;
import qg.po.midterm.workflow.event.WorkflowCompletedEvent;
import qg.po.midterm.workflow.event.WorkflowFailedEvent;
import com.fasterxml.jackson.databind.ObjectMapper;
import qg.po.midterm.workflow.utils.StepDisplayUtils;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 把 Workflow 节点事件转换成数据库状态和 SSE 事件
 */
@Component
@RequiredArgsConstructor
@lombok.extern.slf4j.Slf4j
public class NodeExecutionEventListener {

    private final AnalysisTaskMapper taskMapper;
    private final AnalysisStepMapper stepMapper;
    private final DecisionMapper decisionMapper;
    private final AnalysisResultMapper resultMapper;
    private final AnalysisEventService eventService;
    private final ObjectMapper objectMapper;

    @EventListener
    @Transactional
    public void handleWorkflowCompleted(WorkflowCompletedEvent event) {
        Long taskDbId = parseTaskId(event.getTaskId());
        AnalysisTask task = (taskDbId != null) ? taskMapper.selectById(taskDbId) : null;
        if (task == null) {
            Long decisionDbId = parseDecisionId(event.getDecisionId());
            if (decisionDbId != null) {
                Decision decision = decisionMapper.selectById(decisionDbId);
                if (decision != null && decision.getLatestTaskId() != null) {
                    task = taskMapper.selectById(decision.getLatestTaskId());
                }
            }
        }
        if (task == null) return;

        LocalDateTime now = LocalDateTime.now();

        // 1. 标记任务成功
        task.setStatus("SUCCEEDED");
        task.setCurrentStep(task.getTotalSteps());
        task.setFinishedAt(now);
        task.setUpdatedAt(now);
        taskMapper.updateById(task);

        // 2. 生成 AnalysisResult
        AnalysisResult result = new AnalysisResult();
        result.setDecisionId(task.getDecisionId());
        result.setTaskId(task.getId());
        result.setStatus("PENDING_CONFIRM");
        try {
            result.setResultData(objectMapper.writeValueAsString(event.getFinalStateData()));
        } catch (Exception e) {
            log.error("Failed to serialize final state data", e);
            result.setResultData("{}");
        }
        result.setCreatedAt(now);
        result.setUpdatedAt(now);
        resultMapper.insert(result);

        // 3. 更新 Decision 状态
        Decision decision = decisionMapper.selectById(task.getDecisionId());
        String decisionStatus = resolveCompletedDecisionStatus(task);
        if (decision != null) {
            decision.setStatus(decisionStatus);
            decision.setHasPendingResult(true);
            decision.setPendingResultId(result.getId());
            decision.setUpdatedAt(now);
            decisionMapper.updateById(decision);
        }

        // 4. 通知前端结果已就绪
        Map<String, Object> sseData = new LinkedHashMap<>();
        sseData.put("taskId", "t_" + task.getId());
        sseData.put("decisionId", "d_" + task.getDecisionId());
        sseData.put("analysisResultId", "ar_" + result.getId());
        sseData.put("decisionStatus", decisionStatus);
        sseData.put("resultStatus", "PENDING_CONFIRM");
        eventService.sendResultReady("t_" + task.getId(), sseData);
    }

    @EventListener
    @Transactional
    public void handleWorkflowFailed(WorkflowFailedEvent event) {
        Long taskDbId = parseTaskId(event.getTaskId());
        AnalysisTask task = (taskDbId != null) ? taskMapper.selectById(taskDbId) : null;
        if (task != null) {
            failTask(task, null, event.getErrorMessage());
        }
    }

    @EventListener
    @Transactional
    public void handle(NodeExecutionEvent event) {
        // 通过event里面的taskId找到对应的task
        AnalysisTask task = findDatabaseTask(event);
        if (task == null) {
            return;
        }
        Long taskDbId = task.getId();

        // 如果是修复节点，不展示，但是如果判断修复失败，直接标记为任务失败
        if ("Repair".equals(event.getNodeName())) {
            if ("FAILED".equals(event.getStatus())) {
                failTask(task, null, event.getErrorMessage());
            }
            return;
        }

        // 把 workflow 里面的名转换成我们需要的名称
        String stepName = getStepName(event.getNodeName());
        // 没有的话就是 tool call 节点
        if (stepName == null) {
            if ("ToolCall".equals(event.getNodeName())) {
                try {
                    Map<String, Object> toolData = objectMapper.readValue(event.getOutputData(), Map.class);
                    Map<String, Object> sseData = new LinkedHashMap<>();
                    sseData.put("taskId", "t_" + task.getId());
                    sseData.put("toolName", toolData.get("toolName"));
                    sseData.put("status", event.getStatus());
                    sseData.put("inputSummary", toolData.get("inputSummary"));
                    sseData.put("outputSummary", toolData.get("outputSummary"));
                    
                    eventService.sendToolCall("t_" + task.getId(), sseData);
                } catch (Exception e) {
                    log.error("Failed to parse tool call event data", e);
                }
            }
            return;
        }

        // 从数据库查询 step
        AnalysisStep step = stepMapper.selectOne(
                new LambdaQueryWrapper<AnalysisStep>()
                        .eq(AnalysisStep::getRunId, taskDbId)
                        .eq(AnalysisStep::getStepName, stepName)
                        .last("LIMIT 1")
        );
        if (step == null) {
            return;
        }

        LocalDateTime now = LocalDateTime.now();

        if ("RUNNING".equals(event.getStatus())) {
            step.setStatus("RUNNING");
            step.setStartedAt(now);
            step.setUpdatedAt(now);
            stepMapper.updateById(step);

            task.setStatus("RUNNING");
            task.setCurrentStep(step.getStepOrder());
            task.setUpdatedAt(now);
            taskMapper.updateById(task);
        } else if ("SUCCEEDED".equals(event.getStatus())) {
            step.setStatus("SUCCEEDED");
            step.setFinishedAt(now);
            step.setUpdatedAt(now);
            if (event.getOutputData() != null) {
                step.setOutputData(event.getOutputData());
            }
            stepMapper.updateById(step);
        } else if ("FAILED".equals(event.getStatus())) {
            failTask(task, step, event.getErrorMessage());
        } else {
            return;
        }

        sendStepUpdate(task, step);
    }

    /**
     * 同时标记步骤和任务失败，并通知前端
     */
    private void failTask(
            AnalysisTask task,
            AnalysisStep step,
            String message) {
        LocalDateTime now = LocalDateTime.now();

        if (step != null) {
            step.setStatus("FAILED");
            step.setErrorMessage(message);
            step.setFinishedAt(now);
            step.setUpdatedAt(now);
            stepMapper.updateById(step);
        }

        task.setStatus("FAILED");
        task.setErrorMessage(message);
        task.setFinishedAt(now);
        task.setUpdatedAt(now);
        taskMapper.updateById(task);

        Decision decision = decisionMapper.selectById(task.getDecisionId());
        if (decision != null) {
            decision.setStatus(resolveFailedDecisionStatus(task));
            decision.setUpdatedAt(now);
            decisionMapper.updateById(decision);
        }

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("errorCode", ErrorCode.INTERNAL_ERROR.getCode());
        data.put("message", message);
        data.put("failedStepId", step == null ? null : "s_" + step.getId());
        data.put("retryable", step != null);
        eventService.sendTaskFailed("t_" + task.getId(), data);
    }

    private String resolveCompletedDecisionStatus(AnalysisTask task) {
        if ("PARTIAL".equals(task.getRunType())
                && DecisionStatus.COMPLETED.name().equals(task.getPreviousDecisionStatus())) {
            return DecisionStatus.COMPLETED.name();
        }
        return DecisionStatus.WAITING_CONFIRM.name();
    }

    private String resolveFailedDecisionStatus(AnalysisTask task) {
        String previousStatus = task.getPreviousDecisionStatus();
        if ("PARTIAL".equals(task.getRunType())
                && (DecisionStatus.WAITING_CONFIRM.name().equals(previousStatus)
                || DecisionStatus.COMPLETED.name().equals(previousStatus))) {
            return task.getPreviousDecisionStatus();
        }
        return DecisionStatus.FAILED.name();
    }

    /**
     * 发送文档规定的 step_update
     */
    private void sendStepUpdate(AnalysisTask task, AnalysisStep step) {
        List<AnalysisStep> steps = stepMapper.selectList(
                new LambdaQueryWrapper<AnalysisStep>()
                        .eq(AnalysisStep::getRunId, task.getId())
        );

        long successCount = steps.stream()
                .filter(item -> "SUCCEEDED".equals(item.getStatus()))
                .count();
        int progress = steps.isEmpty()
                ? 0
                : (int) (successCount * 100 / steps.size());

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("taskId", "t_" + task.getId());
        data.put("stepId", "s_" + step.getId());
        data.put("status", step.getStatus());
        
        StepDisplayUtils.StepDisplay display = StepDisplayUtils.parseDisplay(
                step.getStepName(), step.getStatus(), step.getOutputData(), step.getErrorMessage());

        data.put("summary", display.summary());
        data.put("content", display.content());
        data.put("progress", progress);
        data.put("occurredAt", OffsetDateTime.now());
        eventService.sendStepUpdate("t_" + task.getId(), data);
    }

    /**
     * Workflow 节点名转换为 API 步骤名
     */
    private String getStepName(String nodeName) {
        return switch (nodeName) {
            case "RequirementAnalysis" -> "UNDERSTAND";
            case "FactorAnalysis" -> "EXTRACT_FACTORS";
            case "OptionGeneration" -> "GENERATE_OPTIONS";
            case "RiskAnalysis" -> "COMPARE_OPTIONS";
            default -> null;
        };
    }

    private Long parseTaskId(String taskId) {
        if (taskId == null || !taskId.startsWith("t_")) {
            return null;
        }
        try {
            return Long.parseLong(taskId.substring(2));
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    /**
     * 数据库任务通过 decision.latestTaskId 找回，不要求修改 Workflow 接口
     */
    private AnalysisTask findDatabaseTask(NodeExecutionEvent event) {
        // 获取taskId
        Long taskDbId = parseTaskId(event.getTaskId());
        if (taskDbId != null) {
            return taskMapper.selectById(taskDbId);
        }

        // 找不到就用决策 ID
        Long decisionDbId = parseDecisionId(event.getDecisionId());
        if (decisionDbId == null) {
            return null;
        }
        Decision decision = decisionMapper.selectById(decisionDbId);
        if (decision == null || decision.getLatestTaskId() == null) {
            return null;
        }
        return taskMapper.selectById(decision.getLatestTaskId());
    }

    // 转化决策 ID，去除前面的 d_
    private Long parseDecisionId(String decisionId) {
        if (decisionId == null || !decisionId.startsWith("d_")) {
            return null;
        }
        try {
            return Long.parseLong(decisionId.substring(2));
        } catch (NumberFormatException exception) {
            return null;
        }
    }
}
