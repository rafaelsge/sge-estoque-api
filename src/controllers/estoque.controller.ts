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

export async function cadastrarEstoque(req: Request, res: Response) {
  try {
    const body = req.body;
    const registros = Array.isArray(body) ? body : [body];
    const isBatch = Array.isArray(body);

    if (registros.length === 0) {
      return res.status(400).json({ error: 'Nenhum registro de estoque informado.' });
    }

    for (let i = 0; i < registros.length; i++) {
      const e = registros[i];
      const cod_loja = Number(e?.cod_loja);
      const cod_produto = Number(e?.cod_produto);
      const quantidade = Number(e?.quantidade);

      if (!Number.isFinite(cod_loja) || cod_loja <= 0) {
        return res.status(400).json({ error: 'cod_loja deve ser um numero valido.', index: i });
      }
      if (!Number.isFinite(cod_produto) || cod_produto <= 0) {
        return res.status(400).json({ error: 'cod_produto deve ser um numero valido.', index: i });
      }
      if (!Number.isFinite(quantidade)) {
        return res.status(400).json({ error: 'quantidade deve ser numerica.', index: i });
      }
    }

    const codLojas = Array.from(
      new Set(
        registros
          .map((r) => Number(r.cod_loja))
          .filter((n) => Number.isFinite(n) && n > 0),
      ),
    );

    const existentes = codLojas.length
      ? await prisma.estoque.findMany({ where: { cod_loja: { in: codLojas } } })
      : [];

    const existentesMap = new Map<string, (typeof existentes)[number]>();
    const existentesPorLoja = new Map<number, number[]>();

    for (const e of existentes) {
      existentesMap.set(`${e.cod_loja}:${e.cod_produto}`, e);
      if (!existentesPorLoja.has(e.cod_loja)) existentesPorLoja.set(e.cod_loja, []);
      existentesPorLoja.get(e.cod_loja)!.push(e.cod_produto);
    }

    const codigosPorLoja = new Map<number, Set<number>>();
    const createData: any[] = [];
    const updateOps: any[] = [];

    for (const r of registros) {
      const cod_loja = Number(r.cod_loja);
      const cod_produto = Number(r.cod_produto);
      const quantidade = Number(r.quantidade);
      const key = `${cod_loja}:${cod_produto}`;

      let set = codigosPorLoja.get(cod_loja);
      if (!set) {
        set = new Set<number>();
        codigosPorLoja.set(cod_loja, set);
      }
      if (set.has(cod_produto)) {
        return res.status(400).json({
          error: `Estoque duplicado no payload para cod_loja ${cod_loja} e cod_produto ${cod_produto}.`,
        });
      }
      set.add(cod_produto);

      const existente = existentesMap.get(key);
      if (!existente) {
        createData.push({ cod_loja, cod_produto, quantidade });
        continue;
      }

      if (Number(existente.quantidade) !== quantidade) {
        updateOps.push(prisma.estoque.update({ where: { id: existente.id }, data: { quantidade } }));
      }
    }

    const deleteOps: any[] = [];
    let removidos = 0;

    if (isBatch) {
      for (const cod_loja of codLojas) {
        const existentesCodigos = existentesPorLoja.get(cod_loja) ?? [];
        const incoming = codigosPorLoja.get(cod_loja) ?? new Set<number>();
        const toDelete = existentesCodigos.filter((codigo) => !incoming.has(codigo));

        if (toDelete.length > 0) {
          removidos += toDelete.length;
          deleteOps.push(
            prisma.estoque.deleteMany({
              where: { cod_loja, cod_produto: { in: toDelete } },
            }),
          );
        }
      }
    }

    const ops: any[] = [];
    if (createData.length > 0) ops.push(prisma.estoque.createMany({ data: createData }));
    ops.push(...updateOps, ...deleteOps);

    if (ops.length > 0) {
      await prisma.$transaction(ops);
    }

    return res.status(201).json({
      message: 'Estoque processado com sucesso.',
      inseridos: createData.length,
      atualizados: updateOps.length,
      removidos,
    });
  } catch (error) {
    console.error('Erro em cadastrarEstoque:', error);
    return res.status(500).json({ error: 'Erro ao cadastrar estoque.' });
  }
}
