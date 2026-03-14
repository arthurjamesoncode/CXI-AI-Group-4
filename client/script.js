// ── State ──────────────────────────────────────────────────────────────────
const initial_prompt = 
`In the following prompt you will be given a brief (or briefs) detailing a webpage that needs to be created, and various design system elements with which to create the webpage. 

Your response should go section by section (excluding briefs), and detail which components you would select. If elements of the briefs or design system seem to conflict, or if you think the design system is unsuited to the brief please say so and explain why.
Your response should conform EXACTLY to the format I will specify between the FORMAT START and FORMAT END lines and should contain ANY extra content. Where I say nth section, you should repeat this part of your response for each individual section. End every line with a new line character. If a line only says newline, it indicates an empty line: 
FORMAT START
A title for the webpage derived from the given brief(s).
A newline
The name of the nth section
A newline
A list of elements chosen from the nth section
A newline
A justification for why you chose these elements
A newline
(repeat the above for all sections, not including the main title)
An overall description of the choices made.
A newline
A html file containing a mock up of the created site.
FORMAT END

Everything below this is part of the brief(s) or design system.

`
let slots = [];
let nextId = 1;

const usedPresets = () => new Set(slots.map((s) => s.label));

// ── Helpers ────────────────────────────────────────────────────────────────
const fmt = (b) =>
  b < 1048576
    ? (b / 1024).toFixed(1) + ' KB'
    : (b / 1048576).toFixed(1) + ' MB';
const ext = (n) => {
  const p = n.split('.');
  return p.length > 1 ? p.pop().slice(0, 5).toUpperCase() : 'FILE';
};
const extColor = (e) =>
  ({
    PDF: '#c0392b',
    DOC: '#2980b9',
    DOCX: '#2980b9',
    JPG: '#e67e22',
    JPEG: '#e67e22',
    PNG: '#27ae60',
    GIF: '#9b59b6',
    ZIP: '#7f8c8d',
    MP4: '#e74c3c',
    MP3: '#1abc9c',
    XLS: '#27ae60',
    XLSX: '#27ae60',
    TXT: '#95a5a6',
    JS: '#f1c40f',
    TS: '#2980b9',
    PY: '#3498db',
    SVG: '#e67e22',
  })[e] || '#b8874a';

function showToast(msg, dur = 2600) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), dur);
}

// ── Slot management ────────────────────────────────────────────────────────
function addSlot(label, required = false) {
  if (!label.trim()) return;
  if (slots.find((s) => s.label.toLowerCase() === label.trim().toLowerCase())) {
    showToast('A section with that name already exists.');
    return;
  }
  slots.push({ id: nextId++, label: label.trim(), required, files: [] });
  render();
}

function removeSlot(id) {
  slots = slots.filter((s) => s.id !== id);
  render();
}

function toggleRequired(id) {
  const s = slots.find((s) => s.id === id);
  if (s) {
    s.required = !s.required;
    render();
  }
}

function addFilesToSlot(id, newFiles) {
  const s = slots.find((s) => s.id === id);
  if (!s) return;
  for (const f of newFiles) {
    if (!s.files.find((x) => x.name === f.name && x.size === f.size))
      s.files.push(f);
  }
  render();
}

function removeFileFromSlot(slotId, fileIdx) {
  const s = slots.find((s) => s.id === slotId);
  if (s) {
    s.files.splice(fileIdx, 1);
    render();
  }
}

function renameSlot(id, newLabel) {
  if (!newLabel.trim()) return;
  if (
    slots.find(
      (s) =>
        s.id !== id && s.label.toLowerCase() === newLabel.trim().toLowerCase(),
    )
  ) {
    showToast('Another section already has that name.');
    return;
  }
  const s = slots.find((s) => s.id === id);
  if (s) {
    s.label = newLabel.trim();
    render();
  }
}

// ── Render ─────────────────────────────────────────────────────────────────
function render() {
  renderGrid();
  updateSummary();
}

function renderGrid() {
  const grid = document.getElementById('slots-grid');
  // Preserve cards that already exist to avoid full re-render flicker
  const existing = {};
  grid
    .querySelectorAll('.slot-card')
    .forEach((c) => (existing[c.dataset.id] = c));

  const newIds = new Set(slots.map((s) => String(s.id)));

  // Remove stale
  Object.keys(existing).forEach((id) => {
    if (!newIds.has(id)) existing[id].remove();
  });

  slots.forEach((slot, i) => {
    const sid = String(slot.id);
    if (existing[sid]) {
      updateCard(existing[sid], slot);
    } else {
      const card = buildCard(slot);
      card.style.animationDelay = `${i * 0.05}s`;
      grid.appendChild(card);
    }
  });
}

function buildCard(slot) {
  const card = document.createElement('div');
  card.className = 'slot-card';
  card.dataset.id = slot.id;
  card.innerHTML = cardHTML(slot);
  attachCardEvents(card, slot);
  return card;
}

function updateCard(card, slot) {
  card.innerHTML = cardHTML(slot);
  card.classList.toggle('invalid', false);
  attachCardEvents(card, slot);
}

