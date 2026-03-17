# API V2 - Evolution Ingestao Canonica de Mensagens

## Objetivo
Esta versao 2 muda a API interna da Evolution para que ela deixe de ser apenas um webhook handler e passe a ser a base de estado das mensagens do WhatsApp.

O ponto central da v2 e:
- persistir toda mensagem/evento recebido da Evolution;
- garantir unicidade por `instance_name + message_id`;
- preservar o payload bruto;
- separar a mensagem canonica da entidade de atendimento;
- permitir reply futuro por `quoted.key.id` sem heuristica por texto.

## O que foi alterado

### 0. Foto de perfil no contato
Foi adicionada persistencia da foto do contato em `contatos`.

Campos adicionados:
- `profile_picture_url`
- `profile_picture_checked_at`

Comportamento:
- ao identificar um contato novo, a API tenta buscar a foto via Evolution;
- quando o contato ainda nao tem foto, a API tenta revalidar por TTL;
- se a Evolution retornar `null`, erro, timeout ou `not-authorized`, a API nao quebra o fluxo;
- a tela deve seguir com avatar padrao quando `profile_picture_url` estiver nulo.

### 1. Nova entidade canonica de mensagem
Foi adicionada a tabela `mensagens_ingestao`, independente de `atendimentos` e de `mensagens`.

Ela passa a concentrar o estado consolidado da mensagem recebida da Evolution, com os seguintes campos:
- `instance_name`
- `message_id`
- `remote_jid`
- `chat_jid`
- `contact_jid`
- `contact_phone_normalized`
- `sender_jid`
- `participant_jid`
- `attendance_id`
- `from_me`
- `direction`
- `message_type`
- `message_text`
- `caption`
- `media_url`
- `media_mime_type`
- `media_file_name`
- `quoted_message_id`
- `quoted_message_text`
- `quoted_remote_jid`
- `status`
- `message_timestamp`
- `push_name`
- `payload_raw_json`
- `source_event_type`
- `received_at`
- `processed_at`

Campos adicionais de controle adicionados na implementacao:
- `cod_loja`
- `contato_id`
- `legacy_mensagem_id`
- `deleted_at`
- `edited_at`
- `created_at`
- `updated_at`

### 2. Log bruto de todos os eventos
Foi adicionada a tabela `mensagens_ingestao_eventos`.

Ela existe para garantir rastreabilidade e reprocessamento:
- um registro bruto por evento recebido;
- payload original armazenado sem depender de a normalizacao ter dado certo;
- suporte a reentrega, update, edicao e delete sem perder historico do que chegou.

Campos:
- `mensagem_ingestao_id`
- `instance_name`
- `message_id`
- `source_event_type`
- `payload_raw_json`
- `received_at`
- `processed_at`
- `created_at`

### 3. Idempotencia obrigatoria
A mensagem canonica passou a usar `UNIQUE(instance_name, message_id)`.

Com isso:
- duplicados nao geram nova mensagem canonica;
- updates do mesmo `message_id` atualizam o mesmo registro;
- o estado da mensagem fica consolidado;
- `remote_jid` original nao e sobrescrito por telefone limpo.

### 4. Indices criados
Foram criados os indices exigidos:
- `instance_name + message_id` como unique key
- `attendance_id`
- `remote_jid`
- `quoted_message_id`

Indice adicional de suporte:
- `cod_loja`

No log bruto tambem foi criado indice por:
- `instance_name + message_id`
- `mensagem_ingestao_id`

## Mudanca no fluxo do webhook

### Antes
O webhook:
- resolvia loja;
- criava/reutilizava contato;
- criava/reutilizava atendimento;
- gravava direto em `mensagens`;
- ignorava eventos sem texto/base64;
- nao tinha `message_id`, quoted, payload bruto nem idempotencia canonica.

### Depois
O webhook agora opera em duas camadas.

#### Camada 1. Persistencia canonica
Sempre que um evento chega:
1. o payload bruto e serializado;
2. o evento bruto e salvo em `mensagens_ingestao_eventos`;
3. a mensagem e normalizada;
4. o estado canonico e salvo com upsert em `mensagens_ingestao`.

Essa etapa acontece antes da logica de atendimento.

#### Camada 2. Vinculacao operacional com atendimento
Somente quando o evento representa uma mensagem de atendimento:
1. resolve `cod_loja`;
2. resolve telefone do contato;
3. cria/reutiliza contato;
4. cria/reutiliza atendimento ativo;
5. cria o registro legado em `mensagens` se ainda nao houver vinculo;
6. atualiza a mensagem canonica com `attendance_id`, `contato_id`, `legacy_mensagem_id` e `cod_loja`.

## Regras aplicadas na v2

