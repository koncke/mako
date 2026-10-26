// =============================================================================
// motion/canvas — dibujar una escena en un lienzo 2D en el tiempo t
// =============================================================================
// Lo usan el Video Editor (el nodo del motor dibuja cada cuadro, en el reproductor y al exportar) y las miniaturas de
// la biblioteca. Es el dibujante de `estadoPedazo` (./evaluar.ts): no guarda nada entre cuadros.
//
// Trampas del lienzo que las skills de iart-ai nombran (lower-thirds y javascript-animation, MIT, (c) 2026 iart.ai):
//   · `letterSpacing` queda puesto hasta que se vuelve a poner: se resetea siempre;
//   · una fuente que no cargó no da error: se dibuja con la del sistema. Quien llama carga antes (./fuentes.ts);
//   · los dígitos van en celdas del ancho del «0» (no hay `tabular-nums` en un lienzo), igual que el `1ch` del CSS;
//   · el recorte de una máscara tiene que ser tan ancho como lo que revela, o el texto queda cortado en la pausa.
// Funciona con CanvasRenderingContext2D y con OffscreenCanvasRenderingContext2D.
// =============================================================================

import { fragmentosDeTexto } from './escena';
import { escalaLatido, estadoPedazo, type EstadoPedazo } from './evaluar';
import type { Capa, CapaCaja, CapaCifra, CapaForma, CapaTexto, Escena } from './tipos';

export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const VISIBLE = 0.002;

function fuente(c: Pick<CapaTexto, 'peso' | 'familia' | 'cursiva'>, px: number): string {
  return `${c.cursiva ? 'italic ' : ''}${c.peso} ${px.toFixed(2)}px "${c.familia}", "Inter", system-ui, sans-serif`;
}

function espaciado(ctx: Ctx2D, px: number) {
  if ('letterSpacing' in ctx) (ctx as { letterSpacing: string }).letterSpacing = `${px.toFixed(2)}px`;
}

/** Aplica escala alrededor de (cx, cy). */
function escalarEn(ctx: Ctx2D, cx: number, cy: number, sx: number, sy: number) {
  if (sx === 1 && sy === 1) return;
  ctx.translate(cx, cy);
  ctx.scale(sx, sy);
  ctx.translate(-cx, -cy);
}

function caja(ctx: Ctx2D, c: CapaCaja, W: number, H: number, t: number) {
  const s = estadoPedazo(c, 0, t);
  const alfa = s.alfa * (c.tinta ?? 1);
  if (alfa <= VISIBLE || s.escalaX <= 0 || s.escalaY <= 0 || s.escala <= 0) return;
  const x = c.x * W;
  const y = c.y * H;
  const w = c.w * W;
  const h = c.h * H;
  ctx.save();
  ctx.globalAlpha = alfa;
  const lat = escalaLatido(c.latido, t);
  escalarEn(ctx, x + w / 2, y + h / 2, lat, lat);
  escalarEn(ctx, x + w / 2, y + h / 2, s.escala, s.escala);
  // crecer-x nace en el borde izquierdo; crecer-y, en el de abajo (una barra crece desde el piso).
  escalarEn(ctx, x, y + h, s.escalaX, s.escalaY);
  if (s.corteDer > 0) {
    ctx.beginPath();
    ctx.rect(x, y - 1, w * (1 - s.corteDer), h + 2);
    ctx.clip();
  }
  const r = Math.max(0, Math.min(c.radio * W, w / 2, h / 2));
  ctx.beginPath();
  if (r > 0 && 'roundRect' in ctx) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
  ctx.fillStyle = c.color;
  ctx.fill();
  ctx.restore();
}

function forma(ctx: Ctx2D, c: CapaForma, W: number, H: number, t: number) {
  const s = estadoPedazo(c, 0, t);
  const alfa = s.alfa * (c.tinta ?? 1);
  if (alfa <= VISIBLE || s.escala <= 0) return;
  const cx = c.cx * W;
  const cy = c.cy * H;
  const r = c.r * W;
  ctx.save();
  ctx.globalAlpha = alfa;
  ctx.translate(cx, cy);
  const lat = escalaLatido(c.latido, t);
  ctx.scale(s.escala * lat, s.escala * lat);
  ctx.rotate((s.rot * Math.PI) / 180);
  ctx.beginPath();
  if (c.puntas < 3) ctx.arc(0, 0, r, 0, Math.PI * 2);
  else {
    for (let i = 0; i < c.puntas * 2; i++) {
      const ang = (Math.PI / c.puntas) * i - Math.PI / 2;
      const rr = i % 2 === 0 ? r : r * c.interior;
      if (i === 0) ctx.moveTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
      else ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
    }
    ctx.closePath();
  }
  ctx.fillStyle = c.color;
  ctx.fill();
  ctx.restore();
}

