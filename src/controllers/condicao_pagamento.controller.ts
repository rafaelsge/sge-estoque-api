import { Request, Response } from 'express';
import { prisma } from '../prismaClient';

export async function listar(req: Request, res: Response) {
  try {
    const cod_loja = Number(req.query.cod_loja);

    if (!Number.isFinite(cod_loja) || cod_loja <= 0) {
      return res.status(400).json({ error: 'Parametro cod_loja e obrigatorio.' });
    }

    const condicoes = await prisma.condicao_pagamento.findMany({
      where: { cod_loja },
      orderBy: { nome: 'asc' },
    });

    return res.json({ total: condicoes.length, data: condicoes });
  } catch (error) {
    console.error('Erro em listar condicoes de pagamento:', error);
    return res.status(500).json({ error: 'Erro ao listar condicoes de pagamento.' });
  }
}

export async function obter(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: 'Parametro id invalido.' });
    }

    const condicao = await prisma.condicao_pagamento.findUnique({ where: { id } });
    if (!condicao) {
      return res.status(404).json({ error: 'Condicao de pagamento nao encontrada.' });
    }

    return res.json(condicao);
  } catch (error) {
    console.error('Erro em obter condicao de pagamento:', error);
    return res.status(500).json({ error: 'Erro ao buscar condicao de pagamento.' });
  }
}
