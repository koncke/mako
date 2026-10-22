'use client';

// =============================================================================
// MakoAnalystLead — el chat con MaKo adentro de la ficha de UN lead
// =============================================================================
// Pedido de Martín (12/10/2026, punto 19 del feedback del CRM): «Cambia el nombre de la tab
// "Análisis" por "MaKo Analyst" y replica el chat que tenemos en la tab de "Offer",
// basicamente que sea un chat con la IA que por defecto tenga atado los datos de ese lead, para
// eso tenemos una API de todo».
//
// EL ASPECTO ES EL DEL OPS CENTER desde el 22/10/2026 (CR3, como Offer en OF4): el hilo ÚNICO (`HiloMako`,
// app/_chat/HiloMako.tsx) y la caja ÚNICA (`CajaChat`, app/_chat/CajaChat.tsx), los mismos del Cerebro y del chat del
// cliente. Hasta ese día montaba las piezas de WhatsApp (`ChatHilo`, `BurbujaHilo`, `ComposerWhatsApp`) y dibujaba a mano
// cada cosa del hilo (la tarjeta, el bloque, la pantalla, el aviso): ahora las dibuja HiloMako, una vez para todos.
// tests/chat-unico.test.ts la marca «caja única».
//   ⚠️ LOS ARCHIVOS SE MANDAN AL ENVIAR, no al elegir (11/10/2026 en Offer: «Solo cuando le doy a ENVIAR debería…»): el
//      «+» de la caja los junta arriba, como miniaturas, y viajan con el texto. Los topes son los del turno (4 archivos,
//      4 MB, fotos y PDF: lib/mako-adjuntos.ts).
//   ⚠️ LA NOTA DE VOZ se escucha antes de mandarla (la caja con `voz`) y sale como texto: se transcribe acá.
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

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type DragEvent } from 'react';
import { Button } from '@/app/_ui';
import { useWs } from '@/app/_ui/Link';
import { transcribirNota } from '@/app/_components/useDictar';
import { CajaChat } from '@/app/_chat/CajaChat';
import { HiloMako, type Quien } from '@/app/_chat/HiloMako';
import type { AdjuntosDeCaja } from '@/app/admin/operaciones/AdjuntosCaja';
import { CSS_OFFER } from '@/app/offer/estilos';
import {
  archivosDeRespuesta, fuenteDelTurno, idLocal, itemsDeRespuesta, conTarjeta, itemsDeSesion, leerRespuesta, textoTapadoDeRespuesta,
  problemaDeSeleccion, trasTarjeta, trasTrabajo, type EstadoPropuesta, type ItemHilo,
} from '@/app/m/mako/chat-ui';
import { achicarImagen, postConProgreso } from '@/app/m/mako/subir';
import { useRefrescarFicha } from './ficha-cambio';
import { ACCEPT_ADJUNTOS_CHAT, ERROR_ADJUNTO } from '@/lib/mako-adjuntos';
import { estaAbajo } from '@/lib/centro-caja';
import { conWs } from '@/lib/ws-tab';
// Las clases del hilo y de la caja (`co-…`, `ch-…`) viven en las hojas de las piezas únicas.
import '@/app/admin/operaciones/centro.css';
import '@/app/_chat/chat.css';
import type { MensajeChat, PropuestaPantalla, ResultadoTarjeta, RespuestaTurno, SesionChat, TarjetaPendiente } from '@/lib/mako-turno-app-reglas';

const RUTA = '/api/crm/analyst';
/** El maxDuration de la ruta es 300 s: el corte del navegador va 5 s después. */
const TOPE_MS = 305_000;
/** El muñeco de MaKo al lado de lo que dice (el del Ops Center). */
const QUIEN: Quien = { nombre: 'MaKo' };
/** El ➤ y el ✓ de la barra de grabar van en el negro del Ops Center, como en Offer (app/offer/ChatOffer.tsx). */
const SIN_VERDE = { '--good': 'var(--ink)', '--sobre-good': 'var(--surface)' } as CSSProperties;

/** Las preguntas de arranque (sólo con el hilo vacío): lo que más se le pregunta a un lead. */
const SUGERENCIAS = ['Resume este lead', '¿Cómo lo cierro?', '¿Qué le falta?'] as const;
/** Editando la vista de la ficha (17/10/2026): lo que se le pide a MaKo es cambiar la hoja, no analizar al lead. */
const SUGERENCIAS_EDICION = ['¿Qué bloques puedo sumar?', 'Pon arriba lo más importante', 'Hazla épica'] as const;

/** Un archivo juntado en la caja: `url` es su miniatura (`blob:`), la de la caja y la de la burbuja mientras sale. */
type Adjunto = { id: string; file: File; nombre: string; tipo: 'image' | 'document'; url: string };
type Envio = { texto: string; adjuntos: Adjunto[]; voz?: { url: string; secs: number; blob: Blob } };
type Trabajo = { fase: 'subiendo' | 'revisando'; pct: number; desde: number; fuente: string };
type Abierta = { lead: { id: number; nombre: string }; sesion: SesionChat | null; mensajes: MensajeChat[]; propuestas: TarjetaPendiente[]; pantallas?: PropuestaPantalla[] };
type ItemMsg = Extract<ItemHilo, { k: 'msg' }>;
type ItemPropuesta = Extract<ItemHilo, { k: 'propuesta' }>;

const primerNombre = (nombre: string): string => (nombre ?? '').trim().split(/\s+/)[0] || 'este lead';

export function MakoAnalystLead({ leadId, nombre, edicion = null }: {
  leadId: number;
  nombre: string;
  /**
   * La ficha está en «Editar» (17/10/2026, Martín: «Al momento de EDITAR, también debería salir automáticamente este
   * modal, pero ahora ya no para analizar al lead, sino para editar la vista»): la hoja abierta (su clave de la API y su
   * nombre). Viaja con cada mensaje; el server arma con eso lo que se le pide a MaKo (lib/mako-analyst-lead-reglas.ts).
   */
  edicion?: { tab: string; nombre: string } | null;
}) {
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
  /** Para la píldora del día («Hoy», «Ayer») del hilo. */
  const [ahora] = useState(() => Date.now());
  const hiloRef = useRef<HTMLDivElement>(null);
  /** ¿Se estaba mirando lo último? Entonces lo nuevo lo sigue (si se subió a leer algo de antes, no se lo mueve). */
  const abajo = useRef(true);
  const sesionRef = useRef<SesionChat | null>(null);
  /** Los archivos juntados, para decidir afuera de un updater (un updater no avisa errores). */
  const adjuntosRef = useRef<Adjunto[]>([]);
  const ocupadoRef = useRef(false);
  const envios = useRef(new Map<string, Envio>());
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
    setItems(itemsDeSesion(l.datos.mensajes ?? [], l.datos.propuestas ?? [], l.datos.pantallas ?? []));
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
        if (edicion) fd.append('edicion', JSON.stringify(edicion));
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
            body: JSON.stringify({ action: 'send', leadId, sessionId: sesionRef.current?.id ?? null, mensaje: e.texto, ...(edicion ? { edicion } : {}) }),
            signal: AbortSignal.timeout(TOPE_MS),
          });
          status = r.status; cuerpo = await r.text();
        } catch { /* red caída o corte por tiempo: status 0 */ }
      }
      const l = leerRespuesta<RespuestaTurno>(status, cuerpo);
      if (!l.ok) { marcar(idU, { estado: l.reintentable ? 'error' : 'incierto', error: l.error }); return; }
      const r = l.datos;
      // Los archivos vuelven guardados (con su link): reemplazan a las miniaturas de la caja.
      const guardados = archivosDeRespuesta(r);
      marcar(idU, { estado: undefined, error: undefined, ...textoTapadoDeRespuesta(r, e.texto), ...(guardados.length ? { archivos: guardados } : {}) });
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
      voz: e.voz ? { url: e.voz.url, secs: e.voz.secs } : null, estado: 'enviando',
      archivos: e.adjuntos.map((a) => ({ nombre: a.nombre, tipo: a.tipo, local: a.url })),
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
          nuevos.push({ id: idLocal('f'), file: archivo, nombre: f.name || archivo.name, tipo: esImagen ? 'image' : 'document', url: URL.createObjectURL(archivo) });
        } catch { setError('No pude leer esa imagen.'); }
      }
    } finally { setProcesando((p) => Math.max(0, p - lista.length)); }
    if (!nuevos.length) return;
    const todos = [...adjuntosRef.current, ...nuevos];
    const problema = problemaDeSeleccion(todos.map((a) => a.file.size));
    if (problema) { setError(problema); return; }
    ponerAdjuntos(todos);
  };
  const quitar = (id: string) => {
    const a = adjuntosRef.current.find((y) => y.id === id);
    if (a) URL.revokeObjectURL(a.url);
    ponerAdjuntos(adjuntosRef.current.filter((y) => y.id !== id));
  };
  /** El «+» de la caja (Documento, Fotos, Cámara, Pegar): fotos y PDF, lo que el turno lee. */
  const adjuntosCaja: AdjuntosDeCaja = {
    items: adjuntos, puede: listo && !errorCarga, onSumar: (fs) => void juntar(fs), onQuitar: quitar, accept: ACCEPT_ADJUNTOS_CHAT,
    onNoPuede: () => setError('Espera a que cargue el chat para sumar archivos.'),
    onSinImagen: (puedeLeer) => setError(puedeLeer ? 'No hay una imagen copiada.' : 'Este navegador no deja pegar.'),
  };
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
  /** `r`: lo que contestó la tarjeta (su «Abrir», los avisos y lo que dibuja el resultado: `conTarjeta`). */
  const alEstado = (pendienteId: number, estado: EstadoPropuesta, nota?: string, r?: ResultadoTarjeta) => {
    setItems((xs) => conTarjeta(xs, pendienteId, estado, nota, r));
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
      alEstado(id, d.estado ?? 'pendiente', d.frase ?? undefined, l.datos);
      // Lo confirmado cambió al lead (su etapa, una nota, una etiqueta): la ficha que rodea al chat
      // es una FOTO y se relee por el aviso de siempre (ficha-cambio.tsx), no con un refresh suelto.
      if (d.estado === 'hecho' || d.estado === 'fallo') refrescarFicha();
    } finally {
      setTarjeta(null);
    }
  };

  const hayTrabajo = trabajo != null;

  // Lo nuevo se ve sin buscarlo: el hilo sigue abajo si se estaba mirando lo último, y al abrir la ficha de otro lead.
  const deLead = useRef(leadId);
  useLayoutEffect(() => {
    const h = hiloRef.current;
    if (!h) return;
    if (deLead.current !== leadId) { deLead.current = leadId; abajo.current = true; }
    if (abajo.current) h.scrollTop = h.scrollHeight;
  }, [items, hayTrabajo, listo, leadId]);

  // ── Arriba de la caja: las preguntas de arranque (sólo con el hilo vacío) ──
  const vacio = listo && !errorCarga && items.length === 0;
  const preguntas = vacio && !hayTrabajo ? (
    <div role="group" aria-label="Preguntas para empezar" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 16px 8px' }}>
      {(edicion ? SUGERENCIAS_EDICION : SUGERENCIAS).map((s) => (
        <button key={s} type="button" className="of-pill" onClick={() => enviar({ texto: s, adjuntos: [] })}>{s}</button>
      ))}
    </div>
  ) : null;

  const vacioHilo = errorCarga ? (
    <div role="alert" style={{ margin: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center', color: 'var(--dim)', fontSize: 13.5 }}>
      <span>{errorCarga}</span>
      <Button variant="secondary" size="sm" onClick={recargar}>Volver a cargar el chat</Button>
    </div>
  ) : (
    <div style={{ margin: 'auto', maxWidth: 360, textAlign: 'center', color: 'var(--dim)', fontSize: 13.5, lineHeight: 1.5 }}>
      {edicion
        ? <>Dile a MaKo qué cambiar de {edicion.nombre ? `«${edicion.nombre}»` : 'esta hoja'}. Cambia para todos los leads del CRM.</>
        : <>MaKo ya tiene la ficha de {quien}: pregúntale lo que quieras.</>}
    </div>
  );

  /** Lo que dice la línea de debajo de la caja mientras sube un archivo (después, el «Trabajando…» del hilo). */
  const estado = trabajo?.fase === 'subiendo' ? `Subiendo ${trabajo.fuente} · ${Math.round(trabajo.pct * 100)}%` : null;

  return (
    <div className="of-hilo" data-esquina-ocupada
      onDragOver={alArrastrar} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setEncima(false); }} onDrop={alSoltar}
      style={{
        flex: 1, minHeight: 420, height: '100%', display: 'flex', flexDirection: 'column', position: 'relative',
        background: 'var(--surface)', border: '1px solid var(--border)', borderTop: '3px solid var(--primary)', borderRadius: 16, overflow: 'hidden',
      }}>
      <style>{CSS_OFFER}</style>
      <div className="co-hilo" ref={hiloRef} onScroll={(e) => { abajo.current = estaAbajo(e.currentTarget); }}>
        <div className="co-hilo__col">
          {!listo ? (
            <p role="status" style={{ margin: 'auto', color: 'var(--dim)', fontSize: 13.5 }}>Abriendo el chat…</p>
          ) : errorCarga || vacio ? vacioHilo : (
            // `key` por lead: el hilo de otro lead no hereda nada del anterior.
            <HiloMako key={leadId} items={items} quien={QUIEN} ahora={ahora} escribiendo={hayTrabajo ? { segs } : null}
              tarjeta={tarjeta} onTarjeta={(x, a) => void correrTarjeta(x, a)} onReintentar={reintentar} onRecargar={recargar}
              onResponder={(t) => { if (ocupadoRef.current) return false; enviar({ texto: t, adjuntos: [] }); return true; }}
              onTrabajo={(de, ok) => { setItems((xs) => trasTrabajo(xs, de, ok)); refrescarFicha(); }} />
          )}
        </div>
      </div>
      {/* El cartel de soltar del Ops Center (centro.css → .co-soltar). */}
      {encima && <div className="co-soltar" aria-hidden>Suelta para adjuntar</div>}
      {preguntas}
      {error && <div role="alert" className="of-error">{error}</div>}
      {/* La caja va POR LEAD (`key`): una grabación a medias no viaja a la ficha de otro. */}
      <div key={leadId} className="co-caja-wrap" style={SIN_VERDE}>
        <div className="co-caja">
          <CajaChat texto={texto} onTexto={(v) => { setError(null); setTexto(v); }} onMandar={enviarComposer}
            ocupado={hayTrabajo || procesando > 0} apagado={!listo || !!errorCarga}
            placeholder={edicion ? `Qué cambiar de ${edicion.nombre || 'esta hoja'}` : `Pregúntale a MaKo por ${quien}`}
            tituloMandar="Mandar (Enter)" enterManda seguir={() => hiloRef.current} onErrorMic={setError}
            adjuntos={adjuntosCaja} voz={{ onAudio: enviarAudio, onError: setError, rotuloEnviar: 'Enviar audio' }} estado={estado} />
        </div>
      </div>
    </div>
  );
}
