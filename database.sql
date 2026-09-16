CREATE DATABASE IF NOT EXISTS gestante_db;
USE gestante_db;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user'
);

INSERT INTO users (name, email, password, role) VALUES
('Administrador', 'admin@gestante.com', 'admin123', 'admin')
ON DUPLICATE KEY UPDATE name=VALUES(name), password=VALUES(password), role=VALUES(role);

CREATE TABLE IF NOT EXISTS gestantes (
    id_gestante INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NULL UNIQUE,
    nome VARCHAR(150) NOT NULL,
    cpf VARCHAR(14) UNIQUE NOT NULL,
    data_nascimento DATE NOT NULL,
    dum DATE, -- Data da Última Menstruação
    chave_acesso VARCHAR(32) NOT NULL UNIQUE,
    data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_gestantes_usuarios
        FOREIGN KEY (id_usuario) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

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
);

CREATE TABLE IF NOT EXISTS protocolos_medicos (
    id_protocolo INT AUTO_INCREMENT PRIMARY KEY,
    categoria VARCHAR(20) NOT NULL,
    titulo VARCHAR(100) NOT NULL,
    descricao TEXT,
    semana_inicio INT NOT NULL,
    semana_fim INT NOT NULL
) ;

CREATE TABLE IF NOT EXISTS acompanhamento_prenatal (
    id_acompanhamento INT AUTO_INCREMENT PRIMARY KEY,
    id_gestante INT NOT NULL,
    data_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    semanas_gestacao INT NOT NULL,
    peso_atual DECIMAL(5,2) NOT NULL,
    pressao_sistolica INT NOT NULL,
    pressao_diastolica INT NOT NULL,
    pontuacao_risco INT,
    classificacao_risco VARCHAR(50),
    CONSTRAINT fk_acompanhamento_gestantes 
        FOREIGN KEY (id_gestante) REFERENCES gestantes(id_gestante) 
        ON DELETE CASCADE ON UPDATE CASCADE
) ;

CREATE TABLE IF NOT EXISTS agenda_gestante (
    id_agenda INT AUTO_INCREMENT PRIMARY KEY,
    id_gestante INT NOT NULL,
    id_protocolo INT NOT NULL,
    realizado CHAR(1) DEFAULT 'N',
    data_realizacao DATE NULL,
    observacao TEXT,
    CONSTRAINT fk_agenda_gestantes 
        FOREIGN KEY (id_gestante) REFERENCES gestantes(id_gestante) 
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_agenda_protocolos 
        FOREIGN KEY (id_protocolo) REFERENCES protocolos_medicos(id_protocolo) 
        ON DELETE CASCADE ON UPDATE CASCADE
) ;
