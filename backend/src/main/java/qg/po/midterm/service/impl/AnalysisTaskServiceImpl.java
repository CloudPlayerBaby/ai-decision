package qg.po.midterm.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import qg.po.midterm.common.enums.ErrorCode;
import qg.po.midterm.common.exception.BusinessException;
import qg.po.midterm.entity.AnalysisStep;
import qg.po.midterm.entity.AnalysisTask;
import qg.po.midterm.entity.Decision;
import qg.po.midterm.mapper.AnalysisStepMapper;
import qg.po.midterm.mapper.AnalysisTaskMapper;
import qg.po.midterm.mapper.DecisionMapper;
import qg.po.midterm.repository.TaskRuntimeRepository;
import qg.po.midterm.service.AnalysisTaskService;
import qg.po.midterm.vo.*;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

/**
 * 分析任务服务。
 *
 * <p>主要操作三张表：</p>
 * <ul>
 *     <li>decision：决策问题</li>
 *     <li>agent_run：一次分析任务</li>
 *     <li>agent_step：任务中的分析步骤</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class AnalysisTaskServiceImpl implements AnalysisTaskService {

    private final DecisionMapper decisionMapper;
    private final AnalysisTaskMapper taskMapper;
    private final AnalysisStepMapper stepMapper;
    private final AnalysisWorkflowDispatcher workflowDispatcher;
    private final TaskRuntimeRepository runtimeRepository;

    /**
     * 发起完整分析。
     */
    @Override
    @Transactional
    public CreateTaskVO startFullAnalysis(String decisionId) {
        // 去除前缀：d_20001 -> 20001
        Long decisionDbId = parseId(decisionId, "d_", "decisionId");

        // 1. 查询决策
        Decision decision = decisionMapper.selectById(decisionDbId);
        if (decision == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "决策不存在");
        }

        // TODO 校验当前登录用户是否拥有这个决策

        // 2. 同一个决策不能同时运行两个任务
        Long runningCount = taskMapper.selectCount(
                new LambdaQueryWrapper<AnalysisTask>()
                        .eq(AnalysisTask::getDecisionId, decisionDbId)
                        .in(AnalysisTask::getStatus, "PENDING", "RUNNING")
        );
        if (runningCount > 0) {
            throw new BusinessException(
                    ErrorCode.CONFLICT,
                    "当前决策已有运行中的任务"
            );
        }

        LocalDateTime now = LocalDateTime.now();

        // 3. 创建 agent_run
        AnalysisTask task = new AnalysisTask();
        task.setDecisionId(decisionDbId);
        task.setRunType("FULL");
        task.setStatus("RUNNING");
        task.setCurrentStep(0);
        task.setTotalSteps(4);
        task.setStartedAt(now);
        task.setCreatedAt(now);
        task.setUpdatedAt(now);
        taskMapper.insert(task);

        // 4. 创建文档规定的主要分析步骤
        // TOOL_CALL 是可选步骤，由 Workflow 真正调用工具时再创建
        // GENERATE_REPORT 属于用户确认之后的流程，不在本轮分析中创建
        createStep(task.getId(), 1, "UNDERSTAND", now);
        createStep(task.getId(), 2, "EXTRACT_FACTORS", now);
        createStep(task.getId(), 3, "GENERATE_OPTIONS", now);
        createStep(task.getId(), 4, "COMPARE_OPTIONS", now);

        // 5. 更新 decision 状态
        decision.setStatus("ANALYZING");
        decision.setLatestTaskId(task.getId());
        decision.setUpdatedAt(now);
        decisionMapper.updateById(decision);

        String taskId = "t_" + task.getId();

        // 6. 异步交给 Workflow。当前 HTTP 请求会立即返回
        workflowDispatcher.startFullAnalysis(
                taskId,
                "d_" + decisionDbId,
                decision
        );

        return new CreateTaskVO(
                taskId,
                "d_" + decisionDbId,
                "FULL_ANALYSIS",
                "RUNNING",
                toOffsetTime(now)
        );
    }

    /**
     * 查询任务和完整步骤
     * <p>
     * SSE 断开后，前端也通过这个接口恢复页面
     */
    @Override
    public AnalysisTaskVO getTask(String taskId) {
        AnalysisTask task = getTaskOrThrow(taskId);

        // TODO 校验当前登录用户是否拥有这个任务


        // 查询任务的全部步骤。
        List<AnalysisStep> steps = stepMapper.selectList(
                new LambdaQueryWrapper<AnalysisStep>()
                        .eq(AnalysisStep::getRunId, task.getId())
                        .orderByAsc(AnalysisStep::getStepOrder)
        );

        // 将数据库实体转换为接口 VO。
        List<NodeProgressVO> stepVOList = new ArrayList<>();
        for (AnalysisStep step : steps) {
            // TODO Workflow 后续把 summary 和 content 分别保存到 output_data JSON。


            String summary = step.getOutputData();
            String content = step.getOutputData();

            stepVOList.add(new NodeProgressVO(
                    "s_" + step.getId(),
                    step.getStepName(),
                    getDisplayName(step.getStepName()),
                    step.getStatus(),
                    toOffsetTime(step.getStartedAt()),
                    toOffsetTime(step.getFinishedAt()),
                    summary,
                    content
            ));
        }

        // 进度 = 已成功步骤数 / 总步骤数。
        long successCount = steps.stream()
                .filter(step -> "SUCCEEDED".equals(step.getStatus()))
                .count();
        int progress = steps.isEmpty()
                ? 0
                : (int) (successCount * 100 / steps.size());

        if ("SUCCEEDED".equals(task.getStatus())) {
            progress = 100;
        }

        // 如果有失败步骤，返回文档要求的 error。
        TaskErrorVO error = null;
        for (AnalysisStep step : steps) {
            if ("FAILED".equals(step.getStatus())) {
                error = new TaskErrorVO(
                        ErrorCode.INTERNAL_ERROR.getCode(),
                        step.getErrorMessage(),
                        true,
                        "s_" + step.getId()
                );
                break;
            }
        }

        // lastEventId 用于前端判断当前收到的最新事件。
        return new AnalysisTaskVO(
                "t_" + task.getId(),
                task.getStatus(),
                progress,
                stepVOList,
                runtimeRepository.getLastEventId("t_" + task.getId()),
                error
        );
    }

    /**
     * 重试失败步骤。
     */
    @Override
    @Transactional
    public RetryStepVO retryStep(String taskId, String stepId) {
        AnalysisTask task = getTaskOrThrow(taskId);
        Long stepDbId = parseId(stepId, "s_", "stepId");

        // TODO 校验当前登录用户是否拥有这个任务。


        // 1. 查询步骤，并确认它属于当前任务。
        AnalysisStep step = stepMapper.selectById(stepDbId);
        if (step == null || !task.getId().equals(step.getRunId())) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "任务步骤不存在");
        }

        // 2. 只有失败步骤可以重试。
        if (!"FAILED".equals(step.getStatus())) {
            throw new BusinessException(
                    ErrorCode.CONFLICT,
                    "只有 FAILED 状态的步骤可以重试"
            );
        }

        // 3. 前置步骤必须全部成功。
        Long unfinishedCount = stepMapper.selectCount(
                new LambdaQueryWrapper<AnalysisStep>()
                        .eq(AnalysisStep::getRunId, task.getId())
                        .lt(AnalysisStep::getStepOrder, step.getStepOrder())
                        .ne(AnalysisStep::getStatus, "SUCCEEDED")
        );
        if (unfinishedCount > 0) {
            throw new BusinessException(
                    ErrorCode.CONFLICT,
                    "前置步骤尚未全部成功"
            );
        }

        // 4. 步骤恢复为 WAITING。
        int retryCount = step.getRetryCount() == null
                ? 1
                : step.getRetryCount() + 1;

        step.setStatus("WAITING");
        step.setErrorMessage(null);
        step.setStartedAt(null);
        step.setFinishedAt(null);
        step.setRetryCount(retryCount);
        step.setUpdatedAt(LocalDateTime.now());
        stepMapper.updateById(step);

        // 5. 任务恢复为 RUNNING。
        task.setStatus("RUNNING");
        task.setErrorMessage(null);
        task.setFinishedAt(null);
        task.setUpdatedAt(LocalDateTime.now());
        taskMapper.updateById(task);

        // TODO 等 Workflow 完成单步骤恢复能力后，确认这个调用的返回状态。


        workflowDispatcher.retryStep(
                "t_" + task.getId(),
                "s_" + step.getId()
        );

        return new RetryStepVO(
                "t_" + task.getId(),
                "s_" + step.getId(),
                "WAITING",
                "已加入重试队列"
        );
    }

    /**
     * 创建一个初始步骤。
     */
    private void createStep(
            Long taskId,
            int order,
            String name,
            LocalDateTime now) {
        AnalysisStep step = new AnalysisStep();
        step.setRunId(taskId);
        step.setStepOrder(order);
        step.setStepName(name);
        step.setStepType("THINKING");
        step.setStatus("WAITING");
        step.setRetryCount(0);
        step.setCreatedAt(now);
        step.setUpdatedAt(now);
        stepMapper.insert(step);
    }

    /**
     * 查询任务；不存在时统一返回 40401。
     */
    private AnalysisTask getTaskOrThrow(String taskId) {
        Long taskDbId = parseId(taskId, "t_", "taskId");
        AnalysisTask task = taskMapper.selectById(taskDbId);
        if (task == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "分析任务不存在");
        }
        return task;
    }

    /**
     * 将接口 ID 转换为数据库数字 ID。
     * <p>
     * 例如：t_30001 -> 30001。
     */
    private Long parseId(String value, String prefix, String fieldName) {
        if (value == null || !value.startsWith(prefix)) {
            throw new BusinessException(
                    ErrorCode.BAD_REQUEST,
                    fieldName + " 格式错误"
            );
        }

        try {
            return Long.parseLong(value.substring(prefix.length()));
        } catch (NumberFormatException exception) {
            throw new BusinessException(
                    ErrorCode.BAD_REQUEST,
                    fieldName + " 格式错误"
            );
        }
    }

    /**
     * 步骤英文名对应的中文展示名。
     */
    private String getDisplayName(String name) {
        return switch (name) {
            case "UNDERSTAND" -> "理解问题";
            case "EXTRACT_FACTORS" -> "提取关键因素";
            case "TOOL_CALL" -> "调用工具";
            case "GENERATE_OPTIONS" -> "生成候选方案";
            case "COMPARE_OPTIONS" -> "比较候选方案";
            default -> name;
        };
    }

    private OffsetDateTime toOffsetTime(LocalDateTime time) {
        if (time == null) {
            return null;
        }
        return time.atZone(ZoneId.systemDefault()).toOffsetDateTime();
    }
}
