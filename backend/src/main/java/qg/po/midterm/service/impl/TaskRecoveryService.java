package qg.po.midterm.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import qg.po.midterm.common.enums.DecisionStatus;
import qg.po.midterm.common.enums.ErrorCode;
import qg.po.midterm.entity.AnalysisStep;
import qg.po.midterm.entity.AnalysisTask;
import qg.po.midterm.entity.Decision;
import qg.po.midterm.mapper.AnalysisStepMapper;
import qg.po.midterm.mapper.AnalysisTaskMapper;
import qg.po.midterm.mapper.DecisionMapper;
import qg.po.midterm.service.AnalysisEventService;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Converts abandoned or timed-out runs into explicit, retryable failures. */
@Slf4j
@Service
@RequiredArgsConstructor
public class TaskRecoveryService {

    private static final int STALE_MINUTES = 10;
    private static final Set<String> RESTORABLE_STATUSES = Set.of(
            DecisionStatus.PENDING.name(),
            DecisionStatus.WAITING_CONFIRM.name(),
            DecisionStatus.COMPLETED.name(),
            DecisionStatus.FAILED.name()
    );

    private final AnalysisTaskMapper taskMapper;
    private final AnalysisStepMapper stepMapper;
    private final DecisionMapper decisionMapper;
    private final AnalysisEventService eventService;

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void recoverInterruptedTasks() {
        List<AnalysisTask> abandoned = taskMapper.selectList(new LambdaQueryWrapper<AnalysisTask>()
                .in(AnalysisTask::getStatus, "PENDING", "RUNNING"));
        for (AnalysisTask task : abandoned) {
            failTask(task, "服务重启，原分析任务已中断");
        }
        if (!abandoned.isEmpty()) log.warn("Recovered {} interrupted analysis tasks", abandoned.size());
    }

    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void failTimedOutTasks() {
        LocalDateTime deadline = LocalDateTime.now().minusMinutes(STALE_MINUTES);
        List<AnalysisTask> timedOut = taskMapper.selectList(new LambdaQueryWrapper<AnalysisTask>()
                .in(AnalysisTask::getStatus, "PENDING", "RUNNING")
                .le(AnalysisTask::getUpdatedAt, deadline));
        for (AnalysisTask task : timedOut) {
            failTask(task, "分析步骤超过10分钟没有状态更新，任务已超时");
        }
    }

    private void failTask(AnalysisTask task, String message) {
        if (!Set.of("PENDING", "RUNNING").contains(task.getStatus())) return;
        LocalDateTime now = LocalDateTime.now();
        AnalysisStep failedStep = findRecoverableStep(task);
        if (failedStep != null) {
            failedStep.setStatus("FAILED");
            failedStep.setErrorMessage(message);
            failedStep.setFinishedAt(now);
            failedStep.setUpdatedAt(now);
            stepMapper.updateById(failedStep);
        }

        task.setStatus("FAILED");
        task.setErrorMessage(message);
        task.setErrorCode(ErrorCode.INTERNAL_ERROR.getCode());
        task.setMissingFields(null);
        task.setRepairAttempted(false);
        task.setRetryable(failedStep != null);
        task.setFinishedAt(now);
        task.setUpdatedAt(now);
        taskMapper.updateById(task);

        Decision decision = decisionMapper.selectById(task.getDecisionId());
        if (decision != null) {
            String previous = task.getPreviousDecisionStatus();
            decision.setStatus(previous != null && RESTORABLE_STATUSES.contains(previous)
                    ? previous : DecisionStatus.FAILED.name());
            decision.setUpdatedAt(now);
            decisionMapper.updateById(decision);
        }

        Map<String, Object> event = new LinkedHashMap<>();
        event.put("errorCode", ErrorCode.INTERNAL_ERROR.getCode());
        event.put("message", message);
        event.put("failedStepId", failedStep == null ? null : "s_" + failedStep.getId());
        event.put("retryable", failedStep != null);
        afterCommit(() -> eventService.sendTaskFailed("t_" + task.getId(), event));
    }

    private AnalysisStep findRecoverableStep(AnalysisTask task) {
        List<AnalysisStep> steps = stepMapper.selectList(new LambdaQueryWrapper<AnalysisStep>()
                .eq(AnalysisStep::getRunId, task.getId())
                .orderByAsc(AnalysisStep::getStepOrder));
        return steps.stream()
                .filter(step -> "RUNNING".equals(step.getStatus()))
                .findFirst()
                .orElseGet(() -> steps.stream()
                        .filter(step -> !"SUCCEEDED".equals(step.getStatus()))
                        .findFirst()
                        .orElse(null));
    }

    private void afterCommit(Runnable action) {
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
}
