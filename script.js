let audioPlayer = new Audio();
let currentMeasure = 1;
let offset = 0;
let bpm = 120;

// === Cargar PDF: usamos un objeto <embed> que sí se ve en todos los navegadores ===
document.getElementById('scoreFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file || file.type !== 'application/pdf') return;

  const url = URL.createObjectURL(file);
  const container = document.getElementById('scoreContainer');
  container.innerHTML = '';

  const embed = document.createElement('embed');
  embed.src = url;
  embed.type = 'application/pdf';
  embed.width = '100%';
  embed.height = '100%';
  container.appendChild(embed);

  // Ajustar overlay al tamaño del contenedor
  const overlay = document.getElementById('measureHighlightOverlay');
  const rect = container.getBoundingClientRect();
  overlay.style.width = rect.width + 'px';
  overlay.style.height = rect.height + 'px';
  overlay.style.left = rect.left + 'px';
  overlay.style.top = rect.top + 'px';
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

// === Sincronización ===
audioPlayer.addEventListener('timeupdate', () => {
  const time = audioPlayer.currentTime - offset;
  currentMeasure = time < 0 ? 1 : Math.floor((time * bpm) / 60 / 4) + 1;
  document.getElementById('currentMeasure').textContent = `Compás: ${currentMeasure}`;
  highlightMeasure(currentMeasure);
});

// === Resaltado del compás (4 columnas x 3 filas = 12 compases) ===
function highlightMeasure(measure) {
  const overlay = document.getElementById('measureHighlightOverlay');
  overlay.innerHTML = '';

  if (measure < 1 || measure > 12) return;

  const cols = 4;
  const rows = 3;
  const col = (measure - 1) % cols;
  const row = Math.floor((measure - 1) / cols);

  const w = overlay.offsetWidth / cols;
  const h = overlay.offsetHeight / rows;

  const div = document.createElement('div');
  div.style.position = 'absolute';
  div.style.left = col * w + 'px';
  div.style.top = row * h + 'px';
  div.style.width = w + 'px';
  div.style.height = h + 'px';
  div.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';
  div.style.border = '2px solid gold';
  div.style.boxSizing = 'border-box';

  overlay.appendChild(div);
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
