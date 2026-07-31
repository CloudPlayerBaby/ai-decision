package qg.po.midterm.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import qg.po.midterm.common.enums.DecisionStatus;
import qg.po.midterm.common.enums.ErrorCode;
import qg.po.midterm.common.exception.BusinessException;
import qg.po.midterm.dto.request.ConfirmDecisionRequest;
import qg.po.midterm.dto.request.CreateDecisionRequest;
import qg.po.midterm.dto.request.PreferredOptionRequest;
import qg.po.midterm.dto.request.SaveCanvasRequest;
import qg.po.midterm.dto.result.AnalysisResultDto;
import qg.po.midterm.dto.result.Canvas;
import qg.po.midterm.dto.result.ReportContent;
import qg.po.midterm.entity.AnalysisResult;
import qg.po.midterm.entity.AnalysisStep;
import qg.po.midterm.entity.AnalysisTask;
import qg.po.midterm.entity.Decision;
import qg.po.midterm.entity.DecisionCanvas;
import qg.po.midterm.entity.DecisionFactor;
import qg.po.midterm.entity.DecisionSolution;
import qg.po.midterm.entity.Report;
import qg.po.midterm.mapper.AnalysisResultMapper;
import qg.po.midterm.mapper.AnalysisStepMapper;
import qg.po.midterm.mapper.AnalysisTaskMapper;
import qg.po.midterm.mapper.DecisionCanvasMapper;
import qg.po.midterm.mapper.DecisionFactorMapper;
import qg.po.midterm.mapper.DecisionMapper;
import qg.po.midterm.mapper.DecisionSolutionMapper;
import qg.po.midterm.mapper.ReportMapper;
import qg.po.midterm.service.DecisionService;
import qg.po.midterm.vo.*;
import qg.po.midterm.workflow.state.Factor;
import qg.po.midterm.workflow.state.Option;
import qg.po.midterm.workflow.agent.ReportAgent;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * 决策问题服务实现（API v2.0 第 6、9、10 节）
 */
@Service
@RequiredArgsConstructor
public class DecisionServiceImpl implements DecisionService {

    private final DecisionMapper decisionMapper;
    private final AnalysisTaskMapper analysisTaskMapper;
    private final AnalysisResultMapper analysisResultMapper;
    private final ReportMapper reportMapper;
    private final DecisionCanvasMapper decisionCanvasMapper;
    private final AnalysisStepMapper analysisStepMapper;
    private final DecisionFactorMapper decisionFactorMapper;
    private final DecisionSolutionMapper decisionSolutionMapper;
    private final ObjectMapper objectMapper;
    private final ReportAgent reportAgent;

    /** 6.4 中不可删除的状态 */
    private static final Set<String> UNDELETABLE_STATUSES =
            Set.of(DecisionStatus.ANALYZING.name(), DecisionStatus.PARTIAL_ANALYZING.name());

    private static final DateTimeFormatter ISO_FORMATTER =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ssXXX");

    @Override
    public DecisionVO create(CreateDecisionRequest request) {
        Long userId = getCurrentUserId();

        Decision entity = new Decision();
        entity.setUserId(userId);
        entity.setTitle(request.getTitle());
        entity.setBackground(request.getBackground());
        entity.setGoal(request.getGoal());
        entity.setConstraints(request.getConstraints());
        entity.setStatus(DecisionStatus.PENDING.name());
        entity.setHasPendingResult(false);
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());

        decisionMapper.insert(entity);

