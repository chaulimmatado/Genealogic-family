(() => {
  'use strict';

  const people = familyData.people;
  const byId = new Map(people.map(person => [person.id, person]));
  const generationNames = { 1: 'Bisavós', 2: 'Filhos', 3: 'Netos', 4: 'Bisnetos', 5: 'Tataranetos' };
  const branchColors = { founder: '#123b63', jose: '#2c91ca', joao: '#f4a340', israel: '#40a6b7', carlos: '#e38e42', pedro: '#5678bc', tereza: '#c87954', vera: '#9b8fc0', belarmina: '#d17e9e', vilma: '#4b9b76' };
  const parentsById = new Map(people.map(person => [person.id, []]));
  people.forEach(parent => parent.children.forEach(childId => parentsById.get(childId)?.push(parent.id)));
  // Os nove filhos pertencem ao casal fundador, não apenas a José Leandro.
  const founders = ['nair', 'jose-leandro'];
  people.filter(person => person.generation === 2).forEach(person => parentsById.set(person.id, founders));

  const board = document.getElementById('generationBoard');
  const treeHost = document.getElementById('treeHost');
  const treeViewport = document.getElementById('treeViewport');
  const details = document.getElementById('details');
  const detailsContent = document.getElementById('detailsContent');
  const input = document.getElementById('searchInput');
  let selectedId = null;
  let searchTimer = null;
  let displayScale = 1;

  function childrenOf(person) {
    if (person.id === 'nair') return byId.get('jose-leandro').children.map(id => byId.get(id));
    return person.children.map(id => byId.get(id));
  }

  function parentPeople(person) {
    return (parentsById.get(person.id) || []).map(id => byId.get(id)).filter(Boolean);
  }

  function descendantCount(id, seen = new Set()) {
    const person = byId.get(id);
    if (!person) return 0;
    let count = 0;
    childrenOf(person).forEach(child => {
      if (seen.has(child.id)) return;
      seen.add(child.id);
      count += 1 + descendantCount(child.id, seen);
    });
    return count;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  function groupsFor(generation) {
    const cohort = people.filter(person => person.generation === generation);
    if (generation === 1) return [{ title: 'Casal fundador', people: cohort }];
    const buckets = new Map();
    cohort.forEach(person => {
      const parents = parentPeople(person);
      const key = parents.length ? parents.map(parent => parent.id).join('|') : 'sem-pais';
      if (!buckets.has(key)) buckets.set(key, { parents, people: [] });
      buckets.get(key).people.push(person);
    });
    return [...buckets.values()].map(group => ({
      title: generation === 2 ? 'Filhos de Nair Miranda e José Leandro' : `Filhos de ${group.parents.map(parent => parent.name).join(' e ') || 'parentesco não informado'}`,
      people: group.people,
      color: branchColors[group.people[0]?.branch] || branchColors.founder
    }));
  }

  function namesMarkup(persons, emptyText) {
    if (!persons.length) return `<span class="no-children">${escapeHtml(emptyText)}</span>`;
    return persons.map(person => `<button class="person-chip" type="button" data-select-person="${person.id}">${escapeHtml(person.name)}</button>`).join(' ');
  }

  function personCard(person) {
    const parents = parentPeople(person);
    const children = childrenOf(person);
    const parentText = person.generation === 1 ? 'Casal fundador' : parents.map(parent => parent.name).join(' e ') || 'Não informado';
    const partner = person.generation === 1 ? people.find(other => other.id !== person.id && other.generation === 1) : null;
    const relationLabel = person.generation === 1 ? 'Par' : 'Pais';
    return `<article class="person-card branch-${person.branch}${selectedId === person.id ? ' is-selected' : ''}" data-person-id="${person.id}" aria-label="${escapeHtml(person.name)}, ${generationNames[person.generation]}">
      <button class="person-name" type="button" data-select-person="${person.id}"><span>${escapeHtml(person.name)}</span><span class="person-generation">${person.generation}ª geração</span></button>
      <div class="relation-row"><span class="relation-label">${relationLabel}</span><div class="relation-content">${escapeHtml(person.generation === 1 ? (partner ? partner.name : 'Casal fundador') : parentText)}</div></div>
      <div class="relation-row"><span class="relation-label">Filhos · ${children.length}</span><div class="relation-content">${namesMarkup(children, 'Nenhum filho registrado')}</div></div>
    </article>`;
  }

  function renderBoard() {
    board.innerHTML = [1, 2, 3, 4, 5].map(generation => {
      const cohort = people.filter(person => person.generation === generation);
      const groups = groupsFor(generation);
      return `<section class="generation-section" id="generation-${generation}" aria-labelledby="generation-title-${generation}">
        <div class="generation-heading"><span class="generation-number">${generation}</span><div><h2 id="generation-title-${generation}">${generationNames[generation]}</h2><p>Geração ${generation} · todos os registros desta geração</p></div><span class="generation-count">${cohort.length} ${cohort.length === 1 ? 'pessoa' : 'pessoas'}</span></div>
        <div class="family-groups">${groups.map(group => `<section class="family-group" style="--group-color:${group.color || branchColors.founder}"><h3 class="family-group-heading">${escapeHtml(group.title)}<span>${group.people.length}</span></h3><div class="person-grid">${group.people.map(personCard).join('')}</div></section>`).join('')}</div>
      </section>`;
    }).join('');

    const counts = [1, 2, 3, 4, 5].map(generation => ({ generation, count: people.filter(person => person.generation === generation).length }));
    document.getElementById('headerStats').innerHTML = `<span class="stat-total"><b>${people.length}</b> pessoas</span><span><b>5</b> gerações</span>`;
    document.getElementById('generationStats').innerHTML = counts.map(item => `<div class="generation-stat"><b>${item.count}</b><span>${generationNames[item.generation]}</span></div>`).join('');
    document.getElementById('footerTotal').textContent = `${people.length} pessoas · ${counts.length} gerações · nenhum ramo recolhido`;
    applySearchHighlights();
  }

  function selectPerson(id, openPanel) {
    const person = byId.get(id);
    if (!person) return;
    selectedId = id;
    document.querySelectorAll('.person-card, .svg-person').forEach(card => card.classList.toggle('is-selected', card.dataset.personId === id));
    if (!openPanel) return;
    const parents = parentPeople(person);
    const children = childrenOf(person);
    const partners = person.generation === 1 ? people.filter(other => other.generation === 1 && other.id !== person.id) : [];
    detailsContent.innerHTML = `<div class="person-head"><div class="generation">${person.generation}ª geração · ${escapeHtml(generationNames[person.generation])}</div><h2>${escapeHtml(person.name)}</h2></div>
      <section class="detail-section"><div class="detail-label">${person.generation === 1 ? 'Casal fundador' : 'Pais'}</div><div class="detail-list">${(person.generation === 1 ? partners : parents).length ? (person.generation === 1 ? partners : parents).map(item => `<span class="detail-pill">${escapeHtml(item.name)}</span>`).join('') : '<span class="detail-pill">Registro fundador</span>'}</div></section>
      <section class="detail-section"><div class="detail-label">Filhos · ${children.length}</div><div class="detail-list">${children.length ? children.map(child => `<button class="person-chip" type="button" data-select-person="${child.id}">${escapeHtml(child.name)}</button>`).join('') : '<span class="no-children">Nenhum filho registrado</span>'}</div></section>
      <section class="detail-section"><div class="detail-label">Descendentes registrados</div><div class="desc-count">${descendantCount(id)}</div></section>`;
    details.classList.add('open');
    details.setAttribute('aria-hidden', 'false');
    details.inert = false;
  }

  function applySearchHighlights() {
    const query = input.value.trim().toLocaleLowerCase('pt-BR');
    document.querySelectorAll('.person-card, .svg-person').forEach(card => {
      card.classList.toggle('is-match', Boolean(query && byId.get(card.dataset.personId).name.toLocaleLowerCase('pt-BR').includes(query)));
    });
  }

  function scrollToPerson(id) {
    const treeIsVisible = window.getComputedStyle(treeViewport).display !== 'none';
    const target = treeIsVisible
      ? treeHost.querySelector(`[data-person-id="${id}"]`)
      : board.querySelector(`[data-person-id="${id}"]`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  }

  function search() {
    const query = input.value.trim().toLocaleLowerCase('pt-BR');
    const resultsBox = document.getElementById('searchResults');
    const summary = document.getElementById('searchSummary');
    applySearchHighlights();
    if (!query) {
      summary.textContent = '';
      resultsBox.innerHTML = '';
      return;
    }
    const matches = people.filter(person => person.name.toLocaleLowerCase('pt-BR').includes(query));
    if (!matches.length) {
      summary.textContent = 'Nenhuma pessoa encontrada. Todos os cartões continuam visíveis.';
      resultsBox.innerHTML = '';
      return;
    }
    summary.textContent = `${matches.length} ${matches.length === 1 ? 'resultado' : 'resultados'}; os demais nomes continuam visíveis.`;
    resultsBox.innerHTML = matches.map(person => {
      const parents = parentPeople(person);
      const context = person.generation === 1 ? 'Casal fundador' : `Filho(a) de ${parents.map(parent => parent.name).join(' e ')}`;
      return `<button type="button" class="search-result" data-jump-to="${person.id}"><strong>${escapeHtml(person.name)}</strong><small>${person.generation}ª geração · ${escapeHtml(context || 'parentesco não informado')}</small></button>`;
    }).join('');
    resultsBox.querySelectorAll('[data-jump-to]').forEach(button => button.addEventListener('click', () => {
      const person = byId.get(button.dataset.jumpTo);
      scrollToPerson(person.id);
      selectPerson(person.id, true);
    }));
    if (matches.length === 1) {
      scrollToPerson(matches[0].id);
      selectPerson(matches[0].id, false);
    }
  }

  function exportLayout() {
    const cardW = 190, cardH = 72, xGap = 58, yGap = 24, top = 115, left = 38;
    const leaves = [];
    const visit = id => {
      const person = byId.get(id);
      if (!person) return;
      const kids = childrenOf(person);
      if (!kids.length || person.generation === 1) {
        if (person.generation === 1) return;
        leaves.push(id);
      } else kids.forEach(child => visit(child.id));
    };
    byId.get('jose-leandro').children.forEach(id => visit(id));
    const leafIndex = new Map(leaves.map((id, index) => [id, index]));
    const centers = new Map();
    const center = id => {
      if (centers.has(id)) return centers.get(id);
      const kids = childrenOf(byId.get(id));
      const childCenters = kids.map(child => center(child.id));
      const value = childCenters.length ? childCenters.reduce((sum, item) => sum + item, 0) / childCenters.length : (leafIndex.get(id) || 0);
      centers.set(id, value);
      return value;
    };
    byId.get('jose-leandro').children.forEach(id => center(id));
    const positions = new Map();
    people.filter(person => person.generation > 1).forEach(person => {
      positions.set(person.id, { x: left + (person.generation - 1) * (cardW + xGap), y: top + center(person.id) * (cardH + yGap) });
    });
    const cohortCenter = (byId.get('jose-leandro').children.map(id => centers.get(id)).reduce((sum, item) => sum + item, 0) / byId.get('jose-leandro').children.length);
    positions.set('nair', { x: left, y: top + cohortCenter * (cardH + yGap) - cardH - 10 });
    positions.set('jose-leandro', { x: left, y: top + cohortCenter * (cardH + yGap) + 10 });
    const height = top * 2 + Math.max(1, leaves.length) * (cardH + yGap);
    const width = left * 2 + 5 * cardW + 4 * xGap;
    return { positions, width, height, cardW, cardH };
  }

  function exportSvgMarkup() {
    const { positions, width, height, cardW, cardH } = exportLayout();
    const generationX = [0, 1, 2, 3, 4].map(index => 38 + index * (cardW + 58));
    const paths = [];
    people.forEach(parent => childrenOf(parent).forEach(child => {
      const a = positions.get(parent.id), b = positions.get(child.id);
      if (!a || !b) return;
      const startX = a.x + cardW, endX = b.x, mid = (startX + endX) / 2;
      paths.push(`<path class="tree-link branch-${parent.branch}" d="M ${startX} ${a.y + cardH / 2} C ${mid} ${a.y + cardH / 2}, ${mid} ${b.y + cardH / 2}, ${endX} ${b.y + cardH / 2}"/>`);
    }));
    const headings = [1, 2, 3, 4, 5].map((generation, index) => `<text x="${generationX[index]}" y="78" fill="#123b63" font-family="Arial,sans-serif" font-size="16" font-weight="700">${generation}ª geração · ${generationNames[generation]}</text>`).join('');
    const nodes = people.map(person => {
      const p = positions.get(person.id);
      const name = escapeHtml(person.name);
      const children = childrenOf(person).length;
      return `<g class="svg-person branch-${person.branch}" data-person-id="${person.id}" transform="translate(${p.x},${p.y})" role="button" tabindex="0" aria-label="${name}, ${person.generation}ª geração, ${children} filhos registrados"><rect class="card" width="${cardW}" height="${cardH}" rx="8"/><rect class="accent" width="5" height="${cardH}" rx="3" fill="${branchColors[person.branch] || '#2696d6'}"/><text class="name" x="14" y="29">${name}</text><text class="meta" x="14" y="50">${person.generation}ª geração · ${children} ${children === 1 ? 'filho' : 'filhos'}</text></g>`;
    }).join('');
    return `<svg id="treeSvg" xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Árvore genealógica completa da Família Miranda"><style>.svg-person{cursor:pointer;outline:none}.svg-person rect.card{fill:#fff;stroke:#d8e2eb;stroke-width:1.5}.svg-person text{font-family:Arial,Helvetica,sans-serif;pointer-events:none}.svg-person text.name{fill:#123b63;font-size:13px;font-weight:700}.svg-person text.meta{fill:#718096;font-size:10px}.svg-person:hover rect.card,.svg-person:focus rect.card{stroke:#2696d6;stroke-width:2.5}.svg-person.is-selected rect.card{fill:#edf8fe;stroke:#2696d6;stroke-width:2.5}.svg-person.is-match rect.card{fill:#fffaf2;stroke:#f4a340;stroke-width:3}.tree-link{fill:none;stroke:#b7c6d3;stroke-width:1.7;stroke-opacity:.72}.tree-link.branch-jose{stroke:#2c91ca}.tree-link.branch-joao{stroke:#d9902e}.tree-link.branch-tereza{stroke:#c87954}.tree-link.branch-vilma{stroke:#4b9b76}.tree-link.branch-belarmina{stroke:#d17e9e}</style><rect width="100%" height="100%" fill="#f5f7fa"/><text x="38" y="36" fill="#123b63" font-family="Arial,sans-serif" font-size="21" font-weight="700">ÁRVORE GENEALÓGICA · FAMÍLIA MIRANDA</text>${headings}${paths.join('')}${nodes}</svg>`;
  }

  function renderTree() {
    treeHost.innerHTML = exportSvgMarkup();
    applySearchHighlights();
    setDisplayScale(displayScale);
  }

  function setDisplayScale(value) {
    displayScale = Math.max(.8, Math.min(1.5, value));
    document.body.style.setProperty('--text-scale', displayScale);
    const svg = treeHost.querySelector('svg');
    if (svg) {
      svg.style.width = `${Number(svg.getAttribute('width')) * displayScale}px`;
      svg.style.height = `${Number(svg.getAttribute('height')) * displayScale}px`;
    }
  }

  function download(name, blob) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  document.getElementById('exportSvg').addEventListener('click', () => download('arvore-familia-miranda.svg', new Blob([exportSvgMarkup()], { type: 'image/svg+xml;charset=utf-8' })));
  document.getElementById('exportPng').addEventListener('click', () => {
    const source = exportSvgMarkup();
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const ratio = 1.4;
      canvas.width = image.width * ratio;
      canvas.height = image.height * ratio;
      const context = canvas.getContext('2d');
      context.scale(ratio, ratio);
      context.drawImage(image, 0, 0);
      canvas.toBlob(blob => blob && download('arvore-familia-miranda.png', blob), 'image/png');
    };
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
  });

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-select-person]');
    if (button) selectPerson(button.dataset.selectPerson, true);
  });
  treeHost.addEventListener('click', event => {
    const node = event.target.closest('.svg-person');
    if (node) selectPerson(node.dataset.personId, true);
  });
  treeHost.addEventListener('keydown', event => {
    const node = event.target.closest('.svg-person');
    if (node && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      selectPerson(node.dataset.personId, true);
    }
  });
  let dragState = null;
  treeViewport.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.target.closest('.svg-person')) return;
    dragState = { x: event.clientX, y: event.clientY, left: treeViewport.scrollLeft, top: treeViewport.scrollTop };
    treeViewport.setPointerCapture(event.pointerId);
  });
  treeViewport.addEventListener('pointermove', event => {
    if (!dragState) return;
    treeViewport.scrollLeft = dragState.left - (event.clientX - dragState.x);
    treeViewport.scrollTop = dragState.top - (event.clientY - dragState.y);
  });
  treeViewport.addEventListener('pointerup', () => { dragState = null; });
  treeViewport.addEventListener('pointercancel', () => { dragState = null; });
  input.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(search, 220);
  });
  document.getElementById('clearSearch').addEventListener('click', () => {
    window.clearTimeout(searchTimer);
    input.value = '';
    search();
    input.focus();
  });
  document.getElementById('topBtn').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  document.getElementById('fullscreenBtn').addEventListener('click', () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.());
  document.getElementById('printBtn').addEventListener('click', () => window.print());
  document.getElementById('smallerText').addEventListener('click', () => setDisplayScale(displayScale - .1));
  document.getElementById('largerText').addEventListener('click', () => setDisplayScale(displayScale + .1));
  document.getElementById('closeDetails').addEventListener('click', () => {
    details.classList.remove('open');
    details.setAttribute('aria-hidden', 'true');
    details.inert = true;
  });
  document.getElementById('detailsBackdrop').addEventListener('click', () => {
    details.classList.remove('open');
    details.setAttribute('aria-hidden', 'true');
    details.inert = true;
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      details.classList.remove('open');
      details.setAttribute('aria-hidden', 'true');
      details.inert = true;
    }
  });

  renderBoard();
  renderTree();
})();
