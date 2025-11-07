import { prisma } from '../prismaClient';
import { Request, Response } from 'express';

/**
 * 🏪 Cadastra uma ou várias lojas
 */
export async function cadastrarLoja(req: Request, res: Response) {
  try {
    const body = req.body;
    const lojas = Array.isArray(body) ? body : [body];

    // Validação básica
    for (const loja of lojas) {
      if (!loja.codigo || !loja.nome || !loja.cidade) {
        return res.status(400).json({
          error: 'Cada loja deve conter código, nome e cidade.',
        });
      }
    }

    // Insere todas (sem bloqueio de duplicados)
    const result = await prisma.loja.createMany({
      data: lojas.map((l) => ({
        codigo: l.codigo, // código ERP
        nome: l.nome,
        cidade: l.cidade,
      })),
      skipDuplicates: false, // permite repetição de código se desejado
    });

    return res.status(201).json({
      message: 'Lojas cadastradas com sucesso.',
      inseridas: result.count,
    });
  } catch (error) {
    console.error('Erro em cadastrarLoja:', error);
    return res.status(500).json({ error: 'Erro ao cadastrar lojas.' });
  }
}

/**
 * 📋 Lista todas as lojas
 */
export async function listarLojas(req: Request, res: Response) {
  try {
    const lojas = await prisma.loja.findMany({ orderBy: { nome: 'asc' } });
    return res.json({ total: lojas.length, data: lojas });
  } catch (error) {
    console.error('Erro em listarLojas:', error);
    return res.status(500).json({ error: 'Erro ao listar lojas.' });
  }
}

/**
 * ✏️ Atualiza uma loja (busca pelo ID interno)
 */
export async function atualizarLoja(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const { nome, cidade } = req.body;

    if (!id) return res.status(400).json({ error: 'ID da loja é obrigatório.' });

    const loja = await prisma.loja.findUnique({ where: { id } });
    if (!loja) return res.status(404).json({ error: 'Loja não encontrada.' });

    const atualizada = await prisma.loja.update({
      where: { id },
      data: {
        nome: nome ?? loja.nome,
        cidade: cidade ?? loja.cidade,
      },
    });

    return res.json({ message: 'Loja atualizada com sucesso.', loja: atualizada });
  } catch (error) {
    console.error('Erro em atualizarLoja:', error);
    return res.status(500).json({ error: 'Erro ao atualizar loja.' });
  }
}

/**
 * ❌ Exclui uma loja (pelo ID interno)
 */
export async function excluirLoja(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID é obrigatório.' });

    const loja = await prisma.loja.findUnique({ where: { id } });
    if (!loja) return res.status(404).json({ error: 'Loja não encontrada.' });

    await prisma.loja.delete({ where: { id } });

    return res.json({ message: 'Loja excluída com sucesso.' });
  } catch (error) {
    console.error('Erro em excluirLoja:', error);
    return res.status(500).json({ error: 'Erro ao excluir loja.' });
  }
}
