const authModel = require('../models/authModel');

function loginValues(email = '') {
  return { email: String(email || '').trim() };
}

exports.showLogin = (req, res) => {
  if (req.session.user) {
    return res.redirect('/');
  }

  res.render('login', {
    error: null,
    user: req.session.user || null,
    values: loginValues(),
    fieldErrors: {}
  });
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const values = loginValues(email);

  if (!email || !password) {
    return res.status(400).render('login', {
      error: 'Informe e-mail e senha.',
      user: null,
      values,
      fieldErrors: {
        ...(!email ? { email: 'Informe o e-mail.' } : {}),
        ...(!password ? { password: 'Informe a senha.' } : {})
      }
    });
  }

  try {
    const user = await authModel.authenticateUser(email, password);

    if (!user) {
      return res.status(401).render('login', {
        error: 'Credenciais inválidas.',
        user: null,
        values,
        fieldErrors: {}
      });
    }

    req.session.user = user;
    return res.redirect('/');
  } catch (error) {
    console.error(error);
    return res.status(500).render('login', {
      error: 'Erro ao autenticar. Tente novamente.',
      user: null,
      values,
      fieldErrors: {}
    });
  }
};

exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
};
