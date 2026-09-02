CREATE TABLE "client" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"denumire" text NOT NULL,
	"cui" text,
	"categorie" text,
	"sursa" text,
	"creat_la" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "firma" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"denumire" text NOT NULL,
	"cui" text,
	"reg_com" text,
	"serie_oferta" text,
	"serie_factura" text,
	"creat_la" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "firma" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lista_preturi" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sistem" text NOT NULL,
	"denumire" text NOT NULL,
	"contine" text NOT NULL,
	"moneda" text DEFAULT 'EUR' NOT NULL,
	"valabil_de_la" date NOT NULL,
	"valabil_pana_la" date,
	"status" text DEFAULT 'draft' NOT NULL,
	"sursa" text,
	"continut" jsonb NOT NULL,
	"creat_la" timestamp with time zone DEFAULT now() NOT NULL,
	"creat_de" uuid
);
--> statement-breakpoint
ALTER TABLE "lista_preturi" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tenant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"denumire" text NOT NULL,
	"activ" boolean DEFAULT true NOT NULL,
	"creat_la" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "utilizator" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" text NOT NULL,
	"nume" text NOT NULL,
	"rol" text NOT NULL,
	"activ" boolean DEFAULT true NOT NULL,
	"creat_la" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "utilizator" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "client" ADD CONSTRAINT "client_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "firma" ADD CONSTRAINT "firma_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lista_preturi" ADD CONSTRAINT "lista_preturi_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lista_preturi" ADD CONSTRAINT "lista_preturi_creat_de_utilizator_id_fk" FOREIGN KEY ("creat_de") REFERENCES "public"."utilizator"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utilizator" ADD CONSTRAINT "utilizator_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_tenant_idx" ON "client" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "firma_tenant_idx" ON "firma" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "lista_preturi_tenant_sistem_idx" ON "lista_preturi" USING btree ("tenant_id","sistem","status");--> statement-breakpoint
CREATE UNIQUE INDEX "lista_preturi_una_activa_idx" ON "lista_preturi" USING btree ("tenant_id","sistem") WHERE status = 'activa';--> statement-breakpoint
CREATE UNIQUE INDEX "utilizator_tenant_email_idx" ON "utilizator" USING btree ("tenant_id","email");--> statement-breakpoint
CREATE POLICY "client_tenant" ON "client" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "firma_tenant" ON "firma" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "lista_preturi_tenant" ON "lista_preturi" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "utilizator_tenant" ON "utilizator" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);