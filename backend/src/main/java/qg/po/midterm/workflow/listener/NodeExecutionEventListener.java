package qg.po.midterm.workflow.listener;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import tools.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import qg.po.midterm.common.enums.DecisionStatus;
import qg.po.midterm.common.enums.ErrorCode;
import qg.po.midterm.dto.result.AnalysisResultDto;
import qg.po.midterm.dto.result.Canvas;
import qg.po.midterm.entity.*;
import qg.po.midterm.mapper.*;
import qg.po.midterm.service.AnalysisEventService;
import qg.po.midterm.service.impl.CanvasMergeService;
import qg.po.midterm.workflow.event.NodeExecutionEvent;
import qg.po.midterm.workflow.event.WorkflowCompletedEvent;
import qg.po.midterm.workflow.event.WorkflowFailedEvent;
import qg.po.midterm.workflow.utils.WorkflowErrorMessageResolver;
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
    private final DecisionCanvasMapper canvasMapper;
    private final AnalysisResultMapper resultMapper;
    private final AnalysisEventService eventService;
    private final ObjectMapper objectMapper;
    private final CanvasMergeService canvasMergeService;
    private final StepDisplayUtils stepDisplayUtils;

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
        if (task == null || !"RUNNING".equals(task.getStatus())) return;

        LocalDateTime now = LocalDateTime.now();
        Decision decision = decisionMapper.selectById(task.getDecisionId());
        if (decision == null) return;

        AnalysisResultDto resultDto;
        String resultJson;
        Canvas mergedCanvas;
        try {
            resultDto = objectMapper.convertValue(event.getFinalStateData(), AnalysisResultDto.class);
            Canvas existingCanvas = readCanvas(task.getDecisionId());
            mergedCanvas = canvasMergeService.merge(existingCanvas, resultDto, decision.getTitle());
            resultDto.setCanvas(mergedCanvas);
            resultJson = objectMapper.writeValueAsString(resultDto);
        } catch (Exception exception) {
            throw new IllegalStateException("最终分析结果序列化失败", exception);
        }

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
        result.setResultData(resultJson);
        result.setCreatedAt(now);
        result.setUpdatedAt(now);
        resultMapper.insert(result);

        // 3. 更新 Decision 状态
        String decisionStatus = resolveCompletedDecisionStatus(task);
        if (decision != null) {
            decision.setStatus(decisionStatus);
            decision.setHasPendingResult(true);
            decision.setPendingResultId(result.getId());
            decision.setUpdatedAt(now);
            decisionMapper.updateById(decision);
        }
        saveCanvas(task.getDecisionId(), mergedCanvas, now);

        // 4. 通知前端结果已就绪
        Map<String, Object> sseData = new LinkedHashMap<>();
        sseData.put("taskId", "t_" + task.getId());
        sseData.put("decisionId", "d_" + task.getDecisionId());
        sseData.put("analysisResultId", "ar_" + result.getId());
        sseData.put("decisionStatus", decisionStatus);
        sseData.put("resultStatus", "PENDING_CONFIRM");
        String externalTaskId = "t_" + task.getId();
        sendAfterCommit(() -> eventService.sendResultReady(externalTaskId, sseData));
    }

    @EventListener
    @Transactional
    public void handleWorkflowFailed(WorkflowFailedEvent event) {
        Long taskDbId = parseTaskId(event.getTaskId());
        AnalysisTask task = (taskDbId != null) ? taskMapper.selectById(taskDbId) : null;
        if (task != null && "RUNNING".equals(task.getStatus())) {
            failTask(task, null, event.getErrorMessage(), event.getException());
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
        if (!"RUNNING".equals(task.getStatus())) {
            return;
        }
        Long taskDbId = task.getId();

        // 如果是修复节点，不展示，但是如果判断修复失败，直接标记为任务失败
        if ("Repair".equals(event.getNodeName())) {
            if ("FAILED".equals(event.getStatus())) {
                failTask(task, null, event.getErrorMessage(), event.getException());
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

                    String externalTaskId = "t_" + task.getId();
                    sendAfterCommit(() -> eventService.sendToolCall(externalTaskId, sseData));
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
            failTask(task, step, event.getErrorMessage(), event.getException());
        } else {
            return;
        }

        sendAfterCommit(() -> sendStepUpdate(task, step));
    }

    /**
     * 同时标记步骤和任务失败，并通知前端
     */
    private void failTask(
            AnalysisTask task,
            AnalysisStep step,
            String message,
            Exception exception) {
        LocalDateTime now = LocalDateTime.now();
        Exception rootException = unwrap(exception);
        String clientMessage = WorkflowErrorMessageResolver.toClientMessage(exception);
        if (step == null) {
            step = resolveFailureStep(task, rootException);
        }

        if (step != null) {
            step.setStatus("FAILED");
            step.setErrorMessage(clientMessage);
            step.setOutputData(null);
            step.setFinishedAt(now);
            step.setUpdatedAt(now);
            stepMapper.updateById(step);
            resetDownstreamSteps(task.getId(), step.getStepOrder(), now);
        }

        qg.po.midterm.common.exception.AiValidationException aiException =
                rootException instanceof qg.po.midterm.common.exception.AiValidationException value
                        ? value : null;
        int errorCode = aiException == null
                ? ErrorCode.INTERNAL_ERROR.getCode()
                : ErrorCode.AI_VALIDATION_FAILED.getCode();
        boolean retryable = step != null;

        task.setStatus("FAILED");
        task.setErrorMessage(clientMessage);
        task.setErrorCode(errorCode);
        task.setMissingFields(writeMissingFields(aiException));
        task.setRepairAttempted(aiException != null && aiException.isRepairAttempted());
        task.setRetryable(retryable);
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
        data.put("errorCode", errorCode);
        data.put("message", clientMessage);
        data.put("failedStepId", step == null ? null : "s_" + step.getId());
        data.put("retryable", retryable);

        if (aiException != null) {
            data.put("missingFields", aiException.getMissingFields());
            data.put("repairAttempted", aiException.isRepairAttempted());
        }

        sendAfterCommit(() -> eventService.sendTaskFailed("t_" + task.getId(), data));
    }

    private AnalysisStep resolveFailureStep(AnalysisTask task, Exception exception) {
        if (exception instanceof qg.po.midterm.common.exception.AiValidationException aiException
                && aiException.getMissingFields() != null && !aiException.getMissingFields().isEmpty()) {
            String targetName = mapMissingFieldsToStep(aiException.getMissingFields());
            AnalysisStep target = stepMapper.selectOne(new LambdaQueryWrapper<AnalysisStep>()
                    .eq(AnalysisStep::getRunId, task.getId())
                    .eq(AnalysisStep::getStepName, targetName)
                    .last("LIMIT 1"));
            if (target != null) return target;
        }
        List<AnalysisStep> running = stepMapper.selectList(new LambdaQueryWrapper<AnalysisStep>()
                .eq(AnalysisStep::getRunId, task.getId())
                .eq(AnalysisStep::getStatus, "RUNNING")
                .orderByDesc(AnalysisStep::getStepOrder));
        if (!running.isEmpty()) return running.get(0);
        if (task.getCurrentStep() != null && task.getCurrentStep() > 0) {
            return stepMapper.selectOne(new LambdaQueryWrapper<AnalysisStep>()
                    .eq(AnalysisStep::getRunId, task.getId())
                    .eq(AnalysisStep::getStepOrder, task.getCurrentStep())
                    .last("LIMIT 1"));
        }
        return stepMapper.selectOne(new LambdaQueryWrapper<AnalysisStep>()
                .eq(AnalysisStep::getRunId, task.getId())
                .ne(AnalysisStep::getStatus, "SUCCEEDED")
                .orderByAsc(AnalysisStep::getStepOrder)
                .last("LIMIT 1"));
    }

    private String mapMissingFieldsToStep(List<String> missingFields) {
        int earliest = 4;
        for (String field : missingFields) {
            if (field == null) continue;
            if (field.startsWith("understanding")) earliest = Math.min(earliest, 1);
            else if (field.startsWith("factors")) earliest = Math.min(earliest, 2);
            else if (field.startsWith("options")) earliest = Math.min(earliest, 3);
            else if (field.startsWith("recommendation") || field.startsWith("nextActions")) {
                earliest = Math.min(earliest, 4);
            }
        }
        return switch (earliest) {
            case 1 -> "UNDERSTAND";
            case 2 -> "EXTRACT_FACTORS";
            case 3 -> "GENERATE_OPTIONS";
            default -> "COMPARE_OPTIONS";
        };
    }

    private void resetDownstreamSteps(Long taskId, Integer failedOrder, LocalDateTime now) {
        List<AnalysisStep> downstream = stepMapper.selectList(new LambdaQueryWrapper<AnalysisStep>()
                .eq(AnalysisStep::getRunId, taskId)
                .gt(AnalysisStep::getStepOrder, failedOrder));
        for (AnalysisStep item : downstream) {
            item.setStatus("WAITING");
            item.setOutputData(null);
            item.setErrorMessage(null);
            item.setStartedAt(null);
            item.setFinishedAt(null);
            item.setUpdatedAt(now);
            stepMapper.updateById(item);
        }
    }

    private Exception unwrap(Exception exception) {
        if (exception == null) return null;
        Throwable current = exception;
        while (current.getCause() != null && current.getCause() != current) current = current.getCause();
        return current instanceof Exception value ? value : exception;
    }

    private String writeMissingFields(qg.po.midterm.common.exception.AiValidationException exception) {
        if (exception == null || exception.getMissingFields() == null) return null;
        try {
            return objectMapper.writeValueAsString(exception.getMissingFields());
        } catch (Exception ignored) {
            return null;
        }
    }

    private Canvas readCanvas(Long decisionId) {
        DecisionCanvas canvas = canvasMapper.selectOne(new LambdaQueryWrapper<DecisionCanvas>()
                .eq(DecisionCanvas::getDecisionId, decisionId)
                .last("LIMIT 1"));
        if (canvas == null || canvas.getCanvasData() == null || canvas.getCanvasData().isBlank()) return null;
        try {
            return objectMapper.readValue(canvas.getCanvasData(), Canvas.class);
        } catch (Exception exception) {
            log.warn("Ignoring invalid saved canvas for decision {}", decisionId, exception);
            return null;
        }
    }

    private void saveCanvas(Long decisionId, Canvas mergedCanvas, LocalDateTime now) {
        try {
            String json = objectMapper.writeValueAsString(mergedCanvas);
            DecisionCanvas existing = canvasMapper.selectOne(new LambdaQueryWrapper<DecisionCanvas>()
                    .eq(DecisionCanvas::getDecisionId, decisionId)
                    .last("LIMIT 1"));
            if (existing == null) {
                existing = new DecisionCanvas();
                existing.setDecisionId(decisionId);
                existing.setCanvasData(json);
                existing.setVersion(1);
                existing.setCreatedAt(now);
                existing.setUpdatedAt(now);
                canvasMapper.insert(existing);
            } else {
                existing.setCanvasData(json);
                existing.setVersion(existing.getVersion() == null ? 1 : existing.getVersion() + 1);
                existing.setUpdatedAt(now);
                canvasMapper.updateById(existing);
            }
        } catch (Exception exception) {
            throw new IllegalStateException("画布同步失败", exception);
        }
    }

    private void sendAfterCommit(Runnable action) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            action.run();
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                action.run();
            }
        });
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

        StepDisplayUtils.StepDisplay display = stepDisplayUtils.parseDisplay(
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
