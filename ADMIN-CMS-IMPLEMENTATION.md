# Velmont — CMS e painel administrativo

Documento de entrega do painel `/admin`, do blog `/blog` e da captura de leads.
Leia inteiro antes do primeiro deploy: **nada muda em produção até o Supabase e as variáveis da Vercel serem configurados** (seção 9). Sem essas variáveis, o build gera exatamente o site atual, com os artigos em `/blog`.

---

## 1. Auditoria do projeto encontrado

| Item | Situação encontrada |
|---|---|
| Framework em produção | **Não é Next.js.** Build estático próprio (`scripts/build-static.mjs`): rolldown + `react-dom/server.renderToString`, HTML pré-renderizado e hidratação no navegador. As pastas `app/` e o pacote `vinext` são um scaffold alternativo (`dev:vinext`, `build:worker`) que não vai para produção. |
| React / TypeScript | React 19.2.6 → **atualizado para 19.2.8** (corrige o DoS em Server Functions do `react-server-dom-*`, que só era carregado pelo scaffold vinext). TypeScript 5.9. |
| Package manager | pnpm (lockfile v9; CI com pnpm 11.19). |
| Hospedagem | Vercel, `framework: null`, `outputDirectory: dist`, `cleanUrls`. Projeto `velmont` no escopo `boop10` (o token desta sessão não tinha acesso aos domínios e às configurações desse escopo). |
| Domínio | Canonical e sitemap usavam a origem de preview `…chatgpt.site`, via `NEXT_PUBLIC_SITE_URL`. O domínio comercial não está definido no repositório. |
| Wix | Nenhuma referência no código. Se a Wix é usada, deve ser só no DNS/e-mail do domínio (fora do repositório). Não houve nenhuma alteração relacionada. |
| Backend, APIs, banco | Inexistentes. |
| Formulário | Um formulário (contato): monta a mensagem e abre `wa.me`. Não gravava nada, e a página de privacidade afirmava isso. |
| Blog | 3 artigos fixos em `content/insights.ts`, em `/insights/[slug]`, com BlogPosting e BreadcrumbList. |
| SEO | `lib/seo.ts` (title, description, canonical, OG, Twitter, JSON-LD com Organization, WebSite, Person, Service, FAQPage). `robots.txt`: `User-agent: * / Allow: /` (OAI-SearchBot e Googlebot liberados). Sitemap gerado no build. |
| Analytics | Nenhum. |
| Headers | Apenas `nosniff` e `Referrer-Policy`. |
| `pnpm audit` | 22 alertas (11 altos): `react-server-dom-webpack`, vite, undici/ws/sharp (via `@cloudflare/vite-plugin`) e `image-size` (via vinext). Todos em ferramentas de desenvolvimento ou no scaffold vinext; nenhum no bundle público. **Depois das atualizações: 0 vulnerabilidades.** |

## 2. Arquitetura implementada

```
Navegador ──► Vercel (estático: dist/)
              ├─ / , /blog, /blog/<slug>, /privacidade   HTML pré-renderizado (sem consulta ao banco)
              ├─ /admin, /admin/preview                   SPA privada (shell sem dados, noindex)
              └─ /api/*  Vercel Functions (Node 22)
                   ├─ POST /api/leads            público: valida, rate limit, grava lead
                   ├─ POST|DELETE /api/admin/media   upload (bucket privado) / exclusão (staff)
                   ├─ POST /api/admin/publish    publica/despublica/arquiva: copia só as imagens do
                   │                             artigo para o bucket público, limpa as sem uso, rebuild
                   ├─ POST /api/admin/rebuild    limpeza de mídia pública + Deploy Hook (staff)
                   └─ GET  /api/blog-fallback    301 de slug antigo / 404
Admin (navegador) ──► Supabase Auth (senha + TOTP), PostgREST (RLS decide tudo)
                      e Storage: imagens de rascunho só por URL assinada que expira
Build na Vercel   ──► Supabase: lê apenas public.published_articles com a chave anon
```

Decisões principais:

