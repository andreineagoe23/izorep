-- Faza 4, ce mai lipsea (11 octombrie 2026): avizul sau factura atasate la
-- receptie (S31), returul la furnizor (S32) si masuratorile pentru comanda.
-- Partea de jos e scrisa de mana, ca in 0006 si 0008.

CREATE TABLE "document_furnizor" (
	"tenant_id" uuid NOT NULL,
	"id" text NOT NULL,
	"comanda_id" text NOT NULL,
	"tip" text NOT NULL,
	"numar" text NOT NULL,
	"nume" text NOT NULL,
	"tip_fisier" text NOT NULL,
	"fisier" "bytea" NOT NULL,
	"creat_de" uuid,
	"creat_la" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_furnizor_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "document_furnizor" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "document_furnizor" ADD CONSTRAINT "document_furnizor_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_furnizor" ADD CONSTRAINT "document_furnizor_creat_de_utilizator_id_fk" FOREIGN KEY ("creat_de") REFERENCES "public"."utilizator"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_furnizor" ADD CONSTRAINT "document_furnizor_tenant_id_comanda_id_comanda_tenant_id_id_fk" FOREIGN KEY ("tenant_id","comanda_id") REFERENCES "public"."comanda"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "document_furnizor_tenant" ON "document_furnizor" AS PERMISSIVE FOR ALL TO public USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

-- RLS fortat (vezi 0001) si documentul primit nu se schimba (vezi 0006).
ALTER TABLE "document_furnizor" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TRIGGER document_furnizor_doar_adaugare BEFORE UPDATE OR DELETE ON "document_furnizor"
  FOR EACH ROW EXECUTE FUNCTION doar_adaugare();--> statement-breakpoint
ALTER TABLE "document_furnizor" ADD CONSTRAINT "document_furnizor_tip_chk"
  CHECK (tip IN ('aviz', 'factura'));--> statement-breakpoint

-- Returul la furnizor e legat de linia comenzii, ca intrarea. N-are depozit de
-- sosire: marfa iese din firma, deci poarta furnizorul (`laFurnizor` in
-- src/stoc/registru.ts).
ALTER TABLE "miscare" DROP CONSTRAINT "miscare_comanda_chk";--> statement-breakpoint
ALTER TABLE "miscare" ADD CONSTRAINT "miscare_comanda_chk"
  CHECK ((comanda_id IS NULL) = (comanda_linie IS NULL) AND (comanda_id IS NULL OR tip IN ('intrare', 'retur')));--> statement-breakpoint
ALTER TABLE "miscare" ADD CONSTRAINT "miscare_retur_chk"
  CHECK (tip <> 'retur' OR spre IS NOT NULL OR furnizor IS NOT NULL);--> statement-breakpoint

-- Masuratorile din care se face comanda etapei (S2).
ALTER TABLE "masuratoare" DROP CONSTRAINT "masuratoare_scop_chk";--> statement-breakpoint
ALTER TABLE "masuratoare" ADD CONSTRAINT "masuratoare_scop_chk"
  CHECK (scop IN ('oferta', 'situatie', 'comanda'));
