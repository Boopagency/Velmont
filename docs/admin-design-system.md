# Painel Velmont — sistema visual

## Tese

O painel é uma ferramenta de trabalho, não uma vitrine. A estrutura segue a filosofia Boop Admin:

- moldura off-white quente;
- canvas branco de trabalho;
- bordas discretas;
- uma única superfície de métricas;
- sidebar fixa e topbar fina.

Sobre essa estrutura entra a identidade Velmont:

- **vinho** reservado para ação, seleção e estado;
- **champagne** como acento contido;
- a tipografia Manrope do site;
- o logo real, sem redesenho.

Os componentes são shadcn/ui no estilo `base-nova` (primitivas Base UI), integrados à aplicação existente. O visual cinza-neutro padrão do shadcn foi substituído por tokens próprios.

## Arquitetura

- `admin/admin.css` é uma entrada Tailwind v4:
  - `@import 'tailwindcss' source(none)` com `@source` apenas para `admin/` e para os arquivos de `components/ui` que o painel usa;
  - importa também `tw-animate-css` e `shadcn/tailwind.css`, com as variantes `data-open`, `data-panel-open` etc.
- `scripts/build-static.mjs` compila esse arquivo com `@tailwindcss/postcss`, como já fazia com o CSS público. O resultado é `admin.css`, carregado somente em `/admin`. O site público não recebe nada do painel.
- Os tokens ficam em `:root` e chegam ao Tailwind por `@theme inline` (`bg-brand`, `text-champagne-foreground`, `border-input`…).
- O painel usa só o tema claro (`color-scheme: light`).

## Cores

| Token | HEX | Uso |
|---|---|---|
| `--sidebar` | `#F7F4F0` | Moldura off-white quente: sidebar e fundo atrás do canvas |
| `--background` / `--card` | `#FFFFFF` | Canvas de trabalho, cards, popovers |
| `--foreground` | `#1D1517` | Texto principal (tinta vinho-escura) |
| `--muted` | `#F5F2EE` | Campos preenchidos, cabeçalho de tabela, placeholders |
| `--muted-foreground` | `#6E6366` | Texto secundário, metadados |
| `--secondary` | `#F3EFEA` | Superfícies neutras de apoio |
| `--accent` / `--accent-foreground` | `#F6EFF0` / `#4A1526` | Hover e foco de itens de menu |
| `--border` | `#EBE5DE` | Bordas e divisores discretos (decorativos) |
| `--input` | `#958A83` | Borda de campos, selects e checkbox |
| `--brand` | `#5A1A2C` | Vinho: botão primário, item ativo, links de ação, badge "Novo" |
| `--brand-strong` | `#3D101E` | Vinho profundo (hover/ênfase) |
| `--brand-soft` | `#F5EBEE` | Fundo do item ativo da navegação e de filtros ativos |
| `--champagne` | `#C7A57A` | Acento: borda da citação, pontos de estado intermediário |
| `--champagne-soft` / `--champagne-foreground` | `#F8F1E5` / `#7A5419` | "Em revisão", "Contatado", "Alterações não publicadas", destaque "Em resumo" |
| `--success` / `--success-soft` | `#1F6F47` / `#E9F4EE` | Somente estados concluídos: "Publicado", "Convertido", "Site atualizado" |
| `--destructive` | `#B3261E` | Exclusões e falhas (sempre com confirmação) |
| `--ring` | `#8A3A52` | Anel de foco (usado a 50%) |

Regras:

1. Um único botão primário vinho por área.
2. O restante usa `outline` ou `ghost`.
3. Champagne nunca é cor de ação; indica apenas estado intermediário ou destaque editorial.
4. Verde e vermelho aparecem somente em estados, nunca como decoração.

### Contraste (WCAG 2.2)

**Texto** (mínimo 4,5:1)

