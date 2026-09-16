const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gestante_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'gestante_db'}\`
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'user'
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS gestantes (
        id_gestante INT AUTO_INCREMENT PRIMARY KEY,
        id_usuario INT NULL UNIQUE,
        nome VARCHAR(150) NOT NULL,
        cpf VARCHAR(14) UNIQUE NOT NULL,
        data_nascimento DATE NOT NULL,
        dum DATE NULL,
        chave_acesso VARCHAR(32) NOT NULL UNIQUE,
        data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_gestantes_usuarios
          FOREIGN KEY (id_usuario) REFERENCES users(id)
          ON DELETE SET NULL ON UPDATE CASCADE
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS avaliacao_risco (
        id_avaliacao INT AUTO_INCREMENT PRIMARY KEY,
        id_gestante INT NOT NULL,
        data_avaliacao DATETIME DEFAULT CURRENT_TIMESTAMP,
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
        INDEX idx_avaliacao_risco_gestante (id_gestante, data_avaliacao),
        CONSTRAINT fk_avaliacao_risco_gestante
          FOREIGN KEY (id_gestante) REFERENCES gestantes(id_gestante)
          ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS protocolos_medicos (
        id_protocolo INT AUTO_INCREMENT PRIMARY KEY,
        categoria VARCHAR(20) NOT NULL,
        titulo VARCHAR(100) NOT NULL,
        descricao TEXT NULL,
        semana_inicio INT NOT NULL,
        semana_fim INT NOT NULL,
        INDEX idx_protocolos_periodo (semana_inicio, semana_fim)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS acompanhamento_prenatal (
        id_acompanhamento INT AUTO_INCREMENT PRIMARY KEY,
        id_gestante INT NOT NULL,
        data_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
        semanas_gestacao INT NOT NULL,
        peso_atual DECIMAL(5,2) NOT NULL,
        pressao_sistolica INT NOT NULL,
        pressao_diastolica INT NOT NULL,
        pontuacao_risco INT NULL,
        classificacao_risco VARCHAR(50) NULL,
        CONSTRAINT fk_acompanhamento_gestantes
          FOREIGN KEY (id_gestante) REFERENCES gestantes(id_gestante)
          ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS protocolos_realizados (
        id_realizacao INT AUTO_INCREMENT PRIMARY KEY,
        id_gestante INT NOT NULL,
        id_protocolo INT NOT NULL,
        concluido_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_protocolo_realizado (id_gestante, id_protocolo),
        INDEX idx_protocolos_realizados_gestante (id_gestante, concluido_em),
        CONSTRAINT fk_protocolos_realizados_gestante
          FOREIGN KEY (id_gestante) REFERENCES gestantes(id_gestante)
          ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_protocolos_realizados_protocolo
          FOREIGN KEY (id_protocolo) REFERENCES protocolos_medicos(id_protocolo)
          ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);

    // Compatibilidade com bancos criados antes da inclusao da chave de acesso.
    const [gestanteColumns] = await pool.query('SHOW COLUMNS FROM gestantes');
    const columnNames = gestanteColumns.map((column) => column.Field);

    if (!columnNames.includes('id_usuario')) {
      await pool.query('ALTER TABLE gestantes ADD COLUMN id_usuario INT NULL UNIQUE AFTER id_gestante');
    }

    const chaveAcessoColumn = gestanteColumns.find((column) => column.Field === 'chave_acesso');

    if (!chaveAcessoColumn) {
      await pool.query('ALTER TABLE gestantes ADD COLUMN chave_acesso VARCHAR(32) NULL UNIQUE AFTER dum');
    } else if (!String(chaveAcessoColumn.Type).toLowerCase().includes('varchar(32)')) {
      await pool.query('ALTER TABLE gestantes MODIFY COLUMN chave_acesso VARCHAR(32) NULL');
    }

    const avaliacaoColumns = await pool.query('SHOW COLUMNS FROM avaliacao_risco');
    const avaliacaoColumnNames = avaliacaoColumns[0].map((column) => column.Field);
    const avaliacaoColumnsEsperadas = [
      ['gestacao_multipla', 'VARCHAR(15) NOT NULL'],
      ['possui_doenca_cronica', 'TEXT NOT NULL'],
      ['complicacao_atual', 'TEXT NOT NULL'],
      ['complicacao_anterior', 'TEXT NOT NULL'],
      ['uso_substancias', 'VARCHAR(25) NOT NULL'],
      ['medicamento_sem_orientacao', 'VARCHAR(5) NOT NULL'],
      ['sangramento', 'VARCHAR(25) NOT NULL'],
      ['perda_liquido', 'VARCHAR(15) NOT NULL'],
      ['dor_abdominal_forte', 'VARCHAR(5) NOT NULL'],
      ['sintomas_pressao_alta', 'VARCHAR(5) NOT NULL'],
      ['sintoma_grave', 'VARCHAR(5) NOT NULL'],
      ['movimentos_reduzidos', 'VARCHAR(35) NOT NULL'],
      ['febre', 'VARCHAR(25) NOT NULL']
    ];

    for (const [columnName, columnDefinition] of avaliacaoColumnsEsperadas) {
      if (avaliacaoColumnNames.includes(columnName)) {
        await pool.query(`ALTER TABLE avaliacao_risco MODIFY COLUMN ${columnName} ${columnDefinition}`);
      }
    }
  } catch (error) {
    console.warn('Não foi possível inicializar o banco automaticamente:', error.message);
  }
}

initializeDatabase();

async function authenticateUser(email, password) {
  const normalizedEmail = (email || '').trim().toLowerCase();
  const normalizedPassword = (password || '').trim();

  try {
    const [rows] = await pool.query('SELECT id, name, email, role, password FROM users WHERE email = ? LIMIT 1', [normalizedEmail]);

    if (!rows.length) {
      return null;
    }

    const user = rows[0];

    if (String(user.password) !== normalizedPassword) {
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role || 'user'
    };
  } catch (error) {
    console.warn('MySQL indisponível ou tabela de usuários não configurada.');
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

    const [result] = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [normalizedName, normalizedEmail, normalizedPassword, normalizedRole]
    );

    return {
      id: result.insertId,
      name: normalizedName,
      email: normalizedEmail,
      role: normalizedRole
    };
  } catch (error) {
    console.warn('Erro ao criar usuário no banco:', error.message);
    return null;
  }
}

module.exports = {
  authenticateUser,
  createUser,
  initializeDatabase,
  pool
};
