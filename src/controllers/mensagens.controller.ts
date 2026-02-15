import { Request, Response } from 'express';
import { prisma } from '../prismaClient';

const STATUS_ABERTO = 'aberto' as const;
const STATUS_EM_ATENDIMENTO = 'em_atendimento' as const;
const STATUS_FINALIZADO = 'finalizado' as const;
const STATUS_ATENDIMENTO_VALIDOS = new Set([
  STATUS_ABERTO,
  STATUS_EM_ATENDIMENTO,
  STATUS_FINALIZADO,
]);

function payloadPreview(payload: unknown, max = 6000): string {
  try {
    const raw = JSON.stringify(payload);
    if (!raw) return '';
    if (raw.length <= max) return raw;
    return `${raw.slice(0, max)}... [truncado ${raw.length - max} chars]`;
  } catch {
    return '[payload nao serializavel]';
  }
}

function asPositiveInt(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function asNullablePositiveInt(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  return asPositiveInt(value);
}

function asNullableString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  return str ? str : null;
}

function normalizePhone(value: unknown): string {
  let raw = String(value ?? '').trim();
  if (!raw) return '';

  // JID da Evolution/WhatsApp: 5511999999999@s.whatsapp.net
  if (raw.includes('@')) raw = raw.split('@')[0];
  // Alguns JIDs incluem sufixo de dispositivo: 5511999999999:12@s.whatsapp.net
  if (raw.includes(':')) raw = raw.split(':')[0];

  const digits = raw.replace(/\D/g, '');
  return digits;
}

function parseDirection(value: unknown): 'entrada' | 'saida' | null {
  const direction = String(value ?? 'entrada').trim().toLowerCase();
  if (direction === 'entrada' || direction === 'saida') return direction;
  return null;
}

function extractTextFromPayload(payload: any): string | null {
  return readFirstString(
    payload?.texto,
    payload?.text,
    payload?.body,
    payload?.message?.conversation,
    payload?.message?.extendedTextMessage?.text,
    payload?.message?.imageMessage?.caption,
    payload?.message?.videoMessage?.caption,
    payload?.data?.texto,
    payload?.data?.text,
    payload?.data?.body,
    payload?.data?.message?.conversation,
    payload?.data?.message?.extendedTextMessage?.text,
    payload?.data?.message?.imageMessage?.caption,
    payload?.data?.message?.videoMessage?.caption,
    payload?.event?.texto,
    payload?.event?.text,
    payload?.event?.body,
    payload?.event?.message?.conversation,
    payload?.event?.message?.extendedTextMessage?.text,
  );
}

function extractContactNameFromPayload(payload: any): string | null {
  return readFirstString(
    payload?.contato,
    payload?.nome,
    payload?.pushName,
    payload?.push_name,
    payload?.data?.pushName,
    payload?.data?.push_name,
    payload?.data?.sender?.pushName,
    payload?.data?.sender?.push_name,
    payload?.event?.pushName,
    payload?.event?.push_name,
  );
}

function inferTipoFromPayload(payload: any): string | null {
  const tipoInformado = asNullableString(payload?.tipo);
  if (tipoInformado) return tipoInformado;

  const messageObj = payload?.data?.message ?? payload?.message ?? payload?.event?.message;
  if (!messageObj || typeof messageObj !== 'object') return null;

  if (messageObj.conversation || messageObj.extendedTextMessage) return 'texto';
  if (messageObj.imageMessage) return 'imagem';
  if (messageObj.videoMessage) return 'video';
  if (messageObj.audioMessage) return 'audio';
  if (messageObj.documentMessage) return 'documento';

  return null;
}

function normalizeUrl(value: unknown): string | null {
  const raw = asNullableString(value);
  if (!raw) return null;
  return raw.replace(/\/+$/, '').toLowerCase();
}

function readFirstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
    if (Array.isArray(value) && value.length > 0) {
      const first = value[0];
      if (typeof first === 'string' && first.trim()) return first.trim();
    }
  }
  return null;
}

function readFirstRawString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.length > 0) return value;
    if (Array.isArray(value) && value.length > 0) {
      const first = value[0];
      if (typeof first === 'string' && first.length > 0) return first;
    }
  }
  return null;
}

