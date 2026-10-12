import { ApiProperty } from '@nestjs/swagger';

class PairingDeviceDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true, type: String })
  managedUser!: string | null;

  @ApiProperty()
  isDemo!: boolean;
}

export class PairingValidationResponseDto {
  @ApiProperty({ example: true })
  valid!: true;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;

  @ApiProperty({ type: PairingDeviceDto })
  device!: PairingDeviceDto;
}
