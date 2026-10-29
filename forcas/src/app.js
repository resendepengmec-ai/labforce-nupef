const materials = {
  aluminio: { label: "Aluminio", kc: 700 },
  "aco-baixo-carbono": { label: "Aco baixo carbono", kc: 1800 },
  "aco-medio-carbono": { label: "Aco medio carbono", kc: 2200 },
  "ferro-fundido": { label: "Ferro fundido", kc: 1500 },
  bronze: { label: "Bronze", kc: 1000 },
};

const defaults = {
  material: "aco-baixo-carbono",
  kc: 1800,
  feed: 0.25,
  depth: 2,
  speed: 120,
};

const form = document.querySelector("#cutting-form");
const materialInput = document.querySelector("#material");
const kcInput = document.querySelector("#kc");
const resetButton = document.querySelector("#reset-button");
const txtFileInput = document.querySelector("#txt-file");
const columnMapInputs = Array.from(document.querySelectorAll("[data-column-map]"));
let importedText = "";
let importedRows = [];
let selectedRange = { start: 0, end: 0 };
let dragStartIndex = null;
let dragStartX = 0;
let isDraggingSelection = false;

const outputs = {
  area: document.querySelector("#area"),
  force: document.querySelector("#force"),
  power: document.querySelector("#power"),
  removal: document.querySelector("#removal"),
  regime: document.querySelector("#regime"),
  formula: document.querySelector("#formula"),
  chip: document.querySelector("#chip"),
  chipLabel: document.querySelector("#chip-label"),
  forceArrow: document.querySelector("#force-arrow"),
  fileStatus: document.querySelector("#file-status"),
  importMessage: document.querySelector("#import-message"),
  sampleCount: document.querySelector("#sample-count"),
  fxMax: document.querySelector("#fx-max"),
  fyMax: document.querySelector("#fy-max"),
  fzMax: document.querySelector("#fz-max"),
  frMax: document.querySelector("#fr-max"),
  previewBody: document.querySelector("#preview-body"),
  openAnalysis: document.querySelector("#open-analysis"),
  analysisModal: document.querySelector("#analysis-modal"),
  closeAnalysis: document.querySelector("#close-analysis"),
  chartChannel: document.querySelector("#chart-channel"),
  resetSelection: document.querySelector("#reset-selection"),
  downloadCsv: document.querySelector("#download-csv"),
  signalChart: document.querySelector("#signal-chart"),
  selectionLabel: document.querySelector("#selection-label"),
  statsBody: document.querySelector("#stats-body"),
};

const numberFormat = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
});

const preciseFormat = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 6,
});

const statChannels = [
  { key: "fx", label: "Fx" },
  { key: "fy", label: "Fy" },
  { key: "fz", label: "Fz" },
  { key: "fr", label: "Fr" },
];

function readNumber(id) {
  return Number(document.querySelector(`#${id}`).value) || 0;
}

function format(value, suffix, digits = 2) {
  const formatter = new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });

  return `${formatter.format(value)} ${suffix}`;
}

function classify(force, power) {
  if (force >= 5500 || power >= 8) {
    return "corte pesado";
  }

  if (force >= 2200 || power >= 3) {
    return "corte alto";
  }

  if (force >= 900 || power >= 1.2) {
    return "corte moderado";
  }

  return "corte leve";
}

function classifyChip(feed, depth, speed) {
  if (feed > 0.45 || depth > 4.5) {
    return "cavaco espesso";
  }

  if (speed > 220 && feed < 0.18) {
    return "cavaco continuo";
  }

  if (speed < 60) {
    return "cavaco irregular";
  }

  return "cavaco estavel";
}

function updateVisual(force, feed, depth, speed) {
  const forceScale = Math.min(1.35, Math.max(0.7, force / 2200));
  const chipScale = Math.min(1.45, Math.max(0.75, (feed * depth) / 0.5));
  const speedShift = Math.min(12, Math.max(-10, (speed - 120) / 12));

  outputs.forceArrow.style.transform = `scaleX(${forceScale})`;
  outputs.chip.style.transform = `rotate(${-18 - speedShift}deg) scaleY(${chipScale})`;
}

function getColumnMap() {
  return columnMapInputs.map((input) => input.value);
}