function extractMimeFromDataUrl(base64Raw: string | null): string | null {
  if (!base64Raw) return null;
  const match = /^data:([^;]+);base64,/i.exec(base64Raw);
  return match?.[1]?.trim() || null;
}

function normalizeSearchKey(key: string): string {
  return key.replace(/[_\-\s]/g, '').toLowerCase();
}

function deepFindStringByKeys(input: unknown, keys: Set<string>, maxDepth = 10, depth = 0): string | null {
  if (depth > maxDepth || input === null || input === undefined) return null;

  if (Array.isArray(input)) {
    for (const item of input) {
      const found = deepFindStringByKeys(item, keys, maxDepth, depth + 1);
      if (found) return found;
    }
    return null;
  }

  if (typeof input !== 'object') return null;

  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (keys.has(normalizeSearchKey(key)) && typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    const found = deepFindStringByKeys(value, keys, maxDepth, depth + 1);
    if (found) return found;
  }

  return null;
}

function extractMediaBase64FromPayload(payload: any): string | null {
  return readFirstRawString(
    payload?.base64,
    payload?.message?.base64,
    payload?.data?.base64,
    payload?.data?.message?.base64,
    payload?.event?.base64,
    payload?.event?.message?.base64,

    payload?.message?.imageMessage?.base64,
    payload?.message?.videoMessage?.base64,
    payload?.message?.audioMessage?.base64,
    payload?.message?.documentMessage?.base64,

    payload?.data?.message?.imageMessage?.base64,
    payload?.data?.message?.videoMessage?.base64,
    payload?.data?.message?.audioMessage?.base64,
    payload?.data?.message?.documentMessage?.base64,

    payload?.event?.message?.imageMessage?.base64,
    payload?.event?.message?.videoMessage?.base64,
    payload?.event?.message?.audioMessage?.base64,
    payload?.event?.message?.documentMessage?.base64,
  );
}

function extractMediaMimeTypeFromPayload(payload: any, arquivoBase64: string | null): string | null {
  const explicit = readFirstString(
    payload?.mimetype,
    payload?.mimeType,
    payload?.mime_type,
    payload?.payload?.mimetype,
    payload?.payload?.mimeType,
    payload?.payload?.mime_type,
    payload?.message?.mimetype,
    payload?.message?.mimeType,
    payload?.message?.mime_type,
    payload?.data?.mimetype,
    payload?.data?.mimeType,
    payload?.data?.mime_type,
    payload?.data?.message?.mimetype,
    payload?.data?.message?.mimeType,
    payload?.data?.message?.mime_type,
    payload?.event?.mimetype,
    payload?.event?.mimeType,
    payload?.event?.mime_type,
    payload?.event?.message?.mimetype,
    payload?.event?.message?.mimeType,
    payload?.event?.message?.mime_type,

    payload?.message?.imageMessage?.mimetype,
    payload?.message?.imageMessage?.mimeType,
    payload?.message?.videoMessage?.mimetype,
    payload?.message?.videoMessage?.mimeType,
    payload?.message?.audioMessage?.mimetype,
    payload?.message?.audioMessage?.mimeType,
    payload?.message?.documentMessage?.mimetype,
    payload?.message?.documentMessage?.mimeType,

    payload?.data?.message?.imageMessage?.mimetype,
    payload?.data?.message?.imageMessage?.mimeType,
    payload?.data?.message?.videoMessage?.mimetype,
    payload?.data?.message?.videoMessage?.mimeType,
    payload?.data?.message?.audioMessage?.mimetype,
    payload?.data?.message?.audioMessage?.mimeType,
    payload?.data?.message?.documentMessage?.mimetype,
    payload?.data?.message?.documentMessage?.mimeType,

    payload?.event?.message?.imageMessage?.mimetype,
    payload?.event?.message?.imageMessage?.mimeType,
    payload?.event?.message?.videoMessage?.mimetype,
    payload?.event?.message?.videoMessage?.mimeType,
    payload?.event?.message?.audioMessage?.mimetype,
    payload?.event?.message?.audioMessage?.mimeType,
    payload?.event?.message?.documentMessage?.mimetype,
    payload?.event?.message?.documentMessage?.mimeType,
  );

  if (explicit) return explicit;

  const deep = deepFindStringByKeys(payload, new Set(['mimetype', 'filemimetype', 'mediamimetype']));
  if (deep) return deep;

  return extractMimeFromDataUrl(arquivoBase64);
}

