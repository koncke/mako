'use client';

// =============================================================================
// /m/mako — el chat con MaKo en el teléfono
// =============================================================================
// El hilo con el scroll del DOCUMENTO (como todo /m) y el composer fijo abajo. Habla con
// /api/m/mako (lib/mako-turno-app.ts): el turno lee datos reales y PROPONE acciones, que
// aparecen en el hilo como filas de decisión y se confirman en su sheet (SheetPropuesta).
//
// ⚠️ LO QUE NO SE REINTENTA: un turno que pudo haber corrido (red caída, corte por tiempo,
// un 5xx) ya pudo haber dejado una acción pendiente y costado una llamada al modelo. Se
// dice «no sé si llegó» y se ofrece recargar el chat, nunca reenviar. Sólo un 4xx con su
// error —el route lo devuelve antes de guardar nada— se puede reintentar.
//
// ⚠️ EL FETCH VA CON SEÑAL DE CORTE (305 s: el maxDuration de la ruta es 300) y el rótulo
// de trabajo dice que puede tardar: los turnos medidos tardaron 23-108 s.
//
// Las sesiones son de ESTA persona (el route compara la clave en cada lectura). «Nuevo
// chat» no crea nada hasta el primer mensaje: una sesión vacía por cada toque llenaría la
// lista de chats sin título.
//
// v2 (docs/prototipos/mako-mobile-v2.html, «MaKo»): pantalla de TRABAJO dentro de More (sin
// barra, «‹ More» y «MaKo» en la barra de arriba: lo pone cabecera.ts). Burbuja tuya azul llena,
// la de MaKo en --surface con borde. Sin hora debajo de cada burbuja y sin la estrella en cada
// mensaje: la estrella dorada va SÓLO en lo que MaKo propone (las filas de decisión del hilo).
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useWs } from '@/app/_ui/Link';
import { Button } from '@/app/_ui/Button';
import { Icon } from '@/app/_components/icons';
import { conWs } from '@/lib/ws-tab';
import { TITULO_INBOX } from '@/lib/movil-rutas';
import { GRAMATICA } from '@/lib/mako-gramatica';
import type { MensajeChat, RespuestaTurno, SesionChat, TarjetaPendiente } from '@/lib/mako-turno-app-reglas';
import {
  CabeceraM, FilaM, ListaM, PieM, PildoraM, SheetM, SkeletonFilas, VacioM, ErrorM, useConexion, horaCorta,
} from '../_ui';
import { Composer, type Envio } from './Composer';
import { SheetPropuesta } from './SheetPropuesta';
import { postConProgreso } from './subir';
import {
  AVISO_LENTO_S, ERROR_INCIERTO, PILL_PROPUESTA, duracion, fuenteDelTurno, idLocal, itemsDeRespuesta,
  itemsDeSesion, leerRespuesta, type EstadoPropuesta, type ItemHilo,
} from './chat-ui';

const RUTA = '/api/m/mako';
/** El maxDuration de /api/m/mako es 420 s (tanda 7: confirmar replicar_landing): el corte del navegador va 5 s después. */
const TOPE_MS = 425_000;

type Abierta = { sesion: SesionChat; mensajes: MensajeChat[]; propuestas: TarjetaPendiente[] };
type Trabajo = { fase: 'subiendo' | 'revisando'; pct: number; desde: number; fuente: string };

