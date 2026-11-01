# Editor de Conteúdos Editora NPE

Versão 0.1 • Escopo acordado em 01/11/2026

## Propósito

Jeff, Gi e equipe interna precisam planejar, produzir, revisar e acompanhar conteúdos de todas as frentes em um só ambiente. A experiência deve preservar a identidade da Editora NPE e reduzir o trabalho repetido entre briefing, arte e publicação.

## Decisões confirmadas

- Código no GitHub editoranpe/editor-conteudos; hospedagem na conta Cloudflare do usuário.
- Dados no D1, anexos e projetos visuais no R2, API no Workers. Sem Supabase.
- Login por Cloudflare Access e perfis no D1; administradores configurados explicitamente.
- n8n já instalado; fluxos de publicação serão configurados separadamente.
- Artes e carrosséis a partir de modelos preenchíveis, sem editor de arrastar objetos.
- Frentes: institucional, Método EPV, cursos/mentorias, livros/autores e Jeff/Gi.

## Fluxo

Ideia → Em produção → Em revisão → Aprovado → Publicado.
Cada pauta tem título, corpo, frente, campanha, canal, formato, responsável, data e horário de Brasília. A etapa Publicado é confirmação manual por administrador nesta versão; a integração não altera esse estado automaticamente.

## Entregue no código desta versão

1. Painel com contadores derivados das pautas e filtros por frente, busca e status.
2. Lista de pautas, criação, edição, responsável, revisão/aprovação por administrador e proteção contra salvar sobre alterações de outra pessoa.
3. Calendário mensal com navegação, filtros e abertura das pautas. Agendamento é planejamento, não publicação.
4. Estúdio com três modelos NPE, 1 a 10 slides, formatos 1080×1350, 1080×1080 e 1080×1920, imagem por slide, ajuste de texto ao espaço, PNG individual e ZIP com PNGs + JSON editável.
5. Projetos visuais no R2 e metadados no D1. Uploads em R2 autenticados, até 25 MB por anexo nesta versão.
6. Escrita, revisão e sugestões de cortes baseadas em transcrição no Workers AI. O resultado é editável e pode virar uma pauta.
7. Equipe com administrador, editor e visualizador. Novos acessos ficam pendentes até aprovação.
8. Envio manual de conteúdos aprovados ao webhook n8n, identificação por conteúdo/versão e histórico de recebimento.
9. Demonstração por ?preview=1, com dados apenas em memória e sem chamadas à IA, publicações ou banco.

## Critérios de aceite

- Usuário sem JWT válido de Access não acessa /api; domínio e audiência são verificados.
- Editor não aprova nem altera conteúdo já aprovado; visualizador não grava.
- Frente, campanha, responsável e agenda sobrevivem a outro login após configurar D1.
- Artes baixadas têm as dimensões selecionadas; arquivos editáveis podem ser reabertos.
- Aprovação não publica automaticamente. Somente administradores enviam ao n8n.
- Falha ou timeout no webhook não aparece como publicação bem-sucedida.
- Alterações simultâneas geram conflito, preservando o trabalho já salvo.

## Próximos incrementos e limitações

- Conectar contas e montar publicação real para os canais priorizados. O código atual envia dados, mas não contém os conectores de publicação nas redes.
- Relacionar os arquivos exportados do estúdio com pautas; hoje podem ser baixados e anexados manualmente.
- Renderizar cortes de vídeos, importar URL de live, extrair áudio e transcrever. Hoje a entrada é texto com timecodes e a saída é uma sugestão.
- Notificações, comentários, calendário arrastável, métricas reais, histórico completo de versões e gestão de campanhas como entidade separada.
- A listagem atual retorna as 1.000 pautas mais recentes e 200 projetos; paginação é necessária antes de ultrapassar esse volume.
- O estúdio usa imagens JPEG comprimidas nos projetos e fontes de sistema; não reproduz a tipografia proprietária do logotipo.
- Prévia usa exemplos em memória. Fechar ou atualizar a página apaga alterações que não foram baixadas.

## Decisões ainda necessárias

1. E-mails de Jeff e Gi para os administradores e domínio do aplicativo.
2. Quais redes receberão a primeira automação e como estão as permissões das contas.
3. Se o Workers AI atende ao estilo esperado ou se devem ser integrados provedores externos.
4. Procedimento de confirmação de publicação e tratamento de envios com resultado incerto.

## Fontes técnicas

- https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/
- https://developers.cloudflare.com/workers/wrangler/configuration/
- https://developers.cloudflare.com/d1/reference/migrations/
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
- https://developers.cloudflare.com/workers-ai/models/
