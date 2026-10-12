import { ApiProperty } from '@nestjs/swagger';

export class AgentPairingSessionResponseDto {
  @ApiProperty({ description: 'Token temporário de uso único para o QR.' })
  token!: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;

  @ApiProperty({ example: 'piplup://pair?token=...' })
  qrPayload!: string;
}
