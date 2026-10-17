(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pattern = value => String(value ?? '').split(/(\[[^\]]+\])/g).filter(Boolean).map(part => part.startsWith('[')
    ? `<span class="template-slot" lang="zh-CN">${esc(part)}</span>`
    : `<span class="template-fixed">${esc(part)}</span>`).join('');
  const colorSlots = source => source.split(/(<[^>]*>)/g).map(part => !part.startsWith('<') && /\[[^\]]+\]/.test(part) ? pattern(part) : part).join('');
  const legend = '<div class="template-legend" aria-label="模版颜色说明"><span><i class="legend-fixed"></i>蓝色：固定英文</span><span><i class="legend-slot"></i>橙色方括号：要填的内容（中文提示）</span></div>';
  window.ReportWritingUI = {
    render(guide) {
      if (!guide) return '<p>写作指南加载失败，请刷新页面。</p>';
      const section = s => `<details class="guide-section" ${s.id==='logic'?'open':''}><summary>${esc(s.title)}</summary><div class="guide-body">${colorSlots(s.html)}</div></details>`;
      const panel = (t, index) => `<article class="guide-type-panel" id="guide-panel-${t.id}" role="tabpanel" aria-labelledby="guide-tab-${t.id}" ${index?'hidden':''}>
        <div class="guide-type-heading"><div><h3>${esc(t.title)}</h3><p>${esc(t.question)}</p></div><span class="hint-tag">${esc(t.english)}</span></div>
        <p class="guide-stage" lang="en">${esc(t.stages)}</p><p>${esc(t.explain)}</p>
        <div class="guide-key-line"><span>这一句决定题型</span><p lang="en">${pattern(t.overview)}</p><small>核心槽位：${esc(t.key)}</small></div>
        <div class="body-strategies">${t.bodyStrategies.map(s=>`<div class="body-strategy"><h4>${esc(s.title)}</h4><p>${esc(s.logic)}</p><p class="body-patterns" lang="en">${pattern(s.patterns)}</p></div>`).join('')}</div>
        <div class="guide-template-heading"><h4>通用填空模版 · 三段独立展开</h4><div class="guide-actions"><button class="button secondary" data-action="copy-report-template" data-template="${t.id}">复制模版</button><button class="button secondary" data-action="use-report-template" data-template="${t.id}">放入练习区 ↓</button></div></div>
        ${legend}<pre class="guide-template-text" lang="en">${pattern(t.text)}</pre><p class="guide-caption">把橙色中文提示换成英文并删掉方括号。三段各写自己的点；不要求作用、反面情境或互相联系。单复数和冠词按题目调整，句数可按字数增减。</p>
        <details class="guide-section"><summary>逐句拆解：固定句式与中文填空说明</summary><div class="guide-body">${legend}<div class="guide-table-wrap"><table class="guide-table"><thead><tr><th>句号</th><th>英文框架</th><th>句子作用</th></tr></thead><tbody>${t.sentences.map(s=>`<tr><td>${s.number}</td><td lang="en">${pattern(s.text)}</td><td>${esc(s.role)}</td></tr>`).join('')}</tbody></table></div></div></details>
        <details class="guide-section"><summary>怎么填：${esc(t.exampleTitle)} 的槽位示范</summary><div class="guide-body"><div class="guide-table-wrap"><table class="guide-table"><thead><tr><th>槽位</th><th>填入内容</th><th>为什么这样填</th></tr></thead><tbody>${t.fills.map(r=>`<tr>${r.map((c,i)=>`<td ${i===1?'lang="en"':''}>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div></details>
        <details class="guide-section"><summary>完整范文 + 中文讲解 · ${esc(t.exampleTitle)} · ${t.exampleWords}词</summary><div class="guide-body"><p class="guide-caption">示范写法，用来理解结构；提交时根据自己的题目与内容重新表达。</p>${t.example.split('\n\n').map((p,i)=>`<div class="guide-example-paragraph"><span class="guide-paragraph-role">第${i+1}段 · ${esc(t.paragraphNotes[i])}</span><p class="guide-example-en" lang="en">${esc(p)}</p><p class="guide-example-zh">${esc(t.translations[i])}</p></div>`).join('')}</div></details>
      </article>`;
      return `<section class="writing-guide" id="report-writing-guide" aria-labelledby="guide-title">
        <div class="guide-intro"><div class="eyebrow">REPORT WRITING · 从读题到成稿</div><h2 id="guide-title">三种通用模版，三段独立展开。</h2><p>蓝色背句式，橙色看中文提示填内容。主体三段各自展开，句式有变化；A、B、C不必互相联系。</p><div class="guide-actions"><a class="button primary" href="#guide-templates">查看三种模版 ↓</a><button class="button secondary" data-action="download-writing-guide">下载详细使用文档</button><a class="text-button" href="#report-practice">去写作练习 ↓</a></div></div>
        ${guide.grammar?`<section class="grammar-guide" id="grammar-guide" aria-labelledby="grammar-title"><details class="guide-section grammar-overview"><summary id="grammar-title">前三课写作语法要点与雷点 · 错例、改法与考前检查</summary><div class="guide-body"><div class="guide-actions"><button class="button secondary" data-action="download-grammar-guide">下载语法与雷点文档</button></div>${guide.grammar.html}</div></details></section>`:''}
        ${guide.sections.slice(0,2).map(section).join('')}
        <details class="guide-section" open><summary>${esc(guide.sections[2].title)}</summary><div class="guide-body">${guide.sections[2].html}${legend}<div class="guide-table-wrap"><table class="guide-table"><thead><tr><th>位置</th><th>作用</th><th>可用表达</th><th>填法</th></tr></thead><tbody>${guide.shared.map(r=>`<tr>${r.map((c,i)=>`<td ${i===2?'lang="en"':''}>${i===2?pattern(c):esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div></details>
        <div class="guide-template-section" id="guide-templates"><div class="section-head"><h2>选择题型，查看通用模版</h2></div><div class="guide-type-tabs" role="tablist" aria-label="报告题型">${guide.templates.map((t,i)=>`<button class="guide-type-tab" id="guide-tab-${t.id}" role="tab" aria-controls="guide-panel-${t.id}" aria-selected="${!i}" tabindex="${i?-1:0}" data-action="select-report-type" data-template="${t.id}"><strong>${esc(t.title)}</strong><span>${esc(t.english)}</span></button>`).join('')}</div>${guide.templates.map(panel).join('')}</div>
        ${guide.sections.slice(3).map(section).join('')}
      </section>`;
    }
  };
})();