function formatForce(value) {
  if (value === null) {
    return "-";
  }

  return `${numberFormat.format(value)} N`;
}

function renderPreview(rows) {
  const visibleRows = rows.slice(0, 8);

  if (!visibleRows.length) {
    outputs.previewBody.innerHTML = '<tr><td colspan="5">Nenhuma linha numerica valida encontrada.</td></tr>';
    return;
  }

  outputs.previewBody.innerHTML = visibleRows.map((row) => `
    <tr>
      <td>${numberFormat.format(row.tempo)}</td>
      <td>${numberFormat.format(row.fx)}</td>
      <td>${numberFormat.format(row.fy)}</td>
      <td>${numberFormat.format(row.fz)}</td>
      <td>${numberFormat.format(row.fr)}</td>
    </tr>
  `).join("");
}

function normalizeRange(start, end) {
  const maxIndex = Math.max(0, importedRows.length - 1);
  const safeStart = Math.max(0, Math.min(maxIndex, Math.round(start)));
  const safeEnd = Math.max(0, Math.min(maxIndex, Math.round(end)));

  return {
    start: Math.min(safeStart, safeEnd),
    end: Math.max(safeStart, safeEnd),
  };
}

function getSelectedRows() {
  if (!importedRows.length) {
    return [];
  }

  const range = normalizeRange(selectedRange.start, selectedRange.end);
  return importedRows.slice(range.start, range.end + 1);
}

function isInsideSelectedRange(index) {
  const range = normalizeRange(selectedRange.start, selectedRange.end);
  return index >= range.start && index <= range.end;
}

function formatStat(value, suffix = "") {
  if (!Number.isFinite(value)) {
    return "-";
  }

  return `${preciseFormat.format(value)}${suffix}`;
}

function updateStats() {
  const selectedRows = getSelectedRows();

  if (!selectedRows.length) {
    outputs.statsBody.innerHTML = '<tr><td colspan="10">Aguardando selecao.</td></tr>';
    outputs.downloadCsv.disabled = true;
    return;
  }

  outputs.statsBody.innerHTML = statChannels.map((channel) => {
    const stats = window.ForceLabParser.calculateStats(selectedRows, channel.key);

    if (!stats) {
      return `<tr><td>${channel.label}</td><td colspan="9">Sem dados.</td></tr>`;
    }

    return `
      <tr>
        <td>${channel.label}</td>
        <td>${formatStat(stats.mean)}</td>
        <td>${formatStat(stats.rms)}</td>
        <td>${formatStat(stats.peakMax)}</td>
        <td>${formatStat(stats.standardDeviation)}</td>
        <td>${formatStat(stats.coefficientVariation)}</td>
        <td>${formatStat(stats.crestFactor)}</td>
        <td>${formatStat(stats.kurtosis)}</td>
        <td>${formatStat(stats.skewness)}</td>
        <td>${formatStat(stats.dominantFrequency, " Hz")}</td>
      </tr>
    `;
  }).join("");

  const range = normalizeRange(selectedRange.start, selectedRange.end);
  const startTime = importedRows[range.start].tempo;
  const endTime = importedRows[range.end].tempo;
  outputs.selectionLabel.textContent = `Faixa: ${preciseFormat.format(startTime)} s a ${preciseFormat.format(endTime)} s (${numberFormat.format(selectedRows.length)} amostras).`;
  outputs.downloadCsv.disabled = false;
}

function canvasPositionToIndex(event) {
  const rect = outputs.signalChart.getBoundingClientRect();
  const ratio = (event.clientX - rect.left) / rect.width;
  const maxIndex = Math.max(0, importedRows.length - 1);
  return Math.round(Math.max(0, Math.min(1, ratio)) * maxIndex);
}

