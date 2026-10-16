/* ============ search-select.js — selector reutilizable con búsqueda y estilo PMD ============ */
G.SearchSelect = (() => {
  const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  let active = null, filtered = [], cursor = -1, serial = 0;
  // Un panel compartido fuera de las cajas con scroll evita recortes y listeners por instancia.
  const popup = document.createElement('div');
  popup.id = 'search-select-popup';
  popup.className = 'search-select-popup panel hidden';
  popup.innerHTML = `<input class="field" type="search" role="combobox" aria-autocomplete="list" aria-expanded="false"
      aria-controls="search-select-list" autocomplete="off">
    <div class="search-select-list" id="search-select-list" role="listbox"></div>
    <p class="sub hidden" role="status"></p>`;
  document.body.appendChild(popup);
  const input = popup.querySelector('input'), list = popup.querySelector('[role=listbox]');
  const empty = popup.querySelector('[role=status]');
  const observer = new MutationObserver(() => {
    if (active && (!active.host.isConnected || active.host.closest('.hidden'))) close();
  });

  function close(focus = false) {
    if (!active) return;
    const trigger = active.trigger;
    active = null;
    observer.disconnect();
    popup.classList.add('hidden');
    trigger.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    filtered = [];
    list.replaceChildren();
    if (focus) trigger.focus();
  }

  function position() {
    if (!active) return;
    const rect = active.trigger.getBoundingClientRect(), viewport = window.visualViewport;
    const left = viewport ? viewport.offsetLeft : 0, top = viewport ? viewport.offsetTop : 0;
    const width = viewport ? viewport.width : innerWidth, height = viewport ? viewport.height : innerHeight;
    const below = top + height - Math.max(rect.bottom, top) - 14;
    const above = Math.min(rect.top, top + height) - top - 14;
    const down = below >= 180 || below >= above;
    popup.style.width = Math.min(Math.max(rect.width, 260), width - 16) + 'px';
    popup.style.left = Math.max(left + 8, Math.min(rect.left, left + width - popup.offsetWidth - 8)) + 'px';
    list.style.maxHeight = Math.max(44, Math.min(240, (down ? below : above) - input.offsetHeight - 24)) + 'px';
    const y = down ? rect.bottom + 6 : rect.top - popup.offsetHeight - 6;
    popup.style.top = Math.max(top + 8, Math.min(y, top + height - popup.offsetHeight - 8)) + 'px';
  }

  function highlight(index) {
    cursor = index;
    Array.from(list.children).forEach((el, i) => el.classList.toggle('active', i === cursor));
    const el = list.children[cursor];
    if (el) {
      input.setAttribute('aria-activedescendant', el.id);
      // Desplaza sólo las opciones, sin mover la pantalla bajo el panel.
      if (el.offsetTop < list.scrollTop) list.scrollTop = el.offsetTop;
      else if (el.offsetTop + el.offsetHeight > list.scrollTop + list.clientHeight)
        list.scrollTop = el.offsetTop + el.offsetHeight - list.clientHeight;
    } else input.removeAttribute('aria-activedescendant');
  }

  function render() {
    const query = normalize(input.value);
    filtered = active.options.filter(o => normalize(G.T(o.label)).includes(query));
    list.replaceChildren();
    filtered.forEach((option, i) => {
      const el = document.createElement('div');
      el.id = active.host.id + '-option-' + i;
      el.className = 'search-select-option';
      el.setAttribute('role', 'option');
      el.setAttribute('aria-selected', String(option.value === active.value));
      el.textContent = G.T(option.label);
      el.onclick = () => choose(i);
      list.appendChild(el);
    });
    empty.classList.toggle('hidden', filtered.length > 0);
    position();
    const selected = filtered.findIndex(o => o.value === active.value);
    highlight(selected >= 0 ? selected : filtered.length ? 0 : -1);
  }

  function updateTrigger(select) {
    const option = select.options.find(o => o.value === select.value);
    const text = option ? G.T(option.label) : '';
    select.trigger.firstElementChild.textContent = text;
    select.trigger.setAttribute('aria-label', G.T(select.label) + (text ? ': ' + text : ''));
  }

  function choose(index) {
    const option = filtered[index];
    if (!option) return;
    const select = active, changed = select.value !== option.value;
    select.value = option.value;
    updateTrigger(select);
    close(true);
    if (changed) select.onChange(option.value);
  }

  function open(select) {
    close();
    active = select;
    input.value = '';
    input.placeholder = G.T(select.placeholder);
    input.setAttribute('aria-label', G.T(select.label));
    list.setAttribute('aria-label', G.T(select.label));
    empty.textContent = G.T(select.emptyText);
    popup.classList.remove('hidden');
    select.trigger.setAttribute('aria-expanded', 'true');
    input.setAttribute('aria-expanded', 'true');
    render();
    input.focus({ preventScroll: true });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  function keydown(e) {
    // El teclado global del juego captura Tab, espacio y las flechas.
    e.stopPropagation();
    if (!active) return;
    if (e.key === 'Escape') { e.preventDefault(); close(true); }
    else if (e.key === 'Tab') close(true);
    else if (e.target === input && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      if (filtered.length) highlight((cursor + (e.key === 'ArrowDown' ? 1 : -1) + filtered.length) % filtered.length);
    } else if (e.target === input && e.key === 'Enter') { e.preventDefault(); choose(cursor); }
  }

  list.onmousedown = e => e.preventDefault();
  input.oninput = render;
  popup.addEventListener('keydown', keydown);
  for (const event of ['pointerdown', 'focusin']) document.addEventListener(event, e => {
    if (active && !active.host.contains(e.target) && !popup.contains(e.target)) close();
  });
  window.addEventListener('resize', position);
  window.addEventListener('scroll', e => { if (!popup.contains(e.target)) position(); }, true);
  if (window.visualViewport) {
    visualViewport.addEventListener('resize', position);
    visualViewport.addEventListener('scroll', position);
  }

  /** Opciones { value, label }; el valor se conserva en su tipo original. */
  function create(host, { label, placeholder = 'Buscar…', emptyText = 'Sin resultados.', onChange }) {
    if (active && active.host === host) close();
    if (!host.id) host.id = 'search-select-' + ++serial;
    host.classList.add('search-select');
    host.innerHTML = `<button type="button" class="field search-select-trigger" aria-haspopup="listbox" aria-expanded="false"
      aria-controls="search-select-list"><span></span><span aria-hidden="true">▾</span></button>`;
    const trigger = host.querySelector('button');
    const select = { host, trigger, label, placeholder, emptyText, onChange, options: [], value: undefined };
    updateTrigger(select);
    trigger.onclick = () => active === select ? close() : open(select);
    trigger.onkeydown = e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(select); }
      keydown(e);
    };
    return {
      setOptions(options, value) {
        if (active === select) close();
        select.options = options;
        select.value = value;
        updateTrigger(select);
      }
    };
  }

  return { create, normalize };
})();
