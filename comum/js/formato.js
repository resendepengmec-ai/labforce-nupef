// formato.js - sprintf compativel com o msprintf do Scilab (C printf) para os
// formatos usados na rotina: %d %i %s %f %g %e com largura, precisao, 0 e -.
// Mantem as saidas (CSV, relatorio) identicas as da versao Scilab.

function fmtG(v, prec, alt) {
  if (!isFinite(v)) return isNaN(v) ? "Nan" : (v > 0 ? "Inf" : "-Inf");
  if (prec === 0) prec = 1;
  if (v === 0) return "0";
  const ex = v.toExponential(prec - 1);              // arredonda com P digitos
  const X = parseInt(ex.slice(ex.indexOf("e") + 1), 10);
  let s;
  if (X < -4 || X >= prec) {
    s = ex;
    let [man, e] = s.split("e");
    if (!alt && man.includes(".")) man = man.replace(/\.?0+$/, "");
    const en = parseInt(e, 10);
    s = man + "e" + (en < 0 ? "-" : "+") + String(Math.abs(en)).padStart(2, "0");
  } else {
    s = v.toFixed(Math.max(prec - 1 - X, 0));
    if (!alt && s.includes(".")) s = s.replace(/\.?0+$/, "");
  }
  return s;
}

function fmtNum(v, conv, prec) {
  if (!isFinite(v)) return isNaN(v) ? "Nan" : (v > 0 ? "Inf" : "-Inf");
  switch (conv) {
    case "f": return v.toFixed(prec === undefined ? 6 : prec);
    case "e": {
      const s = v.toExponential(prec === undefined ? 6 : prec);
      const [man, e] = s.split("e"); const en = parseInt(e, 10);
      return man + "e" + (en < 0 ? "-" : "+") + String(Math.abs(en)).padStart(2, "0");
    }
    case "g": return fmtG(v, prec === undefined ? 6 : prec, false);
    case "d": case "i": {
      const r = v < 0 ? -Math.floor(-v + 0.5) : Math.floor(v + 0.5);   // Scilab arredonda
      return String(r);
    }
  }
  return String(v);
}

export function sprintf(fmt, ...args) {
  let i = 0;
  return fmt.replace(/%([-0+ #]*)(\d+)?(?:\.(\d+))?([difegs%])/g, (m, flags, larg, prec, conv) => {
    if (conv === "%") return "%";
    const a = args[i++];
    let s;
    if (conv === "s") s = String(a);
    else {
      s = fmtNum(Number(a), conv, prec === undefined ? undefined : parseInt(prec, 10));
      if (flags.includes("+") && Number(a) >= 0) s = "+" + s;
    }
    if (larg) {
      const w = parseInt(larg, 10);
      if (s.length < w) {
        if (flags.includes("-")) s = s.padEnd(w, " ");
        else if (flags.includes("0") && conv !== "s" && isFinite(Number(a))) {
          const neg = s[0] === "-" || s[0] === "+";
          s = neg ? s[0] + s.slice(1).padStart(w - 1, "0") : s.padStart(w, "0");
        } else s = s.padStart(w, " ");
      }
    }
    return s;
  });
}

// Numero com virgula decimal (nv do Scilab)
export function nv(x, fmt) { return sprintf(fmt, x).replace(/\./g, ","); }
