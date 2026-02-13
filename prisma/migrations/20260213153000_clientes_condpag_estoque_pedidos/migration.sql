-- CreateTable
CREATE TABLE `cliente` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cod_loja` INTEGER NOT NULL,
    `codigo` INTEGER NULL,
    `nome` VARCHAR(191) NOT NULL,
    `documento` VARCHAR(50) NULL,
    `telefone` VARCHAR(30) NULL,
    `email` VARCHAR(191) NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `cliente_cod_loja_codigo_key`(`cod_loja`, `codigo`),
    INDEX `cliente_cod_loja_nome_idx`(`cod_loja`, `nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `condicao_pagamento` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cod_loja` INTEGER NOT NULL,
    `codigo` INTEGER NULL,
    `nome` VARCHAR(191) NOT NULL,
    `prazo_dias` INTEGER NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `condicao_pagamento_cod_loja_codigo_key`(`cod_loja`, `codigo`),
    INDEX `condicao_pagamento_cod_loja_nome_idx`(`cod_loja`, `nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `estoque` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cod_loja` INTEGER NOT NULL,
    `cod_produto` INTEGER NOT NULL,
    `quantidade` DECIMAL(12,3) NOT NULL DEFAULT 0.000,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `estoque_cod_loja_cod_produto_key`(`cod_loja`, `cod_produto`),
    INDEX `estoque_cod_loja_idx`(`cod_loja`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pedido` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cod_loja` INTEGER NOT NULL,
    `cod_usuario` INTEGER NULL,
    `cod_cliente` INTEGER NULL,
    `tipo` VARCHAR(50) NULL,
    `cod_cond_pagto` INTEGER NULL,
    `valor_frete` DECIMAL(12,2) NULL DEFAULT 0.00,
    `nome_transportadora` VARCHAR(120) NULL,
    `tipo_frete` VARCHAR(30) NULL,
    `total_itens` INTEGER NULL,
    `total_pedido` DECIMAL(12,2) NOT NULL,
    `observacao` VARCHAR(500) NULL,
    `origem` VARCHAR(100) NULL,
    `status` INTEGER NOT NULL DEFAULT 0,
    `data_hora` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `pedido_cod_loja_data_hora_idx`(`cod_loja`, `data_hora`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pedido_item` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `id_pedido` INTEGER NOT NULL,
    `cod_produto` INTEGER NOT NULL,
    `descricao` VARCHAR(255) NULL,
    `quantidade` DECIMAL(12,3) NOT NULL,
    `pr_venda` DECIMAL(12,2) NULL,
    `pr_custo` DECIMAL(12,2) NULL,
    `subtotal` DECIMAL(12,2) NULL,
    `compl_item` VARCHAR(255) NULL,
    `perc_desconto` DECIMAL(5,2) NULL,
    `vl_desconto` DECIMAL(12,2) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `pedido_item_id_pedido_idx`(`id_pedido`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `pedido_item`
    ADD CONSTRAINT `pedido_item_id_pedido_fkey`
    FOREIGN KEY (`id_pedido`) REFERENCES `pedido`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
