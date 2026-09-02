import { existsSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { extrageCuModel } from "../src/import/extract-llm.js";
import { RaspunsModel } from "../src/import/schema.js";

/**
 * Stratul cu model, disponibil DOAR pe serverul de dezvoltare.
 *
 * Cheia OpenAI sta in procesul Node al lui `vite dev` si nu ajunge niciodata in
 * pagina: browserul trimite liniile reziduale aici, primeste inapoi parametrii
 * extrasi si tarifeaza determinist, local.
 *
 * `apply: "serve"` nu e cosmetic — e mecanismul care face imposibila scaparea
 * cheii intr-un build: ruta nu exista in `vite build`, deci varianta de pe
 * GitHub Pages ramane 100% determinista, fara ca ecranul sa stie altceva decat
 * ca ruta lipseste.
 */
const RUTA = "/api/extrage";

/** Plafon per cerere: un fisier de 3.000 de randuri nu trebuie sa poata porni
 *  3.000 de extrageri dintr-un click gresit. */
const MAX_LINII = 400;
const MAX_CORP = 4 * 1024 * 1024;

interface LinieCerere { index: number; text: string; um?: string }

const esteLocal = (req: IncomingMessage): boolean => {
  const ip = req.socket.remoteAddress ?? "";
  return ip === "::1" || ip === "127.0.0.1" || ip === "::ffff:127.0.0.1";
};

const raspunde = (res: ServerResponse, cod: number, corp: unknown): void => {
  res.statusCode = cod;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(corp));
};

function citesteCorp(req: IncomingMessage): Promise<string> {
  return new Promise((rezolva, respinge) => {
    let date = "";
    req.on("data", (bucata: Buffer) => {
      date += bucata.toString("utf8");
      if (date.length > MAX_CORP) { respinge(new Error("corp prea mare")); req.destroy(); }
    });
    req.on("end", () => rezolva(date));
    req.on("error", respinge);
  });
}

export function pluginModel(): Plugin {
  return {
    name: "izorep-model",
    apply: "serve",

    configureServer(server) {
      // .env e gitignorat si contine cheia. Node 21+ il incarca nativ.
      if (existsSync(".env")) process.loadEnvFile(".env");
      const cheie = process.env["OPENAI_API_KEY"];
      const model = process.env["OPENAI_MODEL"] ?? "gpt-4.1";
      const prag = Number(process.env["IZOREP_CONFIDENCE_THRESHOLD"] ?? 0.85);
      // Prima manevra cand contul OpenAI da 429: IZOREP_CONCURENTA=1.
      const nr = (c: string, i: number) => {
        const v = Number(process.env[c]);
        return Number.isFinite(v) && v > 0 ? Math.floor(v) : i;
      };
      const lot = nr("IZOREP_LOT", 25);
      const concurenta = nr("IZOREP_CONCURENTA", 4);

      server.config.logger.info(
        cheie
          ? `  ➜  Stratul cu model: activ (${model}), doar pe acest server`
          : `  ➜  Stratul cu model: inactiv (OPENAI_API_KEY lipseste din .env)`,
      );

      server.middlewares.use((req, res, next) => {
        if (!req.url?.split("?")[0]?.endsWith(RUTA)) return next();
        if (!esteLocal(req)) return raspunde(res, 403, { eroare: "doar de pe localhost" });

        if (req.method === "GET") {
          return raspunde(res, 200, { disponibil: Boolean(cheie), model, prag, lot, concurenta });
        }
        if (req.method !== "POST") return raspunde(res, 405, { eroare: "metoda nepermisa" });
        if (!cheie) return raspunde(res, 503, { eroare: "OPENAI_API_KEY lipseste din .env" });

        void (async () => {
          try {
            const corp = JSON.parse(await citesteCorp(req)) as { linii?: LinieCerere[] };
            const linii = (corp.linii ?? []).slice(0, MAX_LINII);
            if (linii.length === 0) return raspunde(res, 200, { linii: [], trunchiat: 0 });

            server.config.logger.info(`  ➜  model: extrag ${linii.length} linii reziduale`);
            const extrase = await extrageCuModel(linii, {
              apiKey: cheie, model, dimensiuneLot: lot, concurenta,
            });

            // Ce iese din model trece prin aceeasi schema ca in CLI, inca o data
            // inainte sa plece spre pagina. Validarea nu e optionala.
            raspunde(res, 200, {
              linii: RaspunsModel.parse({ linii: extrase }).linii,
              trunchiat: Math.max(0, (corp.linii?.length ?? 0) - linii.length),
            });
          } catch (e) {
            const mesaj = e instanceof Error ? e.message : String(e);
            server.config.logger.error(`  ✗  model: ${mesaj}`);
            raspunde(res, 500, { eroare: mesaj });
          }
        })();
        return undefined;
      });
    },
  };
}
