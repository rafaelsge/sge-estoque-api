const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function sanitizeString(value) {
  if (value === undefined || value === null) return null;
  const sanitized = String(value).trim();
  return sanitized ? sanitized : null;
}

function isPlaceholderName(name, phone) {
  const normalizedName = sanitizeString(name);
  if (!normalizedName) return true;

  const lowered = normalizedName.toLowerCase();
  if (lowered === 'contato whatsapp') return true;
  if (phone && normalizedName === phone) return true;

  return false;
}

function chooseLatestNames(messages) {
  const uniqueNames = [];
  const seen = new Set();

  for (const message of messages) {
    const pushName = sanitizeString(message.push_name);
    if (!pushName) continue;
    if (seen.has(pushName.toLowerCase())) continue;
    seen.add(pushName.toLowerCase());
    uniqueNames.push(pushName);
  }

  return uniqueNames;
}

function shouldAutoFixName({ currentName, phone, incomingNames, outgoingNames }) {
  const normalizedCurrent = sanitizeString(currentName);
  if (isPlaceholderName(normalizedCurrent, phone)) return true;

  if (!normalizedCurrent) return true;

  const outgoingSet = new Set(outgoingNames.map((name) => name.toLowerCase()));
  if (outgoingSet.has(normalizedCurrent.toLowerCase())) return true;

  return false;
}

async function tableExists(tableName) {
  const rows = await prisma.$queryRawUnsafe(`SHOW TABLES LIKE '${tableName}'`);
  return Array.isArray(rows) && rows.length > 0;
}

async function main() {
  const requiredTables = ['contatos', 'atendimentos', 'mensagens_ingestao'];
  const existingFlags = await Promise.all(requiredTables.map((tableName) => tableExists(tableName)));
  const missingTables = requiredTables.filter((_, index) => !existingFlags[index]);

  if (missingTables.length > 0) {
    console.error(
      JSON.stringify(
        {
          error: 'Banco atual nao possui as tabelas necessarias para validar/corrigir nomes de contatos.',
          missingTables,
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
    return;
  }

  const openAttendances = await prisma.atendimento.findMany({
    where: {
      status: {
        in: ['aberto', 'em_atendimento'],
      },
    },
    select: {
      id: true,
      cod_loja: true,
      contato_id: true,
      status: true,
      contato: {
        select: {
          id: true,
          contato: true,
          telefone: true,
        },
      },
    },
    orderBy: {
      id: 'asc',
    },
  });

  if (openAttendances.length === 0) {
    console.log(JSON.stringify({ openAttendances: 0, updated: 0, skipped: 0 }, null, 2));
    return;
  }

  const attendanceIds = openAttendances.map((attendance) => attendance.id);
  const contactIds = Array.from(new Set(openAttendances.map((attendance) => attendance.contato_id)));

  const canonicalMessages = await prisma.mensagem_ingestao.findMany({
    where: {
      OR: [
        { attendance_id: { in: attendanceIds } },
        { contato_id: { in: contactIds } },
      ],
    },
    select: {
      attendance_id: true,
      contato_id: true,
      from_me: true,
      push_name: true,
      processed_at: true,
      received_at: true,
      created_at: true,
    },
    orderBy: [
      { processed_at: 'desc' },
      { received_at: 'desc' },
      { created_at: 'desc' },
      { id: 'desc' },
    ],
  });

  const messagesByAttendance = new Map();
  const messagesByContact = new Map();

  for (const message of canonicalMessages) {
    if (message.attendance_id) {
      const bucket = messagesByAttendance.get(message.attendance_id) ?? [];
      bucket.push(message);
      messagesByAttendance.set(message.attendance_id, bucket);
    }

    if (message.contato_id) {
      const bucket = messagesByContact.get(message.contato_id) ?? [];
      bucket.push(message);
      messagesByContact.set(message.contato_id, bucket);
    }
  }

  let updated = 0;
  let skipped = 0;
  const details = [];

  for (const attendance of openAttendances) {
    const attendanceMessages = messagesByAttendance.get(attendance.id) ?? [];
    const contactMessages = messagesByContact.get(attendance.contato_id) ?? [];
    const mergedMessages = [...attendanceMessages, ...contactMessages];

    const incomingNames = chooseLatestNames(mergedMessages.filter((message) => !message.from_me));
    const outgoingNames = chooseLatestNames(mergedMessages.filter((message) => message.from_me));
    const candidateName = incomingNames[0] ?? null;

    if (!candidateName) {
      skipped += 1;
      details.push({
        attendanceId: attendance.id,
        contatoId: attendance.contato.id,
        currentName: attendance.contato.contato,
        phone: attendance.contato.telefone,
        action: 'skipped-no-incoming-name',
      });
      continue;
    }

    const autoFixAllowed = shouldAutoFixName({
      currentName: attendance.contato.contato,
      phone: attendance.contato.telefone,
      incomingNames,
      outgoingNames,
    });

    if (!autoFixAllowed || attendance.contato.contato === candidateName) {
      skipped += 1;
      details.push({
        attendanceId: attendance.id,
        contatoId: attendance.contato.id,
        currentName: attendance.contato.contato,
        candidateName,
        phone: attendance.contato.telefone,
        action: autoFixAllowed ? 'skipped-already-correct' : 'skipped-not-suspicious',
      });
      continue;
    }

    await prisma.contato.update({
      where: { id: attendance.contato.id },
      data: {
        contato: candidateName,
      },
    });

    updated += 1;
    details.push({
      attendanceId: attendance.id,
      contatoId: attendance.contato.id,
      previousName: attendance.contato.contato,
      newName: candidateName,
      phone: attendance.contato.telefone,
      action: 'updated',
    });
  }

  console.log(
    JSON.stringify(
      {
        openAttendances: openAttendances.length,
        updated,
        skipped,
        details,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
