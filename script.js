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

// === Manejo de partitura + instrumento ===
const instrumentSelect = document.getElementById('instrumentSelect');
const instrumentStatus = document.getElementById('instrumentStatus');

// Guardar instrumento al cambiar
instrumentSelect.addEventListener('change', () => {
  const instrument = instrumentSelect.value;
  if (instrument) {
    const labels = {
      bateria: 'Batería',
      guitarra: 'Guitarra',
      bajo: 'Bajo',
      piano: 'Piano/Teclado',
      voz: 'Voz',
      saxo: 'Saxo',
      trompeta: 'Trompeta',
      violin: 'Violín',
      flauta: 'Flauta',
      otro: 'Otro'
    };
    instrumentStatus.textContent = `Practicando: ${labels[instrument]}`;
    // Guardar en localStorage por audio
    if (currentAudioFileName) {
      localStorage.setItem(`instrument_${currentAudioFileName}`, instrument);
    }
  } else {
    instrumentStatus.textContent = '';
  }
});

// Cargar instrumento guardado al cambiar audio
audioFileInput.addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (!file) return;

  currentAudioFileName = file.name;
  const url = URL.createObjectURL(file);
  audioPlayer.src = url;
  markFirstNoteBtn.disabled = false;

  // Cargar offset guardado
  const savedOffset = localStorage.getItem(`offset_${currentAudioFileName}`);
  if (savedOffset) {
    currentOffset = parseFloat(savedOffset);
    manualOffsetInput.value = currentOffset;
    offsetStatus.textContent = `Desfase actual: ${currentOffset.toFixed(1)}s (cargado de sesión anterior)`;
  } else {
    currentOffset = 0;
    manualOffsetInput.value = 0;
    offsetStatus.textContent = 'Desfase actual: 0s';
  }

  // Cargar instrumento guardado
  const savedInstrument = localStorage.getItem(`instrument_${currentAudioFileName}`);
  if (savedInstrument) {
    instrumentSelect.value = savedInstrument;
    const labels = {
      bateria: 'Batería',
      guitarra: 'Guitarra',
      bajo: 'Bajo',
      piano: 'Piano/Teclado',
      voz: 'Voz',
      saxo: 'Saxo',
      trompeta: 'Trompeta',
      violin: 'Violín',
      flauta: 'Flauta',
      otro: 'Otro'
    };
    instrumentStatus.textContent = `Practicando: ${labels[savedInstrument]}`;
  } else {
    instrumentSelect.value = '';
    instrumentStatus.textContent = '';
  }
});