- **O site público continua estático.** O build busca os artigos publicados e gera o HTML. Publicar no painel dispara um *Deploy Hook*, e o site é atualizado em cerca de 1–2 minutos. Com isso, páginas públicas nunca consultam o banco, uma instabilidade do Supabase não derruba o blog, e o conteúdo fica 100% no HTML indexável (Core Web Vitals preservados).
- **Rascunho e versão publicada ficam separados.** `articles` guarda a cópia de trabalho; `published_articles` guarda o *snapshot* que o público vê. Editar um artigo publicado não altera o site até clicar em **Publicar alterações**, então nenhuma versão publicada se perde em silêncio.
- **Conteúdo em blocos tipados (JSON), nunca HTML.** Os blocos são parágrafo, título H2/H3, lista, destaque "Em resumo", pergunta e resposta, citação, tabela e imagem. Formatação inline limitada a `**negrito**`, `*itálico*` e `[link](url)`. O renderer produz somente elementos React: não há `dangerouslySetInnerHTML` com conteúdo de usuário, e links só aceitam `https`, `http`, `mailto`, `/` e `#`.
- **`/insights` virou `/blog`** (pedido do projeto), com **301** para as URLs antigas em `vercel.json`. Os 3 artigos de lançamento foram importados para o CMS (migration). O rótulo visível continua "Insights".
- **Mídia de rascunho é privada.** Todo upload vai para o bucket privado `media-private`. O público só recebe cópias das imagens usadas por artigos publicados (seção 4.1).
- **Nenhuma dependência de IA** foi adicionada ao painel.

### Componentes públicos alterados (mínimo necessário)

| Arquivo | Mudança |
|---|---|
| `components/velmont/home.tsx` | `href` de `/insights…` → `/blog…`; `InsightCards` recebe os artigos por prop; o formulário registra o lead **apenas** com `NEXT_PUBLIC_LEAD_CAPTURE=true` (honeypot invisível + frase de privacidade). O WhatsApp continua abrindo igual. |
| `components/velmont/article-view.tsx`, `insight-cards.tsx`, `breadcrumbs.tsx`, `static-site.tsx` | Dados vindos do CMS; mesmo markup. |
| `app/privacidade/page.tsx` | Texto condicional: com captura de leads ativa, descreve o armazenamento. **Revisão jurídica recomendada (Lisandra).** |
| `app/blog.css` | Estilos novos só para elementos que ainda não existiam (h3, listas, destaque, tabela, figura, FAQ), escopados em `.article-body`. |

Verificação: o **corpo e o `<head>` de todas as 7 páginas atuais são idênticos byte a byte** aos da versão em produção (commit `79cb566`), exceto pela troca `/insights` → `/blog`.

## 3. Banco de dados e tabelas

Migrations em `supabase/migrations/`:

- `20260922120000_admin_cms.sql`: schema, RLS, funções e storage.
- `20260922120100_import_launch_articles.sql`: importa os 3 artigos atuais, sem inventar datas (gerado por `scripts/generate-legacy-import.ts`).
- `20260923090000_private_draft_media.sql`: bucket privado `media-private`, policies de Storage, coluna `media.public_since` e publicação de imagens controlada (seção 4.1).

| Tabela | Conteúdo |
|---|---|
| `admin_users` | Equipe: `user_id`, e-mail, nome, `role` (`owner`/`editor`), `active`. **Fonte única de papéis**; nunca usa metadata editável. |
| `articles` | Cópia de trabalho: título, slug, resumo, `content` (JSON validado), imagem, autoria (`velmont`/`danielle`/`lisandra`), categoria, tags, referências, campos de SEO/OG, `robots_index`, `status` (`draft`/`review`/`published`/`archived`), `version` (bloqueio otimista), `created_by`/`updated_by`/datas. |
| `published_articles` | Snapshot público, a **única** tabela legível sem login. |
| `article_revisions` | Histórico automático: cada edição guarda a versão anterior; cada publicação guarda o snapshot. |
| `slug_redirects` | Slug antigo → artigo, criado automaticamente quando um artigo publicado muda de endereço (301). |
| `media` | Imagens: caminho, tipo, bytes, dimensões, texto alternativo e `public_since` (preenchido só enquanto existe cópia no bucket público; alterável apenas pela service role). |
| `leads` | Nome, empresa, interesse, página de entrada, origem (somente a origem do referrer), UTMs, `status` (`new`/`contacted`/`qualified`/`converted`/`archived`) e notas internas. **Nenhum IP é guardado.** |
| `audit_log` | *Append-only*: `actor_id`, `action`, `resource`, `resource_id`, `occurred_at` e metadata mínima (sem dados pessoais de leads, senhas ou tokens). |
| `rate_limits` | Contadores por chave com hash + salt (sem IP em claro). |
| `site_builds` | Solicitações de atualização do site. |

