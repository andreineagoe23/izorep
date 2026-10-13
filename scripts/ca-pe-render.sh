#!/usr/bin/env bash
# Proba „ca pe Render” (docs/plan-pana-la-render.md, R0): un Postgres 18 nou,
# separat de baza de dezvoltare, cu un proprietar care NU e superuser (ca pe
# Render), migrarile si seed-ul ca proprietar, apoi serverul construit pentru
# productie, deschis (HOST=0.0.0.0) si cu parola comuna.
#
#   npm run ca-pe-render                        cu CREATEROLE: aplicatia intra ca izorep_app
#   npm run ca-pe-render -- --fara-createrole   fara: aplicatia intra cu proprietarul (R1)
#   npm run ca-pe-render -- --teste             ruleaza si suita pe baza asta, apoi porneste serverul
#   npm run ca-pe-render -- --demo              pune si starea de demo (npm run demo)
#   npm run ca-pe-render -- --fara-server       doar baza (si testele)
#   npm run ca-pe-render -- --opreste           sterge containerul
#
# Baza ramane pornita intre rulari doar cat containerul exista; fiecare rulare
# o face din nou, de la zero. Portul bazei: 5434; al serverului: 8799.
set -euo pipefail
cd "$(dirname "$0")/.."

CONTAINER=izorep-render
PORT_BAZA=5434
PORT_SERVER=${PORT_SERVER:-8799}
PAROLA_SITE=${IZOREP_PAROLA:-demo}

createrole=1 teste=0 server=1 demo=0
for a in "$@"; do
  case "$a" in
    --fara-createrole) createrole=0 ;;
    --teste) teste=1 ;;
    --demo) demo=1 ;;
    --fara-server) server=0 ;;
    --opreste) docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; echo "Proba oprita."; exit 0 ;;
    *) echo "Nu stiu ce e $a" >&2; exit 2 ;;
  esac
done

docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
# Superuserul containerului e doar al nostru, pentru pregatire; Render nu ni-l
# da. Proprietarul bazei e `izorep`, fara SUPERUSER si fara BYPASSRLS.
docker run -d --name "$CONTAINER" -e POSTGRES_USER=admin -e POSTGRES_PASSWORD=admin \
  -p "$PORT_BAZA:5432" postgres:18 >/dev/null
until docker exec "$CONTAINER" pg_isready -U admin >/dev/null 2>&1; do sleep 0.5; done
sleep 1
drepturi="LOGIN NOSUPERUSER NOBYPASSRLS"
[ "$createrole" = 1 ] && drepturi="$drepturi CREATEROLE" || drepturi="$drepturi NOCREATEROLE"
docker exec "$CONTAINER" psql -q -U admin -d postgres \
  -c "CREATE ROLE izorep $drepturi PASSWORD 'izorep-render'" \
  -c "CREATE DATABASE izorep OWNER izorep" >/dev/null

export DATABASE_URL_PROPRIETAR="postgres://izorep:izorep-render@localhost:$PORT_BAZA/izorep"
export IZOREP_APP_PAROLA="app-$(openssl rand -hex 12)"
unset DATABASE_URL IZOREP_DB

echo "Proba: Postgres 18 pe $PORT_BAZA, proprietar izorep ($drepturi)"
npm run -s db:migrate
npm run -s db:seed >/dev/null
echo "Seed facut."

if [ "$teste" = 1 ]; then
  # Fara izorep_app, testele intra ca aplicatie cu proprietarul, ca serverul.
  if [ "$createrole" = 0 ]; then export DATABASE_URL="$DATABASE_URL_PROPRIETAR"; fi
  IZOREP_CERE_BAZA=1 npx vitest run
  unset DATABASE_URL
fi

[ "$demo" = 1 ] && npm run -s demo -- "$DATABASE_URL_PROPRIETAR"

[ "$server" = 1 ] || { echo "Baza ramane pornita: $DATABASE_URL_PROPRIETAR"; exit 0; }

npm run -s build:server >/dev/null
echo "Pagina construita pentru server."
echo
echo "Deschide http://localhost:$PORT_SERVER  ·  utilizator: oricare  ·  parola: $PAROLA_SITE"
echo "Oprire: Ctrl+C, apoi npm run ca-pe-render -- --opreste"
HOST=0.0.0.0 PORT="$PORT_SERVER" IZOREP_PAROLA="$PAROLA_SITE" exec npm run -s server
