const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../lift.js'),'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
async function settle() { for(let i=0;i<20;i++) await tick(); }
const film = {video_key:11,title:'Film',streams:{hls:'https://video.test/master.m3u8?hx=original'},audio:{names:['Dub','Original']},cc:[{name:'Sub',url:'https://video.test/sub.vtt'}]};
function harness(respond, saved={}) {
 const calls=[], events={}, requests=[], components={}, state={};
 class Node {
  constructor(html='') { this.html=html;this.events={};this.children=[];this.fields={};this.attrs={};this.length=1;this[0]=this; }
  on(names,fn) { names.split(' ').forEach(n=>this.events[n]=fn);return this; }
  find(key) { return this.fields[key] ||= new Node(); }
  text(v) { if(v===undefined)return this.value;this.value=String(v);return this; }
  attr(k,v){this.attrs[k]=v;return this;}
  append(v){this.children.push(v);return this;}
  empty(){this.children=[];return this;}
  addClass(){return this;} removeClass(){return this;} toggleClass(){return this;}
  remove(){return this;} first(){return this;} after(){return this;}
 }
 class XHR {
  open(method,url){this.url=url;}
  send(){requests.push(this);setImmediate(()=>{
   if(this.aborted)return;const value=respond(this.url);if(value===undefined)return;
   this.status=value.status||200;this.responseText=typeof value==='string'?value:JSON.stringify(value);this.onload();
  });}
  abort(){this.aborted=true;if(this.onabort)this.onabort();}
 }
 const L={
  Component:{add:(name,fn)=>components[name]=fn},
  Activity:{push:options=>{
   if(state.component)state.component.pause();
   state.options=options;state.component=new components[options.component](options);
   state.component.activity={loader:x=>state.loading=x};state.component.create();state.component.start();
  },active:()=>({activity:state.foreign?{}:state.component?.activity}),backward:()=>{state.component.stop();state.component.destroy();calls.push(['back']);}},
  Explorer:class { constructor(){this.node=new Node();} render(){return this.node;}appendHead(){}appendFiles(){}destroy(){}},
  Scroll:class {constructor(){this.node=new Node();state.scroll=this;}render(){return this.node;}body(){return this.node;}append(x){this.node.append(x);}clear(){this.node.empty();}reset(){}minus(){}update(){}destroy(){}},
  Filter:class {constructor(){state.filter=this;this.node=new Node();this.data={};}render(){return this.node;}set(k,v){this.data[k]=v;}chosen(){}destroy(){}show(){}},
  Listener:{follow:(event,fn)=>{(events[event] ||= []).push(fn);}},
  Storage:{get:(key,fallback)=>saved[key]??fallback,set:(key,value)=>saved[key]=value},
  Select:{show:x=>{state.menu=x;calls.push(['menu',x.title]);},hide:()=>state.menu=null},
  Controller:{enabled:()=>({name:'content'}),add:(name,c)=>state.controller=c,toggle:x=>{calls.push(['controller',x]);if(x==='content')state.controller?.toggle();},collectionSet:()=>{},collectionFocus:node=>state.focus=node},
  Noty:{show:x=>calls.push(['error',x])},
  Utils:{hash:x=>x},Timeline:{view:(hash,meta)=>({hash,meta,percent:35}),link:(m,s,e)=>({id:m.id,season:s,episode:e}),render:view=>({timeline:view})},
  Favorite:{add:(...x)=>calls.push(['history',...x])},
  Player:{play:x=>{state.play=x;calls.push(['play',x]);},playlist:x=>state.playlist=x}
 };
 const window={document:{},Lampa:L,appready:true,$:html=>new Node(html),Navigator:{move:()=>{},canmove:()=>false}};
 const context=vm.createContext({window,XMLHttpRequest:XHR,URL,Promise,setTimeout,clearTimeout,console});vm.runInContext(source,context);
 return {window,L,state,calls,events,requests,context,saved,rows:()=>state.scroll.node.children.filter(n=>n.events?.['hover:enter']),select:i=>{const rows=state.scroll.node.children.filter(n=>n.events?.['hover:enter']);rows[i].events['hover:enter']();}};
}
function route(url) {
 if(url.includes('domains.txt')) return 'https://lift.test/';
 if(url.includes('/search?')) return {items:[{id:7,name:'Film',year:2020},{id:8,name:'Film',year:2000}]};
 if(url.includes('/playlist?')) return film;
 if(url.includes('master.m3u8')) return '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=100\nvideo.m3u8';
 return {status:503};
}
test('opens an Activity with inline matches, then playable rows and safe native payloads',async()=>{
 const h=harness(route);h.window.LampaLift.open({id:12,title:'Film'});await settle();
 assert.equal(h.state.options.component,'lift');assert.equal(h.rows().length,2);assert.equal(h.state.menu,undefined);
 h.select(0);await settle();assert.equal(h.rows().length,1);h.select(0);await settle();
 assert.equal(h.state.play.url,'https://video.test/master.m3u8?hx=original');
 assert.equal(h.state.play.translate.tracks[1].name,'Original');assert.equal(h.state.play.subtitles[0].label,'Sub');
 assert.equal(h.state.playlist.length,1);assert.equal(h.calls.filter(x=>x[0]==='history').length,1);
});
test('Back aborts loading and prevents stale activity content',async()=>{
 const h=harness(()=>undefined);h.window.LampaLift.open({id:1,title:'Film'});h.state.component.back();await settle();
 assert(h.requests.every(x=>x.aborted));assert.equal(h.calls.filter(x=>x[0]==='back').length,1);assert.equal(h.calls.filter(x=>x[0]==='error').length,0);
});
test('series filters retain specials, remember season and focus, and use direct serializable playlists',async()=>{
 const series={title:'Series',seasons:[{season:0,episodes:[{...film,episode:'1',video_key:21}]},{season:1,episodes:[{...film,episode:'1',video_key:31},{...film,episode:'2',video_key:32}]}]};
 const h=harness(url=>url.includes('/playlist?')?series:route(url));
 h.window.LampaLift.open({id:1,name:'Series'});await settle();h.select(0);await settle();
 const seasons=h.state.filter.data.filter.find(x=>x.stype==='season');assert.equal(seasons.items[0].title,'Сезон 0');
 h.state.filter.onSelect('filter',seasons,seasons.items[1]);await new Promise(r=>setTimeout(r,20));
 assert.equal(h.rows().length,2);h.select(1);await settle();
 assert.equal(h.state.play.episode,'2');assert.equal(h.state.playlist.length,2);assert.equal(typeof h.state.playlist[0].url,'string');assert.doesNotThrow(()=>JSON.stringify(h.state.play));
 h.window.LampaLift.open({id:1,name:'Series'});await settle();assert.equal(h.rows().length,2);
 assert.equal(h.state.focus.attrs['data-lift-entry'],'32');
 assert(h.rows()[0].children.some(x=>x.timeline?.percent===35));
});
test('failed manifest leaves an actionable episode list for retry',async()=>{
 let fail=true;const h=harness(url=>url.includes('video.test')&&fail?'<html>blocked</html>':route(url));
 h.window.LampaLift.open({id:12,title:'Film'});await settle();h.select(0);await settle();h.select(0);await settle();
 assert.equal(h.calls.filter(x=>x[0]==='play').length,0);assert.equal(h.rows().length,1);
 fail=false;h.select(0);await settle();assert(h.state.play);
});
test('old Mac Timeline API and escaped remote player metadata remain supported',async()=>{
 const h=harness(url=>url.includes('/playlist?')?{...film,title:'<img>',audio:{names:['<audio>']},cc:[{name:'<sub>',url:'https://video.test/a.vtt'}]}:route(url));delete h.L.Timeline.link;
 h.window.LampaLift.open({id:12,title:'Film'});await settle();h.select(0);await settle();h.select(0);await settle();
 assert.equal(h.state.play.title,'&lt;img&gt;');assert.equal(h.state.play.translate.tracks[0].name,'&lt;audio&gt;');assert.equal(h.state.play.subtitles[0].label,'&lt;sub&gt;');
});
test('duplicate script load registers one card listener',()=>{const h=harness(route);vm.runInContext(source,h.context);assert.equal(h.events.full.length,1);});
test('leaving during manifest probe cannot resurrect playback',async()=>{
 const h=harness(url=>url.includes('video.test')?undefined:route(url));h.window.LampaLift.open({id:12,title:'Film'});await settle();h.select(0);await settle();h.select(0);await settle();h.state.component.back();await settle();
 assert.equal(h.calls.filter(x=>x[0]==='play').length,0);assert(h.requests.filter(x=>x.url.includes('video.test')).every(x=>x.aborted));
});

