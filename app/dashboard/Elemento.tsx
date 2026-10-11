'use client';

// =============================================================================
// Elemento — lo que se inserta como en Looker: texto, imagen, formas y flechas (punto 18)
// =============================================================================
// Martín, 11/10/2026 (punto 18 del feedback): el Dashboard es un editor de informes estilo Looker
// Studio, y Looker deja INSERTAR texto, imágenes, líneas y formas además de gráficos. El modelo vive en
// lib/graficos-catalogo.ts (`Elemento`, `sanearElemento`); acá se dibuja y se edita.
//
//   · `CuerpoElemento` llena la celda de la grilla (flex: 1 y min-height: 0, NUNCA height: 100%: contra
//     un alto de flex no resuelve en Safari y la caja da CERO, AGENTS.md «Dos reglas de layout»).
//   · `PropsElemento` es el CONTENIDO del panel de la derecha; el panel (el <aside>) lo pone la pantalla.
//
// ⚠️ LOS COLORES SALEN DE LA PALETA DEL TEMA DE LA HOJA, nunca de un hex escrito acá: `e.color` es un
//    ÍNDICE de `colores` (la paleta de la plantilla, con el acento adelante) y `null` es la TINTA de la
//    app (var(--ink)), que se da vuelta sola en el modo oscuro (html[data-tema="oscuro"]). Así un
//    rectángulo cambia de color cuando la hoja cambia de plantilla, igual que las series de un gráfico,
//    y ningún elemento puede quedar «mal combinado» con el tema (punto 8). tests/graficos-elementos
//    barre este archivo y falla con un hex literal.
// ⚠️ LAS FORMAS SE DIBUJAN EN PÍXELES REALES, MIDIENDO LA CELDA. La salida que aparece primero —un
//    viewBox fijo con preserveAspectRatio="none"— estira la punta de la flecha y el grosor con la caja:
//    una flecha de 3 columnas por 2 filas salía con la punta aplastada como un guion. Se mide con un
//    ResizeObserver sobre clientWidth/clientHeight (el tamaño de LAYOUT: si algún día el lienzo tiene
//    zoom por `transform`, getBoundingClientRect devolvería el tamaño ya escalado y se dibujaría dos
//    veces más chico) y la geometría la arma una función PURA (`geometriaElemento`), que es lo que el
//    test mide.

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { TIPOS_ELEMENTO, urlDeImagen, type Elemento, type TipoElemento } from '@/lib/graficos-catalogo';
import { Button, Switch } from '@/app/_ui';
import { BotonBorrar } from '@/app/_ui/BotonBorrar';
import { IconoMenu } from '@/app/_ui/iconos-menu';

type Direccion = Elemento['direccion'];
type Grosor = Elemento['grosor'];
type Tamano = Elemento['tamano'];
type Alinear = Elemento['alinear'];

// ── El color ────────────────────────────────────────────────────────────────────────────

/** La tinta de la app: el color de un elemento sin color elegido. Es un token, así que se da vuelta en oscuro. */
export const TINTA = 'var(--ink)';

/**
 * El color con el que se pinta un elemento: el de la paleta del tema en el índice elegido, o la tinta.
 * Un índice que la paleta no tiene (una plantilla con menos colores) cae a la tinta, nunca a un hex.
 */
export function colorDeElemento(e: Pick<Elemento, 'color'>, colores: readonly string[]): string {
  const c = e.color == null ? null : colores[e.color];
  return typeof c === 'string' && c ? c : TINTA;
}

/** Cuánto se tiñe el interior de una forma rellena: el color de la paleta al 18 %, como un fondo. */
export const RELLENO = 0.18;

// ── El texto ────────────────────────────────────────────────────────────────────────────

/**
 * Los cuatro tamaños del texto. El peso sube con el tamaño: un título de 36 px en 400 se lee flojo y un
 * cuerpo de 14 px en 700 grita. El interlineado baja con el tamaño por la misma razón.
 */
export const TAMANOS_TEXTO: Record<Tamano, { px: number; peso: number; alto: number; nombre: string }> = {
  s: { px: 14, peso: 400, alto: 1.5, nombre: 'Chico' },
  m: { px: 18, peso: 500, alto: 1.4, nombre: 'Mediano' },
  l: { px: 26, peso: 600, alto: 1.2, nombre: 'Grande' },
  xl: { px: 36, peso: 700, alto: 1.12, nombre: 'Muy grande' },
};

const ALINEAR_CSS: Record<Alinear, CSSProperties['textAlign']> = { izquierda: 'left', centro: 'center', derecha: 'right' };

/** Un salto de línea es un PÁRRAFO (el modelo lo dice así). Los `\r` de un pegado desde Windows no cuentan. */
export const parrafosDe = (t: string): string[] => t.replace(/\r\n?/g, '\n').split('\n');

