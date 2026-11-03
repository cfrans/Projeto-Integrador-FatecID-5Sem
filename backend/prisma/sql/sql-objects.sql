CREATE FUNCTION `fn_pairing_session_status`(
    p_consumed_at DATETIME(3),
    p_revoked_at DATETIME(3),
    p_expires_at DATETIME(3)
)
RETURNS VARCHAR(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
NOT DETERMINISTIC
NO SQL
BEGIN
    IF p_revoked_at IS NOT NULL THEN
        RETURN 'revoked';
    ELSEIF p_consumed_at IS NOT NULL THEN
        RETURN 'consumed';
    ELSEIF p_expires_at <= UTC_TIMESTAMP(3) THEN
        RETURN 'expired';
    END IF;
    RETURN 'pending';
END;

CREATE VIEW `vw_device_overview` AS
SELECT
    d.`id` AS `deviceId`,
    d.`name` AS `deviceName`,
    d.`guardianId` AS `guardianId`,
    g.`name` AS `guardianName`,
    CASE WHEN d.`guardianId` IS NULL THEN 'available' ELSE 'associated' END AS `pairingState`
FROM `Device` d
LEFT JOIN `Guardian` g ON g.`id` = d.`guardianId`;

CREATE PROCEDURE `sp_revoke_device_association`(
    IN p_device_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    IN p_guardian_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
)
BEGIN
    DECLARE v_locked_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL;
    DECLARE v_association_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL;
    DECLARE v_now DATETIME(3);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
    START TRANSACTION;

    SET v_now = UTC_TIMESTAMP(3);

    SELECT `id` INTO v_locked_id FROM `Device` WHERE `id` = p_device_id FOR UPDATE;

    SELECT `id` INTO v_association_id
    FROM `DeviceAssociation`
    WHERE `deviceId` = p_device_id
      AND `guardianId` = p_guardian_id
      AND `activeDeviceId` = p_device_id
      AND `revokedAt` IS NULL;

    IF v_locked_id IS NULL OR v_association_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ASSOCIATION_NOT_FOUND';
    END IF;

    UPDATE `AgentCommand`
    SET `status` = 'cancelled'
    WHERE `deviceId` = p_device_id AND `associationId` = v_association_id AND `status` = 'pending';

    UPDATE `AgentCommand`
    SET `status` = 'unknown'
    WHERE `deviceId` = p_device_id AND `associationId` = v_association_id AND `status` = 'running';

    UPDATE `DeviceAssociation`
    SET `revokedAt` = v_now, `activeDeviceId` = NULL
    WHERE `id` = v_association_id;

    UPDATE `Device` SET `guardianId` = NULL WHERE `id` = p_device_id;

    UPDATE `PairingSession`
    SET `revokedAt` = v_now
    WHERE `deviceId` = p_device_id AND `consumedAt` IS NULL AND `revokedAt` IS NULL;

    COMMIT;
END;

CREATE TRIGGER `trg_pairing_session_keep_consumed`
BEFORE UPDATE ON `PairingSession`
FOR EACH ROW
BEGIN
    IF OLD.`consumedAt` IS NOT NULL AND NOT (NEW.`consumedAt` <=> OLD.`consumedAt`) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'PAIRING_SESSION_CONSUMED';
    END IF;
END;
