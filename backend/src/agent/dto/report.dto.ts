import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  Equals,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AgentApplicationReportDto {
  @ApiProperty({ maxLength: 191 })
  @IsString()
  @MaxLength(191)
  sourceId!: string;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ maxLength: 100 })
  @IsString()
  @MaxLength(100)
  category!: string;

  @ApiProperty()
  @IsBoolean()
  allowed!: boolean;
}

export class AgentInstallationRequestReportDto {
  @ApiProperty({ maxLength: 191 })
  @IsString()
  @MaxLength(191)
  sourceId!: string;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @MaxLength(200)
  applicationName!: string;

  @ApiProperty({ maxLength: 100 })
  @IsString()
  @MaxLength(100)
  requesterName!: string;

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  requestedAt!: string;

  @ApiProperty({ maxLength: 20 })
  @IsString()
  @MaxLength(20)
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