function estiloTexto(e: Elemento, colores: readonly string[]): CSSProperties {
  const t = TAMANOS_TEXTO[e.tamano] ?? TAMANOS_TEXTO.m;
  return {
    // La letra de la HOJA (varsDeTema la pinta en el contenedor del lienzo); sin tema, la de la app.
    fontFamily: 'var(--dash-letra, inherit)',
    fontSize: t.px, fontWeight: t.peso, lineHeight: t.alto,
    letterSpacing: t.px >= 26 ? '-0.015em' : undefined,
    textAlign: ALINEAR_CSS[e.alinear] ?? 'left',
    color: colorDeElemento(e, colores),
  };
}

// ── La geometría de las formas (PURA: es lo que mide el test) ───────────────────────────

/** El trazo en píxeles de cada grosor. El 1 no es 1 px: sobre una pantalla común 1 px se pierde. */
export const TRAZO: Record<Grosor, number> = { 1: 1.5, 2: 2.5, 3: 4, 4: 6 };

export const esVertical = (d: Direccion): boolean => d === 'arriba' || d === 'abajo';

export type FormaSvg =
  | { f: 'rect'; x: number; y: number; w: number; h: number; rx: number }
  | { f: 'elipse'; cx: number; cy: number; rx: number; ry: number }
  | { f: 'linea'; x1: number; y1: number; x2: number; y2: number }
  | { f: 'punta'; puntos: Array<[number, number]> };

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Lo que se dibuja de una forma en una caja de `ancho`×`alto` píxeles. Todo queda ADENTRO de la caja
 * contando el trazo (un borde cortado por el `overflow` de la celda se lee como un dibujo roto): por eso
 * el rectángulo y la elipse se meten medio trazo, y la línea arranca y termina a medio trazo del borde
 * (su punta redondeada sobresale exactamente eso).
 *
 * La flecha es un tallo + una punta triangular en la dirección elegida. La punta crece con el grosor
 * pero nunca pasa del 45 % del largo ni del alto de la caja, así una flecha corta o chata sigue siendo
 * una flecha. El tallo termina UN píxel adentro de la base de la punta: si termina justo en la base,
 * el redondeo del trazo asoma por los costados de la punta.
 *
 * `[]` = no hay nada que dibujar (texto, imagen, o una caja demasiado chica para el trazo).
 */
export function geometriaElemento(tipo: TipoElemento, direccion: Direccion, grosor: Grosor, ancho: number, alto: number): FormaSvg[] {
  if (!(ancho > 0) || !(alto > 0)) return [];
  const s = TRAZO[grosor] ?? TRAZO[2];
  const m = s / 2;
  switch (tipo) {
    case 'rectangulo': {
      const w = ancho - s, h = alto - s;
      if (w <= 0 || h <= 0) return [];
      return [{ f: 'rect', x: r2(m), y: r2(m), w: r2(w), h: r2(h), rx: r2(Math.max(0, Math.min(8, w / 4, h / 4))) }];
    }
    case 'circulo': {
      const rx = ancho / 2 - m, ry = alto / 2 - m;
      if (rx <= 0 || ry <= 0) return [];
      return [{ f: 'elipse', cx: r2(ancho / 2), cy: r2(alto / 2), rx: r2(rx), ry: r2(ry) }];
    }
    case 'linea': {
      if (esVertical(direccion)) return alto > s ? [{ f: 'linea', x1: r2(ancho / 2), y1: r2(m), x2: r2(ancho / 2), y2: r2(alto - m) }] : [];
      return ancho > s ? [{ f: 'linea', x1: r2(m), y1: r2(alto / 2), x2: r2(ancho - m), y2: r2(alto / 2) }] : [];
    }
    case 'flecha': {
      const vertical = esVertical(direccion);
      const largo = vertical ? alto : ancho; // a lo largo de la flecha
      const travesia = vertical ? ancho : alto; // de costado
      const margen = 1;
      const punta = Math.min(Math.max(10, s * 3.5), largo * 0.45);
      const mitad = Math.min(punta * 0.6, travesia / 2 - margen);
      if (largo <= s + 2 || mitad <= 0) return [];
      const c = travesia / 2;
      const haciaElFin = direccion === 'derecha' || direccion === 'abajo';
      const tip = haciaElFin ? largo - margen : margen;
      const base = haciaElFin ? tip - punta : tip + punta;
      const cola = haciaElFin ? m : largo - m;
      const finTallo = haciaElFin ? base + 1 : base - 1;
      // (a lo largo, de costado) → (x, y): en una flecha vertical los ejes se cruzan.
      const P = (a: number, t: number): [number, number] => (vertical ? [r2(t), r2(a)] : [r2(a), r2(t)]);
      const [x1, y1] = P(cola, c);
      const [x2, y2] = P(finTallo, c);
      return [
        { f: 'linea', x1, y1, x2, y2 },
        { f: 'punta', puntos: [P(tip, c), P(base, c - mitad), P(base, c + mitad)] },
      ];
    }
    default:
      return [];
  }
}