Integridade garantida no banco (não no navegador):

- CHECK constraints validam o JSON do conteúdo, referências (`https?://`), tags, slugs e tamanhos.
- Triggers forçam `created_by`, `updated_by`, datas e `version`, gravam revisões e auditoria, impedem alterar dados enviados de um lead e impedem remover o último owner ativo.
- Mudanças de status só acontecem pelas funções `publish_article`, `unpublish_article`, `archive_article`, `submit_article_for_review` e `return_article_to_draft`.
- `publish_article(id, expected_version)` recusa publicar se outra pessoa editou depois (`40001`) e cria o redirect quando o slug publicado muda.

## 4. Políticas RLS

RLS ativa em **todas** as 10 tabelas. Os privilégios começam do zero (`revoke all` de `anon` e `authenticated`) e as permissões voltam por coluna. Staff significa: linha ativa em `admin_users` **e** JWT com `aal2` (MFA verificado) **e** sessão ainda existente em `auth.sessions`. Por isso, "Sair" invalida o token na hora, e não só quando ele expira.

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `published_articles` | anon + authenticated | — (só via `publish_article`) | — | — |
| `articles` | staff | staff (colunas editáveis) | staff (colunas editáveis; `status` só por função) | **owner** |
| `article_revisions`, `slug_redirects`, `site_builds` | staff | — (trigger/serviço) | — | — |
| `media` | staff | staff (upload valida via API) | staff (só `alt`; `public_since` nunca) | staff (API verifica uso) |
| `leads` | staff | **ninguém** (só service role via `/api/leads`) | staff (só `status` e `notes`) | **owner** |
| `admin_users` | staff | — (só `add_staff_member`, owner) | — (só `update_staff_member`, owner) | — |
| `audit_log` | **owner** | — (triggers/funções) | bloqueado até para service role | bloqueado até para service role |
| `rate_limits` | — | — | — | — (só service role) |

Storage: dois buckets, detalhados em 4.1. Nenhuma escrita parte do navegador; todo upload passa por `/api/admin/media`.

Funções: todas com `set search_path = ''`. `EXECUTE` revogado de `public`/`anon` e concedido apenas ao necessário. `resolve_slug_redirect` é a única função que o anon pode chamar, e exige o slug exato.

### 4.1 Mídia: rascunhos privados, publicação controlada

A segurança **não depende do nome do arquivo**. Os nomes continuam aleatórios, mas isso não é o mecanismo de proteção.

| Bucket | Visibilidade | Leitura | Escrita |
|---|---|---|---|
| `media-private` | **privado** | somente staff ativo, com MFA (`aal2`) e sessão viva, via **URL assinada que expira em 10 min** | somente service role, dentro de `/api/admin/media` depois da validação |
| `media` | público (leitura por URL) | qualquer pessoa, **apenas** cópias de imagens usadas por artigos publicados | somente service role, dentro de `/api/admin/publish` e `/api/admin/rebuild` |

Policies em `storage.objects`, todas **restritivas**, para que nenhuma policy permissiva futura amplie o acesso:

- `anon` nunca lê `media-private`.
- `authenticated` só lê `media-private` se `private.is_staff()`. Essa é a única permissão que permite criar URLs assinadas.
- `anon` e `authenticated` nunca inserem, alteram ou apagam objetos em nenhum dos dois buckets.
- Ninguém lista o bucket público.

Os testes provam isso com uma policy "libera tudo" presente no banco de teste.

**Fluxo de publicação** (`POST /api/admin/publish`):

1. Autentica e autoriza a pessoa (staff) e confere a versão do artigo (bloqueio otimista).
2. Lê, **como a usuária** (RLS), as imagens que o artigo referencia: capa, imagem social e blocos de imagem. Só essas são copiadas de `media-private` para `media`, no mesmo caminho; nenhuma outra mídia privada sai do bucket.
3. A service role marca essas imagens com `media_mark_public` (função executável só pela service role).
4. `publish_article` roda **como a usuária** e revalida no banco:
   - toda imagem referenciada existe e está marcada como pública;
   - cada bloco de imagem aponta para o `path` da própria mídia.
   Se não, recusa (`media_not_public` / `media_mismatch`). Assim, chamar a RPC direto, sem passar pela API, não publica imagem privada.
