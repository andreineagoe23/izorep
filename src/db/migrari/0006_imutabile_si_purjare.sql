-- Faza 3: RLS fortat pe tabelele noi, documentele care nu se mai schimba si
-- singura cale prin care se sterge un tenant intreg.
--
-- Scrisa de mana, ca 0001: drizzle-kit genereaza politicile, dar nu FORCE si
-- nu trigger-ele.

-- 1. FORCE ROW LEVEL SECURITY (vezi 0001: fara el, proprietarul ocoleste politicile).
ALTER TABLE "token_intrare" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sesiune" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cerere" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "oferta" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "santier" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "anexa_santier" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "situatie" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "masuratoare" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "depozit" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "articol" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ambalaj" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "necesar" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "miscare" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "furnizor" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

-- 2. Valorile pe care le cunoaste codul, ca o greseala de scriere sa nu treaca.
ALTER TABLE "miscare" ADD CONSTRAINT "miscare_tip_chk"
  CHECK (tip IN ('intrare', 'transfer', 'consum', 'retur', 'ajustare'));--> statement-breakpoint
-- Doar ajustarea la inventar are semn; restul sunt cantitati pozitive.
ALTER TABLE "miscare" ADD CONSTRAINT "miscare_cantitate_chk"
  CHECK (tip = 'ajustare' OR cantitate > 0);--> statement-breakpoint
ALTER TABLE "depozit" ADD CONSTRAINT "depozit_tip_chk"
  CHECK (tip IN ('central', 'atelier', 'santier'));--> statement-breakpoint
ALTER TABLE "masuratoare" ADD CONSTRAINT "masuratoare_scop_chk"
  CHECK (scop IN ('oferta', 'situatie'));--> statement-breakpoint
-- Oferta salvata din aplicatie are mereu liniile; doar cea mutata din browser
-- poate veni fara ele (browserul tinea numai sumarul).
ALTER TABLE "oferta" ADD CONSTRAINT "oferta_continut_chk"
  CHECK (continut IS NOT NULL OR mutata);--> statement-breakpoint

-- 3. Stergerea unui tenant intreg.
--
-- Documentele de mai jos nu se sterg niciodata din aplicatie. Un tenant de
-- test, insa, trebuie sa poata pleca, iar `db:seed` nu mai sterge tenantul
-- (are date reale). Calea e una singura si e vizibila: proprietarul schemei
-- pune `app.purjare` pe id-ul tenantului, in tranzactia lui. Aplicatia
-- (`izorep_app`) nu o poate folosi, nici daca pune setarea.
CREATE OR REPLACE FUNCTION purjare_permisa(t uuid) RETURNS boolean AS $$
  SELECT current_user <> 'izorep_app'
     AND nullif(current_setting('app.purjare', true), '') = t::text;
$$ LANGUAGE sql STABLE;--> statement-breakpoint

-- 4. Ce nu se editeaza si nu se sterge: oferta salvata, miscarea de stoc,
-- masuratoarea, anexa. Corectura e o versiune noua, respectiv storno.
CREATE OR REPLACE FUNCTION doar_adaugare() RETURNS trigger AS $$
BEGIN
  IF purjare_permisa(OLD.tenant_id) THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  RAISE EXCEPTION '% nu se % : se adauga o inregistrare noua', TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN 'sterge' ELSE 'modifica' END
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER oferta_doar_adaugare BEFORE UPDATE OR DELETE ON "oferta"
  FOR EACH ROW EXECUTE FUNCTION doar_adaugare();--> statement-breakpoint
CREATE TRIGGER miscare_doar_adaugare BEFORE UPDATE OR DELETE ON "miscare"
  FOR EACH ROW EXECUTE FUNCTION doar_adaugare();--> statement-breakpoint
CREATE TRIGGER masuratoare_doar_adaugare BEFORE UPDATE OR DELETE ON "masuratoare"
  FOR EACH ROW EXECUTE FUNCTION doar_adaugare();--> statement-breakpoint
CREATE TRIGGER anexa_santier_doar_adaugare BEFORE UPDATE OR DELETE ON "anexa_santier"
  FOR EACH ROW EXECUTE FUNCTION doar_adaugare();--> statement-breakpoint

-- 5. Situatia de lucrari: nu se editeaza; se sterge doar ultima, ca istoricul
-- sa nu se rescrie pe la mijloc (aceeasi regula ca `stergeUltima` in
-- src/lucrari/situatii.ts).
CREATE OR REPLACE FUNCTION situatie_doar_ultima() RETURNS trigger AS $$
BEGIN
  IF purjare_permisa(OLD.tenant_id) THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'situatia % nu se modifica', OLD.nr USING ERRCODE = 'restrict_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM situatie s
             WHERE s.tenant_id = OLD.tenant_id AND s.santier_id = OLD.santier_id AND s.nr > OLD.nr) THEN
    RAISE EXCEPTION 'se sterge doar ultima situatie, nu %', OLD.nr USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER situatie_doar_ultima_trg BEFORE UPDATE OR DELETE ON "situatie"
  FOR EACH ROW EXECUTE FUNCTION situatie_doar_ultima();--> statement-breakpoint

-- 6. Planul santierului se ingheata la prima situatie: pozitiile ei sunt
-- numerele lui. Pana atunci se reface din oferta. Stergerea santierului cu
-- situatii o opreste deja cheia straina.
CREATE OR REPLACE FUNCTION santier_plan_inghetat() RETURNS trigger AS $$
BEGIN
  IF (NEW.plan IS DISTINCT FROM OLD.plan OR NEW.oferta_id IS DISTINCT FROM OLD.oferta_id)
     AND EXISTS (SELECT 1 FROM situatie s WHERE s.tenant_id = OLD.tenant_id AND s.santier_id = OLD.id)
     AND NOT purjare_permisa(OLD.tenant_id) THEN
    RAISE EXCEPTION 'santierul % are situatii de lucrari: planul nu se mai schimba', OLD.id
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER santier_plan_inghetat_trg BEFORE UPDATE ON "santier"
  FOR EACH ROW EXECUTE FUNCTION santier_plan_inghetat();--> statement-breakpoint

-- 7. Listele de preturi active se sterg acum si pe calea de purjare, nu doar
-- trecute intai in draft.
CREATE OR REPLACE FUNCTION lista_preturi_fara_stergere() RETURNS trigger AS $$
BEGIN
  IF OLD.status <> 'draft' AND NOT purjare_permisa(OLD.tenant_id) THEN
    RAISE EXCEPTION
      'lista de preturi % e % si nu se sterge; arhiveaz-o', OLD.id, OLD.status
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
