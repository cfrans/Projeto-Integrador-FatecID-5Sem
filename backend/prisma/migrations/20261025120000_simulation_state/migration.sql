CREATE TABLE `SimulationState` (
    `associationId` CHAR(36) NOT NULL,
    `settings` JSON NOT NULL,
    `revision` INTEGER NOT NULL DEFAULT 1,
    `appliedRevision` INTEGER NULL,
    `appliedAt` DATETIME(3) NULL,

    PRIMARY KEY (`associationId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `SimulationState` ADD CONSTRAINT `SimulationState_associationId_fkey` FOREIGN KEY (`associationId`) REFERENCES `DeviceAssociation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
