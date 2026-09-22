import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';

// Vercel compiles each file in api/ and runs it as Node ESM. Reproduce that:
// strict nodenext compile, then import every handler with plain Node.
const root=process.cwd();
const out=fs.mkdtempSync(path.join(os.tmpdir(),'velmont-fn-'));
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):e.name.endsWith('.ts')?[path.join(dir,e.name)]:[]);
const entries=walk(path.join(root,'api'));
execFileSync(process.execPath,[path.join(root,'node_modules/typescript/bin/tsc'),...entries,'--outDir',out,'--rootDir',root,'--module','nodenext','--moduleResolution','nodenext','--target','es2022','--skipLibCheck','--types','node','--strict'],{stdio:'inherit'});
fs.copyFileSync(path.join(root,'package.json'),path.join(out,'package.json'));
fs.symlinkSync(path.join(root,'node_modules'),path.join(out,'node_modules'),'dir');
const methods=['GET','POST','PUT','PATCH','DELETE'];
for(const file of entries){
 const compiled=path.join(out,path.relative(root,file)).replace(/\.ts$/,'.js');
 const mod=await import(pathToFileURL(compiled).href);
 const handlers=Object.keys(mod).filter(k=>methods.includes(k));
 if(!handlers.length)throw new Error(`${path.relative(root,file)} exports no HTTP handler`);
 console.log(`${path.relative(root,file)}: ${handlers.join(', ')}`);
}
fs.rmSync(out,{recursive:true,force:true});
console.log('PASS: API functions compile per file and load as Node ESM.');
