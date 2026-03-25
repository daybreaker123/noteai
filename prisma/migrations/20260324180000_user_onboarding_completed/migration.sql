-- First-time onboarding: show welcome flow once; stored on Prisma User.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" TIMESTAMP(3);

-- Existing accounts before this feature: treat as already onboarded so only new signups see the flow.
UPDATE "User" SET "onboardingCompletedAt" = COALESCE("createdAt", CURRENT_TIMESTAMP)
WHERE "onboardingCompletedAt" IS NULL;
