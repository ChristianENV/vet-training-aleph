-- Add intermediate status while OpenAI generates SessionQuestion rows.
ALTER TYPE "SessionStatus" ADD VALUE 'GENERATING_QUESTIONS';
