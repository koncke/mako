'use client';

// =============================================================================
// ChatMakoCrm — el chat con MaKo del panel al costado del CRM
// =============================================================================
// Desde el 16/10/2026 tiene la cara del chat del Second Brain: el hilo `HiloMako` (app/_chat/) con el muñeco del CRM,
// y la caja con el micrófono que dicta (ver el comentario del dibujo, abajo). Las decisiones de pantalla (qué se
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

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { transcribirNota } from '@/app/_components/useDictar';
import { Icon } from '@/app/_components/icons';
import { HiloMako } from '@/app/_chat/HiloMako';
import { Muneco } from '@/app/admin/operaciones/Muneco';
import { Microfono } from '@/app/admin/operaciones/Microfono';
import '@/app/admin/operaciones/centro.css';
import '@/app/_chat/chat.css';
import {
  idLocal, itemsDeRespuesta, itemsDeSesion, leerRespuesta, trasTarjeta, type EstadoPropuesta, type ItemHilo,
} from '@/app/m/mako/chat-ui';
import type { MensajeChat, ResultadoTarjeta, RespuestaTurno, SesionChat, TarjetaPendiente } from '@/lib/mako-turno-app-reglas';

const RUTA = '/api/crm/mako';
/** El maxDuration de la ruta es 420 s (tanda 7: confirmar replicar_landing): el corte del navegador va 5 s después. */
const TOPE_MS = 425_000;

/** Las preguntas de arranque (sólo con el hilo vacío): lo que más se le pregunta a un tablero. */
const ARRANQUES = ['¿Cómo está mi CRM?', '¿Qué reuniones tengo?', '¿Qué hago hoy?'] as const;



type Envio = { texto: string; voz?: { url: string; secs: number; blob: Blob } };
type Trabajo = { desde: number };
type Abierta = { sesion: SesionChat | null; mensajes: MensajeChat[]; propuestas: TarjetaPendiente[] };
type ItemMsg = Extract<ItemHilo, { k: 'msg' }>;
type ItemPropuesta = Extract<ItemHilo, { k: 'propuesta' }>;


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

  // ── El dibujo: el MISMO chat del Second Brain (16/10/2026) ──
  // Martín: «aún no se aplicó el diseño de los chats tipo "Second Brain" al chat del CRM... En lugar de la estrella de
  // MaKo el ícono debería ser el muñequito que se asignó para CRM». El hilo es app/_chat/HiloMako.tsx (el del Second
  // Brain, con el muñeco del CRM y las tarjetas de app/_chat/TarjetaAccion.tsx) y la caja es la del Second Brain, con
  // el micrófono que DICTA (app/admin/operaciones/Microfono.tsx). Lo de arriba —cargar, mandar, las tarjetas, el
  // pedido de una sugerencia— no cambió. Hasta acá eran las piezas del chat de WhatsApp con la cara de Offer.
  const hayTrabajo = trabajo != null;
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setAhora(Date.now()), 60_000); return () => window.clearInterval(t); }, []);
  const hiloRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { const el = hiloRef.current; if (el) el.scrollTop = el.scrollHeight; }, [items.length, hayTrabajo]);
  const [faltaMic, setFaltaMic] = useState<string | null>(null);
  const tecla = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); enviarComposer(); }
  };

  return (
    <div className="mkc-chat" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--surface)' }}>
      <div className="co-hilo" ref={hiloRef} style={{ flex: 1, minHeight: 0 }}>
        {!cargado ? null : errorCarga ? (
          <div className="co-portada">
            <p className="co-portada__dato">{errorCarga}</p>
            <button type="button" className="co-chip" onClick={recargar}>Volver a cargar el chat</button>
          </div>
        ) : !items.length && !hayTrabajo ? (
          <div className="co-portada">
            <Muneco titulo="CRM" animo="despierto" size={76} />
            <p className="co-portada__nombre">Pregúntale a MaKo por tu CRM.</p>
            <div className="ch-arranques">
              {ARRANQUES.map((a) => <button key={a} type="button" className="co-chip" onClick={() => enviar({ texto: a })}>{a}</button>)}
            </div>
          </div>
        ) : (
          <HiloMako items={items} quien={{ nombre: 'CRM' }} ahora={ahora} escribiendo={hayTrabajo ? { segs } : null}
            tarjeta={tarjeta} onTarjeta={(x, a) => void correrTarjeta(x, a)} onReintentar={reintentar} onRecargar={recargar} />
        )}
      </div>
      <div className="co-caja-wrap">
        {error && <p className="co-nota co-nota--mal" role="alert">{error}</p>}
        <div className="co-caja">
          <textarea rows={1} value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={tecla}
            placeholder="Pregúntale a MaKo" aria-label="Pregúntale a MaKo" disabled={!listo} />
          <div className="co-caja__barra">
            <Microfono valor={texto} onValor={(v) => { setFaltaMic(null); setTexto(v); }} onError={setFaltaMic} apagado={!listo} />
            <button type="button" className="co-enviar" onClick={enviarComposer} disabled={hayTrabajo || !texto.trim() || !listo}
              aria-label="Mandar" title="Mandar (Enter)">
              {hayTrabajo ? <span className="co-enviar__giro" aria-hidden /> : <Icon name="flecha" size={18} />}
            </button>
          </div>
        </div>
        <p className="co-caja__estado" aria-live="polite">{faltaMic ?? ''}</p>
      </div>
    </div>
  );
}
