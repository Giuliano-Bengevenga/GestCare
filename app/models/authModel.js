const { Pool } = require('pg');

require('dotenv').config();

const usarSsl = process.env.DB_SSL === 'true' || process.env.DB_SSLMODE === 'require' || process.env.PGSSLMODE === 'require';
const configuracaoPool = process.env.DATABASE_URL
  ? {
    connectionString: process.env.DATABASE_URL,
    ssl: usarSsl ? { rejectUnauthorized: false } : undefined
  }
  : {
    host: process.env.DB_HOST || process.env.PGHOST || 'localhost',
    port: Number(process.env.DB_PORT || process.env.PGPORT) || 5432,
    user: process.env.DB_USER || process.env.PGUSER || 'postgres',
    password: process.env.DB_PASSWORD || process.env.PGPASSWORD || '',
    database: process.env.DB_NAME || process.env.PGDATABASE || 'gest_db_wig7',
    ssl: usarSsl ? { rejectUnauthorized: false } : undefined
  };

const pool = new Pool({
  ...configuracaoPool,
  max: 10
});

const QUESTOES_AVALIACAO_RISCO_PADRAO = [
  {
    chave: 'gestacaoMultipla',
    etapa: 1,
    ordem: 1,
    pergunta: 'Você está grávida de gêmeos ou mais bebês?',
    recomendacao: 'Gestação múltipla: mantenha as consultas de pré-natal conforme o intervalo indicado pela equipe e procure atendimento se surgirem contrações, perda de líquido ou sangramento.'
  },
  {
    chave: 'condicoesSaude',
    etapa: 1,
    ordem: 2,
    pergunta: 'Você possui alguma destas condições de saúde?',
    recomendacao: 'Condições crônicas: mantenha o pré-natal em dia e o acompanhamento com a especialidade indicada. Não interrompa medicamentos de uso contínuo sem orientação profissional.'
  },
  {
    chave: 'condicoesAtuais',
    etapa: 1,
    ordem: 3,
    pergunta: 'Durante esta gestação, algum profissional informou que você apresenta uma destas condições?',
    recomendacao: 'Condições na gestação: siga o tratamento e o plano de acompanhamento definidos pela equipe de saúde. Procure atendimento se houver piora dos sintomas ou alguma orientação de urgência.'
  },
  {
    chave: 'complicacoesAnteriores',
    etapa: 1,
    ordem: 4,
    pergunta: 'Você já teve alguma complicação em uma gestação anterior?',
    recomendacao: 'Histórico gestacional: informe à equipe de pré-natal as complicações anteriores e mantenha os exames e retornos recomendados.'
  },
  {
    chave: 'usoSubstancias',
    etapa: 1,
    ordem: 5,
    pergunta: 'Você usa cigarro, bebida alcoólica ou outras drogas durante a gestação?',
    recomendacao: 'Uso de substâncias: procure a equipe de saúde para receber apoio sigiloso e sem julgamento. Evite álcool, cigarro e outras drogas durante a gestação.'
  },
  {
    chave: 'medicamentoSemOrientacao',
    etapa: 1,
    ordem: 6,
    pergunta: 'Você está tomando algum medicamento sem orientação de um profissional de saúde?',
    recomendacao: 'Medicamentos: não inicie, suspenda ou altere doses sem orientação da equipe de saúde. Leve à consulta a lista de todos os remédios, chás e suplementos usados.'
  },
  {
    chave: 'sangramento',
    etapa: 2,
    ordem: 7,
    pergunta: 'Você está apresentando sangramento vaginal?',
    recomendacao: 'Sangramento vaginal: procure imediatamente a maternidade, pronto atendimento ou o serviço de urgência. Não espere a próxima consulta de pré-natal.'
  },
  {
    chave: 'perdaLiquido',
    etapa: 2,
    ordem: 8,
    pergunta: 'Você está com perda de líquido pela vagina, como se a bolsa tivesse rompido?',
    recomendacao: 'Perda de líquido: procure imediatamente a maternidade, pronto atendimento ou o serviço de urgência. Não espere a próxima consulta de pré-natal.'
  },
  {
    chave: 'dorAbdominalForte',
    etapa: 2,
    ordem: 9,
    pergunta: 'Você está sentindo dor forte ou persistente na barriga?',
    recomendacao: 'Dor abdominal forte: procure imediatamente a maternidade, pronto atendimento ou o serviço de urgência. Não espere a próxima consulta de pré-natal.'
  },
  {
    chave: 'sintomasPressaoAlta',
    etapa: 2,
    ordem: 10,
    pergunta: 'Você está com dor de cabeça intensa, visão embaçada, pontos luminosos ou dor forte na parte superior da barriga?',
    recomendacao: 'Sinais de alerta de pressão alta: procure imediatamente a maternidade, pronto atendimento ou o serviço de urgência. Não espere a próxima consulta de pré-natal.'
  },
  {
    chave: 'sintomaGrave',
    etapa: 2,
    ordem: 11,
    pergunta: 'Você teve convulsão, desmaio, falta de ar intensa ou dor no peito?',
    recomendacao: 'Sintoma grave: procure imediatamente a maternidade, pronto atendimento ou o serviço de urgência. Não espere a próxima consulta de pré-natal.'
  },
  {
    chave: 'movimentosReduzidos',
    etapa: 2,
    ordem: 12,
    pergunta: 'Se você já sente o bebê se movimentar, percebeu diminuição ou ausência dos movimentos?',
    recomendacao: 'Movimentos reduzidos do bebê: procure imediatamente a maternidade, pronto atendimento ou o serviço de urgência. Não espere a próxima consulta de pré-natal.'
  },
  {
    chave: 'febre',
    etapa: 2,
    ordem: 13,
    pergunta: 'Você está com febre de 38 °C ou mais?',
    recomendacao: 'Febre: procure imediatamente a maternidade, pronto atendimento ou o serviço de urgência. Não espere a próxima consulta de pré-natal.'
  }
];

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
      classificacao VARCHAR(30) NOT NULL,
      recomendacoes TEXT NOT NULL DEFAULT '[]'
    )`,
    `ALTER TABLE avaliacao_risco
     ADD COLUMN IF NOT EXISTS recomendacoes TEXT NOT NULL DEFAULT '[]'`,
    'CREATE INDEX IF NOT EXISTS idx_avaliacao_risco_gestante ON avaliacao_risco (id_gestante, data_avaliacao)',
    `CREATE TABLE IF NOT EXISTS questionarios_avaliacao_risco (
      id_pergunta SERIAL PRIMARY KEY,
      chave VARCHAR(60) NOT NULL UNIQUE,
      etapa SMALLINT NOT NULL CHECK (etapa IN (1, 2)),
      ordem SMALLINT NOT NULL UNIQUE,
      pergunta TEXT NOT NULL,
      recomendacao TEXT NOT NULL
    )`,
    'CREATE INDEX IF NOT EXISTS idx_questionarios_avaliacao_risco_ordem ON questionarios_avaliacao_risco (ordem)',
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

  for (const questao of QUESTOES_AVALIACAO_RISCO_PADRAO) {
    await pool.query(
      `INSERT INTO questionarios_avaliacao_risco
        (chave, etapa, ordem, pergunta, recomendacao)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (chave) DO NOTHING`,
      [questao.chave, questao.etapa, questao.ordem, questao.pergunta, questao.recomendacao]
    );
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
  pool,
  QUESTOES_AVALIACAO_RISCO_PADRAO
};
