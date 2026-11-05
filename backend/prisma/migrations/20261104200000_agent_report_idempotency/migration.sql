ALTER TABLE `InstalledApplication` ADD COLUMN `sourceId` VARCHAR(191) NULL;

UPDATE `InstalledApplication`
SET `sourceId` = `id`
WHERE `sourceId` IS NULL;

ALTER TABLE `InstalledApplication`
    MODIFY `sourceId` VARCHAR(191) NOT NULL,
    ADD UNIQUE INDEX `InstalledApplication_deviceId_sourceId_key` (`deviceId`, `sourceId`);

ALTER TABLE `InstallationRequest` ADD COLUMN `sourceId` VARCHAR(191) NULL;

UPDATE `InstallationRequest`
SET `sourceId` = `id`
WHERE `sourceId` IS NULL;

ALTER TABLE `InstallationRequest`
    MODIFY `sourceId` VARCHAR(191) NOT NULL,
    ADD UNIQUE INDEX `InstallationRequest_deviceId_sourceId_key` (`deviceId`, `sourceId`);

CREATE TABLE `AgentReport` (
    `id` CHAR(36) NOT NULL,
    `deviceId` CHAR(36) NOT NULL,
    `reportId` CHAR(36) NOT NULL,
    `contentHash` CHAR(64) NOT NULL,
    `collectedAt` DATETIME(3) NOT NULL,
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `applicationsCount` INTEGER NOT NULL,
    `installationRequestsCount` INTEGER NOT NULL,

    PRIMARY KEY (`id`),
    UNIQUE INDEX `AgentReport_deviceId_reportId_key` (`deviceId`, `reportId`),
    INDEX `AgentReport_deviceId_receivedAt_idx` (`deviceId`, `receivedAt`),
    CONSTRAINT `AgentReport_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `Device`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
