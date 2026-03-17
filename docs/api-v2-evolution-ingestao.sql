-- API V2 - Persistencia canonica de mensagens Evolution / WhatsApp
-- Banco alvo: MySQL / InnoDB
-- Objetivo:
-- 1. garantir idempotencia por instance_name + message_id
-- 2. preservar payload bruto de todos os eventos recebidos
-- 3. separar a mensagem canonica da entidade de atendimento
-- 4. suportar duplicados, updates, edicao e delete logico
-- 5. permitir lookup interno por message_id para reply futuro

CREATE TABLE IF NOT EXISTS `mensagens_ingestao` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `cod_loja` INT NULL,
  `instance_name` VARCHAR(100) NOT NULL,
  `message_id` VARCHAR(191) NOT NULL,
  `remote_jid` VARCHAR(255) NULL,
  `chat_jid` VARCHAR(255) NULL,
  `contact_jid` VARCHAR(255) NULL,
  `contact_phone_normalized` VARCHAR(30) NULL,
  `sender_jid` VARCHAR(255) NULL,
  `participant_jid` VARCHAR(255) NULL,
  `attendance_id` INT NULL,
  `contato_id` INT NULL,
  `legacy_mensagem_id` INT NULL,
  `from_me` TINYINT(1) NOT NULL DEFAULT 0,
  `direction` ENUM('entrada', 'saida') NOT NULL DEFAULT 'entrada',
  `message_type` VARCHAR(50) NOT NULL DEFAULT 'desconhecido',
  `message_text` LONGTEXT NULL,
  `caption` LONGTEXT NULL,
  `media_url` LONGTEXT NULL,
  `media_mime_type` VARCHAR(150) NULL,
  `media_file_name` VARCHAR(255) NULL,
  `quoted_message_id` VARCHAR(191) NULL,
  `quoted_message_text` LONGTEXT NULL,
  `quoted_remote_jid` VARCHAR(255) NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'received',
  `message_timestamp` DATETIME(3) NULL,
  `push_name` VARCHAR(255) NULL,
  `payload_raw_json` LONGTEXT NOT NULL,
  `source_event_type` VARCHAR(100) NOT NULL,
  `received_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `processed_at` DATETIME(3) NULL,
  `deleted_at` DATETIME(3) NULL,
  `edited_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_mensagens_ingestao_instance_message` (`instance_name`, `message_id`),
  KEY `idx_mensagens_ingestao_attendance` (`attendance_id`),
  KEY `idx_mensagens_ingestao_remote_jid` (`remote_jid`),
  KEY `idx_mensagens_ingestao_quoted_message_id` (`quoted_message_id`),
  KEY `idx_mensagens_ingestao_cod_loja` (`cod_loja`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `mensagens_ingestao_eventos` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `mensagem_ingestao_id` INT NULL,
  `instance_name` VARCHAR(100) NULL,
  `message_id` VARCHAR(191) NULL,
  `source_event_type` VARCHAR(100) NOT NULL,
  `payload_raw_json` LONGTEXT NOT NULL,
  `received_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `processed_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  KEY `idx_mensagens_ingestao_eventos_ingestao` (`mensagem_ingestao_id`),
  KEY `idx_mensagens_ingestao_eventos_instance_message` (`instance_name`, `message_id`),
  CONSTRAINT `fk_mensagens_ingestao_eventos_ingestao`
    FOREIGN KEY (`mensagem_ingestao_id`) REFERENCES `mensagens_ingestao` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Lookup interno para reply futuro:
-- SELECT *
-- FROM mensagens_ingestao
-- WHERE instance_name = 'NOME_DA_INSTANCIA'
--   AND message_id = 'ID_DA_MENSAGEM';

-- Event log bruto por mensagem:
-- SELECT *
-- FROM mensagens_ingestao_eventos
-- WHERE instance_name = 'NOME_DA_INSTANCIA'
--   AND message_id = 'ID_DA_MENSAGEM'
-- ORDER BY id ASC;

-- Extensao de contato para foto de perfil:
ALTER TABLE `contatos`
  ADD COLUMN `profile_picture_url` LONGTEXT NULL,
  ADD COLUMN `profile_picture_checked_at` DATETIME(3) NULL;
