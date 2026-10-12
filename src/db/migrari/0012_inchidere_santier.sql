-- Faza 7 (11 octombrie 2026): inchiderea santierului. Se inchide doar cu
-- stocul la zero (src/lucrari/inchidere.ts); inchis, nu mai primeste situatii
-- si nici miscari pe depozitul lui. Partea de jos e scrisa de mana, ca 0006.

ALTER TABLE "santier" ADD COLUMN "inchis_la" timestamp with time zone;--> statement-breakpoint

-- 1. Santierul inchis ramane inchis, cu planul lui, si nu se sterge.
CREATE OR REPLACE FUNCTION santier_inchis() RETURNS trigger AS $$
BEGIN
  IF purjare_permisa(OLD.tenant_id) THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF OLD.inchis_la IS NULL THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'santierul % e inchis si nu se sterge', OLD.id USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW.inchis_la IS DISTINCT FROM OLD.inchis_la OR NEW.plan IS DISTINCT FROM OLD.plan
     OR NEW.oferta_id IS DISTINCT FROM OLD.oferta_id THEN
    RAISE EXCEPTION 'santierul % e inchis: nu se mai schimba', OLD.id USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER santier_inchis_trg BEFORE UPDATE OR DELETE ON "santier"
  FOR EACH ROW EXECUTE FUNCTION santier_inchis();--> statement-breakpoint

-- 2. Nicio situatie noua pe un santier inchis, si nici una stearsa.
CREATE OR REPLACE FUNCTION situatie_santier_deschis() RETURNS trigger AS $$
DECLARE
  r record;
BEGIN
  r := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  IF TG_OP = 'DELETE' AND purjare_permisa(OLD.tenant_id) THEN
    RETURN OLD;
  END IF;
  IF EXISTS (SELECT 1 FROM santier s
             WHERE s.tenant_id = r.tenant_id AND s.id = r.santier_id AND s.inchis_la IS NOT NULL) THEN
    RAISE EXCEPTION 'santierul % e inchis: situatiile lui nu se mai schimba', r.santier_id USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN r;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER situatie_santier_deschis_trg BEFORE INSERT OR DELETE ON "situatie"
  FOR EACH ROW EXECUTE FUNCTION situatie_santier_deschis();--> statement-breakpoint

-- 3. Nicio miscare noua din sau spre depozitul unui santier inchis (id-ul
-- depozitului e id-ul santierului). Intrarile din central facute pentru el
-- (lucrare_id) raman voie: factura lor poate veni dupa.
CREATE OR REPLACE FUNCTION miscare_santier_deschis() RETURNS trigger AS $$
DECLARE
  inchis text;
BEGIN
  SELECT s.id INTO inchis FROM santier s
   WHERE s.tenant_id = NEW.tenant_id AND s.inchis_la IS NOT NULL AND s.id IN (NEW.din, NEW.spre)
   LIMIT 1;
  IF inchis IS NOT NULL THEN
    RAISE EXCEPTION 'santierul % e inchis: nu mai primeste miscari', inchis USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER miscare_santier_deschis_trg BEFORE INSERT ON "miscare"
  FOR EACH ROW EXECUTE FUNCTION miscare_santier_deschis();
