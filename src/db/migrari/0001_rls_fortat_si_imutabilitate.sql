-- RLS fortat + imutabilitatea listelor activate.
--
-- Migrare scrisa de mana: drizzle-kit genereaza politicile, dar nu si cele
-- doua lucruri de mai jos.

-- 1. FORCE ROW LEVEL SECURITY
--
-- ENABLE singur nu ajunge: proprietarul tabelei OCOLESTE politicile. Cum
-- migrarile ruleaza cu utilizatorul care a creat tabelele, iar in dezvoltare
-- aplicatia se conecteaza cu acelasi utilizator, politicile ar fi decorative
-- exact acolo unde vrei sa le testezi. FORCE le aplica si proprietarului.
--
-- Efect secundar de stiut: dupa FORCE, si scripturile de intretinere
-- (seed, migrari de date) trebuie sa puna contextul de tenant. E costul
-- corect — alternativa e o plasa care nu prinde nimic.
ALTER TABLE "firma" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "utilizator" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "client" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lista_preturi" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

-- 2. Lista de preturi nu se editeaza dupa activare
--
-- Principiul 3 din arhitectura: documentele sunt imutabile, corectia se face
-- prin versiune noua. Pentru liste, motivul e concret — o oferta emisa acum
-- doi ani trebuie sa ramana reproductibila, iar daca cineva a corectat o
-- celula intre timp, nu mai e.
--
-- Regula sta in baza, nu in aplicatie, fiindcă o migrare de date sau o
-- conexiune de psql ocolesc aplicatia, dar nu ocolesc un trigger.
--
-- Ce ramane permis: schimbarea statusului (activa -> arhivata) si inchiderea
-- valabilitatii. Ce se interzice: continutul, sistemul, moneda, data de
-- inceput a valabilitatii.
CREATE OR REPLACE FUNCTION lista_preturi_imutabila() RETURNS trigger AS $$
BEGIN
  IF OLD.status <> 'draft' THEN
    IF NEW.continut IS DISTINCT FROM OLD.continut
       OR NEW.sistem IS DISTINCT FROM OLD.sistem
       OR NEW.moneda IS DISTINCT FROM OLD.moneda
       OR NEW.valabil_de_la IS DISTINCT FROM OLD.valabil_de_la
    THEN
      RAISE EXCEPTION
        'lista de preturi % e % si nu se mai editeaza; creeaza o versiune noua',
        OLD.id, OLD.status
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER lista_preturi_imutabila_trg
  BEFORE UPDATE ON "lista_preturi"
  FOR EACH ROW EXECUTE FUNCTION lista_preturi_imutabila();--> statement-breakpoint

-- Stergerea unei liste activate ar avea acelasi efect ca editarea ei.
CREATE OR REPLACE FUNCTION lista_preturi_fara_stergere() RETURNS trigger AS $$
BEGIN
  IF OLD.status <> 'draft' THEN
    RAISE EXCEPTION
      'lista de preturi % e % si nu se sterge; arhiveaz-o', OLD.id, OLD.status
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER lista_preturi_fara_stergere_trg
  BEFORE DELETE ON "lista_preturi"
  FOR EACH ROW EXECUTE FUNCTION lista_preturi_fara_stergere();
