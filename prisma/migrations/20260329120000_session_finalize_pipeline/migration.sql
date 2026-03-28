-- SessionStatus: finalization pipeline
ALTER TYPE "SessionStatus" ADD VALUE 'SAVING_FINAL_RESPONSES';
ALTER TYPE "SessionStatus" ADD VALUE 'ANALYZING';

ALTER TABLE "TrainingSession" ADD COLUMN "finalizationMetaJson" JSONB;
