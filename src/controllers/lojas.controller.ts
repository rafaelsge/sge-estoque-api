import { prisma } from '../prismaClient';
import { Request, Response } from 'express';

function nullableString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  return str ? str : null;
}

function normalizeEvolutionUrl(value: unknown): string | null {
  const parsed = nullableString(value);
  if (!parsed) return null;
  return parsed.replace(/\/+$/, '').toLowerCase();
}

export async function cadastrarLoja(req: Request, res: Response) {
  try {
    const body = req.body;
    const lojas = Array.isArray(body) ? body : [body];
    const isBatch = Array.isArray(body);

    if (lojas.length === 0) {
      return res.status(400).json({ error: 'Nenhuma loja informada.' });
    }

    const seenCodigos = new Set<number>();

    for (const loja of lojas) {
      if (!loja.codigo || !loja.nome || !loja.cidade) {
        return res.status(400).json({
          error: 'Cada loja deve conter codigo, nome e cidade.',
        });
      }

      const codigo = Number(loja.codigo);
      if (!Number.isFinite(codigo) || codigo <= 0) {
        return res.status(400).json({
          error: 'Codigo da loja deve ser um numero valido.',
        });
      }
      if (seenCodigos.has(codigo)) {
        return res.status(400).json({
          error: `Loja duplicada no payload para codigo ${codigo}.`,
        });
      }
      seenCodigos.add(codigo);
    }

    const codigos = Array.from(
      new Set(
        lojas
          .map((l) => Number(l.codigo))
          .filter((n) => Number.isFinite(n) && n > 0),
      ),
    );

    const existentes = isBatch
      ? await prisma.loja.findMany()
      : await prisma.loja.findMany({ where: { codigo: { in: codigos } } });

    const existentesMap = new Map<number, typeof existentes[number]>();
    for (const e of existentes) {
      existentesMap.set(e.codigo, e);
    }

    const createData: any[] = [];
    const updateOps: any[] = [];

    for (const l of lojas) {
      const codigo = Number(l.codigo);
      const nome = String(l.nome);
      const cidade = String(l.cidade);
      const evolution_url = Object.prototype.hasOwnProperty.call(l, 'evolution_url')
        ? normalizeEvolutionUrl(l.evolution_url)
        : undefined;
      const evolution_instancia = Object.prototype.hasOwnProperty.call(l, 'evolution_instancia')
        ? nullableString(l.evolution_instancia)
        : undefined;
      const evolution_apikey = Object.prototype.hasOwnProperty.call(l, 'evolution_apikey')
        ? nullableString(l.evolution_apikey)
        : undefined;

      const existing = existentesMap.get(codigo);

      if (!existing) {
        const data: any = { codigo, nome, cidade };
        if (evolution_url !== undefined) data.evolution_url = evolution_url;
        if (evolution_instancia !== undefined) data.evolution_instancia = evolution_instancia;
        if (evolution_apikey !== undefined) data.evolution_apikey = evolution_apikey;
        createData.push(data);
      } else {
        const data: any = {};
        if (nome !== existing.nome) data.nome = nome;
        if (cidade !== existing.cidade) data.cidade = cidade;
        if (evolution_url !== undefined && evolution_url !== existing.evolution_url) data.evolution_url = evolution_url;
        if (evolution_instancia !== undefined && evolution_instancia !== existing.evolution_instancia) {
          data.evolution_instancia = evolution_instancia;
        }
        if (evolution_apikey !== undefined && evolution_apikey !== existing.evolution_apikey) {
          data.evolution_apikey = evolution_apikey;
        }

        if (Object.keys(data).length > 0) {
          updateOps.push(prisma.loja.update({ where: { id: existing.id }, data }));
        }
      }
    }

    const deleteOps: any[] = [];
    let removidos = 0;

    if (isBatch) {
      const incoming = new Set(codigos);
      const toDelete = existentes
        .map((e) => e.codigo)
        .filter((codigo) => !incoming.has(codigo));

      if (toDelete.length > 0) {
        removidos = toDelete.length;
        deleteOps.push(
          prisma.loja.deleteMany({ where: { codigo: { in: toDelete } } }),
        );
      }
    }

    const ops: any[] = [];
    if (createData.length > 0) ops.push(prisma.loja.createMany({ data: createData }));
    ops.push(...updateOps, ...deleteOps);

    if (ops.length > 0) {
      await prisma.$transaction(ops);
    }

    return res.status(201).json({
      message: 'Lojas processadas com sucesso.',
      inseridas: createData.length,
      atualizadas: updateOps.length,
      removidas: removidos,
    });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: 'evolution_apikey ja cadastrada para outra loja.' });
    }
    console.error('Erro em cadastrarLoja:', error);
    return res.status(500).json({ error: 'Erro ao cadastrar lojas.' });
  }
}

export async function listarLojas(req: Request, res: Response) {
  try {
    const lojas = await prisma.loja.findMany({ orderBy: { nome: 'asc' } });
    return res.json({ total: lojas.length, data: lojas });
  } catch (error) {
    console.error('Erro em listarLojas:', error);
    return res.status(500).json({ error: 'Erro ao listar lojas.' });
  }
}

export async function atualizarLoja(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const { nome, cidade } = req.body;

    if (!id) return res.status(400).json({ error: 'ID da loja e obrigatorio.' });

    const loja = await prisma.loja.findUnique({ where: { id } });
    if (!loja) return res.status(404).json({ error: 'Loja nao encontrada.' });

    const atualizada = await prisma.loja.update({
      where: { id },
      data: {
        nome: nome ?? loja.nome,
        cidade: cidade ?? loja.cidade,
        evolution_url: Object.prototype.hasOwnProperty.call(req.body, 'evolution_url')
          ? normalizeEvolutionUrl(req.body.evolution_url)
          : loja.evolution_url,
        evolution_instancia: Object.prototype.hasOwnProperty.call(req.body, 'evolution_instancia')
          ? nullableString(req.body.evolution_instancia)
          : loja.evolution_instancia,
        evolution_apikey: Object.prototype.hasOwnProperty.call(req.body, 'evolution_apikey')
          ? nullableString(req.body.evolution_apikey)
          : loja.evolution_apikey,
      },
    });

    return res.json({ message: 'Loja atualizada com sucesso.', loja: atualizada });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: 'evolution_apikey ja cadastrada para outra loja.' });
    }
    console.error('Erro em atualizarLoja:', error);
    return res.status(500).json({ error: 'Erro ao atualizar loja.' });
  }
}

export async function excluirLoja(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID e obrigatorio.' });

    const loja = await prisma.loja.findUnique({ where: { id } });
    if (!loja) return res.status(404).json({ error: 'Loja nao encontrada.' });

    await prisma.loja.delete({ where: { id } });

    return res.json({ message: 'Loja excluida com sucesso.' });
  } catch (error) {
    console.error('Erro em excluirLoja:', error);
    return res.status(500).json({ error: 'Erro ao excluir loja.' });
  }
}