// Manejar subida de partitura
scoreFileInput.addEventListener('change', async function (e) {
  const file = e.target.files[0];
  if (!file) return;

  scoreContainer.innerHTML = '<p>Cargando partitura...</p>';

  if (file.type === 'application/pdf') {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const typedarray = new Uint8Array(arrayBuffer);
      const pdf = await pdfjsLib.getDocument({  typedarray }).promise;
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
      const url = URL.createObjectURL(file);
      const embed = document.createElement('embed');
      embed.src = url;
      embed.type = 'application/pdf';
      embed.width = '100%';
      embed.height = '600px';
      scoreContainer.innerHTML = '';
      scoreContainer.appendChild(embed);
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

const bpmInput = document.getElementById('bpmInput');
const startSyncBtn = document.getElementById('startSync');
const stopSyncBtn = document.getElementById('stopSync');
const measureInfo = document.getElementById('measureInfo');
const followModeCheckbox = document.getElementById('followMode');
const currentMeasureNumber = document.getElementById('currentMeasureNumber');
const currentMeasureIndicator = document.getElementById('currentMeasureIndicator');

let bpm = 0;
let measureDuration = 0;
let currentMeasure = 0;
let syncInterval = null;
let overlayCanvas = null;

const measuresPerRow = 4;
const visibleRows = 3;
const totalMeasuresSimulated = measuresPerRow * visibleRows;

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

function clearOverlay() {
  if (!overlayCanvas) return;
  const ctx = overlayCanvas.getContext('2d');
  ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
}

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

function calculateCurrentMeasure(audioTime) {
  const syncTime = audioTime + currentOffset;
  if (syncTime < 0) return -1;
  return Math.floor(syncTime / measureDuration);
}

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

let liveFineOffset = 0;
let loopActive = false;
let loopFromMeasure = 1;
let loopToMeasure = 4;
let lastLoopKey = null;

function getLoopStorageKey() {
  return currentAudioFileName ? `loop_${currentAudioFileName}` : null;
}

function updateLiveOffsetDisplay() {
  liveOffsetDisplay.textContent = liveFineOffset.toFixed(1) + 's';
}

offsetMinusBtn.addEventListener('click', () => {
  liveFineOffset -= 0.2;
  updateLiveOffsetDisplay();
});

offsetPlusBtn.addEventListener('click', () => {
  liveFineOffset += 0.2;
  updateLiveOffsetDisplay();
});

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

  const key = getLoopStorageKey();
  if (key) {
    localStorage.setItem(key, JSON.stringify({ from, to }));
    lastLoopKey = key;
  }

  loopStatus.textContent = `Loop activo: compases ${from} a ${to}`;
  loopStatus.style.color = '#2c7';
});

clearLoopBtn.addEventListener('click', () => {
  loopActive = false;
  const key = getLoopStorageKey();
  if (key) {
    localStorage.removeItem(key);
  }
  loopStatus.textContent = 'Sin loop activo';
  loopStatus.style.color = '#888';
});

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

audioPlayer.addEventListener('timeupdate', () => {
  if (!loopActive || !bpm) return;

  const currentTime = audioPlayer.currentTime + currentOffset + liveFineOffset;
  const currentMeasureLoop = Math.floor(currentTime / (60 / bpm)) + 1;

  if (currentMeasureLoop > loopToMeasure) {
    const loopStartTime = (loopFromMeasure - 1) * (60 / bpm);
    const targetTime = loopStartTime - currentOffset - liveFineOffset;
    if (targetTime >= 0) {
      audioPlayer.currentTime = targetTime;
    }
  }
});

// === Etapa 4: Feedback visual rítmico (NUEVO) ===

const startCountdownBtn = document.getElementById('startCountdown');
const pulseCircle = document.getElementById('pulseCircle');

let pulseInterval = null;
let countdownActive = false;

function pulse() {
  pulseCircle.style.opacity = '1';
  setTimeout(() => {
    if (!countdownActive && !bpm) return;
    pulseCircle.style.opacity = '0.3';
  }, 150);
}

startCountdownBtn.addEventListener('click', () => {
  if (!bpm || bpm <= 0) {
    alert('Primero ingresa un BPM válido.');
    return;
  }

  if (pulseInterval) clearInterval(pulseInterval);

  countdownActive = true;
  const beatDuration = 60 / bpm;
  const beatsPerMeasure = 4;
  let beatCount = 0;

  pulse();

  pulseInterval = setInterval(() => {
    beatCount++;
    pulse();
    if (beatCount >= beatsPerMeasure) {
      clearInterval(pulseInterval);
      countdownActive = false;
    }
  }, beatDuration * 1000);
});

// === Etapa 5: Modos de visualización (NUEVO) ===

const toggleFormModeBtn = document.getElementById('toggleFormMode');
const toggleLookModeBtn = document.getElementById('toggleLookMode');
const modeStatus = document.getElementById('modeStatus');

let formModeActive = false;
let lookModeActive = false;

toggleFormModeBtn.addEventListener('click', () => {
  formModeActive = !formModeActive;
  lookModeActive = false;

  if (formModeActive) {
    scoreContainer.style.display = 'none';
    modeStatus.textContent = 'Modo actual: Solo forma';
    modeStatus.style.color = '#2c7';
  } else {
    scoreContainer.style.display = 'block';
    modeStatus.textContent = 'Modo actual: Normal';
    modeStatus.style.color = '#333';
  }
});

toggleLookModeBtn.addEventListener('click', () => {
  lookModeActive = !lookModeActive;
  formModeActive = false;

  if (lookModeActive) {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    audioPlayer.style.display = 'none';
    modeStatus.textContent = 'Modo actual: Solo mirar';
    modeStatus.style.color = '#2c7';
  } else {
    audioPlayer.style.display = 'block';
    modeStatus.textContent = 'Modo actual: Normal';
    modeStatus.style.color = '#333';
  }
});

// === Etapa 6: Modo profesor + compartición (NUEVO) ===

const teacherBpmInput = document.getElementById('teacherBpm');
const teacherOffsetInput = document.getElementById('teacherOffset');
const structureMarksInput = document.getElementById('structureMarks');
const teacherLoopFromInput = document.getElementById('teacherLoopFrom');
const teacherLoopToInput = document.getElementById('teacherLoopTo');
const generateLinkBtn = document.getElementById('generateLink');
const shareLinkEl = document.getElementById('shareLink');
const structureBar = document.getElementById('structureBar');

let structureMap = {};

// Cargar desde URL al iniciar
window.addEventListener('load', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const urlBpm = urlParams.get('bpm');
  const urlOffset = urlParams.get('offset');
  const urlFrom = urlParams.get('from');
  const urlTo = urlParams.get('to');
  const urlMarks = urlParams.get('marks');

  if (urlBpm) {
    bpmInput.value = urlBpm;
    teacherBpmInput.value = urlBpm;
    bpm = parseFloat(urlBpm);
    measureDuration = 60 / bpm;
    measureInfo.textContent = `Duración de compás: ${measureDuration.toFixed(2)} segundos`;
  }
  if (urlOffset) {
    currentOffset = parseFloat(urlOffset);
    manualOffsetInput.value = currentOffset;
    teacherOffsetInput.value = currentOffset;
    offsetStatus.textContent = `Desfase actual: ${currentOffset.toFixed(1)}s (de enlace)`;
  }
  if (urlFrom && urlTo) {
    loopFromInput.value = urlFrom;
    loopToInput.value = urlTo;
    teacherLoopFromInput.value = urlFrom;
    teacherLoopToInput.value = urlTo;
    loopFromMeasure = parseInt(urlFrom);
    loopToMeasure = parseInt(urlTo);
    loopActive = true;
    loopStatus.textContent = `Loop activo: compases ${urlFrom} a ${urlTo} (de enlace)`;
    loopStatus.style.color = '#2c7';
  }
  if (urlMarks) {
    structureMarksInput.value = decodeURIComponent(urlMarks);
    parseStructureMarks(urlMarks);
    showStructureBar();
  }
});

