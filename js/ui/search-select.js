/* ============ search-select.js — selector con búsqueda y estilo PMD ============ */
G.SearchSelect = (() => {
  const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

  /** Opciones { value, label }; conserva el foco en la búsqueda al navegar. */
  function create(host, { label, onChange }) {
    const id = host.id;
    host.classList.add('search-select');
    host.innerHTML = `<button type="button" class="field search-select-trigger" aria-haspopup="listbox" aria-expanded="false" aria-controls="${id}-list">
        <span></span><span aria-hidden="true">▾</span></button>
      <div class="search-select-popup panel hidden">
        <input class="field" type="search" role="combobox" aria-autocomplete="list" aria-expanded="false"
          aria-controls="${id}-list" autocomplete="off" placeholder="Buscar Pokémon por nombre…">
        <div class="search-select-list" id="${id}-list" role="listbox"></div>
        <p class="sub hidden" role="status">No hay Pokémon con ese nombre.</p>
      </div>`;
    const trigger = host.querySelector('button'), popup = host.querySelector('.search-select-popup');
    const input = host.querySelector('input'), list = host.querySelector('[role=listbox]');
    const empty = host.querySelector('[role=status]');
    trigger.setAttribute('aria-label', label);
    input.setAttribute('aria-label', label);
    list.setAttribute('aria-label', label);
    let options = [], filtered = [], value, active = -1;

    function close(focus = false) {
      popup.classList.add('hidden');
      trigger.setAttribute('aria-expanded', 'false');
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      if (focus) trigger.focus();
    }

    function highlight(index) {
      active = index;
      Array.from(list.children).forEach((el, i) => el.classList.toggle('active', i === active));
      const el = list.children[active];
      if (el) {
        input.setAttribute('aria-activedescendant', el.id);
        el.scrollIntoView({ block: 'nearest' });
      } else input.removeAttribute('aria-activedescendant');
    }

    function choose(index) {
      const option = filtered[index];
      if (!option) return;
      const changed = value !== option.value;
      value = option.value;
      trigger.firstElementChild.textContent = option.label;
      close(true);
      if (changed) onChange(value);
    }

    function render() {
      const query = normalize(input.value);
      filtered = options.filter(o => normalize(o.label).includes(query));
      list.replaceChildren();
      filtered.forEach((option, i) => {
        const el = document.createElement('div');
        el.id = id + '-option-' + i;
        el.className = 'search-select-option';
        el.setAttribute('role', 'option');
        el.setAttribute('aria-selected', String(option.value === value));
        el.textContent = option.label;
        el.onclick = () => choose(i);
        list.appendChild(el);
      });
      empty.classList.toggle('hidden', filtered.length > 0);
      const selected = filtered.findIndex(o => o.value === value);
      highlight(selected >= 0 ? selected : filtered.length ? 0 : -1);
    }

    function open() {
      input.value = '';
      popup.classList.remove('hidden');
      trigger.setAttribute('aria-expanded', 'true');
      input.setAttribute('aria-expanded', 'true');
      render();
      input.focus();
    }

    trigger.onclick = () => popup.classList.contains('hidden') ? open() : close();
    trigger.onkeydown = e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(); }
    };
    list.onmousedown = e => e.preventDefault();
    input.oninput = render;
    host.addEventListener('keydown', e => {
      // El teclado global del juego captura Tab, espacio y las flechas.
      e.stopPropagation();
      if (popup.classList.contains('hidden')) return;
      if (e.key === 'Escape') { e.preventDefault(); close(true); }
      else if (e.key === 'Tab') close();
      else if (e.target === input && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        if (filtered.length) highlight((active + (e.key === 'ArrowDown' ? 1 : -1) + filtered.length) % filtered.length);
      } else if (e.target === input && e.key === 'Enter') { e.preventDefault(); choose(active); }
    });
    host.addEventListener('focusout', e => { if (!host.contains(e.relatedTarget)) close(); });
    document.addEventListener('pointerdown', e => { if (!host.contains(e.target)) close(); });

    return {
      setOptions(next, selected) {
        options = next;
        value = selected;
        const option = options.find(o => o.value === value);
        trigger.firstElementChild.textContent = option ? option.label : '';
        close();
      }
    };
  }

  return { create, normalize };
})();
