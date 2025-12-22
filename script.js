// Elementos del DOM
const audioFile input = document.getElementById('audioFile');
const audioPlayer = document.getElementById('audioPlayer');
const scoreFileInput = document.getElementById('scoreFile');
const scoreContainer = document.getElementById('scoreContainer');
const markFirstNoteBtn = document.getElementById('markFirstNote');
const manualOffsetInput = document.getElementById('manualOffset');
const applyManualOffsetBtn = document.getElementById('applyManualOffset');
const offsetStatus = document.getElementById('offsetStatus');

let currentAudioFileName = null;
let currentOffset = 0;

// === Manejo de audio (Etapa 1) ===
audioFileInput.addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (!file) return;

  currentAudioFileName = file.name;
  const url = URL.createObjectURL(file);
  audioPlayer.src = url;
  markFirstNoteBtn.disabled = false;

  // Cargar offset guardado (si existe)
  const saved = localStorage.getItem(`offset_${currentAudioFileName}`);
  if (saved) {
    currentOffset = parseFloat(saved);
    manualOffsetInput.value = currentOffset;
    offsetStatus.textContent = `Desfase actual: ${currentOffset.toFixed(1)}s (cargado de sesión anterior)`;
  } else {
    currentOffset = 0;
    manualOffsetInput.value = 0;
    offsetStatus.textContent = 'Desfase actual: 0s';
  }
});

// === Botón "La primera nota entra aquí" (Etapa 1) ===
markFirstNoteBtn.addEventListener('click', function () {
  if (!currentAudioFileName) return;
  const currentTime = audioPlayer.currentTime;
  currentOffset = -currentTime;
  manualOffsetInput.value = currentOffset;
  localStorage.setItem(`offset_${currentAudioFileName}`, currentOffset.toString());
  offsetStatus.textContent = `Desfase actual: ${currentOffset.toFixed(1)}s (ajustado con "primera nota")`;
});

// === Aplicar ajuste manual (Etapa 1) ===
applyManualOffsetBtn.addEventListener('click', function () {
  if (!currentAudioFileName) return;
  const value = parseFloat(manualOffsetInput.value);
  if (!isNaN(value)) {
    currentOffset = value;
    localStorage.setItem(`offset_${currentAudioFileName}`, currentOffset.toString());
    offsetStatus.textContent = `Desfase actual: ${currentOffset.toFixed(1)}s (ajustado manualmente)`;
  }
});

// === Manejo de partitura (Etapa 1) ===
scoreFileInput.addEventListener('change', async function (e) {
  const file = e.target.files[0];
  if (!file) return;

  scoreContainer.innerHTML = '<p>Cargando partitura...</p>';

  if (file.type === 'application/pdf') {
    try {
      // ✅ Corrección definitiva: usar 'data' como clave
      const arrayBuffer = await file.arrayBuffer();
      const typedarray = new Uint8Array(arrayBuffer);
      const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
      const page = await pdf.getPage(1);
      const scale = 1.5;
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      scoreContainer.innerHTML = '';
      scoreContainer.appendChild(canvas);

      await page.render({ canvasContext: context, viewport }).promise;
    } catch (err) {
      scoreContainer.innerHTML = '<p>Error al cargar el PDF. Asegúrate de que el archivo sea válido.</p>';
      console.error('Error PDF:', err);
    }
  } else if (file.type.startsWith('image/')) {
    const url = URL.createObjectURL(file);
    const img = document.createElement('img');
    img.src = url;
    img.alt = 'Partitura';
    scoreContainer.innerHTML = '';
    scoreContainer.appendChild(img);
  } else {
    scoreContainer.innerHTML = '<p>Formato no soportado. Usa PDF, JPG o PNG.</p>';
  }
});

// === Etapa 2: Sincronización rítmica ===

// Elementos nuevos
const bpmInput = document.getElementById('bpmInput');
const startSyncBtn = document.getElementById('startSync');
const stopSyncBtn = document.getElementById('stopSync');
const measureInfo = document.getElementById('measureInfo');
const followModeCheckbox = document.getElementById('followMode');
const currentMeasureNumber = document.getElementById('currentMeasureNumber');
const currentMeasureIndicator = document.getElementById('currentMeasureIndicator');

// Variables de sincronización
let bpm = 0;
let measureDuration = 0; // en segundos
let currentMeasure = 0;
let syncInterval = null;
let overlayCanvas = null;

