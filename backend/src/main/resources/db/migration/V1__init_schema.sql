CREATE DATABASE IF NOT EXISTS ai_decision
    DEFAULT CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE ai_decision;

CREATE TABLE user (
                      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用户ID',
                      username VARCHAR(50) NOT NULL COMMENT '用户名',
                      password_hash VARCHAR(255) NOT NULL COMMENT '密码哈希',
                      nickname VARCHAR(50) DEFAULT NULL COMMENT '昵称',
                      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

                      PRIMARY KEY (id),
                      UNIQUE KEY uk_user_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

CREATE TABLE decision (
                          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '决策问题ID',
                          user_id BIGINT UNSIGNED NOT NULL COMMENT '所属用户ID',

                          title VARCHAR(200) NOT NULL COMMENT '决策问题标题',
                          background TEXT COMMENT '问题背景',
                          goal TEXT COMMENT '决策目标',
                          constraints_text TEXT COMMENT '约束条件',

                          status VARCHAR(30) NOT NULL DEFAULT 'PENDING_ANALYSIS'
                              COMMENT '决策状态',

                          selected_solution_id BIGINT UNSIGNED DEFAULT NULL
                              COMMENT '用户最终倾向的方案ID',

                          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

                          PRIMARY KEY (id),
                          KEY idx_decision_user_id (user_id),
                          KEY idx_decision_status (status),

                          CONSTRAINT fk_decision_user
                              FOREIGN KEY (user_id)
                                  REFERENCES user(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='决策问题表';

CREATE TABLE agent_run (
                           id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '推演任务ID',
                           decision_id BIGINT UNSIGNED NOT NULL COMMENT '决策问题ID',

                           run_type VARCHAR(30) NOT NULL DEFAULT 'FULL'
                               COMMENT '推演类型：FULL / PARTIAL',

                           status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
                               COMMENT '任务状态',

                           current_step INT DEFAULT NULL COMMENT '当前步骤序号',
                           total_steps INT DEFAULT NULL COMMENT '总步骤数',

                           started_at DATETIME DEFAULT NULL,
                           finished_at DATETIME DEFAULT NULL,

                           error_message TEXT DEFAULT NULL COMMENT '失败信息',

                           created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                           updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

                           PRIMARY KEY (id),
                           KEY idx_agent_run_decision_id (decision_id),
                           KEY idx_agent_run_status (status),

                           CONSTRAINT fk_agent_run_decision
                               FOREIGN KEY (decision_id)
                                   REFERENCES decision(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Agent推演任务表';

CREATE TABLE agent_step (
                            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '步骤ID',
                            run_id BIGINT UNSIGNED NOT NULL COMMENT '所属推演任务',

                            step_order INT NOT NULL COMMENT '步骤顺序',
                            step_name VARCHAR(100) NOT NULL COMMENT '步骤名称',

                            status VARCHAR(30) NOT NULL DEFAULT 'WAITING'
                                COMMENT 'WAITING/RUNNING/SUCCESS/FAILED',

                            input_data JSON DEFAULT NULL COMMENT '步骤输入',
                            output_data JSON DEFAULT NULL COMMENT '步骤结构化输出',

                            error_message TEXT DEFAULT NULL COMMENT '错误信息',

                            started_at DATETIME DEFAULT NULL,
                            finished_at DATETIME DEFAULT NULL,

                            retry_count INT NOT NULL DEFAULT 0 COMMENT '重试次数',

                            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

                            PRIMARY KEY (id),

                            UNIQUE KEY uk_agent_step_order (run_id, step_order),
                            KEY idx_agent_step_run_id (run_id),
                            KEY idx_agent_step_status (status),

                            CONSTRAINT fk_agent_step_run
                                FOREIGN KEY (run_id)
                                    REFERENCES agent_run(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Agent推演步骤表';

CREATE TABLE decision_factor (
                                 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '因素ID',
                                 decision_id BIGINT UNSIGNED NOT NULL COMMENT '决策问题ID',

                                 name VARCHAR(100) NOT NULL COMMENT '因素名称',
                                 description TEXT DEFAULT NULL COMMENT '因素描述',

                                 weight DECIMAL(5,2) DEFAULT NULL COMMENT '因素权重',

                                 sort_order INT NOT NULL DEFAULT 0 COMMENT '排序',

                                 source VARCHAR(30) NOT NULL DEFAULT 'AI'
                                     COMMENT 'AI生成 / USER用户添加',

                                 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

                                 PRIMARY KEY (id),
                                 KEY idx_factor_decision_id (decision_id),

                                 CONSTRAINT fk_factor_decision
                                     FOREIGN KEY (decision_id)
                                         REFERENCES decision(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='决策影响因素表';

CREATE TABLE decision_solution (
                                   id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '方案ID',
                                   decision_id BIGINT UNSIGNED NOT NULL COMMENT '决策问题ID',

                                   name VARCHAR(200) NOT NULL COMMENT '方案名称',
                                   description TEXT DEFAULT NULL COMMENT '方案描述',

                                   advantages JSON DEFAULT NULL COMMENT '优点',
                                   disadvantages JSON DEFAULT NULL COMMENT '缺点',
                                   risks JSON DEFAULT NULL COMMENT '风险',

                                   cost_score DECIMAL(5,2) DEFAULT NULL COMMENT '成本评分',
                                   time_score DECIMAL(5,2) DEFAULT NULL COMMENT '时间评分',
                                   benefit_score DECIMAL(5,2) DEFAULT NULL COMMENT '收益评分',
                                   risk_score DECIMAL(5,2) DEFAULT NULL COMMENT '风险评分',
                                   feasibility_score DECIMAL(5,2) DEFAULT NULL COMMENT '可执行性评分',

                                   sort_order INT NOT NULL DEFAULT 0,

                                   created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                   updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

                                   PRIMARY KEY (id),
                                   KEY idx_solution_decision_id (decision_id),

                                   CONSTRAINT fk_solution_decision
                                       FOREIGN KEY (decision_id)
                                           REFERENCES decision(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='决策候选方案表';

CREATE TABLE decision_canvas (
                                 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '画布ID',
                                 decision_id BIGINT UNSIGNED NOT NULL COMMENT '决策问题ID',

                                 canvas_data JSON NOT NULL COMMENT '画布节点及布局数据',

                                 version INT NOT NULL DEFAULT 1 COMMENT '画布版本',

                                 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

                                 PRIMARY KEY (id),
                                 UNIQUE KEY uk_canvas_decision_id (decision_id),

                                 CONSTRAINT fk_canvas_decision
                                     FOREIGN KEY (decision_id)
                                         REFERENCES decision(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='决策画布表';


CREATE TABLE decision_report (
                                 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '报告ID',
                                 decision_id BIGINT UNSIGNED NOT NULL COMMENT '决策问题ID',

                                 content JSON NOT NULL COMMENT '结构化报告内容',

                                 version INT NOT NULL DEFAULT 1 COMMENT '报告版本',

                                 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

                                 PRIMARY KEY (id),
                                 KEY idx_report_decision_id (decision_id),

                                 CONSTRAINT fk_report_decision
                                     FOREIGN KEY (decision_id)
                                         REFERENCES decision(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='决策报告表';