5. `media_unpublish_unreferenced` desmarca e devolve as imagens que nenhum artigo publicado usa mais, e a API as **apaga do bucket público**. Isso roda em toda publicação, despublicação, arquivamento e em "Atualizar site agora".
   - Há uma carência de 2 minutos, para não apagar a cópia de uma publicação em andamento. Um *advisory lock* serializa publicação e limpeza.
   - Se a remoção falhar, a imagem volta a ser marcada e a próxima limpeza tenta de novo.
6. Dispara o rebuild. O HTML estático aponta apenas para `…/storage/v1/object/public/media/<path>`. O teste verifica que a página pública nunca contém `media-private` nem `token=`.

**No painel**, miniaturas, capa, imagens do editor e o preview usam `createSignedUrls` com validade de 10 minutos. O Storage só assina se a RLS permitir a leitura para aquele JWT. Excluir uma mídia remove o original privado e a eventual cópia pública, e é recusado enquanto algum artigo a usar.

## 5. Autenticação

- **Supabase Auth** com e-mail e senha (mínimo de 12 caracteres), sem cadastro público.
- **MFA TOTP obrigatório para todo mundo.** No primeiro acesso, o painel exige o cadastro do aplicativo autenticador. Sem `aal2`, o banco não devolve nenhum dado privado, mesmo com a senha correta (coberto por testes).
- Recuperação de senha pelo link do e-mail, que leva a `/admin/conta?senha=nova` depois da verificação TOTP. A mensagem é sempre genérica, para não revelar se o e-mail existe. Abra o link **no mesmo navegador** em que pediu a recuperação (fluxo PKCE).
- "Sair de todos os dispositivos" em **Conta** encerra todas as sessões.
- Autorização no servidor: as Functions validam o token chamando `admin_context()` no próprio banco (assinatura, expiração, MFA, sessão e papel). O navegador não decide nada sozinho.
- Sessão guardada no `localStorage` do domínio (padrão do supabase-js), protegida por uma CSP sem scripts de terceiros no admin.

## 6. Variáveis de ambiente

Veja `.env.example`.

| Variável | Onde | Secreta? | Uso |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Build | não | Origem HTTPS definitiva (canonical, sitemap, OG). |
| `NEXT_PUBLIC_SUPABASE_URL` | Build + Functions | não | URL do projeto Supabase. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Build + Functions | não (pública por design) | Chave anon/publishable. O build **recusa** uma chave `service_role` aqui. |
| `NEXT_PUBLIC_LEAD_CAPTURE` | Build + Functions | não | `true` ativa o registro de leads (e o texto correspondente da privacidade). |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Build | não | Opcional (Cloudflare Turnstile). |
| `SUPABASE_SERVICE_ROLE_KEY` | **Functions apenas** | **sim** | Grava leads e objetos de storage, sempre depois da validação. |
| `RATE_LIMIT_SALT` | Functions | **sim** | ≥ 32 caracteres aleatórios (`openssl rand -hex 32`). |
| `TURNSTILE_SECRET_KEY` | Functions | **sim** | Opcional, junto com a site key. |
| `VERCEL_DEPLOY_HOOK_URL` | Functions | **sim** | Deploy Hook da produção. Só URLs `https://api.vercel.com/v1/integrations/deploy/…` são aceitas. |

Nunca use `NEXT_PUBLIC_` em segredos. O `scripts/verify.mjs` varre o `dist/` procurando os valores secretos e JWTs `service_role`.

## 7. Configuração do Supabase (passo a passo)

1. Crie um projeto (sugestão: região **São Paulo, `sa-east-1`**). Plano Pro recomendado para backups diários/PITR, timeouts de sessão e proteção contra senhas vazadas.
2. Aplique as migrations: `npx supabase link --project-ref <ref>` e depois `npx supabase db push`. Alternativa: cole os três arquivos de `supabase/migrations/`, em ordem, no SQL Editor.
3. **Authentication → Sign In / Providers**:
   - **Desative "Allow new users to sign up".**
   - E-mail ativo; confirmações de e-mail ativas.
   - Tamanho mínimo de senha **12**; ative **Leaked password protection** (Pro).
