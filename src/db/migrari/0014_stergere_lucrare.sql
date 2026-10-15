-- Stergerea de tot a unei cereri sau a unui santier (Andrei, 15 octombrie
-- 2026): cererea cu ofertele ei, santierul cu situatiile, necesarul,
-- comenzile, miscarile de stoc si documentele lor. Cere confirmare pe ecran,
-- cu lista a ce se sterge.
--
-- Trigger-ele de imutabilitate (0006, 0008, 0009, 0012) lasa sa treaca doar
-- `purjare_permisa`, care cere alt rol decat aplicatia: purjarea unui tenant
-- intreg ramane a proprietarului. Aplicatia primeste un singur drum in plus:
-- `app.sterge_lucrare` pe tenantul ei, pus local in tranzactia care sterge
-- (`stergeLucrarea` din `src/server/repo.ts`). Fara el, aplicatia, un bug sau
-- un `psql` sunt refuzate ca inainte.
CREATE OR REPLACE FUNCTION purjare_permisa(t uuid) RETURNS boolean AS $$
  SELECT (current_user <> 'izorep_app'
          AND coalesce(nullif(current_setting('app.purjare', true), '') = t::text, false))
      OR coalesce(nullif(current_setting('app.sterge_lucrare', true), '') = t::text, false);
$$ LANGUAGE sql STABLE;
