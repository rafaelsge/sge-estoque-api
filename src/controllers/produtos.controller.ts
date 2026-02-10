import { prisma } from '../prismaClient';
import { Request, Response } from 'express';
import { isBarcode } from '../utils/isBarcode';

/**
 * ?? Busca e pesquisa produtos (por nome, c車digo ERP ou c車digo de barras)
 */
export async function searchProduto(req: Request, res: Response) {
  try {
    const cod_loja = Number(req.query.cod_loja);
    const q_raw = String(req.query.q || '').trim();
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const offset = req.query.offset ? Number(req.query.offset) : 0;

    if (!cod_loja) {
      return res.status(400).json({ error: 'Parametro cod_loja 谷 obrigat車rio' });
    }

    // Caso sem busca: retorna todos
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

    // Busca por c車digo de barras (produto ou EAN)
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

      const codProdutos = eans.map(e => e.cod_produto);
      if (codProdutos.length > 0) {
        const prods = await prisma.produto.findMany({
          where: { cod_loja, codigo: { in: codProdutos } },
        });
        return res.json({ total: prods.length, data: prods });
      }
    }

    // Busca por nome ou c車digo ERP
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

/**
 * ?? Lista EANs por loja
 */
export async function listarEans(req: Request, res: Response) {
  try {
    const cod_loja = Number(req.query.cod_loja);
    if (!cod_loja)
      return res.status(400).json({ error: 'cod_loja 谷 obrigat車rio' });

    const eans = await prisma.ean.findMany({ where: { cod_loja } });
    return res.json({ total: eans.length, data: eans });
  } catch (error) {
    console.error('Erro em listarEans:', error);
    return res.status(500).json({ error: 'Erro ao buscar EANs' });
  }
}

/**
 * ? Cadastra um ou v芍rios produtos
 */
export async function cadastrarProduto(req: Request, res: Response) {
  try {
    const body = req.body;
    const produtos = Array.isArray(body) ? body : [body];
    const isBatch = Array.isArray(body);

    if (produtos.length === 0) {
      return res.status(400).json({ error: 'Nenhum produto informado.' });
    }

    for (const p of produtos) {
      if (!p.cod_loja || !p.codigo || !p.nome || !p.unidade_medida) {
        return res.status(400).json({
          error: 'Campos obrigatorios: cod_loja, codigo, nome e unidade_medida.',
        });
      }

      const cod_loja = Number(p.cod_loja);
      const codigo = Number(p.codigo);
      if (!Number.isFinite(cod_loja) || cod_loja <= 0 || !Number.isFinite(codigo) || codigo <= 0) {
        return res.status(400).json({
          error: 'cod_loja e codigo devem ser numeros validos.',
        });
      }
    }

    const hasOwn = (obj: any, prop: string) => Object.prototype.hasOwnProperty.call(obj, prop);

    const codLojas = Array.from(
      new Set(
        produtos
          .map(p => Number(p.cod_loja))
          .filter(n => Number.isFinite(n) && n > 0),
      ),
    );

    const existentes = codLojas.length
      ? await prisma.produto.findMany({ where: { cod_loja: { in: codLojas } } })
      : [];

    const existentesMap = new Map<string, typeof existentes[number]>();
    const existentesPorLoja = new Map<number, number[]>();

    for (const e of existentes) {
      const key = `${e.cod_loja}:${e.codigo}`;
      existentesMap.set(key, e);
      if (!existentesPorLoja.has(e.cod_loja)) existentesPorLoja.set(e.cod_loja, []);
      existentesPorLoja.get(e.cod_loja)!.push(e.codigo);
    }

    const codigosPorLoja = new Map<number, Set<number>>();
    const createData: any[] = [];
    const updateOps: any[] = [];
    const eanOps: any[] = [];

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

      const existing = existentesMap.get(`${cod_loja}:${codigo}`);

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

      if (!existing) {
        const data: any = {
          codigo,
          cod_loja,
          nome,
          unidade_medida,
          codigo_barras: codigo_barras ?? null,
        };
        if (pr_venda !== undefined) data.pr_venda = pr_venda;
        if (pr_custo !== undefined) data.pr_custo = pr_custo;
        createData.push(data);
      } else {
        const data: any = {};
        if (nome !== existing.nome) data.nome = nome;
        if (unidade_medida !== existing.unidade_medida) data.unidade_medida = unidade_medida;

        if (codigo_barras !== undefined) {
          const current = existing.codigo_barras ?? null;
          if (codigo_barras !== current) data.codigo_barras = codigo_barras;
        }

        if (pr_venda !== undefined) {
          const current = existing.pr_venda === null ? null : Number(existing.pr_venda);
          if (pr_venda !== current) data.pr_venda = pr_venda;
        }

        if (pr_custo !== undefined) {
          const current = existing.pr_custo === null ? null : Number(existing.pr_custo);
          if (pr_custo !== current) data.pr_custo = pr_custo;
        }

        if (Object.keys(data).length > 0) {
          updateOps.push(prisma.produto.update({ where: { id: existing.id }, data }));
        }
      }

      if (hasOwn(p, 'eans') && !Array.isArray(p.eans)) {
        return res.status(400).json({
          error: 'Campo eans deve ser um array quando informado.',
        });
      }

      const eans = Array.isArray(p.eans)
        ? p.eans
            .map((ean: any) => String(ean).trim())
            .filter((ean: string) => ean.length > 0)
        : [];
      const uniqueEans = Array.from(new Set(eans));

      eanOps.push(
        prisma.ean.deleteMany({ where: { cod_loja, cod_produto: codigo } }),
      );

      if (uniqueEans.length > 0) {
        eanOps.push(
          prisma.ean.createMany({
            data: uniqueEans.map((ean) => ({
              cod_loja,
              cod_produto: codigo,
              codigo_barras: ean,
            })),
          }),
        );
      }
    }

    const deleteOps: any[] = [];
    let removidos = 0;

    if (isBatch) {
      for (const cod_loja of codLojas) {
        const existentesCodigos = existentesPorLoja.get(cod_loja) ?? [];
        const incoming = codigosPorLoja.get(cod_loja) ?? new Set<number>();
        const toDelete = existentesCodigos.filter((c) => !incoming.has(c));

        if (toDelete.length > 0) {
          removidos += toDelete.length;
          deleteOps.push(
            prisma.ean.deleteMany({
              where: { cod_loja, cod_produto: { in: toDelete } },
            }),
            prisma.produto.deleteMany({
              where: { cod_loja, codigo: { in: toDelete } },
            }),
          );
        }
      }
    }

    const ops: any[] = [];
    if (createData.length > 0) ops.push(prisma.produto.createMany({ data: createData }));
    ops.push(...updateOps, ...eanOps, ...deleteOps);

    if (ops.length > 0) {
      await prisma.$transaction(ops);
    }

    return res.status(201).json({
      message: 'Produtos processados com sucesso.',
      inseridos: createData.length,
      atualizados: updateOps.length,
      removidos,
    });
  } catch (error) {
    console.error('Erro em cadastrarProduto:', error);
    return res.status(500).json({ error: 'Erro ao cadastrar produtos.' });
  }
}
/**
 * ?? Atualiza um produto (busca pelo ID interno)
 */
export async function atualizarProduto(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const { nome, unidade_medida, codigo_barras, pr_venda, pr_custo } = req.body;

    if (!id) return res.status(400).json({ error: 'ID 谷 obrigat車rio' });

    const produto = await prisma.produto.findUnique({ where: { id } });
    if (!produto) return res.status(404).json({ error: 'Produto n?o encontrado' });

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

/**
 * ? Exclui um produto (e EANs relacionados)
 */
export async function excluirProduto(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!id)
      return res.status(400).json({ error: 'ID 谷 obrigat車rio' });

    const produto = await prisma.produto.findUnique({ where: { id } });
    if (!produto)
      return res.status(404).json({ error: 'Produto n?o encontrado' });

    // Exclui EANs com base no c車digo ERP e loja
    await prisma.ean.deleteMany({
      where: { cod_produto: produto.codigo, cod_loja: produto.cod_loja },
    });

    await prisma.produto.delete({ where: { id } });

    return res.json({ message: 'Produto exclu赤do com sucesso.' });
  } catch (error) {
    console.error('Erro em excluirProduto:', error);
    return res.status(500).json({ error: 'Erro ao excluir produto.' });
  }
}
