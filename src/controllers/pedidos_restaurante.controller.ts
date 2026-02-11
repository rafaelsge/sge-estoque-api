import { prisma } from '../prismaClient';
import { Request, Response } from 'express';

const STATUS_LIBERADO = 0;
const STATUS_PROCESSADO = 1;
const STATUS_ALTERANDO = 2;
const STATUS_CANCELADO = 3;

const STATUS_VALIDOS = new Set([STATUS_LIBERADO, STATUS_PROCESSADO, STATUS_ALTERANDO, STATUS_CANCELADO]);

export async function cadastrarPedidoRestaurante(req: Request, res: Response) {
  try {
    const { id, cod_loja, cod_usuario, codigo_cartao, data_hora, origem, totais, itens } = req.body;

    if (!cod_loja || !cod_usuario || !data_hora || !origem || !totais || !Array.isArray(itens)) {
      return res.status(400).json({
        error: 'Campos obrigatorios: cod_loja, cod_usuario, data_hora, origem, totais e itens.',
      });
    }

    const idNum = id !== undefined && id !== null ? Number(id) : null;
    if (idNum !== null && (!Number.isFinite(idNum) || idNum <= 0)) {
      return res.status(400).json({ error: 'id deve ser um numero valido.' });
    }

    const codLojaNum = Number(cod_loja);
    const codUsuarioNum = Number(cod_usuario);
    if (!Number.isFinite(codLojaNum) || codLojaNum <= 0 || !Number.isFinite(codUsuarioNum) || codUsuarioNum <= 0) {
      return res.status(400).json({ error: 'cod_loja e cod_usuario devem ser numeros validos.' });
    }

    const dataHora = new Date(data_hora);
    if (Number.isNaN(dataHora.getTime())) {
      return res.status(400).json({ error: 'data_hora invalida. Use formato ISO 8601.' });
    }

    const totalItens = Number(totais?.total_itens);
    const totalPedido = Number(totais?.total_pedido);
    if (!Number.isFinite(totalItens) || totalItens < 0 || !Number.isFinite(totalPedido) || totalPedido < 0) {
      return res.status(400).json({ error: 'totais.total_itens e totais.total_pedido devem ser numeros validos.' });
    }

    if (itens.length === 0) {
      return res.status(400).json({ error: 'Informe pelo menos um item.' });
    }

    const itensData = itens.map((item: any, index: number) => {
      const cod_produto = Number(item?.cod_produto);
      const quantidade = Number(item?.quantidade);
      const pr_venda = Number(item?.pr_venda);
      const pr_custo = Number(item?.pr_custo);
      const subtotal = Number(item?.subtotal);
      const descricao = item?.descricao ? String(item.descricao) : '';

      if (!Number.isFinite(cod_produto) || cod_produto <= 0 || !descricao) {
        throw { index, item, error: 'Item deve ter cod_produto e descricao validos.' };
      }
      if (!Number.isFinite(quantidade) || quantidade <= 0) {
        throw { index, item, error: 'Item.quantidade deve ser um numero valido.' };
      }
      if (!Number.isFinite(pr_venda) || pr_venda < 0) {
        throw { index, item, error: 'Item.pr_venda deve ser um numero valido.' };
      }
      if (!Number.isFinite(pr_custo) || pr_custo < 0) {
        throw { index, item, error: 'Item.pr_custo deve ser um numero valido.' };
      }
      if (!Number.isFinite(subtotal) || subtotal < 0) {
        throw { index, item, error: 'Item.subtotal deve ser um numero valido.' };
      }

      return {
        cod_produto,
        descricao,
        quantidade,
        pr_venda,
        pr_custo,
        subtotal,
      };
    });

    const resultado = await prisma.$transaction(async (tx) => {
      if (idNum !== null) {
        const existente = await tx.pedido_restaurante.findUnique({ where: { id: idNum } });
        if (!existente) {
          throw { status: 404, error: 'Pedido restaurante nao encontrado.' };
        }

        const pedidoAtualizado = await tx.pedido_restaurante.update({
          where: { id: idNum },
          data: {
            cod_loja: codLojaNum,
            cod_usuario: codUsuarioNum,
            codigo_cartao: codigo_cartao ? String(codigo_cartao) : null,
            data_hora: dataHora,
            origem: String(origem),
            total_itens: totalItens,
            total_pedido: totalPedido,
            status: STATUS_LIBERADO,
          },
        });

        await tx.pedido_restaurante_item.deleteMany({ where: { pedido_id: idNum } });
        await tx.pedido_restaurante_item.createMany({
          data: itensData.map((item) => ({
            pedido_id: idNum,
            ...item,
          })),
        });

        return pedidoAtualizado;
      }

      const pedido = await tx.pedido_restaurante.create({
        data: {
          cod_loja: codLojaNum,
          cod_usuario: codUsuarioNum,
          codigo_cartao: codigo_cartao ? String(codigo_cartao) : null,
          data_hora: dataHora,
          origem: String(origem),
          status: STATUS_LIBERADO,
          total_itens: totalItens,
          total_pedido: totalPedido,
        },
      });

      await tx.pedido_restaurante_item.createMany({
        data: itensData.map((item) => ({
          pedido_id: pedido.id,
          ...item,
        })),
      });

      return pedido;
    });

    return res.status(201).json({
      message: idNum ? 'Pedido restaurante atualizado com sucesso.' : 'Pedido restaurante cadastrado com sucesso.',
      id: resultado.id,
      status: STATUS_LIBERADO,
      total_itens: totalItens,
      total_pedido: totalPedido,
    });
  } catch (error: any) {
    if (error?.status === 404) {
      return res.status(404).json({ error: error.error ?? 'Pedido restaurante nao encontrado.' });
    }
    if (error?.index !== undefined) {
      return res.status(400).json({
        error: error.error ?? 'Item invalido.',
        index: error.index,
        registro: error.item,
      });
    }
    console.error('Erro em cadastrarPedidoRestaurante:', error);
    return res.status(500).json({ error: 'Erro ao cadastrar pedido restaurante.' });
  }
}

