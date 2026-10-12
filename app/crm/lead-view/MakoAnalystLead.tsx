'use client';

// =============================================================================
// MakoAnalystLead — el chat con MaKo adentro de la ficha de UN lead
// =============================================================================
// Pedido de Martín (12/10/2026, punto 19 del feedback del CRM): «Cambia el nombre de la tab
// "Análisis" por "MaKo Analyst" y replica el chat que tenemos en la tab de "Offer",
// basicamente que sea un chat con la IA que por defecto tenga atado los datos de ese lead, para
// eso tenemos una API de todo».
//
// EL ASPECTO es el del chat de Offer (app/offer/ChatOffer.tsx) y por el mismo camino: NO dibuja un
// chat propio, monta las piezas de app/whatsapp/_shared tal cual —el hilo `ChatHilo`, la burbuja
// `BurbujaHilo` con las palomitas `Ticks`, la barra `ComposerWhatsApp` con emojis, el clip con su
// menú y el micrófono— más la foto de MaKo (app/offer/AvatarMako.tsx) y la hoja de Offer
// (`CSS_OFFER`: el borde aplanado del hilo, la franja de error, los puntos de «escribiendo», las
// pastillas). Lo que se ENVUELVE es lo mismo que envuelve Offer, por lo mismo:
//   ⚠️ MaKo escribe Markdown y la burbuja pinta marcas de WhatsApp: sus mensajes van por
//      `renderMensaje`, con la MISMA burbuja y el texto por <Markdown> en su ranura `vacio`.
//   ⚠️ ChatHilo va SIN barra (sin handlers de envío) y la barra se monta acá, adentro de la misma
//      tarjeta: su selector de archivos no tiene los topes del turno (4 archivos, 4 MB, fotos y PDF:
//      lib/mako-adjuntos.ts).
//   ⚠️ LOS ARCHIVOS SE MANDAN AL ENVIAR, no al elegir (11/10/2026 en Offer: «Solo cuando le doy a
//      ENVIAR debería…»): el clip los junta encima de la barra, con su ✕, y viajan con el texto.
//   ⚠️ LOS COLORES: `--primary` / `--primary-bg`, que existen en los dos temas (el índigo del
//      WhatsApp no oficial no se redefine en oscuro).
//
// EL MOTOR no es de acá: /api/crm/analyst → lib/mako-analyst-lead.ts → el turno del chat de la app
// (lib/mako-turno-app.ts), con los datos del lead leídos por la API de MaKo en CADA turno. Una
// acción PROPONE: llega como TARJETA en el hilo, con lo que se va a ejecutar a la vista, la
// consecuencia pegada al botón, y la persona la confirma o no. Nada escribe directo. Las
// decisiones de pantalla (qué se reintenta, cómo se lee la respuesta, qué dice la tarjeta después)
// son las del chat del teléfono, del mismo módulo (app/m/mako/chat-ui.ts): una tarjeta no puede
// decir una cosa acá y otra en el celular.
//
// ⚠️ LO QUE NO SE REINTENTA: un turno que pudo haber corrido (red caída, corte por tiempo, un 5xx)
// ya pudo haber dejado una acción pendiente y costado una llamada al modelo: se dice «no sé si
// llegó» y se ofrece recargar el chat, nunca reenviar. Sólo un 4xx con su error se reintenta.
//
// ⚠️ LA CONVERSACIÓN ES UNA por lead y por persona, y se guarda (chart_sessions): al volver a la
// ficha está donde quedó. No se crea nada hasta el primer mensaje.
//
// ⚠️ OCUPA EL ALTO QUE LE DEN: `flex: 1` en un padre columna, o `height: 100%` en uno con alto. Si
// el padre no le da ninguno, 420 px (un hilo de cero alto es una pestaña en blanco). El alto del
// hilo sale de una caja ABSOLUTA, como en Offer: un porcentaje contra un alto de flex da CERO en
// Safari (AGENTS.md, «Dos reglas de layout»).
//
// ⚠️ LOS HANDLERS DECIDEN CON REFS (`sesionRef`, `ocupadoRef`): la barra guarda el `onAudio` del
// render en que se apretó el micrófono, y con el estado de ese render un audio podía salir por una
// conversación vieja o encima de un turno en curso.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from 'react';
import { Button, ButtonLink, Status } from '@/app/_ui';
import { useWs } from '@/app/_ui/Link';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import { Markdown } from '@/app/_components/Markdown';
import { TextoMarcas } from '@/app/_components/TextoMarcas';
import { transcribirNota } from '@/app/_components/useDictar';
import { ChatHilo, type HiloMsg } from '@/app/whatsapp/_shared/ChatHilo';
import { BurbujaHilo } from '@/app/whatsapp/_shared/BurbujaHilo';
import { Ticks } from '@/app/whatsapp/_shared/Ticks';
import { ComposerWhatsApp, type OpcionMenuWA } from '@/app/whatsapp/_shared/ComposerWhatsApp';
import { IconDoc } from '@/app/whatsapp/_shared/composer-icons';
import { AvatarMako } from '@/app/offer/AvatarMako';
import { ChipArchivo } from '@/app/offer/ChipArchivo';
import { CSS_OFFER } from '@/app/offer/estilos';
import { horaDe } from '@/app/offer/ayudas';
import {
  AVISO_LENTO_S, ERROR_INCIERTO, PILL_PROPUESTA, SALIDA_PROPUESTA, fuenteDelTurno, idLocal, itemsDeRespuesta,
  itemsDeSesion, leerRespuesta, problemaDeSeleccion, rotuloPrimario, trasTarjeta, type EstadoPropuesta, type ItemHilo,
} from '@/app/m/mako/chat-ui';
import { achicarImagen, postConProgreso } from '@/app/m/mako/subir';
import { useRefrescarFicha } from './ficha-cambio';
import { GRAMATICA } from '@/lib/mako-gramatica';
import { ACCEPT_ADJUNTOS_CHAT, ERROR_ADJUNTO } from '@/lib/mako-adjuntos';
import { conWs } from '@/lib/ws-tab';
import type { MensajeChat, ResultadoTarjeta, RespuestaTurno, SesionChat, TarjetaPendiente } from '@/lib/mako-turno-app-reglas';

