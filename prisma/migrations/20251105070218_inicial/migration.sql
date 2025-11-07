-- CreateTable
CREATE TABLE `Loja` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo` INTEGER NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `cidade` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Loja_codigo_key`(`codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Usuario` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo` INTEGER NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `telefone` VARCHAR(191) NULL,
    `senha_md5` VARCHAR(191) NULL,
    `cod_loja` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Produto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo` INTEGER NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `unidade_medida` VARCHAR(191) NOT NULL,
    `codigo_barras` VARCHAR(191) NULL,
    `cod_loja` INTEGER NOT NULL,

    UNIQUE INDEX `Produto_cod_loja_codigo_key`(`cod_loja`, `codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Ean` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cod_loja` INTEGER NOT NULL,
    `cod_produto` INTEGER NOT NULL,
    `codigo_barras` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Contagem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cod_loja` INTEGER NOT NULL,
    `cod_usuario` INTEGER NOT NULL,
    `cod_produto` INTEGER NOT NULL,
    `qtde` DOUBLE NOT NULL,
    `sincronizado` BOOLEAN NOT NULL DEFAULT false,
    `updated_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TokenRecuperacao` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `id_usuario` INTEGER NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `expira_em` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TokenRecuperacao_token_key`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Usuario` ADD CONSTRAINT `Usuario_cod_loja_fkey` FOREIGN KEY (`cod_loja`) REFERENCES `Loja`(`codigo`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Produto` ADD CONSTRAINT `Produto_cod_loja_fkey` FOREIGN KEY (`cod_loja`) REFERENCES `Loja`(`codigo`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ean` ADD CONSTRAINT `Ean_cod_loja_cod_produto_fkey` FOREIGN KEY (`cod_loja`, `cod_produto`) REFERENCES `Produto`(`cod_loja`, `codigo`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TokenRecuperacao` ADD CONSTRAINT `TokenRecuperacao_id_usuario_fkey` FOREIGN KEY (`id_usuario`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
