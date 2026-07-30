-- ============================================================
-- V2: 对齐 API v2.0 接口手册
--     1. sys_user 补 email
--     2. decision 补字段 + 统一状态注释
--     3. agent_run / agent_step 状态值 SUCCESS → SUCCEEDED
--     4. 新增 analysis_result 表
-- ============================================================

-- ============================================================
-- 1. sys_user：补充邮箱字段（API 5.1 要求邮箱注册）
-- ============================================================
ALTER TABLE sys_user
    ADD COLUMN email VARCHAR(100) DEFAULT NULL COMMENT '邮箱' AFTER username,
    ADD UNIQUE KEY uk_user_email (email);

-- ============================================================
-- 2. decision：对齐 API v2.0 4.1 节字段
-- ============================================================
-- 重命名约束条件列名（constraints_text → constraints）
ALTER TABLE decision
    CHANGE COLUMN constraints_text constraints TEXT DEFAULT NULL COMMENT '约束条件，自由文本';

-- 重命名选中方案列名（selected_solution_id → preferred_option_id）
ALTER TABLE decision
    CHANGE COLUMN selected_solution_id preferred_option_id BIGINT UNSIGNED DEFAULT NULL
        COMMENT '用户当前倾向方案ID';

-- 补充 API v2.0 新增字段
ALTER TABLE decision
    ADD COLUMN latest_task_id BIGINT UNSIGNED DEFAULT NULL
        COMMENT '最近一次推演任务ID' AFTER preferred_option_id,
    ADD COLUMN has_pending_result TINYINT(1) NOT NULL DEFAULT 0
        COMMENT '是否存在待用户确认的新分析草案' AFTER latest_task_id,
    ADD COLUMN pending_result_id BIGINT UNSIGNED DEFAULT NULL
        COMMENT '待确认草案的 analysis_result_id' AFTER has_pending_result,
    ADD COLUMN report_id BIGINT UNSIGNED DEFAULT NULL
        COMMENT '当前最新报告ID，确认结果时同步更新' AFTER pending_result_id;

-- 更新状态列注释，对齐 API v2.0 3.1 节
ALTER TABLE decision
    MODIFY COLUMN status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
        COMMENT '决策状态：PENDING / ANALYZING / PARTIAL_ANALYZING / WAITING_CONFIRM / COMPLETED / FAILED';

-- ============================================================
-- 3. agent_run / agent_step：状态值对齐 API
--    API 统一用 SUCCEEDED，不用 SUCCESS
-- ============================================================
ALTER TABLE agent_run
    MODIFY COLUMN status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
        COMMENT '任务状态：PENDING / RUNNING / SUCCEEDED / FAILED';

ALTER TABLE agent_step
    MODIFY COLUMN status VARCHAR(30) NOT NULL DEFAULT 'WAITING'
        COMMENT '步骤状态：WAITING / RUNNING / SUCCEEDED / FAILED';

-- ============================================================
-- 4. 新增 analysis_result 表（API v2.0 4.2 节核心概念）
--    每次 AI 推演通过校验后生成一条待确认草案
--    analysisResultId 贯穿选择方案、确认结果、局部重推流程
-- ============================================================
CREATE TABLE analysis_result (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '分析结果ID（对外映射为 ar_xxx）',

    decision_id BIGINT UNSIGNED NOT NULL COMMENT '所属决策问题ID',
    task_id BIGINT UNSIGNED NOT NULL COMMENT '产生该结果的推演任务ID',

    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_CONFIRM'
        COMMENT '草案状态：PENDING_CONFIRM（待确认）/ CONFIRMED（已确认）',

    -- 结构化分析内容（API 4.2 完整字段，JSON 快照）
    result_data JSON NOT NULL COMMENT '完整分析结果：
      understanding  - 问题理解
      factors[]      - 关键因素（id, name, weight, description）
      options[]      - 候选方案（id, name, pros[], cons[], risks[], scores{})
      recommendation - 推荐 optionId + reason
      nextActions[]  - 下一步行动建议
      canvas         - 画布快照
      validation     - schemaValid, repaired, warnings
    ',

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY idx_ar_decision_id (decision_id),
    KEY idx_ar_task_id (task_id),
    KEY idx_ar_status (status),

    CONSTRAINT fk_ar_decision
        FOREIGN KEY (decision_id) REFERENCES decision(id),
    CONSTRAINT fk_ar_task
        FOREIGN KEY (task_id) REFERENCES agent_run(id)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
    COMMENT='AI分析结果草案表（通过校验的AI推演结果）';