function parseStructureMarks(marksStr) {
  structureMap = {};
  if (!marksStr) return;
  const pairs = marksStr.split(',');
  pairs.forEach(pair => {
    const [measure, label] = pair.split(':');
    const m = parseInt(measure);
    if (!isNaN(m) && label) {
      structureMap[m] = label;
    }
  });
}

function showStructureBar() {
  if (Object.keys(structureMap).length === 0) {
    structureBar.style.display = 'none';
    return;
  }
  let html = '';
  for (const measure in structureMap) {
    html += `<span style="margin: 0 10px;">Compás ${measure}: ${structureMap[measure]}</span>`;
  }
  structureBar.innerHTML = html;
  structureBar.style.display = 'block';
}

generateLinkBtn.addEventListener('click', () => {
  const bpmVal = teacherBpmInput.value;
  const offsetVal = teacherOffsetInput.value;
  const fromVal = teacherLoopFromInput.value;
  const toVal = teacherLoopToInput.value;
  const marksVal = structureMarksInput.value.trim();

  if (!bpmVal) {
    alert('Ingresa el BPM.');
    return;
  }

  const baseUrl = window.location.origin + window.location.pathname;
  const params = new URLSearchParams();

  params.append('bpm', bpmVal);
  if (offsetVal) params.append('offset', offsetVal);
  if (fromVal && toVal) {
    params.append('from', fromVal);
    params.append('to', toVal);
  }
  if (marksVal) {
    params.append('marks', encodeURIComponent(marksVal));
  }

  const fullUrl = baseUrl + '?' + params.toString();
  shareLinkEl.textContent = fullUrl;
  shareLinkEl.style.display = 'block';

  // Opcional: copiar al portapapeles
  navigator.clipboard?.writeText(fullUrl).then(() => {
    alert('¡Enlace copiado al portapapeles!');
  });
});

// Sincronizar campos del profesor con los principales
teacherBpmInput.addEventListener('input', () => {
  bpmInput.value = teacherBpmInput.value;
});
teacherOffsetInput.addEventListener('input', () => {
  manualOffsetInput.value = teacherOffsetInput.value;
});
teacherLoopFromInput.addEventListener('input', () => {
  loopFromInput.value = teacherLoopFromInput.value;
});
teacherLoopToInput.addEventListener('input', () => {
  loopToInput.value = teacherLoopToInput.value;
});

