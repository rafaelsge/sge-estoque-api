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

export async function cadastrarCliente(req: Request, res: Response) {
  try {
    const body = req.body;
    const clientes = Array.isArray(body) ? body : [body];
    const isBatch = Array.isArray(body);

    if (clientes.length === 0) {
      return res.status(400).json({ error: 'Nenhum cliente informado.' });
    }

    for (let i = 0; i < clientes.length; i++) {
      const c = clientes[i];
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
    }

    const codLojas = Array.from(
      new Set(
        clientes
          .map((c) => Number(c.cod_loja))
          .filter((n) => Number.isFinite(n) && n > 0),
      ),
    );

    const existentes = codLojas.length
      ? await prisma.cliente.findMany({ where: { cod_loja: { in: codLojas } } })
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

    for (const c of clientes) {
      const cod_loja = Number(c.cod_loja);
      const codigo = Number(c.codigo);
      const nome = String(c.nome).trim();
      const key = `${cod_loja}:${codigo}`;

      let set = codigosPorLoja.get(cod_loja);
      if (!set) {
        set = new Set<number>();
        codigosPorLoja.set(cod_loja, set);
      }
      if (set.has(codigo)) {
        return res.status(400).json({
          error: `Cliente duplicado no payload para cod_loja ${cod_loja} e codigo ${codigo}.`,
        });
      }
      set.add(codigo);

      const ativoInformado = hasOwn(c, 'ativo') ? parseBoolean(c.ativo) : null;
      const ativo = ativoInformado ?? true;
      const documento = hasOwn(c, 'documento') ? (c.documento ? String(c.documento) : null) : undefined;
      const telefone = hasOwn(c, 'telefone') ? (c.telefone ? String(c.telefone) : null) : undefined;
      const email = hasOwn(c, 'email') ? (c.email ? String(c.email) : null) : undefined;

      const existente = existentesMap.get(key);
      if (!existente) {
        const data: any = {
          cod_loja,
          codigo,
          nome,
          ativo,
        };
        if (documento !== undefined) data.documento = documento;
        if (telefone !== undefined) data.telefone = telefone;
        if (email !== undefined) data.email = email;
        createData.push(data);
        continue;
      }

      const data: any = {};
      if (nome !== existente.nome) data.nome = nome;
      if (hasOwn(c, 'ativo') && ativo !== existente.ativo) data.ativo = ativo;
      if (documento !== undefined && documento !== existente.documento) data.documento = documento;
      if (telefone !== undefined && telefone !== existente.telefone) data.telefone = telefone;
      if (email !== undefined && email !== existente.email) data.email = email;

      if (Object.keys(data).length > 0) {
        updateOps.push(prisma.cliente.update({ where: { id: existente.id }, data }));
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
            prisma.cliente.deleteMany({
              where: { cod_loja, codigo: { in: toDelete } },
            }),
          );
        }
      }
    }

    const ops: any[] = [];
    if (createData.length > 0) ops.push(prisma.cliente.createMany({ data: createData }));
    ops.push(...updateOps, ...deleteOps);

    if (ops.length > 0) {
      await prisma.$transaction(ops);
    }

    return res.status(201).json({
      message: 'Clientes processados com sucesso.',
      inseridos: createData.length,
      atualizados: updateOps.length,
      removidos,
    });
  } catch (error) {
    console.error('Erro em cadastrarCliente:', error);
    return res.status(500).json({ error: 'Erro ao cadastrar clientes.' });
  }
}
