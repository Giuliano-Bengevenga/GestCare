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

  const fieldErrors = {};
  if (!nomeNormalizado) fieldErrors.nome = 'Informe o nome completo.';
  if (!cpfNormalizado) fieldErrors.cpf = 'Informe um CPF válido com 11 números.';
  if (!dataValida(dataNascimento)) fieldErrors.dataNascimento = 'Informe uma data de nascimento válida.';
  if (dumNormalizada && !dataValida(dumNormalizada)) fieldErrors.dum = 'Informe uma data válida ou deixe este campo vazio.';

  if (Object.keys(fieldErrors).length) {
    return {
      error: 'Revise os campos indicados para continuar.',
      fieldErrors
    };
  }

  try {
    await initializeDatabase();

    const { rows: existingUserGestante } = await pool.query(
      'SELECT id_gestante FROM gestantes WHERE id_usuario = $1 LIMIT 1',
      [userId]
    );

    if (existingUserGestante.length) {
      return { error: 'Esta conta já possui uma gestação cadastrada.' };
    }

    for (let tentativa = 0; tentativa < 3; tentativa += 1) {
      const chaveAcesso = gerarChaveAcesso();

      try {
        const { rows } = await pool.query(
          `INSERT INTO gestantes
            (id_usuario, nome, cpf, data_nascimento, dum, chave_acesso)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id_gestante`,
          [userId, nomeNormalizado, cpfNormalizado, dataNascimento, dumNormalizada, chaveAcesso]
        );

        return {
          gestante: {
            id_gestante: rows[0].id_gestante,
            id_usuario: userId,
            nome: nomeNormalizado,
            cpf: cpfNormalizado,
            data_nascimento: dataNascimento,
            dum: dumNormalizada,
            chave_acesso: chaveAcesso
          }
        };
      } catch (error) {
        if (error.code === '23505' && String(error.constraint || error.detail || '').includes('chave_acesso')) {
          continue;
        }

        if (error.code === '23505' && String(error.constraint || error.detail || '').includes('cpf')) {
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
    const { rows } = await pool.query(
      `SELECT id_gestante, id_usuario, nome, cpf, data_nascimento, dum, chave_acesso, data_cadastro
       FROM gestantes WHERE chave_acesso = $1 LIMIT 1`,
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
    const { rows } = await pool.query(
      `SELECT id_gestante, id_usuario, nome, cpf, data_nascimento, dum, chave_acesso, data_cadastro
       FROM gestantes WHERE id_gestante = $1 LIMIT 1`,
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
    const { rows } = await pool.query(
      `SELECT id_gestante, id_usuario, nome, cpf, data_nascimento, dum, chave_acesso, data_cadastro
       FROM gestantes WHERE id_usuario = $1 LIMIT 1`,
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
    const fieldErrors = {};
    if (pesoAtual === null) fieldErrors.pesoAtual = 'Informe um peso válido.';
    if (pressaoSistolica === null) fieldErrors.pressaoSistolica = 'Informe uma pressão sistólica válida.';
    if (pressaoDiastolica === null) fieldErrors.pressaoDiastolica = 'Informe uma pressão diastólica válida.';
    return {
      error: 'Revise os campos indicados para salvar o registro.',
      fieldErrors
    };
  }

  try {
    await initializeDatabase();
    const { rows } = await pool.query(
      `INSERT INTO acompanhamento_prenatal
        (id_gestante, semanas_gestacao, peso_atual, pressao_sistolica, pressao_diastolica)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id_acompanhamento`,
      [idGestante, semanasGestacao, pesoAtual, pressaoSistolica, pressaoDiastolica]
    );

    return { id: rows[0].id_acompanhamento };
  } catch (error) {
    console.warn('Erro ao salvar acompanhamento pré-natal:', error.message);
    return { error: 'Não foi possível salvar o registro agora. Tente novamente.' };
  }
}

async function getAcompanhamentosByGestanteId(idGestante) {
  try {
    await initializeDatabase();
    const { rows } = await pool.query(
      `SELECT id_acompanhamento, id_gestante, data_registro, semanas_gestacao, peso_atual,
              pressao_sistolica, pressao_diastolica
       FROM acompanhamento_prenatal
       WHERE id_gestante = $1
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
    const { rows } = await pool.query(
      `SELECT id_avaliacao, id_gestante, data_avaliacao, classificacao,
              gestacao_multipla, possui_doenca_cronica, complicacao_atual,
              complicacao_anterior, uso_substancias, medicamento_sem_orientacao,
              sangramento, perda_liquido, dor_abdominal_forte, sintomas_pressao_alta,
              sintoma_grave, movimentos_reduzidos, febre, recomendacoes
       FROM avaliacao_risco
       WHERE id_gestante = $1
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
    const { rows } = await pool.query(
      `SELECT id_protocolo, categoria, titulo, descricao, semana_inicio, semana_fim
       FROM protocolos_medicos
       WHERE semana_fim >= $1
       ORDER BY
         CASE WHEN semana_inicio <= $2 THEN 0 ELSE 1 END,
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
    const { rows } = await pool.query(
      `SELECT id_protocolo, categoria, titulo, descricao, semana_inicio, semana_fim
       FROM protocolos_medicos
       WHERE semana_fim < $1
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
    const { rows } = await pool.query(
      `SELECT pr.id_protocolo, pr.concluido_em, p.categoria, p.titulo, p.descricao,
              p.semana_inicio, p.semana_fim
       FROM protocolos_realizados pr
       INNER JOIN protocolos_medicos p ON p.id_protocolo = pr.id_protocolo
       WHERE pr.id_gestante = $1
       ORDER BY pr.concluido_em DESC, p.titulo ASC`,
      [idGestante]
    );

    return rows;
  } catch (error) {
    console.warn('Erro ao buscar protocolos realizados:', error.message);
    return [];
  }
}

async function getPainelExamesProtocolosAdmin() {
  try {
    await initializeDatabase();

    const [resumoResult, protocolosResult, examesRecentesResult] = await Promise.all([
      pool.query(
        `SELECT
           (SELECT COUNT(*) FROM protocolos_medicos)::INTEGER AS total_protocolos,
           (SELECT COUNT(*) FROM protocolos_realizados)::INTEGER AS total_exames_realizados,
           (SELECT COUNT(DISTINCT id_gestante) FROM protocolos_realizados)::INTEGER AS total_gestantes_com_exames`
      ),
      pool.query(
        `SELECT p.id_protocolo, p.categoria, p.titulo, p.descricao, p.semana_inicio, p.semana_fim,
                COUNT(pr.id_realizacao)::INTEGER AS total_realizados,
                COUNT(DISTINCT pr.id_gestante)::INTEGER AS total_gestantes
         FROM protocolos_medicos p
         LEFT JOIN protocolos_realizados pr ON pr.id_protocolo = p.id_protocolo
         GROUP BY p.id_protocolo, p.categoria, p.titulo, p.descricao, p.semana_inicio, p.semana_fim
         ORDER BY p.semana_inicio ASC, p.semana_fim ASC, p.titulo ASC`
      ),
      pool.query(
        `SELECT pr.id_realizacao, pr.concluido_em, g.nome AS nome_gestante,
                p.id_protocolo, p.categoria, p.titulo
         FROM protocolos_realizados pr
         INNER JOIN gestantes g ON g.id_gestante = pr.id_gestante
         INNER JOIN protocolos_medicos p ON p.id_protocolo = pr.id_protocolo
         ORDER BY pr.concluido_em DESC, pr.id_realizacao DESC
         LIMIT 10`
      )
    ]);

    return {
      resumo: resumoResult.rows[0] || {
        total_protocolos: 0,
        total_exames_realizados: 0,
        total_gestantes_com_exames: 0
      },
      protocolos: protocolosResult.rows,
      examesRecentes: examesRecentesResult.rows
    };
  } catch (error) {
    console.warn('Erro ao buscar painel administrativo de exames e protocolos:', error.message);
    return {
      resumo: {
        total_protocolos: 0,
        total_exames_realizados: 0,
        total_gestantes_com_exames: 0
      },
      protocolos: [],
      examesRecentes: []
    };
  }
}

async function getTodosProtocolosMedicos() {
  try {
    await initializeDatabase();
    const { rows } = await pool.query(
      `SELECT id_protocolo, categoria, titulo, descricao, semana_inicio, semana_fim
       FROM protocolos_medicos
       ORDER BY semana_inicio ASC, semana_fim ASC, titulo ASC`
    );

    return rows;
  } catch (error) {
    console.warn('Erro ao buscar protocolos para administração:', error.message);
    return [];
  }
}

async function getProtocoloMedicoById(idProtocolo) {
  try {
    await initializeDatabase();
    const { rows } = await pool.query(
      `SELECT id_protocolo, categoria, titulo, descricao, semana_inicio, semana_fim
       FROM protocolos_medicos
       WHERE id_protocolo = $1
       LIMIT 1`,
      [idProtocolo]
    );

    return rows[0] || null;
  } catch (error) {
    console.warn('Erro ao buscar protocolo médico:', error.message);
    return null;
  }
}

function textoLimitado(valor, limite) {
  const texto = String(valor || '').trim();
  return texto && texto.length <= limite ? texto : null;
}

async function atualizarProtocoloMedico(idProtocolo, dados) {
  const categoria = textoLimitado(dados.categoria, 20);
  const titulo = textoLimitado(dados.titulo, 100);
  const descricao = String(dados.descricao || '').trim() || null;
  const semanaInicioInformada = String(dados.semanaInicio || '').trim();
  const semanaFimInformada = String(dados.semanaFim || '').trim();
  const semanaInicio = semanaInicioInformada ? inteiroValido(semanaInicioInformada, 0, 45) : null;
  const semanaFim = semanaFimInformada ? inteiroValido(semanaFimInformada, 0, 45) : null;

  if (!categoria || !titulo || semanaInicio === null || semanaFim === null || semanaInicio > semanaFim) {
    const fieldErrors = {};
    if (!categoria) fieldErrors.categoria = 'Informe uma categoria de até 20 caracteres.';
    if (!titulo) fieldErrors.titulo = 'Informe um título de até 100 caracteres.';
    if (semanaInicio === null) fieldErrors.semanaInicio = 'Informe uma semana entre 0 e 45.';
    if (semanaFim === null) fieldErrors.semanaFim = 'Informe uma semana entre 0 e 45.';
    if (semanaInicio !== null && semanaFim !== null && semanaInicio > semanaFim) {
      fieldErrors.semanaFim = 'A semana final deve ser igual ou posterior à semana inicial.';
    }
    return { error: 'dados-invalidos', fieldErrors };
  }

  try {
    await initializeDatabase();
    const result = await pool.query(
      `UPDATE protocolos_medicos
       SET categoria = $1, titulo = $2, descricao = $3, semana_inicio = $4, semana_fim = $5
       WHERE id_protocolo = $6`,
      [categoria, titulo, descricao, semanaInicio, semanaFim, idProtocolo]
    );

    return result.rowCount ? { success: true } : { error: 'nao-encontrado' };
  } catch (error) {
    console.warn('Erro ao atualizar protocolo médico:', error.message);
    return { error: 'salvar' };
  }
}

async function marcarProtocoloComoRealizado(idGestante, idProtocolo) {
  try {
    await initializeDatabase();
    await pool.query(
      `INSERT INTO protocolos_realizados (id_gestante, id_protocolo)
       VALUES ($1, $2)
       ON CONFLICT (id_gestante, id_protocolo) DO NOTHING`,
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
    const result = await pool.query(
      'DELETE FROM protocolos_realizados WHERE id_gestante = $1 AND id_protocolo = $2',
      [idGestante, idProtocolo]
    );

    return result.rowCount > 0;
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

function adicionarRecomendacao(recomendacoes, recomendacao) {
  if (!recomendacoes.includes(recomendacao)) {
    recomendacoes.push(recomendacao);
  }
}

function gerarRecomendacoesAvaliacaoRisco(respostas) {
  const recomendacoes = [];
  const temDiabetes = respostas.condicoesSaude.includes('Diabetes') ||
    respostas.condicoesAtuais.includes('Diabetes gestacional');
  const temPressaoAlta = respostas.condicoesSaude.includes('Pressão alta') ||
    respostas.condicoesAtuais.includes('Pressão alta ou pré-eclâmpsia');
  const temCondicaoClinicaComplexa = respostas.condicoesSaude.some((condicao) => (
    ['Doença cardíaca', 'Doença renal', 'Epilepsia', 'Doença autoimune'].includes(condicao)
  ));
  const temSinalDeAlerta = (
    respostas.sangramento !== 'Não' ||
    respostas.perdaLiquido === 'Sim' ||
    respostas.dorAbdominalForte === 'Sim' ||
    respostas.sintomasPressaoAlta === 'Sim' ||
    respostas.sintomaGrave === 'Sim' ||
    respostas.movimentosReduzidos === 'Sim' ||
    respostas.febre === 'Sim'
  );

  if (temDiabetes) {
    adicionarRecomendacao(recomendacoes, 'Diabetes: mantenha o acompanhamento pré-natal e siga o plano alimentar e as orientações de monitoramento da glicose definidos pela equipe de saúde. Não ajuste insulina ou outros medicamentos por conta própria.');
  }

  if (temPressaoAlta) {
    adicionarRecomendacao(recomendacoes, 'Pressão alta: mantenha acompanhamento obstétrico regular e procure atendimento imediatamente se tiver dor de cabeça forte, alteração visual, dor na parte superior da barriga, falta de ar ou inchaço súbito.');
  }

  if (respostas.condicoesAtuais.includes('Anemia grave')) {
    adicionarRecomendacao(recomendacoes, 'Anemia: compareça às consultas e use ferro ou outros suplementos somente conforme a prescrição profissional. Procure atendimento se apresentar falta de ar importante, desmaio ou piora do cansaço.');
  }

  if (respostas.condicoesAtuais.includes('Infecção que necessita de acompanhamento')) {
    adicionarRecomendacao(recomendacoes, 'Infecção em acompanhamento: siga o tratamento prescrito até o fim e retorne ao serviço se houver febre, piora dos sintomas ou dificuldade para ingerir líquidos.');
  }

  if (temCondicaoClinicaComplexa) {
    adicionarRecomendacao(recomendacoes, 'Condição crônica: mantenha o pré-natal de alto risco e o acompanhamento com a especialidade indicada. Não interrompa medicamentos de uso contínuo sem orientação.');
  }

  if (respostas.gestacaoMultipla === 'Sim') {
    adicionarRecomendacao(recomendacoes, 'Gestação múltipla: mantenha as consultas de pré-natal conforme o intervalo indicado pela equipe e procure atendimento se surgirem contrações, perda de líquido ou sangramento.');
  }

  if (!respostas.complicacoesAnteriores.some((resposta) => (
    resposta === 'Não tive gestação anterior' || resposta === 'Nenhuma complicação'
  ))) {
    adicionarRecomendacao(recomendacoes, 'Histórico gestacional: informe à equipe de pré-natal as complicações anteriores e mantenha os exames e retornos recomendados.');
  }

  if (respostas.usoSubstancias === 'Sim') {
    adicionarRecomendacao(recomendacoes, 'Uso de substâncias: procure a equipe de saúde para receber apoio sigiloso e sem julgamento. Evite álcool, cigarro e outras drogas durante a gestação.');
  }

  if (respostas.medicamentoSemOrientacao === 'Sim') {
    adicionarRecomendacao(recomendacoes, 'Medicamentos: não inicie, suspenda ou altere doses sem orientação da equipe de saúde. Leve à consulta a lista de todos os remédios, chás e suplementos usados.');
  }

  if (temSinalDeAlerta) {
    adicionarRecomendacao(recomendacoes, 'Sinal de alerta informado: procure imediatamente a maternidade, pronto atendimento ou o serviço de urgência. Não espere a próxima consulta de pré-natal.');
  }

  if (!recomendacoes.length) {
    adicionarRecomendacao(recomendacoes, 'Mantenha o pré-natal em dia, siga as orientações da equipe de saúde e leve suas dúvidas para as consultas.');
  }

  adicionarRecomendacao(recomendacoes, 'Estas recomendações são educativas e não substituem avaliação médica ou de enfermagem.');
  return recomendacoes;
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
    const fieldErrors = Object.fromEntries(
      Object.entries(respostas)
        .filter(([, resposta]) => resposta === null)
        .map(([campo]) => [campo, 'Selecione uma resposta válida.'])
    );
    return {
      error: 'Responda os campos indicados usando as opções apresentadas.',
      fieldErrors
    };
  }

  const classificacao = classificarAvaliacaoRisco(respostas);
  const recomendacoes = gerarRecomendacoesAvaliacaoRisco(respostas);

  try {
    await initializeDatabase();
    const { rows } = await pool.query(
      `INSERT INTO avaliacao_risco (
        id_gestante, gestacao_multipla, possui_doenca_cronica, complicacao_atual,
        complicacao_anterior, uso_substancias, medicamento_sem_orientacao,
        sangramento, perda_liquido, dor_abdominal_forte, sintomas_pressao_alta,
        sintoma_grave, movimentos_reduzidos, febre, classificacao, recomendacoes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING id_avaliacao`,
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
        classificacao,
        JSON.stringify(recomendacoes)
      ]
    );

    return { id: rows[0].id_avaliacao, classificacao, recomendacoes };
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
module.exports.getPainelExamesProtocolosAdmin = getPainelExamesProtocolosAdmin;
module.exports.getTodosProtocolosMedicos = getTodosProtocolosMedicos;
module.exports.getProtocoloMedicoById = getProtocoloMedicoById;
module.exports.atualizarProtocoloMedico = atualizarProtocoloMedico;
module.exports.marcarProtocoloComoRealizado = marcarProtocoloComoRealizado;
module.exports.desmarcarProtocoloComoRealizado = desmarcarProtocoloComoRealizado;
module.exports.createAvaliacaoRisco = createAvaliacaoRisco;
