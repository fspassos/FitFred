"use strict";
/* FitFred — registro de corpo: peso (3–4x/semana, vale a média semanal), cintura (a cada 2 semanas,
   2 leituras), braço e coxa direito/esquerdo (a cada 4 semanas). */

const MEDIDAS = {
  peso:    { rotulo: "Peso",          un: "kg", passo: 0.1 },
  cintura: { rotulo: "Cintura",       un: "cm", passo: 0.5, dias: 14 },
  braco_d: { rotulo: "Braço direito",  un: "cm", passo: 0.5, dias: 28 },
  braco_e: { rotulo: "Braço esquerdo", un: "cm", passo: 0.5, dias: 28 },
  coxa_d:  { rotulo: "Coxa direita",   un: "cm", passo: 0.5, dias: 28 },
  coxa_e:  { rotulo: "Coxa esquerda",  un: "cm", passo: 0.5, dias: 28 },
};
const MEMBROS = ["braco_d", "braco_e", "coxa_d", "coxa_e"];
const fmt1 = (v) => (Math.round(v * 10) / 10).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function registrosDe(tipo) {
  return (db.corpo || []).filter((r) => r.tipo === tipo).sort((a, b) => a.data.localeCompare(b.data) || a.ts - b.ts);
}
function ultimaMedida(tipo) { const l = registrosDe(tipo); return l[l.length - 1] || null; }

function registrarMedida(tipo, valor, leituras) {
  const data = hojeISO();
  db.corpo = (db.corpo || []).filter((r) => !(r.tipo === tipo && r.data === data)); // um por dia: o novo substitui
  const reg = { id: `m-${tipo}-${data}`, data, ts: Date.now(), tipo, valor: Math.round(valor * 100) / 100 };
  if (leituras) reg.leituras = leituras;
  db.corpo.push(reg);
}

/* Semana = segunda a domingo */
function chaveSemana(iso) { const d = paraData(iso); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return isoDe(d); }
function mediasSemanais(tipo = "peso") {
  const grupos = {};
  registrosDe(tipo).forEach((r) => { const k = chaveSemana(r.data); (grupos[k] = grupos[k] || []).push(r.valor); });
  return Object.keys(grupos).sort().map((k) => ({ semana: k, media: grupos[k].reduce((a, b) => a + b, 0) / grupos[k].length, n: grupos[k].length }));
}

function situacao(tipo) {
  const ult = ultimaMedida(tipo);
  const dias = MEDIDAS[tipo].dias;
  if (!ult) return { devido: true, texto: "Faça a primeira medida" };
  const prox = paraData(ult.data); prox.setDate(prox.getDate() + dias);
  const falta = Math.round((prox - paraData(hojeISO())) / 86400000);
  if (falta <= 0) return { devido: true, texto: falta === 0 ? "Dia de medir: hoje" : `Atrasada ${-falta} dia(s)` };
  return { devido: false, texto: `Próxima em ${falta} dia(s) · ${dataCurta(isoDe(prox))}` };
}

/* Valores digitados antes de registrar (não salvos até tocar no botão) */
function formCorpo() {
  if (!ui.corpoForm) {
    const v = (t) => { const u = ultimaMedida(t); return u ? u.valor : null; };
    ui.corpoForm = { peso: v("peso"), c1: v("cintura"), c2: v("cintura") };
    MEMBROS.forEach((t) => (ui.corpoForm[t] = v(t)));
  }
  return ui.corpoForm;
}

function campoCorpo(campo, valor, rotulo, passo) {
  const v = valor == null ? "" : fmt1(valor);
  return `<div class="passo">
    <button data-acao="corpo-ajusta" data-campo="${campo}" data-d="-${passo}" aria-label="menos ${rotulo}">−</button>
    <input value="${v}" placeholder="—" inputmode="decimal" enterkeyhint="done" autocomplete="off" data-corpo="${campo}" aria-label="${rotulo}">
    <button data-acao="corpo-ajusta" data-campo="${campo}" data-d="${passo}" aria-label="mais ${rotulo}">+</button>
  </div>`;
}