function defaultMimeTypeByTipo(tipo: string): string | null {
  if (tipo === 'imagem') return 'image/jpeg';
  if (tipo === 'video') return 'video/mp4';
  if (tipo === 'audio') return 'audio/ogg';
  if (tipo === 'documento') return 'application/octet-stream';
  return null;
}

function extractFromMe(payload: any): boolean {
  const value =
    payload?.data?.key?.fromMe ??
    payload?.key?.fromMe ??
    payload?.data?.fromMe ??
    payload?.fromMe ??
    false;
  return Boolean(value);
}

function extractPhoneFromPayload(payload: any, fromMe: boolean): string | null {
  const remoteJid = readFirstString(
    payload?.data?.key?.remoteJid,
    payload?.key?.remoteJid,
    payload?.data?.remoteJid,
    payload?.remoteJid,
    payload?.data?.key?.remoteJidAlt,
    payload?.key?.remoteJidAlt,
  );

  const participant = readFirstString(
    payload?.data?.key?.participant,
    payload?.key?.participant,
    payload?.data?.participant,
    payload?.participant,
  );

  // Conversa 1:1: o contato sempre vem no remoteJid (independente de fromMe)
  if (remoteJid && !remoteJid.includes('@g.us')) {
    return remoteJid;
  }

  // Grupo: quando recebida (fromMe=false), o remetente vem em participant
  if (remoteJid && remoteJid.includes('@g.us') && !fromMe && participant) {
    return participant;
  }

  // Fallbacks para payloads fora do padrao
  return readFirstString(
    // recebidas
    !fromMe ? payload?.data?.from : null,
    !fromMe ? payload?.from : null,
    !fromMe ? payload?.data?.sender : null,
    !fromMe ? payload?.sender : null,
    // enviadas
    fromMe ? payload?.data?.to : null,
    fromMe ? payload?.to : null,
    // ultimo fallback legado
    payload?.data?.telefone,
    payload?.data?.numero,
    payload?.telefone,
    payload?.numero,
    remoteJid,
    participant,
  );
}

function maskKey(value: string | null): string {
  if (!value) return '';
  if (value.length <= 8) return '***';
  return `${value.slice(0, 4)}***${value.slice(-4)}`;
}

function canAccessAtendimento(atendimento: { status: string; usuario_id: number | null }, codUsuario: number | null): boolean {
  if (atendimento.status !== STATUS_EM_ATENDIMENTO) return true;
  if (!atendimento.usuario_id) return true;
  if (!codUsuario) return false;
  return atendimento.usuario_id === codUsuario;
}

function parseStatusAtendimento(value: unknown): typeof STATUS_ABERTO | typeof STATUS_EM_ATENDIMENTO | typeof STATUS_FINALIZADO | null {
  const status = asNullableString(value)?.toLowerCase() ?? null;
  if (!status) return null;
  if (!STATUS_ATENDIMENTO_VALIDOS.has(status as any)) return null;
  return status as any;
}

