const { Pool } = require('pg');

require('dotenv').config();

const usarSsl = process.env.DB_SSL === 'true' || process.env.DB_SSLMODE === 'require';
const configuracaoPool = process.env.DATABASE_URL
  ? {
    connectionString: process.env.DATABASE_URL,
    ssl: usarSsl ? { rejectUnauthorized: false } : undefined
  }
  : {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gestante_db',
    ssl: usarSsl ? { rejectUnauthorized: false } : undefined
  };

const pool = new Pool({
  ...configuracaoPool,
  max: 10
});

let inicializacaoEmAndamento = null;

async function criarEstrutura() {
  const comandos = [
    `CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'user'
    )`,
    `CREATE TABLE IF NOT EXISTS gestantes (
      id_gestante SERIAL PRIMARY KEY,
      id_usuario INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
      nome VARCHAR(150) NOT NULL,
      cpf VARCHAR(14) NOT NULL UNIQUE,
      data_nascimento DATE NOT NULL,
      dum DATE,
      chave_acesso VARCHAR(32) NOT NULL UNIQUE,
      data_cadastro TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS avaliacao_risco (
      id_avaliacao SERIAL PRIMARY KEY,
      id_gestante INTEGER NOT NULL REFERENCES gestantes(id_gestante) ON DELETE CASCADE ON UPDATE CASCADE,
      data_avaliacao TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      gestacao_multipla VARCHAR(15) NOT NULL,
      possui_doenca_cronica TEXT NOT NULL,
      complicacao_atual TEXT NOT NULL,
      complicacao_anterior TEXT NOT NULL,
      uso_substancias VARCHAR(25) NOT NULL,
      medicamento_sem_orientacao VARCHAR(5) NOT NULL,
      sangramento VARCHAR(25) NOT NULL,
      perda_liquido VARCHAR(15) NOT NULL,
      dor_abdominal_forte VARCHAR(5) NOT NULL,
      sintomas_pressao_alta VARCHAR(5) NOT NULL,
      sintoma_grave VARCHAR(5) NOT NULL,
      movimentos_reduzidos VARCHAR(35) NOT NULL,
      febre VARCHAR(25) NOT NULL,
      classificacao VARCHAR(30) NOT NULL
    )`,
    'CREATE INDEX IF NOT EXISTS idx_avaliacao_risco_gestante ON avaliacao_risco (id_gestante, data_avaliacao)',
    `CREATE TABLE IF NOT EXISTS protocolos_medicos (
      id_protocolo SERIAL PRIMARY KEY,
      categoria VARCHAR(20) NOT NULL,
      titulo VARCHAR(100) NOT NULL,
      descricao TEXT,
      semana_inicio INTEGER NOT NULL,
      semana_fim INTEGER NOT NULL
    )`,
    'CREATE INDEX IF NOT EXISTS idx_protocolos_periodo ON protocolos_medicos (semana_inicio, semana_fim)',
    `CREATE TABLE IF NOT EXISTS acompanhamento_prenatal (
      id_acompanhamento SERIAL PRIMARY KEY,
      id_gestante INTEGER NOT NULL REFERENCES gestantes(id_gestante) ON DELETE CASCADE ON UPDATE CASCADE,
      data_registro TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      semanas_gestacao INTEGER NOT NULL,
      peso_atual NUMERIC(5, 2) NOT NULL,
      pressao_sistolica INTEGER NOT NULL,
      pressao_diastolica INTEGER NOT NULL,
      pontuacao_risco INTEGER,
      classificacao_risco VARCHAR(50)
    )`,
    `CREATE TABLE IF NOT EXISTS protocolos_realizados (
      id_realizacao SERIAL PRIMARY KEY,
      id_gestante INTEGER NOT NULL REFERENCES gestantes(id_gestante) ON DELETE CASCADE ON UPDATE CASCADE,
      id_protocolo INTEGER NOT NULL REFERENCES protocolos_medicos(id_protocolo) ON DELETE CASCADE ON UPDATE CASCADE,
      concluido_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (id_gestante, id_protocolo)
    )`,
    'CREATE INDEX IF NOT EXISTS idx_protocolos_realizados_gestante ON protocolos_realizados (id_gestante, concluido_em)'
  ];

  for (const comando of comandos) {
    await pool.query(comando);
  }
}

async function initializeDatabase() {
  if (!inicializacaoEmAndamento) {
    inicializacaoEmAndamento = criarEstrutura().catch((error) => {
      inicializacaoEmAndamento = null;
      console.warn('Nao foi possivel inicializar o PostgreSQL:', error.message);
    });
  }

  return inicializacaoEmAndamento;
}

void initializeDatabase();

async function authenticateUser(email, password) {
  const normalizedEmail = (email || '').trim().toLowerCase();
  const normalizedPassword = (password || '').trim();

  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, role, password FROM users WHERE email = $1 LIMIT 1',
      [normalizedEmail]
    );

    if (!rows.length || String(rows[0].password) !== normalizedPassword) {
      return null;
    }

    const user = rows[0];
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role || 'user'
    };
  } catch (error) {
    console.warn('PostgreSQL indisponivel ou tabela de usuarios nao configurada.');
    return null;
  }
}

async function createUser({ name, email, password, role }) {
  const normalizedName = (name || '').trim();
  const normalizedEmail = (email || '').trim().toLowerCase();
  const normalizedPassword = (password || '').trim();
  const normalizedRole = role || 'user';

  try {
    await initializeDatabase();
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role`,
      [normalizedName, normalizedEmail, normalizedPassword, normalizedRole]
    );

    return rows[0];
  } catch (error) {
    console.warn('Erro ao criar usuario no PostgreSQL:', error.message);
    return null;
  }
}

module.exports = {
  authenticateUser,
  createUser,
  initializeDatabase,
  pool
};
