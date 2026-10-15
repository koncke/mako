'use client';

// =============================================================================
// ChatMakoCrm — el chat con MaKo del panel al costado del CRM
// =============================================================================
// Es el MaKo Analyst de la ficha (app/crm/lead-view/MakoAnalystLead.tsx) al nivel del CRM, con las
// MISMAS piezas y por las mismas razones (ver su cabecera): el hilo `ChatHilo` sin barra, la burbuja
// `BurbujaHilo` con el texto de MaKo por <Markdown>, la barra `ComposerWhatsApp` montada acá con el
// micrófono, la foto de MaKo y la hoja de Offer (`CSS_OFFER`). Las decisiones de pantalla (qué se
// reintenta, cómo se lee la respuesta, qué dice la tarjeta después) salen de app/m/mako/chat-ui.ts:
// una tarjeta no puede decir una cosa acá y otra en el celular.
//
// Lo que cambia:
//   · SIN CLIP: el panel es angosto y lo que se le pregunta es del tablero; una foto o un PDF se
//     llevan a la ficha del lead (que sí los acepta).
//   · EL HILO SE CARGA AL MONTAR, y este componente se monta recién cuando la persona ABRE el panel
//     (PanelMakoCrm.tsx): abrir el hilo ESCRIBE (`pendientesVigentes` vence lo vencido), y el botón
//     plegado vive en cada carga de /crm. Y es de UN CRM: al cambiar de CRM el panel se desmonta entero
//     (su `key`), así que un `funnelId` nuevo nunca llega acá con el panel plegado.
//   · `pedido`: el «Hacerlo» de una sugerencia que se revisa en el chat lo manda como un mensaje más.
//   · Lo confirmado en una tarjeta cambia el tablero: se relee con `router.refresh()`, que es como el
//     tablero se resincroniza con la verdad (app/crm/CrmBoard.tsx).
//
// ⚠️ LO QUE NO SE REINTENTA: un turno que pudo haber corrido (red caída, corte, 5xx) ya pudo haber
// dejado una acción pendiente y costado una llamada: se dice «no sé si llegó» y se ofrece recargar.
// ⚠️ LOS HANDLERS DECIDEN CON REFS (`sesionRef`, `ocupadoRef`): la barra guarda el `onAudio` del
// render en que se apretó el micrófono.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, ButtonLink, Status } from '@/app/_ui';
import { useRouter } from '@/app/_ui/Link';
import { Markdown } from '@/app/_components/Markdown';
import { transcribirNota } from '@/app/_components/useDictar';
import { ChatHilo, type HiloMsg } from '@/app/whatsapp/_shared/ChatHilo';
import { BurbujaHilo } from '@/app/whatsapp/_shared/BurbujaHilo';
import { Ticks } from '@/app/whatsapp/_shared/Ticks';
import { ComposerWhatsApp } from '@/app/whatsapp/_shared/ComposerWhatsApp';
import { AvatarMako } from '@/app/offer/AvatarMako';
import { CSS_OFFER } from '@/app/offer/estilos';
import { horaDe } from '@/app/offer/ayudas';
import {
  AVISO_LENTO_S, ERROR_INCIERTO, PILL_PROPUESTA, SALIDA_PROPUESTA, idLocal, itemsDeRespuesta,
  itemsDeSesion, leerRespuesta, rotuloPrimario, trasTarjeta, type EstadoPropuesta, type ItemHilo,
} from '@/app/m/mako/chat-ui';
import { GRAMATICA } from '@/lib/mako-gramatica';
import type { MensajeChat, ResultadoTarjeta, RespuestaTurno, SesionChat, TarjetaPendiente } from '@/lib/mako-turno-app-reglas';

const RUTA = '/api/crm/mako';
/** El maxDuration de la ruta es 420 s (tanda 7: confirmar replicar_landing): el corte del navegador va 5 s después. */
const TOPE_MS = 425_000;
const ACENTO = 'var(--primary)';
const BURBUJA_YO = 'var(--primary-bg)';
const ID_ESCRIBIENDO = '__mkc-escribiendo';

