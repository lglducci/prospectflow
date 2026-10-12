# ProspectFlow independente

Aplicação React/Vite separada do SaaS Admin, com tema escuro por padrão e opção clara, preservando a central ProspectFlow enviada.

## Executar no Windows
1. Extraia este pacote em C:\projetos\prospectflow.
2. Copie `.env.example` para `.env` e configure o proxy n8n.
3. Execute `npm ci`, depois `npm run dev`.
4. Abra http://localhost:5175. Para gerar publicação: `npm run build`.
Requer Node 22.12+ (ou versão compatível com Vite 7). Dependências fixadas no package-lock.json.

## O que está implementado
- Login, cadastro do responsável/empresa, recuperação e redefinição de senha: formulários, validação, estados e chamadas aos endpoints definidos.
- Restauração de sessão, acesso protegido e encerramento de sessão, sem empresa padrão 1 ou bypass de login.
- Cookie de sessão HttpOnly gerenciado pelo backend; CSRF em memória; apenas preferência visual em localStorage.
- Tema global escuro/claro persistente e compartilhado com a central existente.
- Central original: contatos, conversas, importação, cadências, agenda e demais recursos que já estavam no componente.
- Tela Minha empresa integrada ao contrato n8n.
- Cadastro dinâmico de pesquisas: título, apresentação, vigência, ativa/inativa, encerramento, N perguntas e N alternativas, tipos, obrigatoriedade, complemento em texto e reordenação.
- SQL para empresa/usuário/vínculo, pesquisa/perguntas/alternativas, campanhas/participações/respostas e API transacional de cadastro de pesquisas.

## O que depende do seu n8n
Login, cadastro, cookies, recuperação por e-mail, sessão e autorização real exigem os workflows em docs/CONTRATOS_N8N.md. A central não abre sem resposta válida de sessão; o frontend por si só não autentica ninguém.
As rotas legadas precisam de autenticação/autorização antes de serem usadas por esta aplicação. Nenhum banco ou workflow de produção foi modificado.
Cron de campanha, execução da entrevista no WhatsApp e dashboard de respostas ainda não implementados. As tabelas e o desenho de integração foram incluídos para a próxima etapa.
Não foi criada instalação PWA/native app nesta versão; interface nova é responsiva, enquanto a central mantém o layout original.

## Banco e migração
Execute 001 e 002 primeiro em homologação Supabase. Leia 003_migracao_existente_PLANO.md ANTES de transferir empresas e alterar vínculos antigos. A autenticação usa auth.users; cadastros comerciais ficam em prospect.
Scripts SQL antigos do RAR foram incluídos somente como referência, sem execução automática. As versões não constituem um dump completo/atual do banco.
Não redefina empresa_id dos dados existentes. Preserve seus IDs na migração.
O isolamento das novas tabelas é configurado por RLS. O isolamento e as permissões das tabelas antigas precisam ser revisados na migração; não são alterados cegamente.

## Organização
src/auth: sessão; src/lib: HTTP e tema; src/config: URLs; src/pages: telas; database: SQL e referência; docs: contratos.

## Publicação
Sirva dist/ em HTTPS com fallback de SPA. Configure /api para n8n no mesmo domínio. O proxy de vite.config.js serve apenas ao desenvolvimento. Somente URLs públicas em variáveis VITE_ — nunca senhas/chaves.
Configure headers de segurança (CSP adaptada aos estilos inline da central, frame-ancestors, nosniff, referrer-policy) no servidor. Não é adequado liberar o frontend contra APIs legadas sem validação de sessão.
