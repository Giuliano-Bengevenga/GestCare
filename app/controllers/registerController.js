const authModel = require('../models/authModel');
const gestanteModel = require('../models/gestanteModel');

function valoresIniciaisAvaliacaoRisco(values = {}) {
  return {
    gestacaoMultipla: '',
    condicoesSaude: [],
    condicoesAtuais: [],
    complicacoesAnteriores: [],
    usoSubstancias: '',
    medicamentoSemOrientacao: '',
    sangramento: '',
    perdaLiquido: '',
    dorAbdominalForte: '',
    sintomasPressaoAlta: '',
    sintomaGrave: '',
    movimentosReduzidos: '',
    febre: '',
    ...values
  };
}

async function getGestanteDaSessao(req) {
  return req.session.gestanteId
    ? gestanteModel.getGestanteById(req.session.gestanteId)
    : gestanteModel.getGestanteByUserId(req.session.user.id);
}

exports.showRegister = (req, res) => {
  if (req.session.user) {
    return res.redirect('/');
  }

  res.render('register', { error: null, success: null });
};

exports.register = async (req, res) => {
  const { name, email, password, confirmPassword } = req.body;

  if (!name || !email || !password || !confirmPassword) {
    return res.status(400).render('register', {
      error: 'Preencha todos os campos.',
      success: null
    });
  }

  if (password !== confirmPassword) {
    return res.status(400).render('register', {
      error: 'As senhas não conferem.',
      success: null
    });
  }

  try {
    const createdUser = await authModel.createUser({ name, email, password, role: 'user' });

    if (!createdUser) {
      return res.status(400).render('register', {
        error: 'Não foi possível cadastrar. Verifique se o e-mail já existe.',
        success: null
      });
    }

    req.session.user = createdUser;
    return res.redirect('/situacao-gestacao');
  } catch (error) {
    console.error(error);
    return res.status(500).render('register', {
      error: 'Erro ao cadastrar usuário.',
      success: null
    });
  }
};

exports.showPregnancyStatus = (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  return res.render('situacaoGestacao', { user: req.session.user });
};

exports.choosePregnancyStatus = (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  if (req.body.situacao === 'gestante') {
    return res.redirect('/dados-gestacao');
  }

  if (req.body.situacao === 'nao-gestante') {
    return res.redirect('/chave-acesso');
  }

  return res.status(400).render('situacaoGestacao', { user: req.session.user });
};

exports.showPregnancyForm = (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  return res.render('dadosGestacao', {
    user: req.session.user,
    error: null,
    values: { nome: req.session.user.name, cpf: '', dataNascimento: '', dum: '' }
  });
};

exports.savePregnancy = async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  const { nome, cpf, dataNascimento, dum } = req.body;
  const result = await gestanteModel.createGestante({
    userId: req.session.user.id,
    nome,
    cpf,
    dataNascimento,
    dum
  });

  if (result.error) {
    return res.status(400).render('dadosGestacao', {
      user: req.session.user,
      error: result.error,
      values: { nome, cpf, dataNascimento, dum }
    });
  }

  req.session.gestanteId = result.gestante.id_gestante;
  return res.status(201).render('gestacaoCriada', {
    user: req.session.user,
    chaveAcesso: result.gestante.chave_acesso
  });
};

exports.showAvaliacaoRisco = async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  const gestante = await getGestanteDaSessao(req);

  if (!gestante) {
    return res.redirect('/situacao-gestacao');
  }

  req.session.gestanteId = gestante.id_gestante;
  return res.render('avaliacaoRisco', {
    user: req.session.user,
    error: null,
    values: valoresIniciaisAvaliacaoRisco()
  });
};

exports.saveAvaliacaoRisco = async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  const gestante = await getGestanteDaSessao(req);

  if (!gestante) {
    return res.redirect('/situacao-gestacao');
  }

  req.session.gestanteId = gestante.id_gestante;
  const result = await gestanteModel.createAvaliacaoRisco(gestante.id_gestante, req.body);

  if (result.error) {
    return res.status(400).render('avaliacaoRisco', {
      user: req.session.user,
      error: result.error,
      values: valoresIniciaisAvaliacaoRisco(req.body)
    });
  }

  return res.redirect('/gestacao?avaliacao=1');
};

exports.showAccessKey = (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  return res.render('chaveAcesso', { user: req.session.user, error: null, chaveAcesso: '' });
};

exports.checkAccessKey = async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  const { chaveAcesso } = req.body;
  const gestante = await gestanteModel.getGestanteByAccessKey(chaveAcesso);

  if (!gestante) {
    return res.status(404).render('chaveAcesso', {
      user: req.session.user,
      error: 'Chave de acesso inválida. Confira e tente novamente.',
      chaveAcesso
    });
  }

  req.session.gestanteId = gestante.id_gestante;
  return res.redirect('/gestacao');
};
