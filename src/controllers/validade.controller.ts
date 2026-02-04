import { Request, Response } from 'express';
import { prisma } from '../prismaClient';

/**
 * Cadastra um ou varios lotes de validade para produtos pereciveis
 */
export async function cadastrarProdutoValidade(req: Request, res: Response) {
  try {
    const body = req.body;
    const lotes = Array.isArray(body) ? body : [body];

    for (const lote of lotes) {
      if (!lote.cod_loja || !lote.cod_produto || !lote.vencimento) {
        return res.status(400).json({
          error: 'Campos obrigatorios: cod_loja, cod_produto e vencimento.',
        });
      }

      const vencimento = new Date(lote.vencimento);
      if (Number.isNaN(vencimento.getTime())) {
        return res.status(400).json({
          error: 'Campo vencimento invalido. Use o formato YYYY-MM-DD.',
        });
      }
    }

    const result = await prisma.produto_validade.createMany({
      data: lotes.map((lote) => ({
        cod_loja: Number(lote.cod_loja),
        cod_produto: Number(lote.cod_produto),
        vencimento: new Date(lote.vencimento),
        ativo: lote.ativo !== undefined ? Number(lote.ativo) : 1,
      })),
    });

    return res.status(201).json({
      message: 'Lotes de validade cadastrados com sucesso.',
      inseridos: result.count,
    });
  } catch (error) {
    console.error('Erro em cadastrarProdutoValidade:', error);
    return res.status(500).json({ error: 'Erro ao cadastrar lotes de validade.' });
  }
}

/**
 * Lista produtos com validade proxima
 * Exemplo: GET /validade/proximos?cod_loja=1&dias=30
 */
export async function listarValidadesProximas(req: Request, res: Response) {
  try {
    const cod_loja = Number(req.query.cod_loja);
    const dias = Number(req.query.dias);

    if (!cod_loja || !dias || dias <= 0) {
      return res.status(400).json({
        error: 'Parametros obrigatorios: cod_loja e dias (maior que 0).',
      });
    }

    const inicio = new Date();
    inicio.setHours(0, 0, 0, 0);
    const fim = new Date(inicio);
    fim.setDate(inicio.getDate() + dias);

    const validades = await prisma.produto_validade.findMany({
      where: {
        cod_loja,
        ativo: 1,
        vencimento: {
          gte: inicio,
          lte: fim,
        },
      },
      include: { produto: true },
      orderBy: { vencimento: 'asc' },
    });

    return res.json({
      total: validades.length,
      data: validades,
    });
  } catch (error) {
    console.error('Erro em listarValidadesProximas:', error);
    return res.status(500).json({ error: 'Erro ao buscar validades proximas.' });
  }
}
