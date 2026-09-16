const crypto = require('crypto');
const { pool, initializeDatabase } = require('./authModel');

function normalizarCpf(cpf) {
  const digits = String(cpf || '').replace(/\D/g, '');

  if (digits.length !== 11) {
    return null;
  }

  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function dataValida(data) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(data || '')) && !Number.isNaN(Date.parse(`${data}T00:00:00Z`));
}

function gerarChaveAcesso() {
  return `GEST-${crypto.randomBytes(10).toString('hex').toUpperCase()}`;
}

async function createGestante({ userId, nome, cpf, dataNascimento, dum }) {
  const nomeNormalizado = String(nome || '').trim();
  const cpfNormalizado = normalizarCpf(cpf);
  const dumNormalizada = String(dum || '').trim() || null;

  if (!nomeNormalizado || !cpfNormalizado || !dataValida(dataNascimento) || (dumNormalizada && !dataValida(dumNormalizada))) {
    return { error: 'Informe nome, CPF válido, data de nascimento e uma DUM válida, se preenchida.' };
  }

  try {
    await initializeDatabase();

    const [existingUserGestante] = await pool.query(
      'SELECT id_gestante FROM gestantes WHERE id_usuario = ? LIMIT 1',
      [userId]
    );

    if (existingUserGestante.length) {
      return { error: 'Esta conta já possui uma gestação cadastrada.' };
    }

    for (let tentativa = 0; tentativa < 3; tentativa += 1) {
      const chaveAcesso = gerarChaveAcesso();

      try {
        const [result] = await pool.query(
          `INSERT INTO gestantes
            (id_usuario, nome, cpf, data_nascimento, dum, chave_acesso)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [userId, nomeNormalizado, cpfNormalizado, dataNascimento, dumNormalizada, chaveAcesso]
        );

        return {
          gestante: {
            id_gestante: result.insertId,
            id_usuario: userId,
            nome: nomeNormalizado,
            cpf: cpfNormalizado,
            data_nascimento: dataNascimento,
            dum: dumNormalizada,
            chave_acesso: chaveAcesso
          }
        };
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY' && error.message.includes('chave_acesso')) {
          continue;
        }

        if (error.code === 'ER_DUP_ENTRY' && error.message.includes('cpf')) {
          return { error: 'Já existe uma gestação cadastrada para este CPF.' };
        }

        throw error;
      }
    }

    return { error: 'Não foi possível gerar uma chave de acesso. Tente novamente.' };
  } catch (error) {
    console.warn('Erro ao cadastrar gestação:', error.message);
    return { error: 'Não foi possível cadastrar a gestação agora. Tente novamente.' };
  }
}

async function getGestanteByAccessKey(chaveAcesso) {
  const chaveNormalizada = String(chaveAcesso || '').trim().toUpperCase();

  if (!chaveNormalizada) {
    return null;
  }

  try {
    await initializeDatabase();
    const [rows] = await pool.query(
      `SELECT id_gestante, id_usuario, nome, cpf, data_nascimento, dum, chave_acesso, data_cadastro
       FROM gestantes WHERE chave_acesso = ? LIMIT 1`,
      [chaveNormalizada]
    );

    return rows[0] || null;
  } catch (error) {
    console.warn('Erro ao buscar gestação pela chave:', error.message);
    return null;
  }
}

async function getGestanteById(idGestante) {
  try {
    await initializeDatabase();
    const [rows] = await pool.query(
      `SELECT id_gestante, id_usuario, nome, cpf, data_nascimento, dum, chave_acesso, data_cadastro
       FROM gestantes WHERE id_gestante = ? LIMIT 1`,
      [idGestante]
    );

    return rows[0] || null;
  } catch (error) {
    console.warn('Erro ao buscar gestação:', error.message);
    return null;
  }
}

async function getGestanteByUserId(userId) {
  try {
    await initializeDatabase();
    const [rows] = await pool.query(
      `SELECT id_gestante, id_usuario, nome, cpf, data_nascimento, dum, chave_acesso, data_cadastro
       FROM gestantes WHERE id_usuario = ? LIMIT 1`,
      [userId]
    );

    return rows[0] || null;
  } catch (error) {
    console.warn('Erro ao buscar gestação da usuária:', error.message);
    return null;
  }
}

function inteiroValido(valor, minimo, maximo) {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero >= minimo && numero <= maximo ? numero : null;
}

function decimalValido(valor, minimo, maximo) {
  const numero = Number(String(valor || '').replace(',', '.'));
  return Number.isFinite(numero) && numero >= minimo && numero <= maximo ? numero : null;
}

function calcularSemanasPorDum(dum) {
  if (!dum) {
    return null;
  }

  const inicio = dum instanceof Date ? dum : new Date(`${dum}T00:00:00`);
  const diferenca = Date.now() - inicio.getTime();

  if (Number.isNaN(inicio.getTime()) || diferenca < 0) {
    return null;
  }

  return Math.floor(diferenca / (1000 * 60 * 60 * 24 * 7));
}

async function createAcompanhamento(idGestante, dados, dum) {
  const semanasGestacao = calcularSemanasPorDum(dum);
  const pesoAtual = decimalValido(dados.pesoAtual, 0.01, 999.99);
  const pressaoSistolica = inteiroValido(dados.pressaoSistolica, 1, 300);
  const pressaoDiastolica = inteiroValido(dados.pressaoDiastolica, 1, 250);

  if (semanasGestacao === null) {
    return { error: 'Informe uma DUM válida no cadastro da gestação para calcular as semanas.' };
  }

  if (pesoAtual === null || pressaoSistolica === null || pressaoDiastolica === null) {
    return { error: 'Preencha peso e pressão arterial com valores válidos.' };
  }

  try {
    await initializeDatabase();
    const [result] = await pool.query(
      `INSERT INTO acompanhamento_prenatal
        (id_gestante, semanas_gestacao, peso_atual, pressao_sistolica, pressao_diastolica)
       VALUES (?, ?, ?, ?, ?)`,
      [idGestante, semanasGestacao, pesoAtual, pressaoSistolica, pressaoDiastolica]
    );

    return { id: result.insertId };
  } catch (error) {
    console.warn('Erro ao salvar acompanhamento pré-natal:', error.message);
    return { error: 'Não foi possível salvar o registro agora. Tente novamente.' };
  }
}

async function getAcompanhamentosByGestanteId(idGestante) {
  try {
    await initializeDatabase();
    const [rows] = await pool.query(
      `SELECT id_acompanhamento, id_gestante, data_registro, semanas_gestacao, peso_atual,
              pressao_sistolica, pressao_diastolica
       FROM acompanhamento_prenatal
       WHERE id_gestante = ?
       ORDER BY data_registro DESC, id_acompanhamento DESC`,
      [idGestante]
    );

    return rows;
  } catch (error) {
    console.warn('Erro ao buscar acompanhamentos pré-natais:', error.message);
    return [];
  }
}

async function getUltimaAvaliacaoRiscoByGestanteId(idGestante) {
  try {
    await initializeDatabase();
    const [rows] = await pool.query(
      `SELECT id_avaliacao, id_gestante, data_avaliacao, classificacao,
              gestacao_multipla, possui_doenca_cronica, complicacao_atual,
              complicacao_anterior, uso_substancias, medicamento_sem_orientacao,
              sangramento, perda_liquido, dor_abdominal_forte, sintomas_pressao_alta,
              sintoma_grave, movimentos_reduzidos, febre
       FROM avaliacao_risco
       WHERE id_gestante = ?
       ORDER BY data_avaliacao DESC, id_avaliacao DESC
       LIMIT 1`,
      [idGestante]
    );

    return rows[0] || null;
  } catch (error) {
    console.warn('Erro ao buscar última avaliação de risco:', error.message);
    return null;
  }
}

async function getProtocolosMedicosPorSemana(semanaGestacional) {
  if (!Number.isInteger(semanaGestacional) || semanaGestacional < 0) {
    return [];
  }

  try {
    await initializeDatabase();
    const [rows] = await pool.query(
      `SELECT id_protocolo, categoria, titulo, descricao, semana_inicio, semana_fim
       FROM protocolos_medicos
       WHERE semana_fim >= ?
       ORDER BY
         CASE WHEN semana_inicio <= ? THEN 0 ELSE 1 END,
         semana_inicio ASC,
         semana_fim ASC,
         titulo ASC`,
      [semanaGestacional, semanaGestacional]
    );

    return rows;
  } catch (error) {
    console.warn('Erro ao buscar protocolos medicos:', error.message);
    return [];
  }
}

async function getProtocolosMedicosAnterioresPorSemana(semanaGestacional) {
  if (!Number.isInteger(semanaGestacional) || semanaGestacional < 0) {
    return [];
  }

  try {
    await initializeDatabase();
    const [rows] = await pool.query(
      `SELECT id_protocolo, categoria, titulo, descricao, semana_inicio, semana_fim
       FROM protocolos_medicos
       WHERE semana_fim < ?
       ORDER BY semana_fim DESC, semana_inicio DESC, titulo ASC`,
      [semanaGestacional]
    );

    return rows;
  } catch (error) {
    console.warn('Erro ao buscar protocolos anteriores:', error.message);
    return [];
  }
}

async function getProtocolosRealizadosByGestanteId(idGestante) {
  try {
    await initializeDatabase();
    const [rows] = await pool.query(
      `SELECT pr.id_protocolo, pr.concluido_em, p.categoria, p.titulo, p.descricao,
              p.semana_inicio, p.semana_fim
       FROM protocolos_realizados pr
       INNER JOIN protocolos_medicos p ON p.id_protocolo = pr.id_protocolo
       WHERE pr.id_gestante = ?
       ORDER BY pr.concluido_em DESC, p.titulo ASC`,
      [idGestante]
    );

    return rows;
  } catch (error) {
    console.warn('Erro ao buscar protocolos realizados:', error.message);
    return [];
  }
}

async function marcarProtocoloComoRealizado(idGestante, idProtocolo) {
  try {
    await initializeDatabase();
    await pool.query(
      `INSERT INTO protocolos_realizados (id_gestante, id_protocolo)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE concluido_em = concluido_em`,
      [idGestante, idProtocolo]
    );

    return true;
  } catch (error) {
    console.warn('Erro ao marcar protocolo como realizado:', error.message);
    return false;
  }
}

async function desmarcarProtocoloComoRealizado(idGestante, idProtocolo) {
  try {
    await initializeDatabase();
    const [result] = await pool.query(
      'DELETE FROM protocolos_realizados WHERE id_gestante = ? AND id_protocolo = ?',
      [idGestante, idProtocolo]
    );

    return result.affectedRows > 0;
  } catch (error) {
    console.warn('Erro ao reabrir protocolo realizado:', error.message);
    return false;
  }
}

function respostaValida(valor, opcoes) {
  const resposta = String(valor || '').trim();
  return opcoes.includes(resposta) ? resposta : null;
}

function respostasMultiplasValidas(valor, opcoes, opcoesExclusivas) {
  const respostas = [...new Set((Array.isArray(valor) ? valor : [valor])
    .map((item) => String(item || '').trim())
    .filter(Boolean))];

  if (!respostas.length || respostas.some((resposta) => !opcoes.includes(resposta))) {
    return null;
  }

  if (respostas.length > 1 && respostas.some((resposta) => opcoesExclusivas.includes(resposta))) {
    return null;
  }

  return respostas;
}

function classificarAvaliacaoRisco(respostas) {
  const alertaAtual = (
    respostas.sangramento !== 'Não' ||
    respostas.perdaLiquido === 'Sim' ||
    respostas.dorAbdominalForte === 'Sim' ||
    respostas.sintomasPressaoAlta === 'Sim' ||
    respostas.sintomaGrave === 'Sim' ||
    respostas.movimentosReduzidos === 'Sim' ||
    respostas.febre === 'Sim'
  );

  if (alertaAtual) {
    return 'Alto risco';
  }

  const temDoencaCronica = !respostas.condicoesSaude.includes('Nenhuma');
  const temComplicacaoAtual = !respostas.condicoesAtuais.includes('Nenhuma');
  const temComplicacaoAnterior = !respostas.complicacoesAnteriores.some((resposta) => (
    resposta === 'Não tive gestação anterior' || resposta === 'Nenhuma complicação'
  ));
  const temFatorDeRisco = (
    respostas.gestacaoMultipla === 'Sim' ||
    temDoencaCronica ||
    temComplicacaoAtual ||
    temComplicacaoAnterior ||
    respostas.usoSubstancias === 'Sim' ||
    respostas.medicamentoSemOrientacao === 'Sim'
  );

  return temFatorDeRisco ? 'Atenção necessária' : 'Baixo risco';
}

async function createAvaliacaoRisco(idGestante, dados) {
  const respostas = {
    gestacaoMultipla: respostaValida(dados.gestacaoMultipla, ['Sim', 'Não', 'Não sei']),
    condicoesSaude: respostasMultiplasValidas(dados.condicoesSaude, [
      'Pressão alta', 'Diabetes', 'Doença cardíaca', 'Doença renal', 'Epilepsia',
      'Doença autoimune', 'Outra doença crônica', 'Nenhuma'
    ], ['Nenhuma']),
    condicoesAtuais: respostasMultiplasValidas(dados.condicoesAtuais, [
      'Pressão alta ou pré-eclâmpsia', 'Diabetes gestacional', 'Anemia grave',
      'Infecção que necessita de acompanhamento', 'Alteração na placenta',
      'Alteração no crescimento do bebê', 'Nenhuma'
    ], ['Nenhuma']),
    complicacoesAnteriores: respostasMultiplasValidas(dados.complicacoesAnteriores, [
      'Parto prematuro', 'Pré-eclâmpsia ou pressão alta', 'Diabetes gestacional',
      'Aborto recorrente', 'Óbito fetal ou neonatal', 'Hemorragia grave',
      'Não tive gestação anterior', 'Nenhuma complicação'
    ], ['Não tive gestação anterior', 'Nenhuma complicação']),
    usoSubstancias: respostaValida(dados.usoSubstancias, ['Sim', 'Não', 'Prefiro não responder']),
    medicamentoSemOrientacao: respostaValida(dados.medicamentoSemOrientacao, ['Sim', 'Não']),
    sangramento: respostaValida(dados.sangramento, ['Não', 'Pequena quantidade', 'Sangramento intenso']),
    perdaLiquido: respostaValida(dados.perdaLiquido, ['Sim', 'Não', 'Não sei']),
    dorAbdominalForte: respostaValida(dados.dorAbdominalForte, ['Sim', 'Não']),
    sintomasPressaoAlta: respostaValida(dados.sintomasPressaoAlta, ['Sim', 'Não']),
    sintomaGrave: respostaValida(dados.sintomaGrave, ['Sim', 'Não']),
    movimentosReduzidos: respostaValida(dados.movimentosReduzidos, [
      'Sim', 'Não', 'Ainda não sinto os movimentos', 'Não sei avaliar'
    ]),
    febre: respostaValida(dados.febre, ['Sim', 'Não', 'Não medi a temperatura'])
  };

  if (Object.values(respostas).some((resposta) => resposta === null)) {
    return { error: 'Responda todas as perguntas usando as opções apresentadas.' };
  }

  const classificacao = classificarAvaliacaoRisco(respostas);

  try {
    await initializeDatabase();
    const [result] = await pool.query(
      `INSERT INTO avaliacao_risco (
        id_gestante, gestacao_multipla, possui_doenca_cronica, complicacao_atual,
        complicacao_anterior, uso_substancias, medicamento_sem_orientacao,
        sangramento, perda_liquido, dor_abdominal_forte, sintomas_pressao_alta,
        sintoma_grave, movimentos_reduzidos, febre, classificacao
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        idGestante,
        respostas.gestacaoMultipla,
        JSON.stringify(respostas.condicoesSaude),
        JSON.stringify(respostas.condicoesAtuais),
        JSON.stringify(respostas.complicacoesAnteriores),
        respostas.usoSubstancias,
        respostas.medicamentoSemOrientacao,
        respostas.sangramento,
        respostas.perdaLiquido,
        respostas.dorAbdominalForte,
        respostas.sintomasPressaoAlta,
        respostas.sintomaGrave,
        respostas.movimentosReduzidos,
        respostas.febre,
        classificacao
      ]
    );

    return { id: result.insertId, classificacao };
  } catch (error) {
    console.warn('Erro ao salvar avaliação de risco:', error.message);
    return { error: 'Não foi possível salvar a avaliação de risco agora. Tente novamente.' };
  }
}

exports.getHomeData = () => ({
  title: 'Painel de acompanhamento de gestantes',
  message: 'Visão geral para acompanhar gestantes e orientar a equipe de saúde.',
  dashboard: {
    totalGestantes: 154,
    baixoRisco: 108,
    medioRisco: 31,
    altoRisco: 15,
    ultimasAtualizacoes: [
      { nome: 'Ana Paula', semana: '24 semanas', risco: 'Baixo risco' },
      { nome: 'Larissa', semana: '31 semanas', risco: 'Médio risco' },
      { nome: 'Beatriz', semana: '36 semanas', risco: 'Alto risco' }
    ],
    orientacoes: [
      'Manter acompanhamento regular de pré-natal.',
      'Registrar sinais de alerta e alterações clínicas.',
      'Reforçar orientações de alimentação, hidratação e repouso.'
    ]
  }
});

module.exports.createGestante = createGestante;
module.exports.getGestanteByAccessKey = getGestanteByAccessKey;
module.exports.getGestanteById = getGestanteById;
module.exports.getGestanteByUserId = getGestanteByUserId;
module.exports.createAcompanhamento = createAcompanhamento;
module.exports.getAcompanhamentosByGestanteId = getAcompanhamentosByGestanteId;
module.exports.getUltimaAvaliacaoRiscoByGestanteId = getUltimaAvaliacaoRiscoByGestanteId;
module.exports.getProtocolosMedicosPorSemana = getProtocolosMedicosPorSemana;
module.exports.getProtocolosMedicosAnterioresPorSemana = getProtocolosMedicosAnterioresPorSemana;
module.exports.getProtocolosRealizadosByGestanteId = getProtocolosRealizadosByGestanteId;
module.exports.marcarProtocoloComoRealizado = marcarProtocoloComoRealizado;
module.exports.desmarcarProtocoloComoRealizado = desmarcarProtocoloComoRealizado;
module.exports.createAvaliacaoRisco = createAvaliacaoRisco;