export async function webhookMensagem(req: Request, res: Response) {
  try {
    console.info('[mensagens/webhook] requisicao recebida:', {
      originalUrl: req.originalUrl,
      path: req.path,
    });
    console.info('[mensagens/webhook] payload recebido:', payloadPreview(req.body));

    const cod_loja_payload = asPositiveInt(req.body?.cod_loja);
    const apikey = readFirstString(
      req.body?.apikey,
      req.body?.apiKey,
      req.body?.api_key,
      req.body?.data?.apikey,
      req.body?.event?.apikey,
      req.headers['apikey'],
      req.headers['x-api-key'],
    );
    const evolution_instancia = readFirstString(
      req.body?.instance,
      req.body?.instanceName,
      req.body?.instance_name,
      req.body?.instancia,
      req.body?.data?.instance,
      req.body?.data?.instanceName,
      req.body?.event?.instance,
    );
    const evolution_url = normalizeUrl(
      readFirstString(
        req.body?.server_url,
        req.body?.serverUrl,
        req.body?.evolution_url,
        req.body?.data?.server_url,
        req.body?.event?.server_url,
        req.headers['origin'],
      ),
    );
    const fromMe = extractFromMe(req.body);
    const telefoneRaw = extractPhoneFromPayload(req.body, fromMe);
    const telefone = normalizePhone(telefoneRaw);
    const direcao = parseDirection(req.body?.direcao) ?? (fromMe ? 'saida' : 'entrada');
    const tipo = inferTipoFromPayload(req.body) ?? 'texto';
    const texto = extractTextFromPayload(req.body);
    const arquivo_base64 = extractMediaBase64FromPayload(req.body);
    const arquivo_mimetype =
      extractMediaMimeTypeFromPayload(req.body, arquivo_base64) ??
      (arquivo_base64 ? defaultMimeTypeByTipo(tipo) ?? 'application/octet-stream' : null);
    const contatoNome = extractContactNameFromPayload(req.body);
    const contatoTipo = asNullableString(req.body?.contato_tipo ?? req.body?.tipo_contato);
    const cliente_codigo = asNullablePositiveInt(req.body?.cliente_codigo);
    const usuario_id = asNullablePositiveInt(req.body?.usuario_id);
    const origem = asNullableString(req.body?.origem) ?? 'whatsapp';
    const payload = Object.prototype.hasOwnProperty.call(req.body ?? {}, 'payload') ? req.body.payload : req.body;

    let lojaResolvida = null as { codigo: number } | null;
    if (apikey) {
      lojaResolvida = await prisma.loja.findFirst({
        where: { evolution_apikey: apikey },
        select: { codigo: true },
      });
    }
    if (!lojaResolvida && evolution_instancia) {
      const whereByInstancia: any = { evolution_instancia };
      if (evolution_url) whereByInstancia.evolution_url = evolution_url;
      lojaResolvida = await prisma.loja.findFirst({
        where: whereByInstancia,
        select: { codigo: true },
      });
    }

    const cod_loja = lojaResolvida?.codigo ?? cod_loja_payload;

    console.info('[mensagens/webhook] resolucao da loja:', {
      cod_loja_payload,
      cod_loja_resolvida: lojaResolvida?.codigo ?? null,
      cod_loja_final: cod_loja ?? null,
      apikey: maskKey(apikey),
      evolution_instancia,
      evolution_url,
    });

    console.info('[mensagens/webhook] campos normalizados:', {
      cod_loja,
      fromMe,
      telefoneRaw,
      telefone,
      direcao,
      tipo,
      contatoNome,
      contatoTipo,
      cliente_codigo,
      usuario_id,
      origem,
      hasTexto: Boolean(texto),
      hasArquivoBase64: Boolean(arquivo_base64),
      arquivoMimetype: arquivo_mimetype,
      base64Length: arquivo_base64 ? arquivo_base64.length : 0,
      hasPayload: payload !== undefined && payload !== null,
    });

    if (!cod_loja) {
      console.warn('[mensagens/webhook] rejeitado: nao foi possivel identificar cod_loja por apikey/instancia/url');
      return res.status(400).json({
        error: 'Nao foi possivel identificar cod_loja. Configure evolution_apikey/evolution_instancia/evolution_url na loja.',
      });
    }
    if (!telefone) {
      console.warn('[mensagens/webhook] rejeitado: telefone/numero ausente (incluindo key.remoteJid)');
      return res.status(400).json({ error: 'Campo telefone/numero e obrigatorio.' });
    }
    if (!direcao) {
      console.warn('[mensagens/webhook] rejeitado: direcao invalida');
      return res.status(400).json({ error: "Campo direcao deve ser 'entrada' ou 'saida'." });
    }
    if (!texto && !arquivo_base64) {
      console.info('[mensagens/webhook] ignorado: sem texto e sem arquivo_base64');
      return res.status(200).json({
        message: 'Evento ignorado: sem texto e sem arquivo_base64.',
        ignored: true,
      });
    }

    const resultado = await prisma.$transaction(async (tx) => {
      console.info('[mensagens/webhook] iniciando transacao', { cod_loja, telefone });
      let contato = await tx.contato.findUnique({
        where: { cod_loja_telefone: { cod_loja, telefone } },
      });

      if (!contato) {
        console.info('[mensagens/webhook] contato nao encontrado, criando', { cod_loja, telefone });
        contato = await tx.contato.create({
          data: {
            cod_loja,
            cliente_codigo,
            contato: contatoNome ?? 'Contato WhatsApp',
            telefone,
            tipo: contatoTipo ?? 'whatsapp',
          },
        });
      } else {
        console.info('[mensagens/webhook] contato existente encontrado', {
          contato_id: contato.id,
          cliente_codigo_atual: contato.cliente_codigo,
        });
        const updateData: any = {};
        const nomeContatoAtual = asNullableString(contato.contato);
        const nomeContatoAtualEhPlaceholder =
          !nomeContatoAtual || nomeContatoAtual.toLowerCase() === 'contato whatsapp';
        if (!fromMe && contatoNome && contatoNome !== contato.contato && nomeContatoAtualEhPlaceholder) {
          updateData.contato = contatoNome;
        }
        if (contatoTipo && contatoTipo !== contato.tipo) updateData.tipo = contatoTipo;
        if (cliente_codigo && cliente_codigo !== contato.cliente_codigo) updateData.cliente_codigo = cliente_codigo;
        if (Object.keys(updateData).length > 0) {
          console.info('[mensagens/webhook] atualizando contato', { contato_id: contato.id, updateData });
          contato = await tx.contato.update({
            where: { id: contato.id },
            data: updateData,
          });
        }
      }

      let atendimento = await tx.atendimento.findFirst({
        where: {
          cod_loja,
          contato_id: contato.id,
          status: STATUS_ABERTO,
        },
        orderBy: { id: 'desc' },
      });

      let novo_atendimento = false;
      if (!atendimento) {
        console.info('[mensagens/webhook] atendimento aberto nao encontrado, criando', {
          cod_loja,
          contato_id: contato.id,
        });
        atendimento = await tx.atendimento.create({
          data: {
            cod_loja,
            contato_id: contato.id,
            cliente_codigo: cliente_codigo ?? contato.cliente_codigo,
            origem,
            status: STATUS_ABERTO,
          },
        });
        novo_atendimento = true;
      } else {
        console.info('[mensagens/webhook] reutilizando atendimento aberto', {
          atendimento_id: atendimento.id,
          status: atendimento.status,
          usuario_id: atendimento.usuario_id,
        });
      }

      const mensagem = await tx.mensagem.create({
        data: {
          cod_loja,
          atendimento_id: atendimento.id,
          contato_id: contato.id,
          usuario_id,
          from_me: fromMe,
          direcao,
          tipo,
          texto,
          arquivo_base64: arquivo_base64 ?? undefined,
          arquivo_mimetype: arquivo_mimetype ?? undefined,
          payload: payload ?? undefined,
        },
      });

      console.info('[mensagens/webhook] mensagem registrada', {
        mensagem_id: mensagem.id,
        atendimento_id: atendimento.id,
        contato_id: contato.id,
      });

      return {
        atendimento_id: atendimento.id,
        mensagem_id: mensagem.id,
        contato_id: contato.id,
        novo_atendimento,
      };
    });

    return res.status(201).json({
      message: 'Mensagem processada com sucesso.',
      ...resultado,
    });
  } catch (error) {
    console.error('[mensagens/webhook] erro:', error);
    return res.status(500).json({ error: 'Erro ao processar mensagem.' });
  }
}

