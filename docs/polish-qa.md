# QA — cards, editorial e motion

Revisão de 6 de setembro de 2026.

- Cards de depoimentos em três colunas, recorte da identificação na base e campos vazios identificados. No mobile, carrossel nativo com scroll-snap e controles de 44 px; seleção do segundo card confirmada no browser.
- Blog com destaque, lista lateral e três cards. Os links usam os três artigos existentes; nenhum fato, cliente, data ou depoimento foi inventado.
- Hero preservada na composição final, com entrada breve. Traçado de perímetro alinhado ao asset de marca, componentes mecânicos independentes e camadas de software com entrada sequencial.
- QA visual no browser em desktop, tablet e celular, incluindo 320 px. Corrigidos texto da ilustração de software em tela estreita e recorte residual da imagem mecânica. Leituras de largura confirmaram ausência de overflow da página em 320, 375, 390, 768, 1024 e 1440 px.
- FAQ: seis controles exercitados; estados aria-expanded respondem corretamente. Nenhum erro ou warning de console observado no preview local.
- Preferência de movimento reduzido verificada por harness local que simula as condições CSS/JS, sem alterar a preferência do sistema operacional: hero e parceiros sem animação, transform da patente desativado, todas as camadas do software visíveis.
- Build de sete páginas, TypeScript e lint concluídos. Verificador: 120 links/assets locais, metadados, recursos e limites de transferência aprovados. JS gzip 125162 bytes; CSS gzip 15192 bytes.

Preenchimento real pendente: relatos/identificação/fotos dos clientes e vídeo legendado ou fotografia conjunta das fundadoras. Instruções em `preenchimento-conteudo.md`. A publicação no GitHub segue pendente da permissão de escrita da integração; o repositório local e o pacote ZIP contêm as alterações.
