#!/usr/bin/env node
/**
 * Obtém token OAuth Inter sandbox (mTLS).
 * Uso (PowerShell, na raiz do repo):
 *   $env:INTER_CLIENT_ID="..."
 *   $env:INTER_CLIENT_SECRET="..."
 *   node scripts/inter-oauth-token.mjs
 *
 * Ou paths padrão QA:
 *   C:\QA\inter-sandbox\Inter API_Certificado.crt
 *   C:\QA\inter-sandbox\Inter API_Chave.key
 */
import fs from "node:fs";
import https from "node:https";

const certPath = process.env.INTER_CERT_PATH ?? "C:/QA/inter-sandbox/Inter API_Certificado.crt";
const keyPath = process.env.INTER_KEY_PATH ?? "C:/QA/inter-sandbox/Inter API_Chave.key";
const clientId = process.env.INTER_CLIENT_ID?.trim();
const clientSecret = process.env.INTER_CLIENT_SECRET?.trim();

if (!clientId || !clientSecret) {
  console.error("Defina INTER_CLIENT_ID e INTER_CLIENT_SECRET.");
  process.exit(1);
}

const cert = fs.readFileSync(certPath, "utf8").trim();
const key = fs.readFileSync(keyPath, "utf8").trim();
const body = new URLSearchParams({
  grant_type: "client_credentials",
  client_id: clientId,
  client_secret: clientSecret,
  scope: "boleto-cobranca.write boleto-cobranca.read"
}).toString();

const url = new URL("https://cdpj-sandbox.partners.uatinter.co/oauth/v2/token");

await new Promise((resolve, reject) => {
  const req = https.request(
    {
      hostname: url.hostname,
      path: url.pathname,
      method: "POST",
      cert,
      key,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body)
      }
    },
    (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        console.log("HTTP", res.statusCode);
        try {
          const j = JSON.parse(data);
          if (j.access_token) {
            console.log("access_token:", j.access_token);
            console.log("expires_in:", j.expires_in);
          } else {
            console.log(JSON.stringify(j, null, 2));
          }
        } catch {
          console.log(data || "(empty body)");
        }
        resolve();
      });
    }
  );
  req.on("error", (e) => {
    console.error("TLS/HTTP error:", e.message.split("\n")[0]);
    reject(e);
  });
  req.write(body);
  req.end();
}).catch(() => process.exit(1));
