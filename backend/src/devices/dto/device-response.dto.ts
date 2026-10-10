import { ApiProperty } from '@nestjs/swagger';

export class DeviceResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true, type: String })
  managedUser!: string | null;

  @ApiProperty({ enum: ['unverified'], example: 'unverified' })
  status!: 'unverified';

  @ApiProperty({ nullable: true, type: String, format: 'date-time', example: null })
  lastSeen!: null;

  @ApiProperty({ example: true })
  isDemo!: boolean;
}
