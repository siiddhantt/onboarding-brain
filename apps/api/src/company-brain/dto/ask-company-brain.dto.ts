import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import {
  MAX_COMPANY_BRAIN_QUESTION_CHARACTERS,
  MIN_COMPANY_BRAIN_QUESTION_CHARACTERS,
} from '@app-starter/shared';

export class AskCompanyBrainDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(MIN_COMPANY_BRAIN_QUESTION_CHARACTERS)
  @MaxLength(MAX_COMPANY_BRAIN_QUESTION_CHARACTERS)
  question: string;
}
