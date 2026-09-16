require('dotenv').config();
const express = require('express');
const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');
const path = require('path');
const session = require('express-session');

const indexRoutes = require('./app/routes/index');
const authRoutes = require('./app/routes/authRoutes');
const registerRoutes = require('./app/routes/registerRoutes');
const notFoundMiddleware = require('./app/middlewares/notFound');

const app = express();
const PORT = process.env.PORT || 3000;
// Use 0.0.0.0 by default so devices on the local network can reach the app.
// Set HOST=127.0.0.1 in .env to restrict it to this computer again.
const HOST = process.env.HOST || '0.0.0.0';
const HTTPS_KEY_PATH = path.resolve(
  process.env.HTTPS_KEY_PATH || path.join(__dirname, 'certs', 'gestcare-key.pem')
);
const HTTPS_CERT_PATH = path.resolve(
  process.env.HTTPS_CERT_PATH || path.join(__dirname, 'certs', 'gestcare-cert.pem')
);
const hasHttpsKey = fs.existsSync(HTTPS_KEY_PATH);
const hasHttpsCertificate = fs.existsSync(HTTPS_CERT_PATH);

if (hasHttpsKey !== hasHttpsCertificate) {
  throw new Error('Configure os dois arquivos HTTPS (chave e certificado) ou remova ambos.');
}

const protocol = hasHttpsKey ? 'https' : 'http';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'app', 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'gestante-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 }
}));

app.use('/', authRoutes);
app.use('/', registerRoutes);
app.use('/', indexRoutes);
app.use(notFoundMiddleware);

const server = hasHttpsKey
  ? https.createServer({
    key: fs.readFileSync(HTTPS_KEY_PATH),
    cert: fs.readFileSync(HTTPS_CERT_PATH)
  }, app)
  : http.createServer(app);

server.listen(PORT, HOST, () => {
  const networkAddress = Object.values(os.networkInterfaces())
    .flat()
    .find((network) => network.family === 'IPv4' && !network.internal)?.address;

  console.log(`Servidor rodando localmente em ${protocol}://localhost:${PORT}`);
  console.log(
    networkAddress
      ? `Acesso pela rede local: ${protocol}://${networkAddress}:${PORT}`
      : 'Nenhum endereco IPv4 de rede foi encontrado.'
  );
});
