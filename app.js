'use strict';
(() => {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const original = Array.isArray(window.PROMPTETS_DATA) ? window.PROMPTETS_DATA : [];
  let entries = original.map(normalize).filter(Boolean);
  let level = 0;
  let clean = false;
  let spinning = false;
  let current = null;
  let recent = [];
  let toastTimer = null;
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function normalize(row, i) {
    if (!row || typeof row !== 'object') return null;
    const phrase = String(row.phrase ?? row.фраза ?? '').trim();
    if (!phrase) return null;
    const num = Number(row.level ?? row.уровень ?? 2);
    const swearRaw = String(row.swear ?? row.мат ?? '').toLowerCase();
    return {
      id: String(row.id ?? `P${String(i + 1).padStart(3, '0')}`).trim(),
      phrase,
      category: String(row.category ?? row.категория ?? 'Промпты на все случаи').trim(),
      level: [1,2,3].includes(num) ? num : 2,
      swear: /^(да|yes|true|1|мат)$/.test(swearRaw) ? 'Да' : 'Нет',
      recommendation: String(row.recommendation ?? row.рекомендация ?? 'когда нейросеть опять всё поняла по-своему').trim(),
      status: String(row.status ?? row.статус ?? 'На проверку').trim(),
      favorite: String(row.favorite ?? row.избранное ?? 'Нет').trim(),
      origin: String(row.origin ?? row.происхождение ?? 'Авторская').trim(),
      source_url: String(row.source_url ?? row.источник ?? '').trim(),
      editor_note: String(row.editor_note ?? row.заметка ?? '').trim()
    };
  }

  function eligible() {
    return entries.filter((p) => {
      if (['удалить','отклонено','deleted','exclude'].includes(p.status.toLowerCase())) return false;
      if (level !== 0 && p.level !== level) return false;
      if (clean && p.swear === 'Да') return false;
      return true;
    });
  }
  function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function updateCounts() {
    $('#totalCount').textContent = entries.filter((p) => !['удалить','отклонено','deleted','exclude'].includes(p.status.toLowerCase())).length;
    const size = eligible().length;
    $('#poolCount').textContent = `${size} В РУЛЕТКЕ`;
    $('#spinButton').disabled = spinning || size === 0;
    if (size === 0) $('#slotMain').textContent = 'В ЭТОМ РЕЖИМЕ НЕТ ПРОМПТОВ';
    else if (!spinning && !current && $('#slotMain').textContent === 'В ЭТОМ РЕЖИМЕ НЕТ ПРОМПТОВ') $('#slotMain').textContent = 'ОСТАЛОСЬ ТОЛЬКО ПОВЕРИТЬ В ЧУДО';
  }
  function showToast(message) {
    const node = $('#toast'); node.textContent = message; node.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => node.classList.remove('show'), 3100);
  }
  function showSlot(p, pool) {
    $('#slotPrev').textContent = randomItem(pool).phrase;
    $('#slotMain').textContent = p.phrase;
    $('#slotNext').textContent = randomItem(pool).phrase;
  }
  function setLevel(next) {
    if (spinning) return;
    level = next;
    $$('.level').forEach((b) => { const selected = Number(b.dataset.level) === level; b.classList.toggle('selected', selected); b.setAttribute('aria-pressed', String(selected)); });
    updateCounts();
  }
  function chooseWinner(pool) {
    const fresh = pool.filter((p) => !recent.includes(p.id));
    const choices = fresh.length ? fresh : pool;
    return randomItem(choices);
  }
  function spin() {
    if (spinning) return;
    const pool = eligible(); if (!pool.length) { showToast('В этом режиме пока пусто. Выбери другой уровень.'); return; }
    spinning = true; updateCounts();
    $('#spinButton').innerHTML = '<span>⏳</span> ПОИСК ГЕНИАЛЬНОГО ПРОМПТА...';
    $('#machineStatus').textContent = '◌ PROCESSING';
    $('#spinNote').textContent = 'НЕРВЫ ОБРАБАТЫВАЮТСЯ...';
    $('#slotMachine').setAttribute('aria-busy', 'true');
    $('#slotMachine').classList.add('is-spinning');
    $('#resultSection').classList.add('is-hidden');
    const winner = chooseWinner(pool);
    let step = 0;
    const total = reducedMotion ? 1 : 27;
    const roll = () => {
      step++;
      showSlot(step === total ? winner : randomItem(pool), pool);
      if (step >= total) {
        spinning = false; current = winner;
        recent.push(winner.id); if (recent.length > 12) recent.shift();
        $('#slotMachine').classList.remove('is-spinning');
        $('#slotMachine').setAttribute('aria-busy','false');
        $('#spinButton').textContent = '⚡ КРУТАНУТЬ ЕЩЁ РАЗ ↗';
        $('#machineStatus').textContent = '● PROMPT FOUND';
        $('#spinNote').textContent = `ПРОМПТ ${winner.id}`;
        updateCounts();
        renderResult(winner);
      } else {
        const t = step / total;
        const delay = 39 + 220 * Math.pow(t, 2.5);
        window.setTimeout(roll, delay);
      }
    };
    roll();
  }
  function getScore(p) {
    const base = p.level === 1 ? 22 : p.level === 2 ? 57 : 88;
    const hash = Array.from(p.id).reduce((n,c) => n * 31 + c.charCodeAt(0),0);
    return Math.min(100, base + Math.abs(hash % 13));
  }
  function renderResult(p) {
    $('#resultId').textContent = `№ ${p.id}`;
    $('#cardCategory').textContent = p.category.toUpperCase();
    $('#quoteText').textContent = `«${p.phrase}»`;
    $('#recommendationText').textContent = p.recommendation.replace(/[.?!]+$/, '');
    const score = getScore(p);
    $('#despairScore').textContent = score;
    $('#progressFill').style.width = `${score}%`;
    $('#scoreNote').textContent = score < 40 ? 'Пока ещё есть шанс договориться по-хорошему. Не упусти его.' : score < 85 ? 'Стадия: ты уже разговариваешь с нейросетью как с коллегой.' : 'Поздняя стадия. Предлагаем выключить ноутбук и потрогать траву.';
    $('#resultSection').classList.remove('is-hidden');
    window.setTimeout(() => $('#resultSection').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block:'start' }), 110);
  }
  async function copyPrompt() {
    if (!current) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API is unavailable');
      await navigator.clipboard.writeText(current.phrase);
      showToast('Промпт скопирован. Нейросеть уже нервничает.');
    } catch {
      const t = document.createElement('textarea'); t.value = current.phrase;
      t.style.position = 'fixed'; t.style.opacity = '0'; document.body.append(t); t.focus(); t.select();
      const ok = document.execCommand('copy'); t.remove();
      showToast(ok ? 'Промпт скопирован!' : 'Не получилось скопировать. Выдели фразу вручную.');
    }
  }
  function wrapText(ctx, text, maxWidth) {
    const lines = []; let line = '';
    for (const word of String(text).split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; }
      else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }
  function drawRoundRect(ctx,x,y,w,h,r,fill) {
    ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();
  }
  function storyCanvas(p) {
    const canvas = document.createElement('canvas'); canvas.width=1080;canvas.height=1920;
    const ctx = canvas.getContext('2d');
    const ink='#15151b',yellow='#f7db45',cream='#f2f0e9';
    ctx.fillStyle='#111117';ctx.fillRect(0,0,1080,1920);
    ctx.fillStyle=yellow;ctx.fillRect(0,0,1080,24);
    ctx.fillStyle=cream;ctx.font='900 106px Arial, sans-serif';ctx.fillText('ПРОМПТЕЦ',82,169);
    ctx.fillStyle=yellow;ctx.fillRect(938,102,28,28);
    ctx.fillStyle='#b4b5c3';ctx.font='700 25px "Courier New",monospace';ctx.fillText('ПОСЛЕДНИЙ АРГУМЕНТ В РАЗГОВОРЕ С ИИ',82,229);
    drawRoundRect(ctx,70,305,940,1100,28,cream);
    ctx.fillStyle=ink;ctx.font='800 30px "Courier New",monospace';ctx.fillText('ВАШ ПРОМПТ ДНЯ',120,390);
    ctx.font='700 27px "Courier New",monospace';ctx.fillStyle='#66666a';ctx.fillText(`#${p.id} / ${p.category.toUpperCase().slice(0,28)}`,120,444);
    const phrase=`«${p.phrase}»`;let size=90,lines=[];
    do{ctx.font=`900 ${size}px Arial,sans-serif`;lines=wrapText(ctx,phrase,820);if(lines.length*size*1.15<=650)break;size-=4}while(size>40);
    const lineHeight=size*1.14;ctx.fillStyle=ink;
    let y=740-(lines.length*lineHeight)/2;
    for(const line of lines){ctx.fillText(line,116,y);y+=lineHeight;}
    ctx.fillStyle='#c8a30a';ctx.fillRect(120,1118,8,180);
    ctx.fillStyle=ink;ctx.font='800 26px "Courier New",monospace';ctx.fillText('РЕКОМЕНДУЕТСЯ ПРИМЕНЯТЬ:',155,1162);
    ctx.fillStyle='#313138';ctx.font='37px Arial,sans-serif';
    const recLines=wrapText(ctx,p.recommendation.replace(/[.?!]+$/,''),780).slice(0,4);
    let recY=1224;for(const line of recLines){ctx.fillText(line,155,recY);recY+=49;}
    ctx.fillStyle=yellow;ctx.font='900 39px "Courier New",monospace';ctx.fillText('ИНДЕКС ОТЧАЯНИЯ',86,1528);
    ctx.fillStyle=cream;ctx.font='900 176px Arial,sans-serif';ctx.fillText(String(getScore(p)),75,1732);
    ctx.fillStyle='#9799a5';ctx.font='700 48px "Courier New",monospace';ctx.fillText('/100',340,1710);
    ctx.fillStyle='#555662';ctx.fillRect(86,1770,906,14);ctx.fillStyle='#f18394';ctx.fillRect(86,1770,906*getScore(p)/100,14);
    ctx.fillStyle='#9697a5';ctx.font='700 26px "Courier New",monospace';ctx.fillText('НАУЧНО НЕ ДОКАЗАНО. ЭМОЦИОНАЛЬНО ПОНЯТНО.',86,1842);
    return canvas;
  }
  async function storyBlob(p) {
    return await new Promise((resolve,reject)=>storyCanvas(p).toBlob((blob)=>blob?resolve(blob):reject(new Error('PNG не создан')),'image/png'));
  }
  function saveBlob(blob,name) {
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
  async function downloadStory() {
    if(!current)return;
    try{saveBlob(await storyBlob(current),`promptets-story-${current.id}.png`);showToast('PNG-карточка сохранена. Сторис ждут!');}
    catch(e){console.error(e);showToast('Не удалось создать PNG. Попробуй другой браузер.');}
  }
  async function shareStory() {
    if(!current)return;
    try {
      const blob=await storyBlob(current);
      const file=new File([blob],`promptets-story-${current.id}.png`,{type:'image/png'});
      if(navigator.share && navigator.canShare?.({files:[file]})) {
        try {await navigator.share({files:[file],title:'ПРОМПТЕЦ: мой промпт дня',text:'Мой промпт дня. Последний аргумент в разговоре с ИИ.'});}
        catch(e){if(e.name!=='AbortError')throw e;}
      }else{saveBlob(blob,file.name);showToast('Карточка скачана. Открой Instagram и добавь PNG в сторис.');}
    } catch (e) {console.error(e);showToast('Поделиться не вышло. Используй кнопку скачивания.');}
  }
  function parseCSV(text) {
    text=String(text).replace(/^\uFEFF/,'');
    const first=text.split(/\r?\n/,1)[0];
    const tabs=(first.match(/\t/g)||[]).length,semis=(first.match(/;/g)||[]).length,commas=(first.match(/,/g)||[]).length;
    const delim=tabs>semis&&tabs>commas?'\t':semis>commas?';':',';
    const rows=[];let row=[],cell='',quoted=false;
    for(let i=0;i<text.length;i++){
      const ch=text[i];
      if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
      else if(ch===delim&&!quoted){row.push(cell);cell='';}
      else if((ch==='\r'||ch==='\n')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';}
      else cell+=ch;
    }
    if(quoted)throw new Error('Незакрытая кавычка в CSV');
    row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
    if(rows.length<2)throw new Error('CSV должен содержать заголовки и хотя бы одну запись');
    const keys=rows.shift().map(x=>x.trim().toLowerCase());
    return rows.map(values=>Object.fromEntries(keys.map((key,i)=>[key,values[i]||''])));
  }
  async function importFile(file) {
    if(!file)return;
    try{
      const text=await file.text(); const raw=file.name.toLowerCase().endsWith('.json')?JSON.parse(text):parseCSV(text);
      if(!Array.isArray(raw))throw new Error('База должна быть массивом объектов');
      const cleaned=raw.map(normalize).filter(Boolean);
      if(!cleaned.length)throw new Error('В файле нет колонки phrase с заполненными фразами');
      entries=cleaned;recent=[];current=null;
      $('#resultSection').classList.add('is-hidden');
      $('#slotMain').textContent='НОВАЯ БАЗА ГОТОВА. КРУТИ!';
      $('#slotPrev').textContent='Свежая порция отчаяния';$('#slotNext').textContent='Редактура творит чудеса';
      updateCounts();
      $('#importStatus').textContent=`Импортировано ${cleaned.length} строк. Активны ${entries.filter(p=>!['удалить','отклонено','deleted','exclude'].includes(p.status.toLowerCase())).length}. Только для текущей вкладки.`;
      showToast(`Загружено ${cleaned.length} промптов. Можно крутить!`);
    }catch(e){console.error(e);showToast('Ошибка импорта: '+e.message);}
    finally{$('#dbFile').value='';}
  }
  function exportJSON() {
    saveBlob(new Blob([JSON.stringify(entries,null,2)],{type:'application/json;charset=utf-8'}),'prompts-edited.json');
    showToast('JSON экспортирован. Для публикации обнови prompts-data.js.');
  }
  $$('.level').forEach((btn)=>btn.addEventListener('click',()=>setLevel(Number(btn.dataset.level))));
  $('#cleanMode').addEventListener('change',(e)=>{clean=e.target.checked;updateCounts();});
  $('#spinButton').addEventListener('click',spin);
  $('#againButton').addEventListener('click',()=>{document.getElementById('generator').scrollIntoView({behavior:reducedMotion?'auto':'smooth',block:'center'});spin();});
  $('#copyButton').addEventListener('click',copyPrompt);
  $('#downloadButton').addEventListener('click',downloadStory);
  $('#shareButton').addEventListener('click',shareStory);
  $('#dbFile').addEventListener('change',(e)=>importFile(e.target.files?.[0]));
  $('#exportButton').addEventListener('click',exportJSON);
  updateCounts();
})();