/** El tamaño de una línea o flecha VERTICAL recién dada vuelta (la horizontal sale de TIPOS_ELEMENTO). */
const TAMANO_VERTICAL: Partial<Record<TipoElemento, { w: number; h: number }>> = { linea: { w: 1, h: 6 }, flecha: { w: 2, h: 4 } };

/**
 * El cambio de dirección de una línea o flecha. Dar vuelta el EJE (horizontal ↔ vertical) en la caja
 * de siempre deja algo inusable —una línea vertical de 30 px en medio de una celda de seis columnas—,
 * así que si la caja es chata para el eje nuevo, se le da la forma del eje nuevo. Si la persona ya la
 * había agrandado en ese sentido, el tamaño se respeta: ahí la caja ya es suya.
 */
export function parcheDeDireccion(e: Pick<Elemento, 'tipo' | 'direccion' | 'w' | 'h'>, nueva: Direccion): Partial<Elemento> {
  const p: Partial<Elemento> = { direccion: nueva };
  if (esVertical(nueva) === esVertical(e.direccion)) return p;
  const vertical = TAMANO_VERTICAL[e.tipo];
  const horizontal = TIPOS_ELEMENTO.find((t) => t.id === e.tipo);
  if (!vertical || !horizontal) return p;
  if (esVertical(nueva) && e.h <= 2) { p.w = vertical.w; p.h = vertical.h; }
  if (!esVertical(nueva) && e.w <= 2) { p.w = horizontal.w; p.h = horizontal.h; }
  return p;
}

/** El dibujo de una forma en una caja ya medida. Exportado para el test: es lo que se ve. */
export function SvgElemento({ e, colores, ancho, alto }: { e: Elemento; colores: readonly string[]; ancho: number; alto: number }) {
  const formas = geometriaElemento(e.tipo, e.direccion, e.grosor, ancho, alto);
  if (!formas.length) return null;
  const s = TRAZO[e.grosor] ?? TRAZO[2];
  // `currentColor` y el color en el `style`: un var(--token) en un atributo de presentación SVG no
  // está garantizado en todos los motores; en CSS, sí.
  const relleno = e.relleno ? { fill: 'currentColor', fillOpacity: RELLENO } : { fill: 'none' };
  return (
    <svg width={ancho} height={alto} viewBox={`0 0 ${ancho} ${alto}`} aria-hidden style={{ display: 'block', color: colorDeElemento(e, colores) }}>
      {formas.map((f, i) => {
        if (f.f === 'rect') return <rect key={i} x={f.x} y={f.y} width={f.w} height={f.h} rx={f.rx} {...relleno} stroke="currentColor" strokeWidth={s} />;
        if (f.f === 'elipse') return <ellipse key={i} cx={f.cx} cy={f.cy} rx={f.rx} ry={f.ry} {...relleno} stroke="currentColor" strokeWidth={s} />;
        if (f.f === 'linea') return <line key={i} x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2} stroke="currentColor" strokeWidth={s} strokeLinecap="round" />;
        return <polygon key={i} points={f.puntos.map((p) => p.join(',')).join(' ')} fill="currentColor" />;
      })}
    </svg>
  );
}

// ── La imagen: lo que se puede subir ────────────────────────────────────────────────────

/**
 * El tope de una imagen subida: 4 MB, el MISMO número que `MAX` de app/api/graficos/imagen/route.ts
 * (el test los compara). Vercel corta el cuerpo de una función en 4,5 MB con un 413 en HTML; avisar
 * acá, antes de subir, es lo que evita que la persona espere una subida que iba a rebotar.
 */
export const MAX_IMAGEN = 4 * 1024 * 1024;
/** Sólo raster: un SVG es un documento ACTIVO y el bucket es público (el server además mira los bytes). */
export const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

/** Por qué no se puede subir este archivo, o null. Un `type` vacío lo decide el server (mira los bytes). */
export function problemaDeArchivo(f: { size: number; type: string }): string | null {
  if (f.type && !(TIPOS_IMAGEN as readonly string[]).includes(f.type)) return 'Usa JPG, PNG, WEBP o GIF';
  if (f.size > MAX_IMAGEN) return 'La imagen pasa de 4 MB';
  return null;
}

