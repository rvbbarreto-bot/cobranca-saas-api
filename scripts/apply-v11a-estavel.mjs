/**
 * Gera workflows/Emissor_NF_V11A_Estavel.json a partir de Emissor_NF_V11_Corretora_Seguros.json
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const srcWf = path.join(root, "workflows", "Emissor_NF_V11_Corretora_Seguros.json");
const gateSnippet = path.join(root, "workflows", "snippets", "v11a-gate-deterministic.js");
const outWf = path.join(root, "workflows", "Emissor_NF_V11A_Estavel.json");

const gateJs = fs.readFileSync(gateSnippet, "utf8").replace(/\r\n/g, "\n");
const data = JSON.parse(fs.readFileSync(srcWf, "utf8"));

data.name = "Emissor NF - V11A Estável (gate + auditoria)";
data.meta = {
  ...(data.meta || {}),
  workflow_revision: "v11a-estavel",
  workflow_revision_note:
    "V11A: gate pós-ref, bloqueio sem HTTP Focus, fiscal_audit_log (006), payload envio/resposta, segmentos generico|corretora_seguros|servico_ti."
};

const renameMap = {
  "Corretora | Gate fiscal": "V11A | Gate fiscal determinístico",
  "Corretora Gate OK?": "V11A Gate OK?",
  "Corretora | Preparar WhatsApp bloqueio": "V11A | Preparar WhatsApp bloqueio"
};

function renameConnectionKeys(conn) {
  const out = {};
  for (const [k, v] of Object.entries(conn)) {
    out[renameMap[k] || k] = v;
  }
  return out;
}

function patchTargets(conn) {
  if (!conn?.main) return;
  for (const branch of conn.main) {
    for (const item of branch) {
      if (item?.node && renameMap[item.node]) item.node = renameMap[item.node];
    }
  }
}

data.connections = renameConnectionKeys(data.connections);
for (const v of Object.values(data.connections)) {
  patchTargets(v);
}

for (const node of data.nodes) {
  if (renameMap[node.name]) {
    node.name = renameMap[node.name];
  }
  if (node.name === "V11A | Gate fiscal determinístico") {
    node.parameters = { ...node.parameters, jsCode: gateJs };
  }
  if (node.name === "V11A Gate OK?" && node.parameters?.conditions?.conditions?.[0]) {
    node.parameters.conditions.conditions[0].leftValue = "={{ $json.v11a_gate_ok === true }}";
  }
  if (node.name === "V11A | Preparar WhatsApp bloqueio" && node.parameters?.jsCode) {
    node.parameters.jsCode = node.parameters.jsCode.replace(
      "Corretora | Gate fiscal",
      "V11A | Gate fiscal determinístico"
    );
  }
}

/* Ordem emissão: Completo → Preparar Ref → Gate */
data.connections["Completo Para Emitir?"] = {
  main: [
    [{ node: "Preparar Ref NF", type: "main", index: 0 }],
    data.connections["Completo Para Emitir?"]?.main?.[1] || []
  ]
};

data.connections["Preparar Ref NF"] = {
  main: [[{ node: "V11A | Gate fiscal determinístico", type: "main", index: 0 }]]
};

data.connections["V11A | Gate fiscal determinístico"] = {
  main: [[{ node: "V11A Gate OK?", type: "main", index: 0 }]]
};

const pgCred = { postgres: { id: "S7Jk5DK8dFZyxXXO", name: "Postgres account 2" } };

const idAuditOk = "f1a11001-0000-4000-8000-000000000001";
const idAuditBlock = "f1a11002-0000-4000-8000-000000000002";
const idEscPayload = "f1a11003-0000-4000-8000-000000000003";
const idUpdPayload = "f1a11004-0000-4000-8000-000000000004";
const idPrepResp = "f1a11005-0000-4000-8000-000000000005";
const idUpdResp = "f1a11006-0000-4000-8000-000000000006";
const idPrepErr = "f1a11007-0000-4000-8000-000000000007";
const idUpdErr = "f1a11008-0000-4000-8000-000000000008";