export async function enviarMensagem(req: Request, res: Response) {
  try {
    const cod_loja = asPositiveInt(req.body?.cod_loja);
    const atendimento_id = asPositiveInt(req.body?.atendimento_id);
    const usuario_id = asPositiveInt(req.body?.usuario_id);
    const direcao = parseDirection(req.body?.direcao ?? 'saida');
    const tipo = asNullableString(req.body?.tipo) ?? 'texto';
    const texto = asNullableString(req.body?.texto);
    const from_me = Object.prototype.hasOwnProperty.call(req.body ?? {}, 'fromMe')
      ? Boolean(req.body.fromMe)
      : direcao === 'saida';
    const arquivo_base64 = readFirstRawString(req.body?.arquivo_base64, req.body?.base64, req.body?.payload?.base64);
    const arquivo_mimetype =
      readFirstString(req.body?.arquivo_mimetype, req.body?.mimetype, req.body?.payload?.mimetype) ??
      extractMediaMimeTypeFromPayload(req.body, arquivo_base64) ??
      (arquivo_base64 ? defaultMimeTypeByTipo(tipo) ?? 'application/octet-stream' : null);
    const payload = Object.prototype.hasOwnProperty.call(req.body ?? {}, 'payload') ? req.body.payload : null;
    const iniciar_atendimento = Boolean(req.body?.iniciar_atendimento);

    if (!cod_loja || !atendimento_id || !usuario_id) {
      return res.status(400).json({ error: 'Campos cod_loja, atendimento_id e usuario_id sao obrigatorios.' });
    }
    if (!direcao) {
      return res.status(400).json({ error: "Campo direcao deve ser 'entrada' ou 'saida'." });
    }
    if (!texto && !arquivo_base64) {
      return res.status(400).json({ error: 'Informe texto ou arquivo_base64.' });
    }

    const resultado = await prisma.$transaction(async (tx) => {
      let atendimento = await tx.atendimento.findUnique({
        where: { id_cod_loja: { id: atendimento_id, cod_loja } },
      });
      if (!atendimento) {
        throw { status: 404, error: 'Atendimento nao encontrado.' };
      }
      if (!canAccessAtendimento(atendimento, usuario_id)) {
        throw { status: 403, error: 'Atendimento em posse de outro usuario.' };
      }
      if (atendimento.status === STATUS_FINALIZADO) {
        throw { status: 400, error: 'Atendimento finalizado. Nao e possivel enviar mensagens.' };
      }

      if (
        iniciar_atendimento &&
        atendimento.status === STATUS_ABERTO
      ) {
        atendimento = await tx.atendimento.update({
          where: { id: atendimento.id },
          data: {
            status: STATUS_EM_ATENDIMENTO,
            usuario_id,
            iniciado_em: new Date(),
          },
        });
      }

      const mensagem = await tx.mensagem.create({
        data: {
          cod_loja,
          atendimento_id: atendimento.id,
          contato_id: atendimento.contato_id,
          usuario_id,
          from_me,
          direcao,
          tipo,
          texto,
          arquivo_base64: arquivo_base64 ?? undefined,
          arquivo_mimetype: arquivo_mimetype ?? undefined,
          payload: payload ?? undefined,
        },
      });

      return {
        atendimento_id: atendimento.id,
        mensagem_id: mensagem.id,
        status_atendimento: atendimento.status,
      };
    });

    return res.status(201).json({
      message: 'Mensagem registrada com sucesso.',
      ...resultado,
    });
  } catch (error: any) {
    if (error?.status) {
      return res.status(error.status).json({ error: error.error });
    }
    console.error('Erro em enviarMensagem:', error);
    return res.status(500).json({ error: 'Erro ao enviar mensagem.' });
  }
}

