ALTER TABLE `PairingSession` DROP FOREIGN KEY `PairingSession_deviceId_fkey`;

ALTER TABLE `PairingSession` ADD COLUMN `registrationCredentialHash` CHAR(64) NULL,
    ADD COLUMN `registrationDeviceId` CHAR(36) NULL,
    ADD COLUMN `registrationManagedUser` VARCHAR(100) NULL,
    ADD COLUMN `registrationName` VARCHAR(100) NULL,
    MODIFY `deviceId` CHAR(36) NULL;

CREATE INDEX `PairingSession_registrationCredentialHash_idx` ON `PairingSession`(`registrationCredentialHash`);

ALTER TABLE `PairingSession` ADD CONSTRAINT `PairingSession_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `Device`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `PairingSession` ADD CONSTRAINT `PairingSession_target_check` CHECK (
    (`deviceId` IS NOT NULL
        AND `registrationDeviceId` IS NULL
        AND `registrationCredentialHash` IS NULL
        AND `registrationName` IS NULL
        AND `registrationManagedUser` IS NULL)
    OR (`deviceId` IS NULL
        AND `registrationDeviceId` IS NOT NULL
        AND `registrationCredentialHash` IS NOT NULL
        AND `registrationName` IS NOT NULL
        AND `registrationManagedUser` IS NOT NULL)
);
