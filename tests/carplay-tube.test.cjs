const {test}=require('node:test'),assert=require('node:assert/strict');
const {videoId}=require('../carplay-tube.js');
test('accepts YouTube watch, shared, shorts and live video links',()=>{
 for(const url of ['https://www.youtube.com/watch?v=jfKfPfyJRdk&feature=share','https://youtu.be/jfKfPfyJRdk?t=5','https://m.youtube.com/shorts/jfKfPfyJRdk','https://youtube.com/live/jfKfPfyJRdk'])assert.equal(videoId(url),'jfKfPfyJRdk');
});
test('rejects non-YouTube hosts, malformed ids and playlist-only links',()=>{
 for(const url of ['https://evil.test/watch?v=jfKfPfyJRdk','https://youtube.com.evil.test/watch?v=jfKfPfyJRdk','https://youtube.com/watch?v=abc','https://youtube.com/playlist?list=test','javascript:alert(1)'])assert.equal(videoId(url),null);
});
