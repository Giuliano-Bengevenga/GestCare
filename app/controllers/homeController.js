const {
  getHomeData,
  getGestanteById,
  getGestanteByUserId,
  getAcompanhamentosByGestanteId,
  getUltimaAvaliacaoRiscoByGestanteId,
  createAcompanhamento,
  getProtocolosMedicosPorSemana,
  getProtocolosMedicosAnterioresPorSemana,
  getProtocolosRealizadosByGestanteId,
  getPainelExamesProtocolosAdmin,
  getTodosProtocolosMedicos,
  getProtocoloMedicoById,
  atualizarProtocoloMedico,
  marcarProtocoloComoRealizado,
  desmarcarProtocoloComoRealizado
} = require('../models/gestanteModel');

function calcularIdade(dataNascimento) {
  const nascimento = new Date(dataNascimento);
  const hoje = new Date();
  let idade = hoje.getFullYear() - nascimento.getUTCFullYear();
  const aniversarioAindaNaoChegou =
    hoje.getMonth() < nascimento.getUTCMonth() ||
    (hoje.getMonth() === nascimento.getUTCMonth() && hoje.getDate() < nascimento.getUTCDate());

  if (aniversarioAindaNaoChegou) {
    idade -= 1;
  }

  return idade;
}

function calcularSemanasGestacao(dum) {
  if (!dum) {
    return 'Não informada';
  }

  const inicio = dum instanceof Date ? dum : new Date(`${dum}T00:00:00`);
  const diferenca = Date.now() - inicio.getTime();
  const semanas = Math.floor(diferenca / (1000 * 60 * 60 * 24 * 7));

  return semanas >= 0 ? `${semanas} semanas` : 'Não informada';
}

function calcularNumeroSemanasGestacao(dum) {
  if (!dum) {
    return null;
  }

  const inicio = dum instanceof Date ? dum : new Date(`${dum}T00:00:00`);
  const diferenca = Date.now() - inicio.getTime();
  const semanas = Math.floor(diferenca / (1000 * 60 * 60 * 24 * 7));

  return Number.isNaN(inicio.getTime()) || semanas < 0 ? null : semanas;
}

function formatarData(data) {
  if (!data) {
    return 'Não informada';
  }

  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(data));
}

function formatarDataHora(data) {
  if (!data) {
    return 'Não informado';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo'
  }).format(new Date(data));
}

function classeVisualRisco(classificacao) {
  if (classificacao === 'Alto risco') return 'alto';
  if (classificacao === 'Atenção necessária') return 'medio';
  return 'baixo';
}

function lerRespostasMultiplas(valor) {
  if (Array.isArray(valor)) {
    return valor;
  }

  if (typeof valor !== 'string') {
    return [];
  }

  try {
    const respostas = JSON.parse(valor);
    return Array.isArray(respostas) ? respostas : [];
  } catch (error) {
    return [];
  }
}

function obterRecomendacoesDaAvaliacao(avaliacaoRisco) {
  const recomendacoes = lerRespostasMultiplas(avaliacaoRisco?.recomendacoes);

  if (recomendacoes.length) {
    return recomendacoes;
  }

  return [
    'Mantenha acompanhamento regular de pré-natal.',
    'Siga as orientações da equipe de saúde e procure atendimento se notar sinais de alerta.'
  ];
}

function formatarLista(respostas) {
  if (respostas.length <= 1) return respostas[0] || '';
  if (respostas.length === 2) return `${respostas[0]} e ${respostas[1]}`;
  return `${respostas.slice(0, -1).join(', ')} e ${respostas.at(-1)}`;
}

