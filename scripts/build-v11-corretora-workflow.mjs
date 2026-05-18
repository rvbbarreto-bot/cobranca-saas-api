/**
 * Gera workflows/Emissor_NF_V11_Corretora_Seguros.json a partir da cópia V10.
 * Uso: node scripts/build-v11-corretora-workflow.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const srcPath = path.join(root, "workflows", "Emissor_NF_V10_RTC_Fiscal - Copia.json");
const outPath = path.join(root, "workflows", "Emissor_NF_V11_Corretora_Seguros.json");

const data = JSON.parse(fs.readFileSync(srcPath, "utf8"));

data.name = "Emissor NF - V11 Corretora Seguros (RTC)";
data.meta = {
  ...(data.meta || {}),
  workflow_revision: "v11-corretora",
  workflow_revision_note:
    "V11: tenant_segment corretora, gate fiscal, NBS padrão tenant, fallback município parametrizável, UPDATE fiscal_audit_package pós-pré-validador. Emissão homologada V10 inalterada quando tenant_segment=generico."
};

function nodeByName(name) {
  const n = data.nodes.find((x) => x.name === name);
  if (!n) throw new Error(`Node não encontrado: ${name}`);
  return n;
}

/* ---------- Resolver Tenant SaaS ---------- */
const resolver = nodeByName("Resolver Tenant SaaS");
const q = resolver.parameters.query;
const inj = `  COALESCE(t.tenant_segment, 'generico') AS tenant_segment,
  COALESCE(t.fiscal_corretora_strict, false) AS fiscal_corretora_strict,
  COALESCE(t.fiscal_allow_municipio_tomador_fallback, true) AS fiscal_allow_municipio_tomador_fallback,
  NULLIF(trim(COALESCE(t.fiscal_corretora_codigo_nbs_padrao::text, '')), '') AS fiscal_corretora_codigo_nbs_padrao,
  COALESCE(NULLIF(trim(t.fiscal_corretora_perfil_padrao::text), ''), 'livre') AS fiscal_corretora_perfil_padrao
`;
if (!q.includes("tenant_segment")) {
  resolver.parameters.query = q.replace(
    "  NULLIF(trim(t.rtc_ibs_rate::text), '') AS rtc_ibs_rate\n\nFROM src",
    `  NULLIF(trim(t.rtc_ibs_rate::text), '') AS rtc_ibs_rate,
${inj}
FROM src`
  );
}

/* ---------- Pré-validar Focus1: fallback município ---------- */
const pre1 = nodeByName("AJUSTE SÊNIOR | Pré-validar Payload Focus1");
let js = pre1.parameters.jsCode;
const marker = `const usarFallbackMunicipioTomadorPelaPrestacao = toBool(
  merge.usar_municipio_prestacao_como_municipio_tomador ??
  merge.fallback_municipio_tomador_pela_prestacao ??
  true,
  true
);`;
const repl = `const allowMunTomadorFallbackTenant = toBool(
  merge.fiscal_allow_municipio_tomador_fallback,
  true
);
const usarFallbackMunicipioTomadorPelaPrestacao =
  allowMunTomadorFallbackTenant &&
  toBool(
    merge.usar_municipio_prestacao_como_municipio_tomador ??
      merge.fallback_municipio_tomador_pela_prestacao ??
      true,
    true
  );`;
if (js.includes(marker)) {
  pre1.parameters.jsCode = js.replace(marker, repl);
} else if (!js.includes("allowMunTomadorFallbackTenant")) {
  console.warn("Marcador fallback não encontrado; pré-validador não alterado.");
}

/* ---------- Novos nós ---------- */
const gateId = "a1b2c3d4-corretora-gate-0001";
const gateIfId = "a1b2c3d4-corretora-if-0002";
const gateWaId = "a1b2c3d4-corretora-wa-0003";
const updAuditId = "a1b2c3d4-corretora-audit-0004";
const reidratId = "a1b2c3d4-corretora-reidr-0005";

const gateCode = [
  "const d = $json || {};",
  "const tenant = $items('Aplicar Tenant + Contexto', 0, 0)?.[0]?.json || {};",
  "const seg = String(tenant.tenant_segment || 'generico').toLowerCase();",
  "const strict = tenant.fiscal_corretora_strict === true || String(tenant.fiscal_corretora_strict).toLowerCase() === 'true';",
  "const perfil = String(tenant.fiscal_corretora_perfil_padrao || 'livre').toLowerCase();",
  "function onlyDigits(s) { return String(s || '').replace(/\\D/g, ''); }",
  "let codigo_nbs = String(d.codigo_nbs || '').trim();",
  "if (!codigo_nbs && tenant.fiscal_corretora_codigo_nbs_padrao) {",
  "  codigo_nbs = String(tenant.fiscal_corretora_codigo_nbs_padrao).trim();",
  "}",
  "const munTom = onlyDigits(d.tomador_codigo_municipio);",
  "const hasEndereco = !!(d.tomador_cep || d.tomador_logradouro || d.tomador_numero || d.tomador_bairro || d.tomador_uf);",
  "const erros = [];",
  "if (seg === 'corretora_seguros') {",
  "  if (strict) {",
  "    if (hasEndereco && munTom.length !== 7) {",
  "      erros.push('Modo corretora estrito: informe o código IBGE do município do tomador (7 dígitos) quando houver endereço.');",
  "    }",
  "    const doc = onlyDigits(d.cpf_cnpj);",
  "    if (perfil === 'seguradora' && doc.length !== 14) {",
  "      erros.push('Perfil \"seguradora\": tomador deve ser CNPJ (14 dígitos).');",
  "    }",
  "    if (perfil === 'segurado' && doc.length !== 11) {",
  "      erros.push('Perfil \"segurado\": esperado CPF do tomador (11 dígitos); confira com o contador.');",
  "    }",
  "  }",
  "}",
  "const ok = erros.length === 0;",
  "const lista = erros.map((e) => '* ' + e).join(String.fromCharCode(10));",
  "const msg = ok ? '' : ('Não consigo emitir ainda (política corretora):' + String.fromCharCode(10) + String.fromCharCode(10) + lista + String.fromCharCode(10) + String.fromCharCode(10) + 'Ajuste os dados ou fale com o escritório.');",
  "return [{ json: { ...d, codigo_nbs: codigo_nbs || d.codigo_nbs, corretora_gate_ok: ok, corretora_gate_erros: erros, mensagem_saida: msg } }];"
].join("\n");

