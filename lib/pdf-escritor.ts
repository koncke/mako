// =============================================================================
// pdf-escritor — un PDF 1.4 armado a mano, sin dependencias
// =============================================================================
// SIN `server-only` y SIN librerías: lo usa lib/offer-pdf.ts (el PDF de la tab
// Offer) y lo prueban los tests leyendo el resultado de vuelta con unpdf.
//
// POR QUÉ A MANO Y NO @react-pdf / pdf-lib / jsPDF (medido el 11/10/2026, ver
// docs/hallazgos-offer.md): agregar una dependencia es un `npm install` sobre un
// clon que comparten varias sesiones, con package.json y el lockfile ya
// modificados por otra — se lleva puesto lo ajeno o deja el lockfile desparejo
// para el build. Y lo que este documento necesita es chico: texto que se corta
// por ancho real, colores, cajas, barras y saltos de página. Con las 14 fuentes
// estándar de PDF (acá Helvetica) no hay archivos de fuente que incrustar ni que
// declarar en outputFileTracingIncludes.
//
// Lo que NO hace, a propósito: imágenes, links, compresión de streams, fuentes
// incrustadas, caracteres fuera de WinAnsi. Si un día hace falta algo de eso, ahí
// sí conviene la librería.
//
// Coordenadas: la API trabaja de ARRIBA hacia abajo (y = distancia desde el borde
// superior, como en la pantalla) y convierte al sistema de PDF (origen abajo a la
// izquierda) recién al escribir el operador. Mezclar los dos sistemas en las
// llamadas es la fuente clásica de texto dibujado fuera de la hoja.
// =============================================================================

import { aWinAnsi, anchoTexto, type FuenteEstandar } from './pdf-helvetica';

export type { FuenteEstandar } from './pdf-helvetica';

// ── El saneador de glifos ────────────────────────────────────────────────────
// WinAnsi no tiene flechas, ✦, emoji ni varios espacios y guiones tipográficos.
// Un lector de PDF que recibe un código que la fuente no tiene NO falla: dibuja
// otra cosa o nada (medido con jsPDF: «→ ✦» salía «!' '&»). Así que todo texto
// entra por acá antes de llegar al stream.

/** Reemplazos legibles para lo que WinAnsi no trae. Lo que no esté acá y no sea
 *  WinAnsi se DESCARTA y queda anotado. */
const EQUIVALENTES: Record<string, string> = {
  '→': '›', '⟶': '›', '➜': '›', '➔': '›', '⇒': '›', '►': '›', '▶': '›',
  '←': '‹', '⟵': '‹', '⇐': '‹', '◄': '‹', '◀': '‹',
  '↑': '^', '↓': 'v',
  '≥': '>=', '≤': '<=', '≠': '!=', '≈': '~', '−': '-',
  '‐': '-', '‑': '-', '‒': '-', '―': '—', '⁃': '-',
  '✓': '•', '✔': '•', '☑': '•', '▪': '•', '■': '•', '◆': '•', '●': '•', '○': '•', '◦': '•', '‣': '•',
  ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ', '　': ' ',
  ' ': '\n', ' ': '\n', '\t': '  ', '\r': '',
  '′': "'", '″': '"', '‛': '‘', '‟': '“',
};

/** Caracteres que se tiran en silencio porque no aportan nada al leer
 *  (marcas de ancho cero, selectores de variante de emoji). No cuentan como descarte. */
const INVISIBLES = /[​-‍⁠﻿︎️]/g;

export type TextoSaneado = { texto: string; descartes: string[] };

/**
 * Deja el texto en caracteres que Helvetica/WinAnsi sabe dibujar.
 * Devuelve también lo que descartó (sin repetir): AGENTS.md «Lo que un saneador
 * DESCARTA queda escrito» — un descarte mudo hace indistinguibles «no venía» y
 * «lo tiramos nosotros».
 */
