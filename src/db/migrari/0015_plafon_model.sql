-- Plafonul zilnic pe model (OpenAI), cerut de Andrei pe 16 octombrie 2026:
-- serverul e in internet, iar cine trece de parola comuna ar putea chema
-- modelul pe cheia firmei fara limita. `src/server/limita-model.ts` numara
-- aici, pe zi si pe tip, randurile din Excel si pozele / avizele citite.
--
-- In baza, nu in memoria serverului: pe Render serverul gratuit adoarme dupa
-- 15 minute si ar porni plafonul de la zero la fiecare trezire. Fara
-- tenant_id: cheia e a serverului, deci si plafonul.
CREATE TABLE "folosire_model" (
	"zi" date NOT NULL,
	"tip" text NOT NULL,
	"unitati" integer NOT NULL,
	CONSTRAINT "folosire_model_zi_tip_pk" PRIMARY KEY("zi","tip")
);