4. **Authentication → Multi-Factor**: **TOTP habilitado (enroll + verify).** No CLI local ele vem desabilitado; o `supabase/config.toml` do repositório já o habilita.
5. **Authentication → URL Configuration**: *Site URL* = domínio definitivo; *Redirect URLs* = `https://<domínio>/admin/conta` (e os previews da Vercel, se desejar).
6. **Authentication → Rate Limits**: mantenha ou reduza os limites de login, verificação e e-mail. Opcional: **Attack Protection → CAPTCHA** (Turnstile) no login.
7. **Sessions** (Pro): defina *inactivity timeout* (ex.: 12 h) e *time-box* (ex.: 7 dias).
8. **API → GraphQL**: se não for usar, desative a extensão `pg_graphql` (ela respeita as mesmas permissões, mas é superfície a menos).
9. Confira em **Storage** que as migrations criaram os buckets `media-private` (**privado**) e `media` (público), ambos com limite de 5 MB e tipos `image/webp, jpeg, png, avif`, e que as policies de `storage.objects` listadas na seção 4.1 aparecem. Não crie policies permissivas extras para esses buckets.
10. Rode **Advisors → Security** e **Performance** e confirme que nenhuma tabela aparece sem RLS.

## 8. Contas de Lisandra e Dani

1. Supabase → **Authentication → Users → Invite user**: convide os dois e-mails.
2. Cada pessoa aceita o convite e define a senha.
3. Libere o acesso. Para a **primeira pessoa responsável (owner)**, use o SQL Editor, trocando os valores:

   ```sql
   insert into public.admin_users (user_id, email, display_name, role)
   select id, email, 'Lisandra Ferreira dos Santos', 'owner' from auth.users where email = 'lisandra@…';
   ```

4. As demais pessoas podem ser liberadas pelo painel: **Equipe → Liberar acesso**, que é visível só para owners.
5. No primeiro login, o painel pede o cadastro do aplicativo autenticador.

**Papéis.** `editor` cria, edita, publica, despublica e arquiva artigos, gerencia mídia e leads. `owner` pode tudo isso e também excluir artigos e leads definitivamente (pedidos LGPD), gerenciar a equipe e ler o registro de atividades. **Decisão da empresa:** Lisandra e Dani podem ser as duas `owner`, ou uma owner e outra editor. O banco exige ao menos um owner ativo.

**Perda do celular (autenticador).** Um owner remove o fator em Supabase → Authentication → Users → (usuário) → *MFA factors*. No próximo login, a pessoa cadastra um novo autenticador.

## 9. Configuração na Vercel e deploy

1. **Settings → Environment Variables** (Production; Preview só se quiser testar com um Supabase de testes): as variáveis da seção 6.
2. **Settings → Git → Deploy Hooks**: crie um hook para o branch de produção e salve a URL em `VERCEL_DEPLOY_HOOK_URL`.
3. Build e saída continuam `pnpm build` → `dist`; o `vercel.json` já declara as Functions (`api/**/*.ts`, Node 22).
4. Faça o deploy (merge do PR). Depois confira:
   - `/blog` e os 3 artigos; `/insights/...` responde **301**.
   - `/admin`: login → MFA → Dashboard (3 publicados).
   - Headers: `Content-Security-Policy`, `Strict-Transport-Security` e, em `/admin`, `X-Robots-Tag: noindex` e `Cache-Control: no-store`.
5. **Leads.** Só ative `NEXT_PUBLIC_LEAD_CAPTURE=true` depois da revisão jurídica do texto de privacidade. Depois, faça um redeploy.
6. **Domínio definitivo.** Atualize `NEXT_PUBLIC_SITE_URL`, a Site URL e as Redirect URLs do Supabase, e reenvie o sitemap no Search Console.
7. **Supabase com domínio customizado.** Se usar, troque `https://*.supabase.co` pelo domínio nas duas CSPs do `vercel.json`.
8. **Região das Functions.** Recomendado `gru1` (São Paulo), perto do banco (Settings → Functions).

### WAF / rate limit no painel da Vercel (Firewall)

A aplicação já limita no banco: 5 leads por cliente a cada 10 min, 300 por hora no total, 60 uploads por hora por pessoa e 30 atualizações do site por hora. Regras complementares recomendadas em **Firewall → Custom Rules**:

