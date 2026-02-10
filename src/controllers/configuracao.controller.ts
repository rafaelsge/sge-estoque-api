import { prisma } from '../prismaClient';
import { Request, Response } from 'express';

/**
 * Cadastra uma ou varias configuracoes
 */
export async function cadastrarConfiguracao(req: Request, res: Response) {
  try {
    const body = req.body;
    const configs = Array.isArray(body) ? body : [body];
    const isBatch = Array.isArray(body);

    if (configs.length === 0) {
      return res.status(400).json({ error: 'Nenhuma configuracao informada.' });
    }

    for (const c of configs) {
      if (!c.codigo || !c.cod_loja || c.valor === undefined || c.valor === null) {
        return res.status(400).json({
          error: 'Campos obrigatorios: codigo, cod_loja e valor.',
        });
      }

      const cod_loja = Number(c.cod_loja);
      const codigo = Number(c.codigo);
      if (!Number.isFinite(cod_loja) || cod_loja <= 0 || !Number.isFinite(codigo) || codigo <= 0) {
        return res.status(400).json({
          error: 'cod_loja e codigo devem ser numeros validos.',
        });
      }
    }

    const codLojas = Array.from(
      new Set(
        configs
          .map((c) => Number(c.cod_loja))
          .filter((n) => Number.isFinite(n) && n > 0),
      ),
    );

    const existentes = codLojas.length
      ? await prisma.configuracao.findMany({ where: { cod_loja: { in: codLojas } } })
      : [];

    const existentesMap = new Map<string, typeof existentes[number]>();
    const existentesPorLoja = new Map<number, number[]>();

    for (const e of existentes) {
      const key = `${e.cod_loja}:${e.codigo}`;
      existentesMap.set(key, e);
      if (!existentesPorLoja.has(e.cod_loja)) existentesPorLoja.set(e.cod_loja, []);
      existentesPorLoja.get(e.cod_loja)!.push(e.codigo);
    }

    const codigosPorLoja = new Map<number, Set<number>>();
    const createData: any[] = [];
    const updateOps: any[] = [];

    const hasOwn = (obj: any, prop: string) => Object.prototype.hasOwnProperty.call(obj, prop);

    for (const c of configs) {
      const cod_loja = Number(c.cod_loja);
      const codigo = Number(c.codigo);
      const nome = hasOwn(c, 'nome') ? (c.nome ?? null) : undefined;
      const valor = String(c.valor);

      let set = codigosPorLoja.get(cod_loja);
      if (!set) {
        set = new Set<number>();
        codigosPorLoja.set(cod_loja, set);
      }
      if (set.has(codigo)) {
        return res.status(400).json({
          error: `Configuracao duplicada no payload para cod_loja ${cod_loja} e codigo ${codigo}.`,
        });
      }
      set.add(codigo);

      const existing = existentesMap.get(`${cod_loja}:${codigo}`);

      if (!existing) {
        createData.push({
          codigo,
          cod_loja,
          nome: nome ?? null,
          valor,
        });
      } else {
        const data: any = {};
        if (valor !== existing.valor) data.valor = valor;
        if (nome !== undefined && nome !== existing.nome) data.nome = nome;

        if (Object.keys(data).length > 0) {
          updateOps.push(prisma.configuracao.update({ where: { id: existing.id }, data }));
        }
      }
    }

    const deleteOps: any[] = [];
    let removidos = 0;

    if (isBatch) {
      for (const cod_loja of codLojas) {
        const existentesCodigos = existentesPorLoja.get(cod_loja) ?? [];
        const incoming = codigosPorLoja.get(cod_loja) ?? new Set<number>();
        const toDelete = existentesCodigos.filter((c) => !incoming.has(c));

        if (toDelete.length > 0) {
          removidos += toDelete.length;
          deleteOps.push(
            prisma.configuracao.deleteMany({
              where: { cod_loja, codigo: { in: toDelete } },
            }),
          );
        }
      }
    }

    const ops: any[] = [];
    if (createData.length > 0) ops.push(prisma.configuracao.createMany({ data: createData }));
    ops.push(...updateOps, ...deleteOps);

    if (ops.length > 0) {
      await prisma.$transaction(ops);
    }

    return res.status(201).json({
      message: 'Configuracoes processadas com sucesso.',
      inseridos: createData.length,
      atualizados: updateOps.length,
      removidos,
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