async function subirImagen(f: File): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const fd = new FormData();
  fd.append('file', f);
  try {
    // `signal` con el tope de la ruta + margen: un fetch sin corte con la red caída no resuelve nunca.
    const r = await fetch('/api/graficos/imagen', { method: 'POST', body: fd, signal: AbortSignal.timeout(70_000) });
    // Un 413 de Vercel llega en HTML, no en JSON: que no reviente el `json()`.
    const j = (await r.json().catch(() => null)) as { ok?: unknown; url?: unknown; error?: unknown } | null;
    const url = urlDeImagen(j?.url);
    if (r.ok && j?.ok === true && url) return { ok: true, url };
    if (typeof j?.error === 'string' && j.error) return { ok: false, error: j.error };
    return { ok: false, error: r.status === 413 ? 'La imagen pasa de 4 MB' : `No pude subirla (${r.status})` };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.name === 'TimeoutError' ? 'Tardó demasiado. Prueba de nuevo.' : 'No pude subirla. Revisa la conexión.' };
  }
}

// ── Cómo se ve en la grilla ─────────────────────────────────────────────────────────────

/** Cómo se ve en la grilla. `colores` = la paleta del tema de la hoja. */
export function CuerpoElemento({ e, colores, editando, onCambiar }: { e: Elemento; colores: string[]; editando: boolean; onCambiar: (p: Partial<Elemento>) => void }) {
  if (e.tipo === 'texto') return <CuerpoTexto e={e} colores={colores} editando={editando} onCambiar={onCambiar} />;
  if (e.tipo === 'imagen') return <CuerpoImagen e={e} editando={editando} />;
  return <CuerpoForma e={e} colores={colores} />;
}

/**
 * El texto. Editando la hoja, un DOBLE clic lo edita en el lugar (un clic solo es «seleccionar», como en
 * Looker) y se guarda al salir del campo. Escape descarta; Ctrl/⌘+Enter guarda; Enter es un párrafo.
 */
function CuerpoTexto({ e, colores, editando, onCambiar }: { e: Elemento; colores: readonly string[]; editando: boolean; onCambiar: (p: Partial<Elemento>) => void }) {
  // null = no se está escribiendo en el lugar.
  const [borrador, setBorrador] = useState<string | null>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  // ⚠️ `abierto` y no sólo `borrador`: después de un Escape el campo se desmonta, y si el navegador
  //    dispara el blur del campo que se va, el onBlur (con el borrador viejo en su clausura) guardaría
  //    lo que la persona acaba de descartar. Con la marca, cerrar es idempotente.
  const abierto = useRef(false);
  const ultimo = useRef({ borrador, texto: e.texto, onCambiar });
  useEffect(() => { ultimo.current = { borrador, texto: e.texto, onCambiar }; });

  const enLugar = editando && borrador != null;
  const abrir = () => { abierto.current = true; setBorrador(e.texto); };
  // Los handlers del campo son los del último render, así que su clausura ya trae el borrador al día.
  const cerrar = (guardar: boolean) => {
    if (!abierto.current) return;
    abierto.current = false;
    setBorrador(null);
    if (guardar && borrador != null && borrador !== e.texto) onCambiar({ texto: borrador.slice(0, 2000) });
  };

  // El foco al campo cuando se abre, con el cursor al final (no se selecciona todo: un doble clic para
  // corregir una letra no puede terminar borrando el título entero con la primera tecla).
  useEffect(() => {
    const el = campo.current;
    if (!enLugar || !el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [enLugar]);

  // Si se deja de editar la HOJA con el campo abierto (un atajo, otro botón), lo escrito se guarda: salir
  // de la edición no es descartar.
  useEffect(() => {
    if (editando) return;
    if (!abierto.current) return;
    abierto.current = false;
    const u = ultimo.current;
    if (u.borrador != null && u.borrador !== u.texto) u.onCambiar({ texto: u.borrador.slice(0, 2000) });
    setBorrador(null);
  }, [editando]);

  const estilo = estiloTexto(e, colores);

  if (enLugar) {
    return (
      <textarea
        ref={campo}
        // `lk-no-arrastrar` es el `cancel` de la grilla: sin eso, apretar adentro para mover el cursor
        // arrastra la tarjeta. Los stopPropagation son la segunda capa, por si la clase cambia.
        className="lk-no-arrastrar"
        aria-label="Texto"
        value={borrador ?? ''}
        maxLength={2000}
        onChange={(ev) => setBorrador(ev.target.value)}
        onBlur={() => cerrar(true)}
        onKeyDown={(ev) => {
          // Que Suprimir o Retroceso no borren la TARJETA mientras se escribe.
          ev.stopPropagation();
          if (ev.key === 'Escape') { ev.preventDefault(); cerrar(false); }
          else if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); cerrar(true); }
        }}
        onMouseDown={(ev) => ev.stopPropagation()}
        onTouchStart={(ev) => ev.stopPropagation()}
        onPointerDown={(ev) => ev.stopPropagation()}
        style={{
          ...estilo, flex: 1, minHeight: 0, minWidth: 0, width: '100%', boxSizing: 'border-box', resize: 'none',
          margin: 0, padding: 2, border: 'none', outline: 'none', background: 'transparent', borderRadius: 4,
          boxShadow: 'inset 0 0 0 1px var(--border-strong)', cursor: 'text',
        }}
      />
    );
  }

  const vacio = !e.texto.trim();
  return (
    <div
      onDoubleClick={editando ? (ev) => { ev.stopPropagation(); abrir(); } : undefined}
      title={editando ? 'Doble clic para editar' : undefined}
      style={{ ...estilo, flex: 1, minHeight: 0, minWidth: 0, overflowY: 'auto', overflowWrap: 'anywhere' }}
    >
      {vacio
        ? (editando ? <span style={{ color: 'var(--faint)', fontWeight: 400 }}>Doble clic para escribir</span> : null)
        : parrafosDe(e.texto).map((p, i) => (
          // Un renglón vacío es un párrafo vacío: sin el espacio duro no ocupa nada y el salto se pierde.
          <p key={i} style={{ margin: 0, marginTop: i ? '0.35em' : 0 }}>{p || ' '}</p>
        ))}
    </div>
  );
}

