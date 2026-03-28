-- Transcription stage between saving final audio and evaluation.
ALTER TYPE "SessionStatus" ADD VALUE 'TRANSCRIBING';
ALTER TYPE "SessionStatus" ADD VALUE 'TRANSCRIPTION_FAILED';
