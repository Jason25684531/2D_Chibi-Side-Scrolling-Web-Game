import {it,expect} from 'vitest';
import {LEVEL,validateLevel} from '../../src/level/data';
it('loads canonical capacity and rejects duplicate IDs and unsafe start',()=>{
  expect(()=>validateLevel(LEVEL)).not.toThrow();expect(LEVEL.enemies).toHaveLength(14);expect(LEVEL.badges).toHaveLength(60);expect(LEVEL.powerups.filter(p=>p.kind==='laptop')).toHaveLength(4);expect(LEVEL.powerups.filter(p=>p.kind==='ally')).toHaveLength(3);expect(LEVEL.terrain.filter(p=>p.kind==='bounce')).toHaveLength(6);
  const bad=structuredClone(LEVEL);bad.badges[1].id=bad.badges[0].id;expect(()=>validateLevel(bad)).toThrow('Duplicate');
  expect(()=>validateLevel({...LEVEL,start:{x:1000,y:776}})).toThrow('Unsafe');
});