/** La imagen. Sin URL o con una que no carga, editando se ve un recuadro que lo dice; mirando, nada. */
function CuerpoImagen({ e, editando }: { e: Elemento; editando: boolean }) {
  // El fallo es DE ESA URL: cambiar la imagen lo borra solo, sin un efecto que lo resetee.
  const [falloDe, setFalloDe] = useState<string | null>(null);
  const url = urlDeImagen(e.url);
  const fallo = !!url && falloDe === url;

  if (!url || fallo) {
    if (!editando) return <div style={{ flex: 1, minHeight: 0 }} />;
    return (
      <div style={{
        flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 6, border: '1.5px dashed var(--border-strong)', borderRadius: 8, color: 'var(--faint)', fontSize: 13, textAlign: 'center', padding: 8, overflow: 'hidden',
      }}>
        <IconoMenu nombre="imagen" size={22} />
        <span>{fallo ? 'No pude cargar la imagen' : 'Agrega una imagen'}</span>
      </div>
    );
  }
  return (
    <div style={{ flex: 1, minHeight: 0, minWidth: 0, position: 'relative', overflow: 'hidden' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={e.texto.slice(0, 300)}
        // Sin referer: la URL del Dashboard de un cliente no tiene por qué llegarle al host de la imagen.
        referrerPolicy="no-referrer"
        loading="lazy"
        decoding="async"
        // Sin esto, arrastrar la tarjeta desde la foto arrastra la FOTO (el arrastre nativo del navegador).
        draggable={false}
        onError={() => setFalloDe(url)}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', objectFit: e.ajuste === 'contener' ? 'contain' : 'cover' }}
      />
    </div>
  );
}

/** Rectángulo, círculo, línea y flecha: un SVG del tamaño exacto de la celda. */
function CuerpoForma({ e, colores }: { e: Elemento; colores: readonly string[] }) {
  const caja = useRef<HTMLDivElement>(null);
  const [medida, setMedida] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = caja.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const medir = () => {
      const w = el.clientWidth, h = el.clientHeight;
      setMedida((p) => (p && p.w === w && p.h === h ? p : { w, h }));
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div style={{ flex: 1, minHeight: 0, minWidth: 0, position: 'relative' }}>
      <div ref={caja} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        {medida && medida.w > 0 && medida.h > 0 && <SvgElemento e={e} colores={colores} ancho={medida.w} alto={medida.h} />}
      </div>
    </div>
  );
}

// ── El ícono de cada tipo (para el menú Insertar y la cabecera del panel) ───────────────

/** El dibujito de un tipo de elemento, en `currentColor`. Lo puede usar el menú «Insertar» de la pantalla. */
export function IconoElemento({ tipo, size = 18 }: { tipo: TipoElemento; size?: number }) {
  if (tipo === 'imagen') return <IconoMenu nombre="imagen" size={size} />;
  const trazos: Record<Exclude<TipoElemento, 'imagen'>, ReactNode> = {
    texto: <path d="M5 7V5h14v2M12 5v14M9 19h6" />,
    rectangulo: <rect x="3.5" y="6" width="17" height="12" rx="2" />,
    circulo: <circle cx="12" cy="12" r="8" />,
    linea: <path d="M4 12h16" />,
    flecha: <><path d="M4 12h15" /><path d="m14 7 5 5-5 5" /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flex: 'none', display: 'block' }}>
      {trazos[tipo]}
    </svg>
  );
}

