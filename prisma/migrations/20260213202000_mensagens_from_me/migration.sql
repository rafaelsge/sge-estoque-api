ALTER TABLE `mensagens`
  ADD COLUMN `from_me` BOOLEAN NOT NULL DEFAULT false AFTER `usuario_id`;
