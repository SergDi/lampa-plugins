/* Lift for Lampa v0.2.1. Standalone script; no remote code or native bridge required. */
(function (root) {
    'use strict';
    var DISCOVERY = 'https://borov.sourcecraft.site/domains/domains.txt';
    var FALLBACK = 'twemd.ws\nfaphz.com\nlateremb.ws\nembandr.ws\nniteface.ws\ntfil.net';
    function unique(items) { return items.filter(function (x, i) { return items.indexOf(x) === i; }); }
    function escape(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
            return {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c];
        });
    }
    function host(value) {
        var match = String(value || '').trim().match(/^(?:https:\/\/)?((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63})\/?$/i);
        return match ? match[1].toLowerCase() : '';
    }
    function domains(text) {
        return unique(String(text || '').split(/\s+/).map(function (s) {
            var h = host(s);
            return h ? 'https://' + (h.indexOf('api.') === 0 ? h : 'api.' + h) : '';
        }).filter(Boolean));
    }
    function mediaURL(value) {
        if (typeof value !== 'string' || !/^https?:\/\//i.test(value)) return '';
        try {
            var u = new URL(value);
            return u.hostname && !u.username && !u.password ? value : '';
        } catch (_) { return ''; }
    }
    function mediaCandidates(url, mirrors) {
        if (!mediaURL(url)) return [];
        return unique([url].concat((Array.isArray(mirrors) ? mirrors : []).map(function (h) {
            h = host(h);
            return h ? url.replace(/^(https?:\/\/)[^/]+/, '$1' + h) : '';
        }).filter(Boolean)));
    }
    function searchItems(data) {
        if (!data || !Array.isArray(data.items)) throw new Error('Некорректный ответ поиска Lift');
        return data.items.filter(function (x) {
            return x && /^\d+$/.test(String(x.id)) && Number(x.id) > 0 && typeof x.name === 'string';
        });
    }
    function normalizeTitle(value) {
        var title = String(value || '').toLowerCase();
        if (title.normalize) title = title.normalize('NFKC');
        return title.replace(/ё/g, 'е').replace(/[\s.,:;!?"'«»“”‘’()\[\]{}\-–—_]+/g, ' ').trim();
    }
    function matchMovie(items, movie) {
        var tv = movie.media_type === 'tv' || (movie.media_type !== 'movie' && Boolean(movie.first_air_date || movie.original_name || (movie.name && !movie.title)));
        var year = String((tv ? movie.first_air_date : movie.release_date) || movie.year || '').slice(0, 4);
        if (!/^[12]\d{3}$/.test(year)) return null;
        var original = normalizeTitle(movie.original_title || movie.original_name);
        var titles = unique([normalizeTitle(movie.title), normalizeTitle(movie.name), original].filter(Boolean));
        var seen = {};
        var exact = items.filter(function (item) {
            // Lift IDs belong to its own catalogue; they are not TMDB IDs.
            var knownType = (tv ? [3, 5, 7] : [1, 2, 6]).indexOf(Number(item.type)) >= 0;
            if (!knownType || String(item.year) !== year || seen[item.id]) return false;
            var itemOriginal = normalizeTitle(item.origin_name);
            if (original && itemOriginal && original !== itemOriginal) return false;
            var titleMatch = titles.indexOf(normalizeTitle(item.name)) >= 0 || (itemOriginal && titles.indexOf(itemOriginal) >= 0);
            if (!titleMatch) return false;
            seen[item.id] = true;
            return true;
        });
        return exact.length === 1 ? exact[0] : null;
    }
    function entries(data) {
        if (!data || typeof data !== 'object') throw new Error('Некорректный плейлист Lift');
        var result = [];
        function add(item, season) {
            if (!item || typeof item !== 'object') return;
            var streams = {};
            ['hls', 'dash_vp9', 'dash_av1'].forEach(function (key) {
                var url = mediaURL((item.streams || {})[key]);
                if (url) streams[key] = url;
            });
            if (!Object.keys(streams).length) return;
            var audio = item.audio || {};
            result.push({
                key: String(item.video_key || item.id || ''),
                title: String(item.title || data.title || 'Lift'),
                season: season,
                episode: season == null ? null : String(item.episode == null ? '' : item.episode),
                label: String(item.episode_label || item.episode || ''),
                streams: streams,
                mirrors: Array.isArray(data.video_domains) ? data.video_domains : [],
                subtitles: (Array.isArray(item.cc) ? item.cc : []).filter(function (s) { return s && mediaURL(s.url); }).map(function (s) {
                    return {label: String(s.name || 'Субтитры'), url: s.url};
                }),
                // Names are indexed by physical stream index. APK's order is a display preference.
                tracks: (Array.isArray(audio.names) ? audio.names : []).map(function (name) { return {name: String(name)}; })
            });
        }
        if (data.streams) add(data, null);
        else if (Array.isArray(data.seasons)) data.seasons.forEach(function (s) {
            if (s && Array.isArray(s.episodes) && /^\d+$/.test(String(s.season == null ? 1 : s.season))) {
                s.episodes.forEach(function (e) { add(e, Number(s.season == null ? 1 : s.season)); });
            }
        });
        if (!result.length) throw new Error('В плейлисте Lift нет доступных видео');
        return result;
    }
    function firstValid(hosts, request, validate) {
        return new Promise(function (resolve, reject) {
            if (!hosts.length) return reject(new Error('Нет доступных серверов Lift'));
            var remaining = hosts.length;
            hosts.forEach(function (h) {
                Promise.resolve().then(function () { return request(h); }).then(function (data) {
                    resolve({host: h, value: validate(data)});
                }).catch(function () {
                    if (!--remaining) reject(new Error('Серверы Lift не ответили. Попробуйте позже.'));
                });
            });
        });
    }
    var core = {matchMovie: matchMovie, domains: domains, entries: entries, searchItems: searchItems, firstValid: firstValid, escape: escape, mediaCandidates: mediaCandidates};
    if (typeof module === 'object' && module.exports && !root.document) { module.exports = core; return; }
    if (!root.document || root.lampa_lift_plugin) return;
    root.lampa_lift_plugin = true;

    var L, discoveryCache, preferred = '', installed = false;
    function session() {
        var s = {closed: false, pending: []};
        s.abort = function () {
            s.closed = true;
            s.pending.slice().forEach(function (xhr) { xhr.abort(); });
            s.pending = [];
        };
        return s;
    }
    function request(s, url, json, timeout) {
        return new Promise(function (resolve, reject) {
            if (s.closed) return reject(new Error('cancelled'));
            var xhr = new XMLHttpRequest();
            s.pending.push(xhr);
            function finish(error, value) {
                var i = s.pending.indexOf(xhr);
                if (i >= 0) s.pending.splice(i, 1);
                if (error) reject(error); else resolve(value);
            }
            xhr.open('GET', url, true);
            xhr.timeout = timeout || 10000;
            xhr.onload = function () {
                if (s.closed) return finish(new Error('cancelled'));
                if (xhr.status < 200 || xhr.status >= 300) return finish(new Error('HTTP ' + xhr.status));
                try { finish(null, json ? JSON.parse(xhr.responseText) : xhr.responseText); }
                catch (_) { finish(new Error('Некорректный ответ Lift')); }
            };
            xhr.onerror = xhr.ontimeout = xhr.onabort = function () { finish(new Error('Сеть недоступна')); };
            xhr.send();
        });
    }
    function discover(s) {
        if (!discoveryCache) {
            var saved = L.Storage.get('lift_domains_v1', {});
            if (saved && Date.now() - saved.time < 86400000 && Array.isArray(saved.hosts)) discoveryCache = saved;
        }
        if (discoveryCache && Date.now() - discoveryCache.time < 86400000) return Promise.resolve(domains(discoveryCache.hosts.join('\n')));
        return request(s, DISCOVERY, false, 4000).then(function (text) {
            var found = domains(text);
            if (!found.length) throw new Error('empty discovery');
            discoveryCache = {time: Date.now(), hosts: found};
            L.Storage.set('lift_domains_v1', discoveryCache);
            return found;
        }).catch(function () { return []; });
    }
    function api(s, path, validate) {
        return discover(s).then(function (found) {
            if (s.closed) throw new Error('cancelled');
            var hosts = unique((preferred ? [preferred] : []).concat(found, domains(FALLBACK)));
            // A separate group lets us cancel losing mirrors without cancelling the UI session.
            var group = session();
            var abortGroup = {abort: group.abort};
            s.pending.push(abortGroup);
            function cleanup() {
                group.abort();
                var i = s.pending.indexOf(abortGroup);
                if (i >= 0) s.pending.splice(i, 1);
            }
            return firstValid(hosts, function (h) { return request(group, h + path, true); }, validate).then(function (result) {
                cleanup();
                if (s.closed) throw new Error('cancelled');
                preferred = result.host;
                return result.value;
            }, function (e) { cleanup(); throw e; });
        });
    }
    function probe(s, entry, format) {
        var candidates = mediaCandidates(entry.streams[format], entry.mirrors);
        function next(i) {
            if (s.closed) return Promise.reject(new Error('cancelled'));
            if (i >= candidates.length) return Promise.reject(new Error('Видеосерверы Lift недоступны'));
            return request(s, candidates[i], false, 6000).then(function (text) {
                if (format === 'hls' ? !/^\s*#EXTM3U/.test(text) : !/<MPD[\s>]/.test(text)) throw new Error('invalid manifest');
                return candidates[i];
            }).catch(function () { return next(i + 1); });
        }
        return next(0);
    }
    function payload(entry, format, movie, url) {
        var title = entry.season == null ? entry.title : entry.title + ' / S' + entry.season + ' E' + entry.label;
        var hash = L.Utils.hash(['lift', movie.source || 'tmdb', movie.original_name || movie.name ? 'tv' : 'movie', movie.id || entry.key, entry.season, entry.episode].join(':'));
        return {
            url: url || entry.streams[format], title: escape(title), card: movie,
            season: entry.season, episode: entry.episode,
            timeline: L.Timeline.view(hash, L.Timeline.link ? L.Timeline.link(movie, entry.season, entry.episode) : undefined),
            subtitles: entry.subtitles.map(function (sub) { return {url: sub.url, label: escape(sub.label)}; }),
            translate: {tracks: entry.tracks.map(function (track) { return {name: escape(track.name)}; })}
        };
    }
    var formatLabels = {hls: 'HLS', dash_vp9: 'DASH / VP9', dash_av1: 'DASH / AV1'};
    function Component(object) {
        var self = this, movie = object.movie, explorer = new L.Explorer(object);
        var scroll = new L.Scroll({mask: true, over: true}), filter = new L.Filter(object);
        var all = [], matches = [], rows = [], last, job, timer, busy = false, stopped = false, destroyed = false, reload = false;
        var query = object.search, selectedId, manualSearch = false;
        var cardKey = [movie.source || 'tmdb', movie.original_name || movie.name ? 'tv' : 'movie', movie.id || query].join(':');
        var choices = L.Storage.get('lift_choices_v2', {});
        if (!choices || typeof choices !== 'object' || Array.isArray(choices)) choices = {};
        var saved = choices[cardKey] || {}, season = saved.season, format = saved.format || 'hls', lastKey = saved.last;
        if (/^\d+$/.test(String(saved.id))) selectedId = saved.id;
        function current() { return !destroyed && !stopped && L.Activity.active().activity === self.activity; }
        function live(s) { return current() && job === s && !s.closed; }
        function save() {
            choices[cardKey] = {id: selectedId, season: season, format: format, last: lastKey};
            var keys = Object.keys(choices);
            while (keys.length > 200) delete choices[keys.shift()];
            L.Storage.set('lift_choices_v2', choices);
        }
        function begin() {
            if (job) job.abort();
            job = session(); busy = true;
            self.activity.loader(true);
            return job;
        }
        function finish() { busy = false; self.activity.loader(false); }
        function clear() { scroll.clear(); rows = []; last = null; }
        function row(title, detail, action, key) {
            var node = root.$('<div class="online selector"><div class="online__body"><div class="online__title"></div><div class="online__quality"></div></div></div>');
            node.find('.online__title').text(title);
            node.find('.online__quality').text(detail || '');
            if (key != null) node.attr('data-lift-entry', key);
            node.on('hover:enter', action);
            node.on('hover:focus', function () {
                last = node[0];
                if (key != null) { lastKey = key; save(); }
                scroll.update(node, true);
            });
            scroll.append(node); rows.push(node);
            if (key != null && String(key) === String(lastKey)) last = node[0];
            return node;
        }
        function message(text, retry) {
            clear();
            row(text, 'Нажмите, чтобы повторить поиск', retry || self.search);
            self.activate();
        }
        function error(s, err, retry) {
            if (!live(s)) return;
            finish();
            message(err.message || 'Не удалось загрузить Lift', retry);
        }
        function updateFilters() {
            var seasons = unique(all.map(function (e) { return e.season; }));
            if (seasons.indexOf(season) < 0) season = seasons[0];
            var available = unique([].concat.apply([], all.filter(function (e) { return e.season === season; }).map(function (e) { return Object.keys(e.streams); })));
            if (available.indexOf(format) < 0) format = available.indexOf('hls') >= 0 ? 'hls' : available[0];
            filter.set('sort', available.map(function (f) { return {title: formatLabels[f], format: f, selected: f === format}; }));
            filter.chosen('sort', format ? [formatLabels[format]] : []);
            filter.set('filter', seasons.length && seasons[0] != null ? [{
                title: 'Сезон', stype: 'season', subtitle: 'Сезон ' + season,
                items: seasons.map(function (n) { return {title: 'Сезон ' + n, season: n, selected: n === season}; })
            }] : []);
            filter.chosen('filter', season == null ? [] : ['Сезон ' + season]);
        }
        function drawEntries() {
            clear(); updateFilters();
            all.filter(function (e) { return e.season === season && e.streams[format]; }).forEach(function (entry) {
                var play = payload(entry, format, movie);
                var node = row(entry.season == null ? entry.title : 'Серия ' + entry.label,
                    [entry.season == null ? '' : entry.title, formatLabels[format], entry.tracks.map(function (t) { return t.name; }).join(' / ')].filter(Boolean).join(' · '),
                    function () { self.play(entry); }, entry.key || entry.season + ':' + entry.episode);
                if (L.Timeline.render) node.append(L.Timeline.render(play.timeline));
                if (Number(play.timeline.percent) >= 90) node.find('.online__quality').text('Просмотрено · ' + formatLabels[format]);
            });
            save(); self.activate();
        }
        function drawMatches() {
            clear(); filter.set('sort', []); filter.set('filter', []);
            matches.forEach(function (item) {
                row(item.name, [item.year, item.origin_name, item.quality].filter(Boolean).join(' · '), function () {
                    selectedId = item.id; lastKey = null; save(); self.load();
                }).attr('data-lift-result', item.id);
            });
            self.activate();
        }
        this.search = function (value) {
            if (typeof value === 'string' && value.trim()) { query = value.trim(); manualSearch = true; }
            all = []; selectedId = null; lastKey = null; save();
            clear(); filter.set('sort', []); filter.set('filter', []);
            var s = begin();
            function find(title) { return api(s, '/search?q=' + encodeURIComponent(title), searchItems); }
            find(query).then(function (items) {
                if (!live(s)) return [];
                var original = movie.original_title || movie.original_name;
                if (manualSearch || matchMovie(items, movie) || !original || normalizeTitle(original) === normalizeTitle(query)) return items;
                return find(original).then(function (extra) {
                    var ids = {};
                    return items.concat(extra).filter(function (item) {
                        if (ids[item.id]) return false;
                        ids[item.id] = true; return true;
                    });
                }).catch(function () { return items; });
            }).then(function (items) {
                if (!live(s)) return;
                finish(); matches = items;
                var exact = manualSearch ? null : matchMovie(items, movie);
                if (exact) { selectedId = exact.id; save(); self.load(); }
                else if (!items.length) message('В Lift ничего не найдено');
                else drawMatches();
            }).catch(function (err) { error(s, err); });
        };
        this.load = function () {
            clear(); var s = begin();
            api(s, '/playlist?id=' + encodeURIComponent(selectedId), entries).then(function (items) {
                if (!live(s)) return;
                finish(); all = items; drawEntries();
            }).catch(function (err) { error(s, err, self.load); });
        };
        this.play = function (entry) {
            if (busy || !current()) return;
            lastKey = entry.key || entry.season + ':' + entry.episode; save();
            var s = begin(), chosenFormat = format;
            probe(s, entry, chosenFormat).then(function (url) {
                if (!live(s)) return;
                finish();
                var first = payload(entry, chosenFormat, movie, url);
                var list = all.filter(function (e) { return e.season === entry.season && e.streams[chosenFormat]; }).map(function (e) {
                    return payload(e, chosenFormat, movie, e === entry ? url : undefined);
                });
                if (movie.id) L.Favorite.add('history', movie, 100);
                if (list.length > 1) first.playlist = list;
                L.Player.play(first); L.Player.playlist(list);
            }).catch(function (err) {
                if (!live(s)) return;
                finish(); L.Noty.show(escape(err.message)); drawEntries();
            });
        };
        this.create = function () {
            scroll.body().addClass('torrent-list');
            explorer.appendHead(filter.render()); explorer.appendFiles(scroll.render());
            scroll.minus(explorer.render().find('.explorer__files-head'));
            filter.render().find('.filter--sort span').text('Формат');
            filter.render().find('.filter--search span').text('Поиск Lift');
            filter.onSearch = self.search;
            filter.onBack = function () { self.start(); };
            filter.onSelect = function (type, a, b) {
                if (job) job.abort(); finish();
                if (type === 'sort') format = a.format;
                else if (a.stype === 'season' && b) { season = b.season; lastKey = null; }
                drawEntries();
                // Filter.show opens its parent menu after onSelect; close it on the next turn.
                clearTimeout(timer);
                timer = setTimeout(function () { if (current()) { L.Select.hide(); self.start(); } }, 0);
            };
            if (selectedId) self.load(); else self.search();
            return self.render();
        };
        this.activate = function () {
            if (!current()) return;
            L.Controller.add('content', {
                toggle: function () {
                    L.Controller.collectionSet(explorer.render());
                    L.Controller.collectionFocus(last || (rows[0] && rows[0][0]) || false, explorer.render());
                },
                up: function () { if (root.Navigator.canmove('up')) root.Navigator.move('up'); else L.Controller.toggle('head'); },
                down: function () { root.Navigator.move('down'); },
                left: function () { if (root.Navigator.canmove('left')) root.Navigator.move('left'); else L.Controller.toggle('menu'); },
                right: function () { root.Navigator.move('right'); },
                back: self.back
            });
            L.Controller.toggle('content');
        };
        this.start = function () {
            if (destroyed) return;
            stopped = false;
            if (reload) { reload = false; if (selectedId) self.load(); else self.search(); }
            else if (all.length && !busy) drawEntries();
            else self.activate();
        };
        this.render = function () { return explorer.render(); };
        this.back = function () { self.stop(); L.Activity.backward(); };
        this.pause = function () { self.stop(); };
        this.stop = function () {
            stopped = true; reload = reload || busy; busy = false;
            clearTimeout(timer);
            if (job) job.abort();
        };
        this.destroy = function () {
            self.stop(); destroyed = true;
            filter.destroy(); scroll.destroy(); explorer.destroy();
        };
    }
    function open(movie) {
        var title = String(movie.title || movie.name || movie.original_title || movie.original_name || '').trim();
        if (!title) { L.Noty.show('У карточки нет названия'); return; }
        L.Activity.push({url: '', title: 'Lift', component: 'lift', movie: movie,
            search: title, search_one: title, search_two: movie.original_title || movie.original_name || '', page: 1});
    }
    function install() {
        if (installed) return;
        installed = true;
        L.Component.add('lift', Component);
        L.Listener.follow('full', function (event) {
            if (event.type !== 'complite' || !event.data || !event.data.movie) return;
            var render = event.object.activity.render();
            if (render.find('.view--lift').length) return;
            var button = root.$('<div class="full-start__button selector view--lift"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="3" stroke="currentColor" stroke-width="1.8"/><path d="M10 8.5L16 12L10 15.5V8.5Z" fill="currentColor"/></svg><span>Lift</span></div>');
            button.on('hover:enter', function () { open(event.data.movie); });
            var sources = render.find('.buttons--container').first();
            if (sources.length) sources.append(button);
            else render.find('.view--torrent').first().after(button);
        });
        root.LampaLift = {version: '0.2.1', open: open};
    }
    var tries = 0;
    function boot() {
        L = root.Lampa;
        if (!L || !L.Listener || !root.$) {
            if (++tries < 300) setTimeout(boot, 100);
            else root.lampa_lift_plugin = false;
            return;
        }
        if (root.appready) install();
        else L.Listener.follow('app', function (e) { if (e.type === 'ready' || e.type === 'start') install(); });
    }
    boot();
}(typeof window !== 'undefined' ? window : globalThis));
