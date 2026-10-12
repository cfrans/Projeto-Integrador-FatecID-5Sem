import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class PairingTokenDto {
  @ApiProperty({ description: 'Token temporário recebido pelo QR Code.' })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  token!: string;
}
