(function () {
'use strict';
function videoId(value) {
    try {
        var u = new URL(value), host = u.hostname.replace(/^www\./, '');
        var id = host === 'youtu.be' ? u.pathname.split('/')[1] :
            /^(youtube\.com|m\.youtube\.com|youtube-nocookie\.com)$/.test(host) ?
                u.searchParams.get('v') || (/^\/(embed|shorts|live)\//.test(u.pathname) ? u.pathname.split('/')[2] : '') : '';
        return /^[\w-]{11}$/.test(id || '') ? id : null;
    } catch (_) { return null; }
}
if (typeof module !== 'undefined') { module.exports = {videoId:videoId}; return; }
var $ = function(id){return document.getElementById(id);}, player, ready=false, current='', returnFocus, diagnostic=false;
var saved=[];
try { saved=JSON.parse(localStorage.getItem('aptv_tube_saved') || '[]').filter(function(x){return /^[\w-]{11}$/.test(x);}).slice(0,30); } catch (_) {}
function save(){try{localStorage.setItem('aptv_tube_saved',JSON.stringify(saved));}catch(_){$('status').textContent='Браузер не разрешил сохранить ссылки.';}render();}
function render(){
    $('saved').replaceChildren();
    saved.forEach(function(id){var row=document.createElement('div'),b=document.createElement('button'),del=document.createElement('button');row.className='saved';b.textContent='▶ '+id;b.onclick=function(){open(id,b);};del.textContent='×';del.setAttribute('aria-label','Удалить '+id);del.onclick=function(){saved=saved.filter(function(x){return x!==id;});save();$('url').focus();};row.append(b,del);$('saved').append(row);});
}
function open(id,origin){
    current=id;returnFocus=origin;$('home').hidden=true;$('stage').hidden=false;$('back').focus();$('playerStatus').textContent='Загрузка плеера…';
    if(!saved.includes(id)){saved.unshift(id);saved=saved.slice(0,30);save();}
    if(ready){player.loadVideoById(id);$('playerStatus').textContent='';}
    else if(!player&&window.YT&&YT.Player) createPlayer();
}
function createPlayer(){
    player=new YT.Player('player',{videoId:current,playerVars:{playsinline:1,autoplay:1,rel:0,origin:location.origin},events:{
        onReady:function(){ready=true;player.getIframe().tabIndex=-1;player.getIframe().title='YouTube';if($('stage').hidden)player.stopVideo();else if(current){player.loadVideoById(current);$('playerStatus').textContent='Если видео не началось, нажми «Пуск».';}},
        onStateChange:function(e){if(e.data===1)$('playerStatus').textContent='';},
        onError:function(e){$('playerStatus').textContent='YouTube не воспроизвёл ролик (код '+e.data+'). Попробуй другую ссылку.';}
    }});
}
window.onYouTubeIframeAPIReady=function(){if(current&&!player)createPlayer();};
var api=document.createElement('script');api.src='https://www.youtube.com/iframe_api';api.onerror=function(){$('playerStatus').textContent='Не удалось загрузить YouTube. Проверь соединение.';};document.head.append(api);
$('form').onsubmit=function(e){e.preventDefault();var id=videoId($('url').value.trim());if(!id){$('status').textContent='Нужна ссылка на отдельное видео YouTube.';return;}$('status').textContent='';open(id,$('url'));};
$('back').onclick=function(){if(ready)player.stopVideo();$('stage').hidden=true;$('home').hidden=false;document.body.classList.remove('expanded');$('expand').textContent='Скрыть панель';(returnFocus&&returnFocus.isConnected?returnFocus:$('url')).focus();};
$('play').onclick=function(){if(ready){if(player.getPlayerState()===1)player.pauseVideo();else player.playVideo();}};
$('rewind').onclick=function(){if(ready)player.seekTo(Math.max(0,player.getCurrentTime()-10),true);};
$('forward').onclick=function(){if(ready)player.seekTo(player.getCurrentTime()+10,true);};
$('expand').onclick=function(){var expanded=document.body.classList.toggle('expanded');this.textContent=expanded?'Показать панель':'Скрыть панель';if(expanded){$('playerStatus').textContent='';this.blur();}};
$('diagnostic').onclick=function(){diagnostic=!diagnostic;this.textContent=diagnostic?'Выключить проверку':'Проверить управление';};
document.addEventListener('keydown',function(e){
    var label=(e.shiftKey?'Shift+':'')+e.key;
    $('keys').textContent=label;if(diagnostic)$('diagnosticResult').textContent='Получено: '+label+' · code: '+e.code;
    if(e.target.tagName==='INPUT')return;
    if(e.key==='Escape'&&!$('stage').hidden){e.preventDefault();$('back').click();return;}
    if(['ArrowLeft','ArrowUp','ArrowRight','ArrowDown'].includes(e.key)){
        var scope=$('stage').hidden?$('home'):$('stage');var buttons=Array.from(scope.querySelectorAll('button,input')).filter(function(b){return !b.disabled&&b.getClientRects().length;});
        var n=buttons.indexOf(document.activeElement),step=['ArrowLeft','ArrowUp'].includes(e.key)?-1:1;
        e.preventDefault();if(buttons.length)buttons[(n+step+buttons.length)%buttons.length].focus();
    }
});
render();
}());
