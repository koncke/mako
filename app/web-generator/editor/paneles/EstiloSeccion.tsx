'use client';

// =============================================================================
// EstiloSeccion — «Editar estilo de sección» de Gamma, el popover anclado a una sección
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma». Es el popover que en Gamma
// abre el botón de estilo del módulo («Editar estilo de diapositiva/sección», help 11969695 y
// el código; gamma-ui.md §5.8), en el orden de Gamma:
//   · Imagen de acento: Sin imagen · Arriba · Derecha · Izquierda · Fondo (con su miniatura),
//     y con imagen: Ajustar/Rellenar, Cambiar punto de enfoque, cambiar o eliminar la imagen.
//   · Con «Fondo»: Superposición — Esmerilado · Atenuado · Claro (o ninguna).
//   · Color de sección: el del tema, el acento, la paleta del tema, los degradados de doc.ts y
//     un color libre.
//   · Ancho (Angosto · Predeterminado · Amplio · Completo), Alineación de contenido (Arriba ·
//     Centro · Abajo) y Alto (Automático · Pantalla completa).
//   · Restablecer estilo.
//
// Cómo escribe: cada cambio es UNA transacción de TipTap (`setNodeMarkup` en la posición de la
// tarjeta, por `editor.commands.command`), así Ctrl+Z lo deshace y el autoguardado del armazón
// lo guarda como cualquier otra edición. Lee los atributos con `useEditorState` (el editor del
// armazón va con `shouldRerenderOnTransaction: false`) normalizados por `attrsTarjeta`
// (especificacion.ts): lo que la sección no trae se lee con su default, nunca `undefined`.
//
// Lo que NO se copia de Gamma, y por qué:
//   · Tamaño del acento (1/8 … 7/8), recortes con forma y «Diapositiva sin margen»: no están
//     en el modelo de la sección (doc.ts) ni en la hoja; «Completo» de Ancho cubre el sin margen.
//   · Intensidad y color de la superposición: la hoja tiene tres superposiciones cerradas.
//
// «Restablecer estilo» vuelve a sus defaults el color, el ancho, la alineación, el alto, la
// superposición, el ajuste y el punto de enfoque. NO saca la imagen ni el diseño: en Gamma
// restablecer el estilo no borra la imagen que eligió la persona.
// =============================================================================

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as PE } from 'react';
import { createPortal } from 'react-dom';
import { useEditorState, type Editor } from '@tiptap/react';
import type { Node as PMNode } from '@tiptap/pm/model';
import { useCapaModal } from '@/app/_components/pila-modales';
import {
  ATTRS_TARJETA_DEFAULT, DEGRADADOS, NODO, tituloDeTarjeta,
  type AttrsTarjeta, type Degradado, type DisenoTarjeta, type JsonNodo,
} from '@/lib/editor-landing/doc';
import { attrsTarjeta } from '@/lib/editor-landing/especificacion';
import { varsDeTema } from '@/lib/editor-landing/temas';
import { useEditorLanding } from '../contexto';
import { diapositivaFija } from '@/lib/editor-landing/api-tipos';
import { EntradaColor, EstilosGmp, Icono, Segmentado, posicionJunto, useFijo, type OpcionSeg } from '../dialogos/piezas-gma';

/** A qué se ancla: el botón que lo abrió, o un rectángulo ya medido. */
export type AnclaEstilo = HTMLElement | DOMRect | null;

const ANCHO_POP = 320;

// ─────────────────────────────────────────────────────────────────────────────
// La tarjeta en el documento
// ─────────────────────────────────────────────────────────────────────────────

/** La tarjeta `id` entre los hijos del doc (el doc sólo tiene tarjetas), con su posición. */
export function buscarTarjeta(doc: PMNode, id: string): { pos: number; node: PMNode } | null {
  let hallada: { pos: number; node: PMNode } | null = null;
  doc.forEach((node, offset) => {
    if (!hallada && node.type.name === NODO.tarjeta && node.attrs.id === id) hallada = { pos: offset, node };
  });
  return hallada;
}

/**
 * Escribe `cambios` en la tarjeta `id`, en UNA transacción deshacible. Devuelve false si la
 * tarjeta ya no está (la borraron con el popover abierto).
 */
