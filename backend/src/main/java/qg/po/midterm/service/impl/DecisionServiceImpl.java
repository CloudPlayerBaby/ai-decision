package qg.po.midterm.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import qg.po.midterm.common.enums.DecisionStatus;
import qg.po.midterm.dto.request.CreateDecisionRequest;
import qg.po.midterm.entity.Decision;
import qg.po.midterm.mapper.DecisionMapper;
import qg.po.midterm.service.DecisionService;
import qg.po.midterm.vo.DecisionVO;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * 决策问题服务实现
 */
@Service
@RequiredArgsConstructor
public class DecisionServiceImpl implements DecisionService {

    private final DecisionMapper decisionMapper;

    private static final DateTimeFormatter ISO_FORMATTER =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ssXXX");

    @Override
    public DecisionVO create(CreateDecisionRequest request) {
        Decision entity = new Decision();
        // TODO: 后续从 SecurityContext 获取真实 userId，目前写死
        entity.setUserId(1L);
        entity.setTitle(request.getTitle());
        entity.setBackground(request.getBackground());
        entity.setGoal(request.getGoal());
        entity.setConstraints(request.getConstraints());
        entity.setStatus(DecisionStatus.PENDING.name());
        entity.setHasPendingResult(false);
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());

        decisionMapper.insert(entity);

        return DecisionVO.builder()
                .id("d_" + entity.getId())
                .title(entity.getTitle())
                .status(entity.getStatus())
                .createdAt(entity.getCreatedAt().format(ISO_FORMATTER))
                .build();
    }
}
