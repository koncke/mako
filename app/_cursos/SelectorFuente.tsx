'use client';

/**
 * La FUENTE del curso en el navegador: cargar la hoja de una familia cuando hace falta, y la
 * BIBLIOTECA que va en el menú de la marca, debajo del color (item 3 del 08/10/2026). El catálogo y
 * las reglas (qué se guarda, qué variables se pintan, cómo se busca) son puros y viven en ./fuentes.ts.
 *
 * ⚠️ CADA FAMILIA ENTRA UNA SOLA VEZ, con un `<link>` de id propio en el `<head>`, como la hoja del
 *    curso (`useCssUgc`, ./CursoUgc.tsx). Nunca se arma una hoja «sólo con las letras de la muestra»
 *    (el `text=` de Google, que pesa menos): declara la MISMA familia con menos glifos, y si llega
 *    después de la completa le gana —el curso dibujaría con la de respaldo todas las letras que no
 *    estaban en la muestra, sin un error—.
 *
 * ── Por qué la hoja de cada fuente se pide AL VERSE (13/10/2026) ──────────────────────────────
 * El catálogo pasó de 7 a 24 familias («una biblioteca de tipografías seleccionables», Martín). Cada
 * renglón se dibuja CON SU PROPIA LETRA —que es lo que lo vuelve elegible de un vistazo—, así que
 * cada renglón visible baja su `.woff2`. Con 24 eso es bajar las 24 al abrir un menú donde se va a
 * elegir una: medido en el catálogo viejo, el latino normal pesa entre 6 KB (Poppins) y 92 KB (Inter).
 * Por eso la hoja de un renglón se pide cuando ese renglón ENTRA EN PANTALLA, y la biblioteca abre
 * pidiendo las seis o siete que se ven.
 *
 * ⚠️ Y SI NO HAY `IntersectionObserver`, SE PIDEN TODAS. Un renglón cuya hoja no llegó se dibuja con
 *    la de respaldo, o sea con la letra de otra: la muestra MIENTE, que es peor que tardar. La
 *    degradación va hacia lo correcto y lento, nunca hacia lo rápido y falso.
 */

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { FUENTES, FUENTE_DEFAULT, agrupar, buscarFuentes, fuenteDe, type FuenteCurso } from './fuentes';

/** El id del `<link>` de una familia. Uno por familia: lo buscan las dos puntas antes de crear otro. */
const idHoja = (f: FuenteCurso) => `ugc-fuente-${f.id}`;

/** Mete la hoja de Google de una familia si todavía no está. Sin hoja (la de siempre), nada. */
export function cargarHojaDeFuente(f: FuenteCurso): void {
  if (!f.hoja || typeof document === 'undefined') return;
  if (document.getElementById(idHoja(f))) return;
  const l = document.createElement('link');
  l.id = idHoja(f);
  l.rel = 'stylesheet';
  l.href = f.hoja;
  document.head.appendChild(l);
}

/**
 * Carga la hoja de cada fuente pedida (ids del catálogo; uno desconocido es la de siempre, que no carga
 * nada). En un efecto: el `<head>` no se toca al dibujar en el server.
 *
 * ⚠️ Esto pide TODAS las que le pasen, de una. Es lo correcto para una lista corta y conocida (el
 *    panel de estilo del Dashboard le pasa su propio catálogo); la biblioteca de acá abajo NO lo usa,
 *    porque con 24 familias sería bajarlas todas para elegir una.
 */
export function useHojasDeFuentes(ids: ReadonlyArray<string | null | undefined>): void {
  const firma = ids.map((i) => i ?? '').join('|');
  useEffect(() => {
    for (const id of firma.split('|')) if (id) cargarHojaDeFuente(fuenteDe(id));
  }, [firma]);
}

/**
 * Pide la hoja de cada renglón cuando ese renglón entra en pantalla. Devuelve el `ref` del contenedor
 * que scrollea; cada renglón se marca con `data-fuente="<id>"`.
 *
 * ⚠️ El observer se REARMA cuando cambia la lista dibujada (la búsqueda), porque los nodos que mira
 *    son otros. Sin eso, filtrar deja renglones nuevos sin pedir su hoja y la muestra queda en la
 *    letra de respaldo — que es exactamente la mentira que esta pantalla no puede permitirse.
 */
function useHojasAlVerse(contenedor: React.RefObject<HTMLDivElement | null>, firma: string): void {
  useEffect(() => {
    const caja = contenedor.current;
    if (!caja) return;
    const pedir = (el: Element) => {
      const id = el.getAttribute('data-fuente');
      if (id) cargarHojaDeFuente(fuenteDe(id));
    };
    const filas = Array.from(caja.querySelectorAll('[data-fuente]'));
    // Sin el observer no hay forma de saber qué se ve: se piden todas. Lento y honesto.
    if (typeof IntersectionObserver === 'undefined') { filas.forEach(pedir); return; }
    const obs = new IntersectionObserver((entradas) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue;
        pedir(e.target);
        obs.unobserve(e.target);   // una vez pedida, deja de mirarse
      }
    }, { root: caja, rootMargin: '120px' });
    filas.forEach((f) => obs.observe(f));
    return () => obs.disconnect();
  }, [contenedor, firma]);
}

