-- `purjare_permisa` intorcea NULL, nu false, pentru orice rol in afara de
-- izorep_app fara `app.purjare` pus: `true AND NULL` e NULL. Trigger-ele
-- scrise cu `IF purjare_permisa(...)` cadeau corect pe refuz, dar cele cu
-- `NOT purjare_permisa(...)` (planul inghetat la prima situatie, 0006; lista
-- de preturi activa care nu se sterge, 0006) nu mai refuzau nimic, pentru
-- ca `NOT NULL` e tot NULL.
--
-- Cu aplicatia ca izorep_app nu se vedea: acolo primul termen e false, deci
-- totul e false. S-a vazut pe proba ca pe Render fara CREATEROLE (13
-- octombrie 2026), unde aplicatia intra cu proprietarul si putea schimba
-- planul unui santier cu situatii. La fel putea orice `psql` deschis ca
-- proprietar.
CREATE OR REPLACE FUNCTION purjare_permisa(t uuid) RETURNS boolean AS $$
  SELECT current_user <> 'izorep_app'
     AND coalesce(nullif(current_setting('app.purjare', true), '') = t::text, false);
$$ LANGUAGE sql STABLE;
