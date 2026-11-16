-- AlterTable
ALTER TABLE `AgentCommand` ADD COLUMN `policyRevision` INTEGER NULL;

-- CreateTable
CREATE TABLE `ParentalPolicy` (
    `associationId` CHAR(36) NOT NULL,
    `appFilter` JSON NOT NULL,
    `revision` INTEGER NOT NULL DEFAULT 1,
    `appliedRevision` INTEGER NULL,
    `appliedAt` DATETIME(3) NULL,
    `observedAppFilter` JSON NULL,
    `observedAt` DATETIME(3) NULL,
    `lastErrorCode` VARCHAR(32) NULL,

    PRIMARY KEY (`associationId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ParentalPolicy` ADD CONSTRAINT `ParentalPolicy_associationId_fkey` FOREIGN KEY (`associationId`) REFERENCES `DeviceAssociation`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;
