package qg.po.midterm.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import tools.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import qg.po.midterm.common.enums.ErrorCode;
import qg.po.midterm.common.exception.BusinessException;
import qg.po.midterm.dto.result.AnalysisResultDto;
import qg.po.midterm.dto.result.ReportContent;
import qg.po.midterm.entity.AnalysisResult;
import qg.po.midterm.entity.Decision;
import qg.po.midterm.entity.Report;
import qg.po.midterm.mapper.AnalysisResultMapper;
import qg.po.midterm.mapper.DecisionMapper;
import qg.po.midterm.mapper.ReportMapper;
import qg.po.midterm.service.ReportService;
import qg.po.midterm.vo.ReportSummaryVO;
import qg.po.midterm.vo.ReportVO;
import qg.po.midterm.workflow.agent.ReportAgent;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * 报告服务实现（API v2.0 第 11 节）
 */
@Service
@RequiredArgsConstructor
public class ReportServiceImpl implements ReportService {

    private final ReportMapper reportMapper;
    private final DecisionMapper decisionMapper;
    private final AnalysisResultMapper analysisResultMapper;
    private final ObjectMapper objectMapper;
    private final ReportAgent reportAgent;

    private static final DateTimeFormatter ISO_FORMATTER =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ssXXX");

    @Override
    public ReportVO getReport(String reportId) {
        Report report = findReportOrThrow(reportId);
        return toReportVO(report);
    }