/**
 * La BIBLIOTECA del menú de la marca: 24 familias en cuatro cajones, cada una escrita CON ELLA MISMA
 * (la muestra) y con una palabra que la distingue. Va adentro del menú, así que se monta sólo al
 * abrirlo.
 *
 * `onElegir` recibe el id; elegir la de siempre manda `null` (borra la fila, como el color).
 *
 * ⚠️ EL `null` SALE DE `FUENTE_DEFAULT`, NO DE `FUENTES[0]`. La versión anterior comparaba contra el
 *    primero del array: con una familia nueva arriba, elegir «la de siempre» habría guardado su id en
 *    vez de borrar la fila, y «nadie la eligió» y «eligió la de siempre» volvían a ser el mismo valor.
 */
export function SelectorFuente({ actual, onElegir, disabled }: {
  actual: string | null | undefined;
  onElegir: (id: string | null) => void;
  disabled?: boolean;
}) {
  const [q, setQ] = useState('');
  const caja = useRef<HTMLDivElement>(null);
  const idBuscador = useId();
  const elegida = fuenteDe(actual).id;

  const cajones = useMemo(() => agrupar(buscarFuentes(q), elegida), [q, elegida]);
  const cuantas = cajones.reduce((n, [, fs]) => n + fs.length, 0);
  useHojasAlVerse(caja, `${q}|${elegida}`);

  return (
    <div className="ugc-fuentes" role="group" aria-label="Fuente del curso">
      {/* El buscador es lo que hace que 24 se elijan más rápido que 7 sin él. Los estilos van en
          línea a propósito y NO en app/_cursos/estilos.ts: ese archivo lo está editando otra sesión
          ahora mismo, y commitearlo me llevaría su trabajo adentro. Cuando lo suelten, se mudan. */}
      <input
        id={idBuscador} type="search" value={q} onChange={(e) => setQ(e.target.value)}
        disabled={disabled || undefined} placeholder="Buscar tipografía" aria-label="Buscar tipografía"
        style={{
          width: '100%', boxSizing: 'border-box', margin: '2px 0 6px', padding: '7px 9px',
          borderRadius: 8, border: '1.5px solid var(--u-line, rgba(0,0,0,.18))',
          background: 'var(--u-card, #fff)', color: 'var(--u-ink, inherit)',
          font: '600 12.5px/1.2 var(--font-jetbrains), ui-monospace, monospace',
        }}
      />

      <div ref={caja} style={{ maxHeight: 240, overflowY: 'auto', overscrollBehavior: 'contain' }}>
        {cajones.map(([grupo, fs]) => (
          <div key={grupo}>
            <div style={{
              padding: '6px 2px 3px', font: '700 10px/1 var(--font-jetbrains), ui-monospace, monospace',
              letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--u-ink-60, var(--dim))',
            }}>
              {grupo}
              {/* La fuente del curso pinta TODO, no sólo los títulos: la advertencia va donde se
                  elige, no en un hallazgo. Cuatro palabras, que es lo que entra en un rótulo. */}
              {grupo === 'Para títulos' && <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 600 }}> · cansan en textos largos</span>}
            </div>
            {fs.map((f) => (
              <button key={f.id} type="button" data-fuente={f.id}
                className={`ugc-menu-item ugc-fuente-op${f.id === elegida ? ' on' : ''}`}
                aria-pressed={f.id === elegida} disabled={disabled || undefined}
                onClick={() => { if (f.id !== elegida) onElegir(f.id === FUENTE_DEFAULT ? null : f.id); }}>
                <span className="ugc-fuente-nombre" style={{ fontFamily: f.pila } as CSSProperties}>{f.nombre}</span>
                <span className="ugc-fuente-tipo">{f.tipo}</span>
              </button>
            ))}
          </div>
        ))}

        {/* Una frase, y dice dónde se arregla. Nunca una lista vacía y muda. */}
        {cuantas === 0 && (
          <p style={{ margin: '10px 2px', font: '600 12px/1.4 inherit', color: 'var(--u-ink-60, var(--dim))' }}>
            Ninguna se llama así. Probá «serif», «mono» o «títulos».
          </p>
        )}
      </div>
    </div>
  );
}

/** Cuántas familias tiene la biblioteca. Lo usa el test para que el menú y el catálogo no se separen. */
export const CUANTAS_FUENTES = FUENTES.length;
