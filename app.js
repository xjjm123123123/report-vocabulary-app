(() => {
  'use strict';
  const C = window.VocabCore, vocab = window.REPORT_VOCABULARY;
  const pronunciations = window.REPORT_PRONUNCIATIONS || {};
  let audioPlayer = null, audioButton = null, audioTimer = null, playbackId = 0;
  const byId = new Map(vocab.map(w => [w.id,w])), ids = vocab.map(w => w.id);
  const KEY = 'report-vocabulary-v1', DRAFT = 'report-writing-draft-v1';
  const main = document.getElementById('main');
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let state = C.fresh(), storageIssue = '', view = 'today', session = null, detail = null;
  let filter = { search:'', category:'all', status:'all', page:1 }, pendingImport = null, toastTimer, minuteTimer;
  try { const saved = localStorage.getItem(KEY); if (saved) state = C.validate(JSON.parse(saved), ids); }
  catch (error) { storageIssue = '学习记录暂时无法读取。当前可继续学习，请导出备份以免丢失。'; }
  function persist(next) {
    state = next;
    try { localStorage.setItem(KEY, JSON.stringify(state)); storageIssue = ''; }
    catch(error) { storageIssue = '浏览器未能保存记录。请立即导出备份，避免关闭页面后丢失。'; toast(storageIssue); }
  }
  function toast(message) { const el=document.getElementById('toast'); el.textContent=message; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('visible'),4000); }
  function dateDisplay(d) { return new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'long',day:'numeric',weekday:'long'}).format(d); }
  function daysToExam() { return Math.round((Date.parse(state.settings.examDate+'T00:00:00Z')-Date.parse(C.dayKey()+'T00:00:00Z'))/86400000); }
  function top(title,subtitle,eyebrow='REPORT VOCABULARY') {
    return `${storageIssue?`<div class="save-warning" role="alert">${esc(storageIssue)} <button class="text-button" data-action="export">导出备份</button></div>`:''}<div class="topbar"><span>你的学术英语学习空间</span><span class="streak-dot">连续学习 ${C.streak(state)} 天</span></div><div class="heading-row"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${subtitle}</p></div><div class="date-label">${dateDisplay(new Date())}</div></div>`;
  }
  function updateNav(){
    document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
    const q=C.queues(state,vocab); document.getElementById('today-count').textContent=q.newWords.length+q.reviewWords.length || '';
  }
  function render(){stopAudio();updateNav();if(session){renderSession();return;} if(detail){renderDetail();return;} ({today:renderToday,library:renderLibrary,mistakes:renderLibrary,writing:renderWriting,settings:renderSettings}[view]||renderToday)();}
  function navigate(next){view=next;session=null;detail=null;filter.page=1;render();window.scrollTo({top:0});}
  function renderToday(){
    const q=C.queues(state,vocab), learned=Object.keys(state.words).length, coreLearned=vocab.filter(w=>w.core&&state.words[w.id]).length;
    const days=daysToExam(), countdown=days>0?days:days===0?'今天':'已过';
    const waiting=q.waiting.length;
    main.innerHTML=top('今天，积累一点表达力。','先复习，再学新词。把每个单词放进你的报告里。')+`
    <section class="hero"><div><div class="hero-tag">REPORT WRITING · 考试准备</div><h2>认识词义，更要会写一句话。</h2><p>词库共1000词，优先学习150个考试核心词。默认每天25个新词，学完核心词后可在设置中继续完整词库。</p></div><div class="countdown"><strong>${countdown}</strong><span>${days>0?'天后考试':days===0?'考试日':'可调整考试日期'}</span></div></section>
    <section class="stats" aria-label="学习统计">
    <div class="stat"><div class="stat-label">今天已学新词</div><div class="stat-number">${q.log.newIds.length}<small>/ ${state.settings.dailyNew}</small></div><div class="stat-sub">完成认词与拼写检测</div></div>
    <div class="stat"><div class="stat-label">今天已复习</div><div class="stat-number">${q.log.reviewIds.length}<small>词</small></div><div class="stat-sub">按不同单词计数</div></div>
    <div class="stat"><div class="stat-label">考试核心词</div><div class="stat-number">${coreLearned}<small>/ 150</small></div><div class="stat-sub">${150-coreLearned} 个尚未学习</div></div>
    <div class="stat"><div class="stat-label">累计学过</div><div class="stat-number">${learned}<small>/ 1000</small></div><div class="stat-sub">学过后仍需定期复习</div></div></section>
    <div class="section-head"><h2>今日学习</h2><span>${state.settings.scope==='core'?'考试核心词优先':'完整词库 · 核心词优先'}</span></div>
    <section class="study-grid"><article class="study-tile"><div class="tile-label">DAILY REVIEW <span>01</span></div><div class="tile-count"><strong>${q.reviewWords.length}</strong><span>个词待复习</span></div><p>${q.reviewWords.length?'这些词已到复习时间。先判断是否认识，再看中文检测拼写。':waiting?`${waiting} 个没记住的词将在10分钟后再次出现。`:'暂时没有到期复习词，已学词会在后续日期自动出现。'}</p><button class="button review-btn wide" data-action="start-review" ${q.reviewWords.length?'':'disabled'}>开始复习 <span>↗</span></button></article>
    <article class="study-tile"><div class="tile-label">NEW WORDS <span>02</span></div><div class="tile-count"><strong>${q.newWords.length}</strong><span>个新词待学习</span></div><p>${q.newWords.length?'先判断是否认识，再检测拼写。不认识的词先学释义、搭配和例句。':q.remainingUnseen===0&&state.settings.scope==='core'?'核心词已全部学过。可以在设置里开启完整1000词。':'今日新词计划已完成，继续用这些词写几句话。'}</p><button class="button primary wide" data-action="start-new" ${q.newWords.length?'':'disabled'}>学习新词 <span>↗</span></button></article></section>
    <section class="lower-grid"><div><div class="section-head"><h2>最近7天</h2><span>新词 + 复习词</span></div><div class="week-chart">${weekChart(q.today)}</div></div><div class="writing-tip"><div class="section-head"><h2>今天的一组表达</h2><button class="text-button" data-view="writing">去写一句 ↗</button></div><div class="phrase">evaluate evidence</div><p>评估证据<br>Researchers evaluate evidence before drawing conclusions.</p></div></section>
    <p class="footnote">复习间隔随记忆评分变化：1、3、7、14、30天及以后。没记住的词10分钟后重试。每日统计按北京时间更新。${waiting?`当前有 ${waiting} 个词等待再次复习。`:''}</p>`;
  }
  function weekChart(today){const counts=Array.from({length:7},(_,i)=>{const d=C.addDays(today,i-6),l=state.days[d];return{d,n:l?l.newIds.length+l.reviewIds.length:0};});const max=Math.max(5,...counts.map(c=>c.n));return counts.map(c=>`<div class="day-column ${c.d===today?'current':''}"><div class="num">${c.n||''}</div><div class="day-bar" style="height:${Math.max(4,c.n/max*64)}px"></div><span>${c.d===today?'今天':`${Number(c.d.slice(5,7))}/${Number(c.d.slice(8))}`}</span></div>`).join('');}
  function resetCard(s){
    Object.assign(s,{phase:'recognize',recognition:null,answer:'',correct:false,firstCorrect:null,firstAnswer:'',retried:false});
  }
  function startSession(kind){
    const q=C.queues(state,vocab), list=kind==='new'?q.newWords:q.reviewWords;
    if(!list.length){toast(kind==='new'?'今日暂无待学新词':'暂时没有到期复习词');render();return;}
    detail=null;session={kind,ids:list.map(w=>w.id),index:0,undo:null};resetCard(session);renderSession();
  }
  function wordHeading(w){
    const pronunciation=pronunciations[w.id];
    const audioRow=(accent,label)=>`<div class="pronunciation-row"><span class="accent-label">${label}</span><span class="ipa" lang="en">${esc(pronunciation?.[accent]||'暂未收录')}</span><button class="pronunciation-button" data-action="speak" data-id="${esc(w.id)}" data-accent="${accent}" data-speed="normal" aria-label="播放${label}${esc(w.word)}发音">▶ <span>发音</span></button><button class="pronunciation-button slow" data-action="speak" data-id="${esc(w.id)}" data-accent="${accent}" data-speed="slow" aria-label="慢速播放${label}${esc(w.word)}发音">慢速</button></div>`;
    return `<div class="word-title">${esc(w.word)}</div><div class="word-pos">${w.pos}</div><div class="pronunciation-block">${audioRow('uk','英式')}${audioRow('us','美式')}</div>${pronunciation?.speechText?'<div class="pronunciation-note">按当前词性读音；多读音词会结合简短语境朗读。</div>':''}`;
  }
  function renderSession(){
    stopAudio();
    const s=session,done=s.index>=s.ids.length;
    if(done){
      const q=C.queues(state,vocab);
      main.innerHTML=top('这一轮，完成了。','停下来回想一下：今天哪些词可以写进你的报告？')+`<div class="empty-state" style="margin-top:35px"><div class="eyebrow">SESSION COMPLETE</div><h2>完成 ${s.ids.length} 个${s.kind==='new'?'新词':'复习词'}</h2><p>认词与首轮拼写结果已保存，复习时间已自动安排。${q.waiting.length?`还有 ${q.waiting.length} 个词需要再练，10分钟后可再次复习。`:''}下次用同一个浏览器打开，就能继续学习。</p><button class="button primary" data-action="exit-session">返回今日学习</button> <button class="button secondary" data-view="writing">用新词写一句</button>${s.undo?'<div><button class="text-button" data-action="undo">撤销上一个词的记录</button></div>':''}</div>`;return;
    }
    const w=byId.get(s.ids[s.index]);
    const recognizing=s.phase==='recognize',studying=s.phase==='study',spelling=s.phase==='spell',result=s.phase==='result';
    let card='',actions='',hint='';
    if(recognizing){
      card=wordHeading(w)+'<div class="hidden-hint">能回忆它的中文意思吗？先判断是否认识。</div>';
      actions=`<div class="recognition-actions"><button class="rating again" data-recognition="unknown">不认识<small>先学释义与搭配 · 1</small></button><button class="rating hard" data-recognition="unsure">不确定<small>先核对意思 · 2</small></button><button class="rating good" data-recognition="known">认识<small>下一步检测拼写 · 3</small></button></div>`;
      hint='按 1 / 2 / 3 判断是否认识，之后再检测拼写';
    }else if(studying){
      card=wordHeading(w)+answerMarkup(w);
      actions='<div class="reveal-area"><button class="button primary" data-action="start-spelling">学好了，检测拼写 ↵</button></div>';
      hint='先读释义、搭配和例句。下一步会隐藏英文，只显示中文';
    }else if(spelling){
      card=`<div class="meaning">${esc(w.meaning)}</div><div class="word-pos">${w.pos}</div><div class="hidden-hint">根据中文，写出刚才那个英文单词。</div><form id="spelling-form"><input class="spelling-input" id="spell-input" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="输入英文单词" placeholder="输入英文单词" value="${esc(s.answer)}"><button class="button primary" type="submit">核对拼写 ↵</button></form>${s.recognition==='known'?'<button class="text-button meaning-correction" data-action="meaning-unknown">这个释义我没想起来，先学习</button>':''}`;
      actions='<div class="reveal-area"><button class="text-button" data-action="cannot-spell">不会拼写，查看答案</button></div>';
      hint='英文、音标、搭配和例句已隐藏。输入后按 Enter 核对拼写';
    }else if(result){
      const firstWrong=s.firstCorrect===false, recognitionLabel={known:'认识',unsure:'不确定',unknown:'不认识'}[s.recognition];
      const assessment={recognition:s.recognition,spellingCorrect:s.firstCorrect};
      const next=C.assessAndRate(state,w.id,assessment);const due=next.words[w.id].due;
      const interval=next.words[w.id].lastRating==='again'?'10分钟后':`${Math.round((Date.parse(C.dayKey(new Date(due))+'T00:00:00Z')-Date.parse(C.dayKey()+'T00:00:00Z'))/86400000)}天后`;
      card=`<div class="result-banner ${s.correct?'correct':'incorrect'}">${s.correct?'✓ 拼写正确':s.answer?'拼写需要再练':'还不会拼写'}<span>认词判断：${recognitionLabel}${s.retried?' · 首轮'+(firstWrong?'未拼对':'拼写正确'):''}</span></div>`+wordHeading(w)+answerMarkup(w)+(!s.correct?`<div class="spell-feedback">${s.answer?'你的输入：'+esc(s.answer):'下次先回忆，再试着写出来。'}</div>`:'');
      actions=`<div class="result-actions">${!s.correct?'<button class="button secondary" data-action="retry-spelling">再练一次拼写</button>':''}<button class="button primary" data-action="complete-word">${s.index+1===s.ids.length?'完成这一轮':'保存并学习下一个'} ↵</button></div><p class="review-plan">${interval}复习${firstWrong?'。首轮没拼对，纠正后仍安排一次短期复习。':s.recognition!=='known'?'。刚学会的词先在短期内巩固。':'。会认也会拼，按正常间隔巩固。'}</p>`;
      hint='按 Enter 保存当前词并继续。需要修改判断时，可撤销上一个词';
    }
    const title=s.kind==='new'?'每日新词':'到期复习';
    main.innerHTML=top(title,'先判断认不认识，再检测会不会拼写。')+`
    <div class="session-top"><button class="back-button" data-action="exit-session">← 返回今日学习</button><span>第 ${s.index+1} / ${s.ids.length} 个词</span>${s.undo?'<button class="text-button" data-action="undo">撤销上一个词</button>':'<span></span>'}</div>
    <div class="progress-track"><div class="progress-fill" style="width:${s.index/s.ids.length*100}%"></div></div>
    <ol class="learning-steps" aria-label="学习步骤"><li ${recognizing?'aria-current="step"':''}>① 判断是否认识</li><li ${spelling?'aria-current="step"':''}>② 检测拼写</li><li ${result?'aria-current="step"':''}>③ 查看结果</li></ol>
    ${studying?'<p class="stage-message">先学习这个词，再检测拼写</p>':''}
    <article class="flashcard" data-phase="${s.phase}" aria-live="polite"><div class="word-meta">${esc(w.category)} ${w.core?' · 考试核心':''}</div>${card}</article>
    ${actions}<p class="keyboard-hint">${hint}</p>`;
    if(spelling)document.getElementById('spell-input').focus();
  }
  function answerMarkup(w){return `<div class="meaning">${esc(w.meaning)}</div><div class="collocation"><span>常用搭配</span><strong>${esc(w.collocation)}</strong></div><div class="example">${esc(w.example)}</div>${w.translation?`<div class="translation">${esc(w.translation)}</div>`:''}${!w.core?'<div class="example-note">搭配示例句：试着换成你的报告主题再写一遍。</div>':''}`;}
  function recognize(value){
    if(!session||session.phase!=='recognize'||!['known','unsure','unknown'].includes(value))return;
    session.recognition=value;session.phase=value==='known'?'spell':'study';renderSession();
  }
  function startSpelling(){if(!session||session.phase!=='study')return;session.phase='spell';session.answer='';renderSession();}
  function checkSpelling(skip=false){
    if(!session||session.phase!=='spell')return;
    const s=session,w=byId.get(s.ids[s.index]);
    s.answer=skip?'':document.getElementById('spell-input')?.value.trim()||'';
    if(!skip&&!s.answer){toast('请输入英文单词，或选择“不会拼写，查看答案”');return;}
    s.correct=!skip&&s.answer.toLowerCase()===w.word.toLowerCase();
    if(s.firstCorrect===null){s.firstCorrect=s.correct;s.firstAnswer=s.answer;}
    s.phase='result';renderSession();
  }
  function completeWord(){
    if(!session||session.phase!=='result')return;
    const s=session,id=s.ids[s.index];s.undo={state:JSON.parse(JSON.stringify(state)),index:s.index};
    persist(C.assessAndRate(state,id,{recognition:s.recognition,spellingCorrect:s.firstCorrect}));
    s.index++;resetCard(s);updateNav();renderSession();
  }
  function retrySpelling(){if(!session||session.phase!=='result')return;session.phase='spell';session.answer='';session.retried=true;renderSession();}
  function meaningUnknown(){if(!session||session.phase!=='spell')return;session.recognition='unknown';session.phase='study';session.answer='';renderSession();}
  function undo(){if(!session?.undo)return;const u=session.undo;persist(u.state);session.index=u.index;resetCard(session);session.undo=null;render();toast('已撤销上一个词的学习记录');}
  function statusMarkup(w){const x=state.words[w.id];if(!x)return '<span class="status">未学习</span>';if(x.due<=Date.now())return '<span class="status due">待复习</span>';if(x.stage>=4)return '<span class="status known">逐渐巩固</span>';return `<span class="status">${C.dayKey(new Date(x.due)).slice(5)} 复习</span>`;}
  function renderLibrary(){
    const mistakes=view==='mistakes';
    const categories=[...new Set(vocab.map(w=>w.category))];
    let list=vocab.filter(w=>!mistakes||state.words[w.id]?.lapses>0||state.words[w.id]?.lastRating==='hard');
    if(filter.search){const query=filter.search.toLowerCase();list=list.filter(w=>[w.word,w.meaning,w.collocation,w.category].some(s=>s.toLowerCase().includes(query)));}
    if(filter.category!=='all')list=list.filter(w=>w.category===filter.category);
    if(filter.status==='core')list=list.filter(w=>w.core);
    if(filter.status==='unseen')list=list.filter(w=>!state.words[w.id]);
    if(filter.status==='learned')list=list.filter(w=>state.words[w.id]);
    if(filter.status==='due')list=list.filter(w=>state.words[w.id]?.due<=Date.now());
    list.sort((a,b)=>Number(b.core)-Number(a.core)||a.rank-b.rank);
    const total=list.length,pages=Math.max(1,Math.ceil(total/20));filter.page=Math.min(filter.page,pages);
    const shown=list.slice((filter.page-1)*20,filter.page*20);
    main.innerHTML=top(mistakes?'难词，再见一面。':'1000词，围绕你的报告。',mistakes?'记录曾经没记住或觉得困难的词。正常复习仍按到期时间安排。':'20个主题，包含中文释义、常用搭配和英文示例。核心150词另有例句译文。')+`
    <div class="library-controls"><input class="search" id="search" type="search" aria-label="搜索单词、释义或搭配" placeholder="搜索单词、中文或搭配…" value="${esc(filter.search)}"><select id="category-filter" aria-label="按主题筛选"><option value="all">全部主题</option>${categories.map(c=>`<option ${filter.category===c?'selected':''}>${esc(c)}</option>`).join('')}</select><select id="status-filter" aria-label="按状态筛选">${[['all','全部单词'],['core','考试核心150词'],['unseen','尚未学习'],['learned','已经学过'],['due','到期复习']].map(([v,label])=>`<option value="${v}" ${filter.status===v?'selected':''}>${label}</option>`).join('')}</select></div>
    <div class="section-head"><h2>${mistakes?'我的难词':'词汇清单'}</h2><span>找到 ${total} 个词 · 点击查看搭配和例句</span></div>
    <div class="word-table"><table><thead><tr><th>英文单词</th><th>中文释义</th><th class="coll-col">常用搭配</th><th>学习状态</th></tr></thead><tbody>${shown.length?shown.map(w=>`<tr><td><button class="library-word" data-word="${esc(w.id)}">${esc(w.word)}${w.core?'<small>核心</small>':''}</button></td><td>${esc(w.meaning)}</td><td class="coll-col coll">${esc(w.collocation)}</td><td>${statusMarkup(w)}</td></tr>`).join(''):'<tr><td colspan="4" class="empty-row">'+(mistakes?'还没有难词记录。完成学习后，这里会自动更新。':'没有符合条件的单词。')+'</td></tr>'}</tbody></table></div>
    <div class="pagination"><span>第 ${filter.page} / ${pages} 页</span><div><button class="button secondary" data-action="prev-page" ${filter.page<=1?'disabled':''}>上一页</button><button class="button secondary" data-action="next-page" ${filter.page>=pages?'disabled':''}>下一页</button></div></div>
    <p class="footnote">词库按课程主题整理，非老师发布的考试指定词表。150个核心词优先服务定义、分类、特征描述与组成说明。</p>`;
  }
  function renderDetail(){stopAudio();const w=byId.get(detail);main.innerHTML=top('把这个词，放进一句话。','词库浏览不计入每日学习；请在今日学习中完成认词与拼写检测。')+`<div class="session-top"><button class="back-button" data-action="close-detail">← 返回词库</button><span>${statusMarkup(w)}</span></div><article class="flashcard detail-panel"><div class="word-meta">${esc(w.category)} ${w.core?' · 考试核心':''}</div>${wordHeading(w)}${answerMarkup(w)}</article><p class="footnote">浏览后，试着使用“${esc(w.collocation)}”写一句关于大学、科研或小组合作的话。</p>`;}
  function renderSettings(){main.innerHTML=top('每天的节奏，由你调整。','让新词数量与复习时间保持平衡。')+`
    <div class="settings-grid"><section class="settings-panel"><h2>学习计划</h2><form id="settings-form"><div class="form-group"><label for="daily-new">每天新词数</label><input id="daily-new" type="number" min="1" max="200" required value="${state.settings.dailyNew}"><p>建议每天15—30词。默认25词，6个学习日可完成150个核心词的初次学习。</p></div><div class="form-group"><label for="new-scope">新词范围</label><select id="new-scope"><option value="core" ${state.settings.scope==='core'?'selected':''}>先学150个考试核心词</option><option value="all" ${state.settings.scope==='all'?'selected':''}>完整1000词，核心词优先</option></select><p>切换范围不会删除记录，也不会隐藏已经学过的到期复习词。</p></div><div class="form-group"><label for="exam-date">考试日期</label><input id="exam-date" type="date" required value="${state.settings.examDate}"></div><button class="button primary" type="submit">保存学习计划</button></form></section>
    <section class="settings-panel"><h2>复习安排</h2><p>先判断是否认识，再进行拼写检测。系统根据两项结果自动安排复习。</p><div class="schedule-list"><div><strong>首轮不会拼</strong>10分钟后再次出现</div><div><strong>刚学会或不确定</strong>首轮拼对，明天再巩固</div><div><strong>认识且拼对</strong>按1、3、7、14、30、60、120天递进</div><div><strong>分别记录</strong>认词判断与首轮拼写结果</div></div><div class="review-summary">后续日期的复习从北京时间凌晨4点开始到期。翻页浏览不会改变复习时间，重复当天评分不会连续升级。</div></section>
    <section class="settings-panel"><h2>学习记录备份</h2><p>记录保存在当前设备的当前浏览器中。清理浏览器数据、换设备或换浏览器后，请导入备份恢复。</p><div class="backup-actions"><button class="button secondary" data-action="export">导出学习备份</button><button class="button secondary" data-action="import">导入备份</button></div><input type="file" id="import-file" accept="application/json,.json" hidden><p style="margin-top:18px;font-size:11px">备份包含学习计划、每日记录和每个单词的复习时间。写作练习草稿单独保存在本机，不包含在词汇备份里。</p></section>
    <section class="settings-panel"><h2>发音与音标</h2><p>每个词提供英式、美式音标与发音按钮，可选择慢速跟读。音标中的 ˈ 标记主重音，ˌ 标记次重音。</p><p style="margin-top:12px">在线音频优先使用词典发音；设备英文语音可作为备用。多读音词结合当前词性朗读。拼写检测时隐藏音标并停止播放。</p></section><section class="settings-panel"><h2>怎么背更适合这门考试</h2><p>① 看英文，判断是否认识。<br>② 不认识的词先学释义和搭配。<br>③ 看中文，检测英文拼写。<br>④ 每天用3—5个新词写一个小段落。<br>⑤ 按提示复习，不把“学过”当成“掌握”。</p></section></div>`;}
  const writingGuide = window.REPORT_WRITING_GUIDE;
  function renderWriting(){
    let draft='';try{draft=localStorage.getItem(DRAFT)||'';}catch{}
    main.innerHTML=top('把词汇，变成你的报告。','先看拆题逻辑与共用模版，再动笔练习。')+
      window.ReportWritingUI.render(writingGuide)+`<section class="template practice-section" id="report-practice"><h2>写作练习</h2><p>任选一个主题：Research Mindset / An Ideal University / An Ideal Project Group。先列 A、B、C，再展开解释与例子。课程练习为20分钟、150—200词，正式考试以题面为准。</p><label class="practice-label" for="writing-draft">你的英文报告</label><textarea class="practice-area" id="writing-draft" aria-label="英文写作练习" placeholder="先确定题型，列出三个点，再写你的报告…">${esc(draft)}</textarea><div class="word-counter" id="word-counter">${countWords(draft)} 词 · 自动保存至本机</div><button class="text-button" data-action="download-draft">下载练习文字</button></section><p class="footnote">检查3C：Clear 表达具体，Concise 删除空话，Coherent 信息顺畅承接。定义和一般特征常用一般现在时。</p>`;
  }
  function selectReportType(id){
    if(!writingGuide?.templates.some(t=>t.id===id))return;
    document.querySelectorAll('.guide-type-tab').forEach(b=>{const selected=b.dataset.template===id;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;});
    document.querySelectorAll('.guide-type-panel').forEach(p=>p.hidden=p.id!=='guide-panel-'+id);
  }
  async function copyReportTemplate(id){
    const t=writingGuide?.templates.find(t=>t.id===id);if(!t)return;
    try{await navigator.clipboard.writeText(t.text);toast('模版已复制，粘贴后替换方括号内容');}
    catch{
      const active=document.activeElement,area=document.createElement('textarea');area.value=t.text;area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.focus();area.select();
      let copied=false;try{copied=document.execCommand('copy');}catch{}area.remove();active?.focus();
      if(copied)toast('模版已复制，粘贴后替换方括号内容');else{download(t.english+'_模版.txt',t.text,'text/plain;charset=utf-8');toast('浏览器未能复制，已下载模版文字');}
    }
  }
  function useReportTemplate(id){
    const t=writingGuide?.templates.find(t=>t.id===id),area=document.getElementById('writing-draft');if(!t||!area)return;
    if(area.value.trim()){toast('练习区已有草稿，请先下载保存；也可以复制模版自行粘贴。');return;}
    area.value=t.text;area.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('report-practice').scrollIntoView({behavior:'smooth',block:'start'});area.focus({preventScroll:true});toast('模版已放入练习区，请替换方括号内容');
  }
  function countWords(text){return(text.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g)||[]).length;}
  function download(name,content,type='application/json'){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function exportBackup(){download(`写作词间_学习备份_${C.dayKey()}.json`,JSON.stringify(state,null,2));toast('已导出学习备份');}
  function stopAudio(){
    playbackId++;clearTimeout(audioTimer);audioTimer=null;
    if(audioPlayer){audioPlayer.pause();audioPlayer.removeAttribute('src');audioPlayer.load();audioPlayer=null;}
    if('speechSynthesis' in window)window.speechSynthesis.cancel();
    if(audioButton){audioButton.classList.remove('is-playing','is-loading');audioButton.removeAttribute('aria-busy');audioButton=null;}
  }
  function speak(id,accent='us',slow=false,button=null){
    const w=byId.get(id);if(!w)return;
    // Do not reveal pronunciation while the learner is recalling spelling.
    if(session?.phase==='spell')return;
    stopAudio();const token=playbackId;audioButton=button;
    const lang=accent==='uk'?'en-GB':'en-US',rate=slow?.65:1;
    const active=()=>token===playbackId;
    const showState=name=>{if(!active()||!audioButton)return;audioButton.classList.remove('is-playing','is-loading');if(name)audioButton.classList.add(name);audioButton.setAttribute('aria-busy',name==='is-loading'?'true':'false');};
    const finish=()=>{if(!active())return;clearTimeout(audioTimer);audioTimer=null;showState(null);audioPlayer=null;audioButton=null;};
    const unavailable=()=>{finish();toast('暂时无法播放发音，请检查网络或设备的英文语音。');};
    const browserSpeech=(onFailure)=>{
      if(!active())return;
      if(!('speechSynthesis' in window)||typeof window.SpeechSynthesisUtterance!=='function'){onFailure();return;}
      clearTimeout(audioTimer);showState('is-loading');
      let failed=false;
      const fail=()=>{if(!active()||failed)return;failed=true;clearTimeout(audioTimer);window.speechSynthesis.cancel();onFailure();};
      const u=new SpeechSynthesisUtterance(pronunciations[id]?.speechText||w.word);u.lang=lang;u.rate=slow?.65:.9;
      const voice=window.speechSynthesis.getVoices().find(v=>v.lang.replace('_','-').toLowerCase()===lang.toLowerCase());if(voice)u.voice=voice;
      u.onstart=()=>{if(!active()||failed)return;clearTimeout(audioTimer);showState('is-playing');};
      u.onend=()=>{if(!failed)finish();};u.onerror=fail;
      audioTimer=setTimeout(fail,5000);
      try{window.speechSynthesis.speak(u);}catch{fail();}
    };
    const dictionaryAudio=(onFailure)=>{
      if(!active())return;
      if(typeof window.Audio!=='function'){onFailure();return;}
      let failed=false;const player=new Audio();audioPlayer=player;player.preload='auto';player.playbackRate=rate;
      const fail=()=>{if(!active()||failed)return;failed=true;clearTimeout(audioTimer);player.pause();player.removeAttribute('src');player.load();if(audioPlayer===player)audioPlayer=null;onFailure();};
      player.onplaying=()=>{if(!active()||failed)return;clearTimeout(audioTimer);showState('is-playing');};
      player.onended=()=>{if(!failed)finish();};player.onerror=fail;
      player.src='https://dict.youdao.com/dictvoice?audio='+encodeURIComponent(w.word)+'&type='+(accent==='uk'?'1':'2');
      showState('is-loading');audioTimer=setTimeout(fail,6000);
      try{const play=player.play();if(play?.catch)play.catch(fail);}catch{fail();}
    };
    // Homographs such as read/record use the course's verb or noun context.
    if(pronunciations[id]?.speechText)browserSpeech(()=>dictionaryAudio(unavailable));
    else dictionaryAudio(()=>browserSpeech(unavailable));
  }
  document.addEventListener('click',event=>{
    const b=event.target.closest('button, a[data-view]');if(!b||b.disabled)return;
    if(b.dataset.view){navigate(b.dataset.view);return;}
    if(b.dataset.word){detail=b.dataset.word;renderDetail();window.scrollTo({top:0});return;}
    if(b.dataset.recognition){recognize(b.dataset.recognition);return;}
    const actions={
      'start-new':()=>startSession('new'),'start-review':()=>startSession('review'),undo,
      'start-spelling':startSpelling,'cannot-spell':()=>checkSpelling(true),'complete-word':completeWord,'retry-spelling':retrySpelling,'meaning-unknown':meaningUnknown,
      'exit-session':()=>navigate('today'),'close-detail':()=>{detail=null;render();},
      'prev-page':()=>{filter.page--;renderLibrary();},'next-page':()=>{filter.page++;renderLibrary();window.scrollTo({top:0});},
      export:exportBackup,import:()=>document.getElementById('import-file').click(),speak:()=>speak(b.dataset.id,b.dataset.accent,b.dataset.speed==='slow',b),
      'select-report-type':()=>selectReportType(b.dataset.template),'copy-report-template':()=>copyReportTemplate(b.dataset.template),'use-report-template':()=>useReportTemplate(b.dataset.template),
      'download-writing-guide':()=>download('三种Report模版使用文档.md',writingGuide.documentMarkdown,'text/markdown;charset=utf-8'),
      'download-draft':()=>download(`Report练习_${C.dayKey()}.txt`,document.getElementById('writing-draft').value,'text/plain;charset=utf-8')
    };actions[b.dataset.action]?.();
  });
  document.addEventListener('input',event=>{
    if(event.target.id==='search'){const start=event.target.selectionStart;filter.search=event.target.value;filter.page=1;renderLibrary();const input=document.getElementById('search');input.focus();try{input.setSelectionRange(start,start);}catch{}}
    if(event.target.id==='writing-draft'){const value=event.target.value;let label='自动保存至本机';try{localStorage.setItem(DRAFT,value);}catch{label='保存失败，请下载练习文字';}document.getElementById('word-counter').textContent=`${countWords(value)} 词 · ${label}`;}
  });
  document.addEventListener('change',async event=>{
    if(event.target.id==='category-filter'){filter.category=event.target.value;filter.page=1;renderLibrary();}
    if(event.target.id==='status-filter'){filter.status=event.target.value;filter.page=1;renderLibrary();}
    if(event.target.id==='import-file'){
      const file=event.target.files?.[0];if(!file)return;
      if(file.size>5000000){toast('备份文件过大，请选择应用导出的JSON备份');event.target.value='';return;}
      try{pendingImport=C.validate(JSON.parse(await file.text()),ids);document.getElementById('confirm-dialog').showModal();}catch{toast('无法导入：文件格式或学习记录不正确，现有记录已保留。');}event.target.value='';
    }
  });
  document.addEventListener('submit',event=>{
    if(event.target.id==='spelling-form'){event.preventDefault();checkSpelling();return;}
    if(event.target.id!=='settings-form')return;event.preventDefault();
    const num=Number(document.getElementById('daily-new').value),exam=document.getElementById('exam-date').value;
    if(!Number.isInteger(num)||num<1||num>200||!exam){toast('请填写有效的新词数量和考试日期');return;}
    const next=JSON.parse(JSON.stringify(state));next.settings={dailyNew:num,scope:document.getElementById('new-scope').value,examDate:exam};
    try{C.validate(next,ids);persist(next);render();toast('学习计划已保存');}catch{toast('请检查日期与学习设置');}
  });
  document.getElementById('cancel-import').onclick=()=>{pendingImport=null;document.getElementById('confirm-dialog').close();};
  document.getElementById('confirm-import').onclick=()=>{if(pendingImport){persist(pendingImport);pendingImport=null;document.getElementById('confirm-dialog').close();navigate('today');toast('备份已导入');}};
  document.getElementById('confirm-dialog').addEventListener('cancel',()=>{pendingImport=null;});
  document.addEventListener('keydown',event=>{
    const tab=event.target.closest('.guide-type-tab');
    if(tab&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
      event.preventDefault();const tabs=[...document.querySelectorAll('.guide-type-tab')],index=tabs.indexOf(tab);
      const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
      selectReportType(tabs[next].dataset.template);tabs[next].focus();return;
    }
    if(!session||session.index>=session.ids.length||event.ctrlKey||event.metaKey||event.altKey)return;
    const editing=['INPUT','TEXTAREA','SELECT','BUTTON'].includes(document.activeElement?.tagName);
    if(editing)return;
    if(session.phase==='recognize'&&['1','2','3'].includes(event.key)){event.preventDefault();recognize(['unknown','unsure','known'][Number(event.key)-1]);}
    else if(event.key==='Enter'||event.key===' '){
      if(session.phase==='study'){event.preventDefault();startSpelling();}
      else if(session.phase==='result'){event.preventDefault();completeWord();}
    }
  });
  window.addEventListener('pagehide',stopAudio);
  window.addEventListener('storage',event=>{if(event.key===KEY&&event.newValue){try{state=C.validate(JSON.parse(event.newValue),ids);session=null;render();toast('已同步另一个页面的学习记录');}catch{}}});
  window.addEventListener('focus',()=>{if(!session&&!detail&&view==='today')renderToday();updateNav();});
  minuteTimer=setInterval(()=>{updateNav();if(!session&&!detail&&view==='today')renderToday();},30000);
  render();
})();
