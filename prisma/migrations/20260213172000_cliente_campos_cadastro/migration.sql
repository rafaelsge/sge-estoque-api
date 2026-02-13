ALTER TABLE `cliente`
  CHANGE COLUMN `documento` `cpf_cnpj` VARCHAR(50) NULL,
  ADD COLUMN `fantasia` VARCHAR(191) NULL AFTER `nome`,
  ADD COLUMN `tipo` VARCHAR(20) NULL AFTER `fantasia`,
  ADD COLUMN `ie` VARCHAR(50) NULL AFTER `cpf_cnpj`,
  ADD COLUMN `endereco` VARCHAR(191) NULL AFTER `ie`,
  ADD COLUMN `numero` VARCHAR(20) NULL AFTER `endereco`,
  ADD COLUMN `bairro` VARCHAR(100) NULL AFTER `numero`,
  ADD COLUMN `cep` VARCHAR(20) NULL AFTER `bairro`,
  ADD COLUMN `cod_municipio` INTEGER NULL AFTER `cep`,
  ADD COLUMN `municipio` VARCHAR(120) NULL AFTER `cod_municipio`,
  ADD COLUMN `complemento` VARCHAR(120) NULL AFTER `municipio`;
