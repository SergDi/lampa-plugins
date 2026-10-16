const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const pluginPath = require('node:path').join(__dirname, '../lift.js');
const core = fs.existsSync(pluginPath) ? require(pluginPath) : {};

test('domain discovery accepts HTTPS hosts and rejects URL credentials, paths and insecure input', () => {
 assert.equal(typeof core.domains, 'function');
 assert.deepEqual(core.domains('https://twemd.ws/\napi.faphz.com\nhttps://twemd.ws\nhttp://evil.test\nhttps://u:p@bad.test\nhttps://ok.test/path'), ['https://api.twemd.ws','https://api.faphz.com']);
});
test('movie normalization preserves signed media URLs and subtitle names', () => {
 assert.equal(typeof core.entries, 'function');
 const [e] = core.entries({video_key:123,title:'Movie',streams:{hls:'https://cdn.test/master.m3u8?hx=a%2Fb&v=1'},cc:[{name:'Русские',url:'https://cdn.test/cc.vtt'}],audio:{names:['Dub','Original'],order:[1,0],visible:[true,true]}});
 assert.equal(e.streams.hls,'https://cdn.test/master.m3u8?hx=a%2Fb&v=1');
 assert.deepEqual(e.subtitles,[{label:'Русские',url:'https://cdn.test/cc.vtt'}]);
 assert.deepEqual(e.tracks,[{name:'Dub'},{name:'Original'}]);
});
test('series retain specials and distinct episode labels; reject non-media schemes', () => {
 assert.equal(typeof core.entries, 'function');
 const result=core.entries({title:'Series',seasons:[{season:0,episodes:[{episode:'1.5',video_key:8,streams:{hls:'javascript:alert(1)',dash_vp9:'https://cdn.test/8.mpd'}}]},{season:1,episodes:[{episode:'1',video_key:9,streams:{hls:'https://cdn.test/9.m3u8'}}]}]});
 assert.equal(result[0].season,0); assert.equal(result[0].episode,'1.5'); assert.equal(result[0].streams.hls,undefined); assert.equal(result.length,2);
 assert.throws(()=>core.entries({error:'unauthorized'}));
 assert.throws(()=>core.entries({seasons:[]}));
});
test('search validates results and keeps release years for disambiguation', () => {
 assert.equal(typeof core.searchItems,'function');
 assert.deepEqual(core.searchItems({items:[{id:1,name:'A',year:2000},{id:2,name:'A',year:2020},{id:'../bad',name:'X'}]}).map(x=>[x.id,x.year]),[[1,2000],[2,2020]]);
 assert.throws(()=>core.searchItems({error:'blocked'}));
});
test('API tries another mirror after malformed success and reports total failure', async () => {
 assert.equal(typeof core.firstValid,'function');
 const out=await core.firstValid(['bad','good'],async x=>x==='bad'?{error:'blocked'}:{items:[]},core.searchItems);
 assert.equal(out.host,'good'); assert.deepEqual(out.value,[]);
 await assert.rejects(core.firstValid(['bad'],async()=>{throw new Error('offline')},core.searchItems));
});
test('HTML data is escaped and mirror substitutions preserve signed paths', () => {
 assert.equal(typeof core.escape,'function');
 assert.equal(core.escape('<img onerror="x">&'), '&lt;img onerror=&quot;x&quot;&gt;&amp;');
 assert.deepEqual(core.mediaCandidates('https://a.test/p.m3u8?hx=a%2Fb',['b.test','bad.test/path']),['https://a.test/p.m3u8?hx=a%2Fb','https://b.test/p.m3u8?hx=a%2Fb']);
});
test('normalizes numeric seasons and discards invalid season labels before native filter rendering',()=>{
 const p={seasons:[{season:'2',episodes:[{episode:'1',streams:{hls:'https://cdn.test/a.m3u8'}}]},{season:'<img>',episodes:[{episode:'1',streams:{hls:'https://cdn.test/b.m3u8'}}]}]};
 const result=core.entries(p);assert.equal(result.length,1);assert.equal(result[0].season,2);
});
const card = {id:157336,title:'Интерстеллар',original_title:'Interstellar',release_date:'2014-11-05'};
const exact = {id:180,name:'Интерстеллар',origin_name:'Interstellar',year:2014,type:1};
test('matches exact title, release year and media type instead of similar search hits',()=>{
 assert.equal(typeof core.matchMovie,'function');
 assert.equal(core.matchMovie([{id:9,name:'Interstellar Wars',origin_name:'Interstellar Wars',year:2016,type:1},exact],card)?.id,180);
 assert.equal(core.matchMovie([{...exact,id:2,year:2004},exact],card)?.id,180);
});
test('never auto-selects a sequel, wrong year, unknown year or duplicate release',()=>{
 assert.equal(typeof core.matchMovie,'function');
 assert.equal(core.matchMovie([{...exact,name:'Интерстеллар 2',origin_name:'Interstellar 2'}],card),null);
 assert.equal(core.matchMovie([{...exact,year:2015}],card),null);
 assert.equal(core.matchMovie([exact],{title:card.title}),null);
 assert.equal(core.matchMovie([exact,{...exact,id:181}],card),null);
});
test('matches original titles and harmless punctuation without accepting conflicting originals',()=>{
 assert.equal(typeof core.matchMovie,'function');
 assert.equal(core.matchMovie([{...exact,name:'Другой перевод'}],card)?.id,180);
 assert.equal(core.matchMovie([{...exact,origin_name:'Another film'}],card),null);
 assert.equal(core.matchMovie([{id:2,name:'Унесённые призраками',year:2001,type:6}],{title:'Унесенные призраками',release_date:'2001-07-20'})?.id,2);
 assert.equal(core.matchMovie([{id:3,name:'Человек-паук',year:2002,type:1}],{title:'Человек — паук',release_date:'2002-05-03'})?.id,3);
});
test('distinguishes film, animation and series with the same title and year',()=>{
 assert.equal(typeof core.matchMovie,'function');
 const movie={title:'Same',release_date:'2022-01-01'}, tv={name:'Same',original_name:'Same',first_air_date:'2022-01-01'};
 const items=[{id:1,name:'Same',year:2022,type:1},{id:2,name:'Same',year:2022,type:3}];
 assert.equal(core.matchMovie(items,movie)?.id,1);assert.equal(core.matchMovie(items,tv)?.id,2);
 assert.equal(core.matchMovie([{id:3,name:'Same',year:2022,type:5}],tv)?.id,3);
 assert.equal(core.matchMovie([{id:4,name:'Same',year:2022,type:7}],tv)?.id,4);
 assert.equal(core.matchMovie([{id:5,name:'Same',year:2022,type:99}],movie),null);
});