/** Dibuja un pedazo de texto en (x, centro de su línea) con su estado. */
function pedazoTexto(ctx: Ctx2D, p: {
  s: EstadoPedazo; txt: string; x: number; w: number; yLinea: number; altoLinea: number; px: number; mascara: boolean;
  corte: number; tachado: boolean; alfaBase: number; apretar: number;
}) {
  const { s } = p;
  const alfa = s.alfa * p.alfaBase;
  if (alfa <= VISIBLE || s.escala <= 0) return;
  // Del todo debajo de su máscara, o recortado entero: no hay nada que dibujar.
  if ((p.mascara && Math.abs(s.dyAlto) >= 1) || p.corte + (1 - p.corte) * s.corteDer >= 1) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, alfa);
  if (p.mascara) {
    ctx.beginPath();
    ctx.rect(p.x - p.px, p.yLinea, p.w + p.px * 2, p.altoLinea);
    ctx.clip();
  }
  // El recorte fijo (las estrellas) y el del barrido, como el `clip-path` del CSS: de `inset(0 100% …)` al fijo.
  const cortar = p.corte + (1 - p.corte) * s.corteDer;
  if (cortar > 0) {
    ctx.beginPath();
    ctx.rect(p.x - p.px, p.yLinea - p.altoLinea, p.px + p.w * (1 - cortar), p.altoLinea * 3);
    ctx.clip();
  }
  const cy = p.yLinea + p.altoLinea / 2 + s.dyEm * p.px + s.dyAlto * p.altoLinea;
  const cx = p.x + p.w / 2 + s.dxEm * p.px;
  ctx.translate(cx, cy);
  if (s.rot) ctx.rotate((s.rot * Math.PI) / 180);
  if (s.escala !== 1) ctx.scale(s.escala, s.escala);
  if (p.apretar !== 1) ctx.scale(p.apretar, 1);
  if (s.blurEm > 0.001 && 'filter' in ctx) ctx.filter = `blur(${(s.blurEm * p.px).toFixed(2)}px)`;
  const ancho = p.w / p.apretar;
  ctx.fillText(p.txt, -ancho / 2, 0);
  if (p.tachado) ctx.fillRect(-ancho / 2, -p.px * 0.04, ancho, Math.max(1, p.px * 0.07));
  ctx.restore();
}

function textoCapa(ctx: Ctx2D, c: CapaTexto, W: number, H: number, t: number) {
  const px = c.tam * W;
  const alto = px * c.interlineado;
  const anchoCaja = c.ancho * W;
  const lat = escalaLatido(c.latido, t);
  ctx.save();
  ctx.font = fuente(c, px);
  espaciado(ctx, c.tracking * px);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = c.color;
  const frags = fragmentosDeTexto(c.lineas, c.partir);
  const total = frags.length;
  if (lat !== 1) {
    const yc = c.y * H + (c.lineas.length * alto) / 2;
    escalarEn(ctx, c.x * W + anchoCaja / 2, yc, lat, lat);
  }
  let idx = 0;
  c.lineas.forEach((linea0, li) => {
    const linea = c.mayus ? linea0.toLocaleUpperCase('es') : linea0;
    const wLinea = ctx.measureText(linea).width;
    const apretar = wLinea > anchoCaja && wLinea > 0 ? anchoCaja / wLinea : 1;
    const wReal = wLinea * apretar;
    const x0 = c.x * W + (c.alinear === 'izquierda' ? 0 : c.alinear === 'derecha' ? anchoCaja - wReal : (anchoCaja - wReal) / 2);
    const yLinea = c.y * H + li * alto;
    const base = { yLinea, altoLinea: alto, px, mascara: c.entra.efecto === 'subir' || c.sale?.efecto === 'subir', corte: c.corte ?? 0, tachado: !!c.tachado, alfaBase: c.tinta ?? 1, apretar };
    if (c.partir === 'linea') {
      pedazoTexto(ctx, { ...base, s: estadoPedazo(c, idx, t), txt: linea, x: x0, w: wReal });
      idx++;
      return;
    }
    // Palabras o letras: cada una donde termina lo anterior de su línea, medido con la misma fuente. Los espacios no
    // son pedazos (fragmentosDeTexto los saltea), así que el índice sólo avanza con lo que se dibuja.
    const piezas = c.partir === 'palabra' ? linea.split(' ') : Array.from(linea);
    const sep = c.partir === 'palabra' ? ' ' : '';
    piezas.forEach((pieza, j) => {
      if (!pieza.trim()) return;
      const previo = j ? piezas.slice(0, j).join(sep) + sep : '';
      const xPieza = x0 + ctx.measureText(previo).width * apretar;
      const w = ctx.measureText(pieza).width * apretar;
      if (idx < total) pedazoTexto(ctx, { ...base, s: estadoPedazo(c, idx, t), txt: pieza, x: xPieza, w });
      idx++;
    });
  });
  espaciado(ctx, 0);
  ctx.restore();
}

