-- Blocarea dupa parole gresite trece de pe cont pe cont + adresa, in memoria
-- serverului (`blocariIntrare` din `src/server/securitate.ts`, 23 octombrie
-- 2026). Pe cont, cu un singur cont activ si adresa lui in repo-ul public,
-- oricine putea tine firma afara cu 5 parole gresite. Coloanele raman fara
-- rost.
--
ALTER TABLE "utilizator" DROP COLUMN "incercari_gresite";--> statement-breakpoint
ALTER TABLE "utilizator" DROP COLUMN "blocat_pana";