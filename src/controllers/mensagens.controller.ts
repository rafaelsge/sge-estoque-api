import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import fetch from 'node-fetch';
import { prisma } from '../prismaClient';
import { resolveContactName } from '../utils/evolution-contact-name';

const STATUS_ABERTO = 'aberto' as const;
const STATUS_EM_ATENDIMENTO = 'em_atendimento' as const;
const STATUS_FINALIZADO = 'finalizado' as const;
const STATUS_ATENDIMENTO_VALIDOS = new Set([
  STATUS_ABERTO,
  STATUS_EM_ATENDIMENTO,
  STATUS_FINALIZADO,
]);
const STATUS_FLUXO_INICIADO = 'iniciado' as const;
const STATUS_FLUXO_AGUARDANDO = 'aguardando' as const;
const STATUS_FLUXO_FINALIZADO = 'finalizado' as const;
const PROFILE_PICTURE_TTL_MS = 6 * 60 * 60 * 1000;
const PROFILE_PICTURE_FETCH_TIMEOUT_MS = 10000;
type PrismaDbClient = Prisma.TransactionClient | typeof prisma;
type NormalizedEvolutionMessage = {
  instance_name: string | null;
  message_id: string | null;
  remote_jid: string | null;
  chat_jid: string | null;
  contact_jid: string | null;
  contact_phone_normalized: string | null;
  sender_jid: string | null;
  participant_jid: string | null;
  from_me: boolean;
  direction: 'entrada' | 'saida';
  message_type: string;
  message_text: string | null;
  caption: string | null;
  media_url: string | null;
  media_mime_type: string | null;
  media_file_name: string | null;
  quoted_message_id: string | null;
  quoted_message_text: string | null;
  quoted_remote_jid: string | null;
  status: string;
  message_timestamp: Date | null;
  push_name: string | null;
  payload_raw_json: string;
  source_event_type: string;
  received_at: Date;
  processed_at: Date;
  arquivo_base64: string | null;
};
type ContactProfilePhotoFetchResult = {
  ok: boolean;
  statusCode: number | null;
  wuid: string | null;
  profilePictureUrl: string | null;
  reason: string | null;
};

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