function cardHTML(slot) {
  const filesHTML = slot.files
    .map(
      (f, i) => `
    <div class="slot-file-item">
      <div class="slot-file-ext" style="background:${extColor(ext(f.name))}">${ext(f.name)}</div>
      <div class="slot-file-info">
        <div class="slot-file-name">${f.name}</div>
        <div class="slot-file-size">${fmt(f.size)}</div>
      </div>
      <button class="remove-file" data-slot="${slot.id}" data-idx="${i}" title="Remove file">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>`,
    )
    .join('');

  const dropContent =
    slot.files.length > 0
      ? `<div class="slot-files">${filesHTML}</div>
       <div class="add-more-hint" data-slot="${slot.id}">+ drop or click to add more</div>`
      : `<div class="drop-hint">
        <div class="drop-icon-wrap">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${'var(--accent)'}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>
        <div class="drop-hint-text">Drop files here, or <span>browse</span></div>
       </div>`;

  return `
    <div class="card-header">
      <div class="card-label-wrap">
        <span class="slot-label" data-slot="${slot.id}" title="Click to rename">${slot.label}</span>
        ${slot.required ? '<span class="required-badge">Required</span>' : ''}
      </div>
      <div class="card-actions">
        ${slot.required ? `<button class="req-toggle icon-btn active" data-slot="${slot.id}" title="required">` : ''}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="${slot.required ? 'var(--danger)' : 'none'}" stroke="${slot.required ? 'var(--danger)' : 'currentColor'}" stroke-width="2" stroke-linecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </button>
        ${
          !slot.required
            ? `<button class="icon-btn danger" data-remove="${slot.id}" title="Remove section">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>`
            : ''
        }
      </div>
    </div>
    <div class="drop-area" data-slot="${slot.id}">
      ${dropContent}
    </div>
    <div class="validation-msg">This section is required — please add at least one file.</div>
    <input type="file" multiple style="display:none" class="slot-file-input" data-slot="${slot.id}">
  `;
}

function attachCardEvents(card, slot) {
  const slotId = slot.id;

  // Drop area click → open file picker
  const dropArea = card.querySelector('.drop-area');
  const fileInput = card.querySelector('.slot-file-input');

  dropArea.addEventListener('click', (e) => {
    if (e.target.closest('.remove-file')) return;
    fileInput.click();
  });

  card.querySelector('.add-more-hint')?.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    addFilesToSlot(slotId, fileInput.files);
    fileInput.value = '';
  });

  // Drag and drop
  dropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropArea.classList.add('drag-over');
    card.classList.add('drag-over');
  });
  dropArea.addEventListener('dragleave', () => {
    dropArea.classList.remove('drag-over');
    card.classList.remove('drag-over');
  });
  dropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    dropArea.classList.remove('drag-over');
    card.classList.remove('drag-over');
    addFilesToSlot(slotId, e.dataTransfer.files);
  });

  // Remove file buttons
  card.querySelectorAll('.remove-file').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeFileFromSlot(+btn.dataset.slot, +btn.dataset.idx);
    });
  });

  // Remove section
  card
    .querySelector('[data-remove]')
    ?.addEventListener('click', () => removeSlot(slotId));

  card.querySelector('.slot-label')?.addEventListener('click', () => {
    const label = card.querySelector('.slot-label');
    const current = label.textContent;
    const input = document.createElement('input');
    input.className = 'label-edit-input';
    input.value = current;
    label.replaceWith(input);
    input.focus();
    input.select();

    const commit = () => {
      const val = input.value.trim() || current;
      renameSlot(slotId, val);
    };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commit();
      if (e.key === 'Escape') {
        input.value = current;
        commit();
      }
    });
  });
}

function updateSummary() {
  const totalFiles = slots.reduce((n, s) => n + s.files.length, 0);
  const totalSlots = slots.length;
  const missingRequired = slots.filter(
    (s) => s.required && s.files.length === 0,
  );

  const el = document.getElementById('submit-summary');
  const btn = document.getElementById('submit-btn');

  if (totalSlots === 0) {
    el.innerHTML = 'Add at least one section above to get started.';
  } else {
    el.innerHTML =
      `<strong>${totalFiles}</strong> file${totalFiles !== 1 ? 's' : ''} across <strong>${totalSlots}</strong> section${totalSlots !== 1 ? 's' : ''}` +
      (missingRequired.length
        ? ` · <span style="color:var(--danger)">${missingRequired.length} required section${missingRequired.length > 1 ? 's' : ''} empty</span>`
        : ' · Ready to submit');
  }
}

// ── Custom add ─────────────────────────────────────────────────────────────
document.getElementById('custom-add-btn').addEventListener('click', () => {
  const input = document.getElementById('custom-label-input');
  addSlot(input.value);
  input.value = '';
});

document
  .getElementById('custom-label-input')
  .addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('custom-add-btn').click();
  });

// ── Submit ─────────────────────────────────────────────────────────────────
document.getElementById('submit-btn').addEventListener('click', async () => {
  // Validate required slots
  let valid = true;
  slots.forEach((s) => {
    console.log(s.files);
    const card = document.querySelector(`.slot-card[data-id="${s.id}"]`);
    if (s.required && s.files.length === 0) {
      card?.classList.add('invalid');
      card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      valid = false;
    } else {
      card?.classList.remove('invalid');
    }
  });

  if (!valid) {
    showToast('⚠ Please fill in all required sections.');
    return;
  }

  const totalFiles = slots.reduce((n, s) => n + s.files.length, 0);
  if (totalFiles === 0) {
    showToast('Add at least one file to submit.');
    return;
  }

  // Build prompt
  slots = slots.filter((s) => s.files.length);

  let promptString = initial_prompt;

  for (const slot of slots) {
    promptString += slot.label + ':';
    for (const file of slot.files) {
      promptString += `\n\t${file.name}:\n`;

      const contents = await file.text();
      promptString += contents
        .split('\n')
        .map((line) => `\t\t${line}`)
        .join('\n');
    }
    promptString += '\n\n';
  }

  console.log(promptString);
  showToast(`✓ Form submitted`, 3500);
});

// ── Init with sensible defaults ────────────────────────────────────────────
addSlot('Briefs', true);
addSlot('Containers');
addSlot('Components');
addSlot('Styles');