        return toVO(entity);
    }

    @Override
    public PageVO<DecisionVO> list(int page, int pageSize, String status, String keyword) {
        Long userId = getCurrentUserId();

        LambdaQueryWrapper<Decision> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Decision::getUserId, userId);
        if (StringUtils.hasText(status)) {
            wrapper.eq(Decision::getStatus, status);
        }
        if (StringUtils.hasText(keyword)) {
            wrapper.like(Decision::getTitle, keyword);
        }
        wrapper.orderByDesc(Decision::getUpdatedAt);

        Page<Decision> result = decisionMapper.selectPage(
                Page.of(page, pageSize), wrapper);

        List<DecisionVO> list = result.getRecords().stream()
                .map(this::toVO)
                .toList();

        return PageVO.<DecisionVO>builder()
                .list(list)
                .page(page)
                .pageSize(pageSize)
                .total(result.getTotal())
                .totalPages((int) result.getPages())
                .build();
    }

    @Override
    public DecisionDetailVO getDetail(String decisionId) {
        Long id = parseId(decisionId, "d_");
        Decision entity = decisionMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "决策问题不存在");
        }
        checkOwner(entity);

        DecisionDetailVO.LatestTaskSummary latestTask = null;
        if (entity.getLatestTaskId() != null) {
            AnalysisTask task = analysisTaskMapper.selectById(entity.getLatestTaskId());
            if (task != null) {
                int progress = 0;
                if (task.getTotalSteps() != null && task.getTotalSteps() > 0
                        && task.getCurrentStep() != null) {
                    progress = Math.min(100,
                            task.getCurrentStep() * 100 / task.getTotalSteps());
                }
                latestTask = DecisionDetailVO.LatestTaskSummary.builder()
                        .id("t_" + task.getId())
                        .status(task.getStatus())
                        .progress(progress)
                        .build();
            }
        }

        // 已确认的分析结果：查该决策下 status=CONFIRMED 的最新一条
        String confirmedResultId = null;
        LambdaQueryWrapper<AnalysisResult> confirmedWrapper = new LambdaQueryWrapper<>();
        confirmedWrapper.eq(AnalysisResult::getDecisionId, id)
                .eq(AnalysisResult::getStatus, "CONFIRMED")
                .orderByDesc(AnalysisResult::getUpdatedAt)
                .last("LIMIT 1");
        AnalysisResult confirmed = analysisResultMapper.selectOne(confirmedWrapper);
        if (confirmed != null) {
            confirmedResultId = "ar_" + confirmed.getId();
        }

        // 待确认的分析结果
        String pendingResultId = null;
        if (entity.getPendingResultId() != null) {
            pendingResultId = "ar_" + entity.getPendingResultId();
        }

        String reportId = null;
        if (entity.getReportId() != null) {
            reportId = "r_" + entity.getReportId();
        }

        return DecisionDetailVO.builder()
                .decision(toVO(entity))
                .latestTask(latestTask)
                .confirmedResultId(confirmedResultId)
                .pendingResultId(pendingResultId)
                .reportId(reportId)
                .build();
    }

    @Override
    @Transactional
    public void delete(String decisionId) {
        Long id = parseId(decisionId, "d_");
        Decision entity = decisionMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "决策问题不存在");
        }
        checkOwner(entity);

        if (UNDELETABLE_STATUSES.contains(entity.getStatus())) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "当前状态 " + entity.getStatus() + " 不允许删除，请等待推演完成");
        }

        deleteDecisionRelations(id);
        decisionMapper.deleteById(id);
    }

    // ==================== 第 9 节：结果、方案与确认 ====================

    @Override
    public AnalysisResultVO getAnalysisResult(String decisionId, String resultId) {
        Long id = parseId(decisionId, "d_");
        Decision decision = decisionMapper.selectById(id);
        if (decision == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "决策问题不存在");
        }
        checkOwner(decision);

        AnalysisResult result;
        if (StringUtils.hasText(resultId)) {
            // 指定了 resultId，直接查
            Long arId = parseId(resultId, "ar_", "resultId");
            result = analysisResultMapper.selectById(arId);
            if (result == null || !result.getDecisionId().equals(id)) {
                throw new BusinessException(ErrorCode.NOT_FOUND, "分析结果不存在");
            }
        } else {
            // 未指定：优先返回 PENDING_CONFIRM，其次 CONFIRMED
            LambdaQueryWrapper<AnalysisResult> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(AnalysisResult::getDecisionId, id)
                    .orderByDesc(AnalysisResult::getCreatedAt);
            List<AnalysisResult> list = analysisResultMapper.selectList(wrapper);
            result = list.stream()
                    .filter(r -> "PENDING_CONFIRM".equals(r.getStatus()))
                    .findFirst()
                    .orElse(list.isEmpty() ? null : list.get(0));
        }

        if (result == null) {
            return null;
        }

        AnalysisResultDto dto = parseAnalysisResultDto(result.getResultData());
        return AnalysisResultVO.from(
                "ar_" + result.getId(),
                result.getStatus(),
                dto,
                formatTime(result.getCreatedAt()));
    }

    @Override
    public void setPreferredOption(String decisionId, PreferredOptionRequest request) {
        Long id = parseId(decisionId, "d_");
        Decision decision = decisionMapper.selectById(id);
        if (decision == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "决策问题不存在");
        }
        checkOwner(decision);

        AnalysisResult result = getAnalysisResultOrThrow(
                id,
                request.getAnalysisResultId()
        );
        if (!"PENDING_CONFIRM".equals(result.getStatus())) {
            throw new BusinessException(
                    ErrorCode.CONFLICT,
                    "仅 PENDING_CONFIRM 状态的草案可以选择倾向方案"
            );
        }
        checkCurrentPendingResult(decision, result);
        Option option = getOptionOrThrow(result, request.getOptionId());

        decision.setPreferredOptionId(option.getId());
        decision.setUpdatedAt(LocalDateTime.now());
        decisionMapper.updateById(decision);
    }

    @Override
    @Transactional
    public ConfirmResultVO confirm(String decisionId, ConfirmDecisionRequest request) {
        Long id = parseId(decisionId, "d_");
        Decision decision = decisionMapper.selectById(id);
        if (decision == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "决策问题不存在");
        }
        checkOwner(decision);

        AnalysisResult result = getAnalysisResultOrThrow(
                id,
                request.getAnalysisResultId()
        );

        if (!"PENDING_CONFIRM".equals(result.getStatus())) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "仅 PENDING_CONFIRM 状态的草案可以确认，当前: " + result.getStatus());
        }
        checkCurrentPendingResult(decision, result);

        Option selectedOption = getOptionOrThrow(
                result,
                request.getSelectedOptionId()
        );
        LocalDateTime now = LocalDateTime.now();

        // 1. 草案 → 已确认
        result.setStatus("CONFIRMED");
        result.setUpdatedAt(now);
        analysisResultMapper.updateById(result);

        // 获取用户选择的方案名称
        String selectedOptionName = selectedOption.getName();

        // 调用大模型生成报告内容
        ReportContent content = reportAgent.generateReport(result.getResultData(), selectedOptionName);

        // 2. 生成报告（结构化内容）
        Report report = new Report();
        report.setDecisionId(id);
        report.setAnalysisResultId(result.getId());
        report.setContent(objectMapper.writeValueAsString(content));
        report.setCreatedAt(now);
        reportMapper.insert(report);

        // 3. 更新决策
        decision.setStatus(DecisionStatus.COMPLETED.name());
        decision.setReportId(report.getId());
        decision.setHasPendingResult(false);
        decision.setPendingResultId(null);
        decision.setPreferredOptionId(selectedOption.getId());
        decision.setUpdatedAt(now);
        decisionMapper.updateById(decision);

        return ConfirmResultVO.builder()
                .decisionId("d_" + decision.getId())
                .status(DecisionStatus.COMPLETED.name())
                .analysisResultId("ar_" + result.getId())
                .reportId("r_" + report.getId())
                .reportStatus("READY")
                .build();
    }

    // ==================== 第 10 节：画布与局部重推 ====================

    @Override
    public Canvas getCanvas(String decisionId) {
        Long id = parseId(decisionId, "d_");
        Decision decision = decisionMapper.selectById(id);
        if (decision == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "决策问题不存在");
        }
        checkOwner(decision);

        // 优先读取用户保存的画布
        LambdaQueryWrapper<DecisionCanvas> canvasWrapper = new LambdaQueryWrapper<>();
        canvasWrapper.eq(DecisionCanvas::getDecisionId, id)
                .orderByDesc(DecisionCanvas::getUpdatedAt)
                .last("LIMIT 1");
        DecisionCanvas savedCanvas = decisionCanvasMapper.selectOne(canvasWrapper);
        if (savedCanvas != null && savedCanvas.getCanvasData() != null) {
            try {
                return objectMapper.readValue(savedCanvas.getCanvasData(), Canvas.class);
            } catch (Exception e) {
                // 解析失败则回退到自动生成
            }
        }

        // 无可保存画布，从分析结果自动生成
        AnalysisResult result = findLatestResultForCanvas(id);
        if (result == null || result.getResultData() == null) {
            return new Canvas(Collections.emptyList(), Collections.emptyList());
        }

        AnalysisResultDto dto = parseAnalysisResultDto(result.getResultData());
        return buildAutoCanvas(dto, decision.getTitle());
    }

    @Override
    @Transactional
    public SaveCanvasVO saveCanvas(String decisionId, SaveCanvasRequest request) {
        Long id = parseId(decisionId, "d_");
        Decision decision = decisionMapper.selectById(id);
        if (decision == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "决策问题不存在");
        }
        checkOwner(decision);

        // 解析请求中的画布
        Canvas newCanvas = new Canvas(request.getNodes(), request.getEdges());

        // 读出旧画布用于 diff
        Canvas oldCanvas = null;
        LambdaQueryWrapper<DecisionCanvas> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(DecisionCanvas::getDecisionId, id)
                .orderByDesc(DecisionCanvas::getUpdatedAt)
                .last("LIMIT 1");
        DecisionCanvas existing = decisionCanvasMapper.selectOne(wrapper);
        if (existing != null && existing.getCanvasData() != null) {
            try {
                oldCanvas = objectMapper.readValue(existing.getCanvasData(), Canvas.class);
            } catch (Exception e) {
                // ignore
            }
        } else {
            AnalysisResult baselineResult = findLatestResultForCanvas(id);
            if (baselineResult != null && baselineResult.getResultData() != null) {
                oldCanvas = buildAutoCanvas(
                        parseAnalysisResultDto(baselineResult.getResultData()),
                        decision.getTitle()
                );
            }
        }

        // 计算变更节点
        List<String> changedNodeIds = computeChangedNodeIds(oldCanvas, newCanvas);

        // 序列化并保存
        LocalDateTime now = LocalDateTime.now();
        String canvasJson;
        try {
            canvasJson = objectMapper.writeValueAsString(newCanvas);
        } catch (Exception e) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "画布序列化失败");
        }

        if (existing != null) {
            existing.setCanvasData(canvasJson);
            existing.setVersion(existing.getVersion() != null ? existing.getVersion() + 1 : 1);
            existing.setUpdatedAt(now);
            decisionCanvasMapper.updateById(existing);
        } else {
            DecisionCanvas canvas = new DecisionCanvas();
            canvas.setDecisionId(id);
            canvas.setCanvasData(canvasJson);
            canvas.setVersion(1);
            canvas.setCreatedAt(now);
            canvas.setUpdatedAt(now);
            decisionCanvasMapper.insert(canvas);
        }

        return SaveCanvasVO.builder()
                .changedNodeIds(changedNodeIds)
                .canvas(newCanvas)
                .build();
    }

    // ==================== 画布工具方法 ====================

    /**
     * 查找用于生成画布的最新分析结果（优先 CONFIRMED，其次 PENDING_CONFIRM）
     */
    private AnalysisResult findLatestResultForCanvas(Long decisionId) {
        LambdaQueryWrapper<AnalysisResult> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(AnalysisResult::getDecisionId, decisionId)
                .orderByDesc(AnalysisResult::getCreatedAt);
        List<AnalysisResult> list = analysisResultMapper.selectList(wrapper);
        return list.stream()
                .filter(r -> "CONFIRMED".equals(r.getStatus()))
                .findFirst()
                .orElse(list.isEmpty() ? null : list.get(0));
    }

    /**
     * 从分析结果构建自动画布
     */
    private Canvas buildAutoCanvas(AnalysisResultDto dto, String decisionTitle) {
        List<Canvas.CanvasNode> nodes = new ArrayList<>();
        List<Canvas.CanvasEdge> edges = new ArrayList<>();

        // 根节点 — 决策问题
        nodes.add(createNode("root", "decision", decisionTitle,
                new Canvas.Position(360, 40), Collections.emptyMap()));

        // Factor 节点 + edge
        List<Factor> factors = dto.getFactors() != null
                ? dto.getFactors() : Collections.emptyList();
        int factorCount = factors.size();
        for (int i = 0; i < factorCount; i++) {
            Factor f = factors.get(i);
            double x = 140 + (double) i * (560.0 / Math.max(1, factorCount - 1));
            if (factorCount == 1) x = 360;
            Map<String, Object> factorData = new HashMap<>();
            factorData.put("weight", f.getWeight());
            nodes.add(createNode(f.getId(), "factor", f.getName(),
                    new Canvas.Position(x, 180), factorData));
            edges.add(createEdge("e_f_" + i, "root", f.getId(), "HAS_FACTOR"));
        }

        // Option 节点 + edge
        List<Option> options = dto.getOptions() != null
                ? dto.getOptions() : Collections.emptyList();
        int optionCount = options.size();
        for (int i = 0; i < optionCount; i++) {
            Option o = options.get(i);
            double x = 140 + (double) i * (560.0 / Math.max(1, optionCount - 1));
            if (optionCount == 1) x = 360;
            Map<String, Object> optionData = new HashMap<>();
            optionData.put("scores", o.getScores() != null
                    ? o.getScores() : Collections.emptyMap());
            nodes.add(createNode(o.getId(), "option", o.getName(),
                    new Canvas.Position(x, 340), optionData));
            edges.add(createEdge("e_o_" + i, "root", o.getId(), "HAS_OPTION"));
        }

        return new Canvas(nodes, edges);
    }

    private Canvas.CanvasNode createNode(String id, String type, String label,
                                          Canvas.Position pos, java.util.Map<String, Object> data) {
        Canvas.CanvasNode node = new Canvas.CanvasNode();
        node.setId(id);
        node.setType(type);
        node.setLabel(label);
        node.setPosition(pos);
        node.setData(data);
        return node;
    }

    private Canvas.CanvasEdge createEdge(String id, String source, String target, String relation) {
        Canvas.CanvasEdge edge = new Canvas.CanvasEdge();
        edge.setId(id);
        edge.setSource(source);
        edge.setTarget(target);
        edge.setRelation(relation);
        return edge;
    }

    /**
     * 计算画布变更节点：比较新老画布的 nodes 和 edges，找出增/删/改的节点ID
     */
    private List<String> computeChangedNodeIds(Canvas oldCanvas, Canvas newCanvas) {
        List<String> changed = new ArrayList<>();
        if (oldCanvas == null) {
            // 首次保存，所有节点都算变更
            if (newCanvas.getNodes() != null) {
                newCanvas.getNodes().forEach(n -> changed.add(n.getId()));
            }
            return changed;
        }

        Map<String, Canvas.CanvasNode> oldNodes = indexNodes(oldCanvas);
        Map<String, Canvas.CanvasNode> newNodes = indexNodes(newCanvas);

        // 新增或修改的节点
        for (String id : newNodes.keySet()) {
            if (!oldNodes.containsKey(id)) {
                changed.add(id); // 新增
            } else if (!nodeEquals(oldNodes.get(id), newNodes.get(id))) {
                changed.add(id); // 修改
            }
        }
        // 删除的节点
        for (String id : oldNodes.keySet()) {
            if (!newNodes.containsKey(id)) {
                changed.add(id);
            }
        }

        // 边变更也视为关联节点变更
        Map<String, Canvas.CanvasEdge> oldEdges = indexEdgeMap(oldCanvas);
        Map<String, Canvas.CanvasEdge> newEdges = indexEdgeMap(newCanvas);
        Set<String> changedEdges = new LinkedHashSet<>(oldEdges.keySet());
        changedEdges.addAll(newEdges.keySet());
        changedEdges.removeIf(signature -> oldEdges.containsKey(signature) && newEdges.containsKey(signature));
        for (String signature : changedEdges) {
            Canvas.CanvasEdge edge = newEdges.getOrDefault(signature, oldEdges.get(signature));
            addBusinessEndpoint(changed, edge.getSource());
            addBusinessEndpoint(changed, edge.getTarget());
        }

        return changed;
    }

    private Map<String, Canvas.CanvasNode> indexNodes(Canvas canvas) {
        Map<String, Canvas.CanvasNode> map = new LinkedHashMap<>();
        if (canvas != null && canvas.getNodes() != null) {
            for (Canvas.CanvasNode node : canvas.getNodes()) {
                map.put(node.getId(), node);
            }
        }
        return map;
    }

    private java.util.Set<String> indexEdges(Canvas canvas) {
        java.util.Set<String> set = new LinkedHashSet<>();
        if (canvas != null && canvas.getEdges() != null) {
            for (Canvas.CanvasEdge edge : canvas.getEdges()) {
                set.add(edge.getSource() + "->" + edge.getTarget() + ":" + edge.getRelation());
            }
        }
        return set;
    }

    private boolean nodeEquals(Canvas.CanvasNode a, Canvas.CanvasNode b) {
        // position 只影响布局；type、label 和 data 都属于业务变更。
        if (!Objects.equals(a.getType(), b.getType())
                || !Objects.equals(a.getLabel(), b.getLabel())) {
            return false;
        }
        try {
            String jsonA = objectMapper.writeValueAsString(a.getData());
            String jsonB = objectMapper.writeValueAsString(b.getData());
            return jsonA.equals(jsonB);
        } catch (Exception e) {
            return false;
        }
    }

    // ==================== 私有工具方法 ====================

    private void checkOwner(Decision decision) {
        if (!Objects.equals(decision.getUserId(), getCurrentUserId())) {
            throw new BusinessException(
                    ErrorCode.NOT_FOUND,
                    "决策问题不存在"
            );
        }
    }

    private void deleteDecisionRelations(Long decisionId) {
        reportMapper.delete(
                new LambdaQueryWrapper<Report>()
                        .eq(Report::getDecisionId, decisionId)
        );
        analysisResultMapper.delete(
                new LambdaQueryWrapper<AnalysisResult>()
                        .eq(AnalysisResult::getDecisionId, decisionId)
        );

        List<Long> taskIds = analysisTaskMapper.selectList(
                        new LambdaQueryWrapper<AnalysisTask>()
                                .eq(AnalysisTask::getDecisionId, decisionId)
                ).stream()
                .map(AnalysisTask::getId)
                .toList();
        if (!taskIds.isEmpty()) {
            analysisStepMapper.delete(
                    new LambdaQueryWrapper<AnalysisStep>()
                            .in(AnalysisStep::getRunId, taskIds)
            );
        }

        analysisTaskMapper.delete(
                new LambdaQueryWrapper<AnalysisTask>()
                        .eq(AnalysisTask::getDecisionId, decisionId)
        );
        decisionCanvasMapper.delete(
                new LambdaQueryWrapper<DecisionCanvas>()
                        .eq(DecisionCanvas::getDecisionId, decisionId)
        );
        decisionFactorMapper.delete(
                new LambdaQueryWrapper<DecisionFactor>()
                        .eq(DecisionFactor::getDecisionId, decisionId)
        );
        decisionSolutionMapper.delete(
                new LambdaQueryWrapper<DecisionSolution>()
                        .eq(DecisionSolution::getDecisionId, decisionId)
        );
    }

    private Map<String, Canvas.CanvasEdge> indexEdgeMap(Canvas canvas) {
        Map<String, Canvas.CanvasEdge> map = new LinkedHashMap<>();
        if (canvas != null && canvas.getEdges() != null) {
            for (Canvas.CanvasEdge edge : canvas.getEdges()) {
                String signature = edge.getSource() + "->" + edge.getTarget() + ":" + edge.getRelation();
                map.put(signature, edge);
            }
        }
        return map;
    }

    private void addBusinessEndpoint(List<String> changed, String nodeId) {
        if (nodeId != null && !"root".equals(nodeId) && !changed.contains(nodeId)) changed.add(nodeId);
    }

    private AnalysisResult getAnalysisResultOrThrow(
            Long decisionId,
            String analysisResultId) {
        Long resultId = parseId(
                analysisResultId,
                "ar_",
                "analysisResultId"
        );
        AnalysisResult result = analysisResultMapper.selectById(resultId);
        if (result == null
                || !Objects.equals(result.getDecisionId(), decisionId)) {
            throw new BusinessException(
                    ErrorCode.NOT_FOUND,
                    "分析结果不存在"
            );
        }
        return result;
    }

    private Option getOptionOrThrow(
            AnalysisResult result,
            String optionId) {
        if (!StringUtils.hasText(optionId)
                || !optionId.startsWith("opt_")) {
            throw new BusinessException(
                    ErrorCode.BAD_REQUEST,
                    "optionId 格式错误"
            );
        }

        AnalysisResultDto resultDto =
                parseAnalysisResultDto(result.getResultData());
        if (resultDto.getOptions() == null) {
            throw new BusinessException(
                    ErrorCode.BAD_REQUEST,
                    "所选方案不属于该分析结果"
            );
        }

        return resultDto.getOptions().stream()
                .filter(option -> optionId.equals(option.getId()))
                .findFirst()
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.BAD_REQUEST,
                        "所选方案不属于该分析结果"
                ));
    }

    private void checkCurrentPendingResult(Decision decision, AnalysisResult result) {
        if (!Set.of(DecisionStatus.WAITING_CONFIRM.name(), DecisionStatus.COMPLETED.name())
                .contains(decision.getStatus())) {
            throw new BusinessException(ErrorCode.CONFLICT, "当前决策状态不允许操作待确认结果");
        }
        if (!Boolean.TRUE.equals(decision.getHasPendingResult())
                || decision.getPendingResultId() == null
                || !Objects.equals(decision.getPendingResultId(), result.getId())) {
            throw new BusinessException(ErrorCode.CONFLICT, "该分析结果已不是当前待确认草案");
        }
    }

    private Long getCurrentUserId() {
        return (Long) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
    }

    /**
     * 解析对外ID为数据库自增ID
     * @param externalId 格式 "{prefix}{数字}"，如 "d_20001"
     * @param prefix 前缀，如 "d_"
     */
    private Long parseId(String externalId, String prefix) {
        if (externalId == null || !externalId.startsWith(prefix)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST,
                    "ID 格式错误: " + externalId);
        }
        try {
            return Long.parseLong(externalId.substring(prefix.length()));
        } catch (NumberFormatException e) {
            throw new BusinessException(ErrorCode.BAD_REQUEST,
                    "ID 格式错误: " + externalId);
        }
    }

    private Long parseId(String externalId, String prefix, String fieldName) {
        if (externalId == null || !externalId.startsWith(prefix)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST,
                    fieldName + " 格式错误");
        }
        try {
            return Long.parseLong(externalId.substring(prefix.length()));
        } catch (NumberFormatException e) {
            throw new BusinessException(ErrorCode.BAD_REQUEST,
                    fieldName + " 格式错误");
        }
    }

    /**
     * 解析 AnalysisResult.resultData JSON 为 AnalysisResultDto
     */
    private AnalysisResultDto parseAnalysisResultDto(String resultData) {
        if (resultData == null || resultData.isBlank()) {
            return new AnalysisResultDto();
        }
        try {
            return objectMapper.readValue(resultData, AnalysisResultDto.class);
        } catch (Exception e) {
            return new AnalysisResultDto();
        }
    }

    /**
     * 从已确认的分析结果构建结构化报告内容
     */
    private ReportContent buildReportContent(Decision decision, AnalysisResultDto dto) {
        return ReportContent.builder()
                .background(decision.getBackground())
                .objective(decision.getGoal())
                .factorAnalysis(dto.getFactors() != null
                        ? dto.getFactors().stream()
                            .map(f -> ReportContent.FactorItem.builder()
                                    .name(f.getName())
                                    .weight(f.getWeight())
                                    .description(f.getDescription())
                                    .build())
                            .collect(Collectors.toList())
                        : Collections.emptyList())
                .optionComparison(dto.getOptions() != null
                        ? dto.getOptions().stream()
                            .map(o -> ReportContent.OptionComparison.builder()
                                    .name(o.getName())
                                    .pros(o.getPros())
                                    .cons(o.getCons())
                                    .risks(o.getRisks())
                                    .scores(o.getScores())
                                    .build())
                            .collect(Collectors.toList())
                        : Collections.emptyList())
                .conclusion(dto.getRecommendation() != null
                        ? dto.getRecommendation().getReason()
                        : null)
                .riskAnalysis(dto.getOptions() != null
                        ? dto.getOptions().stream()
                            .flatMap(o -> o.getRisks() != null
                                    ? o.getRisks().stream()
                                    : Stream.empty())
                            .distinct()
                            .collect(Collectors.toList())
                        : Collections.emptyList())
                .nextActions(dto.getNextActions())
                .build();
    }

    private DecisionVO toVO(Decision entity) {
        return DecisionVO.builder()
                .id("d_" + entity.getId())
                .title(entity.getTitle())
                .background(entity.getBackground())
                .goal(entity.getGoal())
                .constraints(entity.getConstraints())
                .status(entity.getStatus())
                .preferredOptionId(entity.getPreferredOptionId())
                .latestTaskId(entity.getLatestTaskId() != null
                        ? "t_" + entity.getLatestTaskId() : null)
                .hasPendingResult(entity.getHasPendingResult())
                .pendingResultId(entity.getPendingResultId() != null
                        ? "ar_" + entity.getPendingResultId() : null)
                .createdAt(formatTime(entity.getCreatedAt()))
                .updatedAt(formatTime(entity.getUpdatedAt()))
                .build();
    }

    /**
     * 数据库存的是不带时区的 LocalDateTime。
     * 接口要求返回 +08:00 这样的偏移，因此格式化前先补上系统时区。
     */
    private String formatTime(LocalDateTime time) {
        if (time == null) {
            return null;
        }
        return time.atZone(ZoneId.systemDefault()).format(ISO_FORMATTER);
    }
}
