import {existsSync} from 'node:fs';
import {expect,test} from 'vitest';
import {SFX} from '../../src/audio/sfx';

test('every sheet ID (音效清單, 39 rows) points at a file in /Audio',()=>{
  expect(Object.keys(SFX)).toHaveLength(39);
  for(const [id,[file]] of Object.entries(SFX))expect(existsSync('Audio/'+file),`${id} → ${file}`).toBe(true);
});
