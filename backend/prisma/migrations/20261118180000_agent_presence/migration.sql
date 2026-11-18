-- AlterTable
ALTER TABLE `AgentIdentity` ADD COLUMN `lastSeenAt` DATETIME(3) NULL;

CREATE OR REPLACE SQL SECURITY INVOKER VIEW `vw_device_overview` AS
SELECT
    d.`id`,
    d.`name`,
    d.`managedUser`,
    d.`guardianId`,
    d.`isDemo`,
    a.`id` AS `associationId`,
    CASE
        WHEN i.`id` IS NULL OR i.`revokedAt` IS NOT NULL THEN NULL
        WHEN d.`isDemo` THEN s.`lastSeenAt`
        WHEN a.`id` IS NOT NULL THEN i.`lastSeenAt`
        ELSE NULL
    END AS `lastSeenAt`
FROM `Device` d
LEFT JOIN `DeviceAssociation` a
    ON a.`activeDeviceId` = d.`id` AND a.`guardianId` = d.`guardianId` AND a.`revokedAt` IS NULL
LEFT JOIN `SimulationState` s ON s.`associationId` = a.`id`
LEFT JOIN `AgentIdentity` i ON i.`deviceId` = d.`id`;