// ── El panel de propiedades ─────────────────────────────────────────────────────────────

// Los mismos números que `.lk-seccion` y `.lk-seccion-tit` (editor-css.ts), escritos acá para que el
// panel no dependa de que esas clases sigan existiendo; la cabecera sí usa la clase de los hermanos.
const S = {
  seccion: { display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 16px', borderBottom: '1px solid var(--border)' },
  titulo: { fontSize: 12, fontWeight: 600, color: 'var(--dim)' },
  campo: {
    width: '100%', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px',
    font: 'inherit', fontSize: 14, color: 'var(--ink)', background: 'var(--surface)',
  },
  error: { margin: 0, fontSize: 12.5, color: 'var(--bad)' },
  pie: { display: 'flex', alignItems: 'center', gap: 10, padding: 16 },
} satisfies Record<string, CSSProperties>;

function Seccion({ titulo, children }: { titulo?: string; children: ReactNode }) {
  return <div style={S.seccion}>{titulo && <div style={S.titulo}>{titulo}</div>}{children}</div>;
}

/** Botones de una sola elección (tamaño, alineación, grosor…): se ven todas las opciones a la vez. */
function Opciones<T extends string | number>({ etiqueta, valor, opciones, onElegir }: {
  etiqueta: string;
  valor: T;
  opciones: ReadonlyArray<{ id: T; nombre: string; contenido: ReactNode }>;
  onElegir: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={etiqueta} style={{ display: 'flex', gap: 4, padding: 3, borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
      {opciones.map((o) => {
        const sel = o.id === valor;
        return (
          <button key={String(o.id)} type="button" aria-pressed={sel} title={o.nombre} aria-label={o.nombre} onClick={() => onElegir(o.id)}
            style={{
              flex: 1, minWidth: 0, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              border: 'none', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 500, padding: '0 6px',
              background: sel ? 'var(--surface)' : 'transparent', color: sel ? 'var(--ink)' : 'var(--dim)',
              boxShadow: sel ? '0 0 0 1px var(--border-strong)' : 'none',
            }}>
            {o.contenido}
          </button>
        );
      })}
    </div>
  );
}

/** La tinta y las ocho muestras de la paleta de la hoja. */
function Muestras({ e, colores, onElegir }: { e: Elemento; colores: readonly string[]; onElegir: (i: number | null) => void }) {
  const paleta = colores.slice(0, 8);
  // Un índice que esta paleta no tiene se dibuja en tinta (colorDeElemento): entonces la elegida es la tinta.
  const elegido = e.color != null && e.color < paleta.length && paleta[e.color] ? e.color : null;
  const anillo = '0 0 0 2px var(--surface), 0 0 0 4px var(--ink)';
  return (
    <div role="group" aria-label="Color" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      <button type="button" aria-pressed={elegido == null} title="Tinta" onClick={() => onElegir(null)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, height: 26, padding: '0 10px 0 6px', borderRadius: 999, cursor: 'pointer',
          border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'inherit', fontSize: 12.5,
          boxShadow: elegido == null ? anillo : 'none',
        }}>
        <span aria-hidden style={{ width: 14, height: 14, borderRadius: 999, background: TINTA }} />
        Tinta
      </button>
      {paleta.map((c, i) => (
        <button key={i} type="button" aria-pressed={elegido === i} title={`Color ${i + 1}`} aria-label={`Color ${i + 1}`} onClick={() => onElegir(i)}
          style={{ width: 26, height: 26, padding: 0, borderRadius: 999, cursor: 'pointer', border: '1px solid var(--border)', background: c, boxShadow: elegido === i ? anillo : 'none' }} />
      ))}
    </div>
  );
}

/** Un dibujito de la línea o la flecha en una dirección: la MISMA geometría que el lienzo. */
function Mini({ tipo, direccion }: { tipo: 'linea' | 'flecha'; direccion: Direccion }) {
  const lado = 18;
  return (
    <svg width={lado} height={lado} viewBox={`0 0 ${lado} ${lado}`} aria-hidden style={{ display: 'block' }}>
      {geometriaElemento(tipo, direccion, 2, lado, lado).map((f, i) => (f.f === 'linea'
        ? <line key={i} x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2} stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
        : f.f === 'punta' ? <polygon key={i} points={f.puntos.map((p) => p.join(',')).join(' ')} fill="currentColor" /> : null))}
    </svg>
  );
}

function IconoAlinear({ a }: { a: Alinear }) {
  const cortas: Record<Alinear, string> = { izquierda: 'M4 10h10M4 18h10', centro: 'M7 10h10M7 18h10', derecha: 'M10 10h10M10 18h10' };
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden style={{ display: 'block' }}>
      <path d={`M4 6h16M4 14h16 ${cortas[a]}`} />
    </svg>
  );
}

