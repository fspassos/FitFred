"use strict";
/* FitFred — registro de treino no iPhone. A ficha vem do treino.txt; os dados ficam só neste aparelho. */

const VERSAO_APP = "0.3";
const CHAVE = "fitfred.v1";
const CHAVE_FICHA = "fitfred.ficha";
const AJ_EX = window.EXERCICIOS || {};
const $ = (s) => document.querySelector(s);

/* ───────────── Persistência ───────────── */
function novoDb() {
  return { versao: 1, sessoes: [], corpo: [], ativa: null, ajustes: { metaSemanal: 4, sessoesAntes: 0 }, ultimoBackup: null };
}
function carregar() {
  try {
    const raw = localStorage.getItem(CHAVE);
    if (!raw) return novoDb();
    const d = JSON.parse(raw);
    const base = novoDb();
    return { ...base, ...d, corpo: d.corpo || [], ajustes: { ...base.ajustes, ...(d.ajustes || {}) } };
  } catch (e) {
    return novoDb();
  }
}
let db = carregar();
let avisouFalha = false;
function salvar() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(db));
  } catch (e) {
    if (!avisouFalha) { avisouFalha = true; aviso("Não consegui salvar neste aparelho. Exporte um backup em Ajustes."); }
  }
}
try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {}

/* ───────────── Ficha (treino.txt) ───────────── */
let FICHA = null;
let LETRAS = [];

function hash(txt) { let h = 5381; for (let i = 0; i < txt.length; i++) h = ((h << 5) + h + txt.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }

function lerFicha(txt) {
  const f = { treinos: {}, reps: [], descanso: [], sessoes: [], nome: null };
  let sec = "";
  for (let l of txt.replace(/^﻿/, "").split(/\r?\n/)) {
    l = l.trim();
    if (!l || l.startsWith("//")) continue;
    if (l.startsWith("#")) { sec = l.toUpperCase(); continue; }
    if (sec.startsWith("#TREINO_")) {
      const k = sec.slice(8);
      (f.treinos[k] = f.treinos[k] || []).push(l.split("+").map((s) => s.trim()).filter(Boolean));
    } else if (sec === "#REPETICOES") f.reps.push(l);
    else if (sec === "#DESCANSO") f.descanso.push(parseInt(l, 10));
    else if (sec === "#SESSOES") f.sessoes.push(parseInt(l, 10));
    else if (sec === "#NOME") f.nome = l;
  }
  if (!Object.keys(f.treinos).length) throw new Error("treino.txt sem #TREINO_");
  f.fases = f.reps.map((r, i) => {
    const m = /^(\d+)\s*x\s*(\d+)(?:\s*-\s*(\d+))?/i.exec(r) || [];
    const series = +m[1] || 3, a = +m[2] || 10, b = +(m[3] || m[2]) || 10;
    return { n: i + 1, series, faixa: [a, b], descanso: f.descanso[i] || 60, sessoes: f.sessoes[i] || 0, texto: r };
  });
  if (!f.fases.length) f.fases = [{ n: 1, series: 3, faixa: [8, 12], descanso: 60, sessoes: 0, texto: "3x8-12" }];
  // A ficha "muda" quando a lista de exercícios muda: aí a rotação e as fases recomeçam.
  f.id = hash(JSON.stringify(f.treinos));
  f.nome = f.nome || `Ficha ${Object.keys(f.treinos).join("")} ${f.id.slice(0, 4)}`;
  return f;
}

async function carregarFicha() {
  try {
    const r = await fetch("treino.txt", { cache: "no-cache" });
    if (!r.ok) throw new Error(r.status);
    const txt = await r.text();
    const f = lerFicha(txt);
    try { localStorage.setItem(CHAVE_FICHA, txt); } catch (e) {}
    return f;
  } catch (e) {
    try { const txt = localStorage.getItem(CHAVE_FICHA); if (txt) return lerFicha(txt); } catch (e2) {}
    return null;
  }
}

function faseAtual() {
  const feitas = db.sessoes.filter((s) => s.fichaId === FICHA.id).length + (db.ajustes.sessoesAntes || 0);
  let acum = 0;
  for (const f of FICHA.fases) {
    if (!f.sessoes || feitas < acum + f.sessoes) return { ...f, sessao: feitas - acum + 1, total: FICHA.fases.length, feitas };
    acum += f.sessoes;
  }
  const ult = FICHA.fases[FICHA.fases.length - 1];
  return { ...ult, sessao: feitas - (acum - ult.sessoes) + 1, total: FICHA.fases.length, feitas, alemDoPlano: true };
}
const txtFase = (f) => `${f.series}×${f.faixa[0] === f.faixa[1] ? f.faixa[0] : f.faixa.join("–")} · descanso ${f.descanso} s`;

/* ───────────── Datas e formatação ───────────── */
const p2 = (n) => String(n).padStart(2, "0");
const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
function isoDe(d) { return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; }
const hojeISO = () => isoDe(new Date());
function paraData(iso) { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); }
function dataCurta(iso) { const [, m, d] = iso.split("-"); return `${d}/${m}`; }
function dataComDia(iso) {
  const dt = paraData(iso);
  const ano = dt.getFullYear() !== new Date().getFullYear() ? `/${dt.getFullYear()}` : "";
  return `${DIAS[dt.getDay()]} ${p2(dt.getDate())}/${p2(dt.getMonth() + 1)}${ano}`;
}
function diasDesde(iso) { const h = new Date(); h.setHours(0, 0, 0, 0); return Math.round((h - paraData(iso)) / 86400000); }
function haQuanto(iso) { const n = diasDesde(iso); return n <= 0 ? "hoje" : n === 1 ? "ontem" : `há ${n} dias`; }
function inicioDaSemana() { const h = new Date(); h.setHours(0, 0, 0, 0); h.setDate(h.getDate() - ((h.getDay() + 6) % 7)); return h; }
const fmtKg = (v) => (Math.round(v * 100) / 100).toLocaleString("pt-BR");
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const tipoDe = (nome) => (AJ_EX[nome] && AJ_EX[nome].tipo) || "carga";