// Configuración de layout (ajustable)
const measuresPerRow = 4;   // compases por renglón
const visibleRows = 3;      // renglones visibles
const totalMeasuresSimulated = measuresPerRow * visibleRows; // 12 compases

// Crear overlay para resaltar compás
function createOverlay() {
  if (overlayCanvas) return;

  const container = scoreContainer;
  if (!container.children.length) return;

  const rect = container.getBoundingClientRect();
  overlayCanvas = document.createElement('canvas');
  overlayCanvas.id = 'measureHighlightOverlay';
  overlayCanvas.width = rect.width;
  overlayCanvas.height = rect.height;
  overlayCanvas.style.left = rect.left + 'px';
  overlayCanvas.style.top = rect.top + 'px';
  overlayCanvas.style.position = 'fixed';
  document.body.appendChild(overlayCanvas);
}

// Borrar resaltado
function clearOverlay() {
  if (!overlayCanvas) return;
  const ctx = overlayCanvas.getContext('2d');
  ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
}

// Resaltar compás actual
function highlightMeasure(measureIndex) {
  if (!overlayCanvas || measureIndex < 0 || measureIndex >= totalMeasuresSimulated) {
    clearOverlay();
    return;
  }

  const ctx = overlayCanvas.getContext('2d');
  clearOverlay();

  const cols = measuresPerRow;
  const rows = visibleRows;
  const col = measureIndex % cols;
  const row = Math.floor(measureIndex / cols);

  const w = overlayCanvas.width / cols;
  const h = overlayCanvas.height / rows;

  ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
  ctx.fillRect(col * w, row * h, w, h);

  ctx.strokeStyle = 'rgba(255, 215, 0, 0.8)';
  ctx.lineWidth = 2;
  ctx.strokeRect(col * w, row * h, w, h);
}

// Calcular compás desde tiempo de audio + offset
function calculateCurrentMeasure(audioTime) {
  const syncTime = audioTime + currentOffset;
  if (syncTime < 0) return -1;
  return Math.floor(syncTime / measureDuration);
}

// Iniciar sincronización
startSyncBtn.addEventListener('click', () => {
  const value = parseFloat(bpmInput.value);
  if (isNaN(value) || value <= 0) {
    alert('Ingresa un BPM válido (ej. 120)');
    return;
  }

  bpm = value;
  measureDuration = 60 / bpm;
  measureInfo.textContent = `Duración de compás: ${measureDuration.toFixed(2)} segundos`;

  currentMeasureIndicator.style.display = 'block';

  if (scoreContainer.children.length > 0) {
    createOverlay();
    document.getElementById('measureHighlightOverlay').style.display = 'block';
  }

  if (syncInterval) clearInterval(syncInterval);
  syncInterval = setInterval(() => {
    const audioTime = audioPlayer.currentTime;
    currentMeasure = calculateCurrentMeasure(audioTime);

    currentMeasureNumber.textContent = currentMeasure >= 0 ? currentMeasure + 1 : '—';

    if (currentMeasure >= 0 && currentMeasure < totalMeasuresSimulated) {
      highlightMeasure(currentMeasure);
    } else {
      clearOverlay();
    }
  }, 100);
});

// Detener
stopSyncBtn.addEventListener('click', () => {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  currentMeasureIndicator.style.display = 'none';
  if (overlayCanvas) {
    overlayCanvas.style.display = 'none';
    clearOverlay();
  }
  currentMeasureNumber.textContent = '0';
});

// Ajustar tamaño del overlay en resize
window.addEventListener('resize', () => {
  if (overlayCanvas && overlayCanvas.style.display !== 'none') {
    const container = scoreContainer;
    const rect = container.getBoundingClientRect();
    overlayCanvas.width = rect.width;
    overlayCanvas.height = rect.height;
    overlayCanvas.style.left = rect.left + 'px';
    overlayCanvas.style.top = rect.top + 'px';
    if (currentMeasure >= 0 && currentMeasure < totalMeasuresSimulated) {
      highlightMeasure(currentMeasure);
    }
  }
});

// === Etapa 3: Controles en vivo + loop ===

// Elementos
const offsetMinusBtn = document.getElementById('offsetMinus');
const offsetPlusBtn = document.getElementById('offsetPlus');
const liveOffsetDisplay = document.getElementById('liveOffsetDisplay');

