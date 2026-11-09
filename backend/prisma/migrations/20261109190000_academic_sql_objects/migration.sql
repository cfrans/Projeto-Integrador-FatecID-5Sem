CREATE FUNCTION `fn_pairing_session_status`(
    p_consumed_at DATETIME(3),
    p_revoked_at DATETIME(3),
    p_expires_at DATETIME(3),
    p_now DATETIME(3)
)
RETURNS VARCHAR(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
DETERMINISTIC
NO SQL
SQL SECURITY INVOKER
BEGIN
    IF p_revoked_at IS NOT NULL THEN
        RETURN 'revoked';
    ELSEIF p_consumed_at IS NOT NULL THEN
        RETURN 'consumed';
    ELSEIF p_expires_at <= p_now THEN
        RETURN 'expired';
    END IF;
    RETURN 'pending';
END;

CREATE SQL SECURITY INVOKER VIEW `vw_device_overview` AS
SELECT
    d.`id`,
    d.`name`,
    d.`managedUser`,
    d.`guardianId`,
    d.`isDemo`,
    a.`id` AS `associationId`,
    CASE WHEN i.`id` IS NOT NULL AND i.`revokedAt` IS NULL THEN s.`lastSeenAt` ELSE NULL END AS `lastSeenAt`
FROM `Device` d
LEFT JOIN `DeviceAssociation` a
    ON a.`activeDeviceId` = d.`id` AND a.`guardianId` = d.`guardianId` AND a.`revokedAt` IS NULL
LEFT JOIN `SimulationState` s ON s.`associationId` = a.`id`
LEFT JOIN `AgentIdentity` i ON i.`deviceId` = d.`id`;

CREATE PROCEDURE `sp_revoke_device_association`(
    IN p_device_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    IN p_association_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
)
SQL SECURITY INVOKER
MODIFIES SQL DATA
BEGIN
    DECLARE v_locked_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL;
    DECLARE v_association_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL;
    DECLARE v_now DATETIME(3);

    SELECT `id` INTO v_locked_id FROM `Device` WHERE `id` = p_device_id FOR UPDATE;
    SELECT `id` INTO v_association_id
    FROM `DeviceAssociation`
    WHERE `id` = p_association_id AND `deviceId` = p_device_id
      AND `activeDeviceId` = p_device_id AND `revokedAt` IS NULL;

    IF v_locked_id IS NULL OR v_association_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ASSOCIATION_NOT_FOUND';
    END IF;

    SET v_now = UTC_TIMESTAMP(3);

    UPDATE `AgentCommand` SET `status` = 'cancelled'
    WHERE `deviceId` = p_device_id AND `associationId` = v_association_id AND `status` = 'pending';
    UPDATE `AgentCommand` SET `status` = 'unknown'
    WHERE `deviceId` = p_device_id AND `associationId` = v_association_id AND `status` = 'running';
    UPDATE `DeviceAssociation` SET `revokedAt` = v_now, `activeDeviceId` = NULL
    WHERE `id` = v_association_id;
    UPDATE `Device` SET `guardianId` = NULL WHERE `id` = p_device_id;
    UPDATE `PairingSession` SET `revokedAt` = v_now
    WHERE `deviceId` = p_device_id AND `consumedAt` IS NULL AND `revokedAt` IS NULL;
END;

CREATE TRIGGER `trg_pairing_session_keep_consumed`
BEFORE UPDATE ON `PairingSession`
FOR EACH ROW
BEGIN
    IF OLD.`consumedAt` IS NOT NULL AND (
        NOT (NEW.`consumedAt` <=> OLD.`consumedAt`)
        OR NOT (NEW.`consumedByGuardianId` <=> OLD.`consumedByGuardianId`)
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'PAIRING_SESSION_CONSUMED';
    END IF;
END;
