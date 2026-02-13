-- Estrutura manual das tabelas: contatos, atendimentos, mensagens
-- Banco alvo: MySQL / InnoDB
-- Observacao: este script cria FKs apenas entre essas 3 tabelas.

CREATE TABLE IF NOT EXISTS `contatos` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `cod_loja` INT NOT NULL,
  `cliente_codigo` INT NULL,
  `contato` VARCHAR(100) NOT NULL,
  `telefone` VARCHAR(50) NOT NULL,
  `tipo` VARCHAR(20) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_contatos_id_cod_loja` (`id`, `cod_loja`),
  UNIQUE KEY `uk_contatos_loja_telefone` (`cod_loja`, `telefone`),
  KEY `idx_contatos_loja_cliente` (`cod_loja`, `cliente_codigo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `atendimentos` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `cod_loja` INT NOT NULL,
  `contato_id` INT NOT NULL,
  `cliente_codigo` INT NULL,
  `usuario_id` INT NULL,
  `origem` VARCHAR(50) NOT NULL DEFAULT 'whatsapp',
  `status` ENUM('aberto','em_atendimento','finalizado') NOT NULL DEFAULT 'aberto',
  `aberto_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `iniciado_em` DATETIME(3) NULL,
  `finalizado_em` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_atendimentos_id_cod_loja` (`id`, `cod_loja`),
  KEY `idx_atendimentos_loja_status` (`cod_loja`, `status`),
  KEY `idx_atendimentos_loja_contato_status` (`cod_loja`, `contato_id`, `status`),
  KEY `idx_atendimentos_loja_usuario_status` (`cod_loja`, `usuario_id`, `status`),
  CONSTRAINT `fk_atendimentos_contato`
    FOREIGN KEY (`contato_id`, `cod_loja`) REFERENCES `contatos` (`id`, `cod_loja`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `mensagens` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `cod_loja` INT NOT NULL,
  `atendimento_id` INT NOT NULL,
  `contato_id` INT NOT NULL,
  `usuario_id` INT NULL,
  `direcao` ENUM('entrada','saida') NOT NULL,
  `tipo` VARCHAR(30) NOT NULL DEFAULT 'texto',
  `texto` LONGTEXT NULL,
  `payload` JSON NULL,
  `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_mensagens_loja_atendimento` (`cod_loja`, `atendimento_id`),
  KEY `idx_mensagens_loja_contato` (`cod_loja`, `contato_id`),
  KEY `idx_mensagens_loja_criado` (`cod_loja`, `criado_em`),
  CONSTRAINT `fk_mensagens_atendimento`
    FOREIGN KEY (`atendimento_id`, `cod_loja`) REFERENCES `atendimentos` (`id`, `cod_loja`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_mensagens_contato`
    FOREIGN KEY (`contato_id`, `cod_loja`) REFERENCES `contatos` (`id`, `cod_loja`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
