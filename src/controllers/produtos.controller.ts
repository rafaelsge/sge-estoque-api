import { prisma } from '../prismaClient';
import { Request, Response } from 'express';
import { isBarcode } from '../utils/isBarcode';
import { Prisma } from '@prisma/client';

/*
 * Busca produtos por nome, codigo ERP ou codigo de barras.
 */
export async function searchProduto(req: Request, res: Response) {
  try {
    const cod_loja = Number(req.query.cod_loja);
    const q_raw = String(req.query.q || '').trim();
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const offset = req.query.offset ? Number(req.query.offset) : 0;

    if (!cod_loja) {
      return res.status(400).json({ error: 'Parametro cod_loja e obrigatorio' });
    }

    if (!q_raw) {
      const total = await prisma.produto.count({ where: { cod_loja } });
      const produtos = await prisma.produto.findMany({
        where: { cod_loja },
        orderBy: { nome: 'asc' },
        ...(limit ? { take: limit, skip: offset } : {}),
      });

      return res.json({
        total,
        data: produtos,
        nextOffset: limit && offset + limit < total ? offset + limit : null,
      });
    }

    if (isBarcode(q_raw)) {
      const prodPorCodigo = await prisma.produto.findMany({
        where: { cod_loja, codigo_barras: q_raw },
      });

      if (prodPorCodigo.length > 0) {
        return res.json({ total: prodPorCodigo.length, data: prodPorCodigo });
      }

      const eans = await prisma.ean.findMany({
        where: { cod_loja, codigo_barras: q_raw },
        select: { cod_produto: true },
      });

      const codProdutos = eans.map((e) => e.cod_produto);
      if (codProdutos.length > 0) {
        const prods = await prisma.produto.findMany({
          where: { cod_loja, codigo: { in: codProdutos } },
        });
        return res.json({ total: prods.length, data: prods });
      }
    }

    const maybeNumber = Number(q_raw);
    const where: any = { cod_loja, OR: [] };
    if (!isNaN(maybeNumber)) where.OR.push({ codigo: maybeNumber });
    where.OR.push({ nome: { contains: q_raw, mode: 'insensitive' } });

    const total = await prisma.produto.count({ where });
    const produtos = await prisma.produto.findMany({
      where,
      orderBy: { nome: 'asc' },
      ...(limit ? { take: limit, skip: offset } : {}),
    });

    return res.json({
      total,
      data: produtos,
      nextOffset: limit && offset + limit < total ? offset + limit : null,
    });
  } catch (error) {
    console.error('Erro em searchProduto:', error);
    return res.status(500).json({ error: 'Erro ao buscar produtos' });
  }
}

/*
 * Lista EANs por loja.
 */
export async function listarEans(req: Request, res: Response) {
  try {
    const cod_loja = Number(req.query.cod_loja);
    if (!cod_loja) {
      return res.status(400).json({ error: 'cod_loja e obrigatorio' });
    }

    const eans = await prisma.ean.findMany({ where: { cod_loja } });
    return res.json({ total: eans.length, data: eans });
  } catch (error) {
    console.error('Erro em listarEans:', error);
    return res.status(500).json({ error: 'Erro ao buscar EANs' });
  }
}

/*
 * Cadastra um ou varios produtos.
 */