// Cargar marcas cuando cambien
structureMarksInput.addEventListener('input', () => {
  parseStructureMarks(structureMarksInput.value);
  showStructureBar();
});

// === Etapa 7: Mejoras avanzadas (NUEVO) ===

const playbackRateSlider = document.getElementById('playbackRate');
const playbackRateValue = document.getElementById('playbackRateValue');
const detectBpmBtn = document.getElementById('detectBpm');
const bpmDetectionStatus = document.getElementById('bpmDetectionStatus');

// Velocidad variable
playbackRateSlider.addEventListener('input', () => {
  const rate = parseFloat(playbackRateSlider.value);
  playbackRateValue.textContent = rate + 'x';
  try {
    audioPlayer.playbackRate = rate;
  } catch (e) {
    bpmDetectionStatus.textContent = 'Tu navegador no permite cambiar la velocidad sin alterar el tono.';
  }
});

// Detección de BPM (información)
detectBpmBtn.addEventListener('click', () => {
  if (!currentAudioFileName) {
    bpmDetectionStatus.textContent = 'Primero sube un archivo de audio.';
    return;
  }
  bpmDetectionStatus.textContent = 'La detección automática requiere librerías externas. Por ahora, configura el BPM manualmente.';
});

// === ✅ Etapa 8: Exportar práctica sincronizada ===

const exportPracticeBtn = document.getElementById('exportPractice');
let currentAudioFile = null;
let currentScoreFile = null;
let currentInstrument = '';

instrumentSelect.addEventListener('change', () => {
  currentInstrument = instrumentSelect.value;
});

audioFileInput.addEventListener('change', (e) => {
  currentAudioFile = e.target.files[0];
  updateExportButton();
});

scoreFileInput.addEventListener('change', (e) => {
  currentScoreFile = e.target.files[0];
  updateExportButton();
});

function updateExportButton() {
  const ready = currentAudioFile && currentScoreFile && bpm > 0;
  exportPracticeBtn.disabled = !ready;
}

function generateOfflineHTML(config) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Práctica Offline - Music Student</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 900px; margin: 20px auto; background: #f9f9f9; }
    #scoreContainer { margin-top: 20px; text-align: center; min-height: 400px; }
    canvas, img { max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px; }
    #currentMeasureIndicator {
      position: fixed; top: 10px; right: 10px;
      background: rgba(0,0,0,0.7); color: white; padding: 6px 12px;
      border-radius: 4px; font-weight: bold; z-index: 1000;
    }
  </style>
