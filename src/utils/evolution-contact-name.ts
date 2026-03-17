import axios from 'axios';

type Logger = Pick<Console, 'info' | 'warn'> | null;

type FindContactParams = {
  baseUrl?: string | null;
  instance?: string | null;
  apiKey?: string | null;
  remoteJid?: string | null;
  timeoutMs: number;
  logger?: Logger;
};

type ResolveContactNameParams = {
  webhookPayload?: any;
  baseUrl?: string | null;
  instance?: string | null;
  apiKey?: string | null;
  timeoutMs?: number;
  logger?: Logger;
};

type ResolvedContactName = {
  remoteJid: string | null;
  phone: string | null;
  contactName: string | null;
  sourceUsed:
    | 'webhook.pushName'
    | 'api.findContacts.pushName'
    | 'api.findContacts.profileName'
    | 'api.findContacts.name'
    | 'fallback.phone';
};

function sanitizeString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const sanitized = String(value).trim();
  return sanitized ? sanitized : null;
}

function readFirstValidString(...values: unknown[]): string | null {
  for (const value of values) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const sanitized = sanitizeString(item);
        if (sanitized) return sanitized;
      }
      continue;
    }

    const sanitized = sanitizeString(value);
    if (sanitized) return sanitized;
  }

  return null;
}

function log(logger: Logger | undefined, level: 'info' | 'warn', message: string, meta?: Record<string, unknown>) {
  if (!logger || typeof logger[level] !== 'function') return;
  if (meta && Object.keys(meta).length > 0) {
    logger[level](message, meta);
    return;
  }
  logger[level](message);
}

export function extractRemoteJid(webhookPayload: any): string | null {
  return readFirstValidString(
    webhookPayload?.data?.key?.remoteJid,
    webhookPayload?.key?.remoteJid,
    webhookPayload?.data?.remoteJid,
    webhookPayload?.remoteJid,
    webhookPayload?.data?.messages?.[0]?.key?.remoteJid,
    webhookPayload?.messages?.[0]?.key?.remoteJid,
    webhookPayload?.data?.message?.key?.remoteJid,
    webhookPayload?.message?.key?.remoteJid,
    webhookPayload?.event?.data?.key?.remoteJid,
    webhookPayload?.event?.key?.remoteJid,
  );
}

export function extractPushName(webhookPayload: any): string | null {
  return readFirstValidString(
    webhookPayload?.pushName,
    webhookPayload?.push_name,
    webhookPayload?.data?.pushName,
    webhookPayload?.data?.push_name,
    webhookPayload?.data?.sender?.pushName,
    webhookPayload?.data?.sender?.push_name,
    webhookPayload?.sender?.pushName,
    webhookPayload?.sender?.push_name,
    webhookPayload?.event?.pushName,
    webhookPayload?.event?.push_name,
    webhookPayload?.data?.messages?.[0]?.pushName,
    webhookPayload?.messages?.[0]?.pushName,
  );
}

export function extractPhoneFromJid(remoteJid: string | null): string | null {
  const jid = sanitizeString(remoteJid);
  if (!jid) return null;

  const withoutDomain = jid.split('@')[0] || jid;
  const withoutDevice = withoutDomain.split(':')[0] || withoutDomain;
  const phone = withoutDevice.replace(/\D/g, '');

  return phone || null;
}

function normalizeBaseUrl(baseUrl: string | null | undefined): string | null {
  const sanitized = sanitizeString(baseUrl);
  return sanitized ? sanitized.replace(/\/+$/, '') : null;
}

function normalizeContactCandidates(payload: any): any[] {
  if (!payload) return [];

  if (Array.isArray(payload)) {
    return payload.filter((item) => item && typeof item === 'object');
  }

  if (typeof payload !== 'object') return [];

  const collections = [
    payload.contacts,
    payload.data,
    payload.data?.contacts,
    payload.result,
    payload.results,
    payload.response,
    payload.response?.contacts,
    payload.items,
  ];

  for (const collection of collections) {
    if (Array.isArray(collection)) {
      return collection.filter((item) => item && typeof item === 'object');
    }
  }

  if (payload.contact && typeof payload.contact === 'object') {
    return [payload.contact];
  }

  const looksLikeContact =
    payload.remoteJid !== undefined ||
    payload.pushName !== undefined ||
    payload.profileName !== undefined ||
    payload.name !== undefined;

  return looksLikeContact ? [payload] : [];
}