export async function listarMensagensAtendimento(req: Request, res: Response) {
  try {
    const cod_loja = asPositiveInt(req.query?.cod_loja);
    const cod_usuario = asNullablePositiveInt(req.query?.cod_usuario);
    const atendimento_id = asPositiveInt(req.params?.atendimento_id);
    const limit = Math.max(1, Math.min(500, Number(req.query?.limit) || 100));
    const offset = Math.max(0, Number(req.query?.offset) || 0);

    if (!cod_loja || !atendimento_id) {
      return res.status(400).json({ error: 'Campos cod_loja e atendimento_id sao obrigatorios.' });
    }

    const atendimento = await prisma.atendimento.findUnique({
      where: { id_cod_loja: { id: atendimento_id, cod_loja } },
      include: { contato: true },
    });
    if (!atendimento) {
      return res.status(404).json({ error: 'Atendimento nao encontrado.' });
    }

    if (!canAccessAtendimento(atendimento, cod_usuario)) {
      return res.status(403).json({ error: 'Atendimento em posse de outro usuario.' });
    }

    const total = await prisma.mensagem.count({
      where: { cod_loja, atendimento_id },
    });

    const mensagens = await prisma.mensagem.findMany({
      where: { cod_loja, atendimento_id },
      orderBy: { criado_em: 'asc' },
      skip: offset,
      take: limit,
    });

    return res.json({
      total,
      data: mensagens,
      atendimento: {
        id: atendimento.id,
        status: atendimento.status,
        usuario_id: atendimento.usuario_id,
        contato_id: atendimento.contato_id,
        contato: atendimento.contato?.contato ?? null,
        telefone: atendimento.contato?.telefone ?? null,
      },
      nextOffset: offset + limit < total ? offset + limit : null,
    });
  } catch (error) {
    console.error('Erro em listarMensagensAtendimento:', error);
    return res.status(500).json({ error: 'Erro ao listar mensagens.' });
  }
}