function cifraCapa(ctx: Ctx2D, c: CapaCifra, W: number, H: number, t: number) {
  const px = c.tam * W;
  const alto = px * c.interlineado;
  const anchoCaja = c.ancho * W;
  ctx.save();
  ctx.font = fuente(c, px);
  espaciado(ctx, c.tracking * px);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillStyle = c.color;
  const celda = ctx.measureText('0').width;
  const anchos = c.partes.map((p) => ('d' in p ? celda : ctx.measureText(p.s).width));
  const total = anchos.reduce((a, b) => a + b, 0);
  const apretar = total > anchoCaja && total > 0 ? anchoCaja / total : 1;
  const x0 = c.x * W + (c.alinear === 'izquierda' ? 0 : c.alinear === 'derecha' ? anchoCaja - total * apretar : (anchoCaja - total * apretar) / 2);
  const y = c.y * H;
  const lat = escalaLatido(c.latido, t);
  if (lat !== 1) escalarEn(ctx, c.x * W + anchoCaja / 2, y + alto / 2, lat, lat);
  if (apretar !== 1) {
    ctx.translate(x0, 0);
    ctx.scale(apretar, 1);
    ctx.translate(-x0, 0);
  }
  let x = x0;
  c.partes.forEach((p, i) => {
    const w = anchos[i];
    const s = estadoPedazo(c, i, t);
    const alfa = s.alfa * (c.tinta ?? 1);
    if (alfa > VISIBLE) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, alfa);
      if ('d' in p) {
        // El odómetro: la columna 0-9 corrida `d·avance` renglones, recortada a uno.
        ctx.beginPath();
        ctx.rect(x - 1, y, w + 2, alto);
        ctx.clip();
        const pos = p.d * s.rodar;
        const desde = Math.max(0, Math.floor(pos) - 1);
        const hasta = Math.min(9, Math.ceil(pos) + 1);
        for (let k = desde; k <= hasta; k++) ctx.fillText(String(k), x + w / 2, y + alto / 2 + (k - pos) * alto);
      } else {
        ctx.fillText(p.s, x + w / 2, y + alto / 2);
      }
      ctx.restore();
    }
    x += w;
  });
  espaciado(ctx, 0);
  ctx.restore();
}

function capa(ctx: Ctx2D, c: Capa, W: number, H: number, t: number) {
  if (c.k === 'caja') caja(ctx, c, W, H, t);
  else if (c.k === 'forma') forma(ctx, c, W, H, t);
  else if (c.k === 'cifra') cifraCapa(ctx, c, W, H, t);
  else textoCapa(ctx, c, W, H, t);
}

/** Dibuja la escena entera en el cuadro t (ms). Limpia antes; con fondo, lo pinta. */
export function dibujarEscena(ctx: Ctx2D, escena: Escena, t: number, W: number, H: number): void {
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  if (escena.fondo) {
    ctx.fillStyle = escena.fondo;
    ctx.fillRect(0, 0, W, H);
  }
  for (const c of escena.capas) capa(ctx, c, W, H, t);
  if ('filter' in ctx) ctx.filter = 'none';
  ctx.restore();
}
