// Elementos del DOM
const audioFileInput = document.getElementById('audioFile');
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

  const url = URL.createObjectURL(file);

  if (file.type === 'application/pdf') {
    try {
      const pdf = await pdfjsLib.getDocument(url).promise;
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
      scoreContainer.innerHTML = '<p>Error al cargar el PDF.</p>';
      console.error(err);
    }
  } else if (file.type.startsWith('image/')) {
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
