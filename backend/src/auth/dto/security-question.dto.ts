import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export function normalizeSecurityAnswer(answer: string) {
  return answer.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export class SetSecurityQuestionDto {
  @ApiProperty({ minLength: 8, maxLength: 255 })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(8)
  @MaxLength(255)
  question!: string;

  @ApiProperty({ minLength: 4, maxLength: 128, writeOnly: true })
  @Transform(({ value }) => typeof value === 'string' ? normalizeSecurityAnswer(value) : value)
  @IsString()
  @MinLength(4)
  @MaxLength(128)
  answer!: string;
}

export class RecoveryQuestionDto {
  @ApiProperty({ example: 'responsavel@example.com', maxLength: 254 })
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class VerifyRecoveryAnswerDto {
  @ApiProperty({ example: 'responsavel@example.com', maxLength: 254 })
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ minLength: 1, maxLength: 128, writeOnly: true })
  @Transform(({ value }) => typeof value === 'string' ? normalizeSecurityAnswer(value) : value)
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  answer!: string;
}

export class ResetPasswordDto extends VerifyRecoveryAnswerDto {
  @ApiProperty({ minLength: 8, maxLength: 128, writeOnly: true })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}
