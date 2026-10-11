-- Forma in care se cumpara articolul: tub, saltea, placa, tabla (`Categorie` din
-- src/stoc/necesar.ts). Nula la articolele scrise inainte: forma lor se deduce
-- din sistem si ø (`formaImplicita`), deci stocul vechi nu se rescrie.
ALTER TABLE "articol" ADD COLUMN "forma" text;