export function escribirEstilo(editor: Editor, id: string, cambios: Partial<AttrsTarjeta>): boolean {
  return editor.commands.command(({ tr, state }) => {
    const t = buscarTarjeta(state.doc, id);
    if (!t) return false;
    tr.setNodeMarkup(t.pos, undefined, { ...t.node.attrs, ...cambios });
    return true;
  });
}

/** Lo que «Restablecer estilo» vuelve a su default (ver la cabecera: la imagen se queda). */
export const ESTILO_RESTABLECIDO: Partial<AttrsTarjeta> = {
  fondo: ATTRS_TARJETA_DEFAULT.fondo,
  fondoColor: ATTRS_TARJETA_DEFAULT.fondoColor,
  fondoDegradado: ATTRS_TARJETA_DEFAULT.fondoDegradado,
  ancho: ATTRS_TARJETA_DEFAULT.ancho,
  alineacion: ATTRS_TARJETA_DEFAULT.alineacion,
  alto: ATTRS_TARJETA_DEFAULT.alto,
  superposicion: ATTRS_TARJETA_DEFAULT.superposicion,
  imagenAjuste: ATTRS_TARJETA_DEFAULT.imagenAjuste,
  imagenFocoX: ATTRS_TARJETA_DEFAULT.imagenFocoX,
  imagenFocoY: ATTRS_TARJETA_DEFAULT.imagenFocoY,
};

// ─────────────────────────────────────────────────────────────────────────────
// Las opciones (los nombres de Gamma en español)
// ─────────────────────────────────────────────────────────────────────────────

const DISENOS: { valor: DisenoTarjeta; texto: string }[] = [
  { valor: 'sin', texto: 'Sin imagen' },
  { valor: 'arriba', texto: 'Arriba' },
  { valor: 'derecha', texto: 'Derecha' },
  { valor: 'izquierda', texto: 'Izquierda' },
  { valor: 'fondo', texto: 'Fondo' },
];

const SUPERPOSICION: OpcionSeg<AttrsTarjeta['superposicion']>[] = [
  { valor: 'ninguna', texto: 'Ninguna' },
  { valor: 'esmerilada', texto: 'Esmerilado' },
  { valor: 'oscura', texto: 'Atenuado' },
  { valor: 'clara', texto: 'Claro' },
];

const ANCHOS: OpcionSeg<AttrsTarjeta['ancho']>[] = [
  { valor: 'angosto', texto: 'Angosto' },
  { valor: 'normal', texto: 'Predeterminado' },
  { valor: 'amplio', texto: 'Amplio' },
  { valor: 'completo', texto: 'Completo', titulo: 'El ancho completo oculta el fondo' },
];

const ALINEACIONES: OpcionSeg<AttrsTarjeta['alineacion']>[] = [
  { valor: 'arriba', texto: 'Arriba' },
  { valor: 'centro', texto: 'Centro' },
  { valor: 'abajo', texto: 'Abajo' },
];

const ALTOS: OpcionSeg<AttrsTarjeta['alto']>[] = [
  { valor: 'auto', texto: 'Automático' },
  { valor: 'pantalla', texto: 'Pantalla completa' },
];

const AJUSTES: OpcionSeg<AttrsTarjeta['imagenAjuste']>[] = [
  { valor: 'contener', texto: 'Ajustar' },
  { valor: 'cubrir', texto: 'Rellenar' },
];

const NOMBRE_DEGRADADO: Record<Degradado, string> = {
  aurora: 'Aurora', cielo: 'Cielo', durazno: 'Durazno', menta: 'Menta', noche: 'Noche',
  lavanda: 'Lavanda', fuego: 'Fuego', oceano: 'Océano', grafito: 'Grafito', arena: 'Arena',
};

const HEX = /^#[0-9a-fA-F]{6}$/;

// ─────────────────────────────────────────────────────────────────────────────
// La miniatura de cada diseño (la de Gamma: una tarjeta con líneas y el bloque de la imagen)
// ─────────────────────────────────────────────────────────────────────────────

