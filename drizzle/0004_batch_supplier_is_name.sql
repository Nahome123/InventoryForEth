-- A batch's supplier is always the batch name. Products that carried the old batch supplier (or none) follow.
UPDATE "products" AS p SET "supplier" = b."name", "updated_at" = now()
  FROM "batches" AS b
  WHERE p."batch_id" = b."id" AND (p."supplier" IS NULL OR p."supplier" IS NOT DISTINCT FROM b."supplier") AND p."supplier" IS DISTINCT FROM b."name";--> statement-breakpoint
UPDATE "batches" SET "supplier" = "name" WHERE "supplier" IS DISTINCT FROM "name";