const qAuditOk = `INSERT INTO automacao.fiscal_audit_log (tenant_id, tenant_segment, ref_nf, status, motivo_bloqueio, payload_envio, payload_resposta)
VALUES (
  '{{ $json.tenant_id }}',
  '{{ $json.tenant_segment_resolvido }}',
  '{{ $json.ref_nf }}',
  'gate_aprovado',
  NULL,
  NULL,
  NULL
)
ON CONFLICT (ref_nf) DO UPDATE SET
  status = EXCLUDED.status,
  tenant_segment = EXCLUDED.tenant_segment,
  updated_at = NOW();`;

const qAuditBlock = `INSERT INTO automacao.fiscal_audit_log (tenant_id, tenant_segment, ref_nf, status, motivo_bloqueio, payload_envio, payload_resposta)
VALUES (
  '{{ $json.tenant_id }}',
  '{{ $json.tenant_segment_resolvido }}',
  '{{ $json.ref_nf }}',
  'bloqueado_gate',
  '{{ $json.v11a_motivo_sql_safe }}',
  NULL,
  NULL
)
ON CONFLICT (ref_nf) DO UPDATE SET
  status = EXCLUDED.status,
  motivo_bloqueio = EXCLUDED.motivo_bloqueio,
  tenant_segment = EXCLUDED.tenant_segment,
  updated_at = NOW();`;

const jsEscPayload =
  "const j = $json || {};\n" +
  "let esc = '{}';\n" +
  "try {\n" +
  "  esc = JSON.stringify(j.payload_focus ?? {}).replace(/'/g, \"''\");\n" +
  "} catch (e) {\n" +
  "  esc = '{}';\n" +
  "}\n" +
  "return [{ json: { ...j, v11a_esc_payload_focus: esc } }];";

const qUpdPayload = `UPDATE automacao.fiscal_audit_log
SET
  payload_envio = '{{ $json.v11a_esc_payload_focus }}'::jsonb,
  status = 'payload_registrado',
  updated_at = NOW()
WHERE ref_nf = '{{ $json.ref_nf }}';`;

const jsPrepResp =
  "const db = $json || {};\n" +
  "const tr = $items('Tratar Retorno NF', 0, 0)?.[0]?.json || {};\n" +
  "const merged = { ...tr, ...db };\n" +
  "let esc = '{}';\n" +
  "try {\n" +
  "  esc = JSON.stringify(merged.retorno_nf ?? merged).replace(/'/g, \"''\");\n" +
  "} catch (e) {\n" +
  "  esc = '{}';\n" +
  "}\n" +
  "const err = String(merged.nf_erro_mensagem || '').trim();\n" +
  "const st = String(merged.nf_status || merged.status || '').toLowerCase();\n" +
  "let fs = 'emitido_processando';\n" +
  "if (err || st.includes('rejeit') || st.includes('erro')) fs = 'emitido_erro';\n" +
  "else if (st.includes('autoriz') || st.includes('emitid') || st.includes('processad')) fs = 'emitido_sucesso';\n" +
  "const fss = fs.replace(/'/g, \"''\");\n" +
  "return [{ json: { ...merged, v11a_esc_resposta: esc, v11a_audit_final_status_sql: fss } }];";

const qUpdResp = `UPDATE automacao.fiscal_audit_log
SET
  payload_resposta = '{{ $json.v11a_esc_resposta }}'::jsonb,
  status = '{{ $json.v11a_audit_final_status_sql }}',
  updated_at = NOW()
WHERE ref_nf = '{{ $json.ref_nf }}';`;

const jsPrepErr =
  "const d = $json || {};\n" +
  "let esc = '{}';\n" +
  "try {\n" +
  "  esc = JSON.stringify(d.retorno_nf ?? d).replace(/'/g, \"''\");\n" +
  "} catch (e) {\n" +
  "  esc = '{}';\n" +
  "}\n" +
  "return [{ json: { ...d, v11a_esc_resposta: esc } }];";

const qUpdErr = `UPDATE automacao.fiscal_audit_log
SET
  payload_resposta = '{{ $json.v11a_esc_resposta }}'::jsonb,
  status = 'emitido_erro',
  updated_at = NOW()
WHERE ref_nf = '{{ $json.ref_nf }}';`;

