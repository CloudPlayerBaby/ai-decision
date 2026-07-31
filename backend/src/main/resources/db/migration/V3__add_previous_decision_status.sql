-- ============================================================
-- V3: Add previous_decision_status to agent_run
-- ============================================================

ALTER TABLE agent_run
    ADD COLUMN previous_decision_status VARCHAR(30) DEFAULT NULL COMMENT '局部推演开始前的决策状态，用于失败或完成后恢复';
