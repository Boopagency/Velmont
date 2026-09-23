import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

// No application backend is needed for public pages: prerender all routes,
// hydrate interactions. Published articles are read from the CMS at build time.
// In-process tooling also supports Windows hosts without child-process access.
const root=process.cwd();
const req=createRequire(import.meta.url);
const viteReq=createRequire(req.resolve('vite/package.json'));
const {build}=await import(pathToFileURL(viteReq.resolve('rolldown')).href);
const postcssReq=createRequire(req.resolve('@tailwindcss/postcss'));
const postcss=postcssReq('postcss');
const tailwind=(await import('@tailwindcss/postcss')).default;
const cache=path.join(root,'.static-build');
const output=path.resolve(root,process.env.VELMONT_OUTPUT||'dist');
const relativeOutput=path.relative(root,output);
if(!relativeOutput||relativeOutput.startsWith('..')||path.isAbsolute(relativeOutput)||!['dist','.static-build'].includes(relativeOutput.split(path.sep)[0]))throw new Error('Build output must remain inside this project.');
// Only public values reach the browser bundles. Secrets are never listed here.
const env={
 NEXT_PUBLIC_SITE_URL:(process.env.NEXT_PUBLIC_SITE_URL||'').trim().replace(/\/$/,'')||'https://www.grupovelmont.com',
 NEXT_PUBLIC_SUPABASE_URL:(process.env.NEXT_PUBLIC_SUPABASE_URL||'').replace(/\/$/,''),
 NEXT_PUBLIC_SUPABASE_ANON_KEY:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||'',
 NEXT_PUBLIC_LEAD_CAPTURE:process.env.NEXT_PUBLIC_LEAD_CAPTURE==='true'?'true':'false',
 NEXT_PUBLIC_TURNSTILE_SITE_KEY:process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY||'',
};
// Canonical, OG, JSON-LD, sitemap, robots and llms.txt all derive from this origin.
if(!/^https:\/\/[a-z0-9.-]+$/.test(env.NEXT_PUBLIC_SITE_URL)&&!(process.env.VERCEL!=='1'&&/^http:\/\/127\.0\.0\.1:\d+$/.test(env.NEXT_PUBLIC_SITE_URL)))throw new Error('NEXT_PUBLIC_SITE_URL must be an https origin without a path.');
if(process.env.VERCEL_ENV==='production'&&env.NEXT_PUBLIC_SITE_URL.endsWith('.vercel.app'))throw new Error('Production NEXT_PUBLIC_SITE_URL must be the official domain, not a vercel.app URL.');
if(env.NEXT_PUBLIC_SUPABASE_URL&&!/^https:\/\/[a-z0-9.-]+$/.test(env.NEXT_PUBLIC_SUPABASE_URL)&&!(process.env.VERCEL!=='1'&&/^http:\/\/127\.0\.0\.1:\d+$/.test(env.NEXT_PUBLIC_SUPABASE_URL)))throw new Error('NEXT_PUBLIC_SUPABASE_URL must be an https origin.');
if(/service_role/.test(Buffer.from((env.NEXT_PUBLIC_SUPABASE_ANON_KEY.split('.')[1]||''),'base64url').toString()))throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY holds a service_role key. Use the anon/publishable key.');
if(env.NEXT_PUBLIC_LEAD_CAPTURE==='true'&&!env.NEXT_PUBLIC_SUPABASE_URL)throw new Error('NEXT_PUBLIC_LEAD_CAPTURE requires the CMS to be configured.');
await fs.rm(output,{recursive:true,force:true});
await fs.mkdir(cache,{recursive:true});await fs.mkdir(path.join(output,'assets'),{recursive:true});
const define={'process.env.NODE_ENV':JSON.stringify('production'),...Object.fromEntries(Object.entries(env).map(([k,v])=>[`process.env.${k}`,JSON.stringify(v)]))};
const common={cwd:root,resolve:{alias:{'@':root}},platform:'browser',transform:{jsx:{runtime:'automatic'},define},onwarn(w){if(w.code!=='MODULE_LEVEL_DIRECTIVE'&&w.code!=='EVAL')console.warn(w.message);}};
await fs.writeFile(path.join(cache,'server.tsx'),`import React from 'react';import {renderToString} from 'react-dom/server';import {StaticSite,type PageData} from '@/components/velmont/static-site';export {siteUrl} from '@/lib/site';export {pageEntryScript} from '@/lib/page-entry';export {pageSeo,pageSchema} from '@/lib/seo';export {loadPublishedPosts,relatedPosts} from '@/lib/blog/source';export {summarize,postPath,BLOG_BASE} from '@/lib/blog/types';export const render=(path:string,data:PageData)=>renderToString(<StaticSite path={path} data={data}/>);`);
await fs.writeFile(path.join(cache,'client.tsx'),`import React from 'react';import {hydrateRoot} from 'react-dom/client';import {StaticSite} from '@/components/velmont/static-site';const data=JSON.parse(document.getElementById('vm-data')?.textContent||'{}');hydrateRoot(document.getElementById('app')!,<StaticSite path={location.pathname.replace(/\\/$/,'')||'/'} data={data}/>);`);
await build({...common,platform:'node',input:path.join(cache,'server.tsx'),external:['react','react-dom/server','react/jsx-runtime','zod'],output:{file:path.join(cache,'server.mjs'),format:'esm'}});
const client=await build({...common,input:path.join(cache,'client.tsx'),output:{dir:path.join(output,'assets'),format:'esm',entryFileNames:'site-[hash].js',chunkFileNames:'chunk-[hash].js',minify:true}});
const entry=client.output.find(x=>x.type==='chunk'&&x.isEntry).fileName;
const raw=await fs.readFile(path.join(root,'app/globals.css'),'utf8');
const result=await postcss([tailwind({base:root,optimize:true})]).process(raw,{from:path.join(root,'app/globals.css')});
const cssName=`site-${createHash('sha256').update(result.css).digest('hex').slice(0,12)}.css`;
await fs.writeFile(path.join(output,'assets',cssName),result.css);
await fs.cp(path.join(root,'public'),output,{recursive:true});
const {render,siteUrl,pageSeo,pageSchema,pageEntryScript,loadPublishedPosts,relatedPosts,summarize,postPath,BLOG_BASE}=await import(pathToFileURL(path.join(cache,'server.mjs')).href+'?v='+Date.now());

