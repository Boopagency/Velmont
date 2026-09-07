import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
const root=path.resolve('dist');
async function walk(dir){const entries=await fs.readdir(dir,{withFileTypes:true});const result=[];for(const e of entries){const file=path.join(dir,e.name);if(e.isDirectory())result.push(...await walk(file));else result.push(file);}return result;}
const files=await walk(root);const html=files.filter(f=>f.endsWith('.html'));let checked=0;
for(const file of html){
 const body=await fs.readFile(file,'utf8');
 assert.match(body,/<html lang="pt-BR">/);assert.match(body,/<meta name="viewport"/);assert.match(body,/<link rel="canonical"/);assert.match(body,/<title>[^<]+<\/title>/);
 assert.equal((body.match(/<h1(?:\s|>)/g)||[]).length,1,`One H1: ${file}`);
 const idList=[...body.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);const ids=new Set(idList);assert.equal(idList.length,ids.size,`Duplicate IDs: ${file}`);
 for(const match of body.matchAll(/href="#([^"]+)"/g))assert.ok(ids.has(match[1]),`Broken section link: #${match[1]} in ${file}`);
 for(const match of body.matchAll(/srcSet="([^"]+)"/gi)){
  for(const candidate of match[1].split(',')){
   const url=candidate.trim().split(/\s+/)[0];
   if(url.startsWith('/')){await fs.access(path.join(root,url));checked++;}
  }
 }
 for(const match of body.matchAll(/(?:src|href)="([^"#]+)"/g)){
  const url=match[1];if(!url.startsWith('/')||url.startsWith('//'))continue;
  const pathname=url.split(/[?#]/)[0];let target=path.join(root,pathname);
  try{const stat=await fs.stat(target);if(stat.isDirectory())target=path.join(target,'index.html');await fs.access(target);}catch{assert.fail(`Broken local resource: ${url} in ${file}`);}checked++;
 }
 for(const match of body.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g)){const schema=JSON.parse(match[1]);assert.ok(schema['@graph']?.length || schema['@type']);assert.ok(!/"(?:aggregateRating|review)"/.test(match[1]),'No self-serving rating schema');}
}
const home=await fs.readFile(path.join(root,'index.html'),'utf8');
assert.match(home,/fetchPriority="high"|fetchpriority="high"/i);
assert.match(home,/5541985084026/);assert.match(home,/Fernanda Reis/);assert.match(home,/Rodrigo Cuduh/);assert.match(home,/Boop/);assert.ok(!/[↗→←↓↑☰★]/.test(home),'UI icons must be SVG');assert.match(home,/manrope-latin\.woff2/);assert.match(home,/<noscript>/);
const assets=files.filter(f=>/\.(js|css)$/.test(f));const bytes={};
for(const extension of ['js','css']){let total=0;for(const file of assets.filter(f=>f.endsWith('.'+extension)))total+=gzipSync(await fs.readFile(file)).length;bytes[extension]=total;}
assert.ok(bytes.js<160*1024,'Compressed JavaScript budget: 160 KB');assert.ok(bytes.css<25*1024,'Compressed CSS budget: 25 KB');
const css=(await Promise.all(assets.filter(f=>f.endsWith('.css')).map(f=>fs.readFile(f,'utf8')))).join('');
assert.match(css,/prefers-reduced-motion/);
assert.ok(html.length===7,'Seven expected prerendered routes');
console.log(JSON.stringify({pages:html.length,localLinksAndAssets:checked,gzipBytes:bytes,result:'PASS'},null,2));

const sitemap=await fs.readFile(path.join(root,'sitemap.xml'),'utf8');assert.equal((sitemap.match(/<loc>/g)||[]).length,6);assert.ok(!sitemap.includes('/404'));
for(const file of html.filter(f=>f.includes(path.sep+'insights'+path.sep)&&!f.endsWith(path.join('insights','index.html')))){const text=await fs.readFile(file,'utf8');assert.match(text,/BlogPosting/);assert.match(text,/BreadcrumbList/);assert.match(text,/rel="author"/);assert.match(text,/class="article-cover"/);assert.match(text,/class="article-related"/);}
