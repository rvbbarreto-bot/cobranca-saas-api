const d = $json || {};
const policyRaw = String(d.descricao_competencia_check || "off")
  .trim()
  .toLowerCase();
const policy = ["off", "warn", "block"].includes(policyRaw) ? policyRaw : "off";

const MONTH_WORD_TO_NUM = {
  janeiro: 1,
  fevereiro: 2,
  "março": 3,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12
};
const MONTH_ALT = Object.keys(MONTH_WORD_TO_NUM).join("|");

function monthFromMatch(word) {
  return MONTH_WORD_TO_NUM[String(word || "").toLowerCase()] ?? null;
}

function parseCompetenceMonthYear(dataStr) {
  const s = String(dataStr ?? "").trim();
  if (!s) return null;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const parts = s.split("/").map(Number);
    const mm = parts[1];
    const yyyy = parts[2];
    if (!Number.isFinite(mm) || !Number.isFinite(yyyy) || mm < 1 || mm > 12) return null;
    return { month: mm, year: yyyy };
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const parts = s.split("-").map(Number);
    const y = parts[0];
    const m = parts[1];
    if (!Number.isFinite(m) || !Number.isFinite(y) || m < 1 || m > 12) return null;
    return { month: m, year: y };
  }
  return null;
}

function analyze(desc, dataComp) {
  const reasons = [];
  const comp = parseCompetenceMonthYear(dataComp);
  if (!comp) return { conflict: false, reasons: [], competence: null };
  const text = String(desc ?? "");

  const RE_EM_MES = new RegExp(
    "\\bem\\s+(" + MONTH_ALT + ")(?:\\s+de\\s*)?(20\\d{2})?",
    "gi"
  );
  const RE_MES_ANO = new RegExp("\\b(" + MONTH_ALT + ")\\s*/\\s*(20\\d{2})\\b", "gi");

  let m;
  while ((m = RE_EM_MES.exec(text)) !== null) {
    const mon = monthFromMatch(m[1]);
    const yr = m[2] ? Number(m[2]) : null;
    if (mon != null && mon !== comp.month) {
      reasons.push(
        'Texto cita "em ' +
          m[1] +
          '" e a competência é ' +
          String(comp.month).padStart(2, "0") +
          "/" +
          comp.year +
          "."
      );
    }
    if (yr != null && Number.isFinite(yr) && yr !== comp.year) {
      reasons.push("Texto cita ano " + yr + " e a competência é " + comp.year + ".");
    }
  }
  while ((m = RE_MES_ANO.exec(text)) !== null) {
    const mon = monthFromMatch(m[1]);
    const yr = Number(m[2]);
    if (mon != null && mon !== comp.month) {
      reasons.push(
        'Texto cita "' +
          m[1] +
          "/" +
          m[2] +
          '" e a competência é ' +
          String(comp.month).padStart(2, "0") +
          "/" +
          comp.year +
          "."
      );
    }
    if (Number.isFinite(yr) && yr !== comp.year) {
      reasons.push(
        "Texto cita ano " + yr + " em mês/ano e a competência é " + comp.year + "."
      );
    }
  }
  const uniq = [...new Set(reasons)];
  return { conflict: uniq.length > 0, reasons: uniq, competence: comp };
}

const desc = d.descricao || "";
const dataComp = d.data || "";
const r = analyze(desc, dataComp);
const competenceLabel = r.competence
  ? String(r.competence.month).padStart(2, "0") + "/" + r.competence.year
  : "";

const base = { ...d, descricao_competencia_check_effective: policy };

if (policy === "off") {
  return [
    {
      json: {
        ...base,
        descricao_competencia_bloqueio: false,
        descricao_competencia_aviso: "",
        descricao_competencia_reasons: []
      }
    }
  ];
}

if (!r.conflict) {
  return [
    {
      json: {
        ...base,
        descricao_competencia_bloqueio: false,
        descricao_competencia_aviso: "",
        descricao_competencia_reasons: []
      }
    }
  ];
}

if (policy === "warn") {
  const aviso = "Aviso (descrição x competência): " + r.reasons.join(" ");
  return [
    {
      json: {
        ...base,
        descricao_competencia_bloqueio: false,
        descricao_competencia_aviso: aviso,
        descricao_competencia_reasons: r.reasons,
        descricao_competencia_competencia_label: competenceLabel
      }
    }
  ];
}

const msg =
  "Não emiti a nota: o texto do serviço parece referir outro período que não a competência " +
  (competenceLabel || "(data inválida)") +
  ". Ajuste a descrição ou a data de competência e confirme de novo. Detalhes: " +
  r.reasons.join(" ");

return [
  {
    json: {
      ...base,
      descricao_competencia_bloqueio: true,
      descricao_competencia_aviso: "",
      descricao_competencia_reasons: r.reasons,
      mensagem_saida: msg
    }
  }
];