export async function listarMensagensContato(req: Request, res: Response) {
  try {
    const cod_loja = asPositiveInt(req.query?.cod_loja);
    const cod_usuario = asNullablePositiveInt(req.query?.cod_usuario);
    const contato_id = asPositiveInt(req.params?.contato_id);
    const limit = Math.max(1, Math.min(500, Number(req.query?.limit) || 100));
    const offset = Math.max(0, Number(req.query?.offset) || 0);

    if (!cod_loja || !contato_id) {
      return res.status(400).json({ error: 'Campos cod_loja e contato_id sao obrigatorios.' });
    }

    const contato = await prisma.contato.findUnique({
      where: { id_cod_loja: { id: contato_id, cod_loja } },
    });
    if (!contato) {
      return res.status(404).json({ error: 'Contato nao encontrado.' });
    }

    const atendimentosVisiveis = await prisma.atendimento.findMany({
      where: {
        cod_loja,
        contato_id,
        OR: [
          { status: STATUS_ABERTO },
          { status: STATUS_FINALIZADO },
          {
            status: STATUS_EM_ATENDIMENTO,
            OR: [
              { usuario_id: null },
              ...(cod_usuario ? [{ usuario_id: cod_usuario }] : []),
            ],
          },
        ],
      },
      select: { id: true },
    });

    const atendimentoIds = atendimentosVisiveis.map((a) => a.id);
    if (atendimentoIds.length === 0) {
      return res.json({ total: 0, data: [], contato });
    }

    const total = await prisma.mensagem.count({
      where: {
        cod_loja,
        contato_id,
        atendimento_id: { in: atendimentoIds },
      },
    });

    const mensagens = await prisma.mensagem.findMany({
      where: {
        cod_loja,
        contato_id,
        atendimento_id: { in: atendimentoIds },
      },
      orderBy: { criado_em: 'asc' },
      skip: offset,
      take: limit,
    });

    return res.json({
      total,
      data: mensagens,
      contato,
      nextOffset: offset + limit < total ? offset + limit : null,
    });
  } catch (error) {
    console.error('Erro em listarMensagensContato:', error);
    return res.status(500).json({ error: 'Erro ao listar mensagens do contato.' });
  }
}

export async function listarAtendimentos(req: Request, res: Response) {
  try {
    const cod_loja = asPositiveInt(req.query?.cod_loja);
    const cod_usuario = asNullablePositiveInt(req.query?.cod_usuario);
    const contato_id = asNullablePositiveInt(req.query?.contato_id);
    const statusInput = asNullableString(req.query?.status);
    const status = parseStatusAtendimento(statusInput);
    const limit = Math.max(1, Math.min(500, Number(req.query?.limit) || 100));
    const offset = Math.max(0, Number(req.query?.offset) || 0);

    if (!cod_loja) {
      return res.status(400).json({ error: 'Campo cod_loja e obrigatorio.' });
    }
    if (statusInput && !status) {
      return res.status(400).json({ error: "Campo status deve ser 'aberto', 'em_atendimento' ou 'finalizado'." });
    }

    const where: any = {
      cod_loja,
      ...(contato_id ? { contato_id } : {}),
    };

    if (status === STATUS_EM_ATENDIMENTO) {
      where.status = STATUS_EM_ATENDIMENTO;
      where.OR = [
        { usuario_id: null },
        ...(cod_usuario ? [{ usuario_id: cod_usuario }] : []),
      ];
    } else if (status === STATUS_ABERTO || status === STATUS_FINALIZADO) {
      where.status = status;
    } else {
      where.OR = [
        { status: STATUS_ABERTO },
        { status: STATUS_FINALIZADO },
        {
          status: STATUS_EM_ATENDIMENTO,
          OR: [
            { usuario_id: null },
            ...(cod_usuario ? [{ usuario_id: cod_usuario }] : []),
          ],
        },
      ];
    }

    const total = await prisma.atendimento.count({ where });
    const atendimentos = await prisma.atendimento.findMany({
      where,
      include: {
        contato: true,
        _count: { select: { mensagens: true } },
      },
      orderBy: [{ updated_at: 'desc' }, { id: 'desc' }],
      skip: offset,
      take: limit,
    });

    return res.json({
      total,
      data: atendimentos.map((a) => ({
        id: a.id,
        cod_loja: a.cod_loja,
        contato_id: a.contato_id,
        cliente_codigo: a.cliente_codigo,
        usuario_id: a.usuario_id,
        origem: a.origem,
        status: a.status,
        aberto_em: a.aberto_em,
        iniciado_em: a.iniciado_em,
        finalizado_em: a.finalizado_em,
        created_at: a.created_at,
        updated_at: a.updated_at,
        total_mensagens: a._count.mensagens,
        contato: a.contato
          ? {
              id: a.contato.id,
              contato: a.contato.contato,
              telefone: a.contato.telefone,
              tipo: a.contato.tipo,
            }
          : null,
      })),
      nextOffset: offset + limit < total ? offset + limit : null,
    });
  } catch (error) {
    console.error('Erro em listarAtendimentos:', error);
    return res.status(500).json({ error: 'Erro ao listar atendimentos.' });
  }
}

