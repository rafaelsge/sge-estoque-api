ALTER TABLE `pedido_restaurante`
  ADD COLUMN `status` INTEGER NOT NULL DEFAULT 0 AFTER `origem`;
