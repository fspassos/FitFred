/*
  AJUSTES POR EXERCÍCIO
  A ficha (treinos, fases, repetições, descanso, sessões) vem do treino.txt — o mesmo formato
  que você já usa no Python. Este arquivo só diz detalhes que o treino.txt não tem:

    passo  – quanto os botões − / + mudam a carga, e quanto o "↑ subir" sugere a mais (padrão: 1 kg)
    tipo   – "tempo" para exercícios em segundos (a faixa de reps da fase não se aplica)
    faixa  – [mín, máx] próprio, só quando o exercício não segue a fase

  Exercício que não aparece aqui usa o padrão. Use exatamente o nome do treino.txt.
*/
window.EXERCICIOS = {
  "Leg Press 45": { passo: 5 },
  "Panturrilha no Leg Horizontal": { passo: 5 },
  "Panturrilha no Leg Press": { passo: 5 },
  "Cadeira Extensora": { passo: 2.5 },
  "Cadeira Flexora": { passo: 2.5 },
  "Cadeira Flexora Unilateral": { passo: 2.5 },
  "Cadeira Abdutora": { passo: 2.5 },
  "Cadeira Adutora": { passo: 2.5 },
  "Supino Vertical Maquina": { passo: 2.5 },
  "Puxada Aberta no Pulley": { passo: 2.5 },
  "Puxada Supinada no Pulley": { passo: 2.5 },
  "Rosca Direta Polia Baixa": { passo: 2.5 },
  "Triceps Barra Polia": { passo: 2.5 },
  "Panturrilha Sentado Maquina": { passo: 2.5 },
  "Remada Articulada Maquina": { passo: 2.5 },
  "Prancha Isometrica": { tipo: "tempo", faixa: [40, 40], passo: 5 },
};