export async function iniciarAtendimento(req: Request, res: Response) {
  try {
    const cod_loja = asPositiveInt(req.body?.cod_loja);
    const cod_usuario = asPositiveInt(req.body?.cod_usuario);
    const atendimento_id = asPositiveInt(req.params?.atendimento_id);

    if (!cod_loja || !cod_usuario || !atendimento_id) {
      return res.status(400).json({ error: 'Campos cod_loja, cod_usuario e atendimento_id sao obrigatorios.' });
    }

    const atendimento = await prisma.atendimento.findUnique({
      where: { id_cod_loja: { id: atendimento_id, cod_loja } },
    });
    if (!atendimento) {
      return res.status(404).json({ error: 'Atendimento nao encontrado.' });
    }
    if (atendimento.status === STATUS_FINALIZADO) {
      return res.status(400).json({ error: 'Atendimento finalizado nao pode ser iniciado.' });
    }
    if (atendimento.status === STATUS_EM_ATENDIMENTO && atendimento.usuario_id && atendimento.usuario_id !== cod_usuario) {
      return res.status(409).json({ error: 'Atendimento ja esta em atendimento por outro usuario.' });
    }

    const atualizado = await prisma.atendimento.update({
      where: { id: atendimento.id },
      data: {
        status: STATUS_EM_ATENDIMENTO,
        usuario_id: cod_usuario,
        iniciado_em: atendimento.iniciado_em ?? new Date(),
      },
    });

    return res.json({
      message: 'Atendimento iniciado com sucesso.',
      id: atualizado.id,
      status: atualizado.status,
      usuario_id: atualizado.usuario_id,
    });
  } catch (error) {
    console.error('Erro em iniciarAtendimento:', error);
    return res.status(500).json({ error: 'Erro ao iniciar atendimento.' });
  }
}

export async function finalizarAtendimento(req: Request, res: Response) {
  try {
    const cod_loja = asPositiveInt(req.body?.cod_loja);
    const cod_usuario = asNullablePositiveInt(req.body?.cod_usuario);
    const atendimento_id = asPositiveInt(req.params?.atendimento_id);

    if (!cod_loja || !atendimento_id) {
      return res.status(400).json({ error: 'Campos cod_loja e atendimento_id sao obrigatorios.' });
    }

    const atendimento = await prisma.atendimento.findUnique({
      where: { id_cod_loja: { id: atendimento_id, cod_loja } },
    });
    if (!atendimento) {
      return res.status(404).json({ error: 'Atendimento nao encontrado.' });
    }
    if (atendimento.status === STATUS_EM_ATENDIMENTO && atendimento.usuario_id && cod_usuario && atendimento.usuario_id !== cod_usuario) {
      return res.status(403).json({ error: 'Atendimento em posse de outro usuario.' });
    }

    const atualizado = await prisma.atendimento.update({
      where: { id: atendimento.id },
      data: {
        status: STATUS_FINALIZADO,
        finalizado_em: atendimento.finalizado_em ?? new Date(),
      },
    });

    return res.json({
      message: 'Atendimento finalizado com sucesso.',
      id: atualizado.id,
      status: atualizado.status,
      finalizado_em: atualizado.finalizado_em,
    });
  } catch (error) {
    console.error('Erro em finalizarAtendimento:', error);
    return res.status(500).json({ error: 'Erro ao finalizar atendimento.' });
  }
}