### Persistencia
- toda mensagem/evento recebido passa a ser registrado no log bruto;
- toda mensagem com `instance_name` e `message_id` passa a ter estado canonico;
- o payload bruto nao depende do sucesso da normalizacao;
- `quoted_message_id` e persistido sempre que houver `contextInfo.stanzaId` ou equivalente.

### Integridade de identificacao
- `remote_jid` e preservado como veio da Evolution;
- `contact_phone_normalized` e apenas derivado;
- o sistema nao usa texto para identificar mensagem;
- reply futuro deve consultar por `message_id`.

### Duplicidade e fora de ordem
- reentrega gera novo log bruto, mas nao duplica a mensagem canonica;
- `messages.update` atualiza a mensagem existente;
- `messages.delete` marca o estado como `deleted` e preenche `deleted_at`;
- eventos de edicao marcam `status = edited` e `edited_at`;
- updates nao criam novo registro legado de atendimento.

### Separacao entre mensagem e atendimento
- `mensagens_ingestao` e a mensagem canonica;
- `mensagens` continua sendo o historico operacional do atendimento;
- a mensagem canonica pode existir mesmo sem `attendance_id`;
- falha em localizar loja ou atendimento nao apaga nem impede a persistencia da mensagem canonica.

## Extracoes adicionadas no controller
O controller passou a extrair e normalizar:
- `instance_name`
- `message_id`
- `remote_jid`
- `chat_jid`
- `participant_jid`
- `sender_jid`
- `contact_jid`
- `contact_phone_normalized`
- `quoted_message_id`
- `quoted_message_text`
- `quoted_remote_jid`
- `message_timestamp`
- `push_name`
- `caption`
- `media_url`
- `media_mime_type`
- `media_file_name`
- `source_event_type`
- `status`

Tambem foram adicionados suportes para:
- `messages.upsert`
- `messages.update`
- `messages.delete`
- `protocolMessage`
- `editedMessage`
- mensagens com `extendedTextMessage`
- mensagens com `imageMessage`
- mensagens com `videoMessage`
- mensagens com `documentMessage`
- mensagens de grupo com `participant`

## Novo endpoint interno
Foi adicionado o endpoint:

`GET /mensagens/interna/message-id/:message_id`

Query opcional:
- `instance_name`

Comportamento:
- se `instance_name` for informado, busca diretamente a mensagem canonica da instancia;
- se nao for informado e existir mais de uma ocorrencia do mesmo `message_id`, retorna `409` pedindo a instancia;
- esse endpoint existe para reply futuro sem adivinhacao.

## Novo endpoint de foto do contato
Foi adicionado o endpoint:

`PATCH /mensagens/contato/:contato_id/foto`

Body esperado:
- `cod_loja`
- `profile_picture_url`

Comportamento:
- grava manualmente a URL da foto no contato;
- atualiza `profile_picture_checked_at`;
- aceita limpar a foto enviando `null` ou vazio;
- a URL precisa ser `http` ou `https` valida.

## Regra de consulta da foto via Evolution
Foi implementada a funcao `fetchContactProfilePhoto(instanceName, remoteJid|phone)`.

Endpoint usado:
- `POST /chat/fetchProfilePictureUrl/{instance}`

Headers:
- `Content-Type: application/json`
- `apikey: <api-key>`

Body:
- `{ "number": "<remoteJid ou telefone normalizado>" }`

Regras aplicadas:
- normalizacao segura de `remoteJid/telefone`;
- log da tentativa, `status HTTP`, `wuid` e resultado;
- `apikey` nao e exposta em log;
- revalidacao por TTL para evitar chamadas excessivas;
- nao assume que sempre existe foto.

## Arquivos alterados na implementacao
- `prisma/schema.prisma`
- `prisma/migrations/20260317120000_mensagens_ingestao_canonica/migration.sql`
- `src/controllers/mensagens.controller.ts`
- `src/routes/mensagens.routes.ts`

## O que nao foi alterado
- a tabela legado `mensagens` nao foi expandida com todos os campos canonicos;
- as listagens atuais de atendimento continuam lendo de `mensagens`;
- a separacao foi feita introduzindo a camada canonica, sem quebrar a API atual.

## Script SQL da v2
O script SQL pronto para aplicacao esta em:

`docs/api-v2-evolution-ingestao.sql`

## Validacao executada
Validado com:

```bash
npm run build
```

## Recomendacao de rollout
1. aplicar a migration/tabelas novas;
2. fazer deploy do backend com o webhook novo;
3. validar eventos `messages.upsert`, `messages.update` e `messages.delete`;
4. integrar o envio futuro de reply consultando `mensagens_ingestao` por `instance_name + message_id`.