| Regra | Condição | Ação |
|---|---|---|
| Leads | Path = `/api/leads` | Rate limit: 10 req / 60 s por IP → 429 |
| Admin API | Path começa com `/api/admin/` | Rate limit: 60 req / 60 s por IP |
| Métodos | Path começa com `/api/` e método ∉ {GET, POST, DELETE, OPTIONS} | Deny |
| Admin (opcional) | Path começa com `/admin` e país ∉ {BR} | Challenge |

Ative também **Bot Protection / Attack Challenge Mode** quando houver abuso. O login e a recuperação de senha são limitados pelo próprio Supabase Auth (seção 7).

## 10. Uso do painel (resumo para Lisandra e Dani)

- **Dashboard**: artigos publicados, rascunhos, leads novos, últimos artigos e leads, e "Atualizar site agora".
- **Artigos → Novo artigo**:
  - Preencha título e resumo e escreva em blocos: use "+ Adicionar bloco"; o texto colado do Word/Docs é dividido em parágrafos automaticamente.
  - **Visualizar** abre a pré-visualização privada.
  - **Publicar** coloca o artigo no site em 1–2 minutos.
  - A caixa **Antes de publicar** orienta sobre títulos de seção, resumo direto, referências, imagem com descrição e links internos, que ajudam leitores e buscadores.
  - **Configurações avançadas de SEO** ficam recolhidas e são opcionais.
- **Leads**: busca, filtros, detalhes completos (UTMs e página de entrada), status e notas internas. O lead indica a intenção de contato; a conversa em si acontece no WhatsApp.
- **Mídia**: envio (otimizado automaticamente) e descrição das imagens. As imagens ficam privadas até serem usadas num artigo publicado. Os links que o painel mostra expiram em minutos, então não servem para compartilhar. Uma imagem em uso não pode ser apagada.

## 11. SEO e GEO

- Cada artigo publicado gera:
  - `<title>`, description, canonical (URL própria ou canonical informada);
  - `robots` (`noindex` quando desmarcado);
  - OG/Twitter e `article:published_time`/`modified_time`;
  - JSON-LD **BlogPosting** com headline, description, image, author (Person real das fundadoras, ou Organization), publisher, `datePublished`, `dateModified` e `mainEntityOfPage`;
  - **BreadcrumbList**; Organization e Person seguem no grafo.
- O JSON-LD só contém o que está visível. Não há datas inventadas: os 3 artigos importados continuam sem data de publicação, e ao serem republicados recebem apenas "Atualizado em".
- **Sitemap**: páginas públicas e artigos com `index` e canonical próprio, com `lastmod`. Rascunhos, previews, `/admin` e `/api` nunca entram.
- **robots.txt**: `Allow: /` para todos os robôs (Googlebot e **OAI-SearchBot liberados**, sem bloqueio específico) e `Disallow: /api/`. `/admin` é protegido por autenticação e `noindex` (header + meta); o robots.txt não é usado como segurança.
- **`/llms.txt`**: gerado a partir do conteúdo real, **opcional**. Não é fator de ranking do Google nem requisito de SEO.
- **Slug alterado em artigo publicado** gera 301 automático (`/api/blog-fallback`). **Artigo despublicado** responde 404.

## 12. Testes executados

| Suite | Comando | Resultado |
|---|---|---|
| RLS / banco (PostgreSQL 16 real, com os privilégios padrão permissivos do Supabase reproduzidos) | `pnpm test:db` | **47/47** tabelas + **10/10** Storage/mídia |
| APIs (leads, upload, publish, rebuild, fallback) | `pnpm test:unit` | **32/32** APIs + **10/10** renderer/schema |
| Build com CMS falso (XSS, noindex, canonical, sitemap, JSON-LD, falha do CMS, chave service_role) | `pnpm test` | **8/8** |
| **E2E** com Supabase Auth (GoTrue v2.186) + PostgREST v13 + Postgres reais, build real, emulação da Vercel e Chromium | `GOTRUE_BIN=… POSTGREST_BIN=… pnpm test:e2e` | **27/27** |
| Páginas, links, orçamento de bundle, isolamento do admin, varredura de segredos | `pnpm verify` | PASS |
| Functions compiladas arquivo a arquivo e carregadas como Node ESM (como na Vercel) | `pnpm check:functions` | PASS |
| typecheck / lint / build / `pnpm audit` | — | limpos / 0 vulnerabilidades |

