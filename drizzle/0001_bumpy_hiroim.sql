CREATE TABLE "presets" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"amount" integer NOT NULL,
	"type" text NOT NULL,
	"account_id" integer NOT NULL,
	"category_id" integer,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_name" text
);
--> statement-breakpoint
ALTER TABLE "presets" ADD CONSTRAINT "presets_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presets" ADD CONSTRAINT "presets_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;