const DIRECCIONES: ReadonlyArray<{ id: Direccion; nombre: string }> = [
  { id: 'derecha', nombre: 'Derecha' }, { id: 'izquierda', nombre: 'Izquierda' }, { id: 'arriba', nombre: 'Arriba' }, { id: 'abajo', nombre: 'Abajo' },
];
const GROSORES: ReadonlyArray<{ id: Grosor; nombre: string }> = [
  { id: 1, nombre: 'Fino' }, { id: 2, nombre: 'Medio' }, { id: 3, nombre: 'Grueso' }, { id: 4, nombre: 'Muy grueso' },
];

/**
 * Sus propiedades, en el panel de la derecha cuando está seleccionado. Devuelve el CONTENIDO del panel
 * (cabecera, secciones y el pie con Duplicar y Eliminar); el <aside> lo pone la pantalla.
 *
 * ⚠️ Con `key` por elemento: los campos que guardan un borrador local (el enlace de la imagen) se
 *    siembran de props, y un `useState` sembrado de props no se resiembra si la pantalla reusa este
 *    panel para OTRO elemento sin desmontarlo (AGENTS.md, «Un `useState` sembrado de props…»).
 */
export function PropsElemento(p: { e: Elemento; colores: string[]; onCambiar: (p: Partial<Elemento>) => void; onDuplicar: () => void; onBorrar: () => void }) {
  return <PanelElemento key={p.e.id} {...p} />;
}

function PanelElemento({ e, colores, onCambiar, onDuplicar, onBorrar }: { e: Elemento; colores: string[]; onCambiar: (p: Partial<Elemento>) => void; onDuplicar: () => void; onBorrar: () => void }) {
  const idTexto = useId();
  const nombre = TIPOS_ELEMENTO.find((t) => t.id === e.tipo)?.nombre ?? 'Elemento';
  const forma = e.tipo === 'rectangulo' || e.tipo === 'circulo';
  const trazada = forma || e.tipo === 'linea' || e.tipo === 'flecha';

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* La cabecera de los paneles hermanos (Propiedades.tsx): pegada arriba al scrollear el panel. */}
      <div className="lk-props-cab"><IconoElemento tipo={e.tipo} size={20} /><span className="lk-props-nombre">{nombre}</span></div>

      {e.tipo === 'texto' && (
        <>
          <Seccion>
            <label htmlFor={idTexto} style={S.titulo}>Texto</label>
            <textarea id={idTexto} value={e.texto} maxLength={2000} rows={4} onChange={(ev) => onCambiar({ texto: ev.target.value })}
              style={{ ...S.campo, resize: 'vertical', lineHeight: 1.45 }} />
          </Seccion>
          <Seccion titulo="Tamaño">
            <Opciones etiqueta="Tamaño" valor={e.tamano} onElegir={(v) => onCambiar({ tamano: v })}
              opciones={(['s', 'm', 'l', 'xl'] as const).map((k, i) => ({
                id: k, nombre: TAMANOS_TEXTO[k].nombre,
                contenido: <span style={{ fontSize: [12, 14, 16, 19][i], fontWeight: TAMANOS_TEXTO[k].peso, lineHeight: 1 }}>Aa</span>,
              }))} />
          </Seccion>
          <Seccion titulo="Alineación">
            <Opciones etiqueta="Alineación" valor={e.alinear} onElegir={(v) => onCambiar({ alinear: v })}
              opciones={([['izquierda', 'Izquierda'], ['centro', 'Centro'], ['derecha', 'Derecha']] as const).map(([id, n]) => ({ id, nombre: n, contenido: <IconoAlinear a={id} /> }))} />
          </Seccion>
        </>
      )}

      {e.tipo === 'imagen' && <SeccionesImagen e={e} onCambiar={onCambiar} />}

      {e.tipo !== 'imagen' && (
        <Seccion titulo="Color"><Muestras e={e} colores={colores} onElegir={(i) => onCambiar({ color: i })} /></Seccion>
      )}

      {forma && (
        <Seccion><Switch checked={e.relleno} onChange={(v) => onCambiar({ relleno: v })} label="Relleno" /></Seccion>
      )}

      {trazada && (
        <Seccion titulo="Grosor">
          <Opciones etiqueta="Grosor" valor={e.grosor} onElegir={(v) => onCambiar({ grosor: v })}
            opciones={GROSORES.map((g) => ({
              id: g.id, nombre: g.nombre,
              contenido: <svg width={26} height={12} viewBox="0 0 26 12" aria-hidden style={{ display: 'block' }}><line x1={3} y1={6} x2={23} y2={6} stroke="currentColor" strokeWidth={TRAZO[g.id]} strokeLinecap="round" /></svg>,
            }))} />
        </Seccion>
      )}

      {e.tipo === 'linea' && (
        <Seccion titulo="Orientación">
          <Opciones etiqueta="Orientación" valor={esVertical(e.direccion) ? 'abajo' : 'derecha'} onElegir={(d) => onCambiar(parcheDeDireccion(e, d))}
            opciones={[
              { id: 'derecha' as const, nombre: 'Horizontal', contenido: <><Mini tipo="linea" direccion="derecha" />Horizontal</> },
              { id: 'abajo' as const, nombre: 'Vertical', contenido: <><Mini tipo="linea" direccion="abajo" />Vertical</> },
            ]} />
        </Seccion>
      )}

      {e.tipo === 'flecha' && (
        <Seccion titulo="Dirección">
          <Opciones etiqueta="Dirección" valor={e.direccion} onElegir={(d) => onCambiar(parcheDeDireccion(e, d))}
            opciones={DIRECCIONES.map((d) => ({ id: d.id, nombre: d.nombre, contenido: <Mini tipo="flecha" direccion={d.id} /> }))} />
        </Seccion>
      )}

      <div style={S.pie}>
        <Button variant="secondary" size="sm" icon={<IconoMenu nombre="duplicar" size={15} />} onClick={onDuplicar}>Duplicar</Button>
        <BotonBorrar onClick={onBorrar} texto="Eliminar" title="Eliminar este elemento" talla="sm" />
      </div>
    </div>
  );
}

