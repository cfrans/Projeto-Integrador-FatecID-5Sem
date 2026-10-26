import { ApiProperty } from '@nestjs/swagger';

export class InstalledApplicationResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare id: string;

  @ApiProperty()
  declare name: string;

  @ApiProperty()
  declare category: string;

  @ApiProperty()
  declare allowed: boolean;
}
