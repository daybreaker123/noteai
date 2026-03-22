-- SQLite: add createdAt for profile "member since"
ALTER TABLE "User" ADD COLUMN "createdAt" DATETIME;

UPDATE "User" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;
