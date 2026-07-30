package qg.po.midterm.workflow.listener;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import qg.po.midterm.common.enums.ErrorCode;
import qg.po.midterm.entity.AnalysisStep;
import qg.po.midterm.entity.AnalysisTask;
import qg.po.midterm.mapper.AnalysisStepMapper;
import qg.po.midterm.mapper.AnalysisTaskMapper;
import qg.po.midterm.service.AnalysisEventService;
import qg.po.midterm.workflow.event.NodeExecutionEvent;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 把 Workflow 节点事件转换成数据库状态和 SSE 事件。
 */
@Component
@RequiredArgsConstructor
@lombok.extern.slf4j.Slf4j
public class NodeExecutionEventListener {

    private final AnalysisTaskMapper taskMapper;
    private final AnalysisStepMapper stepMapper;
    private final AnalysisEventService eventService;

    @EventListener
    @Transactional
    public void handle(NodeExecutionEvent event) {
        Long taskDbId = parseTaskId(event.getTaskId());
        if (taskDbId == null) {
            return;
        }

        AnalysisTask task = taskMapper.selectById(taskDbId);
        if (task == null) {
            return;
        }

        // Workflow 内部的修复节点不对前端展示。
        if ("Repair".equals(event.getNodeName())) {
            if ("FAILED".equals(event.getStatus())) {
                failTask(task, null, event.getErrorMessage());
            }
            return;
        }

        // 当前 Workflow 的 ReportGeneration 是最后一个节点。
        // 分析结果落库和 decision -> WAITING_CONFIRM 由结果处理模块完成。
        if ("ReportGeneration".equals(event.getNodeName())) {
            if ("SUCCEEDED".equals(event.getStatus())) {
                task.setStatus("SUCCEEDED");
                task.setCurrentStep(task.getTotalSteps());
                task.setFinishedAt(LocalDateTime.now());
                task.setUpdatedAt(LocalDateTime.now());
                taskMapper.updateById(task);

                // TODO 结果处理模块完成 analysis_result 入库后调用 sendResultReady。


            } else if ("FAILED".equals(event.getStatus())) {
                failTask(task, null, event.getErrorMessage());
            }
            return;
        }

        String stepName = getStepName(event.getNodeName());
        if (stepName == null) {
            if ("ToolCall".equals(event.getNodeName())) {
                try {
                    Map<String, Object> toolData = new com.fasterxml.jackson.databind.ObjectMapper().readValue(event.getOutputData(), Map.class);
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
     * 同时标记步骤和任务失败，并通知前端。
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

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("errorCode", ErrorCode.INTERNAL_ERROR.getCode());
        data.put("message", message);
        data.put("failedStepId", step == null ? null : "s_" + step.getId());
        data.put("retryable", step != null);
        eventService.sendTaskFailed("t_" + task.getId(), data);
    }

    /**
     * 发送文档规定的 step_update。
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
        data.put("summary", step.getOutputData());
        data.put("content", step.getOutputData());
        data.put("progress", progress);
        data.put("occurredAt", OffsetDateTime.now());
        eventService.sendStepUpdate("t_" + task.getId(), data);
    }

    /**
     * Workflow 节点名转换为 API 步骤名。
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
}