export function textoParaPdf(entrada: string): TextoSaneado {
  const descartes = new Set<string>();
  let out = '';
  for (const ch of (entrada ?? '').normalize('NFC').replace(INVISIBLES, '')) {
    if (ch === '\n') { out += ch; continue; }
    if (aWinAnsi(ch) != null) { out += ch; continue; }
    const eq = EQUIVALENTES[ch];
    if (eq != null) { out += eq; continue; }
    // Una letra con un diacrítico que WinAnsi no tiene (ő, ą, ș…) se lee mejor sin
    // el diacrítico que desaparecida.
    const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (base && base !== ch && [...base].every((c) => aWinAnsi(c) != null)) { out += base; continue; }
    descartes.add(ch);
  }
  return { texto: out, descartes: [...descartes] };
}

// ── Colores ──────────────────────────────────────────────────────────────────

/** '#RRGGBB' → «r g b» en 0-1, con 3 decimales. Un hex roto pinta negro. */
function rgb(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0;
  const c = (v: number) => (Math.round((v / 255) * 1000) / 1000).toString();
  return `${c((n >> 16) & 255)} ${c((n >> 8) & 255)} ${c(n & 255)}`;
}

const num = (v: number): string => (Math.round(v * 100) / 100).toString();

/** Escapa una cadena ya saneada para un literal de PDF y la deja en bytes WinAnsi
 *  (un carácter JS por byte). */
function literal(s: string): string {
  let out = '';
  for (const ch of s) {
    const c = aWinAnsi(ch);
    if (c == null) continue; // ya saneado: no debería pasar
    if (c === 0x28 || c === 0x29 || c === 0x5c) out += '\\' + ch;
    else out += String.fromCharCode(c);
  }
  return `(${out})`;
}

// ── El documento ─────────────────────────────────────────────────────────────

export type EstiloTexto = {
  tam?: number;
  fuente?: FuenteEstandar;
  color?: string;
  /** Multiplicador del tamaño para la distancia entre líneas (default 1.35). */
  interlinea?: number;
  /** Corrimiento desde el margen izquierdo. */
  sangria?: number;
  /** Ancho disponible; default: el ancho útil menos la sangría. */
  ancho?: number;
  /** Espacio extra DEBAJO del bloque. */
  despues?: number;
  /** Mantener junto con el próximo bloque (para que un título no quede solo al pie). */
  conSiguiente?: number;
};

export type OpcionesPdf = {
  margen?: number;
  /** Texto del pie, a la izquierda. El «n / N» va a la derecha. */
  pie?: string;
  colorPie?: string;
};

const FUENTE_ID: Record<FuenteEstandar, string> = { 'Helvetica': 'F1', 'Helvetica-Bold': 'F2', 'Helvetica-Oblique': 'F3' };

export class PdfDoc {
  /** A4 en puntos. */
  readonly ancho = 595.28;
  readonly alto = 841.89;
  readonly margen: number;
  private readonly pie: string;
  private readonly colorPie: string;
  private paginas: string[][] = [];
  /** Cursor vertical, desde el borde superior. */
  y = 0;
  private descartados = new Set<string>();

  constructor(opts: OpcionesPdf = {}) {
    this.margen = opts.margen ?? 48;
    this.pie = opts.pie ?? '';
    this.colorPie = opts.colorPie ?? '#66707F';
    this.nuevaPagina();
  }

  get anchoUtil(): number { return this.ancho - 2 * this.margen; }
  /** Límite inferior del contenido (deja lugar para el pie). */
  get piso(): number { return this.alto - this.margen - 18; }
  get paginaActual(): number { return this.paginas.length; }
  /** Lo que el saneador descartó en todo el documento. */
  get descartes(): string[] { return [...this.descartados]; }

  nuevaPagina(): void {
    this.paginas.push([]);
    this.y = this.margen;
  }

  private op(s: string): void { this.paginas[this.paginas.length - 1].push(s); }

  /** Avanza el cursor; si no entra, pasa de página. */
  espacio(pt: number): void {
    this.y += pt;
    if (this.y > this.piso) this.nuevaPagina();
  }

  /** Garantiza `alto` puntos libres antes del piso; si no, página nueva. */
  asegurar(alto: number): void {
    if (this.y + alto > this.piso) this.nuevaPagina();
  }

  private sanea(t: string): string {
    const r = textoParaPdf(t);
    for (const d of r.descartes) this.descartados.add(d);
    return r.texto;
  }