export async function listarPedidosRestauranteLiberados(req: Request, res: Response) {
  try {
    const cod_loja = Number(req.query.cod_loja);
    if (!cod_loja || !Number.isFinite(cod_loja)) {
      return res.status(400).json({ error: 'Parametro cod_loja e obrigatorio.' });
    }

    const pedidos = await prisma.pedido_restaurante.findMany({
      where: { cod_loja, status: STATUS_LIBERADO },
      include: { itens: true },
      orderBy: { data_hora: 'asc' },
    });

    return res.json({ total: pedidos.length, data: pedidos });
  } catch (error) {
    console.error('Erro em listarPedidosRestauranteLiberados:', error);
    return res.status(500).json({ error: 'Erro ao listar pedidos liberados.' });
  }
}

export async function atualizarStatusPedidoRestaurante(req: Request, res: Response) {
  try {
    const { id, status } = req.body;
    if (!id && id !== 0) {
      return res.status(400).json({ error: 'Campo id e obrigatorio.' });
    }
    if (status === undefined || status === null) {
      return res.status(400).json({ error: 'Campo status e obrigatorio.' });
    }

    const idNum = Number(id);
    const statusNum = Number(status);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      return res.status(400).json({ error: 'id deve ser um numero valido.' });
    }
    if (!Number.isFinite(statusNum) || !STATUS_VALIDOS.has(statusNum)) {
      return res.status(400).json({ error: 'status deve ser 0, 1, 2 ou 3.' });
    }

    const atualizado = await prisma.pedido_restaurante.update({
      where: { id: idNum },
      data: { status: statusNum },
    });

    return res.json({
      message: 'Status do pedido atualizado com sucesso.',
      id: atualizado.id,
      status: atualizado.status,
    });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ error: 'Pedido restaurante nao encontrado.' });
    }
    console.error('Erro em atualizarStatusPedidoRestaurante:', error);
    return res.status(500).json({ error: 'Erro ao atualizar status do pedido.' });
  }
}