| Par | Contraste |
|---|---|
| texto / canvas | 17,9:1 |
| texto secundário / canvas | 5,8:1 |
| texto secundário / moldura | 5,3:1 |
| texto secundário / `muted` | 5,2:1 |
| vinho / canvas | 13,0:1 |
| vinho / `brand-soft` | 11,1:1 |
| texto do botão primário / vinho | 12,3:1 |
| champagne escuro / `champagne-soft` | 6,0:1 |
| verde / `success-soft` | 5,5:1 |
| vermelho / canvas | 6,5:1 |

**Componentes** (mínimo 3:1)

| Par | Contraste |
|---|---|
| borda de campo / canvas | 3,4:1 |
| borda de campo / moldura | 3,1:1 |
| anel de foco | 7,5:1 |

As bordas de `--border` são apenas separadores. Nenhum controle depende delas para ser identificado.

## Tipografia

Manrope variável, com o arquivo local `/fonts/manrope-latin.woff2` (pesos 200–800) e `font-feature-settings: 'ss01'`.

| Papel | Tamanho / peso |
|---|---|
| Título do artigo no editor | 28 → 34 px, semibold, `tracking -0.025em` |
| Título de página (h1) | 26 → 28 px, semibold, `tracking -0.025em` |
| Título de bloco no editor (H2 / H3) | 20 px / 17 px, semibold |
| Título de seção (h2) | 15 px, semibold |
| Texto de edição (parágrafos) | 15 px, entrelinha 28 px |
| Corpo e tabelas | 14 px |
| Apoio, metadados, filtros | 13 px e 12 px |
| Rótulo de tipo de bloco | 11 px, caixa alta, `tracking 0.04em` |

Números de métricas, datas e tabelas usam `tabular-nums` (`.tabular`). Os títulos usam `text-wrap: balance`.

## Raio, bordas e profundidade

- `--radius: 0.5rem`, com a escala:
  - `sm` 4 px;
  - `md` 6 px;
  - `lg` 8 px: controles e botões;
  - `xl` 12 px: canvas, cards e diálogos.
- Badges de status são pílulas com ponto + texto.
- Bordas de 1 px. A única sombra é a do canvas, bem suave (`0 1px 2px` + `0 8px 24px -12px`). Popovers e diálogos usam a sombra padrão dos componentes.

## Espaçamento e layout

- Escala de 4 px (Tailwind).
- Página:
  - largura máxima de 1320 px;
  - margem lateral de 16 / 24 / 40 px (mobile / ≥640 / ≥1024);
  - respiro vertical de 28 → 36 px.
- Sidebar:
  - 256 px expandida;
  - 48 px recolhida (somente ícones, com tooltip);
  - Sheet lateral abaixo de 768 px;
  - o estado fica no cookie `sidebar_state`; atalho Ctrl/⌘+B.
- Topbar de 48 px, fixa no topo do canvas, com alternância da sidebar, trilha de navegação e "Ver site".
- Editor:
  - barra de ações de 56 px, fixa logo abaixo da topbar;
  - coluna de escrita flexível + coluna de configurações de 320 px (a partir de 1024 px);
  - abaixo disso, as configurações descem para depois do conteúdo.

## Componentes base (shadcn/ui)

Os arquivos ficam em `components/ui`. Os do catálogo já existiam no repositório, e esta rodada adicionou `sonner.tsx`.

| Componente | Onde |
|---|---|
| Sidebar, Sheet, Tooltip, Separator, Avatar | App shell, menu móvel |
| Breadcrumb | Topbar |
| Button, Spinner | Todas as telas |
| Badge | Badges de status |
| Table | Artigos, Leads, Equipe |
| Input, InputGroup, Textarea, Label, Checkbox | Formulários, busca, editor |
| Select (Base UI) | Filtros, autoria e categoria |
| NativeSelect | Status do lead, papel, tipo de lista, nível do título |
| DropdownMenu | Ações por linha, "Mais ações", "Adicionar bloco" |
| Collapsible | "Antes de publicar", SEO, Avançado, Histórico |
| Dialog | Seletor de imagens, liberar acesso |
| AlertDialog | Toda confirmação (substitui o `<dialog>` nativo) |
| Empty, Skeleton | Estados vazios e carregamento |
| Sonner | Notificações |

