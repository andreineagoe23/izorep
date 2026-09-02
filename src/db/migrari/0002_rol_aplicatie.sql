-- Rol de aplicatie, separat de proprietarul schemei.
--
-- DESCOPERIT PRIN TEST, nu prin citit documentatie: cu aplicatia conectata ca
-- `izorep`, toate testele de izolare picau — "fara context de tenant nu se
-- vede nimic" intorcea toate randurile. Motivul: utilizatorul creat de
-- imaginea Docker e SUPERUSER, iar superuserii si rolurile cu BYPASSRLS
-- ocolesc politicile complet. Nici macar FORCE ROW LEVEL SECURITY nu-i
-- opreste.
--
-- Consecinta pentru productie, nu doar pentru local: daca aplicatia se
-- conecteaza cu rolul administrativ pe care ti-l da furnizorul de baza
-- administrata, RLS e decorativ. Verificarea nu e "am scris politici", ci
-- "testul de izolare pica atunci cand ar trebui sa pice".
--
-- Impartirea rolurilor:
--   izorep      — proprietar. Ruleaza migrarile. Superuser local.
--   izorep_app  — aplicatia. Fara BYPASSRLS, deci supus politicilor.
--
-- Parola de aici e pentru baza LOCALA din docker-compose. In productie rolul
-- se creeaza cu parola din managerul de secrete al furnizorului si nu ajunge
-- niciodata intr-un fisier commit-uit.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'izorep_app') THEN
    CREATE ROLE izorep_app LOGIN PASSWORD 'izorep_app' NOBYPASSRLS;
  END IF;
END
$$;--> statement-breakpoint

GRANT USAGE ON SCHEMA public TO izorep_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO izorep_app;--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO izorep_app;--> statement-breakpoint

-- Tabelele viitoare primesc aceleasi drepturi automat. Fara asta, fiecare
-- migrare noua ar trebui sa-si aminteasca de GRANT — si intr-o zi n-ar face-o,
-- iar eroarea ar aparea abia in productie.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO izorep_app;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO izorep_app;