const jumpBack2Btn = document.getElementById('jumpBack2');
const jumpBack1Btn = document.getElementById('jumpBack1');
const jumpForward1Btn = document.getElementById('jumpForward1');
const jumpForward2Btn = document.getElementById('jumpForward2');

const loopFromInput = document.getElementById('loopFrom');
const loopToInput = document.getElementById('loopTo');
const setLoopBtn = document.getElementById('setLoop');
const clearLoopBtn = document.getElementById('clearLoop');
const loopStatus = document.getElementById('loopStatus');

let liveFineOffset = 0; // ajuste fino adicional en tiempo real
let loopActive = false;
let loopFromMeasure = 1;
let loopToMeasure = 4;
let lastLoopKey = null;

// Función para obtener clave única de loop
function getLoopStorageKey() {
  return currentAudioFileName ? `loop_${currentAudioFileName}` : null;
}

// Actualizar display de offset fino
function updateLiveOffsetDisplay() {
  liveOffsetDisplay.textContent = liveFineOffset.toFixed(1) + 's';
}

// Aplicar ajuste fino
offsetMinusBtn.addEventListener('click', () => {
  liveFineOffset -= 0.2;
  updateLiveOffsetDisplay();
});

offsetPlusBtn.addEventListener('click', () => {
  liveFineOffset += 0.2;
  updateLiveOffsetDisplay();
});

// Saltar compases
function jumpMeasures(deltaMeasures) {
  if (!bpm || bpm <= 0) {
    alert('Primero ingresa un BPM válido.');
    return;
  }
  const jumpTime = deltaMeasures * (60 / bpm);
  audioPlayer.currentTime += jumpTime;
}

jumpBack2Btn.addEventListener('click', () => jumpMeasures(-2));
jumpBack1Btn.addEventListener('click', () => jumpMeasures(-1));
jumpForward1Btn.addEventListener('click', () => jumpMeasures(1));
jumpForward2Btn.addEventListener('click', () => jumpMeasures(2));

// Establecer loop
setLoopBtn.addEventListener('click', () => {
  const from = parseInt(loopFromInput.value);
  const to = parseInt(loopToInput.value);
  if (isNaN(from) || isNaN(to) || from < 1 || to < from) {
    alert('Rango de compases inválido.');
    return;
  }
  loopFromMeasure = from;
  loopToMeasure = to;
  loopActive = true;

  // Guardar en localStorage
  const key = getLoopStorageKey();
  if (key) {
    localStorage.setItem(key, JSON.stringify({ from, to }));
    lastLoopKey = key;
  }

  loopStatus.textContent = `Loop activo: compases ${from} a ${to}`;
  loopStatus.style.color = '#2c7';
});

// Limpiar loop
clearLoopBtn.addEventListener('click', () => {
  loopActive = false;
  const key = getLoopStorageKey();
  if (key) {
    localStorage.removeItem(key);
  }
  loopStatus.textContent = 'Sin loop activo';
  loopStatus.style.color = '#888';
});

// Cargar loop guardado al cambiar audio
audioFileInput.addEventListener('change', () => {
  const key = getLoopStorageKey();
  if (key) {
    const saved = localStorage.getItem(key);
    if (saved) {
      const { from, to } = JSON.parse(saved);
      loopFromInput.value = from;
      loopToInput.value = to;
      loopFromMeasure = from;
      loopToMeasure = to;
      loopStatus.textContent = `Loop guardado: compases ${from} a ${to}`;
      loopStatus.style.color = '#2c7';
      loopActive = true;
    } else {
      loopActive = false;
      loopStatus.textContent = 'Sin loop activo';
    }
  }
});

// Loop automático
audioPlayer.addEventListener('timeupdate', () => {
  if (!loopActive || !bpm) return;

  const currentTime = audioPlayer.currentTime + currentOffset + liveFineOffset;
  const currentMeasureLoop = Math.floor(currentTime / (60 / bpm)) + 1; // compás 1-based

  if (currentMeasureLoop > loopToMeasure) {
    // Saltar al inicio del loop
    const loopStartTime = (loopFromMeasure - 1) * (60 / bpm);
    const targetTime = loopStartTime - currentOffset - liveFineOffset;
    if (targetTime >= 0) {
      audioPlayer.currentTime = targetTime;
    }
  }
});
