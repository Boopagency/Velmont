import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
const root=path.resolve('dist');
async function walk(dir){const entries=await fs.readdir(dir,{withFileTypes:true});const result=[];for(const e of entries){const file=path.join(dir,e.name);if(e.isDirectory())result.push(...await walk(file));else result.push(file);}return result;}
const files=await walk(root);const adminDir=path.join(root,'admin')+path.sep;const allHtml=files.filter(f=>f.endsWith('.html'));const html=allHtml.filter(f=>!f.startsWith(adminDir));let checked=0;
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
const assets=files.filter(f=>/\.(js|css)$/.test(f)&&!/[\\/](admin|preview)-[^\\/]+$/.test(f));const bytes={};
for(const extension of ['js','css']){let total=0;for(const file of assets.filter(f=>f.endsWith('.'+extension)))total+=gzipSync(await fs.readFile(file)).length;bytes[extension]=total;}
assert.ok(bytes.js<160*1024,'Compressed JavaScript budget: 160 KB');assert.ok(bytes.css<25*1024,'Compressed CSS budget: 25 KB');
const css=(await Promise.all(assets.filter(f=>f.endsWith('.css')).map(f=>fs.readFile(f,'utf8')))).join('');
assert.match(css,/prefers-reduced-motion/);
assert.ok(html.length>=7,'At least the seven launch routes are prerendered');
console.log(JSON.stringify({pages:html.length,localLinksAndAssets:checked,gzipBytes:bytes,result:'PASS'},null,2));

const sitemap=await fs.readFile(path.join(root,'sitemap.xml'),'utf8');assert.ok((sitemap.match(/<loc>/g)||[]).length>=6);assert.ok(!sitemap.includes('/404'));assert.ok(!sitemap.includes('/admin'));
for(const file of html.filter(f=>f.includes(path.sep+'blog'+path.sep)&&!f.endsWith(path.join('blog','index.html')))){const text=await fs.readFile(file,'utf8');assert.match(text,/BlogPosting/);assert.match(text,/BreadcrumbList/);assert.match(text,/rel="author"/);assert.match(text,/class="article-cover"/);assert.match(text,/class="article-related"/);}

// Admin shells: private, never indexed, no public page links to them.
for(const file of allHtml.filter(f=>f.startsWith(adminDir))){const body=await fs.readFile(file,'utf8');assert.match(body,/<meta name="robots" content="noindex,nofollow,noarchive">/);assert.match(body,/http-equiv="Content-Security-Policy"/);assert.ok(!body.includes('rel="canonical"'));}
for(const file of html){const body=await fs.readFile(file,'utf8');assert.ok(!/href="\/admin/.test(body),`Public page links to admin: ${file}`);assert.ok(!/assets\/(admin|preview)-/.test(body),`Public page loads admin code: ${file}`);}
// No server secrets in the published output.
const secretValues=[process.env.SUPABASE_SERVICE_ROLE_KEY,process.env.RATE_LIMIT_SALT,process.env.TURNSTILE_SECRET_KEY,process.env.VERCEL_DEPLOY_HOOK_URL].filter(v=>v&&v.length>8);
for(const file of files.filter(f=>/\.(html|js|css|json|txt|xml)$/.test(f))){const body=await fs.readFile(file,'utf8');for(const v of secretValues)assert.ok(!body.includes(v),`Secret value leaked into ${file}`);assert.ok(!/SUPABASE_SERVICE_ROLE_KEY|sb_secret_[A-Za-z0-9_-]{16,}/.test(body),`Secret key in ${file}`);for(const jwt of body.match(/eyJ[\w-]+\.eyJ[\w-]+\.[\w-]+/g)||[]){const claims=JSON.parse(Buffer.from(jwt.split('.')[1],'base64url').toString());assert.notEqual(claims.role,'service_role',`service_role JWT in ${file}`);}}
console.log('PASS: blog pages, sitemap, admin isolation and secret scan.');
