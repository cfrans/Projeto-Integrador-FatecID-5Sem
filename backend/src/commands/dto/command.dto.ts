import { ApiProperty } from '@nestjs/swagger';
import { Allow, Equals, IsIn, IsObject, IsUUID } from 'class-validator';

export class CreateCommandDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  requestId!: string;

  @ApiProperty({ enum: ['agent.ping'] })
  @Equals('agent.ping')
  type!: 'agent.ping';

  @ApiProperty({ enum: [1] })
  @Equals(1)
  version!: 1;

  @ApiProperty({ type: 'object', additionalProperties: false })
  @IsObject()
  parameters!: Record<string, never>;
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
    properties: { reachable: { type: 'boolean', enum: [true] } },
    additionalProperties: false,
  })
  @Allow()
  result!: unknown;

  @ApiProperty({
    nullable: true,
    type: 'object',
    properties: {
      code: {
        type: 'string',
        enum: [
          'UNSUPPORTED_OPERATION',
          'INVALID_PARAMETERS',
          'EXECUTION_TIMEOUT',
          'LOCAL_UNAVAILABLE',
        ],
      },
    },
    additionalProperties: false,
  })
  @Allow()
  error!: unknown;
}
