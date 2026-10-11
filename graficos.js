"use strict";
/* FitFred — gráficos em SVG (funcionam offline) e a tela Evolução. */

const COR = { serie1: "#EB5E22", serie2: "#3A8FDC", fraco: "#6E6E85", grade: "#2A2A35", texto: "#F0F0F5", sub: "#9494AD", fundo: "#16161A" };
const DIA = 86400000;

function ticksBonitos(min, max, n = 4) {
  if (min === max) { const d = Math.abs(min) * 0.1 || 1; min -= d; max += d; }
  const bruto = (max - min) / n;
  const pot = Math.pow(10, Math.floor(Math.log10(bruto)));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * pot).find((p) => p >= bruto) || 10 * pot;
  const ini = Math.floor(min / passo) * passo, fim = Math.ceil(max / passo) * passo;
  const t = [];
  for (let v = ini; v <= fim + passo / 2; v += passo) t.push(Math.round(v * 1000) / 1000);
  return t;
}
const fmtNum = (v) => (Math.round(v * 10) / 10).toLocaleString("pt-BR");

/* series: [{nome, cor, pontos:[{x(ms), y, dica}], linha(bool), fraco(bool)}]; bandas: [{x0, x1, rotulo}] */
function graficoLinha({ series, bandas = [], altura = 210, unidade = "", marcarPR = false, rotuloFinal = true }) {
  const W = 340, H = altura, mE = 34, mD = rotuloFinal ? 52 : 12, mT = 16, mB = 24;
  const todos = series.flatMap((s) => s.pontos);
  if (!todos.length) return "";
  let xMin = Math.min(...todos.map((p) => p.x)), xMax = Math.max(...todos.map((p) => p.x));
  if (xMax - xMin < 2 * DIA) { xMin -= 3 * DIA; xMax += 3 * DIA; }
  const padX = (xMax - xMin) * 0.04; xMin -= padX; xMax += padX;
  const ys = todos.map((p) => p.y);
  let yMin = Math.min(...ys), yMax = Math.max(...ys);
  const padY = (yMax - yMin) * 0.15 || Math.max(1, Math.abs(yMax) * 0.05);
  const ticks = ticksBonitos(yMin - padY, yMax + padY);
  yMin = ticks[0]; yMax = ticks[ticks.length - 1];
  const X = (x) => mE + ((x - xMin) / (xMax - xMin)) * (W - mE - mD);
  const Y = (y) => mT + (1 - (y - yMin) / (yMax - yMin)) * (H - mT - mB);

  let s = `<svg viewBox="0 0 ${W} ${H}" class="svg-grafico" role="img">`;
  bandas.forEach((b, i) => {
    const x0 = Math.max(mE, X(b.x0)), x1 = Math.min(W - mD, X(b.x1));
    if (x1 <= x0) return;
    if (i % 2 === 0) s += `<rect x="${x0}" y="${mT}" width="${x1 - x0}" height="${H - mT - mB}" fill="#ffffff" fill-opacity="0.035"/>`;
    s += `<text x="${x0 + 3}" y="${mT - 4}" font-size="9.5" fill="${COR.sub}">${esc(b.rotulo)}</text>`;
  });
  ticks.forEach((t) => {
    s += `<line x1="${mE}" x2="${W - mD}" y1="${Y(t)}" y2="${Y(t)}" stroke="${COR.grade}" stroke-width="1"/>`;
    s += `<text x="${mE - 6}" y="${Y(t) + 3.5}" font-size="10" fill="${COR.sub}" text-anchor="end">${fmtNum(t)}</text>`;
  });
  // datas no eixo x: início, fim e meio (se couber)
  const dx = [xMin + padX, xMax - padX];
  if (xMax - xMin > 20 * DIA) dx.splice(1, 0, (xMin + xMax) / 2);
  dx.forEach((x, i) => {
    const d = new Date(x);
    s += `<text x="${X(x)}" y="${H - 7}" font-size="10" fill="${COR.sub}" text-anchor="${i === 0 ? "start" : i === dx.length - 1 ? "end" : "middle"}">${p2(d.getDate())}/${p2(d.getMonth() + 1)}</text>`;
  });

  const finais = [];
  series.forEach((se) => {
    const pts = [...se.pontos].sort((a, b) => a.x - b.x);
    if (se.linha !== false && pts.length > 1) {
      s += `<path d="${pts.map((p, i) => `${i ? "L" : "M"}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join("")}" fill="none" stroke="${se.cor}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    }
    pts.forEach((p) => {
      s += se.fraco
        ? `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="3" fill="${COR.fraco}"/>`
        : `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="4" fill="${se.cor}" stroke="${COR.fundo}" stroke-width="2"/>`;
    });
    if (marcarPR && pts.length > 1 && !se.fraco) {
      const pr = pts.reduce((a, b) => (b.y >= a.y ? b : a));
      s += `<circle cx="${X(pr.x)}" cy="${Y(pr.y)}" r="8" fill="none" stroke="${COR.texto}" stroke-width="1.5"/>`;
      s += `<text x="${X(pr.x)}" y="${Y(pr.y) - 12}" font-size="10" font-weight="700" fill="${COR.texto}" text-anchor="middle">PR</text>`;
    }
    if (rotuloFinal && !se.fraco && pts.length) {
      const u = pts[pts.length - 1];
      finais.push({ y: Y(u.y), x: X(u.x), texto: `${se.curto ? se.curto + " " : ""}${fmtNum(u.y)}` });
    }
  });
  // rótulos finais sem sobreposição
  finais.sort((a, b) => a.y - b.y);
  for (let i = 1; i < finais.length; i++) if (finais[i].y - finais[i - 1].y < 13) finais[i].y = finais[i - 1].y + 13;
  finais.forEach((f) => (s += `<text x="${f.x + 9}" y="${f.y + 4}" font-size="11.5" font-weight="700" fill="${COR.texto}">${esc(f.texto)}</text>`));
  // alvos de toque (maiores que o ponto)
  series.forEach((se) => se.pontos.forEach((p) => {
    if (p.dica) s += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="13" fill="transparent" data-dica="${esc(p.dica)}"/>`;
  }));
  return s + "</svg>";
}

function legenda(series) {
  if (series.length < 2) return "";
  return `<div class="legenda">${series.map((s) => `<span><i style="background:${s.fraco ? COR.fraco : s.cor}${s.linha === false ? ";border-radius:50%;width:8px;height:8px" : ""}"></i>${esc(s.nome)}</span>`).join("")}</div>`;
}

function blocoGrafico(titulo, sub, series, opcoes = {}) {
  const svg = graficoLinha({ series, ...opcoes });
  if (!svg) return `<div class="cartao grafico"><h2>${titulo}</h2><p class="sub" style="margin:4px 0 0">${opcoes.vazio || "Sem registros ainda."}</p></div>`;
  return `<div class="cartao grafico">
    <div class="topo-linha"><h2>${titulo}${opcoes.unidade ? ` <small class="sub">(${opcoes.unidade})</small>` : ""}</h2>${sub ? `<span class="sub num">${sub}</span>` : ""}</div>
    ${legenda(series)}
    ${svg}
    <div class="grafico-dica">Toque num ponto para ver os detalhes.</div>
    ${opcoes.rodape || ""}
  </div>`;
}

/* ───────────── Dados de exercício ───────────── */
function dadosExercicio(nome) {
  const tipo = tipoDe(nome);
  const regs = [];
  [...ordenadas()].reverse().forEach((s) => {
    const e = s.exercicios.find((x) => x.nome === nome);
    if (e && e.series.length) regs.push({ s, e });
  });
  const porCarga = tipo === "carga" && regs.some((r) => r.e.series.some((x) => x.carga > 0));
  const pontos = regs.map(({ s, e }) => {
    const y = porCarga ? Math.max(...e.series.map((x) => x.carga || 0)) : Math.max(...e.series.map((x) => x.reps || 0));
    return {
      x: paraData(s.data).getTime(), y, fase: s.fichaId === FICHA.id ? s.fase : null, sessao: s, ex: e,
      dica: `${dataComDia(s.data)}${s.fase ? ` · fase ${s.fase}` : s.origem === "migrado" ? " · Treino 1" : ""} · ${fmtSeries(tipo, e.series)}${e.up ? " · ↑ subir" : ""}`,
    };
  });
  return { tipo, porCarga, pontos, unidade: porCarga ? "kg" : tipo === "tempo" ? "s" : "reps" };
}

function bandasFase(pontos) {
  const b = [];
  pontos.forEach((p, i) => {
    if (!p.fase) return;
    const ult = b[b.length - 1];
    if (ult && ult.fase === p.fase && ult.iFim === i - 1) { ult.iFim = i; return; }
    b.push({ fase: p.fase, iIni: i, iFim: i });
  });
  return b.map((r) => ({
    rotulo: `F${r.fase}`,
    x0: r.iIni > 0 ? (pontos[r.iIni - 1].fase ? (pontos[r.iIni - 1].x + pontos[r.iIni].x) / 2 : pontos[r.iIni].x - 2 * DIA) : -Infinity,
    x1: r.iFim < pontos.length - 1 ? (pontos[r.iFim + 1].fase ? (pontos[r.iFim].x + pontos[r.iFim + 1].x) / 2 : pontos[r.iFim].x + 2 * DIA) : Infinity,
  }));
}

function sparkline(pontos) {
  if (pontos.length < 2) return `<svg viewBox="0 0 64 22" class="spark"></svg>`;
  const xs = pontos.map((p) => p.x), ys = pontos.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const X = (x) => 2 + ((x - x0) / (x1 - x0 || 1)) * 60, Y = (y) => 19 - ((y - y0) / (y1 - y0 || 1)) * 16;
  return `<svg viewBox="0 0 64 22" class="spark"><path d="${pontos.map((p, i) => `${i ? "L" : "M"}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join("")}" fill="none" stroke="${COR.serie1}" stroke-width="1.75" stroke-linejoin="round"/></svg>`;
}

/* ───────────── Tela Evolução ───────────── */
function telaEvolucao() {
  const abaE = ui.evolAba || "treinos";
  const seg = `<div class="segmento" role="tablist">
    <button class="${abaE === "treinos" ? "ativo" : ""}" data-acao="evol-aba" data-v="treinos">Treinos</button>
    <button class="${abaE === "corpo" ? "ativo" : ""}" data-acao="evol-aba" data-v="corpo">Corpo</button></div>`;
  if (abaE === "corpo") return `<h1>Evolução</h1>${seg}${evolucaoCorpo()}`;
  if (ui.exEvol) return detalheExercicio(ui.exEvol);
  return `<h1>Evolução</h1>${seg}${evolucaoTreinos()}`;
}

function graficoAdesao() {
  const semanas = [];
  const ini = inicioDaSemana();
  for (let k = 7; k >= 0; k--) { const d = new Date(ini); d.setDate(d.getDate() - 7 * k); semanas.push(isoDe(d)); }
  const cont = semanas.map((w) => db.sessoes.filter((s) => chaveSemana(s.data) === w).length);
  const meta = db.ajustes.metaSemanal;
  const W = 340, H = 140, mT = 18, mB = 22, mE = 8;
  const maxV = Math.max(meta, ...cont, 1);
  const bw = (W - mE * 2) / 8;
  const Y = (v) => mT + (1 - v / maxV) * (H - mT - mB);
  let s = `<svg viewBox="0 0 ${W} ${H}" class="svg-grafico" role="img" aria-label="Treinos por semana">`;
  s += `<line x1="${mE}" x2="${W - mE}" y1="${Y(meta)}" y2="${Y(meta)}" stroke="${COR.sub}" stroke-dasharray="3 4" stroke-width="1"/>`;
  s += `<text x="${W - mE}" y="${Y(meta) - 4}" font-size="9.5" fill="${COR.sub}" text-anchor="end">meta ${meta}</text>`;
  cont.forEach((v, i) => {
    const x = mE + i * bw + 5, w = bw - 10, y = Y(v), h = H - mB - y;
    if (v > 0) s += `<path d="M${x},${H - mB} V${y + 4} Q${x},${y} ${x + 4},${y} H${x + w - 4} Q${x + w},${y} ${x + w},${y + 4} V${H - mB} Z" fill="${COR.serie1}"/>`;
    else s += `<line x1="${x}" x2="${x + w}" y1="${H - mB}" y2="${H - mB}" stroke="${COR.grade}" stroke-width="2"/>`;
    s += `<text x="${x + w / 2}" y="${(v > 0 ? y : H - mB) - 5}" font-size="11" font-weight="700" fill="${COR.texto}" text-anchor="middle">${v}</text>`;
    s += `<text x="${x + w / 2}" y="${H - 7}" font-size="9.5" fill="${COR.sub}" text-anchor="middle">${dataCurta(semanas[i])}</text>`;
    s += `<rect x="${mE + i * bw}" y="${mT}" width="${bw}" height="${H - mT - mB}" fill="transparent" data-dica="Semana de ${dataCurta(semanas[i])}: ${v} treino(s)"/>`;
  });
  s += "</svg>";
  const media = cont.slice(4).reduce((a, b) => a + b, 0) / 4;
  return `<div class="cartao grafico"><div class="topo-linha"><h2>Treinos por semana</h2><span class="sub num">média 4 sem.: ${fmtNum(media)}</span></div>
    ${s}<div class="grafico-dica">Toque numa barra para ver os detalhes.</div></div>`;
}

function evolucaoTreinos() {
  const linhas = LETRAS.map((l) => {
    const nomes = FICHA.treinos[l].flat();
    return `<h3>Treino ${l}</h3><div class="cartao lista-ex">${nomes.map((nome) => {
      const d = dadosExercicio(nome);
      const pts = d.pontos;
      const ult = pts[pts.length - 1];
      const delta = pts.length > 1 ? ult.y - pts[0].y : null;
      return `<button class="linha-ex" data-acao="ver-ex" data-nome="${esc(nome)}">
        <span class="linha-ex-nome">${esc(nome)}<small>${ult ? `${fmtSeries(d.tipo, ult.ex.series)} · ${dataCurta(ult.sessao.data)}` : "sem registros"}</small></span>
        ${sparkline(pts)}
        <span class="linha-ex-delta num">${delta == null ? "" : `${delta >= 0 ? "+" : "−"}${fmtNum(Math.abs(delta))}<small> ${d.unidade}</small>`}</span>
      </button>`;
    }).join("")}</div>`;
  }).join("");
  return `${cartaoFase()}${graficoAdesao()}${linhas}`;
}

function detalheExercicio(nome) {
  const d = dadosExercicio(nome);
  const serie = [{ nome, cor: COR.serie1, pontos: d.pontos }];
  const tabela = [...d.pontos].reverse().map((p) => `<tr><td>${dataCurta(p.sessao.data)}${p.fase ? `<small> F${p.fase}</small>` : ""}</td><td>${fmtSeries(d.tipo, p.ex.series)}${p.ex.up ? ' <span class="ok">↑</span>' : ""}</td></tr>`).join("");
  const metrica = d.porCarga ? "Carga máxima por sessão" : d.tipo === "tempo" ? "Tempo máximo por sessão" : "Reps máximas por sessão";
  return `<button class="btn-link" data-acao="voltar-evol" style="padding-left:0">‹ Evolução</button>
    <h1 style="margin-top:0">${esc(nome)}</h1>
    <p class="sub" style="margin:0 0 14px">${metrica} · ${d.pontos.length} sessões</p>
    ${blocoGrafico("Evolução", d.pontos.length > 1 ? `${d.pontos[d.pontos.length - 1].y - d.pontos[0].y >= 0 ? "+" : "−"}${fmtNum(Math.abs(d.pontos[d.pontos.length - 1].y - d.pontos[0].y))} ${d.unidade} no total` : "", serie,
      { unidade: d.unidade, marcarPR: true, bandas: bandasFase(d.pontos), vazio: "Ainda sem registros deste exercício." })}
    ${tabela ? `<h3>Sessões</h3><div class="cartao hist-det" style="margin:0;border-top:1px solid var(--borda);border-radius:var(--raio)"><table>${tabela}</table></div>` : ""}`;
}

function evolucaoCorpo() {
  const ms = (iso) => paraData(iso).getTime();
  const pesos = registrosDe("peso");
  const semanas = mediasSemanais("peso");
  const sPeso = [
    { nome: "Pesagens", cor: COR.fraco, fraco: true, linha: false, pontos: pesos.map((r) => ({ x: ms(r.data), y: r.valor, dica: `${dataComDia(r.data)} · ${fmt1(r.valor)} kg` })) },
    { nome: "Média semanal", cor: COR.serie1, pontos: semanas.map((w) => ({ x: ms(w.semana) + 3 * DIA, y: w.media, dica: `Semana de ${dataCurta(w.semana)} · média ${fmt1(w.media)} kg (${w.n} ${w.n > 1 ? "pesagens" : "pesagem"})` })) },
  ];
  const ultSem = semanas[semanas.length - 1];
  const cint = registrosDe("cintura");
  const sCint = [{ nome: "Cintura", cor: COR.serie1, pontos: cint.map((r) => ({ x: ms(r.data), y: r.valor, dica: `${dataComDia(r.data)} · ${fmt1(r.valor)} cm${r.leituras ? ` (${r.leituras.map(fmt1).join(" e ")})` : ""}` })) }];
  const par = (d, e, rot) => [
    { nome: rot === "Coxa" ? "Coxa direita" : "Braço direito", curto: "D", cor: COR.serie1, pontos: registrosDe(d).map((r) => ({ x: ms(r.data), y: r.valor, dica: `${dataComDia(r.data)} · ${rot} D ${fmt1(r.valor)} cm` })) },
    { nome: rot === "Coxa" ? "Coxa esquerda" : "Braço esquerdo", curto: "E", cor: COR.serie2, pontos: registrosDe(e).map((r) => ({ x: ms(r.data), y: r.valor, dica: `${dataComDia(r.data)} · ${rot} E ${fmt1(r.valor)} cm` })) },
  ];
  const difAtual = (d, e) => {
    const a = ultimaMedida(d), b = ultimaMedida(e);
    if (!a || !b) return "";
    const v = a.valor - b.valor;
    return `<p class="sub" style="margin:6px 0 0">Diferença atual D − E: <b style="color:var(--texto)">${v >= 0 ? "+" : "−"}${fmt1(Math.abs(v))} cm</b></p>`;
  };
  return `
    ${blocoGrafico("Peso", ultSem ? `média atual ${fmt1(ultSem.media)} kg` : "", sPeso, { unidade: "kg", vazio: "Registre o peso na aba Corpo." })}
    ${blocoGrafico("Cintura", "", sCint, { unidade: "cm", vazio: "Registre a cintura na aba Corpo." })}
    ${blocoGrafico("Braço · simetria", "", par("braco_d", "braco_e", "Braço"), { unidade: "cm", vazio: "Registre braço D e E na aba Corpo.", rodape: difAtual("braco_d", "braco_e") })}
    ${blocoGrafico("Coxa · simetria", "", par("coxa_d", "coxa_e", "Coxa"), { unidade: "cm", vazio: "Registre coxa D e E na aba Corpo.", rodape: difAtual("coxa_d", "coxa_e") })}`;
}

/* Toque num ponto: mostra a dica embaixo do gráfico, sem redesenhar a tela */
document.addEventListener("click", (ev) => {
  const alvo = ev.target.closest("[data-dica]");
  if (!alvo) return;
  const caixa = alvo.closest(".grafico");
  if (!caixa) return;
  caixa.querySelectorAll(".sel").forEach((n) => n.classList.remove("sel"));
  alvo.classList.add("sel");
  caixa.querySelector(".grafico-dica").textContent = alvo.dataset.dica;
});
