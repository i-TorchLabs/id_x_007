-- id_x_007 固定 30 分钟时段定义（slot-01 ~ slot-24）。
-- 幂等：重复执行仅校准起止时刻与排序，不影响既有排期引用。

-- slot-01（09:00-09:30）：固定 30 分钟时段定义。
INSERT INTO pa_slot_def (code, start_clock, end_clock, sort_no, state, create_time, update_time)
VALUES ('slot-01', '09:00', '09:30', 1, '1', NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET
    start_clock = EXCLUDED.start_clock,
    end_clock = EXCLUDED.end_clock,
    sort_no = EXCLUDED.sort_no;

-- slot-02（09:30-10:00）：固定 30 分钟时段定义。
INSERT INTO pa_slot_def (code, start_clock, end_clock, sort_no, state, create_time, update_time)
VALUES ('slot-02', '09:30', '10:00', 2, '1', NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET
    start_clock = EXCLUDED.start_clock,
    end_clock = EXCLUDED.end_clock,
    sort_no = EXCLUDED.sort_no;

-- slot-03（10:00-10:30）：固定 30 分钟时段定义。
INSERT INTO pa_slot_def (code, start_clock, end_clock, sort_no, state, create_time, update_time)
VALUES ('slot-03', '10:00', '10:30', 3, '1', NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET
    start_clock = EXCLUDED.start_clock,
    end_clock = EXCLUDED.end_clock,
    sort_no = EXCLUDED.sort_no;

-- slot-04（10:30-11:00）：固定 30 分钟时段定义。
INSERT INTO pa_slot_def (code, start_clock, end_clock, sort_no, state, create_time, update_time)
VALUES ('slot-04', '10:30', '11:00', 4, '1', NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET
    start_clock = EXCLUDED.start_clock,
    end_clock = EXCLUDED.end_clock,
    sort_no = EXCLUDED.sort_no;

-- slot-05（11:00-11:30）：固定 30 分钟时段定义。
INSERT INTO pa_slot_def (code, start_clock, end_clock, sort_no, state, create_time, update_time)
VALUES ('slot-05', '11:00', '11:30', 5, '1', NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET
    start_clock = EXCLUDED.start_clock,
    end_clock = EXCLUDED.end_clock,
    sort_no = EXCLUDED.sort_no;

-- slot-06（11:30-12:00）：固定 30 分钟时段定义。
INSERT INTO pa_slot_def (code, start_clock, end_clock, sort_no, state, create_time, update_time)
VALUES ('slot-06', '11:30', '12:00', 6, '1', NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET
    start_clock = EXCLUDED.start_clock,
    end_clock = EXCLUDED.end_clock,
    sort_no = EXCLUDED.sort_no;

-- slot-07（12:00-12:30）：固定 30 分钟时段定义。
INSERT INTO pa_slot_def (code, start_clock, end_clock, sort_no, state, create_time, update_time)
VALUES ('slot-07', '12:00', '12:30', 7, '1', NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET
    start_clock = EXCLUDED.start_clock,
    end_clock = EXCLUDED.end_clock,
    sort_no = EXCLUDED.sort_no;

-- slot-08（12:30-13:00）：固定 30 分钟时段定义。
INSERT INTO pa_slot_def (code, start_clock, end_clock, sort_no, state, create_time, update_time)
VALUES ('slot-08', '12:30', '13:00', 8, '1', NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET
    start_clock = EXCLUDED.start_clock,
    end_clock = EXCLUDED.end_clock,
    sort_no = EXCLUDED.sort_no;

-- slot-09（13:00-13:30）：固定 30 分钟时段定义。
INSERT INTO pa_slot_def (code, start_clock, end_clock, sort_no, state, create_time, update_time)
VALUES ('slot-09', '13:00', '13:30', 9, '1', NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET
    start_clock = EXCLUDED.start_clock,
    end_clock = EXCLUDED.end_clock,
    sort_no = EXCLUDED.sort_no;

-- slot-10（13:30-14:00）：固定 30 分钟时段定义。
INSERT INTO pa_slot_def (code, start_clock, end_clock, sort_no, state, create_time, update_time)
VALUES ('slot-10', '13:30', '14:00', 10, '1', NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET
    start_clock = EXCLUDED.start_clock,
    end_clock = EXCLUDED.end_clock,
    sort_no = EXCLUDED.sort_no;

-- slot-11（14:00-14:30）：固定 30 分钟时段定义。
INSERT INTO pa_slot_def (code, start_clock, end_clock, sort_no, state, create_time, update_time)
VALUES ('slot-11', '14:00', '14:30', 11, '1', NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET
    start_clock = EXCLUDED.start_clock,
    end_clock = EXCLUDED.end_clock,
    sort_no = EXCLUDED.sort_no;

-- slot-12（14:30-15:00）：固定 30 分钟时段定义。
INSERT INTO pa_slot_def (code, start_clock, end_clock, sort_no, state, create_time, update_time)
VALUES ('slot-12', '14:30', '15:00', 12, '1', NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET
    start_clock = EXCLUDED.start_clock,
    end_clock = EXCLUDED.end_clock,
    sort_no = EXCLUDED.sort_no;

-- slot-13（15:00-15:30）：固定 30 分钟时段定义。
INSERT INTO pa_slot_def (code, start_clock, end_clock, sort_no, state, create_time, update_time)
VALUES ('slot-13', '15:00', '15:30', 13, '1', NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET
    start_clock = EXCLUDED.start_clock,
    end_clock = EXCLUDED.end_clock,
    sort_no = EXCLUDED.sort_no;

-- slot-14（15:30-16:00）：固定 30 分钟时段定义。
INSERT INTO pa_slot_def (code, start_clock, end_clock, sort_no, state, create_time, update_time)
VALUES ('slot-14', '15:30', '16:00', 14, '1', NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET
    start_clock = EXCLUDED.start_clock,
    end_clock = EXCLUDED.end_clock,
    sort_no = EXCLUDED.sort_no;

-- slot-15（16:00-16:30）：固定 30 分钟时段定义。
INSERT INTO pa_slot_def (code, start_clock, end_clock, sort_no, state, create_time, update_time)
VALUES ('slot-15', '16:00', '16:30', 15, '1', NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET
    start_clock = EXCLUDED.start_clock,
    end_clock = EXCLUDED.end_clock,
    sort_no = EXCLUDED.sort_no;

-- slot-16（16:30-17:00）：固定 30 分钟时段定义。
INSERT INTO pa_slot_def (code, start_clock, end_clock, sort_no, state, create_time, update_time)
VALUES ('slot-16', '16:30', '17:00', 16, '1', NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET
    start_clock = EXCLUDED.start_clock,
    end_clock = EXCLUDED.end_clock,
    sort_no = EXCLUDED.sort_no;

-- slot-17（17:00-17:30）：固定 30 分钟时段定义。
INSERT INTO pa_slot_def (code, start_clock, end_clock, sort_no, state, create_time, update_time)
VALUES ('slot-17', '17:00', '17:30', 17, '1', NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET
    start_clock = EXCLUDED.start_clock,
    end_clock = EXCLUDED.end_clock,
    sort_no = EXCLUDED.sort_no;

-- slot-18（17:30-18:00）：固定 30 分钟时段定义。
INSERT INTO pa_slot_def (code, start_clock, end_clock, sort_no, state, create_time, update_time)
VALUES ('slot-18', '17:30', '18:00', 18, '1', NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET
    start_clock = EXCLUDED.start_clock,
    end_clock = EXCLUDED.end_clock,
    sort_no = EXCLUDED.sort_no;

-- slot-19（18:00-18:30）：固定 30 分钟时段定义。
INSERT INTO pa_slot_def (code, start_clock, end_clock, sort_no, state, create_time, update_time)
VALUES ('slot-19', '18:00', '18:30', 19, '1', NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET
    start_clock = EXCLUDED.start_clock,
    end_clock = EXCLUDED.end_clock,
    sort_no = EXCLUDED.sort_no;

-- slot-20（18:30-19:00）：固定 30 分钟时段定义。
INSERT INTO pa_slot_def (code, start_clock, end_clock, sort_no, state, create_time, update_time)
VALUES ('slot-20', '18:30', '19:00', 20, '1', NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET
    start_clock = EXCLUDED.start_clock,
    end_clock = EXCLUDED.end_clock,
    sort_no = EXCLUDED.sort_no;

-- slot-21（19:00-19:30）：固定 30 分钟时段定义。
INSERT INTO pa_slot_def (code, start_clock, end_clock, sort_no, state, create_time, update_time)
VALUES ('slot-21', '19:00', '19:30', 21, '1', NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET
    start_clock = EXCLUDED.start_clock,
    end_clock = EXCLUDED.end_clock,
    sort_no = EXCLUDED.sort_no;

-- slot-22（19:30-20:00）：固定 30 分钟时段定义。
INSERT INTO pa_slot_def (code, start_clock, end_clock, sort_no, state, create_time, update_time)
VALUES ('slot-22', '19:30', '20:00', 22, '1', NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET
    start_clock = EXCLUDED.start_clock,
    end_clock = EXCLUDED.end_clock,
    sort_no = EXCLUDED.sort_no;

-- slot-23（20:00-20:30）：固定 30 分钟时段定义。
INSERT INTO pa_slot_def (code, start_clock, end_clock, sort_no, state, create_time, update_time)
VALUES ('slot-23', '20:00', '20:30', 23, '1', NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET
    start_clock = EXCLUDED.start_clock,
    end_clock = EXCLUDED.end_clock,
    sort_no = EXCLUDED.sort_no;

-- slot-24（20:30-21:00）：固定 30 分钟时段定义。
INSERT INTO pa_slot_def (code, start_clock, end_clock, sort_no, state, create_time, update_time)
VALUES ('slot-24', '20:30', '21:00', 24, '1', NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET
    start_clock = EXCLUDED.start_clock,
    end_clock = EXCLUDED.end_clock,
    sort_no = EXCLUDED.sort_no;

