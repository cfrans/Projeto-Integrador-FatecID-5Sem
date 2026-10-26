import { ApiProperty } from '@nestjs/swagger';

export class DeviceResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true, type: String })
  managedUser!: string | null;

  @ApiProperty({
    enum: ['unverified', 'online', 'offline'],
    example: 'unverified',
  })
  status!: 'unverified' | 'online' | 'offline';

  @ApiProperty({
    nullable: true,
    type: String,
    format: 'date-time',
    example: null,
  })
  lastSeen!: string | null;

  @ApiProperty({ example: true })
  isDemo!: boolean;

  @ApiProperty({ example: false })
  paired!: boolean;

  @ApiProperty({ required: false, format: 'uuid' })
  associationId?: string;
}
