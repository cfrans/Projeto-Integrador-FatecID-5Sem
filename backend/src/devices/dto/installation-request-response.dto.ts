import { ApiProperty } from '@nestjs/swagger';

export class InstallationRequestResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare id: string;

  @ApiProperty()
  declare applicationName: string;

  @ApiProperty()
  declare requesterName: string;

  @ApiProperty({ format: 'date-time' })
  declare requestedAt: string;

  @ApiProperty()
  declare ageRating: string;
}