/** Las preguntas de arranque (sólo con el hilo vacío): lo que más se le pregunta a un tablero. */
const ARRANQUES = ['¿Cómo está mi CRM?', '¿Qué reuniones tengo?', '¿Qué hago hoy?'] as const;

const TEXTO_BURBUJA = { fontSize: 14, lineHeight: 1.45, color: 'var(--ink)', overflowWrap: 'anywhere' as const };

/** La tarjeta de una acción: la del MaKo Analyst (`mal-`), con su prefijo. */
const CSS_PROPIO = `
.mkc-tarjeta { width: min(460px, 100%); display: flex; flex-direction: column; gap: 10px; padding: 12px 14px; border-radius: 14px 14px 14px 4px; background: var(--surface); border: 1px solid var(--border); box-shadow: 0 1px 2px rgba(18,21,27,.04); }
.mkc-tarjeta__cabeza { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 13px; color: var(--dim); }
.mkc-tarjeta__resumen { margin: 0; font-size: 14px; line-height: 1.45; color: var(--ink); overflow-wrap: anywhere; }
.mkc-tarjeta__lineas { margin: 0; display: grid; grid-template-columns: minmax(80px, max-content) minmax(0, 1fr); gap: 4px 12px; font-size: 12.5px; line-height: 1.4; }
.mkc-tarjeta__lineas dt { color: var(--dim); }
.mkc-tarjeta__lineas dd { margin: 0; color: var(--ink); overflow-wrap: anywhere; }
.mkc-tarjeta__consecuencia { margin: 0; font-size: 12.5px; color: var(--ink); }
.mkc-tarjeta__nota { margin: 0; font-size: 12.5px; color: var(--dim); }
.mkc-tarjeta__botones { display: flex; flex-wrap: wrap; gap: 8px; }
.mkc-falla { margin: 0; max-width: 78%; font-size: 12.5px; color: var(--warn); text-align: right; }
.mkc-falla button { margin-left: 6px; padding: 0; border: 0; background: none; color: var(--primary); font: inherit; font-weight: 600; cursor: pointer; text-decoration: underline; }
.mkc-falla button:focus-visible { outline: none; box-shadow: var(--focus-ring); border-radius: 4px; }
`;

type Envio = { texto: string; voz?: { url: string; secs: number; blob: Blob } };
type Trabajo = { desde: number };
type Abierta = { sesion: SesionChat | null; mensajes: MensajeChat[]; propuestas: TarjetaPendiente[] };
type ItemMsg = Extract<ItemHilo, { k: 'msg' }>;
type ItemPropuesta = Extract<ItemHilo, { k: 'propuesta' }>;

function FilaMako({ animar = false, children }: { animar?: boolean; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <AvatarMako size={28} animar={animar} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>{children}</div>
    </div>
  );
}