  /** Corta un texto (ya saneado) en líneas que entran en `ancho`. */
  partir(texto: string, fuente: FuenteEstandar, tam: number, ancho: number): string[] {
    const lineas: string[] = [];
    for (const parrafo of texto.split('\n')) {
      const palabras = parrafo.split(/ +/);
      let actual = '';
      for (const p of palabras) {
        const prueba = actual ? `${actual} ${p}` : p;
        if (anchoTexto(prueba, fuente, tam) <= ancho) { actual = prueba; continue; }
        if (actual) lineas.push(actual);
        // Una palabra que sola ya no entra (una URL, un número larguísimo) se corta
        // por caracteres en vez de salirse del margen.
        if (anchoTexto(p, fuente, tam) > ancho) {
          let trozo = '';
          for (const ch of p) {
            if (anchoTexto(trozo + ch, fuente, tam) > ancho && trozo) { lineas.push(trozo); trozo = ''; }
            trozo += ch;
          }
          actual = trozo;
        } else {
          actual = p;
        }
      }
      lineas.push(actual);
    }
    return lineas;
  }

  /** Cuánto alto ocuparía un bloque de texto, sin dibujarlo. */
  medir(texto: string, e: EstiloTexto = {}): number {
    const tam = e.tam ?? 10.5;
    const fuente = e.fuente ?? 'Helvetica';
    const ancho = e.ancho ?? this.anchoUtil - (e.sangria ?? 0);
    const n = this.partir(this.sanea(texto), fuente, tam, ancho).length;
    return n * tam * (e.interlinea ?? 1.35);
  }

  /** Un bloque de texto en el flujo: corta líneas, salta de página y avanza el cursor. */
  texto(texto: string, e: EstiloTexto = {}): void {
    const tam = e.tam ?? 10.5;
    const fuente = e.fuente ?? 'Helvetica';
    const salto = tam * (e.interlinea ?? 1.35);
    const x = this.margen + (e.sangria ?? 0);
    const ancho = e.ancho ?? this.anchoUtil - (e.sangria ?? 0);
    const lineas = this.partir(this.sanea(texto), fuente, tam, ancho);
    // Un título (conSiguiente) no puede quedar solo al pie: si con su primera
    // línea y lo que pide el próximo bloque no entra, arranca en la página nueva.
    if (e.conSiguiente) this.asegurar(salto * Math.min(lineas.length, 2) + e.conSiguiente);
    for (const l of lineas) {
      if (this.y + salto > this.piso) this.nuevaPagina();
      // La línea base va a ~0,8 del alto de la caja de la línea.
      this.escribir(x, this.y + tam * 0.95, l, fuente, tam, e.color ?? '#12151B');
      this.y += salto;
    }
    if (e.despues) this.y += e.despues;
  }

  /**
   * Un bloque con TRAMOS de estilo distinto en el mismo párrafo (p.ej. «[completar]»
   * en naranja en medio de una frase). Corta por palabras igual que `texto`, pero
   * mide cada palabra con SU fuente: medir todo con la del primer tramo deja las
   * líneas con negrita adentro saliéndose del margen.
   */
  textoRico(tramos: Array<{ t: string; fuente?: FuenteEstandar; color?: string }>, e: EstiloTexto = {}): void {
    const tam = e.tam ?? 10.5;
    const salto = tam * (e.interlinea ?? 1.35);
    const x0 = this.margen + (e.sangria ?? 0);
    const ancho = e.ancho ?? this.anchoUtil - (e.sangria ?? 0);
    type Tok = { t: string; fuente: FuenteEstandar; color: string; w: number };
    const lineas: Tok[][] = [[]];
    let usado = 0;
    let espacioPendiente: Tok | null = null;
    const empujar = (tok: Tok) => { lineas[lineas.length - 1].push(tok); usado += tok.w; };
    const cortar = () => { lineas.push([]); usado = 0; espacioPendiente = null; };
    for (const tr of tramos) {
      const fuente = tr.fuente ?? e.fuente ?? 'Helvetica';
      const color = tr.color ?? e.color ?? '#12151B';
      const partes = this.sanea(tr.t).split(/(\n| +)/);
      for (const p of partes) {
        if (!p) continue;
        if (p === '\n') { cortar(); continue; }
        if (/^ +$/.test(p)) { espacioPendiente = { t: ' ', fuente, color, w: anchoTexto(' ', fuente, tam) }; continue; }
        const w = anchoTexto(p, fuente, tam);
        const esp: Tok | null = espacioPendiente;
        const conEsp = esp && lineas[lineas.length - 1].length ? esp.w : 0;
        if (usado + conEsp + w > ancho && lineas[lineas.length - 1].length) cortar();
        else if (esp && lineas[lineas.length - 1].length) empujar(esp);
        espacioPendiente = null;
        if (w > ancho) {
          // Palabra que sola no entra: se parte por caracteres.
          for (const trozo of this.partir(p, fuente, tam, ancho)) {
            if (lineas[lineas.length - 1].length) cortar();
            empujar({ t: trozo, fuente, color, w: anchoTexto(trozo, fuente, tam) });
          }
        } else {
          empujar({ t: p, fuente, color, w });
        }
      }
    }
    if (e.conSiguiente) this.asegurar(salto * Math.min(lineas.length, 2) + e.conSiguiente);
    for (const l of lineas) {
      if (this.y + salto > this.piso) this.nuevaPagina();
      let x = x0;
      for (const tok of l) {
        this.escribir(x, this.y + tam * 0.95, tok.t, tok.fuente, tam, tok.color);
        x += tok.w;
      }
      this.y += salto;
    }
    if (e.despues) this.y += e.despues;
  }

