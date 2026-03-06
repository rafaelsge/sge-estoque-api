CREATE TABLE `status_fluxo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cod_loja` INTEGER NOT NULL,
    `nome` VARCHAR(100) NOT NULL,
    `cor` VARCHAR(20) NOT NULL,
    `ordem` INTEGER NOT NULL DEFAULT 0,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `status_fluxo_cod_loja_nome_key`(`cod_loja`, `nome`),
    INDEX `status_fluxo_cod_loja_ativo_ordem_idx`(`cod_loja`, `ativo`, `ordem`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `status_fluxo`
    ADD CONSTRAINT `status_fluxo_cod_loja_fkey`
    FOREIGN KEY (`cod_loja`) REFERENCES `loja`(`codigo`) ON DELETE CASCADE ON UPDATE CASCADE;
