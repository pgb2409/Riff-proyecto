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

// === Manejo de audio ===
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

// === Botón "La primera nota entra aquí" ===
markFirstNoteBtn.addEventListener('click', function () {
  if (!currentAudioFileName) return;
  const currentTime = audioPlayer.currentTime; // momento en que se pulsa
  currentOffset = -currentTime; // para que al reproducir desde 0, suene en ese punto
  manualOffsetInput.value = currentOffset;
  localStorage.setItem(`offset_${currentAudioFileName}`, currentOffset.toString());
  offsetStatus.textContent = `Desfase actual: ${currentOffset.toFixed(1)}s (ajustado con "primera nota")`;
});

// === Aplicar ajuste manual ===
applyManualOffsetBtn.addEventListener('click', function () {
  if (!currentAudioFileName) return;
  const value = parseFloat(manualOffsetInput.value);
  if (!isNaN(value)) {
    currentOffset = value;
    localStorage.setItem(`offset_${currentAudioFileName}`, currentOffset.toString());
    offsetStatus.textContent = `Desfase actual: ${currentOffset.toFixed(1)}s (ajustado manualmente)`;
  }
});

// === Manejo de partitura ===
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
