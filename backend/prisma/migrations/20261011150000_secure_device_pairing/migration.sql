ALTER TABLE `Device`
    MODIFY `guardianId` CHAR(36) NULL;

CREATE TABLE `AgentIdentity` (
    `id` CHAR(36) NOT NULL,
    `deviceId` CHAR(36) NOT NULL,
    `credentialHash` CHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `revokedAt` DATETIME(3) NULL,
    UNIQUE INDEX `AgentIdentity_deviceId_key` (`deviceId`),
    UNIQUE INDEX `AgentIdentity_credentialHash_key` (`credentialHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PairingSession` (
    `id` CHAR(36) NOT NULL,
    `deviceId` CHAR(36) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `consumedAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    `consumedByGuardianId` CHAR(36) NULL,
    UNIQUE INDEX `PairingSession_tokenHash_key` (`tokenHash`),
    INDEX `PairingSession_deviceId_expiresAt_idx` (`deviceId`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DeviceAssociation` (
    `id` CHAR(36) NOT NULL,
    `deviceId` CHAR(36) NOT NULL,
    `guardianId` CHAR(36) NOT NULL,
    `activeDeviceId` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `revokedAt` DATETIME(3) NULL,
    UNIQUE INDEX `DeviceAssociation_activeDeviceId_key` (`activeDeviceId`),
    INDEX `DeviceAssociation_deviceId_createdAt_idx` (`deviceId`, `createdAt`),
    INDEX `DeviceAssociation_guardianId_revokedAt_idx` (`guardianId`, `revokedAt`),
    PRIMARY KEY (`id`),
    CONSTRAINT `DeviceAssociation_active_state_check` CHECK (
        (`revokedAt` IS NULL AND `activeDeviceId` IS NOT NULL AND `activeDeviceId` = `deviceId`)
        OR (`revokedAt` IS NOT NULL AND `activeDeviceId` IS NULL)
    )
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AgentIdentity`
    ADD CONSTRAINT `AgentIdentity_deviceId_fkey`
    FOREIGN KEY (`deviceId`) REFERENCES `Device` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `PairingSession`
    ADD CONSTRAINT `PairingSession_deviceId_fkey`
    FOREIGN KEY (`deviceId`) REFERENCES `Device` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `PairingSession_consumedByGuardianId_fkey`
    FOREIGN KEY (`consumedByGuardianId`) REFERENCES `Guardian` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `DeviceAssociation`
    ADD CONSTRAINT `DeviceAssociation_deviceId_fkey`
    FOREIGN KEY (`deviceId`) REFERENCES `Device` (`id`)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
    ADD CONSTRAINT `DeviceAssociation_guardianId_fkey`
    FOREIGN KEY (`guardianId`) REFERENCES `Guardian` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
