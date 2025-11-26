import { prisma } from '../prismaClient';
import { Request, Response } from 'express';
import crypto from 'crypto'; // para gerar lote seguro

/**
 * 🔄 Rota de sincronização — sempre cria novas leituras (nunca atualiza)
 * Define `sincronizado = false` ao criar.
 */
export async function syncContagens(req: Request, res: Response) {
  try {
    const { cod_loja, cod_usuario, itens } = req.body;

    if (!cod_loja || !cod_usuario || !Array.isArray(itens)) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios: cod_loja, cod_usuario e itens.' });
    }

    const criados: number[] = [];

    for (const item of itens) {
      const { cod_produto, qtde, created_at } = item;

      if (!cod_produto || qtde === undefined) continue;

      const novo = await prisma.contagem.create({
        data: {
          cod_loja,
          cod_usuario,
          cod_produto,
          qtde,
          sincronizado: false, // sempre começa como não sincronizado
          lote: null,          // lote só será gerado pelo ERP
          created_at: created_at ? new Date(created_at) : new Date(),
        },
      });

      criados.push(novo.id);
    }

    return res.json({
      status: 'ok',
      inseridos: criados.length,
      ids: criados,
    });

  } catch (error) {
    console.error('Erro em syncContagens:', error);
    return res.status(500).json({ error: 'Erro ao sincronizar contagens.' });
  }
}

/**
 * 🧾 Rota para o ERP buscar contagens pendentes (sincronizado = false)
 * Agora gera um lote e marca os registros localmente.
 */
export async function listarContagensPendentes(req: Request, res: Response) {
  try {
    const cod_loja = Number(req.query.cod_loja);
    if (!cod_loja) {
      return res.status(400).json({ error: 'Parâmetro cod_loja é obrigatório.' });
    }

    // Busca pendentes
    const pendentes = await prisma.contagem.findMany({
      where: { cod_loja, sincronizado: false },
      orderBy: { created_at: 'asc' },
    });

    if (pendentes.length === 0) {
      return res.json({ total: 0, lote: null, data: [] });
    }

    // 🔹 Gera um lote único
    const lote = crypto.randomUUID();

    // 🔹 Atualiza todas as contagens pendentes com o lote gerado e marca como sincronizado
    await prisma.contagem.updateMany({
      where: {
        id: { in: pendentes.map((p) => p.id) }
      },
      data: {
        lote,
        sincronizado: true,
        updated_at: new Date(),
      },
    });

    // 🔹 Recria objetos com o lote aplicado
    const registrosAtualizados = pendentes.map((p) => ({
      ...p,
      lote,
      sincronizado: true,
    }));

    return res.json({
      total: registrosAtualizados.length,
      lote,
      data: registrosAtualizados,
    });

  } catch (error) {
    console.error('Erro em listarContagensPendentes:', error);
    return res.status(500).json({ error: 'Erro ao listar contagens pendentes.' });
  }
}

/**
 * ☑️ Rota para o ERP confirmar contagens já importadas
 * Exemplo: POST /contagens/marcar-sincronizado
 * Body: { ids: [1, 2, 3] }
 */
export async function marcarContagensSincronizadas(req: Request, res: Response) {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Informe uma lista de IDs para marcar como sincronizados.' });
    }

    const atualizados = await prisma.contagem.updateMany({
      where: { id: { in: ids } },
      data: {
        sincronizado: true,
        updated_at: new Date(),
      },
    });

    return res.json({
      message: 'Contagens atualizadas como sincronizadas.',
      total_atualizadas: atualizados.count,
    });

  } catch (error) {
    console.error('Erro em marcarContagensSincronizadas:', error);
    return res.status(500).json({ error: 'Erro ao atualizar contagens.' });
  }
}
