'use client';

// =============================================================================
// IdentidadPicker — la marca de una cosa: su emoji, su ícono o su foto
// =============================================================================
// «Al clickear [la foto] debería abrir un modal, como el de la portada, para
// acomodar la foto en el redondel de MaKo, porque tal vez lo quiero centrar. Y
// dentro de ese modal la opción de eliminar o subir.» Y: «agregá íconos y la
// opción de Subir, tanto en los proyectos como en los clientes, que sea lo mismo
// el pop-up de edición de la foto del perfil» (27/09/2026).
//
// ⚠️ ES UNO SOLO PARA EL CLIENTE Y PARA EL PROYECTO, y eso es lo que pidió el
// dueño con todas las letras. La misma pregunta —«¿qué se ve en el redondel?»—
// contestada por dos componentes son dos componentes que divergen: el día que se
// agregue una pestaña, el otro se queda con dos. Lo que cambia entre los dos no es
// el selector: es el RESPALDO (un proyecto cae a su emoji, un cliente a sus
// iniciales) y eso lo resuelve quien lo dibuja, no quien lo elige.
//
// Tres pestañas y un «Quitar», igual que el de Notion (Emoji · Icons · Upload ·
// Remove):
//   1. Emoji  — el selector de la casa, el mismo de WhatsApp. Escribe la columna
//               `emoji` y BORRA `icono`: son dos columnas y sólo una manda.
//   2. Iconos — Iconify, ~22.900 de sets MIT/ISC. Ver `lib/iconos-catalogo.ts`.
//   3. Subir  — la propia. Y si ya hay una foto, acá mismo se ENCUADRA: la vista
//               previa es el círculo de verdad y se arrastra.
//
// ⚠️ EL ENCUADRE VIVE EN LA PESTAÑA «SUBIR» Y NO EN UNA CUARTA. Es una operación
// sobre la foto que ya está, no otra forma de elegir marca — y una pestaña que
// existe sólo a veces (no hay nada que encuadrar en un emoji) es una pestaña que
// aparece y desaparece.

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Spinner } from '@/app/_ui';
import { useCapaModal } from '@/app/_components/pila-modales';
import { EmojiPicker } from '@/app/whatsapp/EmojiPicker';
import { ubicarPanel } from '@/app/_components/PortadaPicker';
import { esFoto, urlPortada } from '@/lib/portadas';
import { ICONOS_SUGERIDOS, urlBusquedaIconos, urlIcono, valorIcono, nombreDeIcono } from '@/lib/iconos-catalogo';

const ANCHO = 380;
const ALTO_CUERPO = 300;

type Pestana = 'emoji' | 'iconos' | 'subir';

/** Lo que el selector devuelve. Los tres campos son EXCLUYENTES entre sí. */
export type CambioIdentidad = {
  /** Un glifo. Escribirlo apaga `icono` y `foto`. */
  emoji?: string;
  /** `icon:<set>:<nombre>` o una URL del bucket. `null` = sacarlo. */
  icono?: string | null;
  /** El encuadre de la foto dentro del círculo, 0-100. */
  y?: number | null;
};

