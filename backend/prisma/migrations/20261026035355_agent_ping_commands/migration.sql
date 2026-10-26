-- CreateTable
CREATE TABLE `AgentCommand` (
    `id` CHAR(36) NOT NULL,
    `deviceId` CHAR(36) NOT NULL,
    `associationId` CHAR(36) NOT NULL,
    `requestId` CHAR(36) NOT NULL,
    `type` VARCHAR(32) NOT NULL,
    `version` INTEGER NOT NULL,
    `parameters` JSON NOT NULL,
    `status` ENUM('pending', 'running', 'succeeded', 'failed', 'expired', 'cancelled', 'unknown') NOT NULL DEFAULT 'pending',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `claimId` CHAR(36) NULL,
    `claimedByIdentityId` CHAR(36) NULL,
    `claimedAt` DATETIME(3) NULL,
    `executionDeadlineAt` DATETIME(3) NULL,
    `result` JSON NULL,
    `errorCode` VARCHAR(32) NULL,
    `completedAt` DATETIME(3) NULL,

    INDEX `AgentCommand_deviceId_status_createdAt_id_idx`(`deviceId`, `status`, `createdAt`, `id`),
    UNIQUE INDEX `AgentCommand_associationId_requestId_key`(`associationId`, `requestId`),
    UNIQUE INDEX `AgentCommand_deviceId_claimId_key`(`deviceId`, `claimId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AgentCommand` ADD CONSTRAINT `AgentCommand_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `Device`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `AgentCommand` ADD CONSTRAINT `AgentCommand_associationId_fkey` FOREIGN KEY (`associationId`) REFERENCES `DeviceAssociation`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `AgentCommand` ADD CONSTRAINT `AgentCommand_claimedByIdentityId_fkey` FOREIGN KEY (`claimedByIdentityId`) REFERENCES `AgentIdentity`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;
