/**
 * Trimiterea linkului de intrare. Local, SMTP-ul e Mailpit (din
 * docker-compose): emailurile se vad pe http://localhost:8025, nu pleaca
 * nicaieri. In productie, `SMTP_URL` arata spre furnizorul ales atunci.
 */
import { createTransport } from "nodemailer";
import type { TrimiteLink } from "./intrare.js";

export function trimitePeEmail(smtpUrl: string, de: string): TrimiteLink {
  const transport = createTransport(smtpUrl);
  return async (catre, link) => {
    await transport.sendMail({
      from: de,
      to: catre.email,
      subject: "Linkul tău de intrare în Izorep",
      text: [
        `Bună, ${catre.nume},`,
        "",
        `Ca să intri în Izorep${catre.firma ? ` (${catre.firma})` : ""}, deschide linkul de mai jos:`,
        link,
        "",
        "Linkul merge o singură dată, în următoarele 15 minute.",
        "Dacă n-ai cerut tu să intri, poți ignora mesajul.",
      ].join("\n"),
    });
  };
}