Os cenários pedidos estão cobertos:

- usuário não autenticado em `/admin` e em links profundos;
- público tentando ler leads (401 `permission denied`);
- usuário tentando alterar role (próprio papel, `add_staff_member`, `update_staff_member`, insert direto);
- draft por id ou slug (API pública, embedding, redirect, preview sem sessão);
- payloads XSS e HTML malicioso (armazenados como texto, renderizados escapados);
- `javascript:`/`data:`/protocol-relative;
- inputs inesperados (tipos errados, arrays, JSON inválido, NoSQL-like `{ $ne }`, SQL injection);
- mass assignment;
- upload de SVG, HTML disfarçado de PNG, GIF, extensão divergente, arquivo grande, bomba de dimensões;
- mídia de rascunho:
  - leitura e listagem negadas para anônimo, usuário comum, staff sem MFA e sessão encerrada;
  - URL pública do bucket privado recusada;
  - URL assinada negada a quem não é staff e recusada depois de expirar;
  - staff não consegue se autopromover com `public_since` nem chamar as funções de publicação de mídia;
  - `publish_article` recusa imagem privada, desconhecida ou com `path` divergente;
  - só as imagens do artigo são copiadas;
  - cópia pública removida após despublicar, com o original privado mantido;
- requisições excessivas (429 real);
- acesso direto às APIs administrativas sem token, com token forjado ou expirado, sem MFA e **depois do logout**;
- CSRF/Origin;
- SSRF no deploy hook e open redirect no fallback;
- MFA errado;
- concorrência de edição;
- mudança de slug com 301;
- ausência de violações de CSP;
- 390 px sem rolagem horizontal.

O E2E precisa dos binários `auth` (github.com/supabase/auth/releases) e `postgrest` (github.com/PostgREST/postgrest/releases). O CI roda todas as outras suites, com um serviço Postgres.

## 13. Decisões de segurança e revisão adversarial

Pergunta feita: *"Sem credenciais, como eu acessaria o painel, os leads ou o banco?"*

- **Chave anon (pública).** Lê apenas `published_articles`. Todas as outras tabelas e RPCs negam acesso (testado contra o PostgREST real). Embedding de rascunhos é negado. O Storage não lista nem aceita escrita.
- **Criar uma conta.** O cadastro fica desativado. Mesmo que fosse ativado, a conta com MFA não é staff e não vê nada.
- **Senha vazada de uma editora.** Sem o TOTP, a conta fica em `aal1` e não lê nada.
- **Token roubado.** Deixa de valer no logout ou na revogação de sessões (a sessão é verificada no banco). Caso contrário, expira em 1 h.
- **XSS no painel ou no site.** Não há HTML de usuário. A CSP do admin é `script-src 'self'`, sem terceiros. A CSP pública libera só o script inline por hash, e o build falha se o hash divergir.
- **Clickjacking.** `frame-ancestors 'none'` + `X-Frame-Options: DENY`.
- **Spam e bots no formulário.** Honeypot, validação estrita, limites de tamanho, rate limit no banco (IP com hash) e Turnstile opcional. Uma falha nunca bloqueia o WhatsApp.
- **Uploads.** Tipo detectado pelos bytes, extensão coerente, sem SVG e limites de tamanho e de pixels; a imagem também é recodificada no navegador (remove metadados como GPS). O arquivo vai para o bucket **privado**.
- **Mídia de rascunho.** Nunca é pública. A leitura exige staff com MFA (RLS do Storage), por URL assinada de 10 min. Só as imagens de artigos publicados são copiadas para o bucket público, e são removidas quando deixam de ser usadas.
- **Segredos.** Service role só nas Functions. O build recusa uma chave service_role em variável pública. O `verify` varre o `dist/`.

Achados corrigidos durante a própria revisão (detectados pelos testes):

1. `require_owner()` deixava passar um não-staff por causa de lógica NULL do SQL. Corrigido com `coalesce` e `is not true`.
2. Um bloco sem `level` passava no validador pelo mesmo motivo. O validador foi reescrito com checagens isoladas.
3. O access token continuava válido depois do logout. Agora a RLS exige a sessão ativa.
4. O login não era auditado (query builder lazy). Corrigido.
5. O fallback de 404 buscava o host vindo da requisição. Agora usa a origem configurada.

