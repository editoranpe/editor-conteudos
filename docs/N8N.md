# Integração n8n • contrato versão 1

O Worker envia uma pauta aprovada somente após clique de administrador. O endpoint `POST /api/contents/:id/dispatch` é autenticado, verifica aprovação e cria uma identificação por conteúdo/versão. O evento é enviado ao webhook HTTPS guardado como secret no Worker.

Cabeçalhos: `Content-Type: application/json`, `X-NPE-Secret` e `Idempotency-Key`.

Exemplo de corpo, com identificadores ilustrativos:

```json
{
  "version": 1,
  "event": "content.approved",
  "eventId": "ID-DO-CONTEUDO:3",
  "timezone": "America/Sao_Paulo",
  "content": {
    "id": "ID-DO-CONTEUDO",
    "revision": 3,
    "title": "Uma história que merece ser contada",
    "body": "Texto aprovado",
    "frente": "Editora NPE",
    "campanha": "Construção de legado",
    "canal": "Instagram",
    "formato": "Carrossel",
    "responsible": "",
    "date": "2026-11-05",
    "time": "19:00",
    "status": "Aprovado"
  }
}
```

## Primeiro fluxo a configurar

1. Webhook POST de produção com Header Auth (`X-NPE-Secret`).
2. Validar `version`, `event`, `eventId`, campos obrigatórios e `content.status === 'Aprovado'`.
3. Registrar e reservar `eventId` em armazenamento persistente com chave única antes de executar uma ação externa. Execuções repetidas devem retornar o resultado já registrado. Não use apenas uma variável em memória.
4. Converter data/hora usando `America/Sao_Paulo`. Recusar ou encaminhar para revisão se faltar data, horário, mídia necessária ou permissão da conta de destino.
5. Encaminhar ao ramo do canal. Esta etapa depende das contas e das APIs específicas e ainda precisa ser construída.
6. Só considerar publicado após a rede responder com identificador ou URL da publicação.
7. Registrar resultado e alertar o responsável em falhas. O app ainda não possui endpoint de callback; o administrador confirma manualmente a etapa Publicado após verificar a rede.

## Recebimento não confirma publicação

O Worker registra `aceito` quando recebe resposta HTTP 2xx do webhook. Esse estado confirma transporte, não publicação nem validação de todos os campos pelo fluxo. O status da pauta não muda automaticamente. Após um timeout, o fluxo pode já ter recebido o evento; a mesma versão fica bloqueada para reenvio automático. Confira o registro do n8n antes de produzir uma nova versão ou planejar uma retomada administrativa.

## Arquivos

Este contrato envia metadados e texto. Não inclui URLs públicas nem credenciais de anexos. Para publicação com mídia, será necessário implementar o acesso do n8n aos arquivos com autenticação de serviço ou URLs temporárias, relacionar os arquivos à pauta e completar o contrato. Não abra o bucket R2 publicamente para resolver isso.
