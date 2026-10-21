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
import { MAX_CONSULTAS, ROTULO_PASO, leerConsulta, proporcion, razon, type Bloque, type BloqueCreado } from '@/lib/chat-bloques';
import { esBloqueWeb } from '@/lib/editor-landing/bloques-web';

/** Los bloques del Web Generator (la tarjeta de una landing, elegir entre 3, lo publicado, el dominio), aparte: traen la
 *  hoja del contenido de las landings (~100 KB) y sólo se cargan cuando un hilo tiene uno. */
const BloqueWeb = dynamic(() => import('@/app/web-generator/BloqueWeb').then((m) => m.BloqueWeb));

type Pregunta = Extract<Bloque, { t: 'pregunta' }>;
type Trabajo = Extract<Bloque, { t: 'trabajo' }>;

/** Cada cuánto pregunta la pantalla cómo va un trabajo largo: arranca en 3 s y se estira hasta 15 s. */
const CONSULTA_INICIAL_MS = 3_000;
const CONSULTA_MAX_MS = 15_000;

export function BloqueHilo({ b, onResponder, respondida, onTermina, ocupado }: {
  b: Bloque;
  /** Contestar una pregunta (G1): lo elegido sale como un mensaje de la persona. Sin esto, las opciones se ven y no se tocan.
   *  `false` = no salió (MaKo estaba trabajando): la pregunta NO dice «Respondiste». */
  onResponder?: (texto: string) => boolean | void;
  /** MaKo está trabajando: las opciones esperan (lo tocado no saldría). */
  ocupado?: boolean;
  /** Una pregunta que ya se contestó (al recargar): se ve contestada y no se toca. */
  respondida?: string;
  /** Un trabajo largo (G6) terminó mientras se miraba: quien lo lanzó (su tarjeta, su formulario) deja de decir «En curso». */
  onTermina?: (ok: boolean) => void;
}) {
  if (esBloqueWeb(b)) return <BloqueWeb b={b} onResponder={onResponder} respondida={respondida} ocupado={ocupado} />;
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
  if (b.t === 'trabajo') return <TrabajoHilo b={b} onTermina={onTermina} />;
  return <PreguntaHilo b={b} onResponder={onResponder} respondida={respondida} ocupado={ocupado} />;
}

/**
 * G6: los pasos de un trabajo largo. Con `consulta` y un paso en curso, la pantalla pregunta cómo va
 * (GET /api/mako/chat?trabajo=, lib/chat-trabajos.ts) hasta que termina, y entonces dibuja su resultado: el G5 en que
 * termina, su «Abrir», lo que dibuje aparte (1.11) y lo que pasó en palabras («No se pudo: …»). Sin recargar.
 * ⚠️ NO PREGUNTA PARA SIEMPRE (revisión del 21/10/2026): un 404 (el trabajo ya no está) o `MAX_CONSULTAS` sin respuesta
 *    lo cortan, y lo dice. Uno que murió en el server lo corta `estadoDeTrabajo` (su `hasta`).
 */
function TrabajoHilo({ b, onTermina }: { b: Trabajo; onTermina?: (ok: boolean) => void }) {
  const ws = useWs();
  const [actual, setActual] = useState<Trabajo>(b);
  const [aparte, setAparte] = useState<Bloque[]>([]);
  /** Cómo terminó, visto desde acá: `ok` null = no se sabe. */
  const [fin, setFin] = useState<{ ok: boolean | null; texto: string | null } | null>(null);
  const vivo = !!actual.consulta && actual.pasos.some((p) => p.estado === 'en_curso') && !fin;
  useEffect(() => {
    if (!vivo || !actual.consulta) return;
    const consulta = actual.consulta;
    let parar = false;
    let espera = CONSULTA_INICIAL_MS;
    let intentos = 0;
    let reloj: ReturnType<typeof setTimeout> | undefined;
    const mirar = async () => {
      intentos++;
      let r: ReturnType<typeof leerConsulta> = { sigue: true };
      try {
        const res = await fetch(conWs(`/api/mako/chat?trabajo=${encodeURIComponent(consulta)}`, ws), { cache: 'no-store' });
        r = leerConsulta(res.status, await res.json().catch(() => null), consulta);
      } catch { /* sin red: se vuelve a preguntar */ }
      if (parar) return;
      if (r.trabajo) { setActual(r.trabajo); setAparte(r.aparte ?? []); }
      if (!r.sigue || intentos >= MAX_CONSULTAS) {
        const terminado = r.sigue ? { ok: null, texto: null } : { ok: r.ok, texto: r.texto };
        setFin(terminado);
        if (terminado.ok != null) onTermina?.(terminado.ok);
        return;
      }
      espera = Math.min(Math.round(espera * 1.5), CONSULTA_MAX_MS);
      reloj = setTimeout(() => void mirar(), espera);
    };
    reloj = setTimeout(() => void mirar(), espera);
    return () => { parar = true; if (reloj) clearTimeout(reloj); };
    // `onTermina` cambia en cada render del padre: no reinicia la consulta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      {fin && (
        <p className={`ch-tarjeta__nota${fin.ok === false ? ' ch-form__error' : ''}`} role={fin.ok === false ? 'alert' : 'status'}>
          {fin.texto ?? (fin.ok == null ? 'No sé cómo terminó: recarga el chat para verlo.' : null)}
        </p>
      )}
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
function PreguntaHilo({ b, onResponder, respondida, ocupado }: { b: Pregunta; onResponder?: (texto: string) => boolean | void; respondida?: string; ocupado?: boolean }) {
  const [marcadas, setMarcadas] = useState<number[]>([]);
  const [enviada, setEnviada] = useState<string | null>(null);
  const [noSalio, setNoSalio] = useState(false);
  // Contestada al recargar, o escribiendo después de la pregunta (`conRespuestas`): vale lo que dijo la persona.
  const dicha = respondida ?? enviada;
  const quieta = !onResponder || dicha != null || !!ocupado;
  // ⚠️ «Respondiste» SÓLO SI SALIÓ (revisión del 21/10/2026): tocar mientras MaKo trabajaba marcaba la opción y no
  //    mandaba nada, sin aviso.
  const responder = (t: string) => {
    if (quieta) return;
    if (onResponder?.(t) === false) { setNoSalio(true); return; }
    setNoSalio(false);
    setEnviada(t);
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
            aria-pressed={b.varias ? marcadas.includes(i) : dicha === o.titulo}
            data-recomendada={i === b.recomendada || undefined} onClick={() => tocar(i)}>
            <span className="ch-opcion__titulo">
              {o.titulo}{i === b.recomendada && <span className="ch-pildora">Recomendada</span>}
            </span>
            {o.detalle && <span className="ch-opcion__detalle">{o.detalle}</span>}
          </button>
        ))}
      </div>
      {noSalio && dicha == null && <p className="ch-tarjeta__nota" role="alert">No salió: espera a que MaKo termine y vuelve a tocar.</p>}
      {dicha == null ? (
        <div className="ch-tarjeta__botones">
          {b.varias && (
            <button type="button" className="ch-abrir" disabled={quieta || !marcadas.length}
              onClick={() => responder(marcadas.slice().sort((x, y) => x - y).map((i) => b.opciones[i].titulo).join(', '))}>Listo</button>
          )}
          <button type="button" className="ch-enlace" disabled={quieta} onClick={() => responder('Elige tú')}>Elige tú</button>
          <button type="button" className="ch-enlace" disabled={quieta} onClick={() => responder('Saltear')}>Saltear</button>
        </div>
      ) : <p className="ch-tarjeta__nota">{`Respondiste: ${dicha}`}</p>}
    </div>
  );
}