export function ChatMako({ sesionesIniciales, inicial, hrefMapa = null }: {
  sesionesIniciales: SesionChat[];
  inicial: Abierta | null;
  /** El Mapa del Second Brain (sólo el admin, lo decide el servidor): va arriba de la hoja «Tus chats» (16/10/2026). */
  hrefMapa?: string | null;
}) {
  const ws = useWs();
  const { enLinea } = useConexion();
  const [sesiones, setSesiones] = useState<SesionChat[]>(sesionesIniciales);
  const [sesion, setSesion] = useState<SesionChat | null>(inicial?.sesion ?? null);
  const [items, setItems] = useState<ItemHilo[]>(() => (inicial ? itemsDeSesion(inicial.mensajes, inicial.propuestas) : []));
  const [cargando, setCargando] = useState(false);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [trabajo, setTrabajo] = useState<Trabajo | null>(null);
  const [segs, setSegs] = useState(0);
  const [hojaChats, setHojaChats] = useState(false);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [altoComposer, setAltoComposer] = useState(96);
  const envios = useRef(new Map<string, Envio>());

  // ── El header: una acción, la lista de chats ──
  const accion = useMemo(() => (
    <button type="button" className="m-cabecera__accion" aria-label="Tus chats" title="Tus chats" onClick={() => setHojaChats(true)}>
      <Icon name="chats" size={22} />
    </button>
  ), []);

  // ── El scroll: abajo al abrir y con cada cosa nueva ──
  const alFondo = useCallback((suave = true) => {
    requestAnimationFrame(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: suave ? 'smooth' : 'auto' }));
  }, []);
  useEffect(() => { alFondo(false); }, [alFondo]);
  const cuantos = items.length;
  useEffect(() => { if (cuantos) alFondo(); }, [cuantos, alFondo]);
  useEffect(() => { if (trabajo) alFondo(); }, [trabajo?.fase, alFondo]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── El reloj del trabajo ──
  useEffect(() => {
    if (!trabajo) { setSegs(0); return; }
    const t = window.setInterval(() => setSegs(Math.floor((Date.now() - trabajo.desde) / 1000)), 1000);
    return () => window.clearInterval(t);
  }, [trabajo]);

  const marcar = (id: string, cambio: Partial<Extract<ItemHilo, { k: 'msg' }>>) =>
    setItems((xs) => xs.map((x) => (x.id === id && x.k === 'msg' ? { ...x, ...cambio } : x)));

  // ── Abrir una sesión ──
  const abrir = useCallback(async (id: number) => {
    setHojaChats(false);
    setCargando(true);
    setErrorCarga(null);
    try {
      const res = await fetch(`${RUTA}?sessionId=${id}`, { signal: AbortSignal.timeout(30_000) });
      const l = leerRespuesta<Abierta>(res.status, await res.text());
      if (!l.ok) { setErrorCarga(l.reintentable ? l.error : 'No pude abrir el chat.'); return; }
      setSesion(l.datos.sesion);
      setItems(itemsDeSesion(l.datos.mensajes, l.datos.propuestas));
      alFondo(false);
    } catch {
      setErrorCarga('No pude abrir el chat. Revisa la red.');
    } finally { setCargando(false); }
  }, [alFondo]);

  const refrescarLista = useCallback(async () => {
    try {
      const res = await fetch(`${RUTA}?sesiones=1`, { signal: AbortSignal.timeout(20_000) });
      const l = leerRespuesta<{ sesiones: SesionChat[] }>(res.status, await res.text());
      if (l.ok) setSesiones(l.datos.sesiones);
    } catch { /* la lista que hay sigue sirviendo */ }
  }, []);
  useEffect(() => { if (hojaChats) void refrescarLista(); }, [hojaChats, refrescarLista]);

  const nuevoChat = () => {
    setHojaChats(false);
    setSesion(null);
    setItems([]);
    setErrorCarga(null);
  };

  // ── Mandar un turno ──
  const enviar = async (e: Envio) => {
    if (trabajo) return;
    const idU = idLocal('u');
    envios.current.set(idU, e);
    setItems((xs) => [...xs, {
      k: 'msg', id: idU, role: 'user', texto: e.texto, at: new Date().toISOString(),
      voz: e.voz ?? null, adjuntos: e.adjuntos.map((a) => a.nombre), estado: 'enviando',
    }]);
    const fuente = fuenteDelTurno(e.adjuntos);
    setTrabajo({ fase: e.adjuntos.length ? 'subiendo' : 'revisando', pct: 0, desde: Date.now(), fuente });

    try {
      // Sin sesión todavía: se crea ahora (sin saludo del modelo).
      let sid = sesion?.id ?? null;
      if (sid == null) {
        let status = 0; let texto = '';
        try {
          const r = await fetch(RUTA, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'new' }), signal: AbortSignal.timeout(30_000),
          });
          status = r.status; texto = await r.text();
        } catch { /* status 0 */ }
        const l = leerRespuesta<{ sesion: SesionChat }>(status, texto);
        // Crear la sesión no corre ningún turno: si falla, se puede reintentar.
        if (!l.ok) { marcar(idU, { estado: 'error', error: l.reintentable ? l.error : 'No pude abrir el chat.' }); return; }
        sid = l.datos.sesion.id;
        setSesion(l.datos.sesion);
        setSesiones((ss) => [l.datos.sesion, ...ss.filter((s) => s.id !== l.datos.sesion.id)]);
      }

      let status = 0; let texto = '';
      if (e.adjuntos.length) {
        const fd = new FormData();
        fd.append('mensaje', e.texto);
        fd.append('sessionId', String(sid));
        for (const a of e.adjuntos) fd.append('adjuntos', a.file, a.file.name);
        // ⚠️ XMLHttpRequest no pasa por el parche de WsFetch: el `?ws=` va a mano.
        const r = await postConProgreso(conWs(RUTA, ws), fd, {
          alSubir: (p) => setTrabajo((t) => (t ? { ...t, pct: p } : t)),
          alTerminarSubida: () => setTrabajo((t) => (t ? { ...t, fase: 'revisando', pct: 1 } : t)),
          timeoutMs: TOPE_MS,
        });
        status = r.status; texto = r.texto;
      } else {
        try {
          const r = await fetch(RUTA, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'send', sessionId: sid, mensaje: e.texto }),
            signal: AbortSignal.timeout(TOPE_MS),
          });
          status = r.status; texto = await r.text();
        } catch { /* red caída o corte por tiempo: status 0 */ }
      }

      const l = leerRespuesta<RespuestaTurno>(status, texto);
      if (!l.ok) {
        marcar(idU, { estado: l.reintentable ? 'error' : 'incierto', error: l.error });
        return;
      }
      const r = l.datos;
      marcar(idU, { estado: undefined, error: undefined });
      setItems((xs) => {
        const vistas = new Set(xs.flatMap((x) => (x.k === 'propuesta' ? [x.t.pendienteId] : [])));
        return [...xs, ...itemsDeRespuesta(r, vistas)];
      });
      if (r.sesion) {
        setSesion(r.sesion);
        setSesiones((ss) => [r.sesion, ...ss.filter((s) => s.id !== r.sesion.id)]);
      }
    } finally {
      setTrabajo(null);
    }
  };

  const reintentar = (id: string) => {
    const e = envios.current.get(id);
    if (!e || trabajo) return;
    setItems((xs) => xs.filter((x) => x.id !== id));
    void enviar(e);
  };

  // ── Las propuestas ──
  const propuestaAbierta = items.find((x): x is Extract<ItemHilo, { k: 'propuesta' }> => x.k === 'propuesta' && x.id === abierta) ?? null;
  const alEstado = (pendienteId: number, estado: EstadoPropuesta, nota?: string, paraLaPersona?: string[]) => {
    setItems((xs) => {
      const sig = xs.map((x) => (x.k === 'propuesta' && x.t.pendienteId === pendienteId ? { ...x, estado, nota } : x));
      const extra: ItemHilo[] = (paraLaPersona ?? []).filter((t) => t.trim()).map((t) => ({ k: 'aviso', id: idLocal('v'), texto: t, tono: 'mako' }));
      return [...sig, ...extra];
    });
  };

  // ── El dibujo ──
  const vacio = !cargando && !errorCarga && items.length === 0;

  return (
    <div className="m-mako" style={{ paddingBottom: altoComposer + 16 }}>
      <CabeceraM accion={accion} />

      {cargando ? <SkeletonFilas filas={4} />
        : errorCarga ? <ErrorM frase={errorCarga} onReintentar={sesion ? () => void abrir(sesion.id) : undefined} />
        : vacio ? <VacioM frase="Pregúntale por tus leads, tu agenda o tu plan." />
        : (
          <ol className="m-mako-hilo" aria-label="Conversación con MaKo">
            {items.map((x) => (
              <Item key={x.id} x={x}
                onAbrir={(id) => setAbierta(id)}
                onReintentar={reintentar}
                onRecargar={sesion ? () => void abrir(sesion.id) : undefined} />
            ))}
            {trabajo && <Trabajando t={trabajo} segs={segs} />}
          </ol>
        )}

      <Composer enLinea={enLinea} ocupado={trabajo != null} onEnviar={(e) => void enviar(e)} onAltura={setAltoComposer} />

      <SheetPropuesta item={propuestaAbierta} sessionId={sesion?.id ?? null} onCerrar={() => setAbierta(null)} onEstado={alEstado} />

      <SheetM abierto={hojaChats} onCerrar={() => setHojaChats(false)} titulo="Tus chats" id="chats" snap="medio"
        pie={<PieM><Button variant="primary" size="lg" full onClick={nuevoChat}>Nuevo chat</Button></PieM>}>
        {/* El grafo del negocio, arriba de los chats: como «Mapa» en la barra del Second Brain de escritorio. */}
        {hrefMapa && <ListaM><FilaM navegacion titulo="Mapa" icono="cerebro" href={hrefMapa} /></ListaM>}
        {sesiones.length === 0
          ? <VacioM frase="Todavía no hay chats." />
          : (
            <ListaM>
              {sesiones.map((s) => {
                const nombre = s.titulo?.trim() || 'Chat sin título';
                const actual = s.id === sesion?.id;
                return (
                  <FilaM key={s.id} navegacion chevron={false}
                    titulo={nombre}
                    etiqueta={actual ? `${nombre}, abierto` : undefined}
                    riel={<span className="m-mako-riel"><CuandoCorto iso={s.updatedAt} />{actual && <Icon name="check" size={18} />}</span>}
                    onClick={() => void abrir(s.id)} />
                );
              })}
            </ListaM>
          )}
      </SheetM>
    </div>
  );
}