</head>
<body>
  <h2>🎵 Práctica Offline</h2>
  <h3>Instrumento: ${config.instrumentLabel || 'No especificado'}</h3>
  <audio id="audioPlayer" controls style="width:100%"></audio>
  <div id="scoreContainer"></div>
  <div id="currentMeasureIndicator">Compás: <span id="measure">0</span></div>

  <script src="pdfjs/pdf.min.js"></script>
  <script>
    const config = ${JSON.stringify(config)};
    
    // Configurar worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdfjs/pdf.worker.min.js';
    
    const audioPlayer = document.getElementById('audioPlayer');
    const scoreContainer = document.getElementById('scoreContainer');
    const measureEl = document.getElementById('measure');

    // Cargar audio
    audioPlayer.src = config.audioFileName;
    
    let overlayCanvas = null;
    const measuresPerRow = 4;
    const visibleRows = 3;
    const totalMeasures = measuresPerRow * visibleRows;

    // Cargar partitura
    window.addEventListener('load', async () => {
      const scoreFile = config.scoreFileName;
      const ext = scoreFile.split('.').pop().toLowerCase();
      
      if (ext === 'pdf') {
        try {
          const response = await fetch(scoreFile);
          const arrayBuffer = await response.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({  new Uint8Array(arrayBuffer) }).promise;
          const page = await pdf.getPage(1);
          const scale = 1.5;
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          scoreContainer.appendChild(canvas);
          const ctx = canvas.getContext('2d');
          await page.render({ canvasContext: ctx, viewport }).promise;
          createOverlay(canvas);
        } catch (e) {
          scoreContainer.innerHTML = '<p>Error al cargar PDF.</p>';
        }
      } else {
        const img = document.createElement('img');
        img.src = scoreFile;
        img.onload = () => createOverlay(img);
        scoreContainer.appendChild(img);
      }
    });

    function createOverlay(element) {
      const rect = element.getBoundingClientRect();
      overlayCanvas = document.createElement('canvas');
      overlayCanvas.width = rect.width;
      overlayCanvas.height = rect.height;
      overlayCanvas.style.position = 'fixed';
      overlayCanvas.style.left = rect.left + 'px';
      overlayCanvas.style.top = rect.top + 'px';
      overlayCanvas.style.pointerEvents = 'none';
      overlayCanvas.style.zIndex = '10';
      document.body.appendChild(overlayCanvas);
    }

    function clearOverlay() {
      if (overlayCanvas) {
        const ctx = overlayCanvas.getContext('2d');
        ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      }
    }

    function highlightMeasure(index) {
      if (!overlayCanvas || index < 0 || index >= totalMeasures) {
        clearOverlay();
        return;
      }
      const ctx = overlayCanvas.getContext('2d');
      clearOverlay();
      const cols = measuresPerRow;
      const rows = visibleRows;
      const col = index % cols;
      const row = Math.floor(index / cols);
      const w = overlayCanvas.width / cols;
      const h = overlayCanvas.height / rows;
      ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
      ctx.fillRect(col * w, row * h, w, h);
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(col * w, row * h, w, h);
    }

    // Sincronización
    setInterval(() => {
      if (!config.bpm) return;
      const syncTime = audioPlayer.currentTime + config.offset;
      const measure = Math.floor(syncTime / (60 / config.bpm));
      measureEl.textContent = measure + 1;
      highlightMeasure(measure);
    }, 100);
  </script>
</body>
</html>`;
}

exportPracticeBtn.addEventListener('click', async () => {
  if (!currentAudioFile || !currentScoreFile || !bpm) {
    alert('Completa la configuración antes de descargar.');
    return;
  }

  const instrument = instrumentSelect.value;
  const instrumentLabels = {
    bateria: 'Batería',
    guitarra: 'Guitarra',
    bajo: 'Bajo',
    piano: 'Piano/Teclado',
    voz: 'Voz',
    saxo: 'Saxo',
    trompeta: 'Trompeta',
    violin: 'Violín',
    flauta: 'Flauta',
    otro: 'Otro'
  };
  const instrumentLabel = instrumentLabels[instrument] || 'No especificado';

  const zip = new JSZip();
  
  // Añadir archivos del usuario
  zip.file(currentAudioFile.name, currentAudioFile);
  zip.file(currentScoreFile.name, currentScoreFile);
  
  // Añadir PDF.js
  const pdfjsFiles = ['pdfjs/pdf.min.js', 'pdfjs/pdf.worker.min.js'];
  for (const path of pdfjsFiles) {
    try {
      const response = await fetch(path);
      const blob = await response.blob();
      zip.file(path, blob);
    } catch (e) {
      console.warn('No se pudo incluir PDF.js:', e);
    }
  }
  
  // Configuración
  const config = {
    audioFileName: currentAudioFile.name,
    scoreFileName: currentScoreFile.name,
    bpm: bpm,
    offset: currentOffset,
    loopFrom: loopFromMeasure,
    loopTo: loopToMeasure,
    structureMarks: structureMarksInput.value,
    instrument: instrument,
    instrumentLabel: instrumentLabel
  };
  
  // HTML offline
  const htmlContent = generateOfflineHTML(config);
  zip.file('index.html', htmlContent);
  
  // Descargar
  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, 'practica-musica-offline.zip');
  
  alert('¡Listo! Abre el ZIP y haz doble clic en "index.html" para practicar sin internet.');
  
  // Incrementar contador de descargas
  const DOWNLOAD_COUNT_KEY = 'musicApp_downloadCount';
  const downloadCount = parseInt(localStorage.getItem(DOWNLOAD_COUNT) || '0') + 1;
  localStorage.setItem(DOWNLOAD_COUNT_KEY, downloadCount.toString());
  
  // Actualizar vista
  const downloadCountEl = document.getElementById('downloadCount');
  if (downloadCountEl) {
    downloadCountEl.textContent = downloadCount;
  }
});
