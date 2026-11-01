# Editor de Conteúdos Editora NPE

- Interface e documentação em português brasileiro. Identidade em src/config/brand.ts.
- Backend exclusivamente Cloudflare Workers, D1 e R2. Não reintroduzir Supabase.
- Autenticação Cloudflare Access validada no Worker; nunca confiar apenas no cabeçalho de e-mail.
- Verificar permissões no servidor. Apenas administrador aprova e dispara automações.
- Preservar revisões otimistas e idempotência dos envios.
- Não publicar credenciais. Arquivos R2 privados e acessíveis por API autenticada.
- Executar npm test e npm run build antes de enviar alterações.
- Usar branch e pull request; não reescrever histórico publicado.
- Distinguir prévia local, código implementado e integrações testadas em produção.
