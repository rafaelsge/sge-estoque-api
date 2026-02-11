CREATE TABLE `pedido_restaurante` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cod_loja` INTEGER NOT NULL,
    `cod_usuario` INTEGER NOT NULL,
    `codigo_cartao` VARCHAR(100) NULL,
    `data_hora` DATETIME NOT NULL,
    `origem` VARCHAR(100) NULL,
    `total_itens` INTEGER NOT NULL,
    `total_pedido` DECIMAL(12,2) NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `pedido_restaurante_item` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pedido_id` INTEGER NOT NULL,
    `cod_produto` INTEGER NOT NULL,
    `descricao` VARCHAR(255) NOT NULL,
    `quantidade` DECIMAL(12,3) NOT NULL,
    `pr_venda` DECIMAL(12,2) NOT NULL,
    `pr_custo` DECIMAL(12,2) NOT NULL,
    `subtotal` DECIMAL(12,2) NOT NULL,

    PRIMARY KEY (`id`),
    INDEX `pedido_restaurante_item_pedido_id_idx` (`pedido_id`),
    CONSTRAINT `pedido_restaurante_item_pedido_id_fkey` FOREIGN KEY (`pedido_id`) REFERENCES `pedido_restaurante`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
