-- Faza 3 (9 octombrie 2026): datele comune. Generata din schema.ts; FORCE,
-- trigger-ele si verificarile sunt in 0006, scrisa de mana.

CREATE TABLE "ambalaj" (
	"tenant_id" uuid NOT NULL,
	"cheie_baza" text NOT NULL,
	"unitate" text NOT NULL,
	"continut" numeric(12, 3) NOT NULL,
	CONSTRAINT "ambalaj_tenant_id_cheie_baza_pk" PRIMARY KEY("tenant_id","cheie_baza")
);
--> statement-breakpoint
ALTER TABLE "ambalaj" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "anexa_santier" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"santier_id" text NOT NULL,
	"motiv" text NOT NULL,
	"pozitii" jsonb NOT NULL,
	"creat_de" uuid,
	"creat_la" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "anexa_santier" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "articol" (
	"tenant_id" uuid NOT NULL,
	"cheie" text NOT NULL,
	"sistem" text NOT NULL,
	"grosime_mm" numeric(8, 2),
	"rand" numeric(8, 2),
	"um" text NOT NULL,
	"marca" text,
	CONSTRAINT "articol_tenant_id_cheie_pk" PRIMARY KEY("tenant_id","cheie")
);
--> statement-breakpoint
ALTER TABLE "articol" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cerere" (
	"tenant_id" uuid NOT NULL,
	"id" text NOT NULL,
	"nume" text NOT NULL,
	"marime" integer NOT NULL,
	"cand" timestamp with time zone NOT NULL,
	"model" text,
	"destinatie" text,
	"pozitii" integer NOT NULL,
	"tarifate" integer NOT NULL,
	"valoare" numeric(14, 2) NOT NULL,
	"fisier" "bytea" NOT NULL,
	"lucru" jsonb NOT NULL,
	"creat_de" uuid,
	"actualizat_la" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cerere_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "cerere" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "depozit" (
	"tenant_id" uuid NOT NULL,
	"id" text NOT NULL,
	"denumire" text NOT NULL,
	"tip" text NOT NULL,
	"firma_id" uuid,
	"santier_id" text,
	"responsabil" text,
	CONSTRAINT "depozit_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "depozit" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "furnizor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"denumire" text NOT NULL,
	"vinde" text NOT NULL,
	"email" text,
	"telefon" text
);
--> statement-breakpoint
ALTER TABLE "furnizor" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "masuratoare" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"scop" text NOT NULL,
	"santier_id" text,
	"poza" "bytea",
	"tip_poza" text,
	"randuri" jsonb NOT NULL,
	"creat_de" uuid,
	"creat_la" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "masuratoare" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "miscare" (
	"tenant_id" uuid NOT NULL,
	"id" text NOT NULL,
	"data" timestamp with time zone NOT NULL,
	"tip" text NOT NULL,
	"articol_cheie" text NOT NULL,
	"cantitate" numeric(14, 3) NOT NULL,
	"din" text,
	"spre" text,
	"lucrare_id" text,
	"nota" text,
	"anuleaza" text,
	"pret" numeric(14, 4),
	"creat_de" uuid,
	"creat_la" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "miscare_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "miscare" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "necesar" (
	"tenant_id" uuid NOT NULL,
	"id" text NOT NULL,
	"santier_id" text,
	"continut" jsonb NOT NULL,
	"actualizat_la" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "necesar_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "necesar" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "oferta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"cerere_id" text NOT NULL,
	"versiune" integer NOT NULL,
	"firma_id" uuid,
	"numar" text NOT NULL,
	"data" text NOT NULL,
	"client" text NOT NULL,
	"obiectiv" text NOT NULL,
	"valoare" numeric(14, 2) NOT NULL,
	"pozitii" integer NOT NULL,
	"continut" jsonb,
	"mutata" boolean DEFAULT false NOT NULL,
	"creat_de" uuid,
	"creat_la" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "oferta" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "santier" (
	"tenant_id" uuid NOT NULL,
	"id" text NOT NULL,
	"oferta_id" uuid,
	"firma_id" uuid,
	"denumire" text NOT NULL,
	"fisier" text NOT NULL,
	"plan" jsonb NOT NULL,
	"responsabil" text,
	"creat" timestamp with time zone NOT NULL,
	CONSTRAINT "santier_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "santier" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sesiune" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"utilizator_id" uuid NOT NULL,
	"hash" text NOT NULL,
	"expira" timestamp with time zone NOT NULL,
	"creat_la" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sesiune" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "situatie" (
	"tenant_id" uuid NOT NULL,
	"santier_id" text NOT NULL,
	"nr" integer NOT NULL,
	"id" text NOT NULL,
	"data" timestamp with time zone NOT NULL,
	"cantitati" jsonb NOT NULL,
	"nota" text,
	"creat_de" uuid,
	CONSTRAINT "situatie_tenant_id_santier_id_nr_pk" PRIMARY KEY("tenant_id","santier_id","nr")
);
--> statement-breakpoint
ALTER TABLE "situatie" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "token_intrare" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"utilizator_id" uuid NOT NULL,
	"hash" text NOT NULL,
	"expira" timestamp with time zone NOT NULL,
	"folosit_la" timestamp with time zone,
	"creat_la" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "token_intrare" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "firma" ADD COLUMN "cod" text;--> statement-breakpoint
ALTER TABLE "ambalaj" ADD CONSTRAINT "ambalaj_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anexa_santier" ADD CONSTRAINT "anexa_santier_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anexa_santier" ADD CONSTRAINT "anexa_santier_creat_de_utilizator_id_fk" FOREIGN KEY ("creat_de") REFERENCES "public"."utilizator"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anexa_santier" ADD CONSTRAINT "anexa_santier_tenant_id_santier_id_santier_tenant_id_id_fk" FOREIGN KEY ("tenant_id","santier_id") REFERENCES "public"."santier"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articol" ADD CONSTRAINT "articol_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cerere" ADD CONSTRAINT "cerere_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cerere" ADD CONSTRAINT "cerere_creat_de_utilizator_id_fk" FOREIGN KEY ("creat_de") REFERENCES "public"."utilizator"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "depozit" ADD CONSTRAINT "depozit_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "depozit" ADD CONSTRAINT "depozit_firma_id_firma_id_fk" FOREIGN KEY ("firma_id") REFERENCES "public"."firma"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "furnizor" ADD CONSTRAINT "furnizor_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "masuratoare" ADD CONSTRAINT "masuratoare_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "masuratoare" ADD CONSTRAINT "masuratoare_creat_de_utilizator_id_fk" FOREIGN KEY ("creat_de") REFERENCES "public"."utilizator"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "miscare" ADD CONSTRAINT "miscare_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "miscare" ADD CONSTRAINT "miscare_creat_de_utilizator_id_fk" FOREIGN KEY ("creat_de") REFERENCES "public"."utilizator"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "miscare" ADD CONSTRAINT "miscare_tenant_id_articol_cheie_articol_tenant_id_cheie_fk" FOREIGN KEY ("tenant_id","articol_cheie") REFERENCES "public"."articol"("tenant_id","cheie") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "necesar" ADD CONSTRAINT "necesar_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oferta" ADD CONSTRAINT "oferta_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oferta" ADD CONSTRAINT "oferta_firma_id_firma_id_fk" FOREIGN KEY ("firma_id") REFERENCES "public"."firma"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oferta" ADD CONSTRAINT "oferta_creat_de_utilizator_id_fk" FOREIGN KEY ("creat_de") REFERENCES "public"."utilizator"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oferta" ADD CONSTRAINT "oferta_tenant_id_cerere_id_cerere_tenant_id_id_fk" FOREIGN KEY ("tenant_id","cerere_id") REFERENCES "public"."cerere"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "santier" ADD CONSTRAINT "santier_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "santier" ADD CONSTRAINT "santier_oferta_id_oferta_id_fk" FOREIGN KEY ("oferta_id") REFERENCES "public"."oferta"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "santier" ADD CONSTRAINT "santier_firma_id_firma_id_fk" FOREIGN KEY ("firma_id") REFERENCES "public"."firma"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sesiune" ADD CONSTRAINT "sesiune_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sesiune" ADD CONSTRAINT "sesiune_utilizator_id_utilizator_id_fk" FOREIGN KEY ("utilizator_id") REFERENCES "public"."utilizator"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "situatie" ADD CONSTRAINT "situatie_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "situatie" ADD CONSTRAINT "situatie_creat_de_utilizator_id_fk" FOREIGN KEY ("creat_de") REFERENCES "public"."utilizator"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "situatie" ADD CONSTRAINT "situatie_tenant_id_santier_id_santier_tenant_id_id_fk" FOREIGN KEY ("tenant_id","santier_id") REFERENCES "public"."santier"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_intrare" ADD CONSTRAINT "token_intrare_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_intrare" ADD CONSTRAINT "token_intrare_utilizator_id_utilizator_id_fk" FOREIGN KEY ("utilizator_id") REFERENCES "public"."utilizator"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "furnizor_tenant_denumire_idx" ON "furnizor" USING btree ("tenant_id","denumire");--> statement-breakpoint
CREATE INDEX "masuratoare_santier_idx" ON "masuratoare" USING btree ("tenant_id","santier_id");--> statement-breakpoint
CREATE UNIQUE INDEX "oferta_cerere_versiune_idx" ON "oferta" USING btree ("tenant_id","cerere_id","versiune");--> statement-breakpoint
CREATE UNIQUE INDEX "sesiune_hash_idx" ON "sesiune" USING btree ("hash");--> statement-breakpoint
CREATE UNIQUE INDEX "token_intrare_hash_idx" ON "token_intrare" USING btree ("hash");--> statement-breakpoint
CREATE UNIQUE INDEX "firma_tenant_cod_idx" ON "firma" USING btree ("tenant_id","cod");--> statement-breakpoint
CREATE POLICY "utilizator_dupa_email" ON "utilizator" AS PERMISSIVE FOR SELECT TO public USING (lower(email) = nullif(current_setting('app.email_cautat', true), ''));--> statement-breakpoint
CREATE POLICY "ambalaj_tenant" ON "ambalaj" AS PERMISSIVE FOR ALL TO public USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "anexa_santier_tenant" ON "anexa_santier" AS PERMISSIVE FOR ALL TO public USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "articol_tenant" ON "articol" AS PERMISSIVE FOR ALL TO public USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "cerere_tenant" ON "cerere" AS PERMISSIVE FOR ALL TO public USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "depozit_tenant" ON "depozit" AS PERMISSIVE FOR ALL TO public USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "furnizor_tenant" ON "furnizor" AS PERMISSIVE FOR ALL TO public USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "masuratoare_tenant" ON "masuratoare" AS PERMISSIVE FOR ALL TO public USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "miscare_tenant" ON "miscare" AS PERMISSIVE FOR ALL TO public USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "necesar_tenant" ON "necesar" AS PERMISSIVE FOR ALL TO public USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "oferta_tenant" ON "oferta" AS PERMISSIVE FOR ALL TO public USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "santier_tenant" ON "santier" AS PERMISSIVE FOR ALL TO public USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "sesiune_tenant" ON "sesiune" AS PERMISSIVE FOR ALL TO public USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "sesiune_dupa_hash" ON "sesiune" AS PERMISSIVE FOR ALL TO public USING (hash = nullif(current_setting('app.hash_cautat', true), '')) WITH CHECK (hash = nullif(current_setting('app.hash_cautat', true), ''));--> statement-breakpoint
CREATE POLICY "situatie_tenant" ON "situatie" AS PERMISSIVE FOR ALL TO public USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "token_intrare_tenant" ON "token_intrare" AS PERMISSIVE FOR ALL TO public USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "token_intrare_dupa_hash" ON "token_intrare" AS PERMISSIVE FOR ALL TO public USING (hash = nullif(current_setting('app.hash_cautat', true), '')) WITH CHECK (hash = nullif(current_setting('app.hash_cautat', true), ''));