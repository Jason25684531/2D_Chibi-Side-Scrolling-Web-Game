import {describe,it,expect} from 'vitest';
import {MockStation,validRanking} from '../../src/ui/mock-station';
describe('stored ranking boundary',()=>{
  const row={runId:'one',nickname:'中文 Player',score:20,tier:'100',titles:[]};
  it('rejects corrupt schema values without accepting fabricated defaults',()=>{
    expect(validRanking(row)).toBe(true);
    for(const invalid of [null,{}, {...row,score:NaN},{...row,score:-1},{...row,tier:'30'},{...row,nickname:' '},{...row,titles:[null]},{...row,characterId:'unknown'},{...row,completedAt:'invalid'}])expect(validRanking(invalid)).toBe(false);
  });
  it('keeps ties stable and only shows the single 100 s board',()=>{
    const station=new MockStation();station.records=[row,{...row,runId:'two'},{...row,runId:'legacy',score:999,tier:'90'}];
    expect(station.board(100).map(r=>r.runId)).toEqual(['one','two']);
  });
});