Limitações conhecidas e assumidas:

- Uma URL assinada já emitida continua válida até expirar (no máximo 10 min), mesmo se a pessoa sair ou perder o acesso nesse intervalo. Esse prazo curto é o limite aceito.
- Depois de despublicar, a cópia pública é apagada na próxima limpeza, que roda em toda publicação e em "Atualizar site agora", respeitada a carência de 2 min.
- O servidor não recodifica imagens: a validação é por assinatura e dimensões, e o conteúdo é servido pelo domínio do Supabase com o tipo correto.
- O limite global de leads por hora pode ser esgotado por um atacante insistente, o que só afeta o registro; o WhatsApp continua funcionando. A regra de WAF da seção 9 mitiga isso.
- Uma publicação só aparece no site depois do rebuild (1–2 min). Se o Deploy Hook falhar, o painel avisa e oferece "Atualizar site agora".

**IA em runtime.** Nenhuma. Se um dia houver, conteúdo de artigos, leads, URLs e documentos devem ser tratados como dados não confiáveis, sem ferramentas privilegiadas nem acesso irrestrito ao banco, e qualquer publicação ou exclusão feita por IA deve exigir aprovação humana.

## 14. Pontos que exigem configuração manual

- [ ] Criar o projeto Supabase e aplicar as migrations (seção 7).
- [ ] Desativar o cadastro público, habilitar TOTP e configurar a senha mínima, a Site URL e as Redirect URLs.
- [ ] Convidar Lisandra e Dani e liberar o primeiro owner via SQL (seção 8).
- [ ] Definir as variáveis na Vercel e criar o Deploy Hook (seção 9).
- [ ] Regras de Firewall/WAF da Vercel (seção 9).
- [ ] Revisão jurídica do novo texto de privacidade antes de `NEXT_PUBLIC_LEAD_CAPTURE=true`.
- [ ] Definir a política de retenção de leads (ex.: excluir após 24 meses sem relacionamento). O owner pode excluir pelo painel.
- [ ] Domínio definitivo: `NEXT_PUBLIC_SITE_URL`, Supabase e Search Console.
- [ ] Backups (Supabase Pro / PITR).

## 15. Plano de rollback

- **Site público**: Vercel → Deployments → promover o deploy anterior (*Instant Rollback*). Os deploys antigos continuam estáticos e funcionais.
- **Desligar só a captura de leads**: `NEXT_PUBLIC_LEAD_CAPTURE=false` e redeploy. O formulário volta ao comportamento original, e o texto de privacidade original volta junto.
- **Desligar o CMS mantendo o blog**: remova `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` e faça um redeploy. O build usa os 3 artigos de lançamento embutidos, e `/admin` mostra "Painel não configurado".
- **Voltar ao código anterior**: `git revert` do merge; `/insights` volta a existir (remova os redirects).
- **Mídia privada**: para voltar ao modelo anterior, seria preciso reverter `20260923090000_private_draft_media.sql` e tornar o upload público de novo. **Não recomendado**: rascunhos voltariam a ser acessíveis a quem obtivesse a URL.
- **Banco**: as migrations só criam objetos novos, não alteram nada existente. Reverter = `drop` das tabelas, tipos e funções criadas, e do schema `private`. Faça backup antes; os leads são dados pessoais.
- **Artigo publicado por engano**: **Despublicar** no painel (o site se atualiza sozinho); o histórico permite recuperar versões anteriores.

## 16. Desenvolvimento local

```sh
pnpm install --frozen-lockfile
pnpm build            # sem variáveis: site atual, artigos de lançamento
pnpm serve:full       # emula a Vercel (redirects, rewrites, headers, /api) em :3000
pnpm test             # unitários, build e RLS (usa PostgreSQL local ou PG_TEST_URL)
pnpm verify && pnpm check:functions
```

Estrutura nova:

- `admin/`: painel.
- `api/`: Functions.
- `server/`: código de servidor autocontido.
- `lib/blog/`: modelo, schema, renderer e SEO do blog.
- `supabase/`: migrations e config.
- `tests/`: db, unit, build e e2e.