export async function cadastrarProduto(req: Request, res: Response) {
  try {
    const body = req.body;
    const produtos = Array.isArray(body) ? body : [body];
    const isBatch = Array.isArray(body);

    if (produtos.length === 0) {
      return res.status(400).json({ error: 'Nenhum produto informado.' });
    }

    for (let i = 0; i < produtos.length; i++) {
      const p = produtos[i];
      if (!p.cod_loja || !p.codigo || !p.nome || !p.unidade_medida) {
        return res.status(400).json({
          error: 'Campos obrigatorios: cod_loja, codigo, nome e unidade_medida.',
          index: i,
          registro: p,
        });
      }

      const cod_loja = Number(p.cod_loja);
      const codigo = Number(p.codigo);
      if (!Number.isFinite(cod_loja) || cod_loja <= 0 || !Number.isFinite(codigo) || codigo <= 0) {
        return res.status(400).json({
          error: 'cod_loja e codigo devem ser numeros validos.',
          index: i,
          registro: p,
        });
      }
    }

    const hasOwn = (obj: any, prop: string) => Object.prototype.hasOwnProperty.call(obj, prop);
    const chunkArray = <T>(values: T[], size: number): T[][] => {
      const chunks: T[][] = [];
      for (let i = 0; i < values.length; i += size) {
        chunks.push(values.slice(i, i + size));
      }
      return chunks;
    };

    const codigosPorLoja = new Map<number, Set<number>>();
    const upsertData: Array<{
      codigo: number;
      cod_loja: number;
      nome: string;
      unidade_medida: string;
      codigo_barras: string | null;
      has_codigo_barras: number;
      pr_venda: number | null;
      has_pr_venda: number;
      pr_custo: number | null;
      has_pr_custo: number;
    }> = [];
    const eansPorLojaProduto = new Map<number, Map<number, string[]>>();

    for (const p of produtos) {
      const cod_loja = Number(p.cod_loja);
      const codigo = Number(p.codigo);

      let set = codigosPorLoja.get(cod_loja);
      if (!set) {
        set = new Set<number>();
        codigosPorLoja.set(cod_loja, set);
      }
      if (set.has(codigo)) {
        return res.status(400).json({
          error: `Produto duplicado no payload para cod_loja ${cod_loja} e codigo ${codigo}.`,
        });
      }
      set.add(codigo);

      const nome = String(p.nome);
      const unidade_medida = String(p.unidade_medida);

      const codigo_barras = hasOwn(p, 'codigo_barras')
        ? (p.codigo_barras ? String(p.codigo_barras) : null)
        : undefined;

      const pr_venda = hasOwn(p, 'pr_venda')
        ? (p.pr_venda === null ? null : Number(p.pr_venda))
        : undefined;

      const pr_custo = hasOwn(p, 'pr_custo')
        ? (p.pr_custo === null ? null : Number(p.pr_custo))
        : undefined;

      if (pr_venda !== undefined && pr_venda !== null && !Number.isFinite(pr_venda)) {
        return res.status(400).json({ error: 'Campo pr_venda deve ser um numero valido.' });
      }

      if (pr_custo !== undefined && pr_custo !== null && !Number.isFinite(pr_custo)) {
        return res.status(400).json({ error: 'Campo pr_custo deve ser um numero valido.' });
      }

      upsertData.push({
        codigo,
        cod_loja,
        nome,
        unidade_medida,
        codigo_barras: codigo_barras ?? null,
        has_codigo_barras: codigo_barras !== undefined ? 1 : 0,
        pr_venda: pr_venda !== undefined ? pr_venda : null,
        has_pr_venda: pr_venda !== undefined ? 1 : 0,
        pr_custo: pr_custo !== undefined ? pr_custo : null,
        has_pr_custo: pr_custo !== undefined ? 1 : 0,
      });

      const hasEans = hasOwn(p, 'eans');
      if (hasEans && !Array.isArray(p.eans)) {
        return res.status(400).json({
          error: 'Campo eans deve ser um array quando informado.',
        });
      }

      if (hasEans) {
        const rawEans: any[] = Array.isArray(p.eans) ? p.eans : [];
        const eans: string[] = rawEans
          .map((item: any) => {
            if (typeof item === 'string' || typeof item === 'number') return String(item);
            if (item && typeof item === 'object') {
              if (Object.prototype.hasOwnProperty.call(item, 'barras') && item.barras !== null && item.barras !== undefined) {
                return String(item.barras);
              }
              if (Object.prototype.hasOwnProperty.call(item, 'codigo_barras') && item.codigo_barras !== null && item.codigo_barras !== undefined) {
                return String(item.codigo_barras);
              }
            }
            return '';
          })
          .map((ean: string) => ean.trim())
          .filter((ean: string) => ean.length > 0);

        const uniqueEans: string[] = Array.from(new Set<string>(eans));

        let mapLoja = eansPorLojaProduto.get(cod_loja);
        if (!mapLoja) {
          mapLoja = new Map<number, string[]>();
          eansPorLojaProduto.set(cod_loja, mapLoja);
        }
        mapLoja.set(codigo, uniqueEans);
      }
    }

    const codLojas = Array.from(codigosPorLoja.keys());
    const EAN_DELETE_CHUNK_SIZE = 5000;
    const EAN_INSERT_CHUNK_SIZE = 5000;

    const produtoTableRows = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT TABLE_NAME AS table_name
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND LOWER(TABLE_NAME) = 'produto'
      LIMIT 1
    `;
    const produtoTableName = produtoTableRows[0]?.table_name ?? 'produto';
    const produtoTableIdentifier = Prisma.raw(`\`${produtoTableName.replace(/`/g, '``')}\``);
    const eanTableRows = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT TABLE_NAME AS table_name
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND LOWER(TABLE_NAME) = 'ean'
      LIMIT 1
    `;
    const eanTableName = eanTableRows[0]?.table_name ?? 'ean';
    const eanTableIdentifier = Prisma.raw(`\`${eanTableName.replace(/`/g, '``')}\``);

    const STAGE_TABLE_NAME = 'tmp_produto_stage_sync';
    const stageTableIdentifier = Prisma.raw(`\`${STAGE_TABLE_NAME}\``);
    const PRODUTO_STAGE_INSERT_CHUNK_SIZE = 1000;
    let inseridos = 0;
    let atualizados = 0;
    let removidos = 0;

    if (upsertData.length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`DROP TEMPORARY TABLE IF EXISTS \`${STAGE_TABLE_NAME}\``);
        await tx.$executeRawUnsafe(`
          CREATE TEMPORARY TABLE \`${STAGE_TABLE_NAME}\` (
            \`cod_loja\` INT NOT NULL,
            \`codigo\` INT NOT NULL,
            \`nome\` TEXT NOT NULL,
            \`unidade_medida\` VARCHAR(191) NOT NULL,
            \`codigo_barras\` VARCHAR(255) NULL,
            \`has_codigo_barras\` TINYINT(1) NOT NULL,
            \`pr_venda\` DECIMAL(12,2) NULL,
            \`has_pr_venda\` TINYINT(1) NOT NULL,
            \`pr_custo\` DECIMAL(12,2) NULL,
            \`has_pr_custo\` TINYINT(1) NOT NULL,
            PRIMARY KEY (\`cod_loja\`, \`codigo\`)
          ) ENGINE=InnoDB
        `);

        for (const chunk of chunkArray(upsertData, PRODUTO_STAGE_INSERT_CHUNK_SIZE)) {
          const values = chunk.map((item) => Prisma.sql`(
            ${item.cod_loja},
            ${item.codigo},
            ${item.nome},
            ${item.unidade_medida},
            ${item.codigo_barras},
            ${item.has_codigo_barras},
            ${item.pr_venda},
            ${item.has_pr_venda},
            ${item.pr_custo},
            ${item.has_pr_custo}
          )`);

          await tx.$executeRaw`
            INSERT INTO ${stageTableIdentifier} (
              \`cod_loja\`,
              \`codigo\`,
              \`nome\`,
              \`unidade_medida\`,
              \`codigo_barras\`,
              \`has_codigo_barras\`,
              \`pr_venda\`,
              \`has_pr_venda\`,
              \`pr_custo\`,
              \`has_pr_custo\`
            )
            VALUES ${Prisma.join(values)}
          `;
        }

        const insertedCountRows = await tx.$queryRaw<Array<{ total: bigint | number }>>`
          SELECT COUNT(*) AS total
          FROM ${stageTableIdentifier} s
          LEFT JOIN ${produtoTableIdentifier} p
            ON p.\`cod_loja\` = s.\`cod_loja\`
           AND p.\`codigo\` = s.\`codigo\`
          WHERE p.\`id\` IS NULL
        `;
        inseridos = Number(insertedCountRows[0]?.total ?? 0);

        const updatedCountRows = await tx.$queryRaw<Array<{ total: bigint | number }>>`
          SELECT COUNT(*) AS total
          FROM ${stageTableIdentifier} s
          JOIN ${produtoTableIdentifier} p
            ON p.\`cod_loja\` = s.\`cod_loja\`
           AND p.\`codigo\` = s.\`codigo\`
          WHERE NOT (BINARY p.\`nome\` <=> BINARY s.\`nome\`)
             OR NOT (BINARY p.\`unidade_medida\` <=> BINARY s.\`unidade_medida\`)
             OR NOT (p.\`codigo_barras\` <=> IF(s.\`has_codigo_barras\` = 1, s.\`codigo_barras\`, p.\`codigo_barras\`))
             OR NOT (p.\`pr_venda\` <=> IF(s.\`has_pr_venda\` = 1, s.\`pr_venda\`, p.\`pr_venda\`))
             OR NOT (p.\`pr_custo\` <=> IF(s.\`has_pr_custo\` = 1, s.\`pr_custo\`, p.\`pr_custo\`))
        `;
        atualizados = Number(updatedCountRows[0]?.total ?? 0);

        if (isBatch && codLojas.length > 0) {
          const lojasValues = codLojas.map((cod_loja) => Prisma.sql`${cod_loja}`);
          const removedCountRows = await tx.$queryRaw<Array<{ total: bigint | number }>>`
            SELECT COUNT(*) AS total
            FROM ${produtoTableIdentifier} p
            WHERE p.\`cod_loja\` IN (${Prisma.join(lojasValues)})
              AND NOT EXISTS (
                SELECT 1
                FROM ${stageTableIdentifier} s
                WHERE s.\`cod_loja\` = p.\`cod_loja\`
                  AND s.\`codigo\` = p.\`codigo\`
              )
          `;
          removidos = Number(removedCountRows[0]?.total ?? 0);
        }

        await tx.$executeRaw`
          UPDATE ${produtoTableIdentifier} p
          JOIN ${stageTableIdentifier} s
            ON p.\`cod_loja\` = s.\`cod_loja\`
           AND p.\`codigo\` = s.\`codigo\`
          SET
            p.\`nome\` = s.\`nome\`,
            p.\`unidade_medida\` = s.\`unidade_medida\`,
            p.\`codigo_barras\` = IF(s.\`has_codigo_barras\` = 1, s.\`codigo_barras\`, p.\`codigo_barras\`),
            p.\`pr_venda\` = IF(s.\`has_pr_venda\` = 1, s.\`pr_venda\`, p.\`pr_venda\`),
            p.\`pr_custo\` = IF(s.\`has_pr_custo\` = 1, s.\`pr_custo\`, p.\`pr_custo\`)
          WHERE NOT (BINARY p.\`nome\` <=> BINARY s.\`nome\`)
             OR NOT (BINARY p.\`unidade_medida\` <=> BINARY s.\`unidade_medida\`)
             OR NOT (p.\`codigo_barras\` <=> IF(s.\`has_codigo_barras\` = 1, s.\`codigo_barras\`, p.\`codigo_barras\`))
             OR NOT (p.\`pr_venda\` <=> IF(s.\`has_pr_venda\` = 1, s.\`pr_venda\`, p.\`pr_venda\`))
             OR NOT (p.\`pr_custo\` <=> IF(s.\`has_pr_custo\` = 1, s.\`pr_custo\`, p.\`pr_custo\`))
        `;

        await tx.$executeRaw`
          INSERT INTO ${produtoTableIdentifier} (
            \`codigo\`,
            \`nome\`,
            \`unidade_medida\`,
            \`codigo_barras\`,
            \`cod_loja\`,
            \`pr_venda\`,
            \`pr_custo\`
          )
          SELECT
            s.\`codigo\`,
            s.\`nome\`,
            s.\`unidade_medida\`,
            IF(s.\`has_codigo_barras\` = 1, s.\`codigo_barras\`, NULL),
            s.\`cod_loja\`,
            IF(s.\`has_pr_venda\` = 1, s.\`pr_venda\`, 0),
            IF(s.\`has_pr_custo\` = 1, s.\`pr_custo\`, 0)
          FROM ${stageTableIdentifier} s
          LEFT JOIN ${produtoTableIdentifier} p
            ON p.\`cod_loja\` = s.\`cod_loja\`
           AND p.\`codigo\` = s.\`codigo\`
          WHERE p.\`id\` IS NULL
        `;

        for (const [cod_loja, eansPorProduto] of eansPorLojaProduto) {
          const codigos = Array.from(eansPorProduto.keys());
          const codigosChunks = chunkArray(codigos, EAN_DELETE_CHUNK_SIZE);

          for (const codigosChunk of codigosChunks) {
            await tx.ean.deleteMany({
              where: { cod_loja, cod_produto: { in: codigosChunk } },
            });
          }

          const eansData = Array.from(eansPorProduto.entries()).flatMap(([cod_produto, eans]) =>
            eans.map((codigo_barras) => ({
              cod_loja,
              cod_produto,
              codigo_barras,
            })),
          );

          const eansDataChunks = chunkArray(eansData, EAN_INSERT_CHUNK_SIZE);
          for (const eansDataChunk of eansDataChunks) {
            if (eansDataChunk.length === 0) continue;
            await tx.ean.createMany({ data: eansDataChunk });
          }
        }

        if (isBatch && codLojas.length > 0) {
          const lojasValues = codLojas.map((cod_loja) => Prisma.sql`${cod_loja}`);
          await tx.$executeRaw`
            DELETE e
            FROM ${eanTableIdentifier} e
            LEFT JOIN ${stageTableIdentifier} s
              ON s.\`cod_loja\` = e.\`cod_loja\`
             AND s.\`codigo\` = e.\`cod_produto\`
            WHERE e.\`cod_loja\` IN (${Prisma.join(lojasValues)})
              AND s.\`codigo\` IS NULL
          `;

          await tx.$executeRaw`
            DELETE p
            FROM ${produtoTableIdentifier} p
            LEFT JOIN ${stageTableIdentifier} s
              ON s.\`cod_loja\` = p.\`cod_loja\`
             AND s.\`codigo\` = p.\`codigo\`
            WHERE p.\`cod_loja\` IN (${Prisma.join(lojasValues)})
              AND s.\`codigo\` IS NULL
          `;
        }

        await tx.$executeRawUnsafe(`DROP TEMPORARY TABLE IF EXISTS \`${STAGE_TABLE_NAME}\``);
      });
    }

    return res.status(201).json({
      message: 'Produtos processados com sucesso.',
      inseridos,
      atualizados,
      removidos,
    });
  } catch (error) {
    console.error('Erro em cadastrarProduto:', error);
    return res.status(500).json({ error: 'Erro ao cadastrar produtos.' });
  }
}