export function ChatMakoCrm({ funnelId, pedido }: {
  /** el CRM del tablero (`?funnel=`); null = el del negocio */
  funnelId: number | null;
  /** un mensaje que manda la pantalla (el «Hacerlo» de una sugerencia de chat); `vez` lo distingue de otro igual */
  pedido: { texto: string; vez: number } | null;
}) {
  const router = useRouter();
  const [cargado, setCargado] = useState(false);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [items, setItems] = useState<ItemHilo[]>([]);
  const [texto, setTexto] = useState('');
  const [trabajo, setTrabajo] = useState<Trabajo | null>(null);
  const [segs, setSegs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [tarjeta, setTarjeta] = useState<{ id: number; accion: 'confirmar' | 'cancelar' } | null>(null);
  const sesionRef = useRef<SesionChat | null>(null);
  const ocupadoRef = useRef(false);
  const envios = useRef(new Map<string, Envio>());
  /** El último `pedido.vez` mandado: el mismo pedido no sale dos veces por un render. */
  const pedidoHecho = useRef<number | null>(null);

  // ── Abrir la conversación de esta persona sobre este CRM ──
  const cargar = useCallback(async (vigente: () => boolean = () => true) => {
    let status = 0; let cuerpo = '';
    try {
      const r = await fetch(`${RUTA}?funnel=${funnelId ?? ''}&hilo=1`, { signal: AbortSignal.timeout(30_000) });
      status = r.status; cuerpo = await r.text();
    } catch { /* red caída: status 0 */ }
    if (!vigente()) return;
    const l = leerRespuesta<Abierta>(status, cuerpo);
    if (!l.ok) { setErrorCarga(l.reintentable ? l.error : 'No pude abrir el chat.'); setCargado(true); return; }
    sesionRef.current = l.datos.sesion;
    setItems(itemsDeSesion(l.datos.mensajes ?? [], l.datos.propuestas ?? []));
    setErrorCarga(null);
    setCargado(true);
  }, [funnelId]);

  useEffect(() => {
    let vivo = true;
    void cargar(() => vivo);
    return () => { vivo = false; };
  }, [cargar]);

  const recargar = () => {
    if (ocupadoRef.current) return;
    setCargado(false);
    setErrorCarga(null);
    void cargar();
  };

  const desde = trabajo?.desde ?? null;
  useEffect(() => {
    if (desde == null) return;
    const t = window.setInterval(() => setSegs(Math.floor((Date.now() - desde) / 1000)), 1000);
    return () => { window.clearInterval(t); setSegs(0); };
  }, [desde]);

  const marcar = (id: string, cambio: Partial<ItemMsg>) =>
    setItems((xs) => xs.map((x) => (x.id === id && x.k === 'msg' ? { ...x, ...cambio } : x)));

  // ── El turno: lo que ya está dibujado (optimista) sale al server ──
  const mandarTurno = async (idU: string, e: Envio) => {
    setTrabajo({ desde: Date.now() });
    try {
      let status = 0; let cuerpo = '';
      try {
        const r = await fetch(RUTA, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'send', funnel: funnelId, sessionId: sesionRef.current?.id ?? null, mensaje: e.texto }),
          signal: AbortSignal.timeout(TOPE_MS),
        });
        status = r.status; cuerpo = await r.text();
      } catch { /* red caída o corte por tiempo: status 0 */ }
      const l = leerRespuesta<RespuestaTurno>(status, cuerpo);
      if (!l.ok) { marcar(idU, { estado: l.reintentable ? 'error' : 'incierto', error: l.error }); return; }
      const r = l.datos;
      marcar(idU, { estado: undefined, error: undefined });
      setItems((xs) => {
        const vistas = new Set(xs.flatMap((x) => (x.k === 'propuesta' ? [x.t.pendienteId] : [])));
        return [...xs, ...itemsDeRespuesta(r, vistas)];
      });
      if (r.sesion) sesionRef.current = r.sesion;
    } finally {
      ocupadoRef.current = false;
      setTrabajo(null);
    }
  };

  const listo = cargado && !errorCarga;

  const enviar = (e: Envio) => {
    if (ocupadoRef.current || !listo) return;
    ocupadoRef.current = true;
    setError(null);
    const idU = idLocal('u');
    envios.current.set(idU, e);
    setItems((xs) => [...xs, {
      k: 'msg', id: idU, role: 'user', texto: e.texto, at: new Date().toISOString(),
      voz: e.voz ? { url: e.voz.url, secs: e.voz.secs } : null, estado: 'enviando',
    }]);
    void mandarTurno(idU, e);
  };

  /** Una nota de voz: se dibuja ya, se transcribe y sale como texto (el turno lee texto). */
  const enviarAudio = async (blob: Blob, secs: number) => {
    if (ocupadoRef.current || !listo) return;
    ocupadoRef.current = true;
    setError(null);
    const idU = idLocal('u');
    const url = URL.createObjectURL(blob);
    envios.current.set(idU, { texto: '', voz: { url, secs, blob } });
    setItems((xs) => [...xs, { k: 'msg', id: idU, role: 'user', texto: '', at: new Date().toISOString(), voz: { url, secs }, estado: 'enviando' }]);
    setTrabajo({ desde: Date.now() });
    const r = await transcribirNota(blob);
    if (!r.ok || !r.texto.trim()) {
      marcar(idU, { estado: 'error', error: r.ok ? 'No se entendió el audio.' : r.error });
      ocupadoRef.current = false;
      setTrabajo(null);
      return;
    }
    const e: Envio = { texto: r.texto.trim(), voz: { url, secs, blob } };
    envios.current.set(idU, e);
    marcar(idU, { texto: e.texto });
    await mandarTurno(idU, e);
  };

  /** Sólo lo que NO llegó (un 4xx, o un audio sin transcribir): se saca y se manda de nuevo. */
  const reintentar = (id: string) => {
    const e = envios.current.get(id);
    if (!e || ocupadoRef.current) return;
    setItems((xs) => xs.filter((x) => x.id !== id));
    envios.current.delete(id);
    if (e.voz && !e.texto) void enviarAudio(e.voz.blob, e.voz.secs);
    else enviar(e);
  };

  const enviarComposer = () => {
    const t = texto.trim();
    if (!t || ocupadoRef.current || !listo) return;
    enviar({ texto: t });
    setTexto('');
  };

  // ── El pedido de una sugerencia: sale UNA vez por `vez`, cuando el hilo está listo ──
  useEffect(() => {
    if (!pedido || !listo || pedidoHecho.current === pedido.vez || ocupadoRef.current) return;
    pedidoHecho.current = pedido.vez;
    enviar({ texto: pedido.texto });
    // `enviar` cambia en cada render; lo que decide es el pedido y que el hilo esté listo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido, listo, trabajo]);

  // ── Las tarjetas: confirmar o no ejecutar lo que MaKo propuso ──
  const alEstado = (pendienteId: number, estado: EstadoPropuesta, nota?: string, paraLaPersona?: string[]) => {
    setItems((xs) => {
      const sig = xs.map((x) => (x.k === 'propuesta' && x.t.pendienteId === pendienteId ? { ...x, estado, nota } : x));
      const extra: ItemHilo[] = (paraLaPersona ?? []).filter((t) => t.trim()).map((t) => ({ k: 'aviso', id: idLocal('v'), texto: t, tono: 'mako' }));
      return [...sig, ...extra];
    });
  };
  const correrTarjeta = async (it: ItemPropuesta, accion: 'confirmar' | 'cancelar') => {
    const s = sesionRef.current;
    if (tarjeta || !s) return;
    const id = it.t.pendienteId;
    setTarjeta({ id, accion });
    if (accion === 'confirmar') alEstado(id, 'aplicando');
    try {
      let status = 0; let cuerpo = '';
      try {
        const r = await fetch(RUTA, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: accion, funnel: funnelId, sessionId: s.id, pendienteId: id }),
          signal: AbortSignal.timeout(TOPE_MS),
        });
        status = r.status; cuerpo = await r.text();
      } catch { /* red caída: status 0 */ }
      const l = leerRespuesta<ResultadoTarjeta>(status, cuerpo);
      if (!l.ok) {
        alEstado(id, 'pendiente', l.reintentable ? l.error : 'No llegó la respuesta. Recarga el chat para ver si se ejecutó.');
        return;
      }
      const d = trasTarjeta(l.datos, accion);
      alEstado(id, d.estado ?? 'pendiente', d.frase ?? undefined, l.datos.paraLaPersona);
      if (d.estado === 'hecho' || d.estado === 'fallo') router.refresh();
    } finally {
      setTarjeta(null);
    }
  };

  // ── El hilo en la forma de ChatHilo (memo: el autoscroll corre cuando cambia `mensajes`) ──
  const hayTrabajo = trabajo != null;
  const hilo = useMemo<HiloMsg[]>(() => {
    const out: HiloMsg[] = [];
    items.forEach((x, i) => {
      if (x.k !== 'msg') { out.push({ id: x.id, fromMe: false }); return; }
      if (x.role === 'assistant') { out.push({ id: x.id, fromMe: false, texto: x.texto, fecha: x.at }); return; }
      const leido = items.slice(i + 1).some((y) => y.k === 'msg' && y.role === 'assistant');
      const status = leido && !x.estado ? 'read' : 'sent';
      out.push(x.voz
        ? { id: x.id, fromMe: true, tipo: 'audio', mediaUrl: x.voz.url, transcript: x.texto.trim() || null, fecha: x.at, status }
        : { id: x.id, fromMe: true, texto: x.texto, fecha: x.at, status });
    });
    if (hayTrabajo) out.push({ id: ID_ESCRIBIENDO, fromMe: false });
    return out;
  }, [items, hayTrabajo]);

  const porId = useMemo(() => new Map(items.map((x) => [x.id, x])), [items]);

  const renderMensaje = (h: HiloMsg): ReactNode | null => {
    if (h.id === ID_ESCRIBIENDO) {
      return (
        <FilaMako animar>
          <BurbujaHilo contenido={{}} saliente={false} vacio={(
            <span role="status" style={{ fontSize: 13, color: 'var(--dim)' }}>
              <span style={{ color: 'var(--mako-ink)', fontWeight: 600 }}>{GRAMATICA.analizando.rotulo}</span>
              {' · el CRM'}
              <span className="of-puntos" aria-hidden><span>.</span><span>.</span><span>.</span></span>
              {segs >= AVISO_LENTO_S && <span> · puede tardar un par de minutos</span>}
            </span>
          )} />
        </FilaMako>
      );
    }
    const x = porId.get(String(h.id));
    if (!x) return null;
    const hora = horaDe(h.fecha);

    if (x.k === 'msg' && x.role === 'assistant') {
      return (
        <FilaMako>
          <BurbujaHilo saliente={false} hora={hora} maxAncho="92%" contenido={{}}
            vacio={<div style={TEXTO_BURBUJA}><Markdown text={x.texto} /></div>} />
        </FilaMako>
      );
    }

    if (x.k === 'msg') {
      const falla = x.estado === 'error' || x.estado === 'incierto';
      if (!falla) return null;
      const burbuja = x.voz
        ? <BurbujaHilo saliente fondo={BURBUJA_YO} hora={hora} pie={<Ticks status={h.status ?? null} />}
            contenido={{ audio: { url: x.voz.url, transcript: x.texto.trim() || null, duracion_s: x.voz.secs } }} />
        : <BurbujaHilo saliente fondo={BURBUJA_YO} hora={hora} pie={<Ticks status={h.status ?? null} />} contenido={{}}
            vacio={<div style={{ ...TEXTO_BURBUJA, whiteSpace: 'pre-wrap' }}>{x.texto}</div>} />;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          {burbuja}
          {x.estado === 'error' && (
            <p className="mkc-falla" role="alert">{x.error}<button type="button" onClick={() => reintentar(x.id)}>Reintentar el envío</button></p>
          )}
          {x.estado === 'incierto' && (
            <p className="mkc-falla" role="alert">{x.error ?? ERROR_INCIERTO}<button type="button" onClick={recargar}>Recargar el chat</button></p>
          )}
        </div>
      );
    }

    if (x.k === 'aviso') {
      if (x.tono === 'plataforma') return <div className="of-reintento" role="status">{x.texto}</div>;
      return (
        <FilaMako>
          <BurbujaHilo saliente={false} maxAncho="92%" contenido={{}} vacio={<div style={TEXTO_BURBUJA}><Markdown text={x.texto} /></div>} />
        </FilaMako>
      );
    }

    if (x.k === 'pantalla') {
      return (
        <FilaMako>
          <div className="mkc-tarjeta">
            <p className="mkc-tarjeta__resumen"><strong>{x.p.titulo}</strong></p>
            <p className="mkc-tarjeta__nota">Se revisa y se confirma en su pantalla.</p>
            <div className="mkc-tarjeta__botones">
              <ButtonLink href={x.p.escritorio} variant="secondary" size="sm">Abrir para revisar</ButtonLink>
            </div>
          </div>
        </FilaMako>
      );
    }

    // Una acción que MaKo propuso: lo que se ejecuta, a la vista ANTES del botón.
    const t = x.t;
    const pill = PILL_PROPUESTA[x.estado];
    const abierta = x.estado === 'pendiente' || x.estado === 'aplicando';
    const enCurso = tarjeta?.id === t.pendienteId ? tarjeta.accion : null;
    return (
      <FilaMako>
        <div className="mkc-tarjeta" aria-busy={x.estado === 'aplicando' || undefined}>
          <div className="mkc-tarjeta__cabeza">
            <Status tono={pill.tono === 'neutro' ? 'neutral' : pill.tono}>{pill.texto}</Status>
            <span>{t.titulo}</span>
          </div>
          <p className="mkc-tarjeta__resumen">{t.resumen}</p>
          {abierta && t.detalle.length > 0 && (
            <dl className="mkc-tarjeta__lineas">
              {t.detalle.map((l, i) => <div key={i} style={{ display: 'contents' }}><dt>{l.rotulo}</dt><dd>{l.valor}</dd></div>)}
            </dl>
          )}
          {abierta ? (
            <>
              {x.nota && <p className="mkc-tarjeta__nota" role="alert">{x.nota}</p>}
              <p className="mkc-tarjeta__consecuencia">{t.consecuencia ?? 'MaKo lo ejecuta en cuanto confirmes.'}</p>
              <div className="mkc-tarjeta__botones">
                <Button variant="primary" size="sm" loading={enCurso === 'confirmar' || x.estado === 'aplicando'}
                  disabled={!!tarjeta && enCurso !== 'confirmar'} onClick={() => void correrTarjeta(x, 'confirmar')}>
                  {rotuloPrimario(t)}
                </Button>
                <Button variant="tertiary" size="sm" loading={enCurso === 'cancelar'}
                  disabled={!!tarjeta && enCurso !== 'cancelar'} onClick={() => void correrTarjeta(x, 'cancelar')}>
                  {SALIDA_PROPUESTA}
                </Button>
              </div>
            </>
          ) : x.nota ? <p className="mkc-tarjeta__nota">{x.nota}</p> : null}
        </div>
      </FilaMako>
    );
  };

  const vacio = listo && items.length === 0;
  const encimaDelComposer = vacio && !hayTrabajo ? (
    <div role="group" aria-label="Preguntas para empezar" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingBottom: 10 }}>
      {ARRANQUES.map((s) => (
        <button key={s} type="button" className="of-pill" onClick={() => enviar({ texto: s })}>{s}</button>
      ))}
    </div>
  ) : undefined;

  const vacioHilo = errorCarga ? (
    <div role="alert" style={{ margin: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center', color: 'var(--dim)', fontSize: 13.5 }}>
      <span>{errorCarga}</span>
      <Button variant="secondary" size="sm" onClick={recargar}>Volver a cargar el chat</Button>
    </div>
  ) : (
    <div style={{ margin: 'auto', maxWidth: 300, textAlign: 'center', color: 'var(--dim)', fontSize: 13.5, lineHeight: 1.5 }}>
      Pregúntale a MaKo por tu CRM.
    </div>
  );

  return (
    <div className="of-hilo" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative', background: 'var(--surface)' }}>
      <style>{CSS_OFFER}</style>
      <style>{CSS_PROPIO}</style>
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <div className="of-hilo-lista" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
          <ChatHilo
            key={cargado ? `c${funnelId ?? 0}` : 'cargando'}
            mensajes={cargado ? hilo : []}
            accent={ACENTO}
            accentBubble={BURBUJA_YO}
            animarNuevos
            cargando={!cargado}
            vacio={vacioHilo}
            renderMensaje={renderMensaje}
            encimaDelComposer={encimaDelComposer}
          />
        </div>
      </div>
      {error && <div role="alert" className="of-error">{error}</div>}
      <ComposerWhatsApp
        key={funnelId ?? 0}
        modo="enviar"
        valor={texto}
        onValor={setTexto}
        onEnviar={enviarComposer}
        placeholder="Pregúntale a MaKo"
        ocupado={hayTrabajo || !listo}
        onAudio={enviarAudio}
        onErrorAudio={setError}
      />
    </div>
  );
}
