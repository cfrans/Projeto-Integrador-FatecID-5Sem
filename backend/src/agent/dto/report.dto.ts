import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  Equals,
  IsOptional,
  IsString,
  Matches,
  ValidateIf,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CodePointLength } from './code-point-length.js';

export class AgentApplicationReportDto {
  @ApiProperty({ minLength: 1, maxLength: 191 })
  @IsString()
  @CodePointLength(1, 191)
  sourceId!: string;

  @ApiProperty({ minLength: 1, maxLength: 200 })
  @IsString()
  @CodePointLength(1, 200)
  name!: string;

  @ApiProperty({ minLength: 1, maxLength: 100 })
  @IsString()
  @CodePointLength(1, 100)
  category!: string;

  @ApiProperty()
  @IsBoolean()
  allowed!: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  blockable?: boolean;

  @ApiProperty({
    required: false,
    nullable: true,
    type: String,
    maxLength: 191,
  })
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @Matches(/^\//)
  @CodePointLength(1, 191)
  executable?: string | null;
}

export class AgentInstallationRequestReportDto {
  @ApiProperty({ minLength: 1, maxLength: 191 })
  @IsString()
  @CodePointLength(1, 191)
  sourceId!: string;

  @ApiProperty({ minLength: 1, maxLength: 200 })
  @IsString()
  @CodePointLength(1, 200)
  applicationName!: string;

  @ApiProperty({ minLength: 1, maxLength: 100 })
  @IsString()
  @CodePointLength(1, 100)
  requesterName!: string;

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  requestedAt!: string;

  @ApiProperty({ maxLength: 20 })
  @IsString()
  @CodePointLength(0, 20)
  ageRating!: string;
}

export class AgentReportDto {
  @ApiProperty({ enum: [1] })
  @Equals(1)
  protocolVersion!: 1;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  reportId!: string;

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  collectedAt!: string;

  @ApiProperty({ type: AgentApplicationReportDto, isArray: true, maxItems: 200 })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => AgentApplicationReportDto)
  applications!: AgentApplicationReportDto[];

  @ApiProperty({
    type: AgentInstallationRequestReportDto,
    isArray: true,
    maxItems: 200,
  })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => AgentInstallationRequestReportDto)
  installationRequests!: AgentInstallationRequestReportDto[];
}
