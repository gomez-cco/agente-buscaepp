(function () {
  const messagesEl = document.getElementById('messages');
  const form = document.getElementById('composer');
  const input = document.getElementById('input');
  const btnSend = document.getElementById('btnSend');
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('backdrop');
  const btnMenu = document.getElementById('btnMenu');
  const btnTheme = document.getElementById('btnTheme');
  const btnReset = document.getElementById('btnReset');
  const btnFontMinus = document.getElementById('btnFontMinus');
  const btnFontPlus = document.getElementById('btnFontPlus');
  const categoriasList = document.getElementById('categoriasList');
  const temarioList = document.getElementById('temarioList');
  const guiaList = document.getElementById('guiaList');
  const estudioList = document.getElementById('estudioList');

  const initialMessagesHTML = messagesEl.innerHTML;
  let sessionId = 'sess-' + Math.random().toString(36).slice(2, 10);
  let fontScale = 1;
  let sending = false;

  // ---------- Sidebar dinámico (categorías + temario desde el backend) ----------
  fetch('/api/sidebar')
    .then(r => r.json())
    .then(data => {
      categoriasList.innerHTML = '';
      data.categorias.forEach(c => {
        const li = document.createElement('li');
        li.textContent = `${c.icono || ''} ${c.label}`.trim();
        li.dataset.q = `¿Qué tipos de EPP existen en la categoría "${c.label}" y qué norma aplica a cada uno?`;
        categoriasList.appendChild(li);
      });

      temarioList.innerHTML = '';
      (data.temarioPorFamilia || []).forEach(grupo => {
        const header = document.createElement('li');
        header.className = 'familia-header';
        header.textContent = `${grupo.icono || ''} ${grupo.label}`.trim();
        temarioList.appendChild(header);
        grupo.normas.forEach(t => {
          const li = document.createElement('li');
          li.className = 'norma-item';
          li.textContent = `${t.codigo} — ${t.titulo}`;
          li.dataset.q = `Explícame qué exige la norma ${t.codigo} (${t.titulo}) y a qué EPP aplica.`;
          temarioList.appendChild(li);
        });
      });

      estudioList.innerHTML = '';
      (data.guiasEstudio || []).forEach(g => {
        const li = document.createElement('li');
        li.textContent = `${g.titulo} (${g.totalPreguntas})`;
        li.dataset.q = `Ver preguntas de la guía "${g.titulo}"`;
        estudioList.appendChild(li);
      });
    })
    .catch(() => {
      categoriasList.innerHTML = '<li class="loading">No se pudo cargar</li>';
      temarioList.innerHTML = '<li class="loading">No se pudo cargar</li>';
      estudioList.innerHTML = '<li class="loading">No se pudo cargar</li>';
    });

  // Listener delegado único: cubre tanto los ítems fijos (guía) como los
  // cargados dinámicamente (categorías/temario), sin riesgo de doble-bind.
  sidebar.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-q]');
    if (!li) return;
    input.value = li.dataset.q;
    closeSidebarOnMobile();
    sendMessage();
  });

  // ---------- Menú lateral (móvil) ----------
  btnMenu.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    backdrop.classList.toggle('open');
  });
  backdrop.addEventListener('click', closeSidebarOnMobile);
  function closeSidebarOnMobile() {
    sidebar.classList.remove('open');
    backdrop.classList.remove('open');
  }

  // ---------- Nueva consulta (reinicia el chat) ----------
  btnReset.addEventListener('click', () => {
    if (sending) return;
    messagesEl.innerHTML = initialMessagesHTML;
    input.value = '';
    input.style.height = 'auto';
    sessionId = 'sess-' + Math.random().toString(36).slice(2, 10);
    closeSidebarOnMobile();
    input.focus();
  });

  // ---------- Tema claro/oscuro ----------
  btnTheme.addEventListener('click', () => {
    const root = document.documentElement;
    const isLight = root.getAttribute('data-theme') === 'light';
    root.setAttribute('data-theme', isLight ? 'dark' : 'light');
    btnTheme.textContent = isLight ? '☀' : '🌙';
  });

  // ---------- Tamaño de fuente ----------
  btnFontPlus.addEventListener('click', () => setFontScale(fontScale + 0.1));
  btnFontMinus.addEventListener('click', () => setFontScale(fontScale - 0.1));
  function setFontScale(v) {
    fontScale = Math.min(1.5, Math.max(0.8, v));
    document.documentElement.style.setProperty('--font-scale', fontScale.toFixed(2));
  }

  // ---------- Textarea auto-resize ----------
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 160) + 'px';
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage();
  });

  // ---------- Render de mensajes ----------
  function addMessage(role, text) {
    const div = document.createElement('div');
    div.className = 'msg ' + role;
    if (role === 'assistant') {
      div.innerHTML = formatAssistantText(text);
    } else {
      div.textContent = text;
    }
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  // Convierte **negritas** y líneas que empiezan con "- " en viñetas simples,
  // y encabezados "**Algo:**" al inicio de línea en <h4>
  function formatAssistantText(text) {
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const withBold = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    const lines = withBold.split('\n');
    let html = '';
    let inList = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (/^<strong>.+<\/strong>$/.test(trimmed) || /^<strong>.+:<\/strong>$/.test(trimmed)) {
        if (inList) { html += '</ul>'; inList = false; }
        html += `<h4>${trimmed.replace(/<\/?strong>/g, '')}</h4>`;
      } else if (trimmed.startsWith('- ')) {
        if (!inList) { html += '<ul>'; inList = true; }
        html += `<li>${trimmed.slice(2)}</li>`;
      } else if (trimmed === '') {
        if (inList) { html += '</ul>'; inList = false; }
        html += '<br>';
      } else {
        if (inList) { html += '</ul>'; inList = false; }
        html += `<p>${trimmed}</p>`;
      }
    }
    if (inList) html += '</ul>';
    return html;
  }

  async function sendMessage() {
    const text = input.value.trim();
    if (!text || sending) return;
    sending = true;
    btnSend.disabled = true;
    addMessage('user', text);
    input.value = '';
    input.style.height = 'auto';

    const pendingEl = addMessage('assistant', '');
    pendingEl.innerHTML = '<p class="pending">EPPI está revisando la normativa…</p>';

    try {
      const resp = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Error desconocido');
      pendingEl.innerHTML = formatAssistantText(data.reply);
    } catch (err) {
      pendingEl.innerHTML = `<p class="pending">No se pudo obtener respuesta (${err.message}). Intenta de nuevo.</p>`;
    } finally {
      sending = false;
      btnSend.disabled = false;
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  }
})();
