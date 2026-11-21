-- The weekly X post belongs to the Space, never to an individual founder.
ALTER TABLE "Session" ADD COLUMN "postUrl" TEXT NOT NULL DEFAULT '';
