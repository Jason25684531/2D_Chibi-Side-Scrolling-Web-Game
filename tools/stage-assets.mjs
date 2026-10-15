import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..');
const manifest=JSON.parse(await readFile(resolve(root,'assets/character-manifest.json'),'utf8'));
for(const c of manifest.characters){
  const source=resolve(root,c.atlas.sourcePath),destination=resolve(root,c.atlas.stageTo);
  if(!destination.startsWith(resolve(root,'public/assets')+'/')&&!destination.startsWith(resolve(root,'public/assets')+'\\'))throw new Error('Invalid asset destination');
  const digest=createHash('sha256').update(await readFile(source)).digest('hex');
  if(digest!==c.atlas.sha256)throw new Error(`Source changed: ${c.id}`);
  await mkdir(dirname(destination),{recursive:true});await copyFile(source,destination);
  c.atlas.runtimeUrl=c.atlas.plannedBrowserUrl;c.atlas.stagingStatus='staged';
}
await writeFile(resolve(root,'public/assets/character-manifest.json'),JSON.stringify(manifest,null,2));
console.log(`Staged ${manifest.characters.length} unchanged atlases and provenance manifest.`);
