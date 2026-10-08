'use client';

// =============================================================================
// editor-rico-perezoso — el editor rico de la lección, cargado A DEMANDA
// =============================================================================
// Audio del 08/10/2026 (10:40): «está tardando mucho en cargar una clase».
//
// ⚠️ LO QUE SE MIDIÓ: el editor rico (TipTap 3 + ProseMirror) viajaba en el MISMO chunk que la tab entera,
//    o sea que se bajaba y se evaluaba al abrir /customer-success/curso aunque nadie abriera una clase. En
//    el build del 08/10 (10:29) el chunk de la página que lo trae mide 589 KB sin comprimir, el más grande
//    de los 16 que pide la tab. Con esbuild (splitting + minificado): 856,6 KB de JS inicial con TipTap
//    adentro → 422,7 KB con el editor perezoso en la lección y en la tarea, y TipTap en un chunk aparte de
//    509,9 KB (tests/curso-guardado-manual.test.ts, «item 18»).
//
// Ahora se pide con `import()` la primera vez que hace falta, y antes si se puede: `precargarEditorRico`
// lo dispara al pasar el cursor por una tarjeta de clase (./CursoApp.tsx) y cuando el navegador está
// libre. Mientras llega se dibuja una caja del mismo alto con «Cargando…», nunca un hueco: un hueco que
// después crece mueve todo lo de abajo (la tarea) debajo del cursor.
//
// ⚠️ SIN `React.lazy` NI `Suspense`, a propósito (medido en el banco de la pista EDITOR): con el módulo YA
//    precargado, `lazy` igual suspende el primer render (su promesa se resuelve en otra vuelta) y React
//    retiene el contenido ~300 ms para que el «Cargando» no parpadee — el editor aparecía a los ~400 ms del
//    clic con el chunk ya en memoria. Acá, si el módulo está, se dibuja en el MISMO render; si no, la caja,
//    y el editor apenas llega.
//
// ⚠️ TODO LO QUE MONTE EL EDITOR RICO EN LA TAB CURSO VA POR ACÁ (la consigna de la tarea también, pista
//    TAREA): un solo `import` estático de app/_ui/EditorRico en cualquier archivo del grafo de la tab lo
//    vuelve a meter en el chunk de la página, y el corte se pierde sin que nada falle. Lo fija
//    tests/curso-guardado-manual.test.ts.

import { useEffect, useState, type ComponentProps } from 'react';
import type { EditorRico as EditorRicoTipo } from '@/app/_ui/EditorRico';

type Props = ComponentProps<typeof EditorRicoTipo>;
type Modulo = typeof import('@/app/_ui/EditorRico');

/** El módulo, cuando ya llegó: con él se dibuja en el mismo render, sin pasar por la caja. */
let modulo: Modulo | null = null;
let promesa: Promise<Modulo> | null = null;
/** Pide el chunk del editor (una sola vez; si falla, el próximo intento lo vuelve a pedir). */
function cargar(): Promise<Modulo> {
  promesa ??= import('@/app/_ui/EditorRico')
    .then((m) => { modulo = m; return m; })
    .catch((e) => { promesa = null; throw e; });
  return promesa;
}

/** Empieza a bajar el editor sin montarlo: al pasar el cursor por una clase, o con el navegador libre. */
export function precargarEditorRico(): void {
  if (!modulo) void cargar().catch(() => { /* el montaje lo vuelve a pedir y ahí se ve el error */ });
}

export function EditorRicoPerezoso(p: Props) {
  const [m, setM] = useState<Modulo | null>(modulo);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (m) return;
    let vivo = true;
    cargar().then((x) => { if (vivo) setM(x); }).catch(() => { if (vivo) setError(true); });
    return () => { vivo = false; };
  }, [m]);
  if (m) return <m.EditorRico {...p} />;
  // Lo que se ve mientras baja: el mismo alto mínimo que el editor, para que lo de abajo no salte.
  return (
    <div className="cu-rico-cargando" style={{ minHeight: (p.minAlto ?? 120) + 44 }} role="status" aria-live="polite">
      {error ? <button type="button" className="ugc-btn" onClick={() => { setError(false); setM(null); void cargar().then(setM).catch(() => setError(true)); }}>No cargó. Reintentar</button>
        : <span>Cargando…</span>}
    </div>
  );
}
