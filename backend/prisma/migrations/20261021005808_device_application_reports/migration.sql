ALTER TABLE `Device` ADD COLUMN `applicationsReportedAt` DATETIME(3) NULL,
    ADD COLUMN `installationRequestsReportedAt` DATETIME(3) NULL;

CREATE TABLE `InstalledApplication` (
    `id` CHAR(36) NOT NULL,
    `deviceId` CHAR(36) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `category` VARCHAR(100) NOT NULL,
    `allowed` BOOLEAN NOT NULL,

    INDEX `InstalledApplication_deviceId_name_idx`(`deviceId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `InstallationRequest` (
    `id` CHAR(36) NOT NULL,
    `deviceId` CHAR(36) NOT NULL,
    `applicationName` VARCHAR(200) NOT NULL,
    `requesterName` VARCHAR(100) NOT NULL,
    `requestedAt` DATETIME(3) NOT NULL,
    `ageRating` VARCHAR(20) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'DENIED') NOT NULL DEFAULT 'PENDING',

    INDEX `InstallationRequest_deviceId_status_requestedAt_idx`(`deviceId`, `status`, `requestedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `InstalledApplication` ADD CONSTRAINT `InstalledApplication_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `Device`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `InstallationRequest` ADD CONSTRAINT `InstallationRequest_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `Device`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
