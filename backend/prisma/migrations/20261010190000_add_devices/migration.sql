-- CreateTable
CREATE TABLE `Device` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `managedUser` VARCHAR(100) NULL,
    `guardianId` CHAR(36) NOT NULL,
    `isDemo` BOOLEAN NOT NULL DEFAULT true,

    INDEX `Device_guardianId_idx`(`guardianId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Device` ADD CONSTRAINT `Device_guardianId_fkey` FOREIGN KEY (`guardianId`) REFERENCES `Guardian`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