export function pickBestContactName(contact: any): {
  contactName: string;
  sourceUsed: 'api.findContacts.pushName' | 'api.findContacts.profileName' | 'api.findContacts.name';
} | null {
  const pushName = sanitizeString(contact?.pushName);
  if (pushName) {
    return {
      contactName: pushName,
      sourceUsed: 'api.findContacts.pushName',
    };
  }

  const profileName = sanitizeString(contact?.profileName);
  if (profileName) {
    return {
      contactName: profileName,
      sourceUsed: 'api.findContacts.profileName',
    };
  }

  const name = sanitizeString(contact?.name);
  if (name) {
    return {
      contactName: name,
      sourceUsed: 'api.findContacts.name',
    };
  }

  return null;
}

export async function findContactByRemoteJid({
  baseUrl,
  instance,
  apiKey,
  remoteJid,
  timeoutMs,
  logger = null,
}: FindContactParams): Promise<any | null> {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const normalizedInstance = sanitizeString(instance);
  const normalizedApiKey = sanitizeString(apiKey);
  const normalizedRemoteJid = sanitizeString(remoteJid);

  if (!normalizedBaseUrl || !normalizedInstance || !normalizedApiKey || !normalizedRemoteJid) {
    log(logger, 'info', '[resolveContactName] findContacts skipped: missing config');
    return null;
  }

  const url = `${normalizedBaseUrl}/chat/findContacts/${encodeURIComponent(normalizedInstance)}`;

  try {
    const response = await axios.post(
      url,
      {
        where: {
          remoteJid: normalizedRemoteJid,
        },
      },
      {
        timeout: timeoutMs,
        headers: {
          'Content-Type': 'application/json',
          apikey: normalizedApiKey,
        },
      },
    );

    const contacts = normalizeContactCandidates(response.data);
    const matchedContact =
      contacts.find((contact) => sanitizeString(contact?.remoteJid) === normalizedRemoteJid) ||
      contacts[0] ||
      null;

    log(logger, 'info', '[resolveContactName] findContacts response received', {
      remoteJid: normalizedRemoteJid,
      status: response.status,
      contactsFound: contacts.length,
    });

    return matchedContact;
  } catch (error: any) {
    const status = error?.response?.status ?? null;
    const reason = sanitizeString(error?.message) || 'request-failed';

    log(logger, 'warn', '[resolveContactName] findContacts request failed', {
      remoteJid: normalizedRemoteJid,
      status,
      reason,
    });

    return null;
  }
}

export async function resolveContactName({
  webhookPayload,
  baseUrl,
  instance,
  apiKey,
  timeoutMs = 10000,
  logger = null,
}: ResolveContactNameParams = {}): Promise<ResolvedContactName> {
  const remoteJid = extractRemoteJid(webhookPayload);
  const phone = extractPhoneFromJid(remoteJid);
  const webhookPushName = extractPushName(webhookPayload);

  if (webhookPushName) {
    log(logger, 'info', '[resolveContactName] using webhook pushName', { remoteJid });
    return {
      remoteJid,
      phone,
      contactName: webhookPushName,
      sourceUsed: 'webhook.pushName',
    };
  }

  const contact = await findContactByRemoteJid({
    baseUrl,
    instance,
    apiKey,
    remoteJid,
    timeoutMs,
    logger,
  });

  const pickedName = pickBestContactName(contact);
  if (pickedName) {
    log(logger, 'info', '[resolveContactName] using findContacts name', {
      remoteJid,
      sourceUsed: pickedName.sourceUsed,
    });

    return {
      remoteJid,
      phone,
      contactName: pickedName.contactName,
      sourceUsed: pickedName.sourceUsed,
    };
  }

  log(logger, 'info', '[resolveContactName] using phone fallback', { remoteJid });

  return {
    remoteJid,
    phone,
    contactName: phone,
    sourceUsed: 'fallback.phone',
  };
}