// ── Las piezas del hilo ──────────────────────────────────────────────────────

/** La estrella de MaKo: sólo en lo que MaKo propone (no en cada mensaje suyo). */
const MARCA_MAKO = <span className="m-mako-marca" aria-hidden><Icon name="mako" size={18} /></span>;

function Item({ x, onAbrir, onReintentar, onRecargar }: {
  x: ItemHilo;
  onAbrir: (id: string) => void;
  onReintentar: (id: string) => void;
  onRecargar?: () => void;
}) {
  if (x.k === 'msg') {
    const tuyo = x.role === 'user';
    return (
      <li className={`m-mako-msg ${tuyo ? 'm-mako-msg--yo' : 'm-mako-msg--mk'}`} data-estado={x.estado}>
        <div className="m-mako-burbuja">
          {x.voz && <NotaDeVoz url={x.voz.url} secs={x.voz.secs} />}
          {x.adjuntos && x.adjuntos.length > 0 && (
            <p className="m-mako-adjuntos">{x.adjuntos.join(' · ')}</p>
          )}
          {x.texto && <div className={x.voz ? 'm-mako-transcripcion' : 'm-mako-texto'}>{tuyo ? x.texto : conNegritas(x.texto)}</div>}
        </div>
        {x.estado === 'error' ? (
          <p className="m-mako-falla" role="alert">
            {x.error} <button type="button" onClick={() => onReintentar(x.id)}>Reintentar el envío</button>
          </p>
        ) : x.estado === 'incierto' ? (
          <p className="m-mako-falla" role="alert">
            {x.error ?? ERROR_INCIERTO} {onRecargar && <button type="button" onClick={onRecargar}>Recargar el chat</button>}
          </p>
        ) : null}
      </li>
    );
  }
  if (x.k === 'aviso') {
    return x.tono === 'plataforma'
      ? <li className="m-mako-aviso" role="status">{x.texto}</li>
      : (
        <li className="m-mako-msg m-mako-msg--mk">
          <div className="m-mako-burbuja"><div className="m-mako-texto">{conNegritas(x.texto)}</div></div>
        </li>
      );
  }
  if (x.k === 'pantalla') {
    return (
      <li className="m-mako-fila">
        <ListaM>
          <FilaM leading={MARCA_MAKO} titulo={x.p.titulo} segunda={`Se revisa en ${TITULO_INBOX}`} href={x.p.href} />
        </ListaM>
      </li>
    );
  }
  const pill = PILL_PROPUESTA[x.estado];
  return (
    <li className="m-mako-fila">
      <ListaM>
        <FilaM
          leading={MARCA_MAKO}
          titulo={x.t.resumen}
          segunda={x.estado === 'pendiente' ? (x.t.consecuencia ?? x.t.titulo) : x.t.titulo}
          pill={<PildoraM tono={pill.tono}>{pill.texto}</PildoraM>}
          enCurso={x.estado === 'aplicando' ? true : undefined}
          onClick={() => onAbrir(x.id)}
        />
      </ListaM>
    </li>
  );
}

