import { ApiProperty } from '@nestjs/swagger';
import { Allow, Equals, IsIn, IsObject, IsUUID } from 'class-validator';
import { ALL_ERROR_CODES, COMMAND_TYPES } from '../command-types.js';

export class CreateCommandDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  requestId!: string;

  @ApiProperty({ enum: COMMAND_TYPES })
  @IsIn(COMMAND_TYPES)
  type!: (typeof COMMAND_TYPES)[number];

  @ApiProperty({ enum: [1] })
  @Equals(1)
  version!: 1;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'Vazio para agent.ping e parental.app_filter.read; { blockedApplications, blockInstallation } para parental.app_filter.set.',
  })
  @IsObject()
  parameters!: Record<string, unknown>;
}

export class ClaimCommandDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  claimId!: string;
}

export class CommandResultDto extends ClaimCommandDto {
  @ApiProperty({ enum: ['succeeded', 'failed'] })
  @IsIn(['succeeded', 'failed'])
  status!: 'succeeded' | 'failed';

  @ApiProperty({
    nullable: true,
    type: 'object',
    additionalProperties: true,
    description:
      '{ reachable: true } no ping; { blockedApplications, blockInstallation } observado nos comandos parentais.',
  })
  @Allow()
  result!: unknown;

  @ApiProperty({
    nullable: true,
    type: 'object',
    properties: {
      code: {
        type: 'string',
        enum: [...ALL_ERROR_CODES],
      },
    },
    additionalProperties: false,
  })
  @Allow()
  error!: unknown;
}
