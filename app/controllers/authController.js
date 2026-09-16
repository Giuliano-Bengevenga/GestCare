const authModel = require('../models/authModel');

exports.showLogin = (req, res) => {
  if (req.session.user) {
    return res.redirect('/');
  }

  res.render('login', {
    error: null,
    user: req.session.user || null
  });
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).render('login', {
      error: 'Informe e-mail e senha.',
      user: null
    });
  }

  try {
    const user = await authModel.authenticateUser(email, password);

    if (!user) {
      return res.status(401).render('login', {
        error: 'Credenciais inválidas.',
        user: null
      });
    }

    req.session.user = user;
    return res.redirect('/');
  } catch (error) {
    console.error(error);
    return res.status(500).render('login', {
      error: 'Erro ao autenticar. Tente novamente.',
      user: null
    });
  }
};

exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
};