function fmtSeries(tipo, series) {
  if (!series.length) return "—";
  const reps = series.map((s) => (s.reps == null ? "?" : s.reps));
  if (tipo === "tempo") return reps.map((r) => `${r} s`).join(", ");
  const cargas = [...new Set(series.map((s) => s.carga))];
  const temReps = series.some((s) => s.reps != null);
  if (cargas.length === 1) return `${fmtKg(cargas[0])} kg` + (temReps ? ` × ${reps.join(", ")}` : "");
  return series.map((s, i) => `${fmtKg(s.carga)}×${reps[i]}`).join(", ") + " kg";
}

/* ───────────── Histórico ───────────── */
function ordenadas() {
  const chave = (s) => s.data + "|" + String(s.fim || s.inicio || 0).padStart(15, "0");
  return [...db.sessoes].sort((a, b) => chave(b).localeCompare(chave(a)));
}
function ultimoRegistro(nome) {
  for (const s of ordenadas()) {
    const ex = s.exercicios.find((e) => e.nome === nome);
    if (ex && ex.series.length) return { sessao: s, ex };
  }
  return null;
}
function proximoTreino() {
  const ult = ordenadas().find((s) => s.fichaId === FICHA.id);
  if (!ult) return LETRAS[0];
  return LETRAS[(LETRAS.indexOf(ult.treino) + 1) % LETRAS.length];
}
function ultimoDoTreino(letra) { return ordenadas().find((s) => s.fichaId === FICHA.id && s.treino === letra) || null; }
function treinosNaSemana() { const ini = inicioDaSemana(); return db.sessoes.filter((s) => paraData(s.data) >= ini).length; }

/* ───────────── Sessão ativa ───────────── */
function montarExercicio(nome, fase) {
  const aj = AJ_EX[nome] || {};
  const tipo = aj.tipo || "carga";
  const passo = aj.passo || 1;
  const faixa = aj.faixa || fase.faixa;
  const ult = ultimoRegistro(nome);
  const base = ult ? ult.ex.series : [];
  const subir = !!(ult && ult.ex.up);
  const maxCarga = base.length ? Math.max(...base.map((s) => s.carga || 0)) : 0;
  const maxReps = base.length ? Math.max(...base.map((s) => s.reps || 0)) : 0;
  const series = [];
  for (let i = 0; i < fase.series; i++) {
    const ref = base[i] || base[base.length - 1] || null;
    let carga = ref ? ref.carga || 0 : 0;
    // Reps: repete a última vez se estiver dentro da faixa da fase atual; senão, começa no mínimo da faixa
    let reps = ref && ref.reps != null && ref.reps >= faixa[0] && ref.reps <= faixa[1] ? ref.reps : faixa[0];
    if (subir && tipo === "carga") { carga = maxCarga + passo; reps = faixa[0]; }
    if (subir && tipo === "tempo") reps = (maxReps || faixa[0]) + passo;
    series.push({ carga, reps, feito: false });
  }
  return {
    nome, tipo, passo, faixa, up: false, upAuto: false, upMexido: false, subiu: subir,
    ultimo: ult ? { data: ult.sessao.data, resumo: fmtSeries(tipo, ult.ex.series) } : null,
    series,
  };
}

function iniciarSessao(letra) {
  const f = faseAtual();
  const fase = { n: f.n, total: f.total, sessao: f.sessao, sessoesFase: f.sessoes, series: f.series, faixa: f.faixa, descanso: f.descanso };
  const exercicios = [];
  const blocos = FICHA.treinos[letra].map((b) => b.map((nome) => { exercicios.push(montarExercicio(nome, fase)); return exercicios.length - 1; }));
  db.ativa = { id: "s-" + Date.now(), data: hojeISO(), inicio: Date.now(), fichaId: FICHA.id, ficha: FICHA.nome, treino: letra, origem: "app", fase, blocos, exercicios, descanso: null };
  ui.abertos = new Set();
  ui.escolhido = null;
  salvar();
  pedirTelaLigada();
  render();
  window.scrollTo(0, 0);
}

const blocoFeito = (b) => b.every((i) => { const s = db.ativa.exercicios[i].series; return s.length && s.every((x) => x.feito); });
const rodadaFeita = (b, j) => b.every((i) => { const s = db.ativa.exercicios[i].series; return s.length <= j || s[j].feito; });

function avaliarUpAuto(ex) {
  const bateuTopo = ex.series.length && ex.series.every((s) => s.feito && s.reps != null && s.reps >= ex.faixa[1]);
  if (bateuTopo && !ex.up && !ex.upMexido) {
    ex.up = true; ex.upAuto = true;
    aviso(`Bateu o alvo em ${ex.nome}. Marquei ↑ subir na próxima.`);
  } else if (!bateuTopo && ex.upAuto) {
    ex.up = false; ex.upAuto = false;
  }
}

function rolarParaAtual() {
  const atual = db.ativa.blocos.findIndex((b) => !blocoFeito(b));
  const el = document.querySelector(`[data-bloco="${atual}"]`);
  if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
}

