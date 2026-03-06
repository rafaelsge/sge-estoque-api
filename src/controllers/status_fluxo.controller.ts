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

function normalizeNome(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeCor(value: unknown): string | null {
  const cor = String(value ?? '').trim().toUpperCase();
  if (!cor) return null;
  if (!/^#(?:[0-9A-F]{3}|[0-9A-F]{6})$/.test(cor)) return null;
  return cor;
}

export async function listar(req: Request, res: Response) {
  try {
    const cod_loja = Number(req.query.cod_loja);
    const ativoInformado = hasOwn(req.query, 'ativo') ? parseBoolean(req.query.ativo) : null;

    if (!Number.isFinite(cod_loja) || cod_loja <= 0) {
      return res.status(400).json({ error: 'Parametro cod_loja e obrigatorio.' });
    }
    if (hasOwn(req.query, 'ativo') && ativoInformado === null) {
      return res.status(400).json({ error: 'Parametro ativo deve ser booleano.' });
    }

    const statusFluxo = await prisma.status_fluxo.findMany({
      where: {
        cod_loja,
        ...(ativoInformado === null ? {} : { ativo: ativoInformado }),
      },
      orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
    });

    return res.json({ total: statusFluxo.length, data: statusFluxo });
  } catch (error) {
    console.error('Erro em listar status_fluxo:', error);
    return res.status(500).json({ error: 'Erro ao listar status_fluxo.' });
  }
}

export async function obter(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: 'Parametro id invalido.' });
    }

    const statusFluxo = await prisma.status_fluxo.findUnique({ where: { id } });
    if (!statusFluxo) {
      return res.status(404).json({ error: 'Status de fluxo nao encontrado.' });
    }

    return res.json(statusFluxo);
  } catch (error) {
    console.error('Erro em obter status_fluxo:', error);
    return res.status(500).json({ error: 'Erro ao buscar status_fluxo.' });
  }
}

export async function cadastrarStatusFluxo(req: Request, res: Response) {
  try {
    const body = req.body;
    const registros = Array.isArray(body) ? body : [body];

    if (registros.length === 0) {
      return res.status(400).json({ error: 'Nenhum status_fluxo informado.' });
    }

    for (let i = 0; i < registros.length; i++) {
      const item = registros[i];
      const cod_loja = Number(item?.cod_loja);
      const nome = normalizeNome(item?.nome);
      const cor = normalizeCor(item?.cor);

      if (!Number.isFinite(cod_loja) || cod_loja <= 0) {
        return res.status(400).json({ error: 'cod_loja deve ser um numero valido.', index: i });
      }
      if (!nome) {
        return res.status(400).json({ error: 'nome e obrigatorio.', index: i });
      }
      if (!cor) {
        return res.status(400).json({ error: 'cor deve estar no formato hexadecimal, ex.: #FF8800.', index: i });
      }
      if (hasOwn(item, 'ativo')) {
        const ativo = parseBoolean(item.ativo);
        if (ativo === null) {
          return res.status(400).json({ error: 'ativo deve ser booleano.', index: i });
        }
      }
      if (hasOwn(item, 'ordem')) {
        const ordem = Number(item.ordem);
        if (!Number.isInteger(ordem) || ordem < 0) {
          return res.status(400).json({ error: 'ordem deve ser inteiro >= 0.', index: i });
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
      ? await prisma.status_fluxo.findMany({ where: { cod_loja: { in: codLojas } } })
      : [];

    const existentesMap = new Map<string, (typeof existentes)[number]>();
    for (const existente of existentes) {
      existentesMap.set(`${existente.cod_loja}:${existente.nome.toLowerCase()}`, existente);
    }

    const createData: any[] = [];
    const updateOps: any[] = [];
    const payloadKeys = new Set<string>();

    for (const item of registros) {
      const cod_loja = Number(item.cod_loja);
      const nome = normalizeNome(item.nome);
      const cor = normalizeCor(item.cor)!;
      const ordem = hasOwn(item, 'ordem') ? Number(item.ordem) : 0;
      const ativoInformado = hasOwn(item, 'ativo') ? parseBoolean(item.ativo) : null;
      const ativo = ativoInformado ?? true;
      const key = `${cod_loja}:${nome.toLowerCase()}`;

      if (payloadKeys.has(key)) {
        return res.status(400).json({
          error: `Status de fluxo duplicado no payload para cod_loja ${cod_loja} e nome ${nome}.`,
        });
      }
      payloadKeys.add(key);

      const existente = existentesMap.get(key);
      if (!existente) {
        createData.push({ cod_loja, nome, cor, ordem, ativo });
        continue;
      }

      const data: any = {};
      if (nome !== existente.nome) data.nome = nome;
      if (cor !== existente.cor) data.cor = cor;
      if (ordem !== existente.ordem) data.ordem = ordem;
      if (hasOwn(item, 'ativo') && ativo !== existente.ativo) data.ativo = ativo;

      if (Object.keys(data).length > 0) {
        updateOps.push(prisma.status_fluxo.update({ where: { id: existente.id }, data }));
      }
    }

    const ops: any[] = [];
    if (createData.length > 0) ops.push(prisma.status_fluxo.createMany({ data: createData }));
    ops.push(...updateOps);

    if (ops.length > 0) {
      await prisma.$transaction(ops);
    }

    return res.status(201).json({
      message: 'Status de fluxo processados com sucesso.',
      inseridos: createData.length,
      atualizados: updateOps.length,
    });
  } catch (error) {
    console.error('Erro em cadastrarStatusFluxo:', error);
    return res.status(500).json({ error: 'Erro ao cadastrar status_fluxo.' });
  }
}