function safeJsonStringify(payload: unknown): string {
  try {
    const raw = JSON.stringify(payload ?? null);
    return raw ?? 'null';
  } catch {
    return JSON.stringify({ serialization_error: true });
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

function readFirstValue<T>(...values: T[]): T | null {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
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

function normalizeProfilePictureUrl(value: unknown): string | null {
  const raw = asNullableString(value);
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

function shouldRefreshProfilePicture(
  contato: { profile_picture_url: string | null; profile_picture_checked_at: Date | null } | null,
  force = false,
): boolean {
  if (force) return true;
  if (!contato) return true;
  if (!contato.profile_picture_url) {
    if (!contato.profile_picture_checked_at) return true;
    return Date.now() - contato.profile_picture_checked_at.getTime() >= PROFILE_PICTURE_TTL_MS;
  }
  if (!contato.profile_picture_checked_at) return true;
  return Date.now() - contato.profile_picture_checked_at.getTime() >= PROFILE_PICTURE_TTL_MS;
}

function normalizeProfileLookupNumber(value: unknown): string | null {
  const raw = asNullableString(value);
  if (!raw) return null;

  if (raw.includes('@')) {
    const base = raw.split(':')[0].trim();
    return base || null;
  }

  const normalizedPhone = normalizePhone(raw);
  return normalizedPhone || null;
}

function normalizeJid(value: unknown): string | null {
  const raw = asNullableString(value);
  return raw ?? null;
}

function isGroupJid(value: string | null): boolean {
  return Boolean(value && value.includes('@g.us'));
}

function parseMessageTimestamp(value: unknown): Date | null {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d+$/.test(trimmed)) {
      return parseMessageTimestamp(Number(trimmed));
    }
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    const normalized = value < 1e12 ? value * 1000 : value;
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
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
    payload?.data?.message?.editedMessage?.message?.conversation,
    payload?.data?.message?.editedMessage?.message?.extendedTextMessage?.text,
    payload?.message?.editedMessage?.message?.conversation,
    payload?.message?.editedMessage?.message?.extendedTextMessage?.text,
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

  const messageObj =
    payload?.data?.update?.message ??
    payload?.update?.message ??
    payload?.data?.message ??
    payload?.message ??
    payload?.event?.message;
  if (!messageObj || typeof messageObj !== 'object') return null;

  if (messageObj.conversation || messageObj.extendedTextMessage) return 'texto';
  if (messageObj.imageMessage) return 'imagem';
  if (messageObj.videoMessage) return 'video';
  if (messageObj.audioMessage) return 'audio';
  if (messageObj.documentMessage) return 'documento';
  if (messageObj.stickerMessage) return 'sticker';
  if (messageObj.editedMessage) return 'edicao';
  if (messageObj.protocolMessage) return 'protocolo';
  if (messageObj.reactionMessage) return 'reacao';

  return null;
}

function normalizeUrl(value: unknown): string | null {
  const raw = asNullableString(value);
  if (!raw) return null;
  return raw.replace(/\/+$/, '').toLowerCase();
}

async function fetchContactProfilePhoto(
  instanceName: string,
  remoteJidOrPhone: string,
  evolutionUrl: string,
  evolutionApiKey: string,
): Promise<ContactProfilePhotoFetchResult> {
  const normalizedLookup = normalizeProfileLookupNumber(remoteJidOrPhone);
  if (!normalizedLookup) {
    console.info('[contato/profile-photo] tentativa ignorada: lookup invalido', {
      instance_name: instanceName,
      lookup: remoteJidOrPhone,
    });
    return {
      ok: false,
      statusCode: null,
      wuid: null,
      profilePictureUrl: null,
      reason: 'invalid-number',
    };
  }

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), PROFILE_PICTURE_FETCH_TIMEOUT_MS);
  const endpoint = `${evolutionUrl}/chat/fetchProfilePictureUrl/${encodeURIComponent(instanceName)}`;

  console.info('[contato/profile-photo] tentativa', {
    instance_name: instanceName,
    lookup: normalizedLookup,
  });

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: evolutionApiKey,
      },
      body: JSON.stringify({ number: normalizedLookup }),
      signal: controller.signal,
    });

    const rawBody = await response.text();
    let parsedBody: any = null;
    try {
      parsedBody = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      parsedBody = null;
    }

    const result: ContactProfilePhotoFetchResult = {
      ok: response.ok,
      statusCode: response.status,
      wuid: asNullableString(parsedBody?.wuid),
      profilePictureUrl: normalizeProfilePictureUrl(parsedBody?.profilePictureUrl),
      reason: response.ok ? null : asNullableString(parsedBody?.message) ?? response.statusText ?? 'request-failed',
    };

    console.info('[contato/profile-photo] resposta', {
      instance_name: instanceName,
      lookup: normalizedLookup,
      status_code: response.status,
      wuid: result.wuid,
      has_profile_picture_url: Boolean(result.profilePictureUrl),
      reason: result.reason,
    });

    return result;
  } catch (error: any) {
    const reason = error?.name === 'AbortError' ? 'timeout' : 'request-error';
    console.warn('[contato/profile-photo] falha na consulta', {
      instance_name: instanceName,
      lookup: normalizedLookup,
      reason,
      error: error?.message ?? String(error),
    });
    return {
      ok: false,
      statusCode: null,
      wuid: null,
      profilePictureUrl: null,
      reason,
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function tryRefreshContactProfilePhoto(params: {
  contatoId: number;
  codLoja: number;
  instanceName?: string | null;
  remoteJid?: string | null;
  phone?: string | null;
  force?: boolean;
}) {
  const contato = await prisma.contato.findUnique({
    where: { id_cod_loja: { id: params.contatoId, cod_loja: params.codLoja } },
    select: {
      id: true,
      cod_loja: true,
      telefone: true,
      profile_picture_url: true,
      profile_picture_checked_at: true,
    },
  });

  if (!contato) return null;
  if (!shouldRefreshProfilePicture(contato, params.force)) return contato;

  const loja = await prisma.loja.findFirst({
    where: { codigo: params.codLoja },
    select: {
      evolution_url: true,
      evolution_instancia: true,
      evolution_apikey: true,
    },
  });

  const instanceName = params.instanceName ?? loja?.evolution_instancia ?? null;
  const evolutionUrl = normalizeUrl(loja?.evolution_url);
  const evolutionApiKey = asNullableString(loja?.evolution_apikey);
  const lookup = params.remoteJid ?? params.phone ?? contato.telefone;

  if (!instanceName || !evolutionUrl || !evolutionApiKey || !lookup) {
    console.info('[contato/profile-photo] tentativa ignorada: configuracao incompleta', {
      contato_id: params.contatoId,
      cod_loja: params.codLoja,
      has_instance: Boolean(instanceName),
      has_url: Boolean(evolutionUrl),
      has_lookup: Boolean(lookup),
      has_apikey: Boolean(evolutionApiKey),
    });
    await prisma.contato.update({
      where: { id: contato.id },
      data: {
        profile_picture_checked_at: new Date(),
      },
    });
    return contato;
  }

  const result = await fetchContactProfilePhoto(instanceName, lookup, evolutionUrl, evolutionApiKey);

  await prisma.contato.update({
    where: { id: contato.id },
    data: {
      profile_picture_url: result.profilePictureUrl ?? undefined,
      profile_picture_checked_at: new Date(),
    },
  });

  return {
    ...contato,
    profile_picture_url: result.profilePictureUrl ?? contato.profile_picture_url,
    profile_picture_checked_at: new Date(),
  };
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

function extractSourceEventType(payload: any, requestPath: string): string {
  const routeEvent = requestPath
    .split('/webhook/')
    .map((part) => part.trim())
    .find(Boolean);

  return readFirstString(
    payload?.event,
    payload?.eventType,
    payload?.data?.event,
    payload?.data?.eventType,
    routeEvent,
  ) ?? 'messages.upsert';
}

function extractMessageObject(payload: any): any {
  return (
    payload?.data?.update?.message ??
    payload?.update?.message ??
    payload?.data?.message ??
    payload?.message ??
    payload?.event?.message ??
    null
  );
}

function extractContextInfo(payload: any): any {
  const messageObj = extractMessageObject(payload);
  if (!messageObj || typeof messageObj !== 'object') return null;

  const candidates = [
    messageObj.extendedTextMessage?.contextInfo,
    messageObj.imageMessage?.contextInfo,
    messageObj.videoMessage?.contextInfo,
    messageObj.documentMessage?.contextInfo,
    messageObj.audioMessage?.contextInfo,
    messageObj.buttonsResponseMessage?.contextInfo,
    messageObj.listResponseMessage?.contextInfo,
    messageObj.templateButtonReplyMessage?.contextInfo,
    messageObj.editedMessage?.message?.extendedTextMessage?.contextInfo,
    messageObj.editedMessage?.message?.imageMessage?.contextInfo,
    messageObj.editedMessage?.message?.videoMessage?.contextInfo,
    messageObj.editedMessage?.message?.documentMessage?.contextInfo,
  ];

  return candidates.find((candidate) => candidate && typeof candidate === 'object') ?? null;
}

function extractRemoteJidFromPayload(payload: any): string | null {
  return normalizeJid(
    readFirstString(
      payload?.data?.remoteJid,
      payload?.remoteJid,
      payload?.data?.key?.remoteJid,
      payload?.key?.remoteJid,
      payload?.data?.keys?.[0]?.remoteJid,
      payload?.keys?.[0]?.remoteJid,
      payload?.data?.message?.protocolMessage?.key?.remoteJid,
      payload?.message?.protocolMessage?.key?.remoteJid,
    ),
  );
}

function extractParticipantJidFromPayload(payload: any): string | null {
  return normalizeJid(
    readFirstString(
      payload?.data?.participant,
      payload?.participant,
      payload?.data?.key?.participant,
      payload?.key?.participant,
      payload?.data?.keys?.[0]?.participant,
      payload?.keys?.[0]?.participant,
    ),
  );
}

function extractChatJidFromPayload(payload: any, remoteJid: string | null): string | null {
  return normalizeJid(
    readFirstString(
      payload?.data?.remoteJid,
      payload?.remoteJid,
      payload?.data?.key?.remoteJid,
      payload?.key?.remoteJid,
      payload?.data?.keys?.[0]?.remoteJid,
      payload?.keys?.[0]?.remoteJid,
      extractContextInfo(payload)?.remoteJid,
      remoteJid,
    ),
  );
}

function extractSenderJidFromPayload(payload: any, remoteJid: string | null, participantJid: string | null): string | null {
  return normalizeJid(
    readFirstString(
      payload?.data?.senderJid,
      payload?.senderJid,
      payload?.data?.sender,
      payload?.sender,
      participantJid,
      !isGroupJid(remoteJid) ? remoteJid : null,
    ),
  );
}

function resolveContactJid(
  remoteJid: string | null,
  chatJid: string | null,
  participantJid: string | null,
  senderJid: string | null,
): string | null {
  if (isGroupJid(chatJid ?? remoteJid)) {
    return participantJid ?? senderJid ?? null;
  }
  return remoteJid ?? senderJid ?? null;
}

function isDeleteEvent(payload: any, sourceEventType: string): boolean {
  const normalizedEvent = sourceEventType.toLowerCase();
  const protocolType = String(
    readFirstValue(
      payload?.data?.message?.protocolMessage?.type,
      payload?.message?.protocolMessage?.type,
      payload?.data?.update?.message?.protocolMessage?.type,
      payload?.update?.message?.protocolMessage?.type,
    ) ?? '',
  ).toUpperCase();

  return (
    normalizedEvent.includes('delete') ||
    normalizedEvent.includes('revoke') ||
    protocolType === 'REVOKE' ||
    protocolType === '0'
  );
}

function isEditedEvent(payload: any, sourceEventType: string): boolean {
  const normalizedEvent = sourceEventType.toLowerCase();
  return (
    normalizedEvent.includes('edit') ||
    Boolean(payload?.data?.message?.editedMessage) ||
    Boolean(payload?.message?.editedMessage) ||
    Boolean(payload?.data?.update?.message?.editedMessage) ||
    Boolean(payload?.update?.message?.editedMessage)
  );
}

function extractMessageId(payload: any, sourceEventType: string): string | null {
  if (isDeleteEvent(payload, sourceEventType)) {
    return readFirstString(
      payload?.data?.message?.protocolMessage?.key?.id,
      payload?.message?.protocolMessage?.key?.id,
      payload?.data?.keys?.[0]?.id,
      payload?.keys?.[0]?.id,
      payload?.data?.keyId,
      payload?.data?.key?.id,
      payload?.key?.id,
    );
  }

  if (sourceEventType.toLowerCase().includes('update')) {
    return readFirstString(
      payload?.data?.keyId,
      payload?.data?.key?.id,
      payload?.key?.id,
      payload?.data?.messages?.[0]?.key?.id,
      payload?.messages?.[0]?.key?.id,
      payload?.data?.id,
      payload?.id,
    );
  }

  return readFirstString(
    payload?.data?.key?.id,
    payload?.key?.id,
    payload?.data?.messages?.[0]?.key?.id,
    payload?.messages?.[0]?.key?.id,
    payload?.data?.messageId,
    payload?.messageId,
    payload?.data?.id,
    payload?.id,
  );
}

function extractCaptionFromPayload(payload: any): string | null {
  return readFirstString(
    payload?.caption,
    payload?.data?.caption,
    payload?.message?.imageMessage?.caption,
    payload?.message?.videoMessage?.caption,
    payload?.data?.message?.imageMessage?.caption,
    payload?.data?.message?.videoMessage?.caption,
    payload?.event?.message?.imageMessage?.caption,
    payload?.event?.message?.videoMessage?.caption,
    payload?.data?.message?.editedMessage?.message?.imageMessage?.caption,
    payload?.data?.message?.editedMessage?.message?.videoMessage?.caption,
    payload?.message?.editedMessage?.message?.imageMessage?.caption,
    payload?.message?.editedMessage?.message?.videoMessage?.caption,
  );
}

function extractMediaUrlFromPayload(payload: any): string | null {
  return readFirstString(
    payload?.mediaUrl,
    payload?.media_url,
    payload?.data?.mediaUrl,
    payload?.data?.media_url,
    payload?.message?.imageMessage?.url,
    payload?.message?.videoMessage?.url,
    payload?.message?.audioMessage?.url,
    payload?.message?.documentMessage?.url,
    payload?.data?.message?.imageMessage?.url,
    payload?.data?.message?.videoMessage?.url,
    payload?.data?.message?.audioMessage?.url,
    payload?.data?.message?.documentMessage?.url,
    payload?.data?.message?.editedMessage?.message?.imageMessage?.url,
    payload?.data?.message?.editedMessage?.message?.videoMessage?.url,
    payload?.data?.message?.editedMessage?.message?.documentMessage?.url,
  );
}

function extractMediaFileNameFromPayload(payload: any): string | null {
  return readFirstString(
    payload?.fileName,
    payload?.filename,
    payload?.data?.fileName,
    payload?.data?.filename,
    payload?.message?.documentMessage?.fileName,
    payload?.data?.message?.documentMessage?.fileName,
    payload?.data?.message?.editedMessage?.message?.documentMessage?.fileName,
  );
}

function extractQuotedMessageId(payload: any): string | null {
  const contextInfo = extractContextInfo(payload);
  return readFirstString(
    contextInfo?.stanzaId,
    payload?.data?.quoted?.key?.id,
    payload?.quoted?.key?.id,
    payload?.data?.quotedMessage?.key?.id,
    payload?.quotedMessage?.key?.id,
  );
}

function extractQuotedMessageText(payload: any): string | null {
  const contextInfo = extractContextInfo(payload);
  const quotedMessage =
    contextInfo?.quotedMessage ??
    payload?.data?.quotedMessage?.message ??
    payload?.quotedMessage?.message ??
    payload?.data?.quoted?.message ??
    payload?.quoted?.message;

  return readFirstString(
    quotedMessage?.conversation,
    quotedMessage?.extendedTextMessage?.text,
    quotedMessage?.imageMessage?.caption,
    quotedMessage?.videoMessage?.caption,
    quotedMessage?.documentMessage?.caption,
  );
}

function extractQuotedRemoteJid(payload: any, chatJid: string | null): string | null {
  const contextInfo = extractContextInfo(payload);
  return normalizeJid(
    readFirstString(
      contextInfo?.remoteJid,
      contextInfo?.participant,
      payload?.data?.quoted?.key?.remoteJid,
      payload?.quoted?.key?.remoteJid,
      chatJid,
    ),
  );
}

function extractMessageStatus(payload: any, sourceEventType: string, fromMe: boolean): string {
  const explicitStatus = asNullableString(
    readFirstValue(
      payload?.status,
      payload?.data?.status,
      payload?.event?.status,
      payload?.data?.messageStatus,
      payload?.messageStatus,
      payload?.data?.ack,
      payload?.ack,
    ),
  );

  if (isDeleteEvent(payload, sourceEventType)) return 'deleted';
  if (isEditedEvent(payload, sourceEventType)) return 'edited';
  if (sourceEventType.toLowerCase().includes('update')) {
    return explicitStatus?.toLowerCase() ?? 'updated';
  }

  return explicitStatus?.toLowerCase() ?? (fromMe ? 'sent' : 'received');
}

function extractNormalizedMessage(payload: any, requestPath: string, receivedAt: Date): NormalizedEvolutionMessage {
  const source_event_type = extractSourceEventType(payload, requestPath);
  const instance_name = readFirstString(
    payload?.instance,
    payload?.instanceName,
    payload?.instance_name,
    payload?.instancia,
    payload?.data?.instance,
    payload?.data?.instanceName,
    payload?.event?.instance,
  );
  const from_me = extractFromMe(payload);
  const remote_jid = extractRemoteJidFromPayload(payload);
  const participant_jid = extractParticipantJidFromPayload(payload);
  const chat_jid = extractChatJidFromPayload(payload, remote_jid);
  const sender_jid = extractSenderJidFromPayload(payload, remote_jid, participant_jid);
  const contact_jid = resolveContactJid(remote_jid, chat_jid, participant_jid, sender_jid);
  const contactPhoneNormalized = normalizePhone(contact_jid ?? remote_jid) || null;
  const direction = parseDirection(payload?.direcao) ?? (from_me ? 'saida' : 'entrada');
  const message_type = inferTipoFromPayload(payload) ?? 'desconhecido';
  const caption = extractCaptionFromPayload(payload);
  const message_text = extractTextFromPayload(payload) ?? caption;
  const arquivo_base64 = extractMediaBase64FromPayload(payload);
  const media_mime_type =
    extractMediaMimeTypeFromPayload(payload, arquivo_base64) ??
    (arquivo_base64 ? defaultMimeTypeByTipo(message_type) ?? 'application/octet-stream' : null);
  const processedAt = new Date();

  return {
    instance_name,
    message_id: extractMessageId(payload, source_event_type),
    remote_jid,
    chat_jid,
    contact_jid,
    contact_phone_normalized: contactPhoneNormalized,
    sender_jid,
    participant_jid,
    from_me,
    direction,
    message_type,
    message_text,
    caption,
    media_url: extractMediaUrlFromPayload(payload),
    media_mime_type,
    media_file_name: extractMediaFileNameFromPayload(payload),
    quoted_message_id: extractQuotedMessageId(payload),
    quoted_message_text: extractQuotedMessageText(payload),
    quoted_remote_jid: extractQuotedRemoteJid(payload, chat_jid ?? remote_jid),
    status: extractMessageStatus(payload, source_event_type, from_me),
    message_timestamp: parseMessageTimestamp(
      readFirstValue(
        payload?.data?.messageTimestamp,
        payload?.messageTimestamp,
        payload?.data?.timestamp,
        payload?.timestamp,
        payload?.data?.message?.messageTimestamp,
        payload?.message?.messageTimestamp,
        payload?.data?.messageTimestampLow,
      ),
    ),
    push_name: extractContactNameFromPayload(payload),
    payload_raw_json: safeJsonStringify(payload),
    source_event_type,
    received_at: receivedAt,
    processed_at: processedAt,
    arquivo_base64,
  };
}

function hasPersistableMessageContent(message: Pick<NormalizedEvolutionMessage, 'message_text' | 'caption' | 'media_url' | 'media_mime_type' | 'arquivo_base64'>): boolean {
  return Boolean(
    message.message_text ||
    message.caption ||
    message.media_url ||
    message.media_mime_type ||
    message.arquivo_base64,
  );
}

function shouldCreateAttendanceMessage(
  message: NormalizedEvolutionMessage,
  existingRecord: { legacy_mensagem_id: number | null } | null,
): boolean {
  if (existingRecord?.legacy_mensagem_id) return false;
  if (message.status === 'deleted') return false;
  if (message.status === 'edited') return false;
  if (message.source_event_type.toLowerCase().includes('update')) return false;
  return hasPersistableMessageContent(message);
}

function buildMensagemIngestaoCreateData(message: NormalizedEvolutionMessage, cod_loja: number | null) {
  return {
    cod_loja: cod_loja ?? undefined,
    instance_name: message.instance_name!,
    message_id: message.message_id!,
    remote_jid: message.remote_jid ?? undefined,
    chat_jid: message.chat_jid ?? undefined,
    contact_jid: message.contact_jid ?? undefined,
    contact_phone_normalized: message.contact_phone_normalized ?? undefined,
    sender_jid: message.sender_jid ?? undefined,
    participant_jid: message.participant_jid ?? undefined,
    from_me: message.from_me,
    direction: message.direction,
    message_type: message.message_type,
    message_text: message.message_text ?? undefined,
    caption: message.caption ?? undefined,
    media_url: message.media_url ?? undefined,
    media_mime_type: message.media_mime_type ?? undefined,
    media_file_name: message.media_file_name ?? undefined,
    quoted_message_id: message.quoted_message_id ?? undefined,
    quoted_message_text: message.quoted_message_text ?? undefined,
    quoted_remote_jid: message.quoted_remote_jid ?? undefined,
    status: message.status,
    message_timestamp: message.message_timestamp ?? undefined,
    push_name: message.push_name ?? undefined,
    payload_raw_json: message.payload_raw_json,
    source_event_type: message.source_event_type,
    received_at: message.received_at,
    processed_at: message.processed_at,
    deleted_at: message.status === 'deleted' ? message.processed_at : undefined,
    edited_at: message.status === 'edited' ? message.processed_at : undefined,
  };
}

function buildMensagemIngestaoUpdateData(existing: any, message: NormalizedEvolutionMessage, cod_loja: number | null) {
  return {
    cod_loja: existing.cod_loja ?? cod_loja ?? undefined,
    remote_jid: existing.remote_jid ?? message.remote_jid ?? undefined,
    chat_jid: existing.chat_jid ?? message.chat_jid ?? undefined,
    contact_jid: message.contact_jid ?? existing.contact_jid ?? undefined,
    contact_phone_normalized: message.contact_phone_normalized ?? existing.contact_phone_normalized ?? undefined,
    sender_jid: message.sender_jid ?? existing.sender_jid ?? undefined,
    participant_jid: message.participant_jid ?? existing.participant_jid ?? undefined,
    from_me: message.from_me,
    direction: message.direction,
    message_type:
      message.message_type !== 'desconhecido' || !existing.message_type
        ? message.message_type
        : existing.message_type,
    message_text: message.message_text ?? existing.message_text ?? undefined,
    caption: message.caption ?? existing.caption ?? undefined,
    media_url: message.media_url ?? existing.media_url ?? undefined,
    media_mime_type: message.media_mime_type ?? existing.media_mime_type ?? undefined,
    media_file_name: message.media_file_name ?? existing.media_file_name ?? undefined,
    quoted_message_id: message.quoted_message_id ?? existing.quoted_message_id ?? undefined,
    quoted_message_text: message.quoted_message_text ?? existing.quoted_message_text ?? undefined,
    quoted_remote_jid: message.quoted_remote_jid ?? existing.quoted_remote_jid ?? undefined,
    status: message.status ?? existing.status,
    message_timestamp: message.message_timestamp ?? existing.message_timestamp ?? undefined,
    push_name: message.push_name ?? existing.push_name ?? undefined,
    payload_raw_json: message.payload_raw_json,
    source_event_type: message.source_event_type,
    processed_at: message.processed_at,
    deleted_at:
      message.status === 'deleted'
        ? existing.deleted_at ?? message.processed_at
        : existing.deleted_at ?? undefined,
    edited_at:
      message.status === 'edited'
        ? message.processed_at
        : existing.edited_at ?? undefined,
  };
}

async function upsertMensagemIngestao(
  client: PrismaDbClient,
  message: NormalizedEvolutionMessage,
  cod_loja: number | null,
) {
  const existing = await client.mensagem_ingestao.findUnique({
    where: {
      instance_name_message_id: {
        instance_name: message.instance_name!,
        message_id: message.message_id!,
      },
    },
  });

  if (!existing) {
    const created = await client.mensagem_ingestao.create({
      data: buildMensagemIngestaoCreateData(message, cod_loja),
    });
    return { record: created, created: true };
  }

  const updated = await client.mensagem_ingestao.update({
    where: { id: existing.id },
    data: buildMensagemIngestaoUpdateData(existing, message, cod_loja),
  });

  return { record: updated, created: false };
}

async function registrarEventoIngestao(
  client: PrismaDbClient,
  message: Pick<NormalizedEvolutionMessage, 'instance_name' | 'message_id' | 'source_event_type' | 'payload_raw_json' | 'received_at' | 'processed_at'>,
  mensagemIngestaoId?: number,
) {
  return client.mensagem_ingestao_evento.create({
    data: {
      mensagem_ingestao_id: mensagemIngestaoId,
      instance_name: message.instance_name ?? undefined,
      message_id: message.message_id ?? undefined,
      source_event_type: message.source_event_type,
      payload_raw_json: message.payload_raw_json,
      received_at: message.received_at,
      processed_at: message.processed_at,
    },
  });
}

async function atualizarVinculosMensagemIngestao(
  client: PrismaDbClient,
  mensagemIngestaoId: number,
  data: {
    attendance_id?: number | null;
    contato_id?: number | null;
    legacy_mensagem_id?: number | null;
    cod_loja?: number | null;
  },
) {
  return client.mensagem_ingestao.update({
    where: { id: mensagemIngestaoId },
    data: {
      attendance_id: data.attendance_id ?? undefined,
      contato_id: data.contato_id ?? undefined,
      legacy_mensagem_id: data.legacy_mensagem_id ?? undefined,
      cod_loja: data.cod_loja ?? undefined,
      processed_at: new Date(),
    },
  });
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

function parseBooleanQuery(value: unknown): boolean | null {
  const normalized = asNullableString(value)?.toLowerCase() ?? null;
  if (!normalized) return null;
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return null;
}

function buildVisibleOwnershipFilter(codUsuario: number | null) {
  return [
    { usuario_id: null },
    ...(codUsuario ? [{ usuario_id: codUsuario }] : []),
  ];
}

function buildVisibleInProgressFilter(codUsuario: number | null) {
  return {
    status: STATUS_EM_ATENDIMENTO,
    OR: buildVisibleOwnershipFilter(codUsuario),
  };
}

function buildOpenAtendimentosFilter(codUsuario: number | null) {
  const ownership = buildVisibleOwnershipFilter(codUsuario);
  return [
    { status: STATUS_ABERTO, OR: ownership },
    { status: STATUS_EM_ATENDIMENTO, OR: ownership },
  ];
}

function parseStatusAtendimento(value: unknown): typeof STATUS_ABERTO | typeof STATUS_EM_ATENDIMENTO | typeof STATUS_FINALIZADO | null {
  const status = asNullableString(value)?.toLowerCase() ?? null;
  if (!status) return null;
  if (!STATUS_ATENDIMENTO_VALIDOS.has(status as any)) return null;
  return status as any;
}

function parseStatusFluxo(value: unknown): string | null {
  return asNullableString(value);
}

function mapStatusDbToFluxo(statusDb: string): typeof STATUS_FLUXO_INICIADO | typeof STATUS_FLUXO_AGUARDANDO | typeof STATUS_FLUXO_FINALIZADO {
  if (statusDb === STATUS_EM_ATENDIMENTO) return STATUS_FLUXO_INICIADO;
  if (statusDb === STATUS_FINALIZADO) return STATUS_FLUXO_FINALIZADO;
  return STATUS_FLUXO_AGUARDANDO;
}

function normalizeStatusFluxo(statusFluxo: string | null): string | null {
  return statusFluxo?.trim().toLowerCase() ?? null;
}

function resolveStatusFluxo(atendimento: { status: string; status_fluxo?: string | null }): string {
  return atendimento.status_fluxo ?? mapStatusDbToFluxo(atendimento.status);
}

async function carregarStatusFluxoMap(codLoja: number, statusFluxoValores: string[]) {
  const nomes = Array.from(
    new Set(
      statusFluxoValores
        .map((statusFluxo) => normalizeStatusFluxo(statusFluxo))
        .filter((statusFluxo): statusFluxo is string => Boolean(statusFluxo)),
    ),
  );

  if (nomes.length === 0) {
    return new Map<string, { nome: string; cor: string; ativo: boolean }>();
  }

  const cadastros = await prisma.status_fluxo.findMany({
    where: {
      cod_loja: codLoja,
      nome: { in: nomes },
    },
    select: {
      nome: true,
      cor: true,
      ativo: true,
    },
  });

  return new Map(
    cadastros.map((cadastro) => [normalizeStatusFluxo(cadastro.nome)!, cadastro]),
  );
}

function serializeAtendimento(
  atendimento: any,
  statusFluxoMap: Map<string, { nome: string; cor: string; ativo: boolean }>,
) {
  const status_fluxo = resolveStatusFluxo(atendimento);
  const statusFluxoCadastro = statusFluxoMap.get(normalizeStatusFluxo(status_fluxo) ?? '');

  return {
    id: atendimento.id,
    cod_loja: atendimento.cod_loja,
    contato_id: atendimento.contato_id,
    cliente_codigo: atendimento.cliente_codigo,
    usuario_id: atendimento.usuario_id,
    origem: atendimento.origem,
    status: atendimento.status,
    status_fluxo,
    status_fluxo_cor: statusFluxoCadastro?.cor ?? null,
    aberto_em: atendimento.aberto_em,
    iniciado_em: atendimento.iniciado_em,
    finalizado_em: atendimento.finalizado_em,
    created_at: atendimento.created_at,
    updated_at: atendimento.updated_at,
    total_mensagens: atendimento._count?.mensagens ?? undefined,
    contato: atendimento.contato
      ? {
          id: atendimento.contato.id,
          contato: atendimento.contato.contato,
          telefone: atendimento.contato.telefone,
          tipo: atendimento.contato.tipo,
          profile_picture_url: atendimento.contato.profile_picture_url ?? null,
        }
      : null,
  };
}

export async function webhookMensagem(req: Request, res: Response) {
  try {
    const receivedAt = new Date();
    console.info('[mensagens/webhook] requisicao recebida:', {
      originalUrl: req.originalUrl,
      path: req.path,
    });
    console.info('[mensagens/webhook] payload recebido:', payloadPreview(req.body));

    const mensagemNormalizada = extractNormalizedMessage(req.body, req.originalUrl || req.path, receivedAt);
    const eventoIngestao = await registrarEventoIngestao(prisma, mensagemNormalizada);

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
    const evolution_instancia = mensagemNormalizada.instance_name;
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
    const contatoTipo = asNullableString(req.body?.contato_tipo ?? req.body?.tipo_contato);
    const cliente_codigo = asNullablePositiveInt(req.body?.cliente_codigo);
    const usuario_id = asNullablePositiveInt(req.body?.usuario_id);
    const origem = asNullableString(req.body?.origem) ?? 'whatsapp';

    let lojaResolvida = null as {
      codigo: number;
      evolution_url: string | null;
      evolution_instancia: string | null;
      evolution_apikey: string | null;
    } | null;
    if (apikey) {
      lojaResolvida = await prisma.loja.findFirst({
        where: { evolution_apikey: apikey },
        select: {
          codigo: true,
          evolution_url: true,
          evolution_instancia: true,
          evolution_apikey: true,
        },
      });
    }
    if (!lojaResolvida && evolution_instancia) {
      const whereByInstancia: any = { evolution_instancia };
      if (evolution_url) whereByInstancia.evolution_url = evolution_url;
      lojaResolvida = await prisma.loja.findFirst({
        where: whereByInstancia,
        select: {
          codigo: true,
          evolution_url: true,
          evolution_instancia: true,
          evolution_apikey: true,
        },
      });
    }

    const cod_loja = lojaResolvida?.codigo ?? cod_loja_payload;
    const lojaConfig = lojaResolvida ?? (
      cod_loja
        ? await prisma.loja.findFirst({
            where: { codigo: cod_loja },
            select: {
              codigo: true,
              evolution_url: true,
              evolution_instancia: true,
              evolution_apikey: true,
            },
          })
        : null
    );

    const contatoNomeResolvido = await resolveContactName({
      webhookPayload: req.body,
      baseUrl: lojaConfig?.evolution_url ?? evolution_url,
      instance: lojaConfig?.evolution_instancia ?? evolution_instancia,
      apiKey: lojaConfig?.evolution_apikey ?? apikey,
      timeoutMs: 10000,
      logger: console,
      remoteJidOverride: mensagemNormalizada.contact_jid ?? mensagemNormalizada.remote_jid,
      fromMeOverride: mensagemNormalizada.from_me,
    });

    console.info('[mensagens/webhook] resolucao da loja:', {
      cod_loja_payload,
      cod_loja_resolvida: lojaResolvida?.codigo ?? null,
      cod_loja_final: cod_loja ?? null,
      apikey: maskKey(apikey),
      evolution_instancia,
      evolution_url,
    });

    console.info('[mensagens/webhook] campos normalizados:', {
      instance_name: mensagemNormalizada.instance_name,
      message_id: mensagemNormalizada.message_id,
      cod_loja,
      source_event_type: mensagemNormalizada.source_event_type,
      status: mensagemNormalizada.status,
      fromMe: mensagemNormalizada.from_me,
      remote_jid: mensagemNormalizada.remote_jid,
      chat_jid: mensagemNormalizada.chat_jid,
      contact_jid: mensagemNormalizada.contact_jid,
      telefone: mensagemNormalizada.contact_phone_normalized,
      direcao: mensagemNormalizada.direction,
      tipo: mensagemNormalizada.message_type,
      contatoNome: contatoNomeResolvido.contactName,
      contatoNomeSource: contatoNomeResolvido.sourceUsed,
      contatoTipo,
      cliente_codigo,
      usuario_id,
      origem,
      quoted_message_id: mensagemNormalizada.quoted_message_id,
      hasTexto: Boolean(mensagemNormalizada.message_text),
      hasArquivoBase64: Boolean(mensagemNormalizada.arquivo_base64),
      arquivoMimetype: mensagemNormalizada.media_mime_type,
      base64Length: mensagemNormalizada.arquivo_base64 ? mensagemNormalizada.arquivo_base64.length : 0,
    });

    if (!mensagemNormalizada.instance_name || !mensagemNormalizada.message_id) {
      console.warn('[mensagens/webhook] rejeitado: instance_name/message_id ausentes para idempotencia');
      return res.status(400).json({
        error: 'Campos instance_name e message_id sao obrigatorios para persistencia idempotente.',
        ingest_event_id: eventoIngestao.id,
      });
    }

    const upsertIngestao = await upsertMensagemIngestao(prisma, mensagemNormalizada, cod_loja);
    await prisma.mensagem_ingestao_evento.update({
      where: { id: eventoIngestao.id },
      data: {
        mensagem_ingestao_id: upsertIngestao.record.id,
        processed_at: new Date(),
      },
    });

    if (!shouldCreateAttendanceMessage(mensagemNormalizada, upsertIngestao.record)) {
      console.info('[mensagens/webhook] evento persistido sem vinculacao de atendimento', {
        ingest_message_id: upsertIngestao.record.id,
        source_event_type: mensagemNormalizada.source_event_type,
        status: mensagemNormalizada.status,
      });
      return res.status(upsertIngestao.created ? 201 : 200).json({
        message: 'Evento persistido com sucesso.',
        ingest_message_id: upsertIngestao.record.id,
        attendance_linked: false,
        duplicate: !upsertIngestao.created,
      });
    }

    if (!cod_loja) {
      console.warn('[mensagens/webhook] mensagem persistida sem atendimento: cod_loja nao identificado');
      return res.status(202).json({
        message: 'Mensagem persistida, mas cod_loja nao foi identificado para vinculacao ao atendimento.',
        ingest_message_id: upsertIngestao.record.id,
        attendance_linked: false,
      });
    }

    const telefone = mensagemNormalizada.contact_phone_normalized;
    if (!telefone) {
      console.warn('[mensagens/webhook] mensagem persistida sem atendimento: telefone nao identificado');
      return res.status(202).json({
        message: 'Mensagem persistida, mas nao foi possivel identificar o telefone do contato.',
        ingest_message_id: upsertIngestao.record.id,
        attendance_linked: false,
      });
    }

    const resultado = await prisma.$transaction(async (tx) => {
      console.info('[mensagens/webhook] iniciando transacao', {
        cod_loja,
        telefone,
        ingest_message_id: upsertIngestao.record.id,
      });
      let contatoNovo = false;
      let contato = await tx.contato.findUnique({
        where: { cod_loja_telefone: { cod_loja, telefone } },
      });

      if (!contato) {
        console.info('[mensagens/webhook] contato nao encontrado, criando', { cod_loja, telefone });
        contato = await tx.contato.create({
          data: {
            cod_loja,
            cliente_codigo,
            contato: contatoNomeResolvido.contactName ?? 'Contato WhatsApp',
            telefone,
            tipo: contatoTipo ?? 'whatsapp',
          },
        });
        contatoNovo = true;
      } else {
        console.info('[mensagens/webhook] contato existente encontrado', {
          contato_id: contato.id,
          cliente_codigo_atual: contato.cliente_codigo,
        });
        const updateData: any = {};
        const nomeContatoAtual = asNullableString(contato.contato);
        const nomeContatoAtualEhPlaceholder =
          !nomeContatoAtual ||
          nomeContatoAtual.toLowerCase() === 'contato whatsapp' ||
          nomeContatoAtual === contato.telefone;
        if (
          !mensagemNormalizada.from_me &&
          contatoNomeResolvido.contactName &&
          contatoNomeResolvido.sourceUsed !== 'fallback.phone' &&
          contatoNomeResolvido.contactName !== contato.contato &&
          nomeContatoAtualEhPlaceholder
        ) {
          updateData.contato = contatoNomeResolvido.contactName;
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
          status: { in: [STATUS_ABERTO, STATUS_EM_ATENDIMENTO] },
        },
        orderBy: { id: 'desc' },
      });

      let novo_atendimento = false;
      if (!atendimento) {
        console.info('[mensagens/webhook] nenhum atendimento ativo encontrado (inexistente ou finalizado), criando novo', {
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
            status_fluxo: STATUS_FLUXO_AGUARDANDO,
          },
        });
        novo_atendimento = true;
      } else {
        console.info('[mensagens/webhook] reutilizando atendimento ativo', {
          atendimento_id: atendimento.id,
          status: atendimento.status,
          usuario_id: atendimento.usuario_id,
        });
      }

      let mensagemIdLegado = upsertIngestao.record.legacy_mensagem_id;
      if (!mensagemIdLegado) {
        const mensagem = await tx.mensagem.create({
          data: {
            cod_loja,
            atendimento_id: atendimento.id,
            contato_id: contato.id,
            usuario_id,
            from_me: mensagemNormalizada.from_me,
            direcao: mensagemNormalizada.direction,
            tipo: mensagemNormalizada.message_type === 'desconhecido' ? 'texto' : mensagemNormalizada.message_type,
            texto: mensagemNormalizada.message_text,
            arquivo_base64: mensagemNormalizada.arquivo_base64 ?? undefined,
            arquivo_mimetype: mensagemNormalizada.media_mime_type ?? undefined,
          },
        });
        mensagemIdLegado = mensagem.id;
      }

      await atualizarVinculosMensagemIngestao(tx, upsertIngestao.record.id, {
        attendance_id: atendimento.id,
        contato_id: contato.id,
        legacy_mensagem_id: mensagemIdLegado,
        cod_loja,
      });

      console.info('[mensagens/webhook] mensagem registrada', {
        ingest_message_id: upsertIngestao.record.id,
        mensagem_id: mensagemIdLegado,
        atendimento_id: atendimento.id,
        contato_id: contato.id,
      });

      return {
        atendimento_id: atendimento.id,
        mensagem_id: mensagemIdLegado,
        ingest_message_id: upsertIngestao.record.id,
        contato_id: contato.id,
        should_fetch_profile_picture: contatoNovo || shouldRefreshProfilePicture(contato),
        novo_atendimento,
        duplicate: !upsertIngestao.created,
      };
    });

    if (resultado.should_fetch_profile_picture) {
      await tryRefreshContactProfilePhoto({
        contatoId: resultado.contato_id,
        codLoja: cod_loja,
        instanceName: mensagemNormalizada.instance_name,
        remoteJid: mensagemNormalizada.contact_jid ?? mensagemNormalizada.remote_jid,
        phone: telefone,
      });
    }

    const { should_fetch_profile_picture, ...resultadoResposta } = resultado;

    return res.status(upsertIngestao.created ? 201 : 200).json({
      message: 'Mensagem processada com sucesso.',
      ...resultadoResposta,
    });
  } catch (error) {
    console.error('[mensagens/webhook] erro:', error);
    return res.status(500).json({ error: 'Erro ao processar mensagem.' });
  }
}

export async function consultarMensagemPorMessageId(req: Request, res: Response) {
  try {
    const message_id = asNullableString(req.params?.message_id);
    const instance_name = asNullableString(req.query?.instance_name);

    if (!message_id) {
      return res.status(400).json({ error: 'Campo message_id e obrigatorio.' });
    }

    if (instance_name) {
      const mensagem = await prisma.mensagem_ingestao.findUnique({
        where: {
          instance_name_message_id: {
            instance_name,
            message_id,
          },
        },
      });

      if (!mensagem) {
        return res.status(404).json({ error: 'Mensagem nao encontrada.' });
      }

      return res.json(mensagem);
    }

    const mensagens = await prisma.mensagem_ingestao.findMany({
      where: { message_id },
      orderBy: [{ updated_at: 'desc' }, { id: 'desc' }],
      take: 2,
    });

    if (mensagens.length === 0) {
      return res.status(404).json({ error: 'Mensagem nao encontrada.' });
    }

    if (mensagens.length > 1) {
      return res.status(409).json({
        error: 'Mais de uma mensagem encontrada para este message_id. Informe instance_name.',
      });
    }

    return res.json(mensagens[0]);
  } catch (error) {
    console.error('Erro em consultarMensagemPorMessageId:', error);
    return res.status(500).json({ error: 'Erro ao consultar mensagem por message_id.' });
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
            status_fluxo: STATUS_FLUXO_INICIADO,
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
    const ult_id_recebido_raw = req.query?.ult_id_recebido;
    const ult_id_recebido = asNullablePositiveInt(ult_id_recebido_raw);
    const limit = Math.max(1, Math.min(500, Number(req.query?.limit) || 100));
    const offset = Math.max(0, Number(req.query?.offset) || 0);

    if (!cod_loja || !atendimento_id) {
      return res.status(400).json({ error: 'Campos cod_loja e atendimento_id sao obrigatorios.' });
    }
    if (
      ult_id_recebido_raw !== undefined &&
      ult_id_recebido_raw !== null &&
      ult_id_recebido_raw !== '' &&
      !ult_id_recebido
    ) {
      return res.status(400).json({ error: 'Campo ult_id_recebido deve ser inteiro positivo.' });
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

    const whereMensagens: any = { cod_loja, atendimento_id };
    if (ult_id_recebido) {
      whereMensagens.id = { gt: ult_id_recebido };
    }

    const total = await prisma.mensagem.count({
      where: whereMensagens,
    });

    const mensagens = await prisma.mensagem.findMany({
      where: whereMensagens,
      orderBy: { id: 'asc' },
      skip: offset,
      take: limit,
    });

    const statusFluxoMap = await carregarStatusFluxoMap(cod_loja, [resolveStatusFluxo(atendimento)]);

    return res.json({
      total,
      data: mensagens,
      atendimento: {
        ...serializeAtendimento(atendimento, statusFluxoMap),
        contato: atendimento.contato?.contato ?? null,
        telefone: atendimento.contato?.telefone ?? null,
        profile_picture_url: atendimento.contato?.profile_picture_url ?? null,
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
    const abertosRaw = req.query?.abertos;
    const abertos = parseBooleanQuery(abertosRaw);
    const statusInput = asNullableString(req.query?.status);
    const status = parseStatusAtendimento(statusInput);
    const ult_id_recebido_raw = req.query?.ult_id_recebido;
    const ult_id_recebido = asNullablePositiveInt(ult_id_recebido_raw);
    const limit = Math.max(1, Math.min(500, Number(req.query?.limit) || 100));
    const offset = Math.max(0, Number(req.query?.offset) || 0);

    if (!cod_loja) {
      return res.status(400).json({ error: 'Campo cod_loja e obrigatorio.' });
    }
    if (
      abertosRaw !== undefined &&
      abertosRaw !== null &&
      abertosRaw !== '' &&
      abertos === null
    ) {
      return res.status(400).json({ error: "Campo abertos deve ser 'true' ou 'false'." });
    }
    if (statusInput && !status) {
      return res.status(400).json({ error: "Campo status deve ser 'aberto', 'em_atendimento' ou 'finalizado'." });
    }
    if (
      ult_id_recebido_raw !== undefined &&
      ult_id_recebido_raw !== null &&
      ult_id_recebido_raw !== '' &&
      !ult_id_recebido
    ) {
      return res.status(400).json({ error: 'Campo ult_id_recebido deve ser inteiro positivo.' });
    }
    if (ult_id_recebido && status && status !== STATUS_ABERTO) {
      return res.status(400).json({ error: "Com ult_id_recebido, o status deve ser 'aberto'." });
    }

    const where: any = {
      cod_loja,
      ...(contato_id ? { contato_id } : {}),
    };

    if (ult_id_recebido) {
      where.status = STATUS_ABERTO;
      where.mensagens = {
        some: {
          id: { gt: ult_id_recebido },
        },
      };
    } else if (abertos === true) {
      where.OR = buildOpenAtendimentosFilter(cod_usuario);
    } else if (abertos === false) {
      where.status = STATUS_FINALIZADO;
    } else if (status === STATUS_EM_ATENDIMENTO) {
      Object.assign(where, buildVisibleInProgressFilter(cod_usuario));
    } else if (status === STATUS_ABERTO || status === STATUS_FINALIZADO) {
      where.status = status;
    } else {
      where.OR = [
        { status: STATUS_ABERTO },
        { status: STATUS_FINALIZADO },
        buildVisibleInProgressFilter(cod_usuario),
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

    const statusFluxoMap = await carregarStatusFluxoMap(
      cod_loja,
      atendimentos.map((atendimento) => resolveStatusFluxo(atendimento)),
    );

    return res.json({
      total,
      data: atendimentos.map((atendimento) => serializeAtendimento(atendimento, statusFluxoMap)),
      nextOffset: offset + limit < total ? offset + limit : null,
    });
  } catch (error) {
    console.error('Erro em listarAtendimentos:', error);
    return res.status(500).json({ error: 'Erro ao listar atendimentos.' });
  }
}

export async function ajustarNomeContato(req: Request, res: Response) {
  try {
    const cod_loja = asPositiveInt(req.body?.cod_loja);
    const contato_id = asPositiveInt(req.params?.contato_id);
    const novoNome = asNullableString(req.body?.contato ?? req.body?.nome);

    if (!cod_loja || !contato_id || !novoNome) {
      return res.status(400).json({ error: 'Campos cod_loja, contato_id e contato sao obrigatorios.' });
    }

    const contato = await prisma.contato.findUnique({
      where: { id_cod_loja: { id: contato_id, cod_loja } },
    });

    if (!contato) {
      return res.status(404).json({ error: 'Contato nao encontrado.' });
    }

    if (contato.contato === novoNome) {
      return res.json({
        message: 'Nome do contato ja esta atualizado.',
        id: contato.id,
        cod_loja: contato.cod_loja,
        contato: contato.contato,
        telefone: contato.telefone,
        profile_picture_url: contato.profile_picture_url,
      });
    }

    const atualizado = await prisma.contato.update({
      where: { id: contato.id },
      data: { contato: novoNome },
    });

    return res.json({
      message: 'Nome do contato atualizado com sucesso.',
      id: atualizado.id,
      cod_loja: atualizado.cod_loja,
      contato: atualizado.contato,
      telefone: atualizado.telefone,
      profile_picture_url: atualizado.profile_picture_url,
    });
  } catch (error) {
    console.error('Erro em ajustarNomeContato:', error);
    return res.status(500).json({ error: 'Erro ao ajustar nome do contato.' });
  }
}

export async function atualizarFotoContato(req: Request, res: Response) {
  try {
    const cod_loja = asPositiveInt(req.body?.cod_loja);
    const contato_id = asPositiveInt(req.params?.contato_id);
    const profile_picture_url = normalizeProfilePictureUrl(
      readFirstString(req.body?.profile_picture_url, req.body?.profilePictureUrl),
    );

    if (!cod_loja || !contato_id) {
      return res.status(400).json({ error: 'Campos cod_loja e contato_id sao obrigatorios.' });
    }

    if (
      Object.prototype.hasOwnProperty.call(req.body ?? {}, 'profile_picture_url') ||
      Object.prototype.hasOwnProperty.call(req.body ?? {}, 'profilePictureUrl')
    ) {
      const rawProfilePictureUrl = readFirstString(req.body?.profile_picture_url, req.body?.profilePictureUrl);
      if (rawProfilePictureUrl && !profile_picture_url) {
        return res.status(400).json({ error: 'Campo profile_picture_url deve ser uma URL http(s) valida.' });
      }
    }

    const contato = await prisma.contato.findUnique({
      where: { id_cod_loja: { id: contato_id, cod_loja } },
    });

    if (!contato) {
      return res.status(404).json({ error: 'Contato nao encontrado.' });
    }

    const atualizado = await prisma.contato.update({
      where: { id: contato.id },
      data: {
        profile_picture_url: profile_picture_url ?? null,
        profile_picture_checked_at: new Date(),
      },
    });

    return res.json({
      message: 'Foto do contato atualizada com sucesso.',
      id: atualizado.id,
      cod_loja: atualizado.cod_loja,
      contato: atualizado.contato,
      telefone: atualizado.telefone,
      profile_picture_url: atualizado.profile_picture_url,
      profile_picture_checked_at: atualizado.profile_picture_checked_at,
    });
  } catch (error) {
    console.error('Erro em atualizarFotoContato:', error);
    return res.status(500).json({ error: 'Erro ao atualizar foto do contato.' });
  }
}

export async function vincularContatoCliente(req: Request, res: Response) {
  try {
    const cod_loja = asPositiveInt(req.body?.cod_loja);
    const contato_id = asPositiveInt(req.params?.contato_id);
    const cliente_codigo = asPositiveInt(req.body?.cliente_codigo);

    if (!cod_loja || !contato_id || !cliente_codigo) {
      return res.status(400).json({ error: 'Campos cod_loja, contato_id e cliente_codigo sao obrigatorios.' });
    }

    const contato = await prisma.contato.findUnique({
      where: { id_cod_loja: { id: contato_id, cod_loja } },
    });

    if (!contato) {
      return res.status(404).json({ error: 'Contato nao encontrado.' });
    }

    const cliente = await prisma.cliente.findFirst({
      where: { cod_loja, codigo: cliente_codigo },
      select: { id: true, codigo: true, nome: true },
    });

    if (!cliente) {
      return res.status(404).json({ error: 'Cliente nao encontrado para cod_loja e cliente_codigo informados.' });
    }

    const resultado = await prisma.$transaction(async (tx) => {
      const contatoAtualizado = await tx.contato.update({
        where: { id: contato.id },
        data: { cliente_codigo },
      });

      const atendimentosAtualizados = await tx.atendimento.updateMany({
        where: {
          cod_loja,
          contato_id: contato.id,
          status: { in: [STATUS_ABERTO, STATUS_EM_ATENDIMENTO] },
        },
        data: { cliente_codigo },
      });

      return {
        contatoAtualizado,
        atendimentosAtualizados: atendimentosAtualizados.count,
      };
    });

    return res.json({
      message: 'Contato vinculado ao cliente com sucesso.',
      contato: {
        id: resultado.contatoAtualizado.id,
        cod_loja: resultado.contatoAtualizado.cod_loja,
        contato: resultado.contatoAtualizado.contato,
        telefone: resultado.contatoAtualizado.telefone,
        cliente_codigo: resultado.contatoAtualizado.cliente_codigo,
        profile_picture_url: resultado.contatoAtualizado.profile_picture_url,
      },
      cliente,
      atendimentos_atualizados: resultado.atendimentosAtualizados,
    });
  } catch (error) {
    console.error('Erro em vincularContatoCliente:', error);
    return res.status(500).json({ error: 'Erro ao vincular contato com cliente.' });
  }
}

export async function atualizarStatusAtendimento(req: Request, res: Response) {
  try {
    const cod_loja = asPositiveInt(req.body?.cod_loja);
    const cod_usuario = asNullablePositiveInt(req.body?.cod_usuario);
    const atendimento_id = asPositiveInt(req.params?.atendimento_id);
    const status_fluxo = parseStatusFluxo(req.body?.status);
    const statusFluxoNormalizado = normalizeStatusFluxo(status_fluxo);
    const isStatusIniciado = statusFluxoNormalizado === STATUS_FLUXO_INICIADO;
    const isStatusFinalizado = statusFluxoNormalizado === STATUS_FLUXO_FINALIZADO;

    if (!cod_loja || !atendimento_id || !status_fluxo) {
      return res.status(400).json({
        error: 'Campos cod_loja, atendimento_id e status sao obrigatorios.',
      });
    }

    const atendimento = await prisma.atendimento.findUnique({
      where: { id_cod_loja: { id: atendimento_id, cod_loja } },
    });
    if (!atendimento) {
      return res.status(404).json({ error: 'Atendimento nao encontrado.' });
    }

    let statusFluxoCadastro: { nome: string; cor: string } | null = null;
    if (!isStatusIniciado && !isStatusFinalizado) {
      statusFluxoCadastro = await prisma.status_fluxo.findFirst({
        where: {
          cod_loja,
          nome: status_fluxo,
          ativo: true,
        },
        select: {
          nome: true,
          cor: true,
        },
      });

      if (!statusFluxoCadastro) {
        return res.status(400).json({ error: 'Status de fluxo nao cadastrado ou inativo para a loja.' });
      }
    } else {
      statusFluxoCadastro = await prisma.status_fluxo.findFirst({
        where: {
          cod_loja,
          nome: status_fluxo,
        },
        select: {
          nome: true,
          cor: true,
        },
      });
    }

    if (isStatusIniciado && atendimento.status === STATUS_FINALIZADO) {
      return res.status(400).json({ error: 'Atendimento finalizado nao pode voltar para outra etapa.' });
    }

    if (atendimento.status === STATUS_EM_ATENDIMENTO && atendimento.usuario_id && cod_usuario && atendimento.usuario_id !== cod_usuario) {
      return res.status(403).json({ error: 'Atendimento em posse de outro usuario.' });
    }

    const usuarioEfetivo = cod_usuario ?? atendimento.usuario_id ?? null;
    if (isStatusIniciado && atendimento.status === STATUS_ABERTO && !usuarioEfetivo) {
      return res.status(400).json({
        error: 'Campo cod_usuario e obrigatorio para mover atendimento aberto sem usuario definido.',
      });
    }

    const dataUpdate: any = {
      status_fluxo: statusFluxoCadastro?.nome ?? status_fluxo,
    };
    if (isStatusIniciado) {
      dataUpdate.status = STATUS_EM_ATENDIMENTO;
      dataUpdate.usuario_id = usuarioEfetivo;
      dataUpdate.iniciado_em = atendimento.iniciado_em ?? new Date();
    } else if (isStatusFinalizado) {
      dataUpdate.status = STATUS_FINALIZADO;
      dataUpdate.usuario_id = usuarioEfetivo ?? atendimento.usuario_id;
      dataUpdate.finalizado_em = atendimento.finalizado_em ?? new Date();
    }

    const atualizado = await prisma.atendimento.update({
      where: { id: atendimento.id },
      data: dataUpdate,
    });

    return res.json({
      message: 'Status do atendimento atualizado com sucesso.',
      id: atualizado.id,
      status_fluxo: atualizado.status_fluxo,
      status_fluxo_cor: statusFluxoCadastro?.cor ?? null,
      status: atualizado.status,
      usuario_id: atualizado.usuario_id,
      iniciado_em: atualizado.iniciado_em,
      finalizado_em: atualizado.finalizado_em,
    });
  } catch (error) {
    console.error('Erro em atualizarStatusAtendimento:', error);
    return res.status(500).json({ error: 'Erro ao atualizar status do atendimento.' });
  }
}

export async function transferirUsuarioAtendimento(req: Request, res: Response) {
  try {
    const cod_loja = asPositiveInt(req.body?.cod_loja);
    const cod_usuario_origem = asNullablePositiveInt(req.body?.cod_usuario);
    const cod_usuario_destino = asPositiveInt(req.body?.cod_usuario_destino);
    const atendimento_id = asPositiveInt(req.params?.atendimento_id);

    if (!cod_loja || !atendimento_id || !cod_usuario_destino) {
      return res.status(400).json({
        error: 'Campos cod_loja, atendimento_id e cod_usuario_destino sao obrigatorios.',
      });
    }

    const atendimento = await prisma.atendimento.findUnique({
      where: { id_cod_loja: { id: atendimento_id, cod_loja } },
    });
    if (!atendimento) {
      return res.status(404).json({ error: 'Atendimento nao encontrado.' });
    }
    if (atendimento.status === STATUS_FINALIZADO) {
      return res.status(400).json({ error: 'Atendimento finalizado nao pode ser transferido.' });
    }
    if (atendimento.usuario_id && cod_usuario_origem && atendimento.usuario_id !== cod_usuario_origem) {
      return res.status(403).json({ error: 'Atendimento em posse de outro usuario.' });
    }
    if (atendimento.usuario_id === cod_usuario_destino) {
      const statusFluxoMap = await carregarStatusFluxoMap(cod_loja, [resolveStatusFluxo(atendimento)]);
      const statusFluxoCadastro = statusFluxoMap.get(normalizeStatusFluxo(resolveStatusFluxo(atendimento)) ?? '');
      return res.json({
        message: 'Atendimento ja esta vinculado ao usuario informado.',
        id: atendimento.id,
        status_fluxo: resolveStatusFluxo(atendimento),
        status_fluxo_cor: statusFluxoCadastro?.cor ?? null,
        status: atendimento.status,
        usuario_id: atendimento.usuario_id,
      });
    }

    const atualizado = await prisma.atendimento.update({
      where: { id: atendimento.id },
      data: {
        usuario_id: cod_usuario_destino,
      },
    });

    const statusFluxoMap = await carregarStatusFluxoMap(cod_loja, [resolveStatusFluxo(atualizado)]);
    const statusFluxoCadastro = statusFluxoMap.get(normalizeStatusFluxo(resolveStatusFluxo(atualizado)) ?? '');

    return res.json({
      message: 'Usuario do atendimento transferido com sucesso.',
      id: atualizado.id,
      status_fluxo: resolveStatusFluxo(atualizado),
      status_fluxo_cor: statusFluxoCadastro?.cor ?? null,
      status: atualizado.status,
      usuario_id: atualizado.usuario_id,
    });
  } catch (error) {
    console.error('Erro em transferirUsuarioAtendimento:', error);
    return res.status(500).json({ error: 'Erro ao transferir usuario do atendimento.' });
  }
}
