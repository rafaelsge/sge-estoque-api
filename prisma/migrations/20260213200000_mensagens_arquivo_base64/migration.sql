ALTER TABLE `mensagens`
  ADD COLUMN `arquivo_base64` LONGTEXT NULL AFTER `texto`,
  ADD COLUMN `arquivo_mimetype` VARCHAR(120) NULL AFTER `arquivo_base64`;