function obterMotivosDaClassificacao(avaliacaoRisco) {
  if (!avaliacaoRisco) {
    return ['A avaliação de risco ainda não foi respondida.'];
  }

  const motivos = [];
  const doencasCronicas = lerRespostasMultiplas(avaliacaoRisco.possui_doenca_cronica)
    .filter((resposta) => resposta !== 'Nenhuma');
  const condicoesAtuais = lerRespostasMultiplas(avaliacaoRisco.complicacao_atual)
    .filter((resposta) => resposta !== 'Nenhuma');
  const complicacoesAnteriores = lerRespostasMultiplas(avaliacaoRisco.complicacao_anterior)
    .filter((resposta) => resposta !== 'Não tive gestação anterior' && resposta !== 'Nenhuma complicação');

  if (avaliacaoRisco.gestacao_multipla === 'Sim') {
    motivos.push('Gestação múltipla informada.');
  }

  if (doencasCronicas.length) {
    motivos.push(`Condição de saúde informada: ${formatarLista(doencasCronicas)}.`);
  }

  if (condicoesAtuais.length) {
    motivos.push(`Condição informada durante esta gestação: ${formatarLista(condicoesAtuais)}.`);
  }

  if (complicacoesAnteriores.length) {
    motivos.push(`Histórico de complicação gestacional: ${formatarLista(complicacoesAnteriores)}.`);
  }

  if (avaliacaoRisco.uso_substancias === 'Sim') {
    motivos.push('Uso de cigarro, bebida alcoólica ou outras drogas informado durante a gestação.');
  }

  if (avaliacaoRisco.medicamento_sem_orientacao === 'Sim') {
    motivos.push('Uso de medicamento sem orientação profissional informado.');
  }

  if (avaliacaoRisco.sangramento !== 'Não') {
    motivos.push(`Sangramento vaginal informado: ${avaliacaoRisco.sangramento}.`);
  }

  if (avaliacaoRisco.perda_liquido === 'Sim') {
    motivos.push('Perda de líquido pela vagina informada.');
  }

  if (avaliacaoRisco.dor_abdominal_forte === 'Sim') {
    motivos.push('Dor forte ou persistente na barriga informada.');
  }

  if (avaliacaoRisco.sintomas_pressao_alta === 'Sim') {
    motivos.push('Sintomas compatíveis com alerta de pressão alta informados.');
  }

  if (avaliacaoRisco.sintoma_grave === 'Sim') {
    motivos.push('Sintoma grave, como convulsão, desmaio, falta de ar intensa ou dor no peito, informado.');
  }

  if (avaliacaoRisco.movimentos_reduzidos === 'Sim') {
    motivos.push('Diminuição ou ausência dos movimentos do bebê informada.');
  }

  if (avaliacaoRisco.febre === 'Sim') {
    motivos.push('Febre de 38 °C ou mais informada.');
  }

  return motivos.length ? motivos : ['Nenhum fator adicional foi informado na última avaliação.'];
}

async function renderGerenciamentoProtocolos(req, res, {
  error = null,
  success = null,
  formValues = null,
  fieldErrors = {},
  errorProtocolId = null,
  status = 200
} = {}) {
  const protocolos = await getTodosProtocolosMedicos();
  const protocolosComValores = formValues
    ? protocolos.map((protocolo) => (
      protocolo.id_protocolo === Number(formValues.idProtocolo)
        ? {
          ...protocolo,
          categoria: formValues.categoria,
          titulo: formValues.titulo,
          descricao: formValues.descricao,
          semana_inicio: formValues.semanaInicio,
          semana_fim: formValues.semanaFim
        }
        : protocolo
    ))
    : protocolos;

  return res.status(status).render('adminGerenciarProtocolos', {
    user: req.session.user,
    protocolos: protocolosComValores,
    error,
    success,
    fieldErrors,
    errorProtocolId,
    undoProtocol: req.session.ultimaEdicaoProtocolo || null
  });
}

exports.index = async (req, res) => {
  const data = getHomeData();
  const user = req.session.user || null;

  if (user?.role === 'admin') {
    const painel = await getPainelExamesProtocolosAdmin();
    const examesRecentes = painel.examesRecentes.map((exame) => ({
      ...exame,
      concluidoEm: formatarDataHora(exame.concluido_em)
    }));

    return res.render('adminExamesProtocolos', {
      user,
      resumo: painel.resumo,
      protocolos: painel.protocolos,
      examesRecentes
    });
  }

  const gestante = user ? await getGestanteByUserId(user.id) : null;
  const gestanteEmAcompanhamento = user && req.session.gestanteId
    ? await getGestanteById(req.session.gestanteId)
    : gestante;
  const acompanhandoOutraGestacao = Boolean(
    gestanteEmAcompanhamento && gestanteEmAcompanhamento.id_usuario !== user?.id
  );

  return res.render('index', {
    title: data.title,
    message: data.message,
    user,
    dashboard: data.dashboard,
    chaveAcesso: gestante ? gestante.chave_acesso : null,
    nomeGestanteAcompanhada: acompanhandoOutraGestacao ? gestanteEmAcompanhamento.nome : null
  });
};

