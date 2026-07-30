package qg.po.midterm.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import qg.po.midterm.common.enums.DecisionStatus;
import qg.po.midterm.common.enums.ErrorCode;
import qg.po.midterm.common.exception.BusinessException;
import qg.po.midterm.dto.request.CreateDecisionRequest;
import qg.po.midterm.entity.AnalysisResult;
import qg.po.midterm.entity.AnalysisTask;
import qg.po.midterm.entity.Decision;
import qg.po.midterm.mapper.AnalysisResultMapper;
import qg.po.midterm.mapper.AnalysisTaskMapper;
import qg.po.midterm.mapper.DecisionMapper;
import qg.po.midterm.service.DecisionService;
import qg.po.midterm.vo.DecisionDetailVO;
import qg.po.midterm.vo.DecisionVO;
import qg.po.midterm.vo.PageVO;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Set;

/**
 * 决策问题服务实现（API v2.0 第 6 节）
 */
@Service
@RequiredArgsConstructor
public class DecisionServiceImpl implements DecisionService {

    private final DecisionMapper decisionMapper;
    private final AnalysisTaskMapper analysisTaskMapper;
    private final AnalysisResultMapper analysisResultMapper;

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
    public void delete(String decisionId) {
        Long id = parseId(decisionId, "d_");
        Decision entity = decisionMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "决策问题不存在");
        }

        if (UNDELETABLE_STATUSES.contains(entity.getStatus())) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "当前状态 " + entity.getStatus() + " 不允许删除，请等待推演完成");
        }

        decisionMapper.deleteById(id);
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

    private DecisionVO toVO(Decision entity) {
        return DecisionVO.builder()
                .id("d_" + entity.getId())
                .title(entity.getTitle())
                .background(entity.getBackground())
                .goal(entity.getGoal())
                .constraints(entity.getConstraints())
                .status(entity.getStatus())
                .preferredOptionId(entity.getPreferredOptionId() != null
                        ? "d_" + entity.getPreferredOptionId() : null)
                .latestTaskId(entity.getLatestTaskId() != null
                        ? "t_" + entity.getLatestTaskId() : null)
                .hasPendingResult(entity.getHasPendingResult())
                .pendingResultId(entity.getPendingResultId() != null
                        ? "ar_" + entity.getPendingResultId() : null)
                .createdAt(entity.getCreatedAt() != null
                        ? entity.getCreatedAt().format(ISO_FORMATTER) : null)
                .updatedAt(entity.getUpdatedAt() != null
                        ? entity.getUpdatedAt().format(ISO_FORMATTER) : null)
                .build();
    }
}
