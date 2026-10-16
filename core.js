(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.VocabCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 1;
  const DAY = 86400000;
  const intervals = [1, 3, 7, 14, 30, 60, 120];
  function dayKey(date = new Date()) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  }
  function addDays(day, n) { return new Date(Date.parse(day + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10); }
  function fresh() { return { version: VERSION, settings: { dailyNew: 25, examDate: '2026-10-22', scope: 'core' }, words: {}, days: {} }; }
  function validate(raw, validIds) {
    if (!raw || raw.version !== VERSION || typeof raw.words !== 'object' || !raw.words || Array.isArray(raw.words) || typeof raw.days !== 'object' || !raw.days || Array.isArray(raw.days)) throw new Error('备份格式不正确');
    const ids = new Set(validIds);
    const dateOK = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Date.parse(d + 'T00:00:00Z')) && new Date(d + 'T00:00:00Z').toISOString().slice(0, 10) === d;
    const result = fresh();
    const st = raw.settings;
    if (!st || !Number.isInteger(st.dailyNew) || st.dailyNew < 1 || st.dailyNew > 200 || !['core','all'].includes(st.scope) || !dateOK(st.examDate)) throw new Error('学习设置不正确');
    result.settings = { dailyNew: st.dailyNew, scope: st.scope, examDate: st.examDate };
    for (const [id, w] of Object.entries(raw.words)) {
      if (!ids.has(id) || !w || !Number.isInteger(w.stage) || w.stage < 0 || w.stage > 7 || !Number.isInteger(w.reps) || w.reps < 1 || !Number.isInteger(w.lapses) || w.lapses < 0 || !dateOK(w.introduced) || !dateOK(w.lastDay) || !Number.isFinite(w.due)) throw new Error('单词记录不正确');
      result.words[id] = { stage: w.stage, reps: w.reps, lapses: w.lapses, introduced: w.introduced, lastDay: w.lastDay, due: w.due, lastRating: ['again','hard','good','easy'].includes(w.lastRating) ? w.lastRating : 'good' };
    }
    for (const [d, log] of Object.entries(raw.days)) {
      if (!dateOK(d) || !log || !Array.isArray(log.newIds) || !Array.isArray(log.reviewIds) || !Number.isInteger(log.answers) || log.answers < 0 || [...log.newIds, ...log.reviewIds].some(id => !ids.has(id))) throw new Error('每日记录不正确');
      result.days[d] = { newIds: [...new Set(log.newIds)], reviewIds: [...new Set(log.reviewIds)], answers: log.answers };
    }
    return result;
  }
  function queues(state, vocab, now = new Date()) {
    const today = dayKey(now), log = state.days[today] || { newIds: [], reviewIds: [], answers: 0 };
    const sorted = [...vocab].sort((a,b) => Number(b.core) - Number(a.core) || a.rank - b.rank);
    const eligible = sorted.filter(w => !state.words[w.id] && (state.settings.scope === 'all' || w.core));
    const newWords = eligible.slice(0, Math.max(0, state.settings.dailyNew - log.newIds.length));
    // Reviews always include every learned category, regardless of the new-word scope.
    const reviewWords = sorted.filter(w => state.words[w.id] && state.words[w.id].due <= now.getTime()).sort((a,b) => state.words[a.id].due - state.words[b.id].due);
    const waiting = sorted.filter(w => state.words[w.id] && state.words[w.id].stage === 0 && state.words[w.id].lastDay === today && state.words[w.id].due > now.getTime());
    return { today, log, newWords, reviewWords, waiting, remainingUnseen: eligible.length };
  }
  function rate(state, id, rating, now = new Date()) {
    if (!['again','hard','good','easy'].includes(rating)) throw new Error('未知评分');
    const next = JSON.parse(JSON.stringify(state)), today = dayKey(now);
    const old = next.words[id], first = !old;
    const w = old || { stage: 0, reps: 0, lapses: 0, introduced: today };
    const log = next.days[today] || { newIds: [], reviewIds: [], answers: 0 };
    if (first && !log.newIds.includes(id)) log.newIds.push(id);
    if (!first && w.introduced !== today && !log.reviewIds.includes(id)) log.reviewIds.push(id);
    log.answers += 1;
    w.reps += 1; w.lastDay = today; w.lastRating = rating;
    if (rating === 'again') { w.stage = 0; w.lapses += 1; w.due = now.getTime() + 10 * 60000; }
    else if (rating === 'hard') { w.stage = Math.max(1, w.stage); w.due = Date.parse(addDays(today, 1) + 'T04:00:00+08:00'); }
    else {
      // A word cannot skip multiple learning stages through repeated same-day clicks.
      const step = rating === 'easy' ? 2 : 1;
      const previous = state.words[id];
      const nextStage = first || previous.stage === 0 ? step : previous.stage + (previous.lastDay === today ? 0 : step);
      w.stage = Math.min(7, Math.max(1, nextStage));
      w.due = Date.parse(addDays(today, intervals[w.stage - 1]) + 'T04:00:00+08:00');
    }
    next.words[id] = w; next.days[today] = log;
    return next;
  }
  function streak(state, today = dayKey()) {
    let d = today, n = 0;
    if (!state.days[d]?.answers) d = addDays(d, -1);
    while (state.days[d]?.answers) { n++; d = addDays(d,-1); }
    return n;
  }
  return { VERSION, dayKey, addDays, fresh, validate, queues, rate, streak };
});
