// The voice check with numbers (19/11/2026). The script writes numbers in WORDS (the rule: «tres mil dólares», «día dos») and the
// transcriber (scribe_v1) writes them its own way: «3000», «3.000», «$3,000», «US$3,000», or in words. chequear-guion.mjs compares
// word by word, so «tres mil dólares» against «$3,000» came out as «tres → 3», «falta: mil», «falta: dólares»: a real-looking error
// on a take that said the script. Here both sides go to digits (and «dólares», «US», «USD» go away: the transcriber writes «$»), and
// if the words then match one by one, the voice said the script.
//   mismoGuion(guion, transcripcion, ortografia) → true | false

const VALOR = {
  cero: 0, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13,
  catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintidos: 22,
  veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30,
  cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100, ciento: 100, doscientos: 200,
  doscientas: 200, trescientos: 300, trescientas: 300, cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500,
  seiscientos: 600, seiscientas: 600, setecientos: 700, setecientas: 700, ochocientos: 800, ochocientas: 800, novecientos: 900,
  novecientas: 900,
};
// «un», «una», «uno» stay words: «un lead», «una sola venta» are not amounts
const MONEDA = new Set(['dolares', 'dolar', 'usd', 'us']);

/** The same normalization as chequear-guion.mjs: lowercase, no accents, no punctuation. */
const palabras = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]/g, ' ').split(/\s+/).filter(Boolean);

/** The words, with every number as digits and without the currency word. */
export function aDigitos(texto) {
  const t = palabras(texto), out = [];
  for (let i = 0; i < t.length; i++) {
    // «3 000» (from «3.000» or «$3,000»): the groups of three digits that follow join the first one
    if (/^\d{1,3}$/.test(t[i])) { let n = t[i]; while (/^\d{3}$/.test(t[i + 1] ?? '')) n += t[++i]; out.push(String(+n)); continue; }
    if (/^\d+$/.test(t[i])) { out.push(String(+t[i])); continue; }
    if (VALOR[t[i]] == null && t[i] !== 'mil') { if (!MONEDA.has(t[i])) out.push(t[i]); continue; }
    let total = 0, cur = 0, ultimo = Infinity;
    for (; i < t.length; i++) {
      const w = t[i];
      // each word of a number is smaller than the one before («ciento cincuenta»): «tres tres» is a repetition, not six
      if (VALOR[w] != null) { if (VALOR[w] >= ultimo) break; cur += VALOR[w]; ultimo = VALOR[w]; }
      else if (w === 'mil') { total += (cur || 1) * 1000; cur = 0; ultimo = 1000; }
      // «treinta y cinco»: the «y» belongs to the number only between a ten and a unit
      else if (w === 'y' && cur % 100 >= 20 && cur % 10 === 0 && (VALOR[t[i + 1]] ?? 99) < 10) continue;
      else break;
    }
    i--;
    out.push(String(total + cur));
  }
  return out;
}

/** Does the transcription say the script, once both have their numbers as digits? `ortografia`: [script, heard] pairs. */
export function mismoGuion(guion, oido, ortografia = []) {
  const a = aDigitos(guion), b = aDigitos(oido).map((w) => (ortografia.find(([, y]) => y === w) || [w])[0]);
  // a final «s» that melts into the next word («tienes sus» → «tiene sus») is the transcriber, as in hacer.mjs
  return a.length > 0 && a.length === b.length && a.every((x, k) => x === b[k] || x === b[k] + 's' || b[k] === x + 's');
}
