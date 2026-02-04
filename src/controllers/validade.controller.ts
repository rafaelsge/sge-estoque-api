import { Request, Response } from 'express';
import { prisma } from '../prismaClient';

/**
 * Cadastra um ou varios lotes de validade para produtos pereciveis
 */
export async function cadastrarProdutoValidade(req: Request, res: Response) {
  try {
    const body = req.body;
    const isArray = Array.isArray(body);
    const lotes = isArray ? body : [body];

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

    const created = await prisma.$transaction(
      lotes.map((lote) =>
        prisma.produto_validade.create({
          data: {
            cod_loja: Number(lote.cod_loja),
            cod_produto: Number(lote.cod_produto),
            vencimento: new Date(lote.vencimento),
            ativo: lote.ativo !== undefined ? Number(lote.ativo) : 1,
          },
        }),
      ),
    );

    return res.status(201).json(isArray ? created : created[0]);
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
    const codProdutoRaw = req.query.cod_produto;
    const diasRaw = req.query.dias;

    if (!cod_loja) {
      return res.status(400).json({
        error: 'Parametro obrigatorio: cod_loja.',
      });
    }

    let cod_produto: number | undefined;
    if (codProdutoRaw !== undefined && codProdutoRaw !== null && String(codProdutoRaw).trim() !== '') {
      const parsed = Number(codProdutoRaw);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return res.status(400).json({
          error: 'Parametro cod_produto deve ser um numero valido.',
        });
      }
      cod_produto = parsed;
    }

    let vencimentoFiltro: { gte: Date; lte: Date } | undefined;
    if (diasRaw !== undefined && diasRaw !== null && String(diasRaw).trim() !== '') {
      const dias = Number(diasRaw);
      if (!Number.isFinite(dias) || dias <= 0) {
        return res.status(400).json({
          error: 'Parametro dias deve ser maior que 0.',
        });
      }

      const inicio = new Date();
      inicio.setHours(0, 0, 0, 0);
      const fim = new Date(inicio);
      fim.setDate(inicio.getDate() + dias);
      vencimentoFiltro = { gte: inicio, lte: fim };
    }

    const validades = await prisma.produto_validade.findMany({
      where: {
        cod_loja,
        ...(cod_produto ? { cod_produto } : {}),
        ativo: 1,
        ...(vencimentoFiltro ? { vencimento: vencimentoFiltro } : {}),
      },
      select: {
        id: true,
        cod_produto: true,
        cod_loja: true,
        vencimento: true,
        ativo: true,
      },
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

/**
 * Inativa um lote de validade pelo ID
 */
export async function inativarValidade(req: Request, res: Response) {
  try {
    const id = Number(req.body?.id ?? req.params?.id);

    if (!id) {
      return res.status(400).json({ error: 'Parametro obrigatorio: id.' });
    }

    const atualizado = await prisma.produto_validade.update({
      where: { id },
      data: { ativo: 0 },
    });

    return res.json({
      message: 'Lote inativado com sucesso.',
      data: atualizado,
    });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ error: 'Lote nao encontrado.' });
    }
    console.error('Erro em inativarValidade:', error);
    return res.status(500).json({ error: 'Erro ao inativar lote de validade.' });
  }
}
