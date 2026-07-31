ALTER TABLE decision
    MODIFY COLUMN preferred_option_id VARCHAR(100) DEFAULT NULL
        COMMENT '用户当前倾向方案的完整 optionId';

UPDATE decision
SET preferred_option_id = CONCAT('opt_', preferred_option_id)
WHERE preferred_option_id IS NOT NULL
  AND preferred_option_id NOT LIKE 'opt_%';

ALTER TABLE decision_report
    ADD COLUMN analysis_result_id BIGINT UNSIGNED DEFAULT NULL
        COMMENT '生成该报告所使用的分析结果ID'
        AFTER decision_id,
    ADD KEY idx_report_analysis_result_id (analysis_result_id),
    ADD CONSTRAINT fk_report_analysis_result
        FOREIGN KEY (analysis_result_id)
            REFERENCES analysis_result(id);

UPDATE decision_report AS report
SET analysis_result_id = (
    SELECT result.id
    FROM analysis_result AS result
    WHERE result.decision_id = report.decision_id
      AND result.status = 'CONFIRMED'
      AND result.updated_at <= report.created_at
    ORDER BY result.updated_at DESC
    LIMIT 1
)
WHERE report.analysis_result_id IS NULL;
