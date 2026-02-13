ALTER TABLE `loja`
  ADD COLUMN `evolution_url` VARCHAR(255) NULL AFTER `cidade`,
  ADD COLUMN `evolution_instancia` VARCHAR(100) NULL AFTER `evolution_url`,
  ADD COLUMN `evolution_apikey` VARCHAR(255) NULL AFTER `evolution_instancia`;

CREATE UNIQUE INDEX `loja_evolution_apikey_key` ON `loja`(`evolution_apikey`);
