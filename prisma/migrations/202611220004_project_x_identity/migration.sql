-- Add the official project identity separately from the founder's personal account.
-- Existing records intentionally remain NULL; never infer it from Founder.xHandle.
ALTER TABLE "Company" ADD COLUMN "xHandle" TEXT;
ALTER TABLE "Application" ADD COLUMN "projectXHandle" TEXT;
