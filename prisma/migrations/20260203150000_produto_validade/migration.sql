-- CreateTable
CREATE TABLE `produto_validade` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cod_produto` INTEGER NOT NULL,
    `cod_loja` INTEGER NOT NULL,
    `vencimento` DATE NOT NULL,
    `ativo` INTEGER NOT NULL DEFAULT 1,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `produto_validade` ADD CONSTRAINT `produto_validade_cod_loja_cod_produto_fkey` FOREIGN KEY (`cod_loja`, `cod_produto`) REFERENCES `Produto`(`cod_loja`, `codigo`) ON DELETE RESTRICT ON UPDATE CASCADE;
