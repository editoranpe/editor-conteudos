# Editor de Conteúdos Editora NPE

Gestão editorial e estúdio de artes da equipe NPE. Adaptação do fluxo funcional do ZIP fornecido, com backend novo integralmente Cloudflare. Não usa Supabase nem depende do Lovable.

## Experimentar a interface

```bash
npm ci
npm run dev
```

Abra `http://localhost:8080/?preview=1`. A demonstração usa exemplos em memória: não grava D1/R2, não gera IA nem envia publicações. O estúdio permite exportar artes reais e guardar o JSON editável.

## Arquitetura

- React + TypeScript + Vite + Tailwind para a interface.
- Cloudflare Workers: API autenticada.
- Cloudflare D1: pautas, equipe, permissões, histórico de envios e metadados.
- Cloudflare R2 privado: projetos visuais e anexos.
- Cloudflare Access: autenticação por e-mail ou provedor autorizado, JWT validado no Worker.
- Workers AI: escrita/revisão e análise de transcrições. Depende de modelo disponível e cotas da conta.
- n8n: webhook para receber pautas aprovadas; os conectores reais das redes são uma próxima etapa.

## Verificar

```bash
npm test
npm run build
```

Veja [PRD](docs/PRD.md), [instalação](docs/CLOUDFLARE.md) e [contrato n8n](docs/N8N.md).

## Situação

Código inicial. Não publicado na conta Cloudflare. Exige provisionamento dos recursos, configuração do Access e testes com as contas reais antes do uso da equipe. Nenhuma credencial ou dado de produção foi incluído.
