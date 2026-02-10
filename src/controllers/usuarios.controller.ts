import { prisma } from '../prismaClient';
import { Request, Response } from 'express';

/**
 * 👤 Cadastrar um ou vários usuários
 */
export async function cadastrarUsuario(req: Request, res: Response) {
  try {
    const body = req.body;
    const usuarios = Array.isArray(body) ? body : [body];
    const isBatch = Array.isArray(body);

    if (usuarios.length === 0) {
      return res.status(400).json({ error: 'Nenhum usuario informado.' });
    }

    for (const u of usuarios) {
      if (!u.codigo || !u.nome || !u.cod_loja) {
        return res.status(400).json({
          error: 'Campos obrigatorios: codigo, nome e cod_loja.',
        });
      }

      const cod_loja = Number(u.cod_loja);
      const codigo = Number(u.codigo);
      if (!Number.isFinite(cod_loja) || cod_loja <= 0 || !Number.isFinite(codigo) || codigo <= 0) {
        return res.status(400).json({
          error: 'cod_loja e codigo devem ser numeros validos.',
        });
      }
    }

    const codLojas = Array.from(
      new Set(
        usuarios
          .map((u) => Number(u.cod_loja))
          .filter((n) => Number.isFinite(n) && n > 0),
      ),
    );

    const existentes = codLojas.length
      ? await prisma.usuario.findMany({ where: { cod_loja: { in: codLojas } } })
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

    for (const u of usuarios) {
      const cod_loja = Number(u.cod_loja);
      const codigo = Number(u.codigo);

      let set = codigosPorLoja.get(cod_loja);
      if (!set) {
        set = new Set<number>();
        codigosPorLoja.set(cod_loja, set);
      }
      if (set.has(codigo)) {
        return res.status(400).json({
          error: `Usuario duplicado no payload para cod_loja ${cod_loja} e codigo ${codigo}.`,
        });
      }
      set.add(codigo);

      const existing = existentesMap.get(`${cod_loja}:${codigo}`);

      const nome = String(u.nome);
      const emailValue = hasOwn(u, 'email') ? (u.email ?? null) : null;
      const telefoneValue = hasOwn(u, 'telefone') ? (u.telefone ?? null) : null;
      const senha_md5 = hasOwn(u, 'senha_md5') ? (u.senha_md5 ?? null) : null;

      if (!existing) {
        if (!senha_md5) {
          return res.status(400).json({
            error: 'Campo senha_md5 e obrigatorio para novos usuarios.',
          });
        }

        createData.push({
          codigo,
          nome,
          email: emailValue,
          telefone: telefoneValue,
          senha_md5,
          cod_loja,
        });
      } else {
        const data: any = {};
        if (nome !== existing.nome) data.nome = nome;
        if (hasOwn(u, 'email') && emailValue !== existing.email) data.email = emailValue;
        if (hasOwn(u, 'telefone') && telefoneValue !== existing.telefone) data.telefone = telefoneValue;

        if (!existing.senha_md5 && hasOwn(u, 'senha_md5') && senha_md5) {
          data.senha_md5 = senha_md5;
        }

        if (Object.keys(data).length > 0) {
          updateOps.push(prisma.usuario.update({ where: { id: existing.id }, data }));
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
            prisma.usuario.deleteMany({
              where: { cod_loja, codigo: { in: toDelete } },
            }),
          );
        }
      }
    }

    const ops: any[] = [];
    if (createData.length > 0) ops.push(prisma.usuario.createMany({ data: createData }));
    ops.push(...updateOps, ...deleteOps);

    if (ops.length > 0) {
      await prisma.$transaction(ops);
    }

    return res.status(201).json({
      message: 'Usuarios processados com sucesso.',
      inseridos: createData.length,
      atualizados: updateOps.length,
      removidos,
    });
  } catch (error) {
    console.error('Erro em cadastrarUsuario:', error);
    return res.status(500).json({ error: 'Erro ao cadastrar usuarios.' });
  }
}
/**
 * 📋 Listar todos os usuários (ou por loja)
 */
export async function listarUsuarios(req: Request, res: Response) {
  try {
    const cod_loja = req.query.cod_loja ? Number(req.query.cod_loja) : undefined;

    const where = cod_loja ? { cod_loja } : {};
    const usuarios = await prisma.usuario.findMany({
      where,
      include: { loja: true },
      orderBy: { nome: 'asc' },
    });

    return res.json({
      total: usuarios.length,
      data: usuarios.map((u) => ({
        id: u.id,
        codigo: u.codigo,
        nome: u.nome,
        email: u.email,
        telefone: u.telefone,
        cod_loja: u.cod_loja,
        loja: {
          codigo: u.loja.codigo,
          nome: u.loja.nome,
          cidade: u.loja.cidade,
        },
      })),
    });
  } catch (error) {
    console.error('Erro em listarUsuarios:', error);
    return res.status(500).json({ error: 'Erro ao listar usuários.' });
  }
}

/**
 * ✏️ Atualizar um usuário (por id interno)
 */
export async function atualizarUsuario(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const { nome, email, telefone, senha_md5, cod_loja } = req.body;

    if (!id) return res.status(400).json({ error: 'ID é obrigatório.' });

    const usuario = await prisma.usuario.findUnique({ where: { id } });
    if (!usuario) return res.status(404).json({ error: 'Usuário não encontrado.' });

    const atualizado = await prisma.usuario.update({
      where: { id },
      data: {
        nome: nome ?? usuario.nome,
        email: email ?? usuario.email,
        telefone: telefone ?? usuario.telefone,
        senha_md5: senha_md5 ?? usuario.senha_md5,
        cod_loja: cod_loja ?? usuario.cod_loja,
      },
    });

    return res.json({ message: 'Usuário atualizado com sucesso.', usuario: atualizado });
  } catch (error) {
    console.error('Erro em atualizarUsuario:', error);
    return res.status(500).json({ error: 'Erro ao atualizar usuário.' });
  }
}

/**
 * ❌ Excluir um usuário (por id interno)
 */
export async function excluirUsuario(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID é obrigatório.' });

    const usuario = await prisma.usuario.findUnique({ where: { id } });
    if (!usuario) return res.status(404).json({ error: 'Usuário não encontrado.' });

    await prisma.usuario.delete({ where: { id } });
    return res.json({ message: 'Usuário excluído com sucesso.' });
  } catch (error) {
    console.error('Erro em excluirUsuario:', error);
    return res.status(500).json({ error: 'Erro ao excluir usuário.' });
  }
}
