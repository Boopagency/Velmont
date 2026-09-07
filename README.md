# Velmont — Marca é patrimônio

Homepage editorial completa com hero em camadas, assets exclusivos, composição mobile, serviços, transparência, processo, provas reais, fundadoras, FAQ, contato e insights.

## Preview e desenvolvimento

Requisitos: Node.js 22.13+ e pnpm 11.19.0.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Abra `http://127.0.0.1:3000`. O comando gera o site e inicia o preview. Após editar, execute `pnpm build` em outro terminal e atualize o navegador. O preview serve o mesmo HTML e os mesmos assets usados na publicação.

```sh
pnpm typecheck
pnpm lint
pnpm build
node scripts/verify.mjs
```

## Arquitetura

- React 19 + TypeScript; estrutura de rotas compatível com App Router.
- Build estático com HTML pré-renderizado para todas as páginas e hidratação dos controles.
- CSS autoral, Tailwind para os controles acessíveis do catálogo Base UI/Shadcn.
- Motion nativo com `requestAnimationFrame` e `IntersectionObserver`, sem biblioteca de animação adicional.
- Conteúdo dos insights em `content/insights.ts`.
- Componentes da marca em `components/velmont/`.
- Assets em `public/images`, `public/generated` e `public/fonts`.
- Fontes locais Manrope e Instrument Serif, com licenças OFL incluídas.

O exportador estático atende todo o escopo atual, reduz dependência de servidor e funciona neste ambiente Windows, que bloqueia subprocessos exigidos pelo preview Workers. O scaffold Vinext original permanece disponível em `dev:vinext` e `build:worker` para uma futura evolução com backend; esse caminho alternativo não é o artefato validado nesta entrega.

## Conversão

O formulário prepara uma mensagem para o WhatsApp oficial encontrado na apresentação institucional. Nenhum lead é gravado, nenhum contato é enviado automaticamente e nenhum segredo é necessário. A pessoa revisa e envia a mensagem no WhatsApp. Há também contato direto por e-mail e um fallback sem JavaScript.

## Publicação

Artefato pronto: `dist/`. Hospedagem estática em Sites, Vercel ou outra plataforma compatível.

Para Vercel: importar o repositório, escolher framework **Other**, comando de build `pnpm build` e diretório de saída `dist`. A configuração `vercel.json` acompanha o projeto. Defina `NEXT_PUBLIC_SITE_URL` com a origem definitiva, sem barra final, antes do build. Canonical, sitemap e Open Graph usam esse valor. O domínio comercial definitivo não foi presumido a partir do e-mail.

O preview Sites tem acesso privado. Não confundir essa publicação de revisão com o lançamento público do domínio comercial.

## Documentação

- `docs/VELMONT-CODEX-MASTER.md`: briefing integral, fonte estratégica principal.
- `docs/design-system.md`: identidade, tipografia e composição.
- `docs/motion.md`: comportamento e acessibilidade do movimento.
- `docs/content-sources.md`: procedência e limites dos materiais.
- `docs/qa.md`: validações e refinamentos realizados.
- `docs/refinement-qa.md`: revisão de serviços, parceiros, cards editoriais e FAQ, com QA nas sete larguras.
- `docs/refinement-asset-prompts.txt`: prompts das imagens criadas nesta revisão.
- `docs/asset-prompts.txt`: prompts completos das três imagens geradas.

Os arquivos originais recebidos permanecem preservados na pasta de origem. O repositório publica derivados otimizados necessários ao site e o briefing; as referências completas e a apresentação original não são servidas publicamente.

## Revisão final
- `docs/revisao-final-qa.md`: correções, testes e limites desta rodada.
- `docs/seo-geo.md`: implementação e passos externos para lançamento/indexação.
- `docs/preenchimento-conteudo.md`: avaliações reais, fotos e datas editoriais.
