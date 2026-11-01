# Publicar na sua conta Cloudflare

Pré-requisitos: Node.js 22 ou superior compatível com a versão do Wrangler instalada, conta Cloudflare com Workers, D1, R2, Workers AI e Cloudflare Access disponíveis. O R2 ou outros serviços podem exigir habilitação e cobrança na conta. Não há credenciais incluídas no projeto.

## 1. Preparar

```bash
npm ci
npx wrangler login
npx wrangler d1 create editor-conteudos-npe
npx wrangler r2 bucket create editor-conteudos-npe-arquivos
```

Copie o ID retornado pelo primeiro comando de criação para `d1_databases[0].database_id` em `wrangler.jsonc`. Não crie outro banco se já existir um com os dados desta instalação.

## 2. Configurar login

No Cloudflare Zero Trust, crie uma aplicação Access do tipo Self-hosted para o endereço onde o sistema será publicado. Autorize somente os e-mails de Jeff, Gi e da equipe, com o método de login desejado, como código por e-mail.

Preencha as variáveis em `wrangler.jsonc` ou nas configurações de implantação:

- `ACCESS_TEAM_DOMAIN`: URL da equipe Access, como `https://sua-equipe.cloudflareaccess.com`.
- `ACCESS_AUD`: audiência da aplicação criada no Access.
- `ADMIN_EMAILS`: e-mails dos administradores separados por vírgula. Essa lista provisiona administradores apenas no primeiro acesso; as mudanças posteriores são feitas na tela Equipe.
- `AI_MODEL`: modelo de texto disponível no catálogo Workers AI da conta. O modelo no exemplo deve ser verificado antes da publicação.

Não use e-mails ilustrativos como administradores reais. Os demais membros entram pendentes e são liberados pela equipe administradora após o primeiro login. O servidor valida a assinatura, emissor, audiência e expiração do JWT. Sem configuração válida, a API permanece bloqueada. Não há login de desenvolvimento que dispense essa validação.

Proteja o domínio definitivo e também qualquer endereço workers.dev ou de preview que permaneça acessível. Mesmo sem Access em um endereço alternativo, a API valida o JWT e recusa requisições sem sessão.

## 3. Aplicar o banco e publicar

```bash
npm run build
npm run db:remote
npx wrangler deploy
```

O build vai para `dist`. O Worker serve a interface e atende `/api/*`. O comando `npm run deploy` também compila antes de publicar, mas não aplica migrações automaticamente. Na primeira instalação aplique as migrações antes do deploy.

Para integração contínua, conecte este repositório na conta Cloudflare e configure o build `npm run build` e o deploy `npx wrangler deploy`. Faça o provisionamento e as migrações de produção como etapa separada e controlada antes de publicar versões que alterem o esquema.

## 4. Configurar o n8n

```bash
npx wrangler secret put N8N_WEBHOOK_URL
npx wrangler secret put N8N_WEBHOOK_SECRET
```

Informe a URL HTTPS de produção e um segredo longo gerado para essa integração. Cadastre o mesmo segredo como credencial Header Auth no webhook n8n, usando o cabeçalho `X-NPE-Secret`. Esses valores não entram no GitHub.

## 5. Conferir em produção

Entre como administrador e crie uma pauta; entre com outro e-mail para testar a aprovação do acesso. Verifique calendário, upload/download no R2, abrir/salvar projeto do estúdio e uma geração real de texto. Use um fluxo n8n de teste que apenas registre a entrada antes de habilitar publicações reais. Verifique também que um visualizador não consegue gravar e que um editor não aprova conteúdo.

O navegador de desenvolvimento Vite encaminha `/api` para `127.0.0.1:8787`. A prévia da interface funciona sem backend com `?preview=1`. Para testar autenticação real, utilize uma implantação protegida pelo Access; o projeto não aceita cabeçalhos de e-mail como substituto do JWT.

## Backup e manutenção

Defina uma rotina de backup/exportação do D1 e retenção do R2 antes do uso contínuo. Projetos e anexos são privados. A tabela `rate_limits` usa uma linha por usuário/minuto de uso de IA; remova registros antigos periodicamente. O painel lista até 1.000 conteúdos e 200 projetos nesta versão. A conta Cloudflare deve possuir cotas adequadas ao volume real de anexos e chamadas de IA.

## Documentação oficial

- https://developers.cloudflare.com/workers/wrangler/configuration/
- https://developers.cloudflare.com/d1/reference/migrations/
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