const RUTA = '/api/crm/analyst';
/** El maxDuration de la ruta es 300 s: el corte del navegador va 5 s después. */
const TOPE_MS = 305_000;
/** El acento de la tarjeta y la burbuja de quien escribe: tokens que existen en claro Y en oscuro. */
const ACENTO = 'var(--primary)';
const BURBUJA_YO = 'var(--primary-bg)';
/** El renglón de «MaKo está revisando» viaja como un mensaje más del hilo (con su foto al lado). */
const ID_ESCRIBIENDO = '__mal-escribiendo';

const ACCEPT_FOTO = ACCEPT_ADJUNTOS_CHAT.split(',').filter((m) => m.startsWith('image/')).join(',');
const ACCEPT_PDF = ACCEPT_ADJUNTOS_CHAT.split(',').filter((m) => !m.startsWith('image/')).join(',');

/** Las preguntas de arranque (sólo con el hilo vacío): lo que más se le pregunta a un lead. */
const SUGERENCIAS = ['Resume este lead', '¿Cómo lo cierro?', '¿Qué le falta?'] as const;

/** El texto de una burbuja, con el mismo tamaño y la misma tinta que el de BurbujaHilo. */
const TEXTO_BURBUJA = { fontSize: 14, lineHeight: 1.45, color: 'var(--ink)', overflowWrap: 'anywhere' as const };

/** Lo propio de este chat (la tarjeta de una acción y la fila de una pantalla): prefijo mal-. */
const CSS_PROPIO = `
.mal-tarjeta { width: min(460px, 100%); display: flex; flex-direction: column; gap: 10px; padding: 12px 14px; border-radius: 14px 14px 14px 4px; background: var(--surface); border: 1px solid var(--border); box-shadow: 0 1px 2px rgba(18,21,27,.04); }
.mal-tarjeta__cabeza { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 13px; color: var(--dim); }
.mal-tarjeta__resumen { margin: 0; font-size: 14px; line-height: 1.45; color: var(--ink); overflow-wrap: anywhere; }
.mal-tarjeta__lineas { margin: 0; display: grid; grid-template-columns: minmax(80px, max-content) minmax(0, 1fr); gap: 4px 12px; font-size: 12.5px; line-height: 1.4; }
.mal-tarjeta__lineas dt { color: var(--dim); }
.mal-tarjeta__lineas dd { margin: 0; color: var(--ink); overflow-wrap: anywhere; }
.mal-tarjeta__consecuencia { margin: 0; font-size: 12.5px; color: var(--ink); }
.mal-tarjeta__nota { margin: 0; font-size: 12.5px; color: var(--dim); }
.mal-tarjeta__botones { display: flex; flex-wrap: wrap; gap: 8px; }
.mal-falla { margin: 0; max-width: 78%; font-size: 12.5px; color: var(--warn); text-align: right; }
.mal-falla button { margin-left: 6px; padding: 0; border: 0; background: none; color: var(--primary); font: inherit; font-weight: 600; cursor: pointer; text-decoration: underline; }
.mal-falla button:focus-visible { outline: none; box-shadow: var(--focus-ring); border-radius: 4px; }
`;

