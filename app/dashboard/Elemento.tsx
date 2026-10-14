'use client';

// =============================================================================
// Elemento — lo que se inserta como en Looker: texto, enlace, imagen, video, insertado, líneas y flechas,
// y desde la tanda v5 la sección, las conclusiones de MaKo, la acción y las piezas de una ficha
// =============================================================================
// Martín, 11/10/2026 (punto 18 del feedback): el Dashboard es un editor de informes estilo Looker
// Studio, y Looker deja INSERTAR texto, imágenes, líneas y formas además de gráficos. El modelo vive en
// lib/graficos-catalogo.ts (`Elemento`, `sanearElemento`); acá se dibuja y se edita.
// Y el mismo día (decisión 6: «Closing Analyst va COMPLETO al Dashboard, sumando los elementos Enlace,
// Video e Insertar»): el ENLACE vive acá, con el texto (se edita igual: doble clic en el lugar); el VIDEO
// y lo INSERTADO, que meten algo de otro sitio en la hoja, en ./ElementoInsertado.tsx.
//
//   · `CuerpoElemento` llena la celda de la grilla (flex: 1 y min-height: 0, NUNCA height: 100%: contra
//     un alto de flex no resuelve en Safari y la caja da CERO, AGENTS.md «Dos reglas de layout»).
//   · `PropsElemento` es el CONTENIDO del panel de la derecha; el panel (el <aside>) lo pone la pantalla.
//
// TANDA v5 (12/10/2026, contrato docs/relevo/dashboard-v5.md):
//   · SE FUERON el rectángulo y el círculo (0 guardados, medido): la línea y la flecha sueltas quedan como
//     divisores. Lo que UNE dos tarjetas es un conector (./Conectores.tsx), no una forma.
//   · La SECCIÓN (./Seccion.tsx) y, del paquete de IA y entidades, la caja de «Conclusiones de MaKo»
//     (./ElementoIA.tsx), el botón de una ACCIÓN (./ElementoAccion.tsx) y las PIEZAS de una ficha
//     (./entidades) se montan desde acá según el tipo (interfaz I3), con el contexto que les pasa la pantalla
//     (`ContextoElemento`: la hoja, el pop-up donde viven y lo que se abrió). Sus formularios del panel también
//     son de ese paquete (PropsIA, PropsAccion, PropsEntidad) y se montan en `PanelElemento`.
//   · El panel de un elemento lleva su ✕, como el de un gráfico.
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

