CREATE TABLE "sale_origins" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sale_origins_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "sale_items" ADD COLUMN "origin_id" integer;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_origin_id_sale_origins_id_fk" FOREIGN KEY ("origin_id") REFERENCES "public"."sale_origins"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"spent_on" date NOT NULL,
	"category" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"note" text,
	"user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expenses_amount_positive" CHECK ("expenses"."amount_cents" > 0)
);
--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expenses_spent_on_idx" ON "expenses" USING btree ("spent_on");--> statement-breakpoint
-- Starter origins; rename them in Settings → Item origins.
INSERT INTO "sale_origins" ("name") VALUES ('China supplier 1'), ('China supplier 2');