data.nodes.push(
  {
    parameters: { operation: "executeQuery", query: qAuditOk, options: {} },
    id: idAuditOk,
    name: "V11A | Audit INSERT gate ok",
    type: "n8n-nodes-base.postgres",
    typeVersion: 2.6,
    position: [-1488, 400],
    credentials: pgCred
  },
  {
    parameters: { operation: "executeQuery", query: qAuditBlock, options: {} },
    id: idAuditBlock,
    name: "V11A | Audit INSERT bloqueio",
    type: "n8n-nodes-base.postgres",
    typeVersion: 2.6,
    position: [-1488, 560],
    credentials: pgCred
  },
  {
    parameters: { jsCode: jsEscPayload },
    id: idEscPayload,
    name: "V11A | Escape payload_focus audit",
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: [-1152, 200]
  },
  {
    parameters: { operation: "executeQuery", query: qUpdPayload, options: {} },
    id: idUpdPayload,
    name: "V11A | Audit UPDATE payload envio",
    type: "n8n-nodes-base.postgres",
    typeVersion: 2.6,
    position: [-960, 200],
    credentials: pgCred
  },
  {
    parameters: { jsCode: jsPrepResp },
    id: idPrepResp,
    name: "V11A | Preparar audit resposta",
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: [-400, 240]
  },
  {
    parameters: { operation: "executeQuery", query: qUpdResp, options: {} },
    id: idUpdResp,
    name: "V11A | Audit UPDATE resposta Focus",
    type: "n8n-nodes-base.postgres",
    typeVersion: 2.6,
    position: [-208, 240],
    credentials: pgCred
  },
  {
    parameters: { jsCode: jsPrepErr },
    id: idPrepErr,
    name: "V11A | Preparar audit erro",
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: [400, 200]
  },
  {
    parameters: { operation: "executeQuery", query: qUpdErr, options: {} },
    id: idUpdErr,
    name: "V11A | Audit UPDATE erro emissao",
    type: "n8n-nodes-base.postgres",
    typeVersion: 2.6,
    position: [592, 200],
    credentials: pgCred
  }
);

data.connections["V11A Gate OK?"] = {
  main: [
    [{ node: "V11A | Audit INSERT gate ok", type: "main", index: 0 }],
    [{ node: "V11A | Audit INSERT bloqueio", type: "main", index: 0 }]
  ]
};

data.connections["V11A | Audit INSERT gate ok"] = {
  main: [[{ node: "Salvar Solicitacao NF", type: "main", index: 0 }]]
};

data.connections["V11A | Audit INSERT bloqueio"] = {
  main: [[{ node: "V11A | Preparar WhatsApp bloqueio", type: "main", index: 0 }]]
};

const prevPre = data.connections["AJUSTE SÊNIOR | Pré-validar Payload Focus1"];
data.connections["AJUSTE SÊNIOR | Pré-validar Payload Focus1"] = {
  main: [[{ node: "V11A | Escape payload_focus audit", type: "main", index: 0 }]]
};
data.connections["V11A | Escape payload_focus audit"] = {
  main: [[{ node: "V11A | Audit UPDATE payload envio", type: "main", index: 0 }]]
};
data.connections["V11A | Audit UPDATE payload envio"] = {
  main: prevPre?.main || [[{ node: "Corretora | Persistir trilha fiscal", type: "main", index: 0 }]]
};

const cls = data.connections["AJUSTE SÊNIOR | Classificar Erro Emissão"];
if (cls?.main?.[0]?.[0]?.node) {
  const next = cls.main[0][0].node;
  cls.main[0] = [{ node: "V11A | Preparar audit erro", type: "main", index: 0 }];
  data.connections["V11A | Preparar audit erro"] = {
    main: [[{ node: "V11A | Audit UPDATE erro emissao", type: "main", index: 0 }]]
  };
  data.connections["V11A | Audit UPDATE erro emissao"] = {
    main: [[{ node: next, type: "main", index: 0 }]]
  };
}

const atr = data.connections["Atualizar Retorno NF"];
if (atr?.main?.[0]?.[0]?.node) {
  const nextAtr = atr.main[0][0].node;
  atr.main[0] = [{ node: "V11A | Preparar audit resposta", type: "main", index: 0 }];
  data.connections["V11A | Preparar audit resposta"] = {
    main: [[{ node: "V11A | Audit UPDATE resposta Focus", type: "main", index: 0 }]]
  };
  data.connections["V11A | Audit UPDATE resposta Focus"] = {
    main: [[{ node: nextAtr, type: "main", index: 0 }]]
  };
}

fs.writeFileSync(outWf, JSON.stringify(data, null, 2), "utf8");
console.log("OK:", outWf);