// The inline head script is allowed by hash in the Content-Security-Policy.
const entryHash=`'sha256-${createHash('sha256').update(pageEntryScript).digest('base64')}'`;
const vercel=JSON.parse(await fs.readFile(path.join(root,'vercel.json'),'utf8'));
const csp=vercel.headers.filter(h=>!h.source.startsWith('/admin')).flatMap(h=>h.headers).filter(h=>h.key==='Content-Security-Policy').map(h=>h.value);
if(!csp.length||!csp.every(v=>v.includes(entryHash)))throw new Error(`vercel.json Content-Security-Policy must allow the page entry script: ${entryHash}`);

const {posts,origin}=await loadPublishedPosts({url:env.NEXT_PUBLIC_SUPABASE_URL,anonKey:env.NEXT_PUBLIC_SUPABASE_ANON_KEY});
const summaries=posts.map(summarize);
const pages=[
 {route:'/',data:{posts:summaries.slice(0,3)}},
 {route:BLOG_BASE,data:{posts:summaries}},
 {route:'/privacidade',data:{}},
 ...posts.map(post=>({route:postPath(post.slug),post,data:{post,related:relatedPosts(post,posts)}})),
 {route:'/404',data:{}},
];
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
for(const {route,post,data:pageData} of pages){
 const data=pageSeo(route,post||null);
 const structured=pageSchema(route,post||null);
 const articleMeta=post?`${post.publishedAt?`<meta property="article:published_time" content="${escape(post.publishedAt)}">`:''}${post.modifiedAt?`<meta property="article:modified_time" content="${escape(post.modifiedAt)}">`:''}`:'';
 const html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><script>${pageEntryScript}</script><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#210910"><title>${escape(data.title)}</title><meta name="description" content="${escape(data.description)}"><meta name="robots" content="${data.index?'index,follow,max-image-preview:large':'noindex,follow'}"><link rel="canonical" href="${escape(data.canonical)}"><meta property="og:type" content="${data.article?'article':'website'}"><meta property="og:locale" content="pt_BR"><meta property="og:site_name" content="Velmont"><meta property="og:title" content="${escape(data.ogTitle)}"><meta property="og:description" content="${escape(data.ogDescription)}"><meta property="og:url" content="${escape(data.canonical)}"><meta property="og:image" content="${escape(data.image)}"><meta property="og:image:alt" content="${escape(data.imageAlt)}"><meta property="og:image:width" content="${data.imageWidth}"><meta property="og:image:height" content="${data.imageHeight}">${articleMeta}<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(data.ogTitle)}"><meta name="twitter:description" content="${escape(data.ogDescription)}"><meta name="twitter:image" content="${escape(data.image)}"><meta name="twitter:image:alt" content="${escape(data.imageAlt)}"><link rel="icon" href="/images/velmont-icon.png"><link rel="apple-touch-icon" href="/images/velmont-icon.png"><link rel="preload" href="/fonts/manrope-latin.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="/assets/${cssName}">${structured?`<script type="application/ld+json">${json(structured)}</script>`:''}</head><body><div id="app">${render(route,pageData)}</div><script type="application/json" id="vm-data">${json(pageData)}</script><script type="module" src="/assets/${entry}"></script></body></html>`;
 const destination=route==='/404'?path.join(output,'404.html'):path.join(output,route.slice(1),'index.html');
 await fs.mkdir(path.dirname(destination),{recursive:true});await fs.writeFile(destination,html);
}

