-- Legacy cleanup (pre question/response refactor): chat turns model.
-- Safe on databases that never had these objects (no-op).
-- If you still need data from SessionTurn, export it before applying migrations.
--
-- CASCADE on DROP TYPE: the enum can still be referenced by other dropped columns or
-- dependent objects; without CASCADE, PostgreSQL errors and Prisma records P3009.

DROP TABLE IF EXISTS "SessionTurn" CASCADE;

DROP TYPE IF EXISTS "TurnSpeaker" CASCADE;
