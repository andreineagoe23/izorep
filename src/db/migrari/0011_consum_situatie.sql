-- Faza 6 (11 octombrie 2026): consumul calculat din situatia de lucrari poarta
-- situatia lui, ca sa se poata anula cu storno cand situatia se sterge
-- (src/stoc/consum.ts). Fara cheie straina: situatia se sterge, consumul
-- ramane in registru, anulat. Partea de jos e scrisa de mana, ca in 0009.

ALTER TABLE "miscare" ADD COLUMN "situatie_id" text;--> statement-breakpoint

-- Doar consumul poarta situatia (si storno-ul lui, care e tot consum).
ALTER TABLE "miscare" ADD CONSTRAINT "miscare_situatie_chk"
  CHECK (situatie_id IS NULL OR tip = 'consum');