function marcarSerie(i, j) {
  const a = db.ativa;
  const ex = a.exercicios[i];
  const s = ex.series[j];
  s.feito = !s.feito;
  const bloco = a.blocos.find((b) => b.includes(i));
  avaliarUpAuto(ex);
  let rolar = false;
  if (s.feito) {
    destravarAudio();
    if (blocoFeito(bloco)) {
      pararDescanso();
      if (a.blocos.some((b) => !blocoFeito(b))) { iniciarDescanso(); rolar = true; }
    } else if (rodadaFeita(bloco, j)) {
      iniciarDescanso();
    }
  }
  salvar();
  render();
  if (rolar) rolarParaAtual();
}

function fazerDepois(bi) {
  const a = db.ativa;
  const [b] = a.blocos.splice(bi, 1);
  a.blocos.push(b);
  ui.abertos = new Set();
  salvar();
  render();
  aviso("Bloco movido para o fim. Siga com o próximo.");
  rolarParaAtual();
}

function ajustar(i, j, campo, dir) {
  const ex = db.ativa.exercicios[i];
  const s = ex.series[j];
  const passo = campo === "carga" ? ex.passo : (ex.tipo === "tempo" ? ex.passo : 1);
  const novo = Math.max(0, Math.round(((s[campo] || 0) + dir * passo) * 100) / 100);
  // Mudou a carga de uma série ainda não feita: as seguintes acompanham
  if (campo === "carga" && !s.feito) ex.series.forEach((x, k) => { if (k >= j && !x.feito) x.carga = novo; });
  else s[campo] = novo;
  if (s.feito) avaliarUpAuto(ex);
  salvar();
  render();
}

async function concluirSessao() {
  const a = db.ativa;
  const pendentes = a.exercicios.reduce((n, e) => n + e.series.filter((s) => !s.feito).length, 0);
  const feitas = a.exercicios.reduce((n, e) => n + e.series.filter((s) => s.feito).length, 0);
  if (!feitas) {
    if (await confirmar("Nenhuma série marcada", "Quer descartar este treino?", "Descartar")) descartarSessao();
    return;
  }
  if (pendentes && !(await confirmar("Concluir treino?", `${pendentes} série(s) não marcada(s) não serão salvas.`, "Concluir"))) return;
  const sessao = {
    id: a.id, data: a.data, inicio: a.inicio, fim: Date.now(), fichaId: a.fichaId, ficha: a.ficha, treino: a.treino, fase: a.fase.n, origem: "app",
    exercicios: a.blocos.flat()
      .map((i) => a.exercicios[i])
      .map((e) => ({ nome: e.nome, up: e.up, series: e.series.filter((s) => s.feito).map((s) => ({ carga: s.carga, reps: s.reps })) }))
      .filter((e) => e.series.length),
  };
  db.sessoes.push(sessao);
  db.ativa = null;
  pararDescanso();
  liberarTela();
  salvar();
  ui.resumo = sessao.id;
  render();
  window.scrollTo(0, 0);
}

function descartarSessao() {
  db.ativa = null;
  pararDescanso();
  liberarTela();
  salvar();
  render();
}

/* ───────────── Descanso ───────────── */
let tick = null;
function iniciarDescanso() {
  const total = (db.ativa.fase && db.ativa.fase.descanso) || 60;
  db.ativa.descanso = { fim: Date.now() + total * 1000, total };
  salvar();
  mostrarDescanso();
}
function pararDescanso() {
  if (db.ativa) db.ativa.descanso = null;
  clearInterval(tick); tick = null;
  $("#descanso").hidden = true;
  $("#descanso").classList.remove("terminou");
  document.body.classList.remove("com-descanso");
}
function mostrarDescanso() {
  const d = db.ativa && db.ativa.descanso;
  if (!d) return pararDescanso();
  $("#descanso").hidden = false;
  document.body.classList.add("com-descanso");
  let tocou = Date.now() > d.fim + 2000; // não apita de novo ao reabrir o app muito depois
  clearInterval(tick);
  const atualizar = () => {
    const rest = Math.ceil((d.fim - Date.now()) / 1000);
    const caixa = $("#descanso");
    if (rest > 0) {
      caixa.classList.remove("terminou");
      $("#descanso-rotulo").textContent = "Descanso";
      $("#descanso-tempo").textContent = `${Math.floor(rest / 60)}:${p2(rest % 60)}`;
      $("#descanso-progresso").style.width = `${100 * (1 - rest / d.total)}%`;
    } else {
      caixa.classList.add("terminou");
      $("#descanso-rotulo").textContent = "Descanso acabou";
      $("#descanso-tempo").textContent = "Bora!";
      $("#descanso-progresso").style.width = "100%";
      if (!tocou) { tocou = true; apito(); }
      if (Date.now() > d.fim + 15000) { pararDescanso(); salvar(); }
    }
  };
  atualizar();
  tick = setInterval(atualizar, 250);
}

let audioCtx = null;
function destravarAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
  } catch (e) {}
}
function apito() {
  if (!audioCtx) return;
  try {
    [0, 0.22].forEach((t) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination);
      const t0 = audioCtx.currentTime + t;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.4, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
      o.start(t0); o.stop(t0 + 0.2);
    });
  } catch (e) {}
}

/* ───────────── Tela ligada durante o treino ───────────── */
let wakeLock = null;
async function pedirTelaLigada() {
  try { if ("wakeLock" in navigator && db.ativa) wakeLock = await navigator.wakeLock.request("screen"); } catch (e) {}
}
function liberarTela() { try { wakeLock && wakeLock.release(); } catch (e) {} wakeLock = null; }
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && db.ativa) { pedirTelaLigada(); mostrarDescanso(); if (FICHA) render(); }
});

