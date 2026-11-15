-- Memoria de șabloane a importului (L4), pe firmă (14 noiembrie 2026, planul
-- UX, Faza 6, punctul 2). Stătea în `localStorage`, în browserul celui care a
-- corectat: colegul refăcea aceleași corecturi. Cheia e tiparul.
CREATE TABLE "sablon_import" (
	"tenant_id" uuid NOT NULL,
	"tipar" text NOT NULL,
	"sablon" jsonb NOT NULL,
	"actualizat_la" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizat_de" text,
	CONSTRAINT "sablon_import_tenant_id_tipar_pk" PRIMARY KEY("tenant_id","tipar")
);
--> statement-breakpoint
ALTER TABLE "sablon_import" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sablon_import" ADD CONSTRAINT "sablon_import_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "sablon_import_tenant" ON "sablon_import" AS PERMISSIVE FOR ALL TO public USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "sablon_import" FORCE ROW LEVEL SECURITY;
