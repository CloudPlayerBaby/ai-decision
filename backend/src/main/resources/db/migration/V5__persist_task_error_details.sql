-- Persist task failure details so REST recovery matches the original SSE error.
ALTER TABLE agent_run
    ADD COLUMN error_code INT DEFAULT NULL AFTER error_message,
    ADD COLUMN missing_fields JSON DEFAULT NULL AFTER error_code,
    ADD COLUMN repair_attempted TINYINT(1) NOT NULL DEFAULT 0 AFTER missing_fields,
    ADD COLUMN retryable TINYINT(1) NOT NULL DEFAULT 0 AFTER repair_attempted;
