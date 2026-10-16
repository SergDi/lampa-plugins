// Optional live protocol check. Does not download a film or store signed URLs.
// Run: node plugins/lift/tests/live-check.cjs
const core = require('../lift.js');
async function get(url, json) {
 const response = await fetch(url, {signal: AbortSignal.timeout(15000)});
 if(!response.ok) throw new Error('HTTP ' + response.status);
 return json ? response.json() : response.text();
}
(async()=>{
 const hosts=core.domains(await get('https://borov.sourcecraft.site/domains/domains.txt'));
 const search=await core.firstValid(hosts,h=>get(h+'/search?q=Interstellar',true),core.searchItems);
 const movie=search.value.find(x=>x.origin_name==='Interstellar' && Number(x.year)===2014);
 if(!movie) throw new Error('Reference search result absent');
 const playlist=await get(search.host+'/playlist?id='+movie.id,true);
 const entry=core.entries(playlist)[0];
 const manifest=await get(entry.streams.hls);
 if(!manifest.startsWith('#EXTM3U')) throw new Error('Invalid HLS manifest');
 console.log(JSON.stringify({search:'PASS',moviePlaylist:'PASS',hlsManifest:'PASS',audioTracks:entry.tracks.length,subtitles:entry.subtitles.length}));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
