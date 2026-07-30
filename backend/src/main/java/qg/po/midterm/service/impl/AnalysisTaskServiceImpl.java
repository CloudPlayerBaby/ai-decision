package qg.po.midterm.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import qg.po.midterm.common.enums.DecisionStatus;
import qg.po.midterm.common.enums.ErrorCode;
import qg.po.midterm.common.exception.BusinessException;
import qg.po.midterm.dto.request.PartialAnalysisRequest;
import qg.po.midterm.dto.result.AnalysisResultDto;
import qg.po.midterm.dto.result.Canvas;
import qg.po.midterm.entity.AnalysisResult;
import qg.po.midterm.entity.AnalysisStep;
import qg.po.midterm.entity.AnalysisTask;
import qg.po.midterm.entity.Decision;
import qg.po.midterm.entity.DecisionCanvas;
import qg.po.midterm.mapper.AnalysisResultMapper;
import qg.po.midterm.mapper.AnalysisStepMapper;
import qg.po.midterm.mapper.AnalysisTaskMapper;
import qg.po.midterm.mapper.DecisionCanvasMapper;
import qg.po.midterm.mapper.DecisionMapper;
import qg.po.midterm.repository.TaskRuntimeRepository;
import qg.po.midterm.service.AnalysisTaskService;
import qg.po.midterm.vo.*;
import qg.po.midterm.workflow.state.DecisionState;
import qg.po.midterm.workflow.state.Factor;
import qg.po.midterm.workflow.state.Option;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.*;

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
    private final AnalysisResultMapper resultMapper;
    private final DecisionCanvasMapper canvasMapper;
    private final AnalysisWorkflowDispatcher workflowDispatcher;
    private final TaskRuntimeRepository runtimeRepository;
    private final ObjectMapper objectMapper;

    /**
     * 发起完整分析
     */
    @Override
    @Transactional
    public CreateTaskVO startFullAnalysis(String decisionId) {

        // 去除前端传过来的数据前缀：d_20001 -> 20001
        Long decisionDbId = parseId(decisionId, "d_", "decisionId");

        // 加行锁，避免两个请求同时为同一个决策创建运行任务
        Decision decision = decisionMapper.selectOne(
                new LambdaQueryWrapper<Decision>()
                        .eq(Decision::getId, decisionDbId)
                        .last("FOR UPDATE")
        );
        // 没找到决策就无法开启分析
        if (decision == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "决策不存在");
        }

        // 检查是不是自己的决策
        checkOwner(decision);
        // 检查这个决策有没有已经在运行了
        checkNoRunningTask(decisionDbId);

        // 获取当前时间
        LocalDateTime now = LocalDateTime.now();

        // 每一个步骤的名字
        List<String> stepNames = List.of(
                "UNDERSTAND",
                "EXTRACT_FACTORS",
                "GENERATE_OPTIONS",
                "COMPARE_OPTIONS"
        );

        // 创建任务
        AnalysisTask task = createTask(decisionDbId, "FULL", stepNames, now);

        // 告诉数据库：任务开始跑了！
        decision.setStatus(DecisionStatus.ANALYZING.name()); // 推演完成前，决策处于分析中
        decision.setLatestTaskId(task.getId());
        decision.setUpdatedAt(now);
        decisionMapper.updateById(decision);

        String taskId = "t_" + task.getId();

        // TODO 查看这里的逻辑，怎么开始运行workflow的
        // 数据库事务提交后再启动 Workflow，避免第一批节点事件查不到任务
        runAfterCommit(() -> workflowDispatcher.startFullAnalysis(
                taskId,
                "d_" + decisionDbId,
                decision
        ));

        // 返回给前端所需要的数据
        return new CreateTaskVO(
                taskId,
                "d_" + decisionDbId,
                "FULL_ANALYSIS",
                "RUNNING",
                toOffsetTime(now)
        );
    }

    /**
     * 发起局部推演
     */
    @Override
    @Transactional
    public PartialTaskVO startPartialAnalysis(
            String decisionId,
            PartialAnalysisRequest request) {
        // 去除前缀
        Long decisionDbId = parseId(decisionId, "d_", "decisionId");

        // 加行锁，确保当前这个决策只能被一个任务执行
        Decision decision = decisionMapper.selectOne(
                new LambdaQueryWrapper<Decision>()
                        .eq(Decision::getId, decisionDbId)
                        .last("FOR UPDATE")
        );
        // 没找到就不做了
        if (decision == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "决策不存在");
        }

        // 检查是不是自己的
        checkOwner(decision);
        // 检查当前有没有在跑的任务
        checkNoRunningTask(decisionDbId);

        // 除了正在等待接受和被接受了，都不能局部推演
        if (!Set.of(
                DecisionStatus.WAITING_CONFIRM.name(),
                DecisionStatus.COMPLETED.name()
        ).contains(decision.getStatus())) {
            throw new BusinessException(
                    ErrorCode.CONFLICT,
                    "当前决策状态不允许局部推演"
            );
        }

        // 清除空白的
        List<String> changedNodeIds = cleanChangedNodeIds(request);
        // 获取之前的结果
        AnalysisResultDto oldResult = getCurrentResult(decision);
        // 读取用户刚刚保存的最新画布
        Canvas latestCanvas = getLatestCanvas(decisionDbId);

        // 使用旧分析结果作为基础，再用最新画布覆盖用户修改的因素和方案
        DecisionState currentState = buildCurrentState(
                decision,
                oldResult,
                latestCanvas,
                decision.getStatus()
        );

        // Task 层只保存完整步骤；从哪个节点开始由 WorkflowExecutor 判断
        List<String> stepNames = List.of(
                "UNDERSTAND",
                "EXTRACT_FACTORS",
                "GENERATE_OPTIONS",
                "COMPARE_OPTIONS"
        );

        // 获取当前时间并创建任务
        LocalDateTime now = LocalDateTime.now();
        AnalysisTask task = createTask(
                decisionDbId,
                "PARTIAL",
                stepNames,
                now
        );

        // 先持久化到数据库
        decision.setStatus(DecisionStatus.PARTIAL_ANALYZING.name());
        decision.setLatestTaskId(task.getId());
        decision.setUpdatedAt(now);
        decisionMapper.updateById(decision);


        String taskId = "t_" + task.getId();
        // 开始请求局部重演
        runAfterCommit(() -> workflowDispatcher.startPartialAnalysis(
                taskId,
                "d_" + decisionDbId,
                changedNodeIds,
                currentState
        ));

        // 返回给前端
        return new PartialTaskVO(
                taskId,
                "PARTIAL_ANALYSIS",
                "RUNNING",
                changedNodeIds
        );
    }

    /**
     * 查询任务和完整步骤
     * <p>
     * SSE 断开后，前端也通过这个接口恢复页面
     */
    @Override
    public AnalysisTaskVO getTask(String taskId) {
        // 获取任务，如果没有直接抛出异常
        AnalysisTask task = getTaskOrThrow(taskId);

        // 检查是否是所有者
        checkTaskOwner(task);

        // 查询任务的全部步骤
        List<AnalysisStep> steps = stepMapper.selectList(
                new LambdaQueryWrapper<AnalysisStep>()
                        .eq(AnalysisStep::getRunId, task.getId())
                        .orderByAsc(AnalysisStep::getStepOrder)
        );

        // 将数据库实体转换为接口 VO
        List<NodeProgressVO> stepVOList = new ArrayList<>();
        for (AnalysisStep step : steps) {
            StepText stepText = readStepText(step.getOutputData());
            String summary = stepText.summary() == null
                    ? getDefaultSummary(
                    step.getStepName(),
                    step.getStatus()
            )
                    : stepText.summary();

            stepVOList.add(new NodeProgressVO(
                    "s_" + step.getId(),
                    step.getStepName(),
                    getDisplayName(step.getStepName()),
                    step.getStatus(),
                    toOffsetTime(step.getStartedAt()),
                    toOffsetTime(step.getFinishedAt()),
                    summary,
                    stepText.content()
            ));
        }

        // 进度 = 已成功步骤数 / 总步骤数
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
        if (error == null && "FAILED".equals(task.getStatus())) {
            error = new TaskErrorVO(
                    ErrorCode.INTERNAL_ERROR.getCode(),
                    task.getErrorMessage(),
                    false,
                    null
            );
        }

        // lastEventId 用于前端判断当前收到的最新事件
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
     * 重试失败步骤
     */
    @Override
    @Transactional
    public RetryStepVO retryStep(String taskId, String stepId) {
        // 获取任务
        AnalysisTask task = getTaskOrThrow(taskId);
        // 获取失败的 stepId
        Long stepDbId = parseId(stepId, "s_", "stepId");

        // 检查是不是决策的所有者
        Decision decision = checkTaskOwner(task);

        // 查询步骤，并确认它属于当前任务
        AnalysisStep step = stepMapper.selectById(stepDbId);
        if (step == null || !task.getId().equals(step.getRunId())) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "任务步骤不存在");
        }

        // 只有失败步骤可以重试
        if (!"FAILED".equals(step.getStatus())) {
            throw new BusinessException(
                    ErrorCode.CONFLICT,
                    "只有 FAILED 状态的步骤可以重试"
            );
        }

        // 前置步骤必须全部成功
        Long unfinishedCount = stepMapper.selectCount(
                new LambdaQueryWrapper<AnalysisStep>()
                        .eq(AnalysisStep::getRunId, task.getId())
                        // 在当前步骤之前的
                        .lt(AnalysisStep::getStepOrder, step.getStepOrder())
                        // 状态不为 SUCCEEDED 的
                        .ne(AnalysisStep::getStatus, "SUCCEEDED")
        );
        if (unfinishedCount > 0) {
            throw new BusinessException(
                    ErrorCode.CONFLICT,
                    "前置步骤尚未全部成功"
            );
        }

        // 确定 count 次数
        int retryCount = step.getRetryCount() == null ? 1 : step.getRetryCount() + 1;

        // 保存到数据库，步骤恢复为 WAITING
        step.setStatus("WAITING");
        step.setErrorMessage(null);
        step.setStartedAt(null);
        step.setFinishedAt(null);
        step.setRetryCount(retryCount);
        step.setUpdatedAt(LocalDateTime.now());
        stepMapper.updateById(step);

        // 保存到数据库，任务恢复为 RUNNING
        task.setStatus("RUNNING");
        task.setErrorMessage(null);
        task.setFinishedAt(null);
        task.setUpdatedAt(LocalDateTime.now());
        taskMapper.updateById(task);

        // 更新决策到数据库
        decision.setStatus(
                "PARTIAL".equals(task.getRunType())
                        ? DecisionStatus.PARTIAL_ANALYZING.name()
                        : DecisionStatus.ANALYZING.name()
        );
        decision.setUpdatedAt(LocalDateTime.now());
        decisionMapper.updateById(decision);

        runAfterCommit(() -> workflowDispatcher.retryStep(
                "t_" + task.getId(),
                "s_" + step.getId()
        ));

        // 返回给前端
        return new RetryStepVO(
                "t_" + task.getId(),
                "s_" + step.getId(),
                "WAITING",
                "已加入重试队列"
        );
    }

    /**
     * 创建一个初始步骤
     */
    private void createStep(
            Long taskId, // 所属的任务 ID
            int order, // 次序
            String name, // 名称
            LocalDateTime now) {
        // 创建一个 step 实体类
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
     * 创建任务及其需要执行的步骤
     */
    private AnalysisTask createTask(
            Long decisionId, // 所属的决策 ID
            String runType, // 全量推演还是局部推演
            List<String> stepNames, // 所有的 step 名称
            LocalDateTime now) {
        // 创建一个task实体类
        AnalysisTask task = new AnalysisTask();
        task.setDecisionId(decisionId);
        task.setRunType(runType);
        task.setStatus("RUNNING");
        task.setCurrentStep(0);
        task.setTotalSteps(stepNames.size());
        task.setStartedAt(now);
        task.setCreatedAt(now);
        task.setUpdatedAt(now);
        taskMapper.insert(task);

        for (int index = 0; index < stepNames.size(); index++) {
            createStep(
                    task.getId(),
                    index + 1,
                    stepNames.get(index),
                    now
            );
        }
        return task;
    }

    // 看是否有在执行的任务
    private void checkNoRunningTask(Long decisionId) {
        // 去数据库查
        Long runningCount = taskMapper.selectCount(
                new LambdaQueryWrapper<AnalysisTask>()
                        .eq(AnalysisTask::getDecisionId, decisionId)
                        .in(AnalysisTask::getStatus, "PENDING", "RUNNING")
        );
        if (runningCount > 0) {
            throw new BusinessException(
                    ErrorCode.CONFLICT,
                    "当前决策已有运行中的任务"
            );
        }
    }

    // 过滤掉无效的
    private List<String> cleanChangedNodeIds(PartialAnalysisRequest request) {
        if (request == null || request.getChangedNodeIds() == null) {
            throw new BusinessException(
                    ErrorCode.BAD_REQUEST,
                    "changedNodeIds 不能为空"
            );
        }

        List<String> ids = request.getChangedNodeIds().stream()
                .filter(id -> id != null && !id.isBlank())
                .distinct()
                .toList();
        if (ids.isEmpty()) {
            throw new BusinessException(
                    ErrorCode.BAD_REQUEST,
                    "changedNodeIds 不能为空"
            );
        }
        return ids;
    }

    /**
     * 优先使用待确认草案；没有时使用最近确认的结果
     */
    private AnalysisResultDto getCurrentResult(Decision decision) {
        AnalysisResult result = null;
        // 草案不为空就用草案
        if (decision.getPendingResultId() != null) {
            result = resultMapper.selectById(decision.getPendingResultId());
        }
        // 不然就用最新的已经确认了的结果
        if (result == null) {
            result = resultMapper.selectOne(
                    new LambdaQueryWrapper<AnalysisResult>()
                            .eq(AnalysisResult::getDecisionId, decision.getId())
                            .eq(AnalysisResult::getStatus, "CONFIRMED")
                            .orderByDesc(AnalysisResult::getUpdatedAt)
                            .last("LIMIT 1")
            );
        }
        // 找不到或者说result的决策 ID 对不上
        if (result == null || !decision.getId().equals(result.getDecisionId())) {
            throw new BusinessException(
                    ErrorCode.CONFLICT,
                    "当前决策没有可用于局部推演的分析结果"
            );
        }

        try {
            return objectMapper.readValue(
                    result.getResultData(),
                    AnalysisResultDto.class
            );
        } catch (JacksonException exception) {
            throw new BusinessException(
                    ErrorCode.INTERNAL_ERROR,
                    "已有分析结果格式错误"
            );
        }
    }

    private DecisionState buildCurrentState(
            Decision decision, // 决策
            AnalysisResultDto result, // 之前的结果
            Canvas latestCanvas, // 用户最新保存的画布
            String previousDecisionStatus) {
        // 自己组装 data
        Map<String, Object> data = new HashMap<>();
        data.put("background", decision.getBackground());
        data.put("goal", decision.getGoal());
        data.put("constraints", decision.getConstraints());
        data.put("understanding", result.getUnderstanding());

        // 局部推演必须使用用户修改后的画布数据，不能只使用旧分析结果
        data.put("factors", buildFactors(latestCanvas, result.getFactors()));
        data.put("options", buildOptions(latestCanvas, result.getOptions()));

        data.put("recommendation", result.getRecommendation());
        data.put("nextActions", result.getNextActions());
        data.put("canvas", latestCanvas);
        data.put("previousDecisionStatus", previousDecisionStatus);
        return new DecisionState(data);
    }

    /**
     * 查询用户最后一次保存的完整画布。
     *
     * <p>没有画布时暂时返回 null，继续使用旧分析结果，避免旧数据无法局部推演。</p>
     */
    private Canvas getLatestCanvas(Long decisionId) {
        DecisionCanvas canvas = canvasMapper.selectOne(
                new LambdaQueryWrapper<DecisionCanvas>()
                        .eq(DecisionCanvas::getDecisionId, decisionId)
                        .last("LIMIT 1")
        );
        if (canvas == null
                || canvas.getCanvasData() == null
                || canvas.getCanvasData().isBlank()) {
            return null;
        }

        try {
            return objectMapper.readValue(canvas.getCanvasData(), Canvas.class);
        } catch (JacksonException exception) {
            throw new BusinessException(
                    ErrorCode.INTERNAL_ERROR,
                    "已保存的画布格式错误"
            );
        }
    }

    /**
     * 将最新画布中的 factor 节点转换成 Workflow 使用的 Factor。
     *
     * <p>画布中没有填写的描述等字段，继续使用旧分析结果中的值。</p>
     */
    private List<Factor> buildFactors(
            Canvas canvas,
            List<Factor> oldFactors) {
        if (canvas == null || canvas.getNodes() == null) {
            return oldFactors;
        }

        Map<String, Factor> oldFactorMap = new HashMap<>();
        if (oldFactors != null) {
            for (Factor factor : oldFactors) {
                oldFactorMap.put(factor.getId(), factor);
            }
        }

        List<Factor> factors = new ArrayList<>();
        for (Canvas.CanvasNode node : canvas.getNodes()) {
            if (!"factor".equalsIgnoreCase(node.getType())) {
                continue;
            }

            Factor oldFactor = oldFactorMap.get(node.getId());
            Map<String, Object> nodeData = node.getData();

            Factor factor = new Factor();
            factor.setId(node.getId());
            factor.setName(node.getLabel());
            factor.setDescription(readText(
                    nodeData,
                    "description",
                    oldFactor == null ? null : oldFactor.getDescription()
            ));
            factor.setWeight(readDouble(
                    nodeData,
                    "weight",
                    oldFactor == null ? 0 : oldFactor.getWeight()
            ));
            factors.add(factor);
        }
        return factors;
    }

    /**
     * 将最新画布中的 option 节点转换成 Workflow 使用的 Option。
     */
    private List<Option> buildOptions(
            Canvas canvas,
            List<Option> oldOptions) {
        if (canvas == null || canvas.getNodes() == null) {
            return oldOptions;
        }

        Map<String, Option> oldOptionMap = new HashMap<>();
        if (oldOptions != null) {
            for (Option option : oldOptions) {
                oldOptionMap.put(option.getId(), option);
            }
        }

        List<Option> options = new ArrayList<>();
        for (Canvas.CanvasNode node : canvas.getNodes()) {
            if (!"option".equalsIgnoreCase(node.getType())) {
                continue;
            }

            Option oldOption = oldOptionMap.get(node.getId());
            Map<String, Object> nodeData = node.getData();

            Option option = new Option();
            option.setId(node.getId());
            option.setName(node.getLabel());
            option.setDescription(readText(
                    nodeData,
                    "description",
                    oldOption == null ? null : oldOption.getDescription()
            ));
            option.setPros(readStringList(
                    nodeData,
                    "pros",
                    oldOption == null ? null : oldOption.getPros()
            ));
            option.setCons(readStringList(
                    nodeData,
                    "cons",
                    oldOption == null ? null : oldOption.getCons()
            ));
            option.setRisks(readStringList(
                    nodeData,
                    "risks",
                    oldOption == null ? null : oldOption.getRisks()
            ));
            option.setScores(readScores(
                    nodeData,
                    oldOption == null ? null : oldOption.getScores()
            ));
            options.add(option);
        }
        return options;
    }

    private String readText(
            Map<String, Object> data,
            String key,
            String defaultValue) {
        if (data == null || data.get(key) == null) {
            return defaultValue;
        }
        return data.get(key).toString();
    }

    private double readDouble(
            Map<String, Object> data,
            String key,
            double defaultValue) {
        if (data == null || !(data.get(key) instanceof Number number)) {
            return defaultValue;
        }
        return number.doubleValue();
    }

    private List<String> readStringList(
            Map<String, Object> data,
            String key,
            List<String> defaultValue) {
        if (data == null || !(data.get(key) instanceof List<?> values)) {
            return defaultValue;
        }
        return values.stream()
                .map(String::valueOf)
                .toList();
    }

    private Map<String, Integer> readScores(
            Map<String, Object> data,
            Map<String, Integer> defaultValue) {
        if (data == null || !(data.get("scores") instanceof Map<?, ?> values)) {
            return defaultValue;
        }

        Map<String, Integer> scores = new HashMap<>();
        values.forEach((key, value) -> {
            if (value instanceof Number number) {
                scores.put(String.valueOf(key), number.intValue());
            }
        });
        return scores;
    }

    /**
     * 只在当前数据库事务成功提交后启动异步 Workflow
     */
    private void runAfterCommit(Runnable action) {
        if (!TransactionSynchronizationManager
                .isSynchronizationActive()) {
            action.run();
            return;
        }

        TransactionSynchronizationManager.registerSynchronization(
                new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        action.run();
                    }
                }
        );
    }

    private StepText readStepText(String outputData) {
        if (outputData == null || outputData.isBlank()) {
            return new StepText(null, null);
        }
        try {
            JsonNode node = objectMapper.readTree(outputData);
            return new StepText(
                    textOrNull(node.get("summary")),
                    textOrNull(node.get("content"))
            );
        } catch (JacksonException exception) {
            // 兼容旧数据：旧版本曾直接把文本放进 output_data
            return new StepText(outputData, outputData);
        }
    }

    private String textOrNull(JsonNode node) {
        return node == null || node.isNull() ? null : node.asText();
    }

    /**
     * 查询任务；不存在时统一返回 40401
     */
    private AnalysisTask getTaskOrThrow(String taskId) {
        Long taskDbId = parseId(taskId, "t_", "taskId");
        AnalysisTask task = taskMapper.selectById(taskDbId);
        if (task == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "分析任务不存在");
        }
        return task;
    }

    private Decision checkTaskOwner(AnalysisTask task) {
        Decision decision = decisionMapper.selectById(task.getDecisionId());
        if (decision == null) {
            throw new BusinessException(
                    ErrorCode.NOT_FOUND,
                    "分析任务不存在"
            );
        }
        checkOwner(decision);
        return decision;
    }

    private void checkOwner(Decision decision) {
        if (!decision.getUserId().equals(getCurrentUserId())) {
            // 越权统一返回 404，避免暴露资源是否存在。
            throw new BusinessException(
                    ErrorCode.NOT_FOUND,
                    "资源不存在或已删除"
            );
        }
    }

    private Long getCurrentUserId() {
        Authentication authentication = SecurityContextHolder
                .getContext()
                .getAuthentication();
        if (authentication == null
                || !(authentication.getPrincipal() instanceof Long userId)) {
            throw new BusinessException(
                    ErrorCode.UNAUTHORIZED,
                    "未登录或Token已失效"
            );
        }
        return userId;
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

    private String getDefaultSummary(String stepName, String status) {
        String displayName = getDisplayName(stepName);
        return switch (status) {
            case "WAITING" -> "等待" + displayName;
            case "RUNNING" -> "正在" + displayName;
            case "SUCCEEDED" -> "已完成" + displayName;
            case "FAILED" -> displayName + "失败";
            default -> displayName;
        };
    }

    private OffsetDateTime toOffsetTime(LocalDateTime time) {
        if (time == null) {
            return null;
        }
        return time.atZone(ZoneId.systemDefault()).toOffsetDateTime();
    }

    private record StepText(String summary, String content) {
    }
}
