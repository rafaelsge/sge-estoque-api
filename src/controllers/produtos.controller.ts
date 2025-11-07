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

    for (const p of produtos) {
      if (!p.cod_loja || !p.codigo || !p.nome || !p.unidade_medida) {
        return res.status(400).json({
          error: 'Campos obrigat車rios: cod_loja, codigo, nome e unidade_medida.',
        });
      }
    }

    // Cria os produtos (sem verificar duplicados)
    const created = await prisma.produto.createMany({
      data: produtos.map(p => ({
        codigo: p.codigo, // c車digo ERP
        cod_loja: p.cod_loja,
        nome: p.nome,
        unidade_medida: p.unidade_medida,
        codigo_barras: p.codigo_barras || null,
      })),
    });

    // Cria EANs adicionais, relacionando via codigo (ERP)
    for (const p of produtos) {
      if (Array.isArray(p.eans) && p.eans.length > 0) {
        await prisma.ean.createMany({
          data: p.eans.map((ean: string) => ({
            cod_loja: p.cod_loja,
            cod_produto: p.codigo, // ?? usa o c車digo do produto (ERP)
            codigo_barras: ean,
          })),
        });
      }
    }

    return res.status(201).json({
      message: 'Produtos cadastrados com sucesso.',
      inseridos: created.count,
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
    const { nome, unidade_medida, codigo_barras } = req.body;

    if (!id) return res.status(400).json({ error: 'ID 谷 obrigat車rio' });

    const produto = await prisma.produto.findUnique({ where: { id } });
    if (!produto) return res.status(404).json({ error: 'Produto n?o encontrado' });

    const atualizado = await prisma.produto.update({
      where: { id },
      data: {
        nome: nome ?? produto.nome,
        unidade_medida: unidade_medida ?? produto.unidade_medida,
        codigo_barras: codigo_barras ?? produto.codigo_barras,
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
