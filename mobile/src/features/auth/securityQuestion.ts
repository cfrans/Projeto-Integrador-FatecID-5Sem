import { preferenceStorage } from '@/lib/preferenceStorage';
import { sha256Hex } from '@/lib/sha256';
import { createSecurityQuestionStore } from './security-question-store';

export { MIN_ANSWER_LENGTH, MIN_QUESTION_LENGTH } from './security-question-store';

function newSalt() {
  return Array.from({ length: 16 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');
}

export const securityQuestion = createSecurityQuestionStore(preferenceStorage, sha256Hex, newSalt);