function telaCorpo() {
  const f = formCorpo();
  const semanas = mediasSemanais("peso");
  const estaSemana = chaveSemana(hojeISO());
  const atual = semanas.find((s) => s.semana === estaSemana);
  const anterior = [...semanas].reverse().find((s) => s.semana < estaSemana);
  const pesoHoje = registrosDe("peso").find((r) => r.data === hojeISO());
  const difSem = atual && anterior ? atual.media - anterior.media : null;

  const cint = ultimaMedida("cintura");
  const sitC = situacao("cintura");
  const mediaC = f.c1 != null && f.c2 != null ? (f.c1 + f.c2) / 2 : null;

  const sitM = situacao("braco_d");
  const ultM = Object.fromEntries(MEMBROS.map((t) => [t, ultimaMedida(t)]));
  const difs = (a, b) => (ultM[a] && ultM[b] ? `${ultM[a].valor - ultM[b].valor >= 0 ? "+" : "−"}${fmt1(Math.abs(ultM[a].valor - ultM[b].valor))} cm` : "—");

  const recentes = [...(db.corpo || [])].sort((a, b) => b.data.localeCompare(a.data) || b.ts - a.ts).slice(0, 12);

  return `
    <h1>Corpo</h1>
    <p class="sub" style="margin:0 0 16px">Registre aqui; os gráficos ficam em Evolução.</p>

    <div class="cartao">
      <div class="topo-linha"><h2>Peso</h2><span class="sub num">${atual ? atual.n : 0} de 3–4 na semana</span></div>
      <p class="dica">De manhã, em jejum, depois do banheiro, sem roupa. O que conta é a <b>média da semana</b>.</p>
      <div class="linha-campo"><span>Hoje (kg)</span>${campoCorpo("peso", f.peso, "peso", 0.1)}</div>
      <button class="btn" style="width:100%;margin-top:10px" data-acao="registrar-peso">${pesoHoje ? `Atualizar peso de hoje (${fmt1(pesoHoje.valor)})` : "Registrar peso de hoje"}</button>
      <div class="resumo-medida">
        <div><span class="sub">Média desta semana</span><b class="num">${atual ? `${fmt1(atual.media)} kg` : "—"}</b></div>
        <div><span class="sub">vs. semana anterior</span><b class="num">${difSem == null ? "—" : `${difSem >= 0 ? "+" : "−"}${fmt1(Math.abs(difSem))} kg`}</b></div>
      </div>
    </div>

    <div class="cartao">
      <div class="topo-linha"><h2>Cintura</h2><span class="sub ${sitC.devido ? "devido" : ""}">${sitC.texto}</span></div>
      <p class="dica">A cada 2 semanas. Entre a última costela e o osso do quadril, em jejum, no fim de uma expiração normal, sem encolher a barriga. Meça 2 vezes.</p>
      <div class="linha-campo"><span>1ª medida (cm)</span>${campoCorpo("c1", f.c1, "primeira medida da cintura", 0.5)}</div>
      <div class="linha-campo"><span>2ª medida (cm)</span>${campoCorpo("c2", f.c2, "segunda medida da cintura", 0.5)}</div>
      <button class="btn${sitC.devido ? "" : "-sec"}" style="width:100%;margin-top:10px" data-acao="registrar-cintura">Registrar cintura${mediaC != null ? ` (média ${fmt1(mediaC)} cm)` : ""}</button>
      <div class="resumo-medida"><div><span class="sub">Última</span><b class="num">${cint ? `${fmt1(cint.valor)} cm · ${dataCurta(cint.data)}` : "—"}</b></div></div>
    </div>

    <div class="cartao">
      <div class="topo-linha"><h2>Braço e coxa</h2><span class="sub ${sitM.devido ? "devido" : ""}">${sitM.texto}</span></div>
      <p class="dica">A cada 4 semanas, direito e esquerdo. Braço no ponto mais largo, relaxado. Coxa a um palmo acima do joelho. É o que mostra a simetria.</p>
      <div class="grade-membros">
        <div><span class="sub">Braço D</span>${campoCorpo("braco_d", f.braco_d, "braço direito", 0.5)}</div>
        <div><span class="sub">Braço E</span>${campoCorpo("braco_e", f.braco_e, "braço esquerdo", 0.5)}</div>
        <div><span class="sub">Coxa D</span>${campoCorpo("coxa_d", f.coxa_d, "coxa direita", 0.5)}</div>
        <div><span class="sub">Coxa E</span>${campoCorpo("coxa_e", f.coxa_e, "coxa esquerda", 0.5)}</div>
      </div>
      <button class="btn${sitM.devido ? "" : "-sec"}" style="width:100%;margin-top:10px" data-acao="registrar-membros">Registrar braço e coxa</button>
      <div class="resumo-medida">
        <div><span class="sub">Braço D − E</span><b class="num">${difs("braco_d", "braco_e")}</b></div>
        <div><span class="sub">Coxa D − E</span><b class="num">${difs("coxa_d", "coxa_e")}</b></div>
      </div>
    </div>

    <h3>Últimos registros</h3>
    ${recentes.length ? `<div class="cartao lista-registros">${recentes.map((r) => `
      <div class="registro"><span>${dataComDia(r.data)} · ${MEDIDAS[r.tipo] ? MEDIDAS[r.tipo].rotulo : esc(r.tipo)}</span>
        <span class="num"><b>${fmt1(r.valor)} ${MEDIDAS[r.tipo] ? MEDIDAS[r.tipo].un : ""}</b>
        <button class="chip-mini" data-acao="apagar-medida" data-id="${esc(r.id)}" aria-label="Apagar">✕</button></span></div>`).join("")}</div>`
      : '<div class="vazio-msg" style="padding:24px">Nada registrado ainda.</div>'}`;
}

