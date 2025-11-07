"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
exports.firstAccess = firstAccess;
exports.forgotPassword = forgotPassword;
exports.resetPassword = resetPassword;
const prismaClient_1 = require("../prismaClient");
const node_fetch_1 = __importDefault(require("node-fetch"));
const nodemailer_1 = __importDefault(require("nodemailer")); // ✉️ Envio de e-mails
// 🔧 Configuração da Evolution API
const EVOLUTION_URL = 'https://evolution20.sgesoftware.com.br/message/sendText/Suporte_SGE';
const EVOLUTION_API_KEY = 'EE937608D299-4177-A5A5-0A1FE150C85E';
// ✉️ Configuração do servidor SMTP (Hostinger)
const smtpTransport = nodemailer_1.default.createTransport({
    host: 'smtp.hostinger.com.br',
    port: 587,
    secure: false, // STARTTLS
    auth: {
        user: 'app@sgeerp.com.br',
        pass: 'vHwlRF1&',
    },
    tls: {
        rejectUnauthorized: false,
    },
});
async function login(req, res) {
    try {
        const { login, senha_md5 } = req.body;
        if (!login) {
            return res.status(400).json({ error: 'Campo login é obrigatório.' });
        }
        const usuario = await prismaClient_1.prisma.usuario.findFirst({
            where: {
                OR: [{ email: login }, { telefone: login }],
            },
            include: {
                loja: { select: { codigo: true, nome: true, cidade: true } },
            },
        });
        if (!usuario) {
            return res.status(401).json({ error: 'Usuário não encontrado.' });
        }
        // 🚪 Caso seja o primeiro acesso (sem senha)
        if (!usuario.senha_md5) {
            return res.status(200).json({
                primeiro_acesso: true,
                mensagem: 'Usuário sem senha cadastrada. Crie uma senha para continuar.',
                usuario: {
                    id: usuario.id,
                    codigo: usuario.codigo,
                    nome: usuario.nome,
                    email: usuario.email,
                    telefone: usuario.telefone,
                    cod_loja: usuario.cod_loja,
                },
            });
        }
        // 🧩 Login normal com senha
        if (usuario.senha_md5 !== senha_md5) {
            return res.status(401).json({ error: 'Senha incorreta.' });
        }
        return res.json({
            primeiro_acesso: false,
            usuario: {
                id: usuario.id,
                codigo: usuario.codigo,
                cod_loja: usuario.cod_loja,
                nome: usuario.nome,
                email: usuario.email,
                telefone: usuario.telefone,
            },
            loja: usuario.loja,
        });
    }
    catch (error) {
        console.error('Erro em login:', error);
        return res
            .status(500)
            .json({ error: 'Erro interno ao realizar login.' });
    }
}
async function firstAccess(req, res) {
    try {
        const { login, senha_md5 } = req.body;
        if (!login || !senha_md5) {
            return res
                .status(400)
                .json({ error: 'login e senha_md5 são obrigatórios.' });
        }
        const usuario = await prismaClient_1.prisma.usuario.findFirst({
            where: { OR: [{ email: login }, { telefone: login }] },
        });
        if (!usuario) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }
        if (usuario.senha_md5) {
            return res
                .status(400)
                .json({ error: 'Usuário já possui senha cadastrada.' });
        }
        await prismaClient_1.prisma.usuario.update({
            where: { id: usuario.id },
            data: { senha_md5 },
        });
        return res.json({ message: 'Senha definida com sucesso.' });
    }
    catch (error) {
        console.error('Erro em firstAccess:', error);
        return res.status(500).json({ error: 'Erro ao definir senha.' });
    }
}
// ✅ Envio de token via WhatsApp e Email
async function forgotPassword(req, res) {
    try {
        const { login } = req.body;
        if (!login) {
            return res
                .status(400)
                .json({ error: 'Campo login é obrigatório.' });
        }
        const usuario = await prismaClient_1.prisma.usuario.findFirst({
            where: { OR: [{ email: login }, { telefone: login }] },
        });
        if (!usuario) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }
        // 🔐 Gera token simples (6 dígitos) e define validade (15 minutos)
        const token = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
        await prismaClient_1.prisma.tokenRecuperacao.create({
            data: {
                id_usuario: usuario.id,
                token,
                expira_em: expiresAt,
            },
        });
        // ✅ 1️⃣ Envia o token via WhatsApp (Evolution API)
        if (usuario.telefone) {
            let numero = usuario.telefone.replace(/\D/g, '');
            if (!numero.startsWith('55')) {
                numero = '55' + numero;
            }
            const mensagem = `🔐 *Recuperação de Senha - SGE Estoque*\n\nSeu código de recuperação é: *${token}*\n\nEste código expira em 15 minutos.`;
            try {
                await (0, node_fetch_1.default)(EVOLUTION_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        apikey: EVOLUTION_API_KEY,
                    },
                    body: JSON.stringify({
                        number: numero,
                        text: mensagem,
                    }),
                });
                console.log(`✅ Token enviado via WhatsApp para ${numero}`);
            }
            catch (err) {
                console.error('Erro ao enviar via WhatsApp:', err);
            }
        }
        // ✅ 2️⃣ Envia também por E-MAIL (caso o usuário tenha)
        if (usuario.email) {
            try {
                await smtpTransport.sendMail({
                    from: '"SGE Estoque" <app@sgeerp.com.br>',
                    to: usuario.email,
                    subject: '🔐 Recuperação de Senha - SGE Estoque',
                    html: `
            <h2>Recuperação de Senha - SGE Estoque</h2>
            <p>Olá <strong>${usuario.nome}</strong>,</p>
            <p>Seu código de recuperação é:</p>
            <h1 style="color:#0052D4;">${token}</h1>
            <p>Este código expira em 15 minutos.</p>
            <br/>
            <p style="font-size:12px;color:#777;">SGE Software ©</p>
          `,
                });
                console.log(`📧 Token enviado por e-mail para ${usuario.email}`);
            }
            catch (err) {
                console.error('Erro ao enviar e-mail:', err);
            }
        }
        return res.json({
            message: 'Token de recuperação gerado e enviado via WhatsApp e e-mail.',
            expira_em: expiresAt,
        });
    }
    catch (error) {
        console.error('Erro em forgotPassword:', error);
        return res
            .status(500)
            .json({ error: 'Erro ao gerar token de recuperação.' });
    }
}
async function resetPassword(req, res) {
    try {
        const { token, nova_senha_md5 } = req.body;
        if (!token || !nova_senha_md5) {
            return res
                .status(400)
                .json({ error: 'token e nova_senha_md5 são obrigatórios.' });
        }
        const tokenRec = await prismaClient_1.prisma.tokenRecuperacao.findFirst({
            where: { token },
        });
        if (!tokenRec || tokenRec.expira_em < new Date()) {
            return res.status(400).json({ error: 'Token inválido ou expirado.' });
        }
        await prismaClient_1.prisma.usuario.update({
            where: { id: tokenRec.id_usuario },
            data: { senha_md5: nova_senha_md5 },
        });
        await prismaClient_1.prisma.tokenRecuperacao.delete({
            where: { id: tokenRec.id },
        });
        return res.json({ message: 'Senha redefinida com sucesso.' });
    }
    catch (error) {
        console.error('Erro em resetPassword:', error);
        return res
            .status(500)
            .json({ error: 'Erro ao redefinir senha.' });
    }
}
