-- Conturile (21 octombrie 2026, cerut de Andrei): fiecare om intra cu emailul
-- si parola lui, pe o pagina de intrare, in locul parolei comune. Parola sta
-- doar ca hash scrypt (`src/server/parola.ts`); incercarile gresite blocheaza
-- contul cateva minute. Plus:
--  * `jurnal`: cine a schimbat ce. Doar se adauga, ca miscarea de stoc.
--  * `versiune` pe cerere si necesar: doi oameni pe acelasi import nu se mai
--    suprascriu tacut; al doilea primeste 409 cu numele primului.
CREATE TABLE "jurnal" (
	"tenant_id" uuid NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cand" timestamp with time zone DEFAULT now() NOT NULL,
	"utilizator_id" uuid,
	"cine" text NOT NULL,
	"actiune" text NOT NULL,
	"obiect" text
);
--> statement-breakpoint
ALTER TABLE "jurnal" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cerere" ADD COLUMN "versiune" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "cerere" ADD COLUMN "actualizat_de" text;--> statement-breakpoint
ALTER TABLE "necesar" ADD COLUMN "versiune" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "necesar" ADD COLUMN "actualizat_de" text;--> statement-breakpoint
ALTER TABLE "utilizator" ADD COLUMN "parola_hash" text;--> statement-breakpoint
ALTER TABLE "utilizator" ADD COLUMN "parola_temporara" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "utilizator" ADD COLUMN "incercari_gresite" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "utilizator" ADD COLUMN "blocat_pana" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "utilizator" ADD COLUMN "ultima_intrare" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jurnal" ADD CONSTRAINT "jurnal_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jurnal_tenant_cand_idx" ON "jurnal" USING btree ("tenant_id","cand");--> statement-breakpoint
CREATE POLICY "jurnal_tenant" ON "jurnal" AS PERMISSIVE FOR ALL TO public USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "jurnal" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TRIGGER jurnal_doar_adaugare BEFORE UPDATE OR DELETE ON "jurnal"
  FOR EACH ROW EXECUTE FUNCTION doar_adaugare();