async function acaoCorpo(acao, d) {
  const f = formCorpo();
  if (acao === "corpo-ajusta") {
    const base = f[d.campo] != null ? f[d.campo] : (d.campo === "peso" ? 65 : MEMBROS.includes(d.campo) ? 30 : 75);
    f[d.campo] = Math.max(0, Math.round((base + +d.d) * 100) / 100);
    render(); return true;
  }
  if (acao === "registrar-peso") {
    if (!(f.peso > 20 && f.peso < 300)) { aviso("Digite o peso em kg."); return true; }
    registrarMedida("peso", f.peso); salvar(); render(); aviso(`Peso registrado: ${fmt1(f.peso)} kg`); return true;
  }
  if (acao === "registrar-cintura") {
    if (!(f.c1 > 30 && f.c2 > 30)) { aviso("Preencha as duas medidas da cintura."); return true; }
    const dif = Math.abs(f.c1 - f.c2);
    if (dif > 1 && !(await confirmar("Medidas diferentes", `As duas medidas diferem ${fmt1(dif)} cm. O ideal é medir de novo. Registrar mesmo assim?`, "Registrar"))) return true;
    registrarMedida("cintura", (f.c1 + f.c2) / 2, [f.c1, f.c2]); salvar(); render(); aviso(`Cintura registrada: ${fmt1((f.c1 + f.c2) / 2)} cm`); return true;
  }
  if (acao === "registrar-membros") {
    const prontos = MEMBROS.filter((t) => f[t] > 5);
    if (!prontos.length) { aviso("Preencha as medidas de braço e coxa."); return true; }
    if (prontos.length < 4 && !(await confirmar("Faltam medidas", `Só ${prontos.length} de 4 preenchidas. Registrar só essas?`, "Registrar"))) return true;
    prontos.forEach((t) => registrarMedida(t, f[t])); salvar(); render(); aviso("Medidas registradas."); return true;
  }
  if (acao === "apagar-medida") {
    if (await confirmar("Apagar registro?", "Não dá para desfazer.", "Apagar")) { db.corpo = db.corpo.filter((r) => r.id !== d.id); salvar(); render(); }
    return true;
  }
  return false;
}

function csvCorpo() {
  const linhas = [["data", "medida", "valor", "unidade", "leitura1", "leitura2"]];
  [...(db.corpo || [])].sort((a, b) => a.data.localeCompare(b.data)).forEach((r) => {
    const m = MEDIDAS[r.tipo] || { un: "" };
    const n = (v) => (v == null ? "" : String(v).replace(".", ","));
    linhas.push([r.data, r.tipo, n(r.valor), m.un, n(r.leituras && r.leituras[0]), n(r.leituras && r.leituras[1])]);
  });
  return "﻿" + linhas.map((l) => l.join(";")).join("\r\n");
}

/* Lembrete discreto na tela Hoje (peso fica fora: a hora certa é de manhã, não na academia) */
function lembreteCorpo() {
  const itens = [];
  if (situacao("cintura").devido) itens.push("cintura");
  if (situacao("braco_d").devido) itens.push("braço e coxa");
  if (!itens.length) return "";
  return `<button class="cartao lembrete" data-aba="corpo"><span>📏 Dia de medir: <b>${itens.join(" e ")}</b></span><span class="sub">abrir ›</span></button>`;
}
