# FitFred — app de treino para o iPhone

A ficha vem do **treino.txt** (mesmo formato do Python). Treinos e medidas ficam só no iPhone:
faça backup em **Ajustes → Exportar backup completo** e mande o .json para você (o app avisa se passar de 7 dias).

## Publicar no GitHub Pages (uma vez)
1. Crie um repositório `fitfred` (público funciona com o Pages grátis; vão só o código e a ficha).
2. Em "Add file → Upload files", arraste **o conteúdo** desta pasta `app` — os arquivos soltos e a
   pasta `icons` — e não a pasta `app` em si. O `index.html` precisa ficar na raiz do repositório.
   Arquivos: index.html, app.js, corpo.js, graficos.js, ficha.js, treino.txt, styles.css, sw.js,
   manifest.webmanifest, icons/ (este LEIA-ME pode ir junto, não atrapalha).
3. **Nunca** envie backups (.json), a pasta `treino 1` nem planilhas: o repositório público é visível para todos.
4. Settings → Pages: Source = "Deploy from a branch", Branch = `main`, pasta `/ (root)`. Salve.
5. Em 1–2 minutos: `https://SEU-USUARIO.github.io/fitfred/`.

## Instalar no iPhone
1. Abra o link no **Safari** → Compartilhar → **Adicionar à Tela de Início**. Use sempre pelo ícone.
2. (Opcional) Histórico do Treino 1: mande para você `treino 1/fitfred_importar.json`, salve em Arquivos e use **Ajustes → Importar**.

## Abas
- **Hoje:** fase atual, prévia de qualquer treino, registro do treino.
- **Corpo:** peso (3–4x/semana, conta a média semanal), cintura (a cada 2 semanas, 2 leituras), braço e coxa D/E (a cada 4 semanas).
- **Evolução:** gráficos de cada exercício, treinos por semana, peso, cintura e simetria.

## Relatório no computador e análise com IA
1. No app: Ajustes → **Exportar backup completo (.json)** → mande para você.
2. Salve o arquivo na pasta `FitFred\backups`.
3. Dois cliques em `FitFred\gerar_relatorio.bat`. Ele usa o backup mais recente e cria `FitFred\relatorio_app` com:
   `relatorio_FitFred.pdf`, `graficos\`, `series.csv`, `medidas.csv` e **`resumo_para_IA.md`**.
4. Para analisar com uma IA: anexe o `resumo_para_IA.md` (e, se quiser, os dois .csv) na conversa.

## Mudou a ficha?
1. Edite o `treino.txt` da raiz do FitFred e copie para esta pasta `app`.
2. Troque o número da versão em `sw.js` (ex.: `fitfred-v0.4`) e envie `treino.txt` e `sw.js` ao GitHub.
   O app atualiza na segunda vez que abrir com internet.
- Mudou só reps/descanso/sessões: a contagem de sessões continua.
- Mudou a lista de exercícios: ficha nova, recomeça na fase 1, treino A.
- Passo de carga (1 / 2,5 / 5 kg) e exercícios em segundos ficam no `ficha.js`.