function Trabajando({ t, segs }: { t: Trabajo; segs: number }) {
  const rotulo = t.fase === 'subiendo'
    ? `Subiendo ${t.fuente} · ${Math.round(t.pct * 100)}%`
    : `${GRAMATICA.analizando.rotulo} · ${t.fuente}`;
  const viva = !(t.fase === 'subiendo' && t.pct >= 1);
  return (
    <li className="m-mako-msg m-mako-msg--mk" role="status" aria-live="polite">
      <div className="m-mako-burbuja m-mako-trabajo">
        <span className="m-mako-trabajo__rotulo">{rotulo}</span>
        {t.fase === 'revisando' && segs >= AVISO_LENTO_S && (
          <span className="m-mako-trabajo__lento">Puede tardar un par de minutos · {segs} s</span>
        )}
        <span className={`m-mako-trabajo__barra${viva ? ' m-mako-trabajo__barra--viva' : ''}`} aria-hidden>
          <i style={{ width: t.fase === 'subiendo' ? `${Math.round(t.pct * 100)}%` : '40%' }} />
        </span>
      </div>
    </li>
  );
}

function NotaDeVoz({ url, secs }: { url: string; secs: number }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [sonando, setSonando] = useState(false);
  return (
    <div className="m-mako-voz">
      <button type="button" className="m-mako-voz__play" aria-label={sonando ? 'Pausar la nota de voz' : 'Escuchar la nota de voz'}
        onClick={() => { const a = audio.current; if (!a) return; if (a.paused) void a.play(); else a.pause(); }}>
        <Icon name={sonando ? 'pausa' : 'play'} size={18} />
      </button>
      <span className="m-mako-voz__dur">{duracion(secs)}</span>
      <audio ref={audio} src={url} preload="metadata" onPlay={() => setSonando(true)} onPause={() => setSonando(false)} onEnded={() => setSonando(false)} />
    </div>
  );
}

/** «14:20» si es de hoy, «12 oct» si no (en el reloj del teléfono: se calcula después de hidratar). */
function CuandoCorto({ iso }: { iso: string }) {
  const [txt, setTxt] = useState('');
  useEffect(() => {
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return;
    const d = new Date(t);
    const hoy = new Date();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTxt(d.toDateString() === hoy.toDateString() ? horaCorta(t) : d.toLocaleDateString('es', { day: 'numeric', month: 'short' }));
  }, [iso]);
  return <>{txt}</>;
}

/** El texto de MaKo con sus **negritas** (lo único de markdown que se dibuja). */
function conNegritas(texto: string): ReactNode {
  const partes = texto.split(/\*\*([^*]+)\*\*/g);
  return partes.map((p, i) => (i % 2 ? <strong key={i}>{p}</strong> : p));
}
