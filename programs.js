/* LVC v9: verified program discovery. All records are already present in HTML. */
(function () {
  'use strict';
  const programs = JSON.parse(document.getElementById('program-data').textContent);
  const byId = new Map(programs.map(program => [program.slug, program]));
  const sections = Array.from(document.querySelectorAll('[data-program]'));
  const search = document.getElementById('program-search');
  const level = document.getElementById('program-level');
  const savedOnly = document.getElementById('saved-only');
  const count = document.getElementById('result-count');
  const status = document.getElementById('catalog-status');
  const printButton = document.getElementById('print-saved');
  const dialog = document.querySelector('.compare-dialog');
  const compareButton = document.getElementById('open-compare');
  const compareBar = document.querySelector('.compare-bar');
  const storageKey = 'lvc.saved.programs';
  let selected = new Set();
  let saved = new Set();

  function readSaved(raw) {
    try {
      const value = JSON.parse(raw);
      return new Set(value && value.version === 1 && Array.isArray(value.slugs)
        ? value.slugs.filter(id => byId.has(id)) : []);
    } catch (_) { return new Set(); }
  }
  try { saved = readSaved(localStorage.getItem(storageKey)); } catch (_) {}
  const normalize = value => value.normalize('NFC').toLocaleLowerCase('th').trim();

  function filter() {
    const query = normalize(search.value);
    let visible = 0;
    sections.forEach(section => {
      const program = byId.get(section.dataset.program);
      const levels = program.levels.filter(item => level.value === 'all' || item.name === level.value);
      const text = normalize([program.title, ...levels.flatMap(item => item.branches)].join(' '));
      const show = levels.length > 0 && (!query || text.includes(query)) && (!savedOnly.checked || saved.has(program.slug));
      section.hidden = !show;
      if (show) visible++;
      section.querySelectorAll('.program-level').forEach(item => { item.hidden = level.value !== 'all' && item.dataset.level !== level.value; });
    });
    count.textContent = 'พบ ' + visible + ' กลุ่มสาขา';
    const empty = document.querySelector('.empty-results');
    empty.hidden = visible > 0;
    empty.querySelector('h2').textContent = savedOnly.checked && saved.size === 0 ? 'ยังไม่มีรายการที่บันทึก' : 'ยังไม่พบสาขาที่ตรงกับตัวเลือก';
    empty.querySelector('p').textContent = savedOnly.checked && saved.size === 0 ? 'แสดงทุกสาขา แล้วกดบันทึกกลุ่มที่สนใจเพื่อกลับมาดูภายหลัง' : 'ลองเปลี่ยนคำค้นหรือเลือกระดับการศึกษาอื่น';
  }
  function syncSaved() {
    document.querySelectorAll('[data-save]').forEach(button => {
      const active = saved.has(button.dataset.save);
      button.setAttribute('aria-pressed', String(active));
      button.textContent = active ? 'บันทึกแล้ว' : 'บันทึกกลุ่มนี้';
      button.setAttribute('aria-label', (active ? 'เลิกบันทึก ' : 'บันทึก ') + byId.get(button.dataset.save).title);
    });
    document.getElementById('saved-count').textContent = saved.size;
    printButton.hidden = saved.size === 0;
    filter();
  }
  function syncCompare() {
    document.querySelectorAll('[data-compare]').forEach(input => {
      input.checked = selected.has(input.dataset.compare);
      input.disabled = selected.size === 2 && !input.checked;
    });
    compareBar.hidden = selected.size === 0;
    document.body.classList.toggle('has-comparison', selected.size > 0);
    compareButton.disabled = selected.size !== 2;
    document.getElementById('compare-selection').textContent = Array.from(selected, id => byId.get(id).title).join(' + ') + (selected.size === 1 ? ' · เลือกอีก 1 กลุ่ม' : '');
  }
  function branchList(branches) {
    const list = document.createElement('ul');
    branches.forEach(branch => { const item = document.createElement('li'); item.textContent = branch; list.appendChild(item); });
    return list;
  }
  function showComparison() {
    if (selected.size !== 2) return;
    const pair = Array.from(selected, id => byId.get(id));
    const table = document.getElementById('compare-table');
    table.replaceChildren();
    const head = table.createTHead().insertRow();
    ['ระดับ', ...pair.map(program => program.title)].forEach(title => {
      const th = document.createElement('th'); th.scope = 'col'; th.textContent = title; head.appendChild(th);
    });
    const body = table.createTBody();
    ['ปวช.', 'ปวส.', 'ปริญญาตรี'].forEach(name => {
      const row = body.insertRow(); const th = document.createElement('th'); th.scope = 'row'; th.textContent = name; row.appendChild(th);
      pair.forEach(program => {
        const cell = row.insertCell(); const found = program.levels.find(item => item.name === name);
        if (found) cell.appendChild(branchList(found.branches));
        else cell.textContent = 'ไม่ระบุในคู่มือปี 2569';
      });
    });
    dialog.showModal();
    document.getElementById('close-compare').focus();
  }
  document.querySelectorAll('[data-save]').forEach(button => {
    button.addEventListener('click', () => {
      const id = button.dataset.save;
      if (saved.has(id)) saved.delete(id); else saved.add(id);
      let persisted = true;
      try { localStorage.setItem(storageKey, JSON.stringify({ version: 1, slugs: Array.from(saved) })); }
      catch (_) { persisted = false; }
      syncSaved();
      status.textContent = persisted ? (saved.has(id) ? 'บันทึก ' : 'เลิกบันทึก ') + byId.get(id).title : 'เก็บรายการไว้ในหน้านี้แล้ว เบราว์เซอร์นี้ไม่อนุญาตให้บันทึกข้ามครั้งที่เปิด';
    });
  });
  document.querySelectorAll('[data-compare]').forEach(input => {
    input.addEventListener('change', () => {
      const id = input.dataset.compare;
      if (!input.checked) selected.delete(id); else if (selected.size < 2) selected.add(id);
      syncCompare();
    });
  });
  document.getElementById('clear-compare').addEventListener('click', () => { selected.clear(); syncCompare(); });
  compareButton.addEventListener('click', showComparison);
  document.getElementById('close-compare').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    const box = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) dialog.close();
  });
  dialog.addEventListener('close', () => compareButton.focus({ preventScroll: true }));
  search.addEventListener('input', filter);
  level.addEventListener('change', filter);
  savedOnly.addEventListener('change', filter);
  document.getElementById('reset-filters').addEventListener('click', () => {
    search.value = ''; level.value = 'all'; savedOnly.checked = false; filter(); search.focus({ preventScroll: true });
  });
  printButton.addEventListener('click', () => {
    if (!saved.size) return;
    const content = document.getElementById('print-items'); content.replaceChildren();
    programs.filter(program => saved.has(program.slug)).forEach(program => {
      const article = document.createElement('article'); const heading = document.createElement('h2'); heading.textContent = program.title; article.appendChild(heading);
      program.levels.forEach(item => {
        const label = document.createElement('h3'); label.textContent = item.name; article.appendChild(label); article.appendChild(branchList(item.branches));
      });
      content.appendChild(article);
    });
    document.body.classList.add('printing-notebook');
    window.print();
  });
  window.addEventListener('afterprint', () => document.body.classList.remove('printing-notebook'));
  window.addEventListener('storage', event => {
    if (event.key === storageKey || event.key === null) { saved = readSaved(event.newValue); syncSaved(); }
  });
  function revealHash() {
    let id; try { id = decodeURIComponent(location.hash.slice(1)); } catch (_) { return; }
    if (!byId.has(id)) return;
    const target = document.getElementById(id);
    if (target.hidden) {
      search.value = ''; level.value = 'all'; savedOnly.checked = false; filter();
      requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
    }
  }
  window.addEventListener('hashchange', revealHash);
  document.querySelector('.catalog-tools').hidden = false;
  document.querySelectorAll('.program-tools').forEach(element => { element.hidden = false; });
  syncSaved(); syncCompare(); revealHash();
})();
