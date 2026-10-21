'use client';

// =============================================================================
// Un bloque del hilo con MaKo: la MISMA pieza en la computadora y en el teléfono (20/10/2026, pieza 1.7)
// =============================================================================
// Dibuja los bloques de lib/chat-bloques.ts (docs/ops-center-principal.md §2.4): G5 lo creado con su miniatura y «Abrir
// en <tab>», G4 el antes y el después, G6 un trabajo largo con sus pasos, G1 una pregunta con opciones. La usan el hilo
// de la computadora (app/_chat/HiloMako.tsx), el del teléfono (app/m/mako/ChatMako.tsx) y el del MaKo Analyst de la
// ficha (app/crm/lead-view/MakoAnalystLead.tsx).
//
// ⚠️ SIN CSS PROPIO: las clases (`ch-bloque…`) viven en app/_chat/chat.css, que el teléfono carga con PegadoHilo.tsx.
//    Así la pieza se dibuja en un test (tests/chat-bloques.test.ts) sin navegador.
// ⚠️ LOS LINKS VAN POR `Link` (app/_ui/Link.tsx), que le suma el `?ws=` de quien mira: el bloque guarda la ruta sola.

import { useEffect, useState, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import Link, { useWs } from '@/app/_ui/Link';
import { conWs } from '@/lib/ws-tab';
import { ROTULO_PASO, proporcion, razon, sanearBloque, type Bloque, type BloqueCreado } from '@/lib/chat-bloques';

type Pregunta = Extract<Bloque, { t: 'pregunta' }>;
type Trabajo = Extract<Bloque, { t: 'trabajo' }>;

/** G16 (el Dashboard, 2.7): con la pieza del Dashboard, que arrastra recharts. Por `next/dynamic`: entra cuando hay uno. */
const GraficoHilo = dynamic(() => import('./bloques/GraficoHilo'), {
  ssr: false,
  loading: () => <div className="ch-bloque" data-bloque="grafico" aria-busy="true"><p className="ch-bloque__titulo">Dibujando el gráfico…</p></div>,
});

/** Cada cuánto pregunta la pantalla cómo va un trabajo largo: arranca en 3 s y se estira hasta 15 s. */
const CONSULTA_INICIAL_MS = 3_000;
const CONSULTA_MAX_MS = 15_000;

export function BloqueHilo({ b, onResponder, respondida }: {
  b: Bloque;
  /** Contestar una pregunta (G1): lo elegido sale como un mensaje de la persona. Sin esto, las opciones se ven y no se tocan. */
  onResponder?: (texto: string) => void;
  /** Una pregunta que ya se contestó (al recargar): se ve contestada y no se toca. */
  respondida?: string;
}) {
  if (b.t === 'creado') return <Creado b={b} />;
  if (b.t === 'antes_despues') {
    return (
      <div className="ch-bloque" data-bloque="antes_despues">
        <p className="ch-bloque__titulo">{b.titulo}</p>
        <ul className="ch-ad">
          {b.filas.map((f, i) => (
            <li key={i} className="ch-ad__fila">
              {f.campo && <span className="ch-ad__campo">{f.campo}</span>}
              <span className="ch-ad__lado ch-ad__lado--antes"><span className="ch-ad__rotulo">Original</span><del>{f.antes || '—'}</del></span>
              <span className="ch-ad__lado ch-ad__lado--despues"><span className="ch-ad__rotulo">Modificado</span><ins>{f.despues || '—'}</ins></span>
            </li>
          ))}
        </ul>
        {b.abrir && <div className="ch-tarjeta__botones"><Link className="ch-abrir" href={b.abrir.href}>{b.abrir.titulo}</Link></div>}
      </div>
    );
  }
  if (b.t === 'trabajo') return <TrabajoHilo b={b} />;
  if (b.t === 'grafico') return <GraficoHilo b={b} />;
  return <PreguntaHilo b={b} onResponder={onResponder} respondida={respondida} />;
}

/**
 * G6: los pasos de un trabajo largo. Con `consulta` y un paso en curso, la pantalla pregunta cómo va
 * (GET /api/mako/chat?trabajo=, lib/chat-trabajos.ts) hasta que termina, y entonces dibuja su resultado: el G5 en que
 * termina, su «Abrir», o lo que dibuje aparte (1.11). Sin recargar.
 */
function TrabajoHilo({ b }: { b: Trabajo }) {
  const ws = useWs();
  const [actual, setActual] = useState<Trabajo>(b);
  const [aparte, setAparte] = useState<Bloque[]>([]);
  const vivo = !!actual.consulta && actual.pasos.some((p) => p.estado === 'en_curso');
  useEffect(() => {
    if (!vivo || !actual.consulta) return;
    const consulta = actual.consulta;
    let parar = false;
    let espera = CONSULTA_INICIAL_MS;
    let reloj: ReturnType<typeof setTimeout> | undefined;
    const mirar = async () => {
      try {
        const res = await fetch(conWs(`/api/mako/chat?trabajo=${encodeURIComponent(consulta)}`, ws), { cache: 'no-store' });
        const j = await res.json() as { ok?: boolean; bloques?: unknown[] };
        const bloques = (j.ok && Array.isArray(j.bloques) ? j.bloques : []).map(sanearBloque).filter((x): x is Bloque => !!x);
        const suyo = bloques.find((x): x is Trabajo => x.t === 'trabajo' && x.consulta === consulta);
        if (!parar && suyo) { setActual(suyo); setAparte(bloques.filter((x) => x.t !== 'trabajo')); }
        if (suyo && !suyo.pasos.some((p) => p.estado === 'en_curso')) return;
      } catch { /* sin red: se vuelve a preguntar */ }
      if (parar) return;
      espera = Math.min(Math.round(espera * 1.5), CONSULTA_MAX_MS);
      reloj = setTimeout(() => void mirar(), espera);
    };
    reloj = setTimeout(() => void mirar(), espera);
    return () => { parar = true; if (reloj) clearTimeout(reloj); };
  }, [vivo, actual.consulta, ws]);
  return (
    <div className="ch-bloque" data-bloque="trabajo" role="status" aria-live="polite">
      <p className="ch-bloque__titulo">{actual.titulo}</p>
      <ol className="ch-pasos">
        {actual.pasos.map((p, i) => (
          <li key={i} className="ch-paso" data-estado={p.estado}>
            <span className="ch-paso__marca" aria-hidden />
            <span>{p.texto}</span>
            <span className="ch-oculto">{` · ${ROTULO_PASO[p.estado]}`}</span>
          </li>
        ))}
      </ol>
      {vivo && <p className="ch-tarjeta__nota">Sigue por detrás: puedes cerrar el chat, al volver está.</p>}
      {actual.listo && <Creado b={actual.listo} />}
      {actual.abrir && <div className="ch-tarjeta__botones"><Link className="ch-abrir" href={actual.abrir.href}>{actual.abrir.titulo}</Link></div>}
      {aparte.map((x, i) => <BloqueHilo key={i} b={x} />)}
    </div>
  );
}

/** G5: la miniatura (o un marco con la forma del diseño), el título, el estado y el botón para abrirlo. */
function Creado({ b }: { b: BloqueCreado }) {
  // Una miniatura que no carga (se borró, venció) deja el marco vacío, no un ícono roto.
  const [rota, setRota] = useState(false);
  return (
    <div className="ch-bloque ch-creado" data-bloque="creado">
      <div className="ch-creado__mini" style={{ aspectRatio: proporcion(b), '--r': razon(b) } as CSSProperties}>
        {b.miniatura && !rota
          // eslint-disable-next-line @next/next/no-img-element -- una ruta de la app o una pública de Storage, sin optimizar
          ? <img src={b.miniatura} alt="" loading="lazy" onError={() => setRota(true)} />
          : <span className="ch-creado__vacio" aria-hidden>{b.ancho && b.alto ? `${b.ancho} × ${b.alto}` : ''}</span>}
      </div>
      <div className="ch-creado__pie">
        <div className="ch-creado__texto">
          <p className="ch-creado__titulo">{b.titulo}</p>
          {b.nota && <p className="ch-creado__nota">{b.nota}</p>}
        </div>
        {b.estado && <span className="ch-pildora">{b.estado}</span>}
      </div>
      <div className="ch-tarjeta__botones"><Link className="ch-abrir" href={b.abrir.href}>{b.abrir.titulo}</Link></div>
    </div>
  );
}

/** G1: las opciones, la recomendada marcada; de a una (tocar contesta) o varias (se marcan y «Listo»). */
function PreguntaHilo({ b, onResponder, respondida }: { b: Pregunta; onResponder?: (texto: string) => void; respondida?: string }) {
  const [marcadas, setMarcadas] = useState<number[]>([]);
  const [enviada, setEnviada] = useState<string | null>(respondida ?? null);
  const quieta = !onResponder || enviada != null;
  const responder = (t: string) => {
    if (quieta) return;
    setEnviada(t);
    onResponder?.(t);
  };
  const tocar = (i: number) => {
    if (!b.varias) { responder(b.opciones[i].titulo); return; }
    setMarcadas((xs) => (xs.includes(i) ? xs.filter((x) => x !== i) : [...xs, i]));
  };
  return (
    <div className="ch-bloque" data-bloque="pregunta">
      <p className="ch-bloque__titulo">{b.pregunta}</p>
      <div className="ch-opciones" role="group" aria-label={b.pregunta}>
        {b.opciones.map((o, i) => (
          <button key={i} type="button" className="ch-opcion" disabled={quieta}
            aria-pressed={b.varias ? marcadas.includes(i) : enviada === o.titulo}
            data-recomendada={i === b.recomendada || undefined} onClick={() => tocar(i)}>
            <span className="ch-opcion__titulo">
              {o.titulo}{i === b.recomendada && <span className="ch-pildora">Recomendada</span>}
            </span>
            {o.detalle && <span className="ch-opcion__detalle">{o.detalle}</span>}
          </button>
        ))}
      </div>
      {enviada == null ? (
        <div className="ch-tarjeta__botones">
          {b.varias && (
            <button type="button" className="ch-abrir" disabled={quieta || !marcadas.length}
              onClick={() => responder(marcadas.slice().sort((x, y) => x - y).map((i) => b.opciones[i].titulo).join(', '))}>Listo</button>
          )}
          <button type="button" className="ch-enlace" disabled={quieta} onClick={() => responder('Elige tú')}>Elige tú</button>
          <button type="button" className="ch-enlace" disabled={quieta} onClick={() => responder('Saltear')}>Saltear</button>
        </div>
      ) : <p className="ch-tarjeta__nota">{`Respondiste: ${enviada}`}</p>}
    </div>
  );
}
