-- AlterTable
ALTER TABLE `InstalledApplication` ADD COLUMN `blockable` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `executable` VARCHAR(191) NULL;