exports.gestacao = async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  const idGestante = req.session.gestanteId;
  const gestante = idGestante
    ? await getGestanteById(idGestante)
    : await getGestanteByUserId(req.session.user.id);

  if (!gestante) {
    return res.redirect('/situacao-gestacao');
  }

  req.session.gestanteId = gestante.id_gestante;

  const [registros, avaliacaoRisco] = await Promise.all([
    getAcompanhamentosByGestanteId(gestante.id_gestante),
    getUltimaAvaliacaoRiscoByGestanteId(gestante.id_gestante)
  ]);
  const acompanhamentos = registros.map((registro) => ({
    ...registro,
    dataRegistro: formatarDataHora(registro.data_registro)
  }));
  const ultimoAcompanhamento = acompanhamentos[0] || null;

  const paciente = {
    nome: gestante.nome,
    cpf: gestante.cpf,
    dataNascimento: formatarData(gestante.data_nascimento),
    dum: formatarData(gestante.dum),
    idade: `${calcularIdade(gestante.data_nascimento)} anos`,
    semanaGestacional: calcularSemanasGestacao(gestante.dum),
    risco: avaliacaoRisco ? avaliacaoRisco.classificacao : 'Avaliação pendente',
    riscoClasse: classeVisualRisco(avaliacaoRisco ? avaliacaoRisco.classificacao : ''),
    motivosRisco: obterMotivosDaClassificacao(avaliacaoRisco),
    pressao: 'Não informada',
    peso: 'Não informado',
    altura: 'Não informada',
    proximaConsulta: 'Não agendada',
    observacoes: 'Gestação acompanhada com boa evolução e sem sinais de alerta.',
    recomendacoes: obterRecomendacoesDaAvaliacao(avaliacaoRisco)
  };

  if (ultimoAcompanhamento) {
    paciente.pressao = `${ultimoAcompanhamento.pressao_sistolica}/${ultimoAcompanhamento.pressao_diastolica} mmHg`;
    paciente.peso = `${ultimoAcompanhamento.peso_atual} kg`;
    paciente.observacoes = `Último registro realizado em ${ultimoAcompanhamento.dataRegistro}.`;
  }

  const formularioPendente = req.session.formularioAcompanhamento || null;
  delete req.session.formularioAcompanhamento;

  res.render('gestacao', {
    user: req.session.user || null,
    paciente,
    acompanhamentos,
    error: formularioPendente?.error || (typeof req.query.erro === 'string' ? req.query.erro : null),
    success: req.query.sucesso === '1'
      ? 'Registro pré-natal salvo com sucesso.'
      : req.query.avaliacao === '1'
        ? 'Avaliação de risco salva com sucesso.'
        : null,
    prenatalValues: formularioPendente?.values || {},
    fieldErrors: formularioPendente?.fieldErrors || {}
  });
};

exports.saveAcompanhamento = async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  const idGestante = req.session.gestanteId;
  const gestante = idGestante
    ? await getGestanteById(idGestante)
    : await getGestanteByUserId(req.session.user.id);

  if (!gestante) {
    return res.redirect('/situacao-gestacao');
  }

  req.session.gestanteId = gestante.id_gestante;
  const result = await createAcompanhamento(gestante.id_gestante, req.body, gestante.dum);

  if (result.error) {
    req.session.formularioAcompanhamento = {
      error: result.error,
      fieldErrors: result.fieldErrors || {},
      values: {
        pesoAtual: req.body.pesoAtual || '',
        pressaoSistolica: req.body.pressaoSistolica || '',
        pressaoDiastolica: req.body.pressaoDiastolica || ''
      }
    };
    return res.redirect('/gestacao');
  }

  return res.redirect('/gestacao?sucesso=1');
};