/** Imagen: subir un archivo o pegar un enlace https, cómo se ajusta y su descripción. */
function SeccionesImagen({ e, onCambiar }: { e: Elemento; onCambiar: (p: Partial<Elemento>) => void }) {
  const idUrl = useId();
  const idAlt = useId();
  const archivo = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // El enlace se escribe en un BORRADOR y se aplica al salir: `urlDeImagen` sanea y tira lo que no es
  // https, así que atado directo al valor guardado, «htt» se borraría con la tercera letra.
  const [borrador, setBorrador] = useState(e.url);
  // Si la URL cambia desde afuera (una subida, un deshacer), el campo la muestra. Es el ajuste de
  // estado durante el render que React documenta para esto: sin un efecto que pinte dos veces.
  const [vista, setVista] = useState(e.url);
  if (vista !== e.url) { setVista(e.url); setBorrador(e.url); }

  const aplicar = () => {
    const v = borrador.trim();
    if (!v) { setError(null); if (e.url) onCambiar({ url: '' }); return; }
    const ok = urlDeImagen(v);
    if (!ok) { setError('Sólo enlaces https'); return; }
    setError(null);
    if (ok !== e.url) onCambiar({ url: ok });
  };

  const subir = async (f: File) => {
    const problema = problemaDeArchivo(f);
    if (problema) { setError(problema); return; }
    setError(null);
    setSubiendo(true);
    const r = await subirImagen(f);
    setSubiendo(false);
    if (r.ok) onCambiar({ url: r.url });
    else setError(r.error);
  };

  return (
    <>
      <Seccion titulo="Imagen">
        <div>
          <Button variant="secondary" size="sm" loading={subiendo} icon={<IconoMenu nombre="subir" size={15} />} onClick={() => archivo.current?.click()}>
            Subir imagen
          </Button>
          <input ref={archivo} type="file" accept={TIPOS_IMAGEN.join(',')} hidden
            onChange={(ev) => { const f = ev.target.files?.[0]; ev.target.value = ''; if (f) void subir(f); }} />
        </div>
        <label htmlFor={idUrl} style={S.titulo}>O pega un enlace</label>
        <input id={idUrl} type="url" inputMode="url" placeholder="https://" value={borrador}
          onChange={(ev) => setBorrador(ev.target.value)} onBlur={aplicar}
          onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.preventDefault(); aplicar(); } }}
          style={S.campo} />
        {error && <p role="alert" style={S.error}>{error}</p>}
      </Seccion>
      <Seccion titulo="Ajuste">
        <Opciones etiqueta="Ajuste" valor={e.ajuste} onElegir={(v) => onCambiar({ ajuste: v })}
          opciones={[
            { id: 'cubrir' as const, nombre: 'Llenar el recuadro', contenido: 'Llenar' },
            { id: 'contener' as const, nombre: 'Verla entera', contenido: 'Entera' },
          ]} />
      </Seccion>
      <Seccion>
        <label htmlFor={idAlt} style={S.titulo}>Descripción</label>
        <input id={idAlt} value={e.texto} maxLength={300} placeholder="Qué muestra la imagen" onChange={(ev) => onCambiar({ texto: ev.target.value })} style={S.campo} />
      </Seccion>
    </>
  );
}
