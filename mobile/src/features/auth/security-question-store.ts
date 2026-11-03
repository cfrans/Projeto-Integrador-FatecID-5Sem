type Storage = { get: (key: string) => Promise<string | null>; set: (key: string, value: string) => Promise<void> };
type Record = { question: string; salt: string; answerHash: string };

const STORAGE_KEY = 'piplup.security-questions';
export const MIN_QUESTION_LENGTH = 8;
export const MIN_ANSWER_LENGTH = 2;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizeAnswer(answer: string) {
  return answer.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function createSecurityQuestionStore(storage: Storage, hash: (text: string) => string, newSalt: () => string) {
  async function load(): Promise<{ [email: string]: Record }> {
    const stored = await storage.get(STORAGE_KEY);
    if (!stored) return {};
    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('Invalid security questions');
    return parsed as { [email: string]: Record };
  }

  return {
    async getQuestion(email: string): Promise<string | null> {
      return (await load())[normalizeEmail(email)]?.question ?? null;
    },
    async save(email: string, question: string, answer: string): Promise<boolean> {
      const trimmedQuestion = question.trim();
      const normalizedAnswer = normalizeAnswer(answer);
      if (trimmedQuestion.length < MIN_QUESTION_LENGTH || normalizedAnswer.length < MIN_ANSWER_LENGTH) return false;
      const records = await load();
      const salt = newSalt();
      records[normalizeEmail(email)] = { question: trimmedQuestion, salt, answerHash: hash(`${salt}:${normalizedAnswer}`) };
      await storage.set(STORAGE_KEY, JSON.stringify(records));
      return true;
    },
    async verify(email: string, answer: string): Promise<boolean> {
      const record = (await load())[normalizeEmail(email)];
      if (!record) return false;
      return hash(`${record.salt}:${normalizeAnswer(answer)}`) === record.answerHash;
    },
  };
}
