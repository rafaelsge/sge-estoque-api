const axios = require('axios');

function sanitizeString(value) {
  if (value === undefined || value === null) return null;
  const sanitized = String(value).trim();
  return sanitized ? sanitized : null;
}

function readFirstValidString(...values) {
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

function log(logger, level, message, meta) {
  if (!logger || typeof logger[level] !== 'function') return;
  if (meta && Object.keys(meta).length > 0) {
    logger[level](message, meta);
    return;
  }
  logger[level](message);
}

function extractRemoteJid(webhookPayload) {
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
    webhookPayload?.event?.key?.remoteJid
  );
}

function extractPushName(webhookPayload) {
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
    webhookPayload?.messages?.[0]?.pushName
  );
}

function extractFromMe(webhookPayload) {
  return Boolean(
    webhookPayload?.data?.key?.fromMe ??
    webhookPayload?.key?.fromMe ??
    webhookPayload?.data?.fromMe ??
    webhookPayload?.fromMe ??
    webhookPayload?.data?.messages?.[0]?.key?.fromMe ??
    webhookPayload?.messages?.[0]?.key?.fromMe ??
    false
  );
}

function extractPhoneFromJid(remoteJid) {
  const jid = sanitizeString(remoteJid);
  if (!jid) return null;

  const withoutDomain = jid.split('@')[0] || jid;
  const withoutDevice = withoutDomain.split(':')[0] || withoutDomain;
  const phone = withoutDevice.replace(/\D/g, '');

  return phone || null;
}

function normalizeBaseUrl(baseUrl) {
  const sanitized = sanitizeString(baseUrl);
  return sanitized ? sanitized.replace(/\/+$/, '') : null;
}

function normalizeContactCandidates(payload) {
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

function pickBestContactName(contact) {
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

async function findContactByRemoteJid({
  baseUrl,
  instance,
  apiKey,
  remoteJid,
  timeoutMs,
  logger = null,
}) {
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
      }
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
  } catch (error) {
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

async function resolveContactName({
  webhookPayload,
  baseUrl,
  instance,
  apiKey,
  timeoutMs = 10000,
  logger = null,
  remoteJidOverride = null,
  fromMeOverride = null,
} = {}) {
  const remoteJid = sanitizeString(remoteJidOverride) || extractRemoteJid(webhookPayload);
  const phone = extractPhoneFromJid(remoteJid);
  const fromMe = typeof fromMeOverride === 'boolean' ? fromMeOverride : extractFromMe(webhookPayload);
  const webhookPushName = extractPushName(webhookPayload);

  if (webhookPushName && !fromMe) {
    log(logger, 'info', '[resolveContactName] using webhook pushName', { remoteJid });
    return {
      remoteJid,
      phone,
      contactName: webhookPushName,
      sourceUsed: 'webhook.pushName',
    };
  }

  if (webhookPushName && fromMe) {
    log(logger, 'info', '[resolveContactName] webhook pushName ignored for fromMe message', {
      remoteJid,
    });
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

module.exports = {
  extractRemoteJid,
  extractPushName,
  extractFromMe,
  extractPhoneFromJid,
  findContactByRemoteJid,
  pickBestContactName,
  resolveContactName,
};
