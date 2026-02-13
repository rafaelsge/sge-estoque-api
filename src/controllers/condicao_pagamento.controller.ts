import { Request, Response } from 'express';
import { prisma } from '../prismaClient';

function hasOwn(obj: unknown, prop: string): boolean {
  return !!obj && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, prop);
}

function parseBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  return null;
}

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

export async function cadastrarCondicaoPagamento(req: Request, res: Response) {
  try {
    const body = req.body;
    const registros = Array.isArray(body) ? body : [body];
    const isBatch = Array.isArray(body);

    if (registros.length === 0) {
      return res.status(400).json({ error: 'Nenhuma condicao de pagamento informada.' });
    }

    for (let i = 0; i < registros.length; i++) {
      const c = registros[i];
      const cod_loja = Number(c?.cod_loja);
      const codigo = Number(c?.codigo);
      const nome = String(c?.nome ?? '').trim();

      if (!Number.isFinite(cod_loja) || cod_loja <= 0) {
        return res.status(400).json({ error: 'cod_loja deve ser um numero valido.', index: i });
      }
      if (!Number.isFinite(codigo) || codigo <= 0) {
        return res.status(400).json({ error: 'codigo deve ser um numero valido.', index: i });
      }
      if (!nome) {
        return res.status(400).json({ error: 'nome e obrigatorio.', index: i });
      }
      if (hasOwn(c, 'ativo')) {
        const ativo = parseBoolean(c.ativo);
        if (ativo === null) {
          return res.status(400).json({ error: 'ativo deve ser booleano.', index: i });
        }
      }
      if (hasOwn(c, 'prazo_dias')) {
        const prazo = Number(c.prazo_dias);
        if (!Number.isInteger(prazo) || prazo < 0) {
          return res.status(400).json({ error: 'prazo_dias deve ser inteiro >= 0.', index: i });
        }
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
      ? await prisma.condicao_pagamento.findMany({ where: { cod_loja: { in: codLojas } } })
      : [];

    const existentesMap = new Map<string, (typeof existentes)[number]>();
    const existentesPorLoja = new Map<number, number[]>();

    for (const e of existentes) {
      if (e.codigo === null) continue;
      existentesMap.set(`${e.cod_loja}:${e.codigo}`, e);
      if (!existentesPorLoja.has(e.cod_loja)) existentesPorLoja.set(e.cod_loja, []);
      existentesPorLoja.get(e.cod_loja)!.push(e.codigo);
    }

    const codigosPorLoja = new Map<number, Set<number>>();
    const createData: any[] = [];
    const updateOps: any[] = [];

    for (const c of registros) {
      const cod_loja = Number(c.cod_loja);
      const codigo = Number(c.codigo);
      const nome = String(c.nome).trim();
      const prazo_dias = hasOwn(c, 'prazo_dias') ? Number(c.prazo_dias) : undefined;
      const ativoInformado = hasOwn(c, 'ativo') ? parseBoolean(c.ativo) : null;
      const ativo = ativoInformado ?? true;
      const key = `${cod_loja}:${codigo}`;

      let set = codigosPorLoja.get(cod_loja);
      if (!set) {
        set = new Set<number>();
        codigosPorLoja.set(cod_loja, set);
      }
      if (set.has(codigo)) {
        return res.status(400).json({
          error: `Condicao duplicada no payload para cod_loja ${cod_loja} e codigo ${codigo}.`,
        });
      }
      set.add(codigo);

      const existente = existentesMap.get(key);
      if (!existente) {
        const data: any = { cod_loja, codigo, nome, ativo };
        if (prazo_dias !== undefined) data.prazo_dias = prazo_dias;
        createData.push(data);
        continue;
      }

      const data: any = {};
      if (nome !== existente.nome) data.nome = nome;
      if (hasOwn(c, 'ativo') && ativo !== existente.ativo) data.ativo = ativo;
      if (prazo_dias !== undefined && prazo_dias !== existente.prazo_dias) data.prazo_dias = prazo_dias;

      if (Object.keys(data).length > 0) {
        updateOps.push(prisma.condicao_pagamento.update({ where: { id: existente.id }, data }));
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
            prisma.condicao_pagamento.deleteMany({
              where: { cod_loja, codigo: { in: toDelete } },
            }),
          );
        }
      }
    }

    const ops: any[] = [];
    if (createData.length > 0) ops.push(prisma.condicao_pagamento.createMany({ data: createData }));
    ops.push(...updateOps, ...deleteOps);

    if (ops.length > 0) {
      await prisma.$transaction(ops);
    }

    return res.status(201).json({
      message: 'Condicoes de pagamento processadas com sucesso.',
      inseridos: createData.length,
      atualizados: updateOps.length,
      removidos,
    });
  } catch (error) {
    console.error('Erro em cadastrarCondicaoPagamento:', error);
    return res.status(500).json({ error: 'Erro ao cadastrar condicoes de pagamento.' });
  }
}
