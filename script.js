let audioPlayer = new Audio();
let currentMeasure = 0;
let offset = 0;
let bpm = 120; // ajustable
let overlayDiv = null;

// === Cargar PDF ===
document.getElementById('scoreFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file || file.type !== 'application/pdf') return;

  const container = document.getElementById('scoreContainer');
  container.innerHTML = '';
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ arrayBuffer }).promise;
  const page = await pdf.getPage(1);

  const scale = 1.5;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.height = viewport.height;
  canvas.width = viewport.width;

  await page.render({ canvasContext: context, viewport }).promise;
  container.appendChild(canvas);
});

// === Cargar audio ===
document.getElementById('audioFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  audioPlayer.src = URL.createObjectURL(file);
  document.getElementById('audioControls').style.display = 'block';
});

// === Reproducción ===
document.getElementById('playPause').addEventListener('click', () => {
  if (audioPlayer.paused) {
    audioPlayer.play();
    document.getElementById('playPause').textContent = '❚❚ Pausa';
  } else {
    audioPlayer.pause();
    document.getElementById('playPause').textContent = '▶ Reproducir';
  }
});

// === Sincronización en tiempo real ===
audioPlayer.addEventListener('timeupdate', () => {
  const time = audioPlayer.currentTime - offset;
  currentMeasure = time >= 0 ? Math.floor((time * bpm) / 60 / 4) : -1;
  document.getElementById('currentMeasure').textContent = `Compás: ${Math.max(0, currentMeasure)}`;
  highlightMeasure(currentMeasure);
});

// === Resaltado anclado al PDF ===
function createOverlay() {
  const container = document.getElementById('scoreContainer');
  if (!container || container.children.length === 0) return null;

  if (overlayDiv) overlayDiv.remove();

  overlayDiv = document.createElement('div');
  overlayDiv.id = 'measureHighlightOverlay';
  overlayDiv.style.position = 'absolute';
  overlayDiv.style.top = '0';
  overlayDiv.style.left = '0';
  overlayDiv.style.width = '100%';
  overlayDiv.style.height = '100%';
  overlayDiv.style.pointerEvents = 'none';
  overlayDiv.style.zIndex = '10';

  container.style.position = 'relative';
  container.appendChild(overlayDiv);
  return overlayDiv;
}

function highlightMeasure(measureIndex) {
  const overlay = createOverlay();
  if (!overlay) return;
  overlay.innerHTML = '';

  if (measureIndex < 0) return;

  // Asumimos 4 compases por fila, 3 filas → 12 compases
  const totalMeasures = 12;
  if (measureIndex >= totalMeasures) return;

  const cols = 4;
  const rows = 3;
  const col = measureIndex % cols;
  const row = Math.floor(measureIndex / cols);

  const highlight = document.createElement('div');
  highlight.style.position = 'absolute';
  highlight.style.left = `${(col / cols) * 100}%`;
  highlight.style.top = `${(row / rows) * 100}%`;
  highlight.style.width = `${100 / cols}%`;
  highlight.style.height = `${100 / rows}%`;
  highlight.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';
  highlight.style.border = '2px solid gold';
  highlight.style.boxSizing = 'border-box';

  overlay.appendChild(highlight);
}

// === Ajuste fino de sincronización ===
document.getElementById('adjustPlus').addEventListener('click', () => {
  offset += 0.2;
  document.getElementById('offsetInput').value = offset.toFixed(1);
});
document.getElementById('adjustMinus').addEventListener('click', () => {
  offset -= 0.2;
  document.getElementById('offsetInput').value = offset.toFixed(1);
});

// === Actualizar offset desde input ===
document.getElementById('offsetInput').addEventListener('change', (e) => {
  offset = parseFloat(e.target.value) || 0;
});