function MiniDiseno({ d }: { d: DisenoTarjeta }) {
  const img = 'var(--gmp-azul-linea)';
  const linea = 'var(--gmp-borde-fuerte)';
  const lineas = (x: number, y: number, w: number) => (
    <>
      <rect x={x} y={y} width={w * 0.7} height={3} rx={1.5} fill={linea} />
      <rect x={x} y={y + 6} width={w} height={2} rx={1} fill={linea} opacity={0.7} />
      <rect x={x} y={y + 10} width={w * 0.85} height={2} rx={1} fill={linea} opacity={0.7} />
    </>
  );
  return (
    <svg viewBox="0 0 60 40" width="100%" aria-hidden focusable="false" style={{ display: 'block' }}>
      <rect x={0.5} y={0.5} width={59} height={39} rx={4} fill="var(--gmp-fondo)" stroke="var(--gmp-borde)" />
      {d === 'sin' && lineas(10, 14, 40)}
      {d === 'arriba' && (<><rect x={0.5} y={0.5} width={59} height={15} rx={4} fill={img} opacity={0.55} />{lineas(10, 21, 40)}</>)}
      {d === 'derecha' && (<><rect x={38} y={0.5} width={21.5} height={39} rx={4} fill={img} opacity={0.55} />{lineas(6, 14, 26)}</>)}
      {d === 'izquierda' && (<><rect x={0.5} y={0.5} width={21.5} height={39} rx={4} fill={img} opacity={0.55} />{lineas(28, 14, 26)}</>)}
      {d === 'fondo' && (<><rect x={0.5} y={0.5} width={59} height={39} rx={4} fill={img} opacity={0.55} />{lineas(10, 14, 40)}</>)}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// El punto de enfoque: la imagen con una cruz que se arrastra
// ─────────────────────────────────────────────────────────────────────────────

function PuntoEnfoque({ src, x, y, onCambiar }: { src: string; x: number; y: number; onCambiar: (x: number, y: number) => void }) {
  const caja = useRef<HTMLDivElement>(null);
  const arrastrando = useRef(false);
  const mover = (e: PE<HTMLDivElement>) => {
    const r = caja.current?.getBoundingClientRect();
    if (!r || !r.width || !r.height) return;
    const nx = Math.round(Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)));
    const ny = Math.round(Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100)));
    onCambiar(nx, ny);
  };
  return (
    <div ref={caja} className="gmp-enfoque" role="slider" aria-label="Punto de enfoque" aria-valuetext={`${x}% ${y}%`} tabIndex={0}
      onPointerDown={(e) => { arrastrando.current = true; e.currentTarget.setPointerCapture(e.pointerId); mover(e); }}
      onPointerMove={(e) => { if (arrastrando.current) mover(e); }}
      onPointerUp={(e) => { arrastrando.current = false; try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ya soltado */ } }}
      onKeyDown={(e) => {
        const paso = e.shiftKey ? 10 : 2;
        if (e.key === 'ArrowLeft') { e.preventDefault(); onCambiar(Math.max(0, x - paso), y); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); onCambiar(Math.min(100, x + paso), y); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); onCambiar(x, Math.max(0, y - paso)); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); onCambiar(x, Math.min(100, y + paso)); }
      }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- imagen del bucket propio, sin optimizador */}
      <img src={src} alt="" draggable={false} />
      <span className="gmp-enfoque-punto" style={{ left: `${x}%`, top: `${y}%` }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// El popover
// ─────────────────────────────────────────────────────────────────────────────

const CSS_ESTILO = [
  '.gmp-disenos{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}',
  '.gmp-diseno{display:grid;gap:4px;padding:4px;border:1.5px solid var(--gmp-borde);border-radius:8px;background:var(--gmp-fondo);color:var(--gmp-texto);font-size:10.5px;font-weight:500;line-height:1.2;text-align:center;cursor:pointer}',
  '.gmp-diseno:hover{border-color:var(--gmp-borde-fuerte)}',
  '.gmp-diseno[aria-pressed="true"]{border-color:var(--gmp-azul-linea);background:var(--gmp-azul-claro);color:var(--gmp-sobre-azul-claro)}',
  '.gmp-img-fila{display:flex;align-items:center;gap:8px;margin-top:10px}',
  '.gmp-img-mini{width:48px;height:32px;flex:none;border-radius:6px;background:var(--gmp-suave) center/cover no-repeat;border:1px solid var(--gmp-borde)}',
  '.gmp-enfoque{position:relative;margin-top:8px;border-radius:8px;overflow:hidden;cursor:crosshair;touch-action:none;background:var(--gmp-suave)}',
  '.gmp-enfoque img{display:block;width:100%;height:auto;max-height:200px;object-fit:contain;user-select:none;pointer-events:none}',
  '.gmp-enfoque-punto{position:absolute;width:22px;height:22px;margin:-11px 0 0 -11px;border:2px solid #fff;border-radius:50%;box-shadow:0 0 0 1px rgba(0,0,0,.45),0 2px 6px rgba(0,0,0,.35);pointer-events:none}',
  '.gmp-enfoque-punto::after{content:"";position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px 0 0 -2px;border-radius:50%;background:#fff}',
  '.gmp-color-tema{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px 0 4px;border:1px solid var(--gmp-borde);border-radius:999px;background:var(--gmp-fondo);color:var(--gmp-tinta);font-size:12.5px;font-weight:500;cursor:pointer}',
  '.gmp-color-tema i{width:20px;height:20px;border-radius:50%;border:1px solid rgba(0,0,0,.14)}',
  '.gmp-color-tema[aria-pressed="true"]{border-color:var(--gmp-azul-linea);box-shadow:0 0 0 1px var(--gmp-azul-linea)}',
  '.gmp-pop-pie{display:flex;justify-content:flex-start;margin-top:16px;padding-top:12px;border-top:1px solid var(--gmp-borde)}',
].join('\n');

export function EstiloSeccion({ tarjetaId, ancla, onCerrar }: { tarjetaId: string; ancla: AnclaEstilo; onCerrar: () => void }) {
  const { editor, tema, elegirImagen, config } = useEditorLanding();
  // T3: en una diapositiva de forma fija el ancho no cambia nada (css.ts, 15b): no se ofrece.
  const sinAncho = diapositivaFija(config);
  const capa = useCapaModal(true, { anidada: true });
  const ref = useRef<HTMLDivElement>(null);
  const cerrar = useFijo(onCerrar);
  const arriba = capa.esElDeArriba;
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [verEnfoque, setVerEnfoque] = useState(false);
  const [colorLibre, setColorLibre] = useState<string>('#ffffff');

  // Los atributos de la sección, normalizados; null si la sección ya no está.
  const estado = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return null;
      const t = buscarTarjeta(e.state.doc, tarjetaId);
      if (!t) return null;
      return { attrs: attrsTarjeta(t.node.attrs), titulo: tituloDeTarjeta(t.node.toJSON() as JsonNodo) };
    },
  });
  const a = estado?.attrs ?? null;

  // Si la sección desaparece (la borraron, se deshizo su alta), el popover se cierra solo.
  useEffect(() => { if (editor && estado === null) cerrar(); }, [editor, estado, cerrar]);
  useEffect(() => { if (a?.fondo === 'color' && a.fondoColor) setColorLibre(a.fondoColor); }, [a?.fondo, a?.fondoColor]);

  const cambiar = useCallback((cambios: Partial<AttrsTarjeta>) => {
    if (editor) escribirEstilo(editor, tarjetaId, cambios);
  }, [editor, tarjetaId]);

  // Posición junto al ancla, re-medida al scrollear y al cambiar de tamaño.
  useLayoutEffect(() => {
    const medir = () => {
      const r = ancla instanceof HTMLElement ? ancla.getBoundingClientRect() : ancla;
      const alto = ref.current?.offsetHeight ?? 480;
      if (!r) { setPos({ left: Math.max(8, window.innerWidth - ANCHO_POP - 24), top: 64 }); return; }
      setPos(posicionJunto(r, ANCHO_POP, alto, 'derecha'));
    };
    medir();
    window.addEventListener('resize', medir);
    window.addEventListener('scroll', medir, true);
    return () => { window.removeEventListener('resize', medir); window.removeEventListener('scroll', medir, true); };
  }, [ancla, verEnfoque, a?.diseno]);

  // Cerrar: Escape (sólo si es la capa de arriba) y un clic afuera. Con el selector de
  // imágenes abierto encima, el clic es suyo y no cierra esto.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && arriba()) { e.stopImmediatePropagation(); cerrar(); } };
    const onAbajo = (e: PointerEvent) => {
      if (!arriba()) return;
      const t = e.target as Node;
      if (ref.current?.contains(t)) return;
      if (ancla instanceof HTMLElement && ancla.contains(t)) return;
      cerrar();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onAbajo, true);
    return () => { document.removeEventListener('keydown', onKey, true); document.removeEventListener('pointerdown', onAbajo, true); };
  }, [ancla, arriba, cerrar]);

  const elegirDiseno = async (d: DisenoTarjeta) => {
    if (!a) return;
    if (d === 'sin' || a.imagenSrc) { cambiar({ diseno: d }); return; }
    const url = await elegirImagen({ modo: 'imagen', sugerencia: estado?.titulo || undefined });
    if (url) cambiar({ diseno: d, imagenSrc: url, imagenFocoX: 50, imagenFocoY: 50 });
  };
  const cambiarImagen = async () => {
    const url = await elegirImagen({ modo: 'imagen', sugerencia: estado?.titulo || undefined });
    if (url) cambiar({ imagenSrc: url, imagenFocoX: 50, imagenFocoY: 50, ...(a?.diseno === 'sin' ? { diseno: 'derecha' as const } : {}) });
  };

  if (typeof document === 'undefined' || !a) return null;

  const vars = varsDeTema(tema);
  const conImagen = a.diseno !== 'sin' && !!a.imagenSrc;
  const paleta = [...new Set(tema.paleta.map((c) => c.toLowerCase()))].filter((c) => HEX.test(c)).slice(0, 8);
  const colorPropio = a.fondo === 'color' && a.fondoColor && !paleta.includes(a.fondoColor.toLowerCase()) ? a.fondoColor : null;

  return createPortal(
    <div ref={ref} className="gma gmp gmp-pop" role="dialog" aria-label="Editar estilo de sección"
      style={{ zIndex: capa.z, left: pos?.left ?? -9999, top: pos?.top ?? -9999, display: capa.visible ? 'block' : 'none' }}>
      <EstilosGmp extra={{ href: 'gmp-estilo-seccion', css: CSS_ESTILO }} />
      <div className="gmp-pop-cab">
        <h3 className="gmp-pop-tit">Editar estilo de sección</h3>
        <button type="button" className="gmp-x" onClick={cerrar} aria-label="Cerrar" title="Cerrar"><Icono nombre="cerrar" tam={16} /></button>
      </div>

      <p className="gmp-sub">Imagen de acento</p>
      <div className="gmp-disenos" role="group" aria-label="Imagen de acento">
        {DISENOS.map((d) => (
          <button key={d.valor} type="button" className="gmp-diseno" aria-pressed={(conImagen ? a.diseno : 'sin') === d.valor}
            title={d.texto} onClick={() => void elegirDiseno(d.valor)}>
            <MiniDiseno d={d.valor} />
            <span>{d.texto}</span>
          </button>
        ))}
      </div>

      {conImagen && a.imagenSrc && (
        <>
          <div className="gmp-img-fila">
            <span className="gmp-img-mini" style={{ backgroundImage: `url("${a.imagenSrc}")` } as CSSProperties} />
            <button type="button" className="gmp-btn gmp-btn-contorno gmp-btn-chico" onClick={() => void cambiarImagen()}>
              <Icono nombre="imagen" tam={14} />Cambiar
            </button>
            <span style={{ flex: 1 }} />
            <button type="button" className="gmp-x" aria-label="Quitar la imagen de acento" title="Quitar" onClick={() => cambiar({ imagenSrc: null, diseno: 'sin' })}>
              <Icono nombre="cerrar" tam={15} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
            <Segmentado etiqueta="Ajuste de la imagen" valor={a.imagenAjuste} opciones={AJUSTES} onCambiar={(v) => cambiar({ imagenAjuste: v })} />
            <button type="button" className="gmp-btn gmp-btn-fantasma gmp-btn-chico" aria-pressed={verEnfoque} onClick={() => setVerEnfoque((v) => !v)}>
              <Icono nombre="ojo" tam={14} />Cambiar punto de enfoque
            </button>
          </div>
          {verEnfoque && (
            <PuntoEnfoque src={a.imagenSrc} x={a.imagenFocoX} y={a.imagenFocoY} onCambiar={(x, y) => cambiar({ imagenFocoX: x, imagenFocoY: y })} />
          )}
          {a.diseno === 'fondo' && (
            <>
              <p className="gmp-sub">Superposición</p>
              <Segmentado etiqueta="Superposición" ancho valor={a.superposicion} opciones={SUPERPOSICION} onCambiar={(v) => cambiar({ superposicion: v })} />
            </>
          )}
        </>
      )}

      <p className="gmp-sub">Color de sección</p>
      <div className="gmp-colores" role="group" aria-label="Color de sección">
        <button type="button" className="gmp-color-tema" aria-pressed={a.fondo === 'tema'} onClick={() => cambiar({ fondo: 'tema', fondoColor: null, fondoDegradado: null })}>
          <i style={{ background: vars['--gm-tarjeta-fondo'] }} />Tema
        </button>
        <button type="button" className="gmp-color-tema" aria-pressed={a.fondo === 'acento'} onClick={() => cambiar({ fondo: 'acento', fondoColor: null, fondoDegradado: null })}>
          <i style={{ background: tema.colores.acento }} />Acento
        </button>
      </div>
      <div className="gmp-colores" style={{ marginTop: 8 }}>
        {paleta.map((c) => (
          <button key={c} type="button" className="gmp-color" title={c} aria-label={`Color ${c}`} style={{ background: c }}
            aria-pressed={a.fondo === 'color' && a.fondoColor?.toLowerCase() === c}
            onClick={() => cambiar({ fondo: 'color', fondoColor: c, fondoDegradado: null })} />
        ))}
        {colorPropio && (
          <button type="button" className="gmp-color" title={colorPropio} aria-label={`Color ${colorPropio}`} style={{ background: colorPropio }} aria-pressed />
        )}
      </div>
      <div className="gmp-colores" style={{ marginTop: 8 }}>
        {(Object.keys(DEGRADADOS) as Degradado[]).map((k) => (
          <button key={k} type="button" className="gmp-color" title={NOMBRE_DEGRADADO[k]} aria-label={`Degradado ${NOMBRE_DEGRADADO[k]}`}
            style={{ background: DEGRADADOS[k] }} aria-pressed={a.fondo === 'degradado' && a.fondoDegradado === k}
            onClick={() => cambiar({ fondo: 'degradado', fondoDegradado: k, fondoColor: null })} />
        ))}
      </div>
      <div style={{ marginTop: 8 }}>
        <EntradaColor etiqueta="Color personalizado" valor={colorLibre}
          onCambiar={(hex) => { setColorLibre(hex); cambiar({ fondo: 'color', fondoColor: hex, fondoDegradado: null }); }} />
      </div>

      {sinAncho ? null : <>
        <p className="gmp-sub">Ancho</p>
        <Segmentado etiqueta="Ancho" ancho valor={a.ancho} opciones={ANCHOS} onCambiar={(v) => cambiar({ ancho: v })} />
      </>}

      <p className="gmp-sub">Alineación de contenido</p>
      <Segmentado etiqueta="Alineación de contenido" ancho valor={a.alineacion} opciones={ALINEACIONES} onCambiar={(v) => cambiar({ alineacion: v })} />

      <p className="gmp-sub">Alto</p>
      <Segmentado etiqueta="Alto" ancho valor={a.alto} opciones={ALTOS} onCambiar={(v) => cambiar({ alto: v })} />

      <div className="gmp-pop-pie">
        <button type="button" className="gmp-btn gmp-btn-fantasma gmp-btn-chico" onClick={() => cambiar(ESTILO_RESTABLECIDO)}>
          <Icono nombre="restablecer" tam={14} />Restablecer estilo
        </button>
      </div>
    </div>,
    document.body,
  );
}

export default EstiloSeccion;
