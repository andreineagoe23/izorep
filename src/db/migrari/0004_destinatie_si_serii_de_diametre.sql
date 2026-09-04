-- Destinatia pe lista de preturi + tabelele de referinta pentru tevi.
--
-- 1. `destinatie` pe lista_preturi. Firma tine trei liste pentru acelasi
--    sistem (rezidential, industrial, rafinarie) cu valori diferite — prima
--    axa din `.claude/liste-preturi.md`. Fara coloana asta, indexul "o
--    singura lista activa per sistem" ar refuza a doua lista; cu ea, indexul
--    devine "una per sistem SI destinatie", care e regula corecta.
--    Implicitul 'rezidential' face backfill-ul singur: randurile existente
--    SUNT rezidentiale.
--
--    A doua axa — `contine`, material+manopera fata de doar manopera — are
--    deja coloana ei din 0000, dar NU intra inca in cheia unica: listele de
--    manopera au alta forma (tarif plat pe sistem si grosime, nu matrice
--    ø × grosime), deci s-ar putea sa nu fie acelasi tip de document.
--
-- 2. `serie_diametre` si `sectiune_rectangulara` — referinta, nu date de
--    client. Sunt norme (EN 10255, EN 1057, EN ISO 15874...), aceleasi pentru
--    orice tenant, deci NU au tenant_id si NU au RLS. Un tenant_id aici ar
--    sugera ca doua firme pot avea serii diferite pentru aceeasi teava.
--    Drepturile pentru izorep_app vin din ALTER DEFAULT PRIVILEGES (0002).

CREATE TABLE "sectiune_rectangulara" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"a_mm" integer NOT NULL,
	"b_mm" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "serie_diametre" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"material" text NOT NULL,
	"dn" integer,
	"diametru_exterior" numeric(8, 2) NOT NULL,
	"toli" text,
	"standard" text
);
--> statement-breakpoint
DROP INDEX "lista_preturi_tenant_sistem_idx";--> statement-breakpoint
DROP INDEX "lista_preturi_una_activa_idx";--> statement-breakpoint
ALTER TABLE "lista_preturi" ADD COLUMN "destinatie" text DEFAULT 'rezidential' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "sectiune_rectangulara_ab_idx" ON "sectiune_rectangulara" USING btree ("a_mm","b_mm");--> statement-breakpoint
CREATE UNIQUE INDEX "serie_diametre_material_od_idx" ON "serie_diametre" USING btree ("material","diametru_exterior");--> statement-breakpoint
CREATE INDEX "serie_diametre_material_dn_idx" ON "serie_diametre" USING btree ("material","dn");--> statement-breakpoint
CREATE INDEX "lista_preturi_tenant_sistem_idx" ON "lista_preturi" USING btree ("tenant_id","sistem","destinatie","status");--> statement-breakpoint
CREATE UNIQUE INDEX "lista_preturi_una_activa_idx" ON "lista_preturi" USING btree ("tenant_id","sistem","destinatie") WHERE status = 'activa';