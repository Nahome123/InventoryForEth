CREATE TABLE "batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"supplier" text,
	"note" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "batch_id" integer;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "batch_id" integer;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- The same part number may now exist once per batch (each import keeps its own stock).
DROP INDEX "products_sku_lower_idx";--> statement-breakpoint
DROP INDEX "products_barcode_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "products_sku_lower_idx" ON "products" USING btree (lower("sku"),coalesce("batch_id", 0));--> statement-breakpoint
CREATE UNIQUE INDEX "products_barcode_idx" ON "products" USING btree ("barcode",coalesce("batch_id", 0));--> statement-breakpoint
CREATE INDEX "products_batch_idx" ON "products" USING btree ("batch_id");