  /** Una línea suelta en una posición absoluta (y = línea base desde arriba). No corta ni salta. */
  textoEn(x: number, yBase: number, texto: string, e: { tam?: number; fuente?: FuenteEstandar; color?: string; alinear?: 'izq' | 'der' | 'centro' } = {}): void {
    const tam = e.tam ?? 10.5;
    const fuente = e.fuente ?? 'Helvetica';
    const t = this.sanea(texto).replace(/\n/g, ' ');
    const w = anchoTexto(t, fuente, tam);
    const xx = e.alinear === 'der' ? x - w : e.alinear === 'centro' ? x - w / 2 : x;
    this.escribir(xx, yBase, t, fuente, tam, e.color ?? '#12151B');
  }

  /** Ancho de un texto (lo sanea antes de medir). */
  anchoDe(texto: string, fuente: FuenteEstandar = 'Helvetica', tam = 10.5): number {
    return anchoTexto(this.sanea(texto), fuente, tam);
  }

  private escribir(x: number, yBase: number, t: string, fuente: FuenteEstandar, tam: number, color: string): void {
    if (!t) return;
    this.op(`BT /${FUENTE_ID[fuente]} ${num(tam)} Tf ${rgb(color)} rg ${num(x)} ${num(this.alto - yBase)} Td ${literal(t)} Tj ET`);
  }

  /** Rectángulo (y = borde superior, desde arriba). Radio opcional con curvas de Bézier. */
  rect(x: number, y: number, w: number, h: number, e: { relleno?: string; borde?: string; grosor?: number; radio?: number } = {}): void {
    if (w <= 0 || h <= 0) return;
    const r = Math.max(0, Math.min(e.radio ?? 0, w / 2, h / 2));
    const X = x, Y = this.alto - y - h; // esquina inferior izquierda en PDF
    let path: string;
    if (!r) {
      path = `${num(X)} ${num(Y)} ${num(w)} ${num(h)} re`;
    } else {
      const k = r * 0.5523;
      const x1 = X, x2 = X + w, y1 = Y, y2 = Y + h;
      path = [
        `${num(x1 + r)} ${num(y1)} m`,
        `${num(x2 - r)} ${num(y1)} l`,
        `${num(x2 - r + k)} ${num(y1)} ${num(x2)} ${num(y1 + r - k)} ${num(x2)} ${num(y1 + r)} c`,
        `${num(x2)} ${num(y2 - r)} l`,
        `${num(x2)} ${num(y2 - r + k)} ${num(x2 - r + k)} ${num(y2)} ${num(x2 - r)} ${num(y2)} c`,
        `${num(x1 + r)} ${num(y2)} l`,
        `${num(x1 + r - k)} ${num(y2)} ${num(x1)} ${num(y2 - r + k)} ${num(x1)} ${num(y2 - r)} c`,
        `${num(x1)} ${num(y1 + r)} l`,
        `${num(x1)} ${num(y1 + r - k)} ${num(x1 + r - k)} ${num(y1)} ${num(x1 + r)} ${num(y1)} c`,
        'h',
      ].join(' ');
    }
    const relleno = e.relleno ? `${rgb(e.relleno)} rg ` : '';
    const borde = e.borde ? `${rgb(e.borde)} RG ${num(e.grosor ?? 0.75)} w ` : '';
    const pinta = e.relleno && e.borde ? 'B' : e.relleno ? 'f' : e.borde ? 'S' : 'n';
    this.op(`q ${relleno}${borde}${path} ${pinta} Q`);
  }

