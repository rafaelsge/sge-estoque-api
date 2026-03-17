const { resolveContactName } = require('./evolution-contact-name');

async function main() {
  const webhookPayload = {
    event: 'messages.upsert',
    instance: 'MinhaInstancia',
    data: {
      key: {
        remoteJid: '5511999999999@s.whatsapp.net',
      },
      pushName: 'Joao Silva',
      message: {
        conversation: 'Ola',
      },
    },
  };

  const result = await resolveContactName({
    webhookPayload,
    baseUrl: 'https://sua-evolution.exemplo.com',
    instance: 'MinhaInstancia',
    apiKey: 'SUA_API_KEY',
    timeoutMs: 10000,
    logger: console,
  });

  console.log('Resolved contact:', result);
}

main().catch((error) => {
  console.error('Example failed:', error);
});
