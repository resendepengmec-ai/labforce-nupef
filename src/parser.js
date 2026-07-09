(function registerParser(global) {
  function parseLocaleNumber(value) {
    const normalized = value.trim().replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function splitDataLine(line) {
    const trimmed = line.trim();

    if (!trimmed) {
      return [];
    }

    if (trimmed.includes("\t")) {
      return trimmed.split(/\t+/).map((item) => item.trim());
    }

    if (trimmed.includes(";")) {
      return trimmed.split(";").map((item) => item.trim());
    }

    if (/\s+/.test(trimmed)) {
      return trimmed.split(/\s+/);
    }

    if (trimmed.includes(",")) {
      return trimmed.split(",").map((item) => item.trim());
    }

    return [trimmed];
  }

  function parseTxt(text, columnMap) {
    const rows = [];
    const lines = text.split(/\r?\n/);

    for (const line of lines) {
      const rawColumns = splitDataLine(line);

      if (rawColumns.length < 4) {
        continue;
      }

      const values = rawColumns.slice(0, 4).map(parseLocaleNumber);

      if (values.some((value) => value === null)) {
        continue;
      }

      const row = {};

      columnMap.forEach((field, index) => {
        if (field !== "ignorar") {
          row[field] = values[index];
        }
      });

      if (["tempo", "fx", "fy", "fz"].every((field) => Number.isFinite(row[field]))) {
        row.fr = Math.sqrt(row.fx ** 2 + row.fy ** 2 + row.fz ** 2);
        rows.push(row);
      }
    }

    return rows;
  }

  function inspectText(text) {
    const lines = text.split(/\r?\n/);
    const nonEmptyLines = lines.filter((line) => line.trim()).length;
    const firstDataLine = lines.find((line) => parseTxt(line, ["tempo", "fx", "fy", "fz"]).length === 1);

    return {
      lines: lines.length,
      nonEmptyLines,
      firstDataLine: firstDataLine || "",
    };
  }

  function maxAbs(rows, field) {
    if (!rows.length) {
      return null;
    }

    return rows.reduce((max, row) => Math.max(max, Math.abs(row[field])), 0);
  }

  function sampleRate(rows) {
    if (rows.length < 2) {
      return 0;
    }

    const duration = rows[rows.length - 1].tempo - rows[0].tempo;

    if (duration <= 0) {
      return 0;
    }

    return (rows.length - 1) / duration;
  }

  function dominantFrequency(values, rate) {
    if (values.length < 4 || rate <= 0) {
      return 0;
    }

    const limit = Math.min(values.length, 512);
    const step = Math.max(1, Math.floor(values.length / limit));
    const sampled = [];

    for (let index = 0; index < values.length; index += step) {
      sampled.push(values[index]);
    }

    const mean = sampled.reduce((sum, value) => sum + value, 0) / sampled.length;
    const centered = sampled.map((value) => value - mean);
    const effectiveRate = rate / step;
    const maxBin = Math.floor(centered.length / 2);
    let bestBin = 0;
    let bestMagnitude = 0;

    for (let bin = 1; bin <= maxBin; bin += 1) {
      let real = 0;
      let imaginary = 0;

      for (let index = 0; index < centered.length; index += 1) {
        const angle = (2 * Math.PI * bin * index) / centered.length;
        real += centered[index] * Math.cos(angle);
        imaginary -= centered[index] * Math.sin(angle);
      }

      const magnitude = Math.sqrt(real ** 2 + imaginary ** 2);

      if (magnitude > bestMagnitude) {
        bestMagnitude = magnitude;
        bestBin = bin;
      }
    }

    return (bestBin * effectiveRate) / centered.length;
  }

  function calculateStats(rows, key) {
    const values = rows.map((row) => row[key]).filter(Number.isFinite);

    if (!values.length) {
      return null;
    }

    const count = values.length;
    const mean = values.reduce((sum, value) => sum + value, 0) / count;
    const meanSquare = values.reduce((sum, value) => sum + value ** 2, 0) / count;
    const rms = Math.sqrt(meanSquare);
    const peakMax = values.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / count;
    const standardDeviation = Math.sqrt(variance);
    const coefficientVariation = mean === 0 ? 0 : Math.abs(standardDeviation / mean);
    const crestFactor = rms === 0 ? 0 : peakMax / rms;
    const skewness = standardDeviation === 0
      ? 0
      : values.reduce((sum, value) => sum + ((value - mean) / standardDeviation) ** 3, 0) / count;
    const kurtosis = standardDeviation === 0
      ? 0
      : values.reduce((sum, value) => sum + ((value - mean) / standardDeviation) ** 4, 0) / count;

    return {
      mean,
      rms,
      peakMax,
      standardDeviation,
      coefficientVariation,
      crestFactor,
      kurtosis,
      skewness,
      dominantFrequency: dominantFrequency(values, sampleRate(rows)),
    };
  }

  global.ForceLabParser = {
    parseLocaleNumber,
    splitDataLine,
    parseTxt,
    inspectText,
    maxAbs,
    sampleRate,
    dominantFrequency,
    calculateStats,
  };
})(typeof window === "undefined" ? globalThis : window);