import { useEffect, useId, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { TIPOS_ELEMENTO, topeDeTextoElemento, urlDeEnlace, urlDeImagen, type Elemento, type Hoja, type TipoElemento, type VistaValores } from '@/lib/graficos-catalogo';
import { insertableDe, videoDe } from '@/lib/embeds';
import { DOMINIOS_MAKO } from '@/lib/email-remitente';
import { Button } from '@/app/_ui';
import { BotonBorrar, BotonCerrar } from '@/app/_ui/BotonBorrar';
import { IconoMenu, type NombreIconoMenu } from '@/app/_ui/iconos-menu';
import Link from '@/app/_ui/Link';
import { CuerpoInsertado, CuerpoVideo, RecuadroVacio, soloSeleccionar, useHostPropio } from './ElementoInsertado';
import { CuerpoSeccion, PropsSeccion, type EstadoSeccion } from './Seccion';
import type { ContextoEntidad, TipoEntidad } from '@/lib/graficos-acciones';
import type { LoQueSeVe } from './PanelAnalista';
// Del paquete de IA y entidades (interfaz I3): el dibujo de cada tipo nuevo y su formulario del panel.
import { ElementoIA, PropsIA } from './ElementoIA';
import { ElementoAccion, PropsAccion } from './ElementoAccion';
import { PiezaEntidad, PropsEntidad } from './entidades/PiezaEntidad';
import { ElementoGeneral, useEnGeneral, useFunnelsGeneral, useVariablesInforme } from './ElementoGeneral';
import { PIEZAS_GENERAL, VARIABLES_TEXTO, conVariables, esPiezaGeneral, piezaPorFunnel } from '@/lib/general-piezas';

/**
 * Lo que la pantalla le cuenta a un elemento además de él mismo (interfaz I3). Todo opcional salvo la hoja: sin
 * esto, un elemento se dibuja como siempre (el texto, la imagen…) y los tipos nuevos se dibujan sin correr nada.
 */
export type ContextoElemento = {
  /** La hoja ENTERA donde vive (con el pop-up adentro, si vive en uno): la caja de IA la manda al generar. */
  hoja: Hoja;
  /** El gráfico dueño del pop-up donde vive; null = en la hoja. */
  popupDe?: string | null;
  /** Lo que se abrió (adentro de un pop-up): la entidad del clic, o la de la fila de muestra al editarlo. */
  abierto?: ContextoEntidad | null;
  /** El período del gráfico dueño del pop-up (una pieza de un anuncio lo usa: Meta pide un rango). */
  periodo?: { desde: string; hasta: string } | null;
  /** El admin: la caja de IA puede generarse a mano (la ruta lo vuelve a mirar). */
  puedeGenerar?: boolean;
  /** Un link compartido: no se pide ni se corre nada. */
  compartido?: boolean;
  /** Lo que cada gráfico de la hoja muestra AHORA (la firma de «los datos cambiaron» de una caja de IA). */
  loQueSeVe?: LoQueSeVe[];
  /** Lo elegido MIRANDO: el ↻ de una caja de IA mira eso. */
  vista?: VistaValores;
  /** Después de una acción que cambia los datos (sincronizar, re-analizar…): la hoja se vuelve a pedir. */
  onCambio?: () => void;
  /** La sección: si está plegada, cómo alternarla y cuántas piezas agrupa. */
  seccion?: EstadoSeccion;
};

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
  | { f: 'linea'; x1: number; y1: number; x2: number; y2: number }
  | { f: 'punta'; puntos: Array<[number, number]> };

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Lo que se dibuja de una línea o una flecha en una caja de `ancho`×`alto` píxeles. Todo queda ADENTRO de la
 * caja contando el trazo (un borde cortado por el `overflow` de la celda se lee como un dibujo roto): la línea
 * arranca y termina a medio trazo del borde (su punta redondeada sobresale exactamente eso). Desde v5 no hay
 * rectángulo ni círculo.
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

/** El dibujo de una línea o una flecha en una caja ya medida. Exportado para el test: es lo que se ve. */
export function SvgElemento({ e, colores, ancho, alto }: { e: Elemento; colores: readonly string[]; ancho: number; alto: number }) {
  const formas = geometriaElemento(e.tipo, e.direccion, e.grosor, ancho, alto);
  if (!formas.length) return null;
  const s = TRAZO[e.grosor] ?? TRAZO[2];
  // `currentColor` y el color en el `style`: un var(--token) en un atributo de presentación SVG no
  // está garantizado en todos los motores; en CSS, sí.
  return (
    <svg width={ancho} height={alto} viewBox={`0 0 ${ancho} ${alto}`} aria-hidden style={{ display: 'block', color: colorDeElemento(e, colores) }}>
      {formas.map((f, i) => {
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

/**
 * Cómo se ve en la grilla. `colores` = la paleta del tema de la hoja. `ctx` = lo que la pantalla le cuenta (la
 * hoja, el pop-up, lo abierto, el estado de una sección): sin él, los tipos que corren algo se dibujan quietos.
 */
export function CuerpoElemento({ e, colores, editando, onCambiar, ctx }: {
  e: Elemento; colores: readonly string[]; editando: boolean; onCambiar: (p: Partial<Elemento>) => void; ctx?: ContextoElemento;
}) {
  if (e.tipo === 'texto') return <CuerpoTexto e={e} colores={colores} editando={editando} onCambiar={onCambiar} />;
  if (e.tipo === 'enlace') return <CuerpoEnlace e={e} colores={colores} editando={editando} onCambiar={onCambiar} />;
  if (e.tipo === 'imagen') return <CuerpoImagen e={e} editando={editando} />;
  if (e.tipo === 'video') return <CuerpoVideo e={e} editando={editando} />;
  if (e.tipo === 'insertado') return <CuerpoInsertado e={e} editando={editando} />;
  if (e.tipo === 'seccion') return <CuerpoSeccion e={e} colores={colores} estado={ctx?.seccion} />;
  // Interfaz I3: los dibuja el paquete de IA y entidades; la pantalla sólo los monta con su contexto. Sin
  // contexto (un render suelto) no hay hoja que leer: no se dibujan.
  if (e.tipo === 'ia') {
    if (!ctx) return null;
    return (
      <ElementoIA e={e} hoja={ctx.hoja} popupDe={ctx.popupDe ?? null} contexto={ctx.abierto ?? null} editando={editando}
        puedeGenerar={!!ctx.puedeGenerar} compartido={!!ctx.compartido} loQueSeVe={ctx.loQueSeVe} vista={ctx.vista} />
    );
  }
  if (e.tipo === 'accion') return <ElementoAccion e={e} contexto={ctx?.abierto ?? null} editando={editando} soloLectura={!!ctx?.compartido} onCambio={ctx?.onCambio} />;
  if (e.tipo === 'general') return <ElementoGeneral e={e} />;
  if (e.tipo === 'entidad') return <PiezaEntidad e={e} contexto={ctx?.abierto ?? null} periodo={ctx?.periodo ?? null} soloLectura={!!ctx?.compartido} onCambio={ctx?.onCambio} />;
  return <CuerpoForma e={e} colores={colores} />;
}

/** Los manejadores que hacen que escribir en el lugar no mueva ni borre la TARJETA. */
const sinArrastre = {
  // `lk-no-arrastrar` es el `cancel` de la grilla: sin eso, apretar adentro para mover el cursor
  // arrastra la tarjeta. Los stopPropagation son la segunda capa, por si la clase cambia.
  className: 'lk-no-arrastrar',
  onMouseDown: (ev: ReactMouseEvent) => ev.stopPropagation(),
  onTouchStart: (ev: { stopPropagation: () => void }) => ev.stopPropagation(),
  onPointerDown: (ev: { stopPropagation: () => void }) => ev.stopPropagation(),
};

/**
 * Escribir EN EL LUGAR (el texto y el enlace): un DOBLE clic abre el campo (un clic solo es «seleccionar»,
 * como en Looker) y se guarda al salir. Uno solo para los dos: es la misma regla de cuándo se guarda y
 * cuándo se descarta, y escrita dos veces se separa.
 */
function useEnLugar(e: Elemento, editando: boolean, onCambiar: (p: Partial<Elemento>) => void) {
  // El MISMO tope que el saneo (lib/graficos-catalogo.ts): el campo no deja escribir lo que se recortaría.
  const tope = topeDeTextoElemento(e.tipo);
  // null = no se está escribiendo en el lugar.
  const [borrador, setBorrador] = useState<string | null>(null);
  // ⚠️ `abierto` y no sólo `borrador`: después de un Escape el campo se desmonta, y si el navegador
  //    dispara el blur del campo que se va, el onBlur (con el borrador viejo en su clausura) guardaría
  //    lo que la persona acaba de descartar. Con la marca, cerrar es idempotente.
  const abierto = useRef(false);
  // Lo último que se escribió, para el efecto de abajo (un efecto no ve el estado del render que lo cerró).
  const escrito = useRef<string | null>(null);
  const ultimo = useRef({ texto: e.texto, onCambiar });
  useEffect(() => { ultimo.current = { texto: e.texto, onCambiar }; });

  // Si se deja de editar la HOJA con el campo abierto (un atajo, otro botón), el campo se cierra. Es el
  // ajuste de estado DURANTE el render que React documenta para «cambió una prop», no un setState en un
  // efecto (que pinta dos veces, y que el lint de la casa rechaza).
  const [editandoVisto, setEditandoVisto] = useState(editando);
  if (editandoVisto !== editando) {
    setEditandoVisto(editando);
    if (!editando && borrador != null) setBorrador(null);
  }

  const enLugar = editando && borrador != null;
  const escribir = (v: string) => { escrito.current = v; setBorrador(v); };
  const abrir = () => { abierto.current = true; escrito.current = e.texto; setBorrador(e.texto); };
  // Los handlers del campo son los del último render, así que su clausura ya trae el borrador al día.
  const cerrar = (guardar: boolean) => {
    if (!abierto.current) return;
    abierto.current = false;
    setBorrador(null);
    if (guardar && borrador != null && borrador !== e.texto) onCambiar({ texto: borrador.slice(0, tope) });
  };

  // …y lo escrito se GUARDA: salir de la edición no es descartar. Esto sí es un efecto: le avisa al padre.
  useEffect(() => {
    if (editando || !abierto.current) return;
    abierto.current = false;
    const b = escrito.current;
    const u = ultimo.current;
    if (b != null && b !== u.texto) u.onCambiar({ texto: b.slice(0, tope) });
  }, [editando, tope]);

  return { borrador, escribir, enLugar, abrir, cerrar, tope };
}

/**
 * El foco al campo cuando se abre, con el cursor al final (no se selecciona todo: un doble clic para
 * corregir una letra no puede terminar borrando el título entero con la primera tecla).
 */
function useFocoAlAbrir(campo: { current: HTMLInputElement | HTMLTextAreaElement | null }, abierto: boolean) {
  useEffect(() => {
    const el = campo.current;
    if (!abierto || !el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [campo, abierto]);
}

/** Cómo se ve el campo de escribir en el lugar: la letra del elemento, sin borde, con un filete. */
const estiloCampoEnLugar = (estilo: CSSProperties): CSSProperties => ({
  ...estilo, minWidth: 0, width: '100%', boxSizing: 'border-box', margin: 0, padding: 2, border: 'none', outline: 'none',
  background: 'transparent', borderRadius: 4, boxShadow: 'inset 0 0 0 1px var(--border-strong)', cursor: 'text',
});

/**
 * El texto. Editando la hoja, un DOBLE clic lo edita en el lugar (un clic solo es «seleccionar», como en
 * Looker) y se guarda al salir del campo. Escape descarta; Ctrl/⌘+Enter guarda; Enter es un párrafo.
 */
function CuerpoTexto({ e, colores, editando, onCambiar }: { e: Elemento; colores: readonly string[]; editando: boolean; onCambiar: (p: Partial<Elemento>) => void }) {
  const { borrador, escribir, enLugar, abrir, cerrar, tope } = useEnLugar(e, editando, onCambiar);
  const campo = useRef<HTMLTextAreaElement>(null);
  useFocoAlAbrir(campo, enLugar);
  // Las variables («{{nombre}}», lib/general-piezas.ts) se resuelven al MIRAR; editando se ven con sus llaves.
  const variables = useVariablesInforme();

  const estilo = estiloTexto(e, colores);

  if (enLugar) {
    return (
      <textarea
        ref={campo}
        {...sinArrastre}
        aria-label="Texto"
        value={borrador ?? ''}
        maxLength={tope}
        onChange={(ev) => escribir(ev.target.value)}
        onBlur={() => cerrar(true)}
        onKeyDown={(ev) => {
          // Que Suprimir o Retroceso no borren la TARJETA mientras se escribe.
          ev.stopPropagation();
          if (ev.key === 'Escape') { ev.preventDefault(); cerrar(false); }
          else if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); cerrar(true); }
        }}
        style={{ ...estiloCampoEnLugar(estilo), flex: 1, minHeight: 0, resize: 'none' }}
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
        : parrafosDe(editando ? e.texto : conVariables(e.texto, variables)).map((p, i) => (
          // Un renglón vacío es un párrafo vacío: sin el espacio duro no ocupa nada y el salto se pierde.
          <p key={i} style={{ margin: 0, marginTop: i ? '0.35em' : 0 }}>{p || ' '}</p>
        ))}
    </div>
  );
}

/** Cómo se lee en un PDF el camino de una pantalla de MaKo: con su dominio (`hola-mako.com/crm`), no `/crm`. */
export const enlaceImpreso = (url: string): string => (url.startsWith('/') ? `${DOMINIOS_MAKO[0]}${url}` : url.replace(/^https?:\/\//, ''));

/**
 * El enlace: un texto que lleva a otro lado. A una pantalla de MaKo (un camino, `/crm`), ADENTRO y con el
 * Link de app/_ui, que conserva el cliente que se está mirando (`?ws=`); afuera (http/https), en otra
 * pestaña con `noopener noreferrer` y la flechita ↗. Editando: un clic SELECCIONA (no navega) y un doble
 * clic edita lo que se lee, en el lugar, como un texto (Enter o salir guarda; Escape descarta). En el PDF
 * se imprime también la dirección: un link en un papel no se puede tocar.
 */
function CuerpoEnlace({ e, colores, editando, onCambiar }: { e: Elemento; colores: readonly string[]; editando: boolean; onCambiar: (p: Partial<Elemento>) => void }) {
  const { borrador, escribir, enLugar, abrir, cerrar, tope } = useEnLugar(e, editando, onCambiar);
  const campo = useRef<HTMLInputElement>(null);
  useFocoAlAbrir(campo, enLugar);

  const estilo = estiloTexto(e, colores);
  // Se vuelve a sanear al DIBUJAR (como la imagen): lo que llega a un href no depende de que el saneo
  // del guardado haya corrido.
  const url = urlDeEnlace(e.url);
  const interno = url.startsWith('/');
  const texto = e.texto.trim();

  if (enLugar) {
    return (
      <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', alignItems: 'center' }}>
        <input
          ref={campo}
          {...sinArrastre}
          aria-label="Texto del enlace"
          value={borrador ?? ''}
          maxLength={tope}
          onChange={(ev) => escribir(ev.target.value)}
          onBlur={() => cerrar(true)}
          onKeyDown={(ev) => {
            ev.stopPropagation();
            if (ev.key === 'Escape') { ev.preventDefault(); cerrar(false); }
            else if (ev.key === 'Enter') { ev.preventDefault(); cerrar(true); }
          }}
          style={estiloCampoEnLugar(estilo)}
        />
      </div>
    );
  }

  const lo = texto || url;
  const decorado: CSSProperties = { color: 'inherit', textDecoration: 'underline', textUnderlineOffset: '0.18em', textDecorationThickness: '0.07em' };
  const alClic = editando ? soloSeleccionar : undefined;
  let contenido: ReactNode;
  if (!lo) contenido = editando ? <span style={{ color: 'var(--faint)', fontWeight: 400 }}>Doble clic para escribir</span> : null;
  else if (!url) contenido = <span>{lo}</span>; // sin dirección todavía: se lee, no se toca
  else if (interno) {
    contenido = <Link href={url} prefetch={false} onClick={alClic} draggable={editando ? false : undefined} style={decorado}>{lo}</Link>;
  } else {
    contenido = (
      <a href={url} target="_blank" rel="noopener noreferrer" title={editando ? undefined : 'Se abre en otra pestaña'}
        onClick={alClic} draggable={editando ? false : undefined} style={decorado}>
        {lo}<span aria-hidden> ↗</span>
      </a>
    );
  }
  return (
    <div
      onDoubleClick={editando ? (ev) => { ev.stopPropagation(); ev.preventDefault(); abrir(); } : undefined}
      title={editando ? 'Doble clic para editar el texto' : undefined}
      style={{ ...estilo, flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden', overflowWrap: 'anywhere', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
    >
      <div>{contenido}</div>
      {url && <span className="lk-solo-imprimir lk-imp-enlace">{enlaceImpreso(url)}</span>}
      {editando && !url && lo && <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--faint)' }}>Sin enlace</span>}
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
    return <RecuadroVacio icono="imagen" texto={fallo ? 'No pude cargar la imagen' : 'Agrega una imagen'} />;
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

/** La línea y la flecha: un SVG del tamaño exacto de la celda. */
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

/**
 * Los tipos cuyo dibujo es el del SET de la casa (app/_ui/iconos-menu.tsx): el mismo «link», «video» o
 * «imagen» que en cualquier otro menú de la app. El resto (texto, línea, flecha y sección) se dibuja acá.
 */
const DEL_SET = {
  imagen: 'imagen', enlace: 'link', video: 'video', insertado: 'insertar', ia: 'mako', accion: 'accion', entidad: 'archivo', general: 'plan',
} as const satisfies Partial<Record<TipoElemento, NombreIconoMenu>>;
const esDelSet = (t: TipoElemento): t is keyof typeof DEL_SET => Object.prototype.hasOwnProperty.call(DEL_SET, t);

/** El dibujito de un tipo de elemento, en `currentColor`. Lo puede usar el menú «Insertar» de la pantalla. */
export function IconoElemento({ tipo, size = 18 }: { tipo: TipoElemento; size?: number }) {
  if (esDelSet(tipo)) return <IconoMenu nombre={DEL_SET[tipo]} size={size} />;
  const trazos: Record<Exclude<TipoElemento, keyof typeof DEL_SET>, ReactNode> = {
    texto: <path d="M5 7V5h14v2M12 5v14M9 19h6" />,
    linea: <path d="M4 12h16" />,
    seccion: <><rect x="3.5" y="4" width="17" height="5" rx="1.5" /><path d="M5 14h14M5 18.5h9" /></>,
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
  ok: { margin: 0, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--good)', minWidth: 0, overflowWrap: 'anywhere' },
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
/** Lo que el panel de un elemento recibe de la pantalla. */
export type PropsPanelElemento = {
  e: Elemento;
  colores: readonly string[];
  onCambiar: (p: Partial<Elemento>) => void;
  onDuplicar: () => void;
  onBorrar: () => void;
  /** El ✕ de la cabecera (como el panel de un gráfico). Sin esto no se dibuja. */
  onCerrar?: () => void;
  /** La hoja ENTERA (con el pop-up adentro): la caja de IA elige de ahí qué gráficos lee. */
  hoja?: Hoja;
  /** El gráfico dueño del pop-up donde vive; null = en la hoja. */
  popupDe?: string | null;
  /** Lo que se abrió (la fila de muestra, editando un pop-up). */
  contexto?: ContextoEntidad | null;
  /** Qué entidad abre el pop-up donde vive (sus piezas y sus acciones); null = en la hoja. */
  entidad?: TipoEntidad | null;
  vista?: VistaValores;
};

export function PropsElemento(p: PropsPanelElemento) {
  return <PanelElemento key={p.e.id} {...p} />;
}

/** Los tipos que llevan cada sección del panel. */
const CON_TAMANO: readonly TipoElemento[] = ['texto', 'enlace', 'seccion', 'ia'];
const CON_ALINEAR: readonly TipoElemento[] = ['texto', 'enlace', 'ia'];
// Lo que trae su propio color (una foto, un reproductor, una página ajena, una ficha, un botón) no lleva el de la paleta.
const CON_COLOR: readonly TipoElemento[] = ['texto', 'enlace', 'linea', 'flecha', 'seccion', 'ia'];

function PanelElemento({ e, colores, onCambiar, onDuplicar, onBorrar, onCerrar, hoja, popupDe = null, contexto = null, entidad = null, vista }: PropsPanelElemento) {
  const idTexto = useId();
  const nombre = TIPOS_ELEMENTO.find((t) => t.id === e.tipo)?.nombre ?? 'Elemento';
  const trazada = e.tipo === 'linea' || e.tipo === 'flecha';

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* La cabecera de los paneles hermanos (Propiedades.tsx): pegada arriba al scrollear el panel, con su ✕. */}
      <div className="lk-props-cab">
        <IconoElemento tipo={e.tipo} size={20} /><span className="lk-props-nombre">{nombre}</span>
        {onCerrar && <BotonCerrar onClick={onCerrar} title="Cerrar el panel" talla="sm" />}
      </div>

      {e.tipo === 'texto' && (
        <Seccion>
          <label htmlFor={idTexto} style={S.titulo}>Texto</label>
          <textarea id={idTexto} value={e.texto} maxLength={topeDeTextoElemento(e.tipo)} rows={4} onChange={(ev) => onCambiar({ texto: ev.target.value })}
            style={{ ...S.campo, resize: 'vertical', lineHeight: 1.45 }} />
        </Seccion>
      )}
      {e.tipo === 'enlace' && <SeccionesEnlace e={e} onCambiar={onCambiar} />}
      {(e.tipo === 'seccion' || e.tipo === 'ia' || e.tipo === 'entidad' || e.tipo === 'general') && (
        <Seccion>
          <label htmlFor={idTexto} style={S.titulo}>Título</label>
          <input id={idTexto} value={e.texto} maxLength={topeDeTextoElemento(e.tipo)} onChange={(ev) => onCambiar({ texto: ev.target.value })} style={S.campo} />
        </Seccion>
      )}
      {e.tipo === 'seccion' && <PropsSeccion e={e} colores={colores} onCambiar={onCambiar} Titulo={Seccion} />}
      {/* Interfaz I3: los formularios de los tipos del paquete de IA y entidades. */}
      {e.tipo === 'ia' && hoja && <PropsIA e={e} hoja={hoja} popupDe={popupDe} contexto={contexto} vista={vista} onCambiar={onCambiar} />}
      {e.tipo === 'accion' && <PropsAccion e={e} entidad={entidad} onCambiar={onCambiar} />}
      {e.tipo === 'entidad' && <PropsEntidad e={e} entidad={entidad} onCambiar={onCambiar} />}
      {e.tipo === 'general' && <PropsGeneral e={e} onCambiar={onCambiar} />}
      {e.tipo === 'texto' && <AyudaVariables />}

      {CON_TAMANO.includes(e.tipo) && (
        <Seccion titulo="Tamaño">
          <Opciones etiqueta="Tamaño" valor={e.tamano} onElegir={(v) => onCambiar({ tamano: v })}
            opciones={(['s', 'm', 'l', 'xl'] as const).map((k, i) => ({
              id: k, nombre: TAMANOS_TEXTO[k].nombre,
              contenido: <span style={{ fontSize: [12, 14, 16, 19][i], fontWeight: TAMANOS_TEXTO[k].peso, lineHeight: 1 }}>Aa</span>,
            }))} />
        </Seccion>
      )}
      {CON_ALINEAR.includes(e.tipo) && (
        <Seccion titulo="Alineación">
          <Opciones etiqueta="Alineación" valor={e.alinear} onElegir={(v) => onCambiar({ alinear: v })}
            opciones={([['izquierda', 'Izquierda'], ['centro', 'Centro'], ['derecha', 'Derecha']] as const).map(([id, n]) => ({ id, nombre: n, contenido: <IconoAlinear a={id} /> }))} />
        </Seccion>
      )}

      {e.tipo === 'imagen' && <SeccionesImagen e={e} onCambiar={onCambiar} />}
      {e.tipo === 'video' && <SeccionesVideo e={e} onCambiar={onCambiar} />}
      {e.tipo === 'insertado' && <SeccionesInsertado e={e} onCambiar={onCambiar} />}

      {CON_COLOR.includes(e.tipo) && (
        <Seccion titulo="Color"><Muestras e={e} colores={colores} onElegir={(i) => onCambiar({ color: i })} /></Seccion>
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

/**
 * El BORRADOR de un campo de dirección, que se aplica al salir: el saneo tira lo que no es una dirección
 * entera, así que atado directo al valor guardado, «htt» se borraría con la tercera letra. Si la dirección
 * cambia desde afuera (una subida, un deshacer), el campo la muestra: es el ajuste de estado durante el
 * render que React documenta para esto, sin un efecto que pinte dos veces.
 */
function useBorrador(valor: string): [string, (v: string) => void] {
  const [borrador, setBorrador] = useState(valor);
  const [vista, setVista] = useState(valor);
  if (vista !== valor) { setVista(valor); setBorrador(valor); }
  return [borrador, setBorrador];
}

/** Lo que MaKo reconoció en la dirección guardada: «✓ YouTube», «✓ lookerstudio.google.com». */
function Reconocido({ nombre }: { nombre: string }) {
  return <p style={S.ok}><IconoMenu nombre="check" size={14} /><span>{nombre}</span></p>;
}

/** Enlace: lo que se lee y a dónde lleva (una pantalla de MaKo o un link https). */
function SeccionesEnlace({ e, onCambiar }: { e: Elemento; onCambiar: (p: Partial<Elemento>) => void }) {
  const idTexto = useId();
  const idUrl = useId();
  const [borrador, setBorrador] = useBorrador(e.url);
  const [error, setError] = useState<string | null>(null);

  const aplicar = () => {
    const v = borrador.trim();
    if (!v) { setError(null); if (e.url) onCambiar({ url: '' }); return; }
    const ok = urlDeEnlace(v);
    if (!ok) { setError('Usa un link https o una pantalla como /crm'); return; }
    setError(null);
    // Se muestra como quedó (con su https, o el camino de una pantalla de MaKo).
    setBorrador(ok);
    if (ok !== e.url) onCambiar({ url: ok });
  };

  return (
    <>
      <Seccion>
        <label htmlFor={idTexto} style={S.titulo}>Texto</label>
        <input id={idTexto} value={e.texto} maxLength={topeDeTextoElemento(e.tipo)} onChange={(ev) => onCambiar({ texto: ev.target.value })} style={S.campo} />
      </Seccion>
      <Seccion>
        <label htmlFor={idUrl} style={S.titulo}>Enlace</label>
        <input id={idUrl} inputMode="url" placeholder="https:// o /crm" value={borrador}
          onChange={(ev) => setBorrador(ev.target.value)} onBlur={aplicar}
          onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.preventDefault(); aplicar(); } }}
          style={S.campo} />
        {error && <p role="alert" style={S.error}>{error}</p>}
      </Seccion>
    </>
  );
}

/** Video: el link (YouTube, Vimeo, Loom, Drive, Fathom… o un archivo) y su título. */
function SeccionesVideo({ e, onCambiar }: { e: Elemento; onCambiar: (p: Partial<Elemento>) => void }) {
  const idUrl = useId();
  const idTitulo = useId();
  const [borrador, setBorrador] = useBorrador(e.url);
  const [error, setError] = useState<string | null>(null);
  const actual = e.url ? videoDe(e.url) : null;

  const aplicar = () => {
    const v = borrador.trim();
    if (!v) { setError(null); if (e.url) onCambiar({ url: '' }); return; }
    const r = videoDe(v);
    if (!r.ok) { setError(r.error); return; }
    setError(null);
    setBorrador(r.valor.direccion);
    if (r.valor.direccion !== e.url) onCambiar({ url: r.valor.direccion });
  };
  // Un link guardado que ya no se reconoce (la lista cambió) también lo dice.
  const aviso = error ?? (actual && !actual.ok ? actual.error : null);

  return (
    <>
      <Seccion>
        <label htmlFor={idUrl} style={S.titulo}>Pega el link del video</label>
        <input id={idUrl} inputMode="url" placeholder="https://" value={borrador}
          onChange={(ev) => setBorrador(ev.target.value)} onBlur={aplicar}
          onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.preventDefault(); aplicar(); } }}
          style={S.campo} />
        {aviso ? <p role="alert" style={S.error}>{aviso}</p> : actual?.ok && <Reconocido nombre={actual.valor.nombre} />}
      </Seccion>
      <Seccion>
        <label htmlFor={idTitulo} style={S.titulo}>Título</label>
        <input id={idTitulo} value={e.texto} maxLength={topeDeTextoElemento(e.tipo)} placeholder={actual?.ok ? actual.valor.nombre : ''}
          onChange={(ev) => onCambiar({ texto: ev.target.value })} style={S.campo} />
      </Seccion>
    </>
  );
}

/**
 * Insertar: un link o el CÓDIGO que da un sitio (`<iframe …>`), y su título. Del código se guarda SÓLO
 * la dirección (`insertableDe`): al aplicar, el campo pasa a mostrar eso, para que se vea qué quedó.
 */
function SeccionesInsertado({ e, onCambiar }: { e: Elemento; onCambiar: (p: Partial<Elemento>) => void }) {
  const idUrl = useId();
  const idTitulo = useId();
  const propio = useHostPropio();
  const [borrador, setBorrador] = useBorrador(e.url);
  const [error, setError] = useState<string | null>(null);
  const actual = e.url ? insertableDe(e.url, propio) : null;

  const aplicar = () => {
    const v = borrador.trim();
    if (!v) { setError(null); if (e.url) onCambiar({ url: '' }); return; }
    const r = insertableDe(v, propio);
    if (!r.ok) { setError(r.error); return; }
    setError(null);
    setBorrador(r.valor.direccion);
    if (r.valor.direccion !== e.url) onCambiar({ url: r.valor.direccion });
  };
  const aviso = error ?? (actual && !actual.ok ? actual.error : null);

  return (
    <>
      <Seccion>
        <label htmlFor={idUrl} style={S.titulo}>Link o código</label>
        <textarea id={idUrl} rows={3} placeholder="https://… o <iframe …>" value={borrador}
          onChange={(ev) => setBorrador(ev.target.value)} onBlur={aplicar}
          onKeyDown={(ev) => { if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); aplicar(); } }}
          style={{ ...S.campo, resize: 'vertical', lineHeight: 1.4, fontFamily: "'Geist Mono', monospace", fontSize: 12.5, wordBreak: 'break-all' }} />
        {aviso ? <p role="alert" style={S.error}>{aviso}</p> : actual?.ok && <Reconocido nombre={actual.valor.nombre} />}
      </Seccion>
      <Seccion>
        <label htmlFor={idTitulo} style={S.titulo}>Título</label>
        <input id={idTitulo} value={e.texto} maxLength={topeDeTextoElemento(e.tipo)} placeholder={actual?.ok ? actual.valor.nombre : ''}
          onChange={(ev) => onCambiar({ texto: ev.target.value })} style={S.campo} />
      </Seccion>
    </>
  );
}

/** Imagen: subir un archivo o pegar un enlace https, cómo se ajusta y su descripción. */
function SeccionesImagen({ e, onCambiar }: { e: Elemento; onCambiar: (p: Partial<Elemento>) => void }) {
  const idUrl = useId();
  const idAlt = useId();
  const archivo = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [borrador, setBorrador] = useBorrador(e.url);

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

// ── Los bloques de General (14/10/2026) ────────────────────────────────────────────────────────────────────────────

/** Qué bloque es (se puede cambiar por otro sin moverlo). El título se edita arriba, como el de una sección. */
function PropsGeneral({ e, onCambiar }: { e: Elemento; onCambiar: (p: Partial<Elemento>) => void }) {
  const id = useId();
  const funnels = useFunnelsGeneral();
  const pieza = e.general?.pieza;
  const funnel = e.general?.funnel ?? null;
  // Un bloque que se ata a un funnel (lib/general-piezas.ts): sin elegir, el principal («Tu funnel hoy») o todo el
  // negocio («A quién cobrarle»). Uno elegido que ya no está se muestra igual, marcado: un <select> cuyo valor no está
  // entre sus opciones muestra la primera y el primer clic la escribe.
  const conFunnel = pieza && piezaPorFunnel(pieza) && funnels;
  const perdido = conFunnel && funnel != null && !funnels.some((f) => f.id === funnel);
  return (
    <Seccion>
      <label htmlFor={id} style={S.titulo}>Bloque</label>
      <select id={id} value={pieza ?? ''} style={S.campo}
        onChange={(ev) => {
          const v = ev.target.value;
          // El funnel viaja sólo con los bloques que lo usan: cambiar de bloque no lo arrastra a uno que no sabe.
          if (esPiezaGeneral(v)) onCambiar({ general: funnel != null && piezaPorFunnel(v) ? { pieza: v, funnel } : { pieza: v } });
        }}>
        {PIEZAS_GENERAL.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
      </select>
      <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>{PIEZAS_GENERAL.find((p) => p.id === pieza)?.linea}</span>
      {conFunnel && (
        <>
          <label htmlFor={`${id}-f`} style={S.titulo}>Funnel</label>
          <select id={`${id}-f`} value={funnel ?? ''} style={S.campo}
            onChange={(ev) => {
              const n = Number(ev.target.value);
              onCambiar({ general: n > 0 ? { pieza: pieza!, funnel: n } : { pieza: pieza! } });
            }}>
            <option value="">{pieza === 'cobranza' ? 'Todo el negocio' : 'El principal'}</option>
            {funnels.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
            {perdido && <option value={funnel!}>Un funnel que ya no está</option>}
          </select>
        </>
      )}
    </Seccion>
  );
}

/** En General, el panel de un Texto dice qué variables entiende (sólo ahí tienen valor). */
function AyudaVariables() {
  if (!useEnGeneral()) return null;
  return (
    <Seccion titulo="Variables">
      <span style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>
        {VARIABLES_TEXTO.map((v) => `{{${v.id}}}`).join(' · ')}
      </span>
    </Seccion>
  );
}