    @Override
    public ReportVO getReportByDecision(String decisionId) {
        Long id = parseId(decisionId, "d_", "decisionId");
        Decision decision = decisionMapper.selectById(id);
        if (decision == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "决策问题不存在");
        }
        checkOwner(decision);
        if (decision.getReportId() == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "该决策尚无报告");
        }
        Report report = reportMapper.selectById(decision.getReportId());
        if (report == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "报告不存在");
        }
        return toReportVO(report);
    }

    @Override
    public List<ReportSummaryVO> getReportHistory(String decisionId) {
        Long id = parseId(decisionId, "d_", "decisionId");
        Decision decision = decisionMapper.selectById(id);
        if (decision == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "决策问题不存在");
        }
        checkOwner(decision);

        List<Report> reports = reportMapper.selectList(
                new LambdaQueryWrapper<Report>()
                        .eq(Report::getDecisionId, id)
                        .orderByDesc(Report::getCreatedAt)
        );
        return reports.stream()
                .map(r -> ReportSummaryVO.builder()
                        .id("r_" + r.getId())
                        .analysisResultId(toAnalysisResultId(r))
                        .status("READY")
                        .generatedAt(r.getCreatedAt() != null
                                ? r.getCreatedAt().atZone(ZoneId.systemDefault()).format(ISO_FORMATTER)
                                : null)
                        .build())
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public ReportVO regenerateReport(String decisionId) {
        Long id = parseId(decisionId, "d_", "decisionId");
        Decision decision = decisionMapper.selectById(id);
        if (decision == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "决策问题不存在");
        }
        checkOwner(decision);
        if (decision.getReportId() == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "该决策尚无报告，请先确认分析结果");
        }

        // 找到已确认的分析结果
        AnalysisResult confirmed = findConfirmedResult(id);
        if (confirmed == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "没有已确认的分析结果");
        }

        // 格式化报告内容（调用AI）
        String selectedOptionName = null;
        if (decision.getPreferredOptionId() != null) {
            AnalysisResultDto dto = parseAnalysisResultDto(confirmed.getResultData());
            String optId = decision.getPreferredOptionId();
            if (dto.getOptions() != null) {
                selectedOptionName = dto.getOptions().stream()
                        .filter(o -> o.getId() != null && o.getId().equals(optId))
                        .map(qg.po.midterm.workflow.state.Option::getName)
                        .findFirst()
                        .orElse(null);
            }
        }
        ReportContent newContent = reportAgent.generateReport(confirmed.getResultData(), selectedOptionName);

        // 创建新报告（保留历史）
        LocalDateTime now = LocalDateTime.now();
        Report report = new Report();
        report.setDecisionId(id);
        report.setAnalysisResultId(confirmed.getId());
        report.setContent(toJson(newContent));
        report.setCreatedAt(now);
        reportMapper.insert(report);

        // 更新决策指向新报告
        decision.setReportId(report.getId());
        decision.setUpdatedAt(now);
        decisionMapper.updateById(decision);

        return toReportVO(report);
    }

    // ==================== 私有方法 ====================

    private Report findReportOrThrow(String reportId) {
        Long id = parseId(reportId, "r_", "reportId");
        Report report = reportMapper.selectById(id);
        if (report == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "报告不存在");
        }
        Decision decision = decisionMapper.selectById(report.getDecisionId());
        if (decision == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "报告不存在");
        }
        checkOwner(decision);
        return report;
    }

    private AnalysisResult findConfirmedResult(Long decisionId) {
        LambdaQueryWrapper<AnalysisResult> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(AnalysisResult::getDecisionId, decisionId)
                .eq(AnalysisResult::getStatus, "CONFIRMED")
                .orderByDesc(AnalysisResult::getUpdatedAt)
                .last("LIMIT 1");
        return analysisResultMapper.selectOne(wrapper);
    }

    private String toAnalysisResultId(Report report) {
        return report.getAnalysisResultId() != null
                ? "ar_" + report.getAnalysisResultId()
                : null;
    }

    private ReportVO toReportVO(Report report) {
        ReportContent content = parseReportContent(report.getContent());

        return ReportVO.builder()
                .id("r_" + report.getId())
                .decisionId("d_" + report.getDecisionId())
                .analysisResultId(toAnalysisResultId(report))
                .status("READY")
                .content(content)
                .generatedAt(report.getCreatedAt() != null
                        ? report.getCreatedAt().atZone(ZoneId.systemDefault()).format(ISO_FORMATTER)
                        : null)
                .build();
    }

    private void checkOwner(Decision decision) {
        if (!Objects.equals(decision.getUserId(), getCurrentUserId())) {
            throw new BusinessException(
                    ErrorCode.NOT_FOUND,
                    "报告不存在"
            );
        }
    }

    private Long getCurrentUserId() {
        return (Long) SecurityContextHolder.getContext()
                .getAuthentication()
                .getPrincipal();
    }

    /**
     * 从已确认的分析结果构建结构化报告内容
     */
    private ReportContent buildReportContent(Decision decision, AnalysisResultDto dto) {
        return ReportContent.builder()
                .background(decision != null ? decision.getBackground() : null)
                .objective(decision != null ? decision.getGoal() : null)
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
                                    : java.util.stream.Stream.empty())
                            .distinct()
                            .collect(Collectors.toList())
                        : Collections.emptyList())
                .nextActions(dto.getNextActions())
                .build();
    }

    private AnalysisResultDto parseAnalysisResultDto(String json) {
        if (json == null || json.isBlank()) {
            return new AnalysisResultDto();
        }
        try {
            return objectMapper.readValue(json, AnalysisResultDto.class);
        } catch (Exception e) {
            return new AnalysisResultDto();
        }
    }

    private ReportContent parseReportContent(String json) {
        if (json == null || json.isBlank()) {
            return ReportContent.builder().build();
        }
        try {
            return objectMapper.readValue(json, ReportContent.class);
        } catch (Exception e) {
            AnalysisResultDto dto = parseAnalysisResultDto(json);
            return buildReportContent(null, dto);
        }
    }

    private String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "报告序列化失败");
        }
    }

    private Long parseId(String externalId, String prefix, String fieldName) {
        if (externalId == null || !externalId.startsWith(prefix)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, fieldName + " 格式错误");
        }
        try {
            return Long.parseLong(externalId.substring(prefix.length()));
        } catch (NumberFormatException e) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, fieldName + " 格式错误");
        }
    }
}
