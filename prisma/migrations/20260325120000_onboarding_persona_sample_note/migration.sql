-- Guided onboarding: persona + sample note id (completion still uses onboardingCompletedAt).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "onboardingPersona" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "onboardingSampleNoteId" TEXT;