data.nodes.push({
  parameters: { jsCode: gateCode },
  id: gateId,
  name: "Corretora | Gate fiscal",
  type: "n8n-nodes-base.code",
  typeVersion: 2,
  position: [-1680, 400]
});

data.nodes.push({
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 1 },
      conditions: [
        {
          id: "corretora-gate-ok",
          leftValue: "={{ $json.corretora_gate_ok === true }}",
          rightValue: "",
          operator: { type: "boolean", operation: "true", singleValue: true }
        }
      ],
      combinator: "and"
    },
    options: {}
  },
  id: gateIfId,
  name: "Corretora Gate OK?",
  type: "n8n-nodes-base.if",
  typeVersion: 2,
  position: [-1520, 400]
});

const gateWaCode = [
  'const origem = $items("Corretora | Gate fiscal", 0, 0)[0].json;',
  "const atual = $json || {};",
  'const chatId = String(atual.chat_id || origem.chat_id || "").trim();',
  'const number = chatId.replace("@s.whatsapp.net", "").replace("@c.us", "").replace(/\\D/g, "");',
  "if (!number) {",
  '  return [{ json: { erro_envio: true, motivo: "number_vazio", chatId, number, text: origem.mensagem_saida || "" } }];',
  "}",
  "return [{ json: { erro_envio: false, chatId, number, text: origem.mensagem_saida || \"Bloqueio fiscal.\", whatsapp_instance: origem.whatsapp_instance || atual.whatsapp_instance || \"teste\" } }];"
].join("\n");

data.nodes.push({
  parameters: { jsCode: gateWaCode },
  id: gateWaId,
  name: "Corretora | Preparar WhatsApp bloqueio",
  type: "n8n-nodes-base.code",
  typeVersion: 2,
  position: [-1360, 560]
});

const auditQuery = `UPDATE automacao.notas_fiscais
SET
  fiscal_audit_package = '{{ JSON.stringify({
    workflow: "v11",
    fiscal_resolved_mode: $json.fiscal_resolved_mode,
    fiscal_intended_mode: $json.fiscal_intended_mode,
    fiscal_fallback_applied: $json.fiscal_fallback_applied,
    fiscal_fallback_reason: $json.fiscal_fallback_reason,
    fiscal_audit_trail: $json.fiscal_audit_trail,
    payload_focus_resumo: $json.payload_focus_resumo
  }) }}'::jsonb,
  updated_at = NOW()
WHERE referencia_externa = '{{ $json.ref_nf }}';`;

data.nodes.push({
  parameters: { operation: "executeQuery", query: auditQuery, options: {} },
  id: updAuditId,
  name: "Corretora | Persistir trilha fiscal",
  type: "n8n-nodes-base.postgres",
  typeVersion: 2.6,
  position: [-1180, 240],
  credentials: {
    postgres: { id: "S7Jk5DK8dFZyxXXO", name: "Postgres account 2" }
  }
});

const reidratarCode =
  "const pre = $items('AJUSTE SÊNIOR | Pré-validar Payload Focus1', 0, 0)[0]?.json || {};\n" +
  "return [{ json: { ...pre, corretora_audit_persistido: true } }];";

data.nodes.push({
  parameters: { jsCode: reidratarCode },
  id: reidratId,
  name: "Corretora | Reidratar pós-audit",
  type: "n8n-nodes-base.code",
  typeVersion: 2,
  position: [-1000, 240]
});

/* ---------- Conexões ---------- */
const conn = data.connections || {};

conn["Completo Para Emitir?"] = {
  main: [
    [{ node: "Corretora | Gate fiscal", type: "main", index: 0 }],
    conn["Completo Para Emitir?"].main[1]
  ]
};

conn["Corretora | Gate fiscal"] = {
  main: [[{ node: "Corretora Gate OK?", type: "main", index: 0 }]]
};

conn["Corretora Gate OK?"] = {
  main: [
    [{ node: "Preparar Ref NF", type: "main", index: 0 }],
    [{ node: "Corretora | Preparar WhatsApp bloqueio", type: "main", index: 0 }]
  ]
};

conn["Corretora | Preparar WhatsApp bloqueio"] = {
  main: [[{ node: "Pode Enviar?", type: "main", index: 0 }]]
};

conn["AJUSTE SÊNIOR | Pré-validar Payload Focus1"] = {
  main: [[{ node: "Corretora | Persistir trilha fiscal", type: "main", index: 0 }]]
};

conn["Corretora | Persistir trilha fiscal"] = {
  main: [[{ node: "Corretora | Reidratar pós-audit", type: "main", index: 0 }]]
};

conn["Corretora | Reidratar pós-audit"] = {
  main: [[{ node: "Emitir NF Focus", type: "main", index: 0 }]]
};

data.connections = conn;

fs.writeFileSync(outPath, JSON.stringify(data, null, 2), "utf8");
console.log("Escrito:", outPath);