// Only indexable pages whose canonical is their own URL belong in the sitemap.
const dateOf=post=>post.modifiedAt||post.publishedAt;
const latest=posts.map(dateOf).filter(Boolean).sort().at(-1);
const sitemapEntries=[{loc:`${siteUrl}/`},{loc:`${siteUrl}${BLOG_BASE}`,lastmod:latest},{loc:`${siteUrl}/privacidade`},...posts.filter(p=>p.seo.index&&(!p.seo.canonical||p.seo.canonical===siteUrl+postPath(p.slug))).map(p=>({loc:siteUrl+postPath(p.slug),lastmod:dateOf(p)}))];
await fs.writeFile(path.join(output,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapEntries.map(e=>`<url><loc>${escape(e.loc)}</loc>${e.lastmod?`<lastmod>${escape(new Date(e.lastmod).toISOString())}</lastmod>`:''}</url>`).join('')}</urlset>`);
await fs.writeFile(path.join(output,'robots.txt'),`User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${siteUrl}/sitemap.xml\n`);
// Optional convenience index for tools that read llms.txt. Not a ranking factor.
await fs.writeFile(path.join(output,'llms.txt'),`# Velmont\n\n> Consultoria em propriedade intelectual em Curitiba (PR), com atendimento presencial e digital: registro de marcas, patentes, desenho industrial e software.\n\n## Páginas\n\n- [Início](${siteUrl}/): serviços, processo, fundadoras, perguntas frequentes e contato.\n- [Insights](${siteUrl}${BLOG_BASE}): guias sobre marcas, patentes e software.\n- [Privacidade](${siteUrl}/privacidade)\n\n## Artigos\n\n${posts.filter(p=>p.seo.index).map(p=>`- [${p.title.replace(/[[\]]/g,'')}](${siteUrl}${postPath(p.slug)}): ${p.excerpt}`).join('\n')}\n`);
await fs.writeFile(path.join(output,'_headers'),`/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n/fonts/*\n  Cache-Control: public, max-age=31536000, immutable\n/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: DENY\n  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()\n/admin/*\n  X-Robots-Tag: noindex, nofollow\n  Cache-Control: no-store\n`);

// Private admin panel and article preview: separate bundles, never linked from
// public pages. Shells hold no data; the database authorizes every request.
const adminBuild=await build({...common,input:{admin:path.join(root,'admin/main.tsx'),preview:path.join(root,'admin/preview.tsx')},output:{dir:path.join(output,'assets'),format:'esm',entryFileNames:'[name]-[hash].js',chunkFileNames:'admin-chunk-[hash].js',minify:true}});
const adminEntry=name=>adminBuild.output.find(x=>x.type==='chunk'&&x.isEntry&&x.name===name).fileName;
const adminCss=await fs.readFile(path.join(root,'admin/admin.css'),'utf8');
const adminCssName=`admin-${createHash('sha256').update(adminCss).digest('hex').slice(0,12)}.css`;
await fs.writeFile(path.join(output,'assets',adminCssName),adminCss);
const supabaseOrigin=env.NEXT_PUBLIC_SUPABASE_URL;
const adminCsp=`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:${supabaseOrigin?` ${supabaseOrigin}`:''}; font-src 'self'; connect-src 'self'${supabaseOrigin?` ${supabaseOrigin} ${supabaseOrigin.replace(/^http/,'ws')}`:''}; object-src 'none'; base-uri 'none'; form-action 'self'`;
const adminHead=title=>`<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${escape(adminCsp)}"><meta name="robots" content="noindex,nofollow,noarchive"><meta name="referrer" content="no-referrer"><meta name="theme-color" content="#210b12"><title>${title}</title><link rel="icon" href="/images/velmont-icon.png">`;
await fs.mkdir(path.join(output,'admin/preview'),{recursive:true});
await fs.writeFile(path.join(output,'admin/index.html'),`<!doctype html><html lang="pt-BR"><head>${adminHead('Painel | Velmont')}<link rel="preload" href="/fonts/manrope-latin.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="/assets/${adminCssName}"></head><body><div id="admin"></div><noscript>O painel precisa de JavaScript.</noscript><script type="module" src="/assets/${adminEntry('admin')}"></script></body></html>`);
await fs.writeFile(path.join(output,'admin/preview/index.html'),`<!doctype html><html lang="pt-BR"><head>${adminHead('Pré-visualização | Velmont')}<link rel="stylesheet" href="/assets/${cssName}"><style>.preview-bar{display:block;position:sticky;top:0;z-index:50;margin:0;padding:10px 16px;background:#ddc5a1;color:#210b12;font:600 12px/1.4 Manrope,Arial,sans-serif;letter-spacing:.04em;text-align:center}.preview-bar a{color:inherit}</style></head><body><div id="app"></div><script type="module" src="/assets/${adminEntry('preview')}"></script></body></html>`);
await fs.writeFile(path.join(output,'build-info.json'),JSON.stringify({builtAt:new Date().toISOString(),articles:posts.length,source:origin}));
console.log(`Built ${pages.length} prerendered pages in ${relativeOutput}/ (${posts.length} articles from ${origin}). JavaScript ${Math.round(client.output.reduce((n,c)=>n+(c.code?.length||0),0)/1024)} KB; CSS ${Math.round(result.css.length/1024)} KB.`);
