let audioPlayer = new Audio();
let currentMeasure = 1;
let offset = 0;
let bpm = 120;
let overlayDiv = null;

// === Cargar PDF con PDF.js ===
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

  // Crear overlay encima del canvas
  createOverlay(canvas);
});

function createOverlay(canvas) {
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

  canvas.parentNode.style.position = 'relative';
  canvas.parentNode.appendChild(overlayDiv);
}

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

// === Sincronización ===
audioPlayer.addEventListener('timeupdate', () => {
  const time = audioPlayer.currentTime - offset;
  currentMeasure = time < 0 ? 1 : Math.floor((time * bpm) / 60 / 4) + 1;
  document.getElementById('currentMeasure').textContent = `Compás: ${currentMeasure}`;
  highlightMeasure(currentMeasure);
});

// === Resaltado del compás (anclado al canvas) ===
function highlightMeasure(measure) {
  if (!overlayDiv) return;
  overlayDiv.innerHTML = '';

  if (measure < 1 || measure > 12) return;

  const cols = 4;
  const rows = 3;
  const col = (measure - 1) % cols;
  const row = Math.floor((measure - 1) / cols);

  const canvas = document.querySelector('#scoreContainer canvas');
  if (!canvas) return;

  const w = canvas.width / cols;
  const h = canvas.height / rows;

  const div = document.createElement('div');
  div.style.position = 'absolute';
  div.style.left = col * w + 'px';
  div.style.top = row * h + 'px';
  div.style.width = w + 'px';
  div.style.height = h + 'px';
  div.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';
  div.style.border = '2px solid gold';
  div.style.boxSizing = 'border-box';

  overlayDiv.appendChild(div);
}

// === Ajuste de sincronización ===
document.getElementById('adjustPlus').addEventListener('click', () => {
  offset += 0.2;
  document.getElementById('offsetInput').value = offset.toFixed(1);
});
document.getElementById('adjustMinus').addEventListener('click', () => {
  offset -= 0.2;
  document.getElementById('offsetInput').value = offset.toFixed(1);
});

// === Saltos de compás ===
document.getElementById('prev2').addEventListener('click', () => jumpMeasures(-2));
document.getElementById('prev1').addEventListener('click', () => jumpMeasures(-1));
document.getElementById('next1').addEventListener('click', () => jumpMeasures(1));
document.getElementById('next2').addEventListener('click', () => jumpMeasures(2));

function jumpMeasures(delta) {
  const newMeasure = Math.max(1, currentMeasure + delta);
  const newTime = ((newMeasure - 1) * 4 * 60) / bpm + offset;
  audioPlayer.currentTime = Math.max(0, newTime);
}
