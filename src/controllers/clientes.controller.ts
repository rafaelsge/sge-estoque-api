import { Request, Response } from 'express';
import { prisma } from '../prismaClient';

export async function buscarPorNome(req: Request, res: Response) {
  try {
    const cod_loja = Number(req.query.cod_loja);
    const q = String(req.query.q ?? '').trim();

    if (!Number.isFinite(cod_loja) || cod_loja <= 0) {
      return res.status(400).json({ error: 'Parametro cod_loja e obrigatorio.' });
    }

    const where: any = { cod_loja };
    if (q) {
      where.nome = { contains: q, mode: 'insensitive' as const };
    }

    const clientes = await prisma.cliente.findMany({
      where,
      orderBy: { nome: 'asc' },
    });

    return res.json({ total: clientes.length, data: clientes });
  } catch (error) {
    console.error('Erro em buscarPorNome:', error);
    return res.status(500).json({ error: 'Erro ao buscar clientes.' });
  }
}