exports.protocolosMedicos = async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  const idGestante = req.session.gestanteId;
  const gestante = idGestante
    ? await getGestanteById(idGestante)
    : await getGestanteByUserId(req.session.user.id);

  if (!gestante) {
    return res.redirect('/situacao-gestacao');
  }

  req.session.gestanteId = gestante.id_gestante;

  const semanaGestacional = calcularNumeroSemanasGestacao(gestante.dum);
  const [protocolos, protocolosAnteriores, protocolosRealizados] = await Promise.all([
    semanaGestacional === null ? [] : getProtocolosMedicosPorSemana(semanaGestacional),
    semanaGestacional === null ? [] : getProtocolosMedicosAnterioresPorSemana(semanaGestacional),
    getProtocolosRealizadosByGestanteId(gestante.id_gestante)
  ]);

  const protocolosRealizadosIds = new Set(protocolosRealizados.map((protocolo) => protocolo.id_protocolo));

  const agenda = protocolos
    .filter((protocolo) => !protocolosRealizadosIds.has(protocolo.id_protocolo))
    .map((protocolo) => ({
      ...protocolo,
      status: semanaGestacional >= protocolo.semana_inicio
        ? 'Disponível agora'
        : `Programado para a ${protocolo.semana_inicio}ª semana`,
      emAndamento: semanaGestacional >= protocolo.semana_inicio
    }));

  const realizados = protocolosRealizados.map((protocolo) => ({
    ...protocolo,
    concluidoEm: formatarDataHora(protocolo.concluido_em),
    podeReabrir: semanaGestacional !== null && semanaGestacional <= protocolo.semana_fim,
    realizado: true,
    status: `Realizado em ${formatarDataHora(protocolo.concluido_em)}`
  }));

  const historico = [
    ...realizados,
    ...protocolosAnteriores
      .filter((protocolo) => !protocolosRealizadosIds.has(protocolo.id_protocolo))
      .map((protocolo) => ({
        ...protocolo,
        realizado: false,
        podeReabrir: false,
        status: 'Prazo encerrado'
      }))
  ].sort((primeiro, segundo) => segundo.semana_fim - primeiro.semana_fim);

  res.render('protocolosMedicos', {
    user: req.session.user,
    semanaGestacional,
    agenda,
    historico,
    nomeGestante: gestante.nome,
    error: req.query.erro === 'acao-invalida'
      ? 'Não foi possível atualizar esse exame. Atualize a página e tente novamente.'
      : null,
    success: req.query.sucesso === 'realizado'
      ? 'Exame marcado como realizado.'
      : req.query.sucesso === 'reaberto'
        ? 'Exame movido novamente para os pendentes.'
        : null
  });
};

exports.examesProtocolosAdmin = async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  if (req.session.user.role !== 'admin') {
    return res.status(403).send('Acesso restrito a administradores.');
  }

  return renderGerenciamentoProtocolos(req, res, {
    error: req.query.erro === 'dados-invalidos'
      ? 'Preencha categoria e título e informe uma janela entre 0 e 45 semanas.'
      : req.query.erro === 'nao-encontrado'
        ? 'Esse protocolo não foi encontrado.'
        : req.query.erro === 'salvar'
          ? 'Não foi possível salvar as alterações. Tente novamente.'
          : null,
    success: req.query.sucesso === '1'
      ? 'Protocolo atualizado com sucesso. Você pode desfazer esta alteração agora.'
      : req.query.sucesso === 'desfeito'
        ? 'A última alteração foi desfeita.'
        : null
  });
};

exports.atualizarProtocoloMedicoAdmin = async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  if (req.session.user.role !== 'admin') {
    return res.status(403).send('Acesso restrito a administradores.');
  }

  const idProtocolo = Number(req.params.idProtocolo);
  if (!Number.isInteger(idProtocolo) || idProtocolo <= 0) {
    return res.redirect('/admin/exames-protocolos?erro=nao-encontrado');
  }

  const protocoloAnterior = await getProtocoloMedicoById(idProtocolo);
  if (!protocoloAnterior) {
    return res.redirect('/admin/exames-protocolos?erro=nao-encontrado');
  }

  const resultado = await atualizarProtocoloMedico(idProtocolo, req.body);
  if (!resultado.success) {
    const mensagens = {
      'dados-invalidos': 'Revise os campos indicados para salvar o protocolo.',
      salvar: 'Não foi possível salvar as alterações. Tente novamente.'
    };
    return renderGerenciamentoProtocolos(req, res, {
      status: 400,
      error: mensagens[resultado.error] || 'Não foi possível salvar as alterações.',
      fieldErrors: resultado.fieldErrors || {},
      errorProtocolId: idProtocolo,
      formValues: { ...req.body, idProtocolo }
    });
  }

  req.session.ultimaEdicaoProtocolo = protocoloAnterior;
  return res.redirect('/admin/exames-protocolos?sucesso=1');
};

