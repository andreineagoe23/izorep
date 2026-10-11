-- Faza 4 (11 octombrie 2026): comanda la furnizor si receptia ei. Receptia nu
-- are tabel: e intrarea in stoc, cu comanda, linia si documentul ei (src/stoc/comenzi.ts).
-- Partea de jos (FORCE, verificari, trigger) e scrisa de mana, ca in 0006.

CREATE TABLE "comanda" (
	"tenant_id" uuid NOT NULL,
	"id" text NOT NULL,
	"continut" jsonb NOT NULL,
	"trimisa_la" timestamp with time zone,
	"anulata_la" timestamp with time zone,
	"creat_de" uuid,
	"creat_la" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comanda_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "comanda" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "miscare" ADD COLUMN "pret_lei" numeric(14, 4);--> statement-breakpoint
ALTER TABLE "miscare" ADD COLUMN "curs" numeric(10, 4);--> statement-breakpoint
ALTER TABLE "miscare" ADD COLUMN "comanda_id" text;--> statement-breakpoint
ALTER TABLE "miscare" ADD COLUMN "comanda_linie" text;--> statement-breakpoint
ALTER TABLE "miscare" ADD COLUMN "document" jsonb;--> statement-breakpoint
ALTER TABLE "miscare" ADD COLUMN "furnizor" text;--> statement-breakpoint
ALTER TABLE "comanda" ADD CONSTRAINT "comanda_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comanda" ADD CONSTRAINT "comanda_creat_de_utilizator_id_fk" FOREIGN KEY ("creat_de") REFERENCES "public"."utilizator"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "miscare_comanda_idx" ON "miscare" USING btree ("tenant_id","comanda_id");--> statement-breakpoint
CREATE POLICY "comanda_tenant" ON "comanda" AS PERMISSIVE FOR ALL TO public USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

-- RLS fortat (vezi 0001: fara el, proprietarul ocoleste politicile).
ALTER TABLE "comanda" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

-- O intrare din comanda poarta si linia ei; doar intrarea vine din comanda.
ALTER TABLE "miscare" ADD CONSTRAINT "miscare_comanda_chk"
  CHECK ((comanda_id IS NULL) = (comanda_linie IS NULL) AND (comanda_id IS NULL OR tip = 'intrare'));--> statement-breakpoint

-- Comanda trimisa nu se mai schimba: se poate doar anula (o data). Ciorna se
-- editeaza si se sterge cat n-are nicio intrare.
CREATE OR REPLACE FUNCTION comanda_trimisa_inghetata() RETURNS trigger AS $$
BEGIN
  IF purjare_permisa(OLD.tenant_id) THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.trimisa_la IS NOT NULL THEN
      RAISE EXCEPTION 'comanda % e trimisa: nu se sterge, se anuleaza', OLD.id USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.anulata_la IS NOT NULL THEN
    RAISE EXCEPTION 'comanda % e anulata', OLD.id USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD.trimisa_la IS NOT NULL AND (NEW.continut IS DISTINCT FROM OLD.continut
       OR NEW.trimisa_la IS DISTINCT FROM OLD.trimisa_la) THEN
    RAISE EXCEPTION 'comanda % e trimisa: nu se mai modifica', OLD.id USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER comanda_trimisa_inghetata_trg BEFORE UPDATE OR DELETE ON "comanda"
  FOR EACH ROW EXECUTE FUNCTION comanda_trimisa_inghetata();