test('paused activity cancels pending work and restarts it when returning',async()=>{
 const h=harness(route);h.window.LampaLift.open({id:12,title:'Film'});
 h.state.component.pause();h.state.foreign=true;await settle();
 h.state.foreign=false;h.state.component.start();await settle();
 assert.equal(h.state.loading,false);assert.equal(h.rows().length,2);
});
test('registers Lift inside the Watch source container instead of the visible action row',async()=>{
 const h=harness(route), render=h.window.$('<div>');render.find('.view--lift').length=0;
 const sources=render.find('.buttons--container'), visible=render.find('.full-start-new__buttons, .full-start__buttons');
 h.events.full[0]({type:'complite',data:{movie:{id:12,title:'Film'}},object:{activity:{render:()=>render}}});
 assert.equal(sources.children.length,1);assert.equal(visible.children.length,0);
 sources.children[0].events['hover:enter']();await settle();assert.equal(h.state.options.component,'lift');
});
test('opening a known movie skips similar results and loads only its matching playlist',async()=>{
 const items=[{id:70,name:'Film',origin_name:'Film',year:2020,type:1},{id:80,name:'Film',origin_name:'Film',year:2000,type:1}];
 const h=harness(url=>url.includes('/search?')?{items}:route(url));
 h.window.LampaLift.open({id:12,title:'Film',original_title:'Film',release_date:'2020-01-01'});await settle();
 assert(h.requests.some(x=>x.url.includes('/playlist?id=70')));assert(!h.requests.some(x=>x.url.includes('/playlist?id=80')));
 assert.equal(h.rows().length,1);assert.equal(h.rows()[0].attrs['data-lift-entry'],'11');assert.equal(h.state.play,undefined);
});
test('tries original title when localized search returned only unrelated films',async()=>{
 const h=harness(url=>url.includes('/search?')?{items:url.includes('Original')?[{id:70,name:'Перевод',origin_name:'Original',year:2020,type:1}]:[{id:9,name:'Не то',year:2020,type:1}]}:route(url));
 h.window.LampaLift.open({id:12,title:'Фильм',original_title:'Original',release_date:'2020-01-01'});await settle();
 assert(h.requests.some(x=>x.url.includes('/playlist?id=70')));assert.equal(h.rows().length,1);
});
test('explicit Search Lift still allows choosing another release',async()=>{
 const h=harness(url=>url.includes('/search?')?{items:[{id:70,name:'Film',origin_name:'Film',year:2020,type:1}]}:route(url));
 h.window.LampaLift.open({id:12,title:'Film',original_title:'Film',release_date:'2020-01-01'});await settle();
 h.state.filter.onSearch('Film');await settle();
 assert.equal(h.rows()[0].attrs['data-lift-result'],70);
});
