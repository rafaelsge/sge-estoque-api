import { Request, Response } from 'express';
import { prisma } from '../prismaClient';

type PedidoItemData = {
  cod_produto: number;
  descricao: string | null;
  quantidade: number;
  pr_venda: number | null;
  pr_custo: number | null;
  subtotal: number;
  compl_item: string | null;
  perc_desconto: number | null;
  vl_desconto: number | null;
};

function asNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asPositiveInt(value: unknown): number | null {
  const n = asNumber(value);
  if (n === null || !Number.isInteger(n) || n <= 0) return null;
  return n;
}

export async function receberPedido(req: Request, res: Response) {
  try {
    const cod_loja = asPositiveInt(req.body?.cod_loja);
    const cod_usuario = asPositiveInt(req.body?.cod_usuario);
    const cod_cliente = asPositiveInt(req.body?.cod_cliente);
    const cod_cond_pagto = asPositiveInt(req.body?.cod_cond_pagto);
    const status = asNumber(req.body?.status);

    const itens = Array.isArray(req.body?.itens) ? req.body.itens : null;
    if (!cod_loja || !itens || itens.length === 0) {
      return res.status(400).json({
        error: 'Campos obrigatorios: cod_loja e itens (array com pelo menos 1 item).',
      });
    }

    const dataHora = req.body?.data_hora ? new Date(req.body.data_hora) : new Date();
    if (Number.isNaN(dataHora.getTime())) {
      return res.status(400).json({ error: 'Campo data_hora invalido.' });
    }

    const itensData: PedidoItemData[] = itens.map((item: any, index: number) => {
      const cod_produto = asPositiveInt(item?.cod_produto);
      const quantidade = asNumber(item?.quantidade);
      const pr_venda = asNumber(item?.pr_venda);
      const pr_custo = asNumber(item?.pr_custo);
      const subtotalBody = asNumber(item?.subtotal);
      const perc_desconto = asNumber(item?.perc_desconto);
      const vl_desconto = asNumber(item?.vl_desconto);

      if (!cod_produto || quantidade === null || quantidade <= 0) {
        throw {
          status: 400,
          index,
          error: 'Cada item deve ter cod_produto e quantidade validos.',
        };
      }

      const subtotalCalculado = subtotalBody ?? (pr_venda !== null ? quantidade * pr_venda : null);
      if (subtotalCalculado === null || subtotalCalculado < 0) {
        throw {
          status: 400,
          index,
          error: 'Cada item deve ter subtotal valido (ou pr_venda para calculo).',
        };
      }

      return {
        cod_produto,
        descricao: item?.descricao ? String(item.descricao) : null,
        quantidade,
        pr_venda,
        pr_custo,
        subtotal: subtotalCalculado,
        compl_item: item?.compl_item ? String(item.compl_item) : null,
        perc_desconto,
        vl_desconto,
      };
    });

    const totalPedidoCalculado = itensData.reduce((acc: number, item: PedidoItemData) => acc + Number(item.subtotal), 0);
    const total_pedido = asNumber(req.body?.total_pedido) ?? totalPedidoCalculado;
    if (total_pedido < 0) {
      return res.status(400).json({ error: 'Campo total_pedido invalido.' });
    }

    const total_itens = asPositiveInt(req.body?.total_itens) ?? itensData.length;

    const pedido = await prisma.$transaction(async (tx) => {
      const novoPedido = await tx.pedido.create({
        data: {
          cod_loja,
          cod_usuario,
          cod_cliente,
          tipo: req.body?.tipo ? String(req.body.tipo) : null,
          cod_cond_pagto,
          valor_frete: asNumber(req.body?.valor_frete),
          nome_transportadora: req.body?.nome_transportadora ? String(req.body.nome_transportadora) : null,
          tipo_frete: req.body?.tipo_frete ? String(req.body.tipo_frete) : null,
          total_itens,
          total_pedido,
          observacao: req.body?.observacao ? String(req.body.observacao) : null,
          origem: req.body?.origem ? String(req.body.origem) : null,
          status: status !== null ? Number(status) : 0,
          data_hora: dataHora,
        },
      });

      await tx.pedido_item.createMany({
        data: itensData.map((item: PedidoItemData) => ({
          id_pedido: novoPedido.id,
          ...item,
        })),
      });

      return novoPedido;
    });

    return res.status(201).json({
      mensagem: 'Pedido registrado',
      id_local: pedido.id,
    });
  } catch (error: any) {
    if (error?.status === 400) {
      return res.status(400).json({
        error: error.error ?? 'Payload invalido.',
        index: error.index,
      });
    }
    console.error('Erro em receberPedido:', error);
    return res.status(500).json({ error: 'Erro ao registrar pedido.' });
  }
}