/* ───────────── Backup ───────────── */
function csvDe(sessoes) {
  const linhas = [["data", "ficha", "treino", "fase", "exercicio", "serie", "carga_kg", "reps", "up", "origem"]];
  [...sessoes].sort((a, b) => a.data.localeCompare(b.data)).forEach((s) =>
    s.exercicios.forEach((e) => e.series.forEach((x, n) =>
      linhas.push([s.data, s.ficha, s.treino, s.fase ?? "", e.nome, n + 1, String(x.carga ?? "").replace(".", ","), x.reps ?? "", e.up ? "sim" : "", s.origem || "app"]))));
  return "﻿" + linhas.map((l) => l.map((c) => (/[;"\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c)).join(";")).join("\r\n");
}
async function compartilhar(nome, conteudo, tipo) {
  const blob = new Blob([conteudo], { type: tipo });
  let arquivo = null;
  try { arquivo = new File([blob], nome, { type: tipo }); } catch (e) {}
  if (arquivo && navigator.canShare && navigator.canShare({ files: [arquivo] })) {
    try { await navigator.share({ files: [arquivo] }); return true; }
    catch (e) { if (e && e.name === "AbortError") return false; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}
async function exportarBackup() {
  const conteudo = JSON.stringify({ app: "FitFred", versao: 1, exportadoEm: new Date().toISOString(), ficha: FICHA ? { nome: FICHA.nome, id: FICHA.id } : null, ajustes: db.ajustes, sessoes: db.sessoes, corpo: db.corpo }, null, 1);
  if (await compartilhar(`fitfred-backup-${hojeISO()}.json`, conteudo, "application/json")) {
    db.ultimoBackup = Date.now(); salvar(); render(); aviso("Backup gerado. Guarde o arquivo ou mande para você.");
  }
}
async function exportarCsv() { await compartilhar(`fitfred-series-${hojeISO()}.csv`, csvDe(db.sessoes), "text/csv"); }
async function exportarMedidas() { await compartilhar(`fitfred-medidas-${hojeISO()}.csv`, csvCorpo(), "text/csv"); }
function importar(texto) {
  let dados;
  try { dados = JSON.parse(texto); } catch (e) { return aviso("Esse arquivo não é um backup do FitFred."); }
  const lista = Array.isArray(dados) ? dados : dados.sessoes || [];
  const medidas = Array.isArray(dados.corpo) ? dados.corpo : [];
  if (!Array.isArray(lista) || (!lista.length && !medidas.length)) return aviso("Esse arquivo não é um backup do FitFred.");
  const ids = new Set(db.sessoes.map((s) => s.id));
  let novas = 0, repetidas = 0;
  for (const s of lista) {
    if (!s || !s.id || !s.data || !Array.isArray(s.exercicios)) continue;
    if (ids.has(s.id)) { repetidas++; continue; }
    db.sessoes.push(s); ids.add(s.id); novas++;
  }
  const idsC = new Set(db.corpo.map((r) => r.id));
  let novasM = 0;
  for (const r of medidas) { if (r && r.id && r.tipo && r.data && !idsC.has(r.id)) { db.corpo.push(r); idsC.add(r.id); novasM++; } }
  ui.corpoForm = null;
  salvar(); render();
  aviso(`${novas} treino(s)` + (novasM ? ` e ${novasM} medida(s)` : "") + " importado(s)" + (repetidas ? `; ${repetidas} treino(s) já estavam aqui.` : "."));
}

/* ───────────── UI: modal e aviso ───────────── */
function confirmar(titulo, texto, ok = "OK") {
  return new Promise((resolve) => {
    $("#modal-titulo").textContent = titulo;
    $("#modal-texto").textContent = texto;
    $("#modal-sim").textContent = ok;
    $("#modal").hidden = false;
    const fim = (v) => { $("#modal").hidden = true; $("#modal-sim").onclick = $("#modal-nao").onclick = null; resolve(v); };
    $("#modal-sim").onclick = () => fim(true);
    $("#modal-nao").onclick = () => fim(false);
  });
}
let avisoTimer = null;
function aviso(texto) {
  const el = $("#aviso");
  el.textContent = texto; el.hidden = false;
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => (el.hidden = true), 3200);
}

/* ───────────── Renderização ───────────── */
const ui = { aba: "hoje", abertos: new Set(), histAberto: null, resumo: null, escolhido: null, corpoForm: null, evolAba: "treinos", exEvol: null };

function render() {
  document.querySelectorAll(".aba").forEach((b) => b.classList.toggle("ativa", b.dataset.aba === ui.aba));
  const emSessao = ui.aba === "hoje" && db.ativa && !ui.resumo;
  document.body.classList.toggle("em-sessao", !!emSessao);
  let html;
  if (!FICHA) html = telaSemFicha();
  else if (ui.aba === "historico") html = telaHistorico();
  else if (ui.aba === "corpo") html = telaCorpo();
  else if (ui.aba === "evolucao") html = telaEvolucao();
  else if (ui.aba === "ajustes") html = telaAjustes();
  else if (ui.resumo) html = telaResumo();
  else if (db.ativa) html = telaSessao();
  else html = telaHoje();
  $("#tela").innerHTML = html;
}

function telaSemFicha() {
  return `<h1>FitFred</h1><div class="cartao alerta"><p><b>Não consegui ler o treino.txt.</b> Abra o app uma vez com internet, ou confira se o treino.txt foi enviado junto com o app no GitHub.</p>
    <button class="btn-sec" data-acao="recarregar" style="width:100%">Tentar de novo</button></div>`;
}

function cartaoFase() {
  const f = faseAtual();
  const prox = FICHA.fases[f.n];
  const pct = f.sessoes ? Math.min(100, (100 * (f.sessao - 1)) / f.sessoes) : 0;
  const novaFase = f.sessao === 1 && f.n > 1;
  return `<div class="cartao fase ${novaFase ? "nova" : ""}">
    <div class="topo-linha"><span class="rotulo-mini">${novaFase ? "Nova fase começa hoje" : `Fase ${f.n} de ${f.total}`}</span>
      <span class="sub num">${f.alemDoPlano ? "plano concluído" : `sessão ${f.sessao} de ${f.sessoes}`}</span></div>
    <div class="fase-param">${novaFase ? `Fase ${f.n} · ` : ""}${txtFase(f)}</div>
    <div class="progresso"><span style="width:${pct}%"></span></div>
    <div class="sub" style="margin-top:6px">${f.alemDoPlano ? "Todas as fases do treino.txt foram feitas. Hora de montar a próxima ficha." : prox ? `Depois: fase ${prox.n} · ${txtFase(prox)}` : "Última fase do plano"}</div>
  </div>`;
}

function telaHoje() {
  const sugerido = proximoTreino();
  const letra = ui.escolhido && FICHA.treinos[ui.escolhido] ? ui.escolhido : sugerido;
  const ultLetra = ultimoDoTreino(letra);
  const ult = ordenadas()[0];
  const naSemana = treinosNaSemana();
  const meta = db.ajustes.metaSemanal;
  const bolinhas = Array.from({ length: Math.max(meta, naSemana) }, (_, i) => `<i class="${i < naSemana ? "feito" : ""}"></i>`).join("");
  const blocos = FICHA.treinos[letra].map((b) => `<li>${b.map((n) => esc(n)).join(" + ")}${b.length > 1 ? '<span class="bi">bi-set</span>' : ""}</li>`).join("");

  const alteracoes = [...db.sessoes.filter((s) => s.origem === "app").map((s) => s.fim || 0), ...db.corpo.map((r) => r.ts || 0)];
  const backupVelho = alteracoes.length && (!db.ultimoBackup || Date.now() - db.ultimoBackup > 7 * 86400000) &&
    alteracoes.some((t) => t > (db.ultimoBackup || 0));
  const alertaBackup = backupVelho ? `
    <div class="cartao alerta" style="margin-top:12px">
      <p><b>Faça um backup.</b> Seus treinos ficam só neste iPhone. Último backup: ${db.ultimoBackup ? haQuanto(isoDe(new Date(db.ultimoBackup))) : "nunca"}.</p>
      <button class="btn-sec" data-acao="exportar" style="width:100%">Fazer backup agora</button>
    </div>` : "";
  const boasVindas = !db.sessoes.length ? `
    <div class="cartao" style="margin-top:12px">
      <p style="margin:0 0 12px">Tem o histórico do Treino 1? Importe o arquivo <b>fitfred_importar.json</b> para o app já mostrar suas últimas cargas.</p>
      <button class="btn-sec" data-acao="importar" style="width:100%">Importar histórico</button>
    </div>` : "";

  return `
    <div class="topo-linha">
      <h1>Hoje</h1>
      <div class="semana" title="Treinos nesta semana">${bolinhas}</div>
    </div>
    <p class="sub" style="margin:0 0 16px">${dataComDia(hojeISO())} · ${naSemana} de ${meta} treinos na semana${ult ? ` · último ${haQuanto(ult.data)}` : ""}</p>
    ${lembreteCorpo()}
    ${cartaoFase()}
    <div class="seletor" role="tablist" aria-label="Escolher treino">
      ${LETRAS.map((l) => `<button class="${l === letra ? "ativo" : ""}" data-acao="escolher" data-letra="${l}" role="tab" aria-selected="${l === letra}">${l}${l === sugerido ? "<small>próximo</small>" : ""}</button>`).join("")}
    </div>
    <div class="cartao">
      <div class="proximo">
        <div class="proximo-letra">${letra}</div>
        <div>
          <h2>Treino ${letra}</h2>
          <div class="sub">${ultLetra ? `Último ${letra}: ${dataComDia(ultLetra.data)}` : "Ainda não feito nesta ficha"}</div>
        </div>
      </div>
      <ul class="lista-blocos">${blocos}</ul>
      <button class="btn btn-grande" data-acao="iniciar" data-letra="${letra}">Começar treino ${letra}</button>
      ${letra !== sugerido ? `<button class="btn-link" style="width:100%" data-acao="escolher" data-letra="${sugerido}">Voltar para o ${sugerido} (próximo da rotação)</button>` : ""}
    </div>
    ${alertaBackup}${boasVindas}`;
}

function telaSessao() {
  const a = db.ativa;
  const total = a.exercicios.reduce((n, e) => n + e.series.length, 0);
  const feitas = a.exercicios.reduce((n, e) => n + e.series.filter((s) => s.feito).length, 0);
  const atual = a.blocos.findIndex((b) => !blocoFeito(b));
  const pendentes = a.blocos.filter((b) => !blocoFeito(b)).length;
  const hora = new Date(a.inicio);
  const velho = a.data !== hojeISO();

  const alertaVelho = velho ? `<div class="cartao alerta" style="margin-top:14px">
      <p><b>Este treino é de ${dataComDia(a.data)} e ficou aberto.</b> O que fazer com ele?</p>
      <div class="grade-botoes">
        <button class="btn" data-acao="concluir">Concluir com o que foi marcado</button>
        <button class="btn-sec" data-acao="continuar-hoje">Continuar como treino de hoje</button>
        <button class="btn-link" data-acao="descartar">Descartar</button>
      </div></div>` : "";

  const blocosHtml = a.blocos.map((b, bi) => {
    const feito = blocoFeito(b);
    const rotulo = b.length > 1 ? "Bi-set" : "Exercício";
    if (feito && !ui.abertos.has(bi)) {
      const resumo = b.map((i) => { const e = a.exercicios[i]; return `<b>${esc(e.nome)}</b> ${fmtSeries(e.tipo, e.series)}${e.up ? ' <span class="ok">↑</span>' : ""}`; }).join("<br>");
      return `<section class="bloco feito" data-bloco="${bi}">
        <div class="bloco-cab"><span>${rotulo}</span><span class="ok">✓ feito</span></div>
        <button class="bloco-resumo" data-acao="abrir-bloco" data-b="${bi}">${resumo}</button>
      </section>`;
    }
    const acaoCab = feito
      ? `<button class="chip-mini" data-acao="fechar-bloco" data-b="${bi}">recolher</button>`
      : pendentes > 1 ? `<button class="chip-mini" data-acao="depois" data-b="${bi}">Fazer depois ↓</button>` : "";
    return `<section class="bloco ${bi === atual ? "atual" : ""}" data-bloco="${bi}">
      <div class="bloco-cab"><span>${rotulo}</span>${acaoCab}</div>
      ${b.map((i) => exercicioHtml(i)).join("")}
    </section>`;
  }).join("");

  return `
    <div class="sessao-cab">
      <div class="sessao-cab-linha">
        <h1>Treino ${a.treino}</h1>
        <span class="sub num">${feitas}/${total} séries</span>
      </div>
      <div class="sub num" style="font-size:13px">Fase ${a.fase.n} · ${txtFase(a.fase)} · desde ${p2(hora.getHours())}:${p2(hora.getMinutes())}</div>
      <div class="progresso"><span style="width:${total ? (100 * feitas) / total : 0}%"></span></div>
    </div>
    ${alertaVelho}
    ${blocosHtml}
    <div class="fim-sessao">
      <button class="btn btn-grande" data-acao="concluir">Concluir treino</button>
      <button class="btn-link" data-acao="descartar">Descartar este treino</button>
    </div>`;
}

function exercicioHtml(i) {
  const e = db.ativa.exercicios[i];
  const unidade = e.tipo === "tempo" ? "seg" : "reps";
  const alvo = `${e.series.length} × ${e.faixa[0] === e.faixa[1] ? e.faixa[0] : e.faixa.join("–")}${e.tipo === "tempo" ? " s" : ""}`;
  const ultimo = e.ultimo ? `Última (${dataCurta(e.ultimo.data)}): <b>${e.ultimo.resumo}</b>` : "Primeira vez: ajuste a carga";
  const selo = e.subiu ? `<span class="selo-up">↑ ${e.tipo === "carga" ? `+${fmtKg(e.passo)} kg` : "subir"} hoje</span>` : "";
  const linhas = e.series.map((s, j) => `
    <div class="serie ${s.feito ? "feita" : ""}">
      <span class="serie-n">${j + 1}</span>
      ${e.tipo === "carga" ? passoHtml(i, j, "carga", s.carga, "decimal", "kg") : '<div class="passo vazio"></div>'}
      ${passoHtml(i, j, "reps", s.reps, "numeric", unidade)}
      <button class="check" data-acao="check" data-i="${i}" data-j="${j}" aria-label="Série ${j + 1} feita">✓</button>
    </div>`).join("");
  return `<div class="ex">
    <p class="ex-nome">${esc(e.nome)}</p>
    <p class="ex-meta">${alvo} · ${ultimo}${selo}</p>
    <div class="cab-series"><span></span><span>${e.tipo === "carga" ? "kg" : ""}</span><span>${unidade}</span><span></span></div>
    ${linhas}
    <div class="ex-acoes">
      <button class="chip ${e.up ? "ligado" : ""}" data-acao="up" data-i="${i}">↑ Subir na próxima${e.upAuto ? " (sugerido)" : ""}</button>
      <button class="chip-mini" data-acao="add-serie" data-i="${i}">+ série</button>
      ${e.series.length > 1 ? `<button class="chip-mini" data-acao="rem-serie" data-i="${i}">− série</button>` : ""}
    </div>
  </div>`;
}
function passoHtml(i, j, campo, valor, modo, rotulo) {
  const v = valor == null ? "" : campo === "carga" ? fmtKg(valor) : valor;
  return `<div class="passo">
    <button data-acao="ajusta" data-i="${i}" data-j="${j}" data-campo="${campo}" data-d="-1" aria-label="menos ${rotulo}">−</button>
    <input value="${v}" inputmode="${modo}" enterkeyhint="done" autocomplete="off" data-i="${i}" data-j="${j}" data-campo="${campo}" aria-label="${rotulo} da série ${j + 1}">
    <button data-acao="ajusta" data-i="${i}" data-j="${j}" data-campo="${campo}" data-d="1" aria-label="mais ${rotulo}">+</button>
  </div>`;
}

function telaResumo() {
  const s = db.sessoes.find((x) => x.id === ui.resumo);
  if (!s) { ui.resumo = null; return telaHoje(); }
  const min = Math.max(1, Math.round((s.fim - s.inicio) / 60000));
  const series = s.exercicios.reduce((n, e) => n + e.series.length, 0);
  const ups = s.exercicios.filter((e) => e.up);
  const f = faseAtual();
  const mudouFase = f.sessao === 1 && f.n > 1 && !f.alemDoPlano;
  return `
    <h1>Treino ${s.treino} concluído</h1>
    <p class="sub" style="margin:0 0 16px">${dataComDia(s.data)} · ${min} min · ${series} séries · ${treinosNaSemana()} de ${db.ajustes.metaSemanal} na semana</p>
    ${mudouFase ? `<div class="cartao fase nova" style="margin-bottom:12px"><span class="rotulo-mini">Fase ${f.n - 1} completa</span><div class="fase-param">Próximo treino já é fase ${f.n}: ${txtFase(f)}</div></div>` : ""}
    <div class="cartao">
      <h2>${ups.length ? "Na próxima, subir:" : "Nenhum exercício marcado para subir"}</h2>
      ${ups.length ? `<ul class="lista-blocos">${ups.map((e) => `<li><span class="ok">↑</span> ${esc(e.nome)}</li>`).join("")}</ul>` : '<p class="sub" style="margin:0">Quando todas as séries baterem o alvo, o app sugere sozinho.</p>'}
    </div>
    <div style="margin-top:16px"><button class="btn btn-grande" data-acao="fechar-resumo">Pronto</button></div>`;
}

function telaHistorico() {
  const lista = ordenadas();
  if (!lista.length) return `<h1>Histórico</h1><div class="vazio-msg">Nenhum treino ainda.<br>Os treinos concluídos aparecem aqui.</div>`;
  return `<h1>Histórico</h1><p class="sub" style="margin:0 0 16px">${lista.length} treinos registrados</p>` + lista.map((s) => {
    const series = s.exercicios.reduce((n, e) => n + e.series.length, 0);
    const min = s.fim && s.inicio ? ` · ${Math.max(1, Math.round((s.fim - s.inicio) / 60000))} min` : "";
    const aberto = ui.histAberto === s.id;
    const det = aberto ? `<div class="hist-det"><table>${s.exercicios.map((e) =>
      `<tr><td>${esc(e.nome)}${e.up ? ' <span class="ok">↑</span>' : ""}</td><td>${fmtSeries(tipoDe(e.nome), e.series)}</td></tr>`).join("")}</table>
      <button class="btn-link" style="color:var(--rosa)" data-acao="apagar-sessao" data-id="${esc(s.id)}">Apagar este treino</button></div>` : "";
    return `<button class="hist-item" data-acao="hist" data-id="${esc(s.id)}">
      <div class="hist-linha"><span class="hist-titulo"><span class="hist-letra">${esc(s.treino)}</span> · ${dataComDia(s.data)}${s.origem === "migrado" ? '<span class="tag">migrado</span>' : ""}</span><span class="sub">${aberto ? "▴" : "▾"}</span></div>
      <div class="sub">${esc(s.ficha)}${s.fase ? ` · fase ${s.fase}` : ""} · ${series} séries${min}</div>
    </button>${det}`;
  }).join("");
}

function telaAjustes() {
  const d = db.ajustes;
  const f = faseAtual();
  return `
    <h1>Ajustes</h1>
    <h3>Ficha (treino.txt)</h3>
    <div class="cartao">
      <p class="sub" style="margin:0 0 6px"><b style="color:var(--texto)">${esc(FICHA.nome)}</b> · treinos ${LETRAS.join(", ")}</p>
      <p class="sub" style="margin:0 0 12px">${FICHA.fases.map((x) => `Fase ${x.n}: ${txtFase(x)} · ${x.sessoes} sessões`).join("<br>")}</p>
      <div class="linha-ajuste"><span>Sessões desta ficha feitas antes do app<br><small class="sub">Agora: fase ${f.n}, sessão ${f.sessao}</small></span>
        <div class="passo"><button data-acao="cfg" data-campo="sessoesAntes" data-d="-1">−</button><input class="num" value="${d.sessoesAntes}" readonly tabindex="-1"><button data-acao="cfg" data-campo="sessoesAntes" data-d="1">+</button></div></div>
      <div class="linha-ajuste"><span>Meta de treinos por semana</span>
        <div class="passo"><button data-acao="cfg" data-campo="metaSemanal" data-d="-1">−</button><input class="num" value="${d.metaSemanal}" readonly tabindex="-1"><button data-acao="cfg" data-campo="metaSemanal" data-d="1">+</button></div></div>
    </div>
    <h3>Backup</h3>
    <div class="cartao">
      <p class="sub" style="margin:0 0 12px">Os dados ficam só neste iPhone. O backup completo leva treinos e medidas; é ele que o script do computador lê. Último backup: <b style="color:var(--texto)">${db.ultimoBackup ? new Date(db.ultimoBackup).toLocaleDateString("pt-BR") : "nunca"}</b>.</p>
      <div class="grade-botoes">
        <button class="btn" data-acao="exportar">Exportar backup completo (.json)</button>
        <button class="btn-sec" data-acao="exportar-csv">Exportar treinos (.csv)</button>
        <button class="btn-sec" data-acao="exportar-medidas">Exportar medidas do corpo (.csv)</button>
        <button class="btn-sec" data-acao="importar">Importar backup ou histórico</button>
      </div>
    </div>
    <h3>Zona de perigo</h3>
    <button class="btn-perigo" style="width:100%" data-acao="apagar-tudo">Apagar todos os dados</button>
    <p class="rodape">FitFred ${VERSAO_APP}<br>${db.sessoes.length} treinos e ${db.corpo.length} medidas salvos neste aparelho</p>`;
}

/* ───────────── Eventos ───────────── */
document.addEventListener("click", async (ev) => {
  const aba = ev.target.closest("[data-aba]");
  if (aba) {
    if (aba.dataset.aba === "corpo") ui.corpoForm = null;
    if (aba.dataset.aba === "evolucao" && ui.aba === "evolucao") ui.exEvol = null;
    ui.aba = aba.dataset.aba; ui.histAberto = null; render(); window.scrollTo(0, 0); return;
  }
  const el = ev.target.closest("[data-acao]");
  if (!el) return;
  const d = el.dataset;
  if (await acaoCorpo(d.acao, d)) return;
  const i = +d.i, j = +d.j;
  switch (d.acao) {
    case "escolher": ui.escolhido = d.letra; render(); break;
    case "iniciar": iniciarSessao(d.letra); break;
    case "check": marcarSerie(i, j); break;
    case "ajusta": ajustar(i, j, d.campo, +d.d); break;
    case "depois": fazerDepois(+d.b); break;
    case "up": {
      const e = db.ativa.exercicios[i];
      e.up = !e.up; e.upAuto = false; e.upMexido = true; salvar(); render(); break;
    }
    case "add-serie": {
      const s = db.ativa.exercicios[i].series;
      const ref = s[s.length - 1];
      s.push({ carga: ref ? ref.carga : 0, reps: ref ? ref.reps : null, feito: false }); salvar(); render(); break;
    }
    case "rem-serie": {
      const s = db.ativa.exercicios[i].series;
      if (s.length > 1) { s.pop(); avaliarUpAuto(db.ativa.exercicios[i]); salvar(); render(); }
      break;
    }
    case "abrir-bloco": ui.abertos.add(+d.b); render(); break;
    case "fechar-bloco": ui.abertos.delete(+d.b); render(); break;
    case "concluir": await concluirSessao(); break;
    case "continuar-hoje": db.ativa.data = hojeISO(); salvar(); render(); break;
    case "descartar":
      if (await confirmar("Descartar treino?", "As séries marcadas neste treino serão perdidas.", "Descartar")) descartarSessao();
      break;
    case "fechar-resumo": ui.resumo = null; render(); window.scrollTo(0, 0); break;
    case "descanso-mais": if (db.ativa && db.ativa.descanso) { db.ativa.descanso.fim = Math.max(Date.now(), db.ativa.descanso.fim) + 15000; db.ativa.descanso.total += 15; salvar(); mostrarDescanso(); } break;
    case "descanso-pular": pararDescanso(); salvar(); break;
    case "hist": ui.histAberto = ui.histAberto === d.id ? null : d.id; render(); break;
    case "apagar-sessao":
      if (await confirmar("Apagar este treino?", "Não dá para desfazer.", "Apagar")) {
        db.sessoes = db.sessoes.filter((s) => s.id !== d.id); ui.histAberto = null; salvar(); render();
      }
      break;
    case "cfg": {
      const lim = d.campo === "sessoesAntes" ? [0, 500] : [1, 7];
      db.ajustes[d.campo] = Math.min(lim[1], Math.max(lim[0], (db.ajustes[d.campo] || 0) + +d.d)); salvar(); render(); break;
    }
    case "exportar": await exportarBackup(); break;
    case "exportar-csv": await exportarCsv(); break;
    case "exportar-medidas": await exportarMedidas(); break;
    case "evol-aba": ui.evolAba = d.v; ui.exEvol = null; render(); break;
    case "ver-ex": ui.exEvol = d.nome; render(); window.scrollTo(0, 0); break;
    case "voltar-evol": ui.exEvol = null; render(); window.scrollTo(0, 0); break;
    case "importar": $("#arquivo-importar").click(); break;
    case "recarregar": location.reload(); break;
    case "apagar-tudo":
      if (await confirmar("Apagar tudo?", `Isso remove os ${db.sessoes.length} treinos e ${db.corpo.length} medidas deste aparelho. Exporte um backup antes.`, "Apagar tudo")) {
        db = novoDb(); salvar(); pararDescanso(); render();
      }
      break;
  }
});

// Digitar valores direto no campo
document.addEventListener("focusin", (ev) => { if (ev.target.matches(".passo input:not([readonly])")) setTimeout(() => ev.target.select(), 0); });
document.addEventListener("change", (ev) => {
  const t = ev.target;
  if (t.id === "arquivo-importar") {
    const f = t.files && t.files[0];
    if (f) f.text().then(importar);
    t.value = "";
    return;
  }
  if (t.matches("input[data-corpo]")) {
    const v = parseFloat(String(t.value).replace(",", "."));
    formCorpo()[t.dataset.corpo] = isNaN(v) ? null : Math.round(v * 100) / 100;
    render();
    return;
  }
  if (!t.matches(".passo input[data-campo]") || !db.ativa) return;
  const ex = db.ativa.exercicios[+t.dataset.i];
  const s = ex.series[+t.dataset.j];
  const v = parseFloat(String(t.value).replace(",", "."));
  if (!isNaN(v) && v >= 0) {
    const campo = t.dataset.campo, j = +t.dataset.j;
    const novo = campo === "carga" ? Math.round(v * 100) / 100 : Math.round(v);
    // Carga digitada numa série ainda não feita vale também para as seguintes não feitas
    if (campo === "carga" && !s.feito) ex.series.forEach((x, k) => { if (k >= j && !x.feito) x.carga = novo; });
    else s[campo] = novo;
    if (s.feito) avaliarUpAuto(ex);
    salvar();
  }
  render();
});
document.addEventListener("keydown", (ev) => { if (ev.key === "Enter" && ev.target.matches(".passo input")) ev.target.blur(); });

/* ───────────── Início ───────────── */
(async function iniciar() {
  FICHA = await carregarFicha();
  LETRAS = FICHA ? Object.keys(FICHA.treinos) : [];
  render();
  if (db.ativa) { pedirTelaLigada(); mostrarDescanso(); }
  if (db.ativa && db.ativa.data !== hojeISO()) window.scrollTo(0, 0); // mostra o aviso de treino aberto
})();
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
