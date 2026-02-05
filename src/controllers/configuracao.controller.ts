import { prisma } from '../prismaClient';
import { Request, Response } from 'express';

/**
 * Cadastra uma ou varias configuracoes
 */
export async function cadastrarConfiguracao(req: Request, res: Response) {
  try {
    const body = req.body;
    const isArray = Array.isArray(body);
    const configs = isArray ? body : [body];

    for (const c of configs) {
      if (!c.codigo || !c.cod_loja || c.valor === undefined || c.valor === null) {
        return res.status(400).json({
          error: 'Campos obrigatorios: codigo, cod_loja e valor.',
        });
      }
    }

    const result = await prisma.configuracao.createMany({
      data: configs.map((c) => ({
        codigo: Number(c.codigo),
        cod_loja: Number(c.cod_loja),
        nome: c.nome ?? null,
        valor: String(c.valor),
      })),
    });

    return res.status(201).json({
      message: 'Configuracao(oes) cadastrada(s) com sucesso.',
      inseridos: result.count,
    });
  } catch (error) {
    console.error('Erro em cadastrarConfiguracao:', error);
    return res.status(500).json({ error: 'Erro ao cadastrar configuracoes.' });
  }
}

/**
 * Busca uma configuracao pelo codigo e loja e retorna o valor
 * Exemplo: GET /configuracao/buscar?cod_loja=1&codigo=10
 */
export async function buscarConfiguracao(req: Request, res: Response) {
  try {
    const cod_loja = Number(req.query.cod_loja);
    const codigo = Number(req.query.codigo);

    if (!cod_loja || !codigo) {
      return res.status(400).json({
        error: 'Parametros obrigatorios: cod_loja e codigo.',
      });
    }

    const configuracao = await prisma.configuracao.findFirst({
      where: { cod_loja, codigo },
    });

    if (!configuracao) {
      return res.status(404).json({ error: 'Configuracao nao encontrada.' });
    }

    return res.json({ valor: configuracao.valor });
  } catch (error) {
    console.error('Erro em buscarConfiguracao:', error);
    return res.status(500).json({ error: 'Erro ao buscar configuracao.' });
  }
}

/**
 * Atualiza o valor de uma configuracao pelo codigo e loja
 */
export async function atualizarValorConfiguracao(req: Request, res: Response) {
  try {
    const { cod_loja, codigo, valor } = req.body;

    if (!cod_loja || !codigo || valor === undefined || valor === null) {
      return res.status(400).json({
        error: 'Campos obrigatorios: cod_loja, codigo e valor.',
      });
    }

    const configuracao = await prisma.configuracao.findFirst({
      where: { cod_loja: Number(cod_loja), codigo: Number(codigo) },
    });

    if (!configuracao) {
      return res.status(404).json({ error: 'Configuracao nao encontrada.' });
    }

    const atualizado = await prisma.configuracao.update({
      where: { id: configuracao.id },
      data: { valor: String(valor) },
    });

    return res.json({
      message: 'Configuracao atualizada com sucesso.',
      data: atualizado,
    });
  } catch (error) {
    console.error('Erro em atualizarValorConfiguracao:', error);
    return res.status(500).json({ error: 'Erro ao atualizar configuracao.' });
  }
}
