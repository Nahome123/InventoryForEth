ALTER TABLE "sales" ALTER COLUMN "sold_at" DROP NOT NULL;--> statement-breakpoint
-- The imported sales had no real dates; placeholder dates were filled in. Show them as unknown instead.
UPDATE "sales" SET "sold_at" = NULL WHERE "source" = 'import';