/*
 * Atualiza um produto pelo ID interno.
 */
export async function atualizarProduto(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const { nome, unidade_medida, codigo_barras, pr_venda, pr_custo } = req.body;

    if (!id) return res.status(400).json({ error: 'ID e obrigatorio' });

    const produto = await prisma.produto.findUnique({ where: { id } });
    if (!produto) return res.status(404).json({ error: 'Produto nao encontrado' });

    const atualizado = await prisma.produto.update({
      where: { id },
      data: {
        nome: nome ?? produto.nome,
        unidade_medida: unidade_medida ?? produto.unidade_medida,
        codigo_barras: codigo_barras ?? produto.codigo_barras,
        pr_venda: pr_venda ?? produto.pr_venda,
        pr_custo: pr_custo ?? produto.pr_custo,
      },
    });

    return res.json({ message: 'Produto atualizado com sucesso.', produto: atualizado });
  } catch (error) {
    console.error('Erro em atualizarProduto:', error);
    return res.status(500).json({ error: 'Erro ao atualizar produto.' });
  }
}

/*
 * Exclui um produto e seus EANs vinculados.
 */
export async function excluirProduto(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID e obrigatorio' });

    const produto = await prisma.produto.findUnique({ where: { id } });
    if (!produto) return res.status(404).json({ error: 'Produto nao encontrado' });

    await prisma.ean.deleteMany({
      where: { cod_produto: produto.codigo, cod_loja: produto.cod_loja },
    });

    await prisma.produto.delete({ where: { id } });

    return res.json({ message: 'Produto excluido com sucesso.' });
  } catch (error) {
    console.error('Erro em excluirProduto:', error);
    return res.status(500).json({ error: 'Erro ao excluir produto.' });
  }
}
