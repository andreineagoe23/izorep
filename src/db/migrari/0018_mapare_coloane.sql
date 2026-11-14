-- Coloanele foilor de client (L1), pe firmă (14 noiembrie 2026, planul UX,
-- Faza 6, punctul 1). La import, un antet necunoscut se citește cu modelul
-- (`/api/mapare`), `valideazaMapare` decide, iar rezultatul stă aici, ca
-- importul următor cu același antet să nu mai întrebe. Tot aici, alegerea
-- omului din „schimbă” (sursa „om”). Cheia e amprenta antetului.
CREATE TABLE "mapare_coloane" (
	"tenant_id" uuid NOT NULL,
	"amprenta" text NOT NULL,
	"mapare" jsonb NOT NULL,
	"acceptata" boolean NOT NULL,
	"sursa" text NOT NULL,
	"fisier" text,
	"foaie" text,
	"model" text,
	"actualizat_la" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizat_de" text,
	CONSTRAINT "mapare_coloane_tenant_id_amprenta_pk" PRIMARY KEY("tenant_id","amprenta")
);
--> statement-breakpoint
ALTER TABLE "mapare_coloane" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mapare_coloane" ADD CONSTRAINT "mapare_coloane_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "mapare_coloane_tenant" ON "mapare_coloane" AS PERMISSIVE FOR ALL TO public USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "mapare_coloane" FORCE ROW LEVEL SECURITY;
