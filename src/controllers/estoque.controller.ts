import { Request, Response } from 'express';
import { prisma } from '../prismaClient';

export async function getEstoqueAtual(req: Request, res: Response) {
  try {
    const cod_loja = Number(req.query.cod_loja);
    const cod_produto = Number(req.query.cod_produto);

    if (
      !Number.isFinite(cod_loja) ||
      cod_loja <= 0 ||
      !Number.isFinite(cod_produto) ||
      cod_produto <= 0
    ) {
      return res.status(400).json({ error: 'Parametros cod_loja e cod_produto sao obrigatorios.' });
    }

    const registro = await prisma.estoque.findUnique({
      where: { cod_loja_cod_produto: { cod_loja, cod_produto } },
    });

    return res.json(
      registro ?? {
        cod_loja,
        cod_produto,
        quantidade: null,
      },
    );
  } catch (error) {
    console.error('Erro em getEstoqueAtual:', error);
    return res.status(500).json({ error: 'Erro ao consultar estoque atual.' });
  }
}

export async function getEstoque(req: Request, res: Response) {
  try {
    const cod_loja = Number(req.query.cod_loja);
    const cod_produto = req.query.cod_produto !== undefined ? Number(req.query.cod_produto) : undefined;

    if (!Number.isFinite(cod_loja) || cod_loja <= 0) {
      return res.status(400).json({ error: 'Parametro cod_loja e obrigatorio.' });
    }

    if (cod_produto !== undefined && (!Number.isFinite(cod_produto) || cod_produto <= 0)) {
      return res.status(400).json({ error: 'Parametro cod_produto invalido.' });
    }

    const where: any = {
      cod_loja,
      ...(cod_produto !== undefined ? { cod_produto } : {}),
    };

    const lista = await prisma.estoque.findMany({
      where,
      orderBy: { cod_produto: 'asc' },
    });

    return res.json({ total: lista.length, data: lista });
  } catch (error) {
    console.error('Erro em getEstoque:', error);
    return res.status(500).json({ error: 'Erro ao listar estoque.' });
  }
}
