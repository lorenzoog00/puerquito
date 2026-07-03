CREATE TABLE "goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"monthly_amount" integer DEFAULT 0 NOT NULL,
	"target_amount" integer,
	"saved" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