export function IdentidadPicker({
  emoji, icono, y, ancla = null, titulo = 'Ícono', conEmoji = true, onElegir, onCerrar,
}: {
  /** El glifo que hay hoy (la columna `emoji` de un proyecto). */
  emoji?: string | null;
  /** El ícono o la foto que hay hoy (la columna `icono`), si la eligieron. */
  icono?: string | null;
  /** El encuadre de la foto, si es una foto. */
  y?: number | null;
  ancla?: HTMLElement | null;
  titulo?: string;
  /**
   * ⚠️ UN CLIENTE TAMBIÉN PUEDE TENER EMOJI, y por eso esto es `true` por default.
   * El prop existe para el caso contrario —una entidad donde un glifo no tenga
   * sentido— y no para la diferencia cliente/proyecto, que NO es una diferencia:
   * el dueño pidió explícitamente que el pop-up fuera el mismo.
   */
  conEmoji?: boolean;
  onElegir: (c: CambioIdentidad) => void;
  onCerrar: () => void;
}) {
  const [pest, setPest] = useState<Pestana>(() => (esFoto(icono) ? 'subir' : conEmoji ? 'emoji' : 'iconos'));
  const [montado, setMontado] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const capa = useCapaModal(true, { anidada: true });
  const arriba = capa.esElDeArriba;

  useEffect(() => { setMontado(true); }, []);

  const recolocar = useCallback(() => {
    const p = panelRef.current;
    if (!p) return;
    const caja = p.getBoundingClientRect();
    const ventana = { ancho: window.innerWidth, alto: window.innerHeight };
    const a = ancla?.isConnected ? ancla.getBoundingClientRect() : null;
    if (!a) {
      setPos({ left: Math.max(10, (ventana.ancho - caja.width) / 2), top: Math.max(10, (ventana.alto - caja.height) / 2) });
      return;
    }
    // ⚠️ SE ANCLA POR LA IZQUIERDA, al revés que el de la portada. El avatar vive en
    // la esquina IZQUIERDA de la ficha: colgar de su borde derecho tiraría el panel
    // contra el borde de la ventana y el clamp lo dejaría flotando lejos del botón.
    // `ubicarPanel` alinea por la derecha, así que se le pasa la derecha que haría
    // que el panel arranque en el borde izquierdo del ancla.
    //
    // ⚠️ Y SE CONSTRUYE CAMPO POR CAMPO, NO CON `{ ...a }`. Un `DOMRect` tiene `x`,
    // `y`, `width` y `height` como propiedades propias, pero `top`/`left`/`right`/
    // `bottom` son GETTERS DEL PROTOTIPO: el spread no los copia. Medido en Chrome —
    // el panel salía con `top: NaN` y React avisaba en consola («NaN is an invalid
    // value for the top css style property»), pero el panel igual se dibujaba, en
    // cualquier lado. El typecheck no lo ve: el objeto sigue siendo un `Caja` válido
    // en tipos, con dos campos en `undefined` en runtime.
    setPos(ubicarPanel(
      { left: a.left, top: a.top, bottom: a.bottom, right: a.left + caja.width },
      { ancho: caja.width, alto: caja.height },
      ventana,
    ));
  }, [ancla]);

  useEffect(() => {
    recolocar();
    window.addEventListener('resize', recolocar);
    window.addEventListener('scroll', recolocar, true);
    return () => { window.removeEventListener('resize', recolocar); window.removeEventListener('scroll', recolocar, true); };
  }, [recolocar, montado]);

  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t || panelRef.current?.contains(t) || ancla?.contains(t)) return;
      onCerrar();
    };
    document.addEventListener('mousedown', fuera, true);
    return () => document.removeEventListener('mousedown', fuera, true);
  }, [ancla, onCerrar]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !arriba()) return;
      // La misma razón que en PortadaPicker: `stopPropagation` no frena a los
      // listeners hermanos del mismo nodo, y todos los Escape viven en `document`.
      e.stopImmediatePropagation();
      e.preventDefault();
      onCerrar();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [arriba, onCerrar]);

  if (!montado) return null;

  const hayAlgo = !!icono || !!(emoji && emoji.trim());

  return createPortal(
    <div ref={panelRef} className="ip-pop" role="dialog" aria-label={titulo} tabIndex={-1}
      style={{ zIndex: capa.z, left: pos?.left ?? 0, top: pos?.top ?? 0, opacity: pos ? 1 : 0, pointerEvents: pos ? undefined : 'none' }}>
      <div className="ip-tabs" role="tablist">
        {(conEmoji ? (['emoji', 'iconos', 'subir'] as const) : (['iconos', 'subir'] as const)).map((p) => (
          <button key={p} type="button" role="tab" aria-selected={pest === p}
            className={`ip-tab${pest === p ? ' on' : ''}`} onClick={() => setPest(p)}>
            {p === 'emoji' ? 'Emoji' : p === 'iconos' ? 'Iconos' : 'Subir'}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        {/* «Quitar» sólo con algo puesto: un botón que no hace nada se lee como que
            la app está rota. Es la misma regla que tenía «Quitar la foto». */}
        {hayAlgo && (
          <button type="button" className="ip-quitar"
            onClick={() => { onElegir({ emoji: '', icono: null, y: null }); onCerrar(); }}>Quitar</button>
        )}
      </div>

      <div className="ip-cuerpo">
        {pest === 'emoji' && (
          <EmojiPicker onPick={(em) => onElegir({ emoji: em, icono: null, y: null })} onClose={onCerrar} />
        )}
        {pest === 'iconos' && <Iconos actual={icono} onElegir={(v) => onElegir({ icono: v, y: null })} />}
        {pest === 'subir' && (
          <Subir foto={urlPortada(icono)} y={y}
            onSubida={(url) => onElegir({ icono: url, y: null })}
            onEncuadrar={(v) => onElegir({ y: v })} />
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </div>,
    document.body,
  );
}

/** La pestaña de íconos: buscador + grilla. Sin buscar, los sugeridos. */
function Iconos({ actual, onElegir }: { actual?: string | null; onElegir: (v: string) => void }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState<string[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [mal, setMal] = useState('');

  useEffect(() => {
    const t = q.trim();
    if (!t) { setRes(null); setMal(''); return; }
    // Un debounce corto: escribir «cohete» son seis pedidos sin esto.
    const id = setTimeout(() => {
      setCargando(true); setMal('');
      fetch(urlBusquedaIconos(t))
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`el buscador contestó ${r.status}`))))
        .then((j: { icons?: string[] }) => setRes(j.icons ?? []))
        // ⚠️ «No pude buscar» NO se pinta como «no hay resultados»: son dos pantallas
        // y la segunda manda a probar otra palabra cuando el problema es la red.
        .catch((e: unknown) => setMal(e instanceof Error ? e.message : String(e)))
        .finally(() => setCargando(false));
    }, 280);
    return () => clearTimeout(id);
  }, [q]);

  const lista = res ?? ICONOS_SUGERIDOS;
  const actualNombre = nombreDeIcono(actual);

  return (
    <>
      <input className="ip-buscar" value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar un ícono…" aria-label="Buscar un ícono" />
      {mal && <p className="ip-mal">{mal}</p>}
      {cargando && <p className="ip-cargando"><Spinner /> Buscando…</p>}
      {!cargando && !mal && res?.length === 0 && <p className="ip-vacio">No encontré ninguno con «{q.trim()}».</p>}
      {!cargando && !mal && (
        <ul className="ip-grid">
          {lista.map((n) => {
            const v = valorIcono(n);
            if (!v) return null;
            return (
              <li key={n}>
                <button type="button" className={`ip-op${actualNombre === n ? ' on' : ''}`}
                  onClick={() => onElegir(v)} title={n} aria-label={n}>
                  {/* Sin `next/image`: es un SVG de 1 KB de un CDN, y el optimizador lo
                      volvería a servir por nuestra función cobrando por cada ícono. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={urlIcono(v, { tam: 22 }) ?? ''} alt="" loading="lazy" width={22} height={22} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

/**
 * La pestaña de subir. Y si ya hay una foto, el ENCUADRE del círculo.
 *
 * ⚠️ LA VISTA PREVIA ES EL CÍRCULO DE VERDAD, del tamaño en que se va a ver. Un
 * encuadre que se ajusta sobre un cuadrado grande y después se recorta en un
 * círculo de 62 px es encuadrar otra cosa.
 */
function Subir({ foto, y, onSubida, onEncuadrar }: {
  foto: string | null;
  y?: number | null;
  onSubida: (url: string) => void;
  onEncuadrar: (y: number) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [encima, setEncima] = useState(false);
  const [mal, setMal] = useState('');
  const imgRef = useRef<HTMLImageElement>(null);
  const yRef = useRef<number>(y ?? 50);
  const arrastre = useRef<{ desde: number; base: number } | null>(null);

  useEffect(() => { yRef.current = y ?? 50; }, [y]);

  async function mandar(f: File) {
    setSubiendo(true); setMal('');
    try {
      const fd = new FormData();
      fd.append('file', f);
      const r = await fetch('/api/portadas', { method: 'POST', body: fd });
      const j: { ok: boolean; url?: string; error?: string } = await r.json();
      if (!j.ok || !j.url) { setMal(j.error || 'No pude subirla.'); return; }
      onSubida(j.url);
    } catch (e) {
      setMal(e instanceof Error ? e.message : String(e));
    } finally { setSubiendo(false); }
  }

  return (
    <div className="ip-subir">
      {foto && (
        <div className="ip-encuadre">
          <div className="ip-circulo"
            onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); arrastre.current = { desde: e.clientY, base: yRef.current }; }}
            onPointerMove={(e) => {
              const a = arrastre.current;
              if (!a || !imgRef.current) return;
              // Mismo signo y misma razón que en `Reposicionar`: arrastrar hacia abajo
              // muestra lo de arriba. 1.2 por píxel porque el círculo mide 96 y el
              // recorrido útil es el alto sobrante de la foto.
              const v = Math.max(0, Math.min(100, a.base - (e.clientY - a.desde) * 1.2));
              yRef.current = v;
              imgRef.current.style.objectPosition = `center ${v}%`;
            }}
            onPointerUp={() => { if (arrastre.current) { arrastre.current = null; onEncuadrar(Math.round(yRef.current)); } }}
            onPointerCancel={() => { arrastre.current = null; }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img ref={imgRef} src={foto} alt="" style={{ objectPosition: `center ${y ?? 50}%` }} draggable={false} />
          </div>
          <span className="ip-ayuda">Arrastrá la foto para centrarla</span>
        </div>
      )}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void mandar(f); e.target.value = ''; }} />
      <div className={`ip-soltar${encima ? ' encima' : ''}`}
        onDragOver={(e) => { e.preventDefault(); if (!encima) setEncima(true); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setEncima(false); }}
        onDrop={(e) => { e.preventDefault(); setEncima(false); const f = e.dataTransfer.files?.[0]; if (f) void mandar(f); }}>
        <button type="button" className="ip-btn" disabled={subiendo} onClick={() => input.current?.click()}>
          {subiendo ? <><Spinner /> Subiendo…</> : foto ? 'Cambiar la imagen' : 'Elegir una imagen'}
        </button>
        <p className="ip-ayuda">o soltala acá · hasta 6MB</p>
      </div>
      {mal && <p className="ip-mal">{mal}</p>}
    </div>
  );
}

const CSS = `
.ip-pop{ position:fixed; width:${ANCHO}px; max-width:calc(100vw - 20px);
  background:var(--surface); border:1px solid var(--border); border-radius:12px;
  box-shadow:0 14px 42px rgba(18,21,27,.22), 0 2px 8px rgba(18,21,27,.10);
  padding:0 0 4px; outline:none; }
.ip-tabs{ display:flex; align-items:center; gap:2px; padding:0 12px; border-bottom:1px solid var(--border); }
.ip-tab{ position:relative; background:none; border:0; padding:11px 8px 10px; font:inherit;
  font-size:13px; color:var(--dim); cursor:pointer; }
.ip-tab:hover{ color:var(--ink); }
.ip-tab.on{ color:var(--ink); font-weight:600; }
.ip-tab.on::after{ content:''; position:absolute; left:6px; right:6px; bottom:-1px; height:2px;
  background:var(--ink); border-radius:2px 2px 0 0; }
.ip-quitar{ background:none; border:0; font:inherit; font-size:12.5px; color:var(--faint);
  cursor:pointer; padding:8px 4px; }
.ip-quitar:hover{ color:var(--bad); }

/* Alto fijo por lo mismo que en el selector de portada: la posicion se calcula
   contra la caja del panel, asi que un cuerpo que cambia de alto al cambiar de
   pestaña hace saltar el panel de lugar. */
.ip-cuerpo{ height:${ALTO_CUERPO}px; overflow-y:auto; padding:10px 12px 12px; }

.ip-buscar{ width:100%; box-sizing:border-box; border:1px solid var(--border); border-radius:8px;
  padding:7px 10px; font:inherit; font-size:13px; color:var(--ink); background:var(--surface-2);
  margin-bottom:10px; }
.ip-buscar:focus{ outline:none; border-color:var(--primary); background:var(--surface); }

.ip-grid{ list-style:none; margin:0; padding:0; display:grid; gap:4px;
  grid-template-columns:repeat(auto-fill, minmax(38px, 1fr)); }
.ip-op{ display:flex; align-items:center; justify-content:center; width:100%; aspect-ratio:1;
  border:1px solid transparent; border-radius:7px; background:none; cursor:pointer; color:var(--ink); }
.ip-op:hover{ background:var(--surface-2); border-color:var(--border); }
.ip-op.on{ border-color:var(--primary); background:var(--primary-bg); }
.ip-op img{ display:block; }

.ip-subir{ display:flex; flex-direction:column; gap:12px; }
.ip-encuadre{ display:flex; flex-direction:column; align-items:center; gap:6px; }
/* El circulo de la vista previa: el mismo redondel que la app dibuja, para que lo
   que se encuadra sea lo que se va a ver. */
.ip-circulo{ width:96px; height:96px; border-radius:999px; overflow:hidden; cursor:grab;
  touch-action:none; box-shadow:0 0 0 3px var(--surface), 0 0 0 4px var(--border); }
.ip-circulo:active{ cursor:grabbing; }
.ip-circulo img{ width:100%; height:100%; object-fit:cover; display:block; user-select:none; }
.ip-soltar{ display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px;
  border:1.5px dashed var(--border-strong); border-radius:10px; padding:16px; text-align:center;
  transition:border-color .12s, background .12s; }
.ip-soltar.encima{ border-color:var(--primary); background:var(--primary-bg); }
.ip-btn{ display:inline-flex; align-items:center; gap:8px; background:var(--primary); border:0;
  border-radius:9px; padding:9px 16px; font:inherit; font-size:13px; font-weight:600; color:#fff; cursor:pointer; }
.ip-btn:disabled{ opacity:.7; cursor:default; }
.ip-ayuda{ margin:0; font-size:11.5px; color:var(--faint); }
.ip-cargando{ display:flex; align-items:center; gap:8px; margin:10px 2px; font-size:13px; color:var(--dim); }
.ip-vacio{ margin:10px 2px; font-size:13px; color:var(--dim); }
.ip-mal{ margin:10px 2px 0; font-size:12.5px; color:var(--bad); }
`;
