import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

// No application backend is needed: prerender all routes, hydrate interactions.
// In-process tooling also supports Windows hosts without child-process access.
const root=process.cwd();
const req=createRequire(import.meta.url);
const viteReq=createRequire(req.resolve('vite/package.json'));
const {build}=await import(pathToFileURL(viteReq.resolve('rolldown')).href);
const postcssReq=createRequire(req.resolve('@tailwindcss/postcss'));
const postcss=postcssReq('postcss');
const tailwind=(await import('@tailwindcss/postcss')).default;
const cache=path.join(root,'.static-build');
const output=path.join(root,'dist');
if(path.relative(root,output)!=='dist')throw new Error('Build output must remain inside this project.');
await fs.rm(output,{recursive:true,force:true});
await fs.mkdir(cache,{recursive:true});await fs.mkdir(path.join(output,'assets'),{recursive:true});
const common={cwd:root,resolve:{alias:{'@':root}},platform:'browser',transform:{jsx:{runtime:'automatic'},define:{'process.env.NODE_ENV':JSON.stringify('production'),'process.env.NEXT_PUBLIC_SITE_URL':JSON.stringify(process.env.NEXT_PUBLIC_SITE_URL||'https://velmont-patrimonio.jabez-oliveira.chatgpt.site')}},onwarn(w){if(w.code!=='MODULE_LEVEL_DIRECTIVE'&&w.code!=='EVAL')console.warn(w.message);}};
await fs.writeFile(path.join(cache,'server.tsx'),`import React from 'react';import {renderToString} from 'react-dom/server';import {StaticSite} from '@/components/velmont/static-site';export {articles} from '@/content/insights';export {siteUrl} from '@/lib/site';export {pageSeo,pageSchema} from '@/lib/seo';export const render=(path:string)=>renderToString(<StaticSite path={path}/>);`);
await fs.writeFile(path.join(cache,'client.tsx'),`import React from 'react';import {hydrateRoot} from 'react-dom/client';import {StaticSite} from '@/components/velmont/static-site';hydrateRoot(document.getElementById('app')!,<StaticSite path={location.pathname.replace(/\\/$/,'')||'/'}/>);`);
await build({...common,platform:'node',input:path.join(cache,'server.tsx'),external:['react','react-dom/server','react/jsx-runtime'],output:{file:path.join(cache,'server.mjs'),format:'esm'}});
const client=await build({...common,input:path.join(cache,'client.tsx'),output:{dir:path.join(output,'assets'),format:'esm',entryFileNames:'site-[hash].js',chunkFileNames:'chunk-[hash].js',minify:true}});
const entry=client.output.find(x=>x.type==='chunk'&&x.isEntry).fileName;
const raw=await fs.readFile(path.join(root,'app/globals.css'),'utf8');
const result=await postcss([tailwind({base:root,optimize:true})]).process(raw,{from:path.join(root,'app/globals.css')});
const cssName=`site-${createHash('sha256').update(result.css).digest('hex').slice(0,12)}.css`;
await fs.writeFile(path.join(output,'assets',cssName),result.css);
await fs.cp(path.join(root,'public'),output,{recursive:true});
const {render,articles,siteUrl,pageSeo,pageSchema}=await import(pathToFileURL(path.join(cache,'server.mjs')).href+'?v='+Date.now());
const routes=['/','/insights','/privacidade',...articles.map(a=>'/insights/'+a.slug),'/404'];
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
for(const route of routes){
 const data=pageSeo(route);
 const structured=pageSchema(route);
 const html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#210910"><title>${escape(data.title)}</title><meta name="description" content="${escape(data.description)}"><meta name="robots" content="${data.index?'index,follow,max-image-preview:large':'noindex,follow'}"><link rel="canonical" href="${data.canonical}"><meta property="og:type" content="${data.article?'article':'website'}"><meta property="og:locale" content="pt_BR"><meta property="og:site_name" content="Velmont"><meta property="og:title" content="${escape(data.title)}"><meta property="og:description" content="${escape(data.description)}"><meta property="og:url" content="${data.canonical}"><meta property="og:image" content="${data.image}"><meta property="og:image:alt" content="${escape(data.imageAlt)}"><meta property="og:image:width" content="${data.imageWidth}"><meta property="og:image:height" content="${data.imageHeight}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(data.title)}"><meta name="twitter:description" content="${escape(data.description)}"><meta name="twitter:image" content="${data.image}"><meta name="twitter:image:alt" content="${escape(data.imageAlt)}"><link rel="icon" href="/images/velmont-icon.png"><link rel="apple-touch-icon" href="/images/velmont-icon.png"><link rel="preload" href="/fonts/manrope-latin.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="/assets/${cssName}">${structured?`<script type="application/ld+json">${JSON.stringify(structured).replace(/</g,'\\u003c')}</script>`:''}</head><body><div id="app">${render(route)}</div><script type="module" src="/assets/${entry}"></script></body></html>`;
 const destination=route==='/404'?path.join(output,'404.html'):path.join(output,route.slice(1),'index.html');
 await fs.mkdir(path.dirname(destination),{recursive:true});await fs.writeFile(destination,html);
}
await fs.writeFile(path.join(output,'robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`);
await fs.writeFile(path.join(output,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.filter(x=>x!=='/404').map(x=>`<url><loc>${siteUrl}${x==='/'?'/':x}</loc></url>`).join('')}</urlset>`);
await fs.writeFile(path.join(output,'_headers'),`/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n/fonts/*\n  Cache-Control: public, max-age=31536000, immutable\n/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: SAMEORIGIN\n`);
console.log(`Built ${routes.length} prerendered pages in dist/. JavaScript ${Math.round(client.output.reduce((n,c)=>n+(c.code?.length||0),0)/1024)} KB; CSS ${Math.round(result.css.length/1024)} KB.`);
