import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {parseManifest,ROLES} from '../../src/comfy/skin';
import {fillWorkflow} from '../../src/comfy/client';

const preset=(role:string)=>JSON.parse(readFileSync(`assest/preset_${role}/manifest/game_manifest.json`,'utf8'));

describe('parseManifest',()=>{
  it('reads every preset into the same six-action shape',()=>{
    for(const role of ROLES){
      const skin=parseManifest(preset(role),role,rel=>'/x/'+rel);
      expect(skin.role).toBe(role);
      expect(Object.keys(skin.actions).sort()).toEqual(['attack','djump','fall','idle','jump','run']);
    }
    expect(parseManifest(preset('S2AM'),'S2AM',rel=>'/x/'+rel).actions.run).toEqual({sheet:'/x/Sprite_Sheet_reference_aligned/run.png',cols:2,rows:2,frameCount:2,fps:8});
  });
  it('rejects a wrong schema, another role, a missing action and an impossible frame count',()=>{
    const m=preset('S2AM'),url=(rel:string)=>rel;
    expect(()=>parseManifest({...m,schema:'other'},'S2AM',url)).toThrow();
    expect(()=>parseManifest(m,'S3WW',url)).toThrow();
    expect(()=>parseManifest({...m,actions:m.actions.filter((a:{id:string})=>a.id!=='run')},'S2AM',url)).toThrow();
    expect(()=>parseManifest({...m,actions:m.actions.map((a:{id:string})=>a.id==='idle'?{...a,frame_count:5}:a)},'S2AM',url)).toThrow();
    expect(()=>parseManifest(null,'S2AM',url)).toThrow();
  });
});

describe('fillWorkflow',()=>{
  it('sets template index, output name and photo, and leaves the source untouched',()=>{
    const source={'1':{class_type:'PrimitiveInt',inputs:{value:4}},'2':{class_type:'String',inputs:{String:'Jensen'}},'3':{class_type:'LoadImage',inputs:{image:'a.jpg'}},'12':{class_type:'X',inputs:{user_name:['2',0]}}};
    const filled=fillWorkflow(source,'S1WM','Pabc1','station/Pabc1.png');
    expect(filled['1'].inputs.value).toBe(3);
    expect(filled['2'].inputs.String).toBe('Pabc1');
    expect(filled['3'].inputs.image).toBe('station/Pabc1.png');
    expect(filled['12']).toEqual(source['12']);
    expect(source['1'].inputs.value).toBe(4);
  });
});
