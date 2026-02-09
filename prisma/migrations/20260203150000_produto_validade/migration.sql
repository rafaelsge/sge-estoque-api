-- CreateTable
CREATE TABLE `produto_validade` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cod_produto` INTEGER NOT NULL,
    `cod_loja` INTEGER NOT NULL,
    `vencimento` DATE NOT NULL,
    `ativo` INTEGER NOT NULL DEFAULT 1,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


CREATE TABLE `configuracao` (  
  `id` INT NOT NULL AUTO_INCREMENT,
  `codigo` INT NOT NULL,
  `cod_loja` INT,
  `nome` VARCHAR(150),
  `valor` VARCHAR(250),
  PRIMARY KEY (`id`) 
);


ALTER TABLE `produto`   
	ADD COLUMN `pr_venda` DECIMAL(12,2) DEFAULT 0.00 NULL AFTER `cod_loja`,
	ADD COLUMN `pr_custo` DECIMAL(12,2) DEFAULT 0.00 NULL AFTER `pr_venda`;