function drawChart() {
  const canvas = outputs.signalChart;
  const context = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const padding = { top: 22, right: 24, bottom: 36, left: 58 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const channel = outputs.chartChannel.value;

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#f8faf9";
  context.fillRect(0, 0, width, height);

  if (!importedRows.length) {
    context.fillStyle = "#5b6861";
    context.font = "18px Arial";
    context.fillText("Carregue um TXT para visualizar o sinal.", padding.left, height / 2);
    return;
  }

  const maxPoints = Math.min(importedRows.length, 1400);
  const step = Math.max(1, Math.floor(importedRows.length / maxPoints));
  const points = [];

  for (let index = 0; index < importedRows.length; index += step) {
    points.push({ index, value: importedRows[index][channel] });
  }

  const values = points.map((point) => point.value).filter(Number.isFinite);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueSpan = maxValue - minValue || 1;

  function xForIndex(index) {
    return padding.left + (index / Math.max(1, importedRows.length - 1)) * plotWidth;
  }

  function yForValue(value) {
    return padding.top + (1 - ((value - minValue) / valueSpan)) * plotHeight;
  }

  context.strokeStyle = "#d8e0dc";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(padding.left, padding.top);
  context.lineTo(padding.left, padding.top + plotHeight);
  context.lineTo(padding.left + plotWidth, padding.top + plotHeight);
  context.stroke();

  const range = normalizeRange(selectedRange.start, selectedRange.end);
  const rangeX = xForIndex(range.start);
  const rangeWidth = Math.max(1, xForIndex(range.end) - rangeX);
  context.fillStyle = "rgba(25, 111, 100, 0.14)";
  context.fillRect(rangeX, padding.top, rangeWidth, plotHeight);

  context.strokeStyle = channel === "fz" ? "#c43b2f" : "#196f64";
  context.lineWidth = 1.6;
  context.beginPath();
  points.forEach((point, pointIndex) => {
    const x = xForIndex(point.index);
    const y = yForValue(point.value);

    if (pointIndex === 0) {
      context.moveTo(x, y);
    }
    else {
      context.lineTo(x, y);
    }
  });
  context.stroke();

  context.fillStyle = "#5b6861";
  context.font = "14px Arial";
  context.fillText(`${channel.toUpperCase()} | min ${preciseFormat.format(minValue)} | max ${preciseFormat.format(maxValue)}`, padding.left, 18);
  context.fillText(`${preciseFormat.format(importedRows[0].tempo)} s`, padding.left, height - 10);
  context.fillText(`${preciseFormat.format(importedRows[importedRows.length - 1].tempo)} s`, width - 120, height - 10);
}

function updateAnalysis() {
  drawChart();
  updateStats();
}

function openAnalysisModal() {
  if (!importedRows.length) {
    return;
  }

  outputs.analysisModal.hidden = false;
  updateAnalysis();
}

function closeAnalysisModal() {
  outputs.analysisModal.hidden = true;
}

function csvNumber(value) {
  return Number.isFinite(value) ? String(value).replace(".", ",") : "";
}

function buildCsv() {
  const selectedRows = getSelectedRows();
  const rows = [
    ["tempo", "Fx", "Fy", "Fz", "Fr"],
    ...selectedRows.map((row) => [
      csvNumber(row.tempo),
      csvNumber(row.fx),
      csvNumber(row.fy),
      csvNumber(row.fz),
      csvNumber(row.fr),
    ]),
  ];

  return rows.map((row) => row.join(";")).join("\n");
}

function downloadCsv() {
  const csv = buildCsv();
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "forcelab-faixa.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function updateImportedData() {
  if (!importedText) {
    return;
  }

  const rows = window.ForceLabParser.parseTxt(importedText, getColumnMap());
  importedRows = rows;

  outputs.sampleCount.textContent = `${numberFormat.format(rows.length)} amostras`;
  outputs.fxMax.textContent = formatForce(window.ForceLabParser.maxAbs(rows, "fx"));
  outputs.fyMax.textContent = formatForce(window.ForceLabParser.maxAbs(rows, "fy"));
  outputs.fzMax.textContent = formatForce(window.ForceLabParser.maxAbs(rows, "fz"));
  outputs.frMax.textContent = formatForce(window.ForceLabParser.maxAbs(rows, "fr"));
  outputs.importMessage.textContent = rows.length
    ? "Arquivo lido. A tabela mostra as primeiras amostras validas."
    : buildImportErrorMessage();
  outputs.openAnalysis.disabled = !rows.length;
  outputs.downloadCsv.disabled = !rows.length;
  selectedRange = { start: 0, end: Math.max(0, rows.length - 1) };
  renderPreview(rows);
  updateAnalysis();
}

function buildImportErrorMessage() {
  const info = window.ForceLabParser.inspectText(importedText);
  return `Revise o arquivo ou o mapeamento: nao encontrei quatro colunas numericas validas em ${numberFormat.format(info.nonEmptyLines)} linhas. Tab e virgula decimal sao aceitos.`;
}

function calculate() {
  const kc = readNumber("kc");
  const feed = readNumber("feed");
  const depth = readNumber("depth");
  const speed = readNumber("speed");

  const area = depth * feed;
  const force = kc * area;
  const power = (force * speed) / 60000;
  const removal = speed * 1000 * depth * feed;

  outputs.area.textContent = format(area, "mm2", 2);
  outputs.force.textContent = `${numberFormat.format(Math.round(force))} N`;
  outputs.power.textContent = format(power, "kW", 2);
  outputs.removal.textContent = `${numberFormat.format(Math.round(removal))} mm3/min`;
  outputs.regime.textContent = classify(force, power);
  outputs.chipLabel.textContent = classifyChip(feed, depth, speed);
  outputs.formula.textContent = `Fc = ${numberFormat.format(kc)} x ${numberFormat.format(depth)} x ${numberFormat.format(feed)} = ${numberFormat.format(Math.round(force))} N`;

  updateVisual(force, feed, depth, speed);
}

materialInput.addEventListener("change", (event) => {
  kcInput.value = materials[event.target.value].kc;
  calculate();
});

form.addEventListener("input", calculate);

resetButton.addEventListener("click", () => {
  materialInput.value = defaults.material;
  kcInput.value = defaults.kc;
  document.querySelector("#feed").value = defaults.feed;
  document.querySelector("#depth").value = defaults.depth;
  document.querySelector("#speed").value = defaults.speed;
  calculate();
});

txtFileInput.addEventListener("change", async (event) => {
  const file = event.target.files[0];

  if (!file) {
    importedText = "";
    importedRows = [];
    outputs.fileStatus.textContent = "nenhum arquivo";
    outputs.sampleCount.textContent = "0 amostras";
    outputs.openAnalysis.disabled = true;
    outputs.downloadCsv.disabled = true;
    renderPreview([]);
    return;
  }

  importedText = await file.text();
  outputs.fileStatus.textContent = file.name;
  updateImportedData();
});

columnMapInputs.forEach((input) => {
  input.addEventListener("change", updateImportedData);
});

outputs.openAnalysis.addEventListener("click", openAnalysisModal);
outputs.closeAnalysis.addEventListener("click", closeAnalysisModal);
outputs.chartChannel.addEventListener("change", updateAnalysis);
outputs.resetSelection.addEventListener("click", () => {
  selectedRange = { start: 0, end: Math.max(0, importedRows.length - 1) };
  updateAnalysis();
});
outputs.downloadCsv.addEventListener("click", downloadCsv);

outputs.signalChart.addEventListener("pointerdown", (event) => {
  if (!importedRows.length) {
    return;
  }

  dragStartIndex = canvasPositionToIndex(event);
  dragStartX = event.clientX;
  isDraggingSelection = false;
  outputs.signalChart.setPointerCapture(event.pointerId);
});

outputs.signalChart.addEventListener("pointermove", (event) => {
  if (dragStartIndex === null || !importedRows.length) {
    return;
  }

  if (Math.abs(event.clientX - dragStartX) < 4 && !isDraggingSelection) {
    return;
  }

  isDraggingSelection = true;
  selectedRange = normalizeRange(dragStartIndex, canvasPositionToIndex(event));
  updateAnalysis();
});

outputs.signalChart.addEventListener("pointerup", (event) => {
  if (dragStartIndex === null) {
    return;
  }

  const endIndex = canvasPositionToIndex(event);

  if (isDraggingSelection) {
    selectedRange = normalizeRange(dragStartIndex, endIndex);
    updateAnalysis();
  }
  else if (isInsideSelectedRange(endIndex)) {
    downloadCsv();
  }
  else {
    selectedRange = normalizeRange(endIndex, endIndex);
    updateAnalysis();
  }

  dragStartIndex = null;
  isDraggingSelection = false;
});

outputs.signalChart.addEventListener("pointercancel", () => {
  dragStartIndex = null;
  isDraggingSelection = false;
});

outputs.analysisModal.addEventListener("click", (event) => {
  if (event.target === outputs.analysisModal) {
    closeAnalysisModal();
  }
});

calculate();