Os textos internos dos componentes (sr-only e rótulos) foram traduzidos para pt-BR: "Alternar menu lateral", "Fechar", "Trilha de navegação", "Carregando".

## Padrões de interação

- **Status:** badge suave com ponto.
  - Artigo:
    - Publicado (verde);
    - Rascunho (neutro);
    - Em revisão (champagne);
    - Arquivado (contorno).
  - Lead:
    - Novo (vinho);
    - Contatado (champagne);
    - Qualificado (neutro);
    - Convertido (verde);
    - Arquivado (contorno).
- **Status do site:**
  - Estados: "Atualizado", "Atualizando site…", "Sem confirmação" (pedido pendente há mais de 15 min) e "Falha na atualização".
  - Cada um mostra horário, versão no ar e ação de tentar novamente.
  - Enquanto atualiza, consulta a cada 10 s, só com a aba visível.
- **Editor:**
  - O estado fica sempre visível na barra de ações, em uma região `aria-live`: Salvando… · Publicando… · Alterações não salvas · Atualizando site… · Site atualizado · Salvo há N min.
  - Salvar, Pré-visualizar e Publicar ficam fixos.
- **Blocos:**
  - Cada bloco mostra ícone e tipo.
  - Ações de mover e remover aparecem ao passar o mouse ou com foco, e ficam sempre visíveis em telas de toque.
  - Remover um bloco com conteúdo pede confirmação.
  - "Adicionar bloco" existe entre blocos e ao final, com descrição de cada tipo.
- **Feedback:**
  - Sonner: sucesso some em 5 s, erro em 9 s; todos têm botão fechar e ficam no canto inferior direito.
  - Confirmações usam AlertDialog.
  - Nunca `alert()`.
- **Estados vazios:** texto contextual ("Nenhum rascunho.", "Nenhum lead novo.") e, quando cabe, uma ação.
- **Auditoria:**
  - Linha do tempo por dia, só com o que o registro contém.
  - Repetições seguidas da mesma frase viram uma linha com contagem e intervalo de horário.

## Acessibilidade

- "Pular para o conteúdo" é o primeiro item focável.
- O foco é sempre visível (anel de 3 px).
- Menus, selects e diálogos Base UI funcionam por teclado: setas, Enter, Esc e foco preso nos diálogos.
- Todo botão de ícone tem `aria-label`; o tooltip é apenas visual.
- Estados de salvamento, publicação e site são anunciados por `<output>`.
- Todo campo tem `<label>` associado, inclusive o checkbox de indexação (`Label htmlFor` + `aria-labelledby`).
- As prévias de imagem têm texto alternativo descritivo ("Imagem principal: …").
- `prefers-reduced-motion` desliga animações e transições. O conteúdo não depende de animação.
- A verificação foi feita em 1920, 1440, 1280, 768 e 390 px, sem rolagem horizontal.

## Limites encontrados (sem mudança estrutural)

O redesign não alterou banco, RLS, Auth, MFA, APIs, publicação nem armazenamento. Os pontos abaixo dependem dessas camadas. A interface foi ajustada para não inventar dados.

- **MFA por pessoa (Equipe):**
  - O navegador não tem acesso aos fatores de autenticação das outras pessoas.
  - Por isso, a coluna MFA mostra a política ("Obrigatório") e não o estado de cada cadastro.
  - Para mostrar o estado real seria preciso uma função no banco, só para o papel Responsável, que o exponha.
- **Registro de entrada (Auditoria):**
  - `record_admin_login` é chamado uma vez por aba do navegador, e cada salvamento registra `article.update`.
  - A linha do tempo agrupa repetições seguidas em vez de esconder registros.
  - Registrar uma entrada por sessão exigiria mudar o fluxo de autenticação.
- **Convite de pessoas:**
  - Continua em duas etapas: convite no Supabase, depois "Liberar acesso" no painel.
  - Um convite direto pelo painel exigiria uma função nova com a chave de serviço.
- **Atualização do site:**
  - Sem o Deploy Hook configurado (como no ambiente local), a API responde 503 e o painel mostra "Falha na atualização" com a explicação.
  - Não é um erro da interface.