exports.desfazerAtualizacaoProtocoloAdmin = async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  if (req.session.user.role !== 'admin') {
    return res.status(403).send('Acesso restrito a administradores.');
  }

  const protocoloAnterior = req.session.ultimaEdicaoProtocolo;
  const idProtocolo = Number(req.params.idProtocolo);
  if (!protocoloAnterior || protocoloAnterior.id_protocolo !== idProtocolo) {
    return res.redirect('/admin/exames-protocolos?erro=nao-encontrado');
  }

  const resultado = await atualizarProtocoloMedico(idProtocolo, {
    categoria: protocoloAnterior.categoria,
    titulo: protocoloAnterior.titulo,
    descricao: protocoloAnterior.descricao,
    semanaInicio: protocoloAnterior.semana_inicio,
    semanaFim: protocoloAnterior.semana_fim
  });

  if (!resultado.success) {
    return res.redirect('/admin/exames-protocolos?erro=salvar');
  }

  delete req.session.ultimaEdicaoProtocolo;
  return res.redirect('/admin/exames-protocolos?sucesso=desfeito');
};

exports.ajuda = (req, res) => {
  return res.render('ajuda', { user: req.session.user || null });
};

exports.atualizarConclusaoProtocolo = async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  const idProtocolo = Number(req.params.idProtocolo);
  const acao = req.body.acao;

  if (!Number.isInteger(idProtocolo) || idProtocolo <= 0 || !['concluir', 'reabrir'].includes(acao)) {
    return res.redirect('/protocolos-medicos?erro=acao-invalida');
  }

  const idGestante = req.session.gestanteId;
  const gestante = idGestante
    ? await getGestanteById(idGestante)
    : await getGestanteByUserId(req.session.user.id);

  if (!gestante) {
    return res.redirect('/situacao-gestacao');
  }

  req.session.gestanteId = gestante.id_gestante;

  if (acao === 'concluir') {
    const semanaGestacional = calcularNumeroSemanasGestacao(gestante.dum);
    const protocolosDisponiveis = semanaGestacional === null
      ? []
      : await getProtocolosMedicosPorSemana(semanaGestacional);
    const protocoloDisponivel = protocolosDisponiveis.some((protocolo) => (
      protocolo.id_protocolo === idProtocolo && protocolo.semana_inicio <= semanaGestacional
    ));

    if (!protocoloDisponivel) {
      return res.redirect('/protocolos-medicos?erro=acao-invalida');
    }

    const salvo = await marcarProtocoloComoRealizado(gestante.id_gestante, idProtocolo);
    return res.redirect(salvo
      ? '/protocolos-medicos?sucesso=realizado'
      : '/protocolos-medicos?erro=acao-invalida');
  }

  const semanaGestacional = calcularNumeroSemanasGestacao(gestante.dum);
  const protocolosDisponiveis = semanaGestacional === null
    ? []
    : await getProtocolosMedicosPorSemana(semanaGestacional);
  const protocoloAindaAberto = protocolosDisponiveis.some((protocolo) => (
    protocolo.id_protocolo === idProtocolo && protocolo.semana_inicio <= semanaGestacional
  ));

  if (!protocoloAindaAberto) {
    return res.redirect('/protocolos-medicos?erro=acao-invalida');
  }

  const reaberto = await desmarcarProtocoloComoRealizado(gestante.id_gestante, idProtocolo);
  return res.redirect(reaberto
    ? '/protocolos-medicos?sucesso=reaberto'
    : '/protocolos-medicos?erro=acao-invalida');
};