  /** Una línea recta (coordenadas desde arriba). */
  linea(x1: number, y1: number, x2: number, y2: number, color = '#EAECF1', grosor = 0.75): void {
    this.op(`q ${rgb(color)} RG ${num(grosor)} w ${num(x1)} ${num(this.alto - y1)} m ${num(x2)} ${num(this.alto - y2)} l S Q`);
  }

  /** Una barra de progreso: carril + relleno recortado a [0, 1] (AGENTS.md «Una barra de gráfico se recorta al 100%»). */
  barra(x: number, y: number, w: number, h: number, fraccion: number, color: string, carril = '#EAECF1'): void {
    const f = Math.max(0, Math.min(1, Number.isFinite(fraccion) ? fraccion : 0));
    this.rect(x, y, w, h, { relleno: carril, radio: h / 2 });
    if (f > 0) this.rect(x, y, Math.max(h, w * f), h, { relleno: color, radio: h / 2 });
  }

  /** El PDF terminado. Agrega el pie a cada página («n / N» a la derecha). */
  bytes(): Uint8Array {
    const total = this.paginas.length;
    const yPie = this.alto - this.margen + 14;
    this.paginas.forEach((ops, i) => {
      const color = rgb(this.colorPie);
      if (this.pie) {
        const t = this.sanea(this.pie);
        ops.push(`BT /F1 8 Tf ${color} rg ${num(this.margen)} ${num(this.alto - yPie)} Td ${literal(t)} Tj ET`);
      }
      const n = `${i + 1} / ${total}`;
      const w = anchoTexto(n, 'Helvetica', 8);
      ops.push(`BT /F1 8 Tf ${color} rg ${num(this.ancho - this.margen - w)} ${num(this.alto - yPie)} Td ${literal(n)} Tj ET`);
    });

    // Objetos: 1 catálogo, 2 páginas, 3-5 fuentes, y por página: la página y su stream.
    const objetos: string[] = [];
    const idPagina = (i: number) => 6 + i * 2;
    const idStream = (i: number) => 7 + i * 2;
    objetos[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objetos[2] = `<< /Type /Pages /Kids [${this.paginas.map((_, i) => `${idPagina(i)} 0 R`).join(' ')}] /Count ${total} >>`;
    objetos[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objetos[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    objetos[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>';
    this.paginas.forEach((ops, i) => {
      const contenido = ops.join('\n');
      objetos[idPagina(i)] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(this.ancho)} ${num(this.alto)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${idStream(i)} 0 R >>`;
      // /Length en BYTES: el contenido es un carácter JS por byte (WinAnsi), así que
      // .length ES la cuenta de bytes. Con UTF-8 no lo sería.
      objetos[idStream(i)] = `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`;
    });

    // El xref necesita el offset EXACTO en bytes de cada objeto: un offset corrido
    // es un PDF que algunos lectores reparan en silencio y otros no abren.
    let doc = '%PDF-1.4\n%âãÏÓ\n';
    const offsets: number[] = [];
    for (let id = 1; id < objetos.length; id++) {
      offsets[id] = doc.length;
      doc += `${id} 0 obj\n${objetos[id]}\nendobj\n`;
    }
    const inicioXref = doc.length;
    doc += `xref\n0 ${objetos.length}\n0000000000 65535 f \n`;
    for (let id = 1; id < objetos.length; id++) doc += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
    doc += `trailer\n<< /Size ${objetos.length} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`;

    const bytes = new Uint8Array(doc.length);
    for (let i = 0; i < doc.length; i++) bytes[i] = doc.charCodeAt(i) & 0xff;
    return bytes;
  }
}