type Adjunto = { id: string; file: File; nombre: string; tipo: 'image' | 'document' };
type Envio = { texto: string; adjuntos: Adjunto[]; voz?: { url: string; secs: number; blob: Blob } };
type Trabajo = { fase: 'subiendo' | 'revisando'; pct: number; desde: number; fuente: string };
type Abierta = { lead: { id: number; nombre: string }; sesion: SesionChat | null; mensajes: MensajeChat[]; propuestas: TarjetaPendiente[] };
type ItemMsg = Extract<ItemHilo, { k: 'msg' }>;
type ItemPropuesta = Extract<ItemHilo, { k: 'propuesta' }>;

/** La fila de un mensaje de MaKo: su foto y, al lado, lo suyo. */
function FilaMako({ animar = false, children }: { animar?: boolean; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <AvatarMako size={30} animar={animar} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>{children}</div>
    </div>
  );
}

const primerNombre = (nombre: string): string => (nombre ?? '').trim().split(/\s+/)[0] || 'este lead';

export function MakoAnalystLead({ leadId, nombre }: { leadId: number; nombre: string }) {
  const ws = useWs();
  const refrescarFicha = useRefrescarFicha();
  const quien = primerNombre(nombre);

  // ── Lo cargado: para QUÉ lead se cargó (otro lead = todavía no hay nada) ──
  const [cargadoPara, setCargadoPara] = useState<number | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [items, setItems] = useState<ItemHilo[]>([]);
  const [texto, setTexto] = useState('');
  const [adjuntos, setAdjuntos] = useState<Adjunto[]>([]);
  const [procesando, setProcesando] = useState(0);
  const [trabajo, setTrabajo] = useState<Trabajo | null>(null);
  const [segs, setSegs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [tarjeta, setTarjeta] = useState<{ id: number; accion: 'confirmar' | 'cancelar' } | null>(null);
  const [encima, setEncima] = useState(false);
  const sesionRef = useRef<SesionChat | null>(null);
  /** Los archivos juntados, para decidir afuera de un updater (un updater no avisa errores). */
  const adjuntosRef = useRef<Adjunto[]>([]);
  const ocupadoRef = useRef(false);
  const envios = useRef(new Map<string, Envio>());
  const inputFoto = useRef<HTMLInputElement>(null);
  const inputPdf = useRef<HTMLInputElement>(null);
  const listo = cargadoPara === leadId;

  /** La conversación vive en un REF y no en el estado: nada se dibuja con ella, y los handlers
   *  (el audio, la tarjeta) tienen que leer la de AHORA, no la de su render. */
  const ponerSesion = (s: SesionChat | null) => { sesionRef.current = s; };
  const ponerAdjuntos = (l: Adjunto[]) => { adjuntosRef.current = l; setAdjuntos(l); };

  // ── Abrir la conversación de esta persona sobre este lead ──
  // `vigente`: si en el medio se abrió la ficha de OTRO lead, la respuesta vieja no pisa la nueva.
  const cargar = useCallback(async (id: number, vigente: () => boolean = () => true) => {
    let status = 0; let cuerpo = '';
    try {
      const r = await fetch(`${RUTA}?leadId=${id}`, { signal: AbortSignal.timeout(30_000) });
      status = r.status; cuerpo = await r.text();
    } catch { /* red caída: status 0 */ }
    if (!vigente()) return;
    const l = leerRespuesta<Abierta>(status, cuerpo);
    if (!l.ok) {
      setErrorCarga(l.reintentable ? l.error : 'No pude abrir el chat.');
      setCargadoPara(id);
      return;
    }
    sesionRef.current = l.datos.sesion;
    setItems(itemsDeSesion(l.datos.mensajes ?? [], l.datos.propuestas ?? []));
    setErrorCarga(null);
    setCargadoPara(id);
  }, []);

  useEffect(() => {
    let vivo = true;
    void cargar(leadId, () => vivo);
    return () => { vivo = false; };
  }, [leadId, cargar]);

  const recargar = () => {
    if (ocupadoRef.current) return;
    setCargadoPara(null);
    setErrorCarga(null);
    void cargar(leadId);
  };

  // ── El reloj del trabajo («puede tardar» a partir de los 12 s) ──
  // Cuelga de `desde` y no del objeto: el progreso de la subida lo reemplaza muchas veces por
  // segundo, y con el objeto en las dependencias el reloj volvía a cero en cada una.
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
    const fuente = e.adjuntos.length ? fuenteDelTurno(e.adjuntos) : `la ficha de ${quien}`;
    setTrabajo({ fase: e.adjuntos.length ? 'subiendo' : 'revisando', pct: 0, desde: Date.now(), fuente });
    try {
      let status = 0; let cuerpo = '';
      if (e.adjuntos.length) {
        const fd = new FormData();
        fd.append('leadId', String(leadId));
        if (sesionRef.current) fd.append('sessionId', String(sesionRef.current.id));
        fd.append('mensaje', e.texto);
        for (const a of e.adjuntos) fd.append('adjuntos', a.file, a.file.name);
        // ⚠️ XMLHttpRequest no pasa por el parche de WsFetch: el `?ws=` va a mano.
        const r = await postConProgreso(conWs(RUTA, ws), fd, {
          alSubir: (p) => setTrabajo((t) => (t ? { ...t, pct: p } : t)),
          alTerminarSubida: () => setTrabajo((t) => (t ? { ...t, fase: 'revisando', pct: 1 } : t)),
          timeoutMs: TOPE_MS,
        });
        status = r.status; cuerpo = r.texto;
      } else {
        try {
          const r = await fetch(RUTA, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'send', leadId, sessionId: sesionRef.current?.id ?? null, mensaje: e.texto }),
            signal: AbortSignal.timeout(TOPE_MS),
          });
          status = r.status; cuerpo = await r.text();
        } catch { /* red caída o corte por tiempo: status 0 */ }
      }
      const l = leerRespuesta<RespuestaTurno>(status, cuerpo);
      if (!l.ok) { marcar(idU, { estado: l.reintentable ? 'error' : 'incierto', error: l.error }); return; }
      const r = l.datos;
      marcar(idU, { estado: undefined, error: undefined });
      setItems((xs) => {
        const vistas = new Set(xs.flatMap((x) => (x.k === 'propuesta' ? [x.t.pendienteId] : [])));
        return [...xs, ...itemsDeRespuesta(r, vistas)];
      });
      if (r.sesion) ponerSesion(r.sesion);
    } finally {
      ocupadoRef.current = false;
      setTrabajo(null);
    }
  };

  const enviar = (e: Envio) => {
    if (ocupadoRef.current || !listo || errorCarga) return;
    ocupadoRef.current = true;
    setError(null);
    const idU = idLocal('u');
    envios.current.set(idU, e);
    setItems((xs) => [...xs, {
      k: 'msg', id: idU, role: 'user', texto: e.texto, at: new Date().toISOString(),
      voz: e.voz ? { url: e.voz.url, secs: e.voz.secs } : null, adjuntos: e.adjuntos.map((a) => a.nombre), estado: 'enviando',
    }]);
    void mandarTurno(idU, e);
  };

  /** Una nota de voz: se dibuja ya, se transcribe y sale como texto (el turno lee texto). */
  const enviarAudio = async (blob: Blob, secs: number) => {
    if (ocupadoRef.current || !listo || errorCarga) return;
    ocupadoRef.current = true;
    setError(null);
    const idU = idLocal('u');
    const url = URL.createObjectURL(blob);
    envios.current.set(idU, { texto: '', adjuntos: [], voz: { url, secs, blob } });
    setItems((xs) => [...xs, { k: 'msg', id: idU, role: 'user', texto: '', at: new Date().toISOString(), voz: { url, secs }, estado: 'enviando' }]);
    setTrabajo({ fase: 'revisando', pct: 0, desde: Date.now(), fuente: 'tu audio' });
    const r = await transcribirNota(blob);
    if (!r.ok || !r.texto.trim()) {
      marcar(idU, { estado: 'error', error: r.ok ? 'No se entendió el audio.' : r.error });
      ocupadoRef.current = false;
      setTrabajo(null);
      return;
    }
    const e: Envio = { texto: r.texto.trim(), adjuntos: [], voz: { url, secs, blob } };
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
    const juntados = adjuntosRef.current;
    if ((!t && !juntados.length) || procesando > 0) return;
    if (ocupadoRef.current || !listo || errorCarga) return;
    enviar({ texto: t, adjuntos: juntados });
    setTexto('');
    ponerAdjuntos([]);
  };

  // ── Los archivos: se juntan encima de la barra y salen con el próximo mensaje ──
  const juntar = async (lista: File[]) => {
    if (!lista.length) return;
    setError(null);
    setProcesando((p) => p + lista.length);
    const nuevos: Adjunto[] = [];
    try {
      for (const f of lista) {
        const esImagen = f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(f.name);
        const esPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
        if (!esImagen && !esPdf) { setError(ERROR_ADJUNTO.formato); continue; }
        try {
          // Una foto se achica ANTES de subir: Vercel corta todo POST de más de ~4,5 MB.
          const archivo = esImagen ? await achicarImagen(f) : f;
          nuevos.push({ id: idLocal('f'), file: archivo, nombre: f.name || archivo.name, tipo: esImagen ? 'image' : 'document' });
        } catch { setError('No pude leer esa imagen.'); }
      }
    } finally { setProcesando((p) => Math.max(0, p - lista.length)); }
    if (!nuevos.length) return;
    const todos = [...adjuntosRef.current, ...nuevos];
    const problema = problemaDeSeleccion(todos.map((a) => a.file.size));
    if (problema) { setError(problema); return; }
    ponerAdjuntos(todos);
  };
  const elegidos = (e: ChangeEvent<HTMLInputElement>) => {
    const lista = Array.from(e.target.files ?? []);
    // Se vacía para que elegir el MISMO archivo otra vez vuelva a disparar el cambio.
    e.target.value = '';
    void juntar(lista);
  };
  const menuClip: OpcionMenuWA[] = [
    { key: 'foto', label: 'Foto', icono: <IconoMenu nombre="imagen" size={18} />, onElegir: () => inputFoto.current?.click() },
    { key: 'pdf', label: 'PDF', icono: <IconDoc size={18} />, onElegir: () => inputPdf.current?.click() },
  ];
  const alArrastrar = (e: DragEvent<HTMLDivElement>) => {
    if (trabajo || !Array.from(e.dataTransfer?.types ?? []).includes('Files')) return;
    e.preventDefault();
    if (!encima) setEncima(true);
  };
  const alSoltar = (e: DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer?.files?.length) return;
    e.preventDefault();
    setEncima(false);
    if (!trabajo) void juntar(Array.from(e.dataTransfer.files));
  };

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
          body: JSON.stringify({ action: accion, leadId, sessionId: s.id, pendienteId: id }),
          signal: AbortSignal.timeout(TOPE_MS),
        });
        status = r.status; cuerpo = await r.text();
      } catch { /* red caída: status 0 */ }
      const l = leerRespuesta<ResultadoTarjeta>(status, cuerpo);
      if (!l.ok) {
        // Pudo haber corrido igual: no se dice «no pasó», se dice que no se sabe.
        alEstado(id, 'pendiente', l.reintentable ? l.error : 'No llegó la respuesta. Recarga el chat para ver si se ejecutó.');
        return;
      }
      const d = trasTarjeta(l.datos, accion);
      alEstado(id, d.estado ?? 'pendiente', d.frase ?? undefined, l.datos.paraLaPersona);
      // Lo confirmado cambió al lead (su etapa, una nota, una etiqueta): la ficha que rodea al chat
      // es una FOTO y se relee por el aviso de siempre (ficha-cambio.tsx), no con un refresh suelto.
      if (d.estado === 'hecho' || d.estado === 'fallo') refrescarFicha();
    } finally {
      setTarjeta(null);
    }
  };

  // ── El hilo en la forma de ChatHilo ──
  // Memo: el autoscroll del hilo corre cuando cambia `mensajes`, y un arreglo nuevo en cada tecla
  // (o en cada segundo del reloj) lo dispararía sin que haya nada nuevo.
  const hayTrabajo = trabajo != null;
  const hilo = useMemo<HiloMsg[]>(() => {
    const out: HiloMsg[] = [];
    items.forEach((x, i) => {
      if (x.k !== 'msg') { out.push({ id: x.id, fromMe: false }); return; }
      if (x.role === 'assistant') { out.push({ id: x.id, fromMe: false, texto: x.texto, fecha: x.at }); return; }
      // Las palomitas: azules si MaKo ya contestó algo DESPUÉS (la lectura de WhatsApp).
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

  /** Lo que la burbuja de ChatHilo no sabe dibujar; null = la de siempre. */
  const renderMensaje = (h: HiloMsg): ReactNode | null => {
    if (h.id === ID_ESCRIBIENDO) {
      const rotulo = trabajo?.fase === 'subiendo'
        ? `Subiendo ${trabajo.fuente} · ${Math.round(trabajo.pct * 100)}%`
        : null;
      return (
        <FilaMako animar>
          <BurbujaHilo contenido={{}} saliente={false} vacio={(
            <span role="status" style={{ fontSize: 13, color: 'var(--dim)' }}>
              {rotulo ?? (
                <>
                  <span style={{ color: 'var(--mako-ink)', fontWeight: 600 }}>{GRAMATICA.analizando.rotulo}</span>
                  {' · '}{trabajo?.fuente ?? ''}
                </>
              )}
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
          <BurbujaHilo saliente={false} hora={hora} maxAncho="88%" contenido={{}}
            vacio={<div style={TEXTO_BURBUJA}><Markdown text={x.texto} /></div>} />
        </FilaMako>
      );
    }

    if (x.k === 'msg') {
      // De quien escribe: la burbuja de siempre, salvo que traiga archivos o no haya llegado.
      const conArchivos = !!x.adjuntos?.length;
      const falla = x.estado === 'error' || x.estado === 'incierto';
      if (!conArchivos && !falla) return null;
      const burbuja = x.voz
        ? <BurbujaHilo saliente fondo={BURBUJA_YO} hora={hora} pie={<Ticks status={h.status ?? null} />}
            contenido={{ audio: { url: x.voz.url, transcript: x.texto.trim() || null, duracion_s: x.voz.secs } }} />
        : <BurbujaHilo saliente fondo={BURBUJA_YO} hora={hora} pie={<Ticks status={h.status ?? null} />} contenido={{}}
            vacio={(
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {conArchivos && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'stretch' }}>
                    {x.adjuntos!.map((n, i) => <ChipArchivo key={`${i}-${n}`} nombre={n} estado="listo" />)}
                  </div>
                )}
                {x.texto.trim() && <div style={{ ...TEXTO_BURBUJA, whiteSpace: 'pre-wrap' }}><TextoMarcas texto={x.texto} /></div>}
              </div>
            )} />;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          {burbuja}
          {x.estado === 'error' && (
            <p className="mal-falla" role="alert">{x.error}<button type="button" onClick={() => reintentar(x.id)}>Reintentar el envío</button></p>
          )}
          {x.estado === 'incierto' && (
            <p className="mal-falla" role="alert">{x.error ?? ERROR_INCIERTO}<button type="button" onClick={recargar}>Recargar el chat</button></p>
          )}
        </div>
      );
    }

    if (x.k === 'aviso') {
      if (x.tono === 'plataforma') return <div className="of-reintento" role="status">{x.texto}</div>;
      return (
        <FilaMako>
          <BurbujaHilo saliente={false} maxAncho="88%" contenido={{}} vacio={<div style={TEXTO_BURBUJA}><Markdown text={x.texto} /></div>} />
        </FilaMako>
      );
    }

    if (x.k === 'pantalla') {
      return (
        <FilaMako>
          <div className="mal-tarjeta">
            <p className="mal-tarjeta__resumen"><strong>{x.p.titulo}</strong></p>
            <p className="mal-tarjeta__nota">Todavía no está cargado: se revisa y se confirma en su pantalla.</p>
            <div className="mal-tarjeta__botones">
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
        <div className="mal-tarjeta" aria-busy={x.estado === 'aplicando' || undefined}>
          <div className="mal-tarjeta__cabeza">
            <Status tono={pill.tono === 'neutro' ? 'neutral' : pill.tono}>{pill.texto}</Status>
            <span>{t.titulo}</span>
          </div>
          <p className="mal-tarjeta__resumen">{t.resumen}</p>
          {abierta && t.detalle.length > 0 && (
            <dl className="mal-tarjeta__lineas">
              {t.detalle.map((l, i) => <div key={i} style={{ display: 'contents' }}><dt>{l.rotulo}</dt><dd>{l.valor}</dd></div>)}
            </dl>
          )}
          {abierta ? (
            <>
              {x.nota && <p className="mal-tarjeta__nota" role="alert">{x.nota}</p>}
              <p className="mal-tarjeta__consecuencia">{t.consecuencia ?? 'MaKo lo ejecuta en cuanto confirmes.'}</p>
              <div className="mal-tarjeta__botones">
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
          ) : x.nota ? <p className="mal-tarjeta__nota">{x.nota}</p> : null}
        </div>
      </FilaMako>
    );
  };

  // ── Encima de la barra: las preguntas de arranque y los archivos juntados ──
  const vacio = listo && !errorCarga && items.length === 0;
  const encimaDelComposer = (vacio && !hayTrabajo) || adjuntos.length || procesando ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 10 }}>
      {adjuntos.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {adjuntos.map((a) => (
            <ChipArchivo key={a.id} nombre={a.nombre} estado="listo"
              onQuitar={() => ponerAdjuntos(adjuntosRef.current.filter((y) => y.id !== a.id))} />
          ))}
        </div>
      )}
      {procesando > 0 && <ChipArchivo nombre="Preparando el archivo" estado="leyendo" />}
      {vacio && !hayTrabajo && (
        <div role="group" aria-label="Preguntas para empezar" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {SUGERENCIAS.map((s) => (
            <button key={s} type="button" className="of-pill" onClick={() => enviar({ texto: s, adjuntos: [] })}>{s}</button>
          ))}
        </div>
      )}
    </div>
  ) : undefined;

  const vacioHilo = errorCarga ? (
    <div role="alert" style={{ margin: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center', color: 'var(--dim)', fontSize: 13.5 }}>
      <span>{errorCarga}</span>
      <Button variant="secondary" size="sm" onClick={recargar}>Volver a cargar el chat</Button>
    </div>
  ) : (
    <div style={{ margin: 'auto', maxWidth: 360, textAlign: 'center', color: 'var(--dim)', fontSize: 13.5, lineHeight: 1.5 }}>
      MaKo ya tiene la ficha de {quien}: pregúntale lo que quieras.
    </div>
  );

  const ocupado = hayTrabajo || !listo || !!errorCarga;

  return (
    <div className="of-hilo" data-esquina-ocupada data-encima={encima || undefined}
      onDragOver={alArrastrar} onDragLeave={() => setEncima(false)} onDrop={alSoltar}
      style={{
        flex: 1, minHeight: 420, height: '100%', display: 'flex', flexDirection: 'column', position: 'relative',
        background: 'var(--surface)', border: '1px solid var(--border)', borderTop: `3px solid ${ACENTO}`, borderRadius: 16, overflow: 'hidden',
      }}>
      <style>{CSS_OFFER}</style>
      <style>{CSS_PROPIO}</style>
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <div className="of-hilo-lista" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
          {/* `key` con lo cargado: el historial que llega al abrir se monta como el INICIAL del hilo
              (sin la entrada animada, que es para lo nuevo de esta charla). */}
          <ChatHilo
            key={listo ? `l${leadId}` : 'cargando'}
            mensajes={listo ? hilo : []}
            accent={ACENTO}
            accentBubble={BURBUJA_YO}
            animarNuevos
            cargando={!listo}
            vacio={vacioHilo}
            renderMensaje={renderMensaje}
            encimaDelComposer={encimaDelComposer}
          />
        </div>
      </div>
      {error && <div role="alert" className="of-error">{error}</div>}
      {/* La barra va POR LEAD (`key`): una grabación a medias no viaja a la ficha de otro. */}
      <ComposerWhatsApp
        key={leadId}
        modo="enviar"
        valor={texto}
        onValor={setTexto}
        onEnviar={enviarComposer}
        placeholder={`Pregúntale a MaKo por ${quien}`}
        ocupado={ocupado || procesando > 0}
        menuClip={menuClip}
        onAudio={enviarAudio}
        onErrorAudio={setError}
      />
      <input ref={inputFoto} type="file" multiple accept={ACCEPT_FOTO} onChange={elegidos} hidden />
      <input ref={inputPdf} type="file" multiple accept={ACCEPT_PDF} onChange={elegidos} hidden />
    </div>
  );
}
