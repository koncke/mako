'use client';

// =============================================================================
// Composer — la caja de escribir de la ventana del chat
// =============================================================================
// docs/diseno-chats.md §3 y §8.3. DESDE EL 24/10/2026 ES LA CAJA ÚNICA DE LA APP (`CajaChat`, app/_chat/CajaChat.tsx; Martín:
// «hay funcionalidades que tenemos en el chat con MaKo que faltan, me gustaría que se parezca más al chat de MaKo»): una
// fila con el «+» (Documento, Fotos, Cámara, Pegar), los emojis, el campo con viñetas, listas y links azules, «MaKo» al
// final y UN botón (la nota de voz en WhatsApp, el dictado en los demás, la flecha con algo escrito). Lo de Chats va en
// las ranuras de la caja:
//   · `arriba`: por dónde sale («WhatsApp (Ventas) · +52 55… ⌄», que abre las identidades del contacto; las que no pueden
//     escribir, grises con su motivo), el asunto del email y el interruptor «Comentario»;
//   · el MODO COMENTARIO tiñe la caja de durazno (#ffebd1, borde #fa8900) con «Sólo lo ve tu equipo»: el comentario es la
//     NOTA DEL LEAD (la misma del CRM); sin lead, la caja lo dice y el alta está en la cabecera (§8.2, un solo lugar);
//   · arriba de la caja, el BORRADOR DE MAKO pendiente (la cola de borradores de WhatsApp), con «Enviar», «Editar» y
//     «Descartar».
// Los adjuntos siguen abriendo la vista de WhatsApp Web (la de la casa, pedido de Martín del 11/10) por encima del hilo:
// el «+», pegar y SOLTAR sobre la conversación (VentanaChat, `onSoltar`) entran ahí.
//
// Lo que NO se copia de respond.io, y por qué: snippets con «/» y variables con «$» (v2), AI Prompts
// (tonos, traducir) y «Summarize» (v2), la cita al responder (Evolution y Zernio no la tienen) y las
// plantillas de WhatsApp (el WhatsApp de MaKo es el NO oficial: sin ventana de 24 h ni plantillas).
//
// ⚠️ SE MONTA CON `key` POR CONVERSACIÓN (VentanaChat: `<Composer key={chat.clave}`). La sesión de voz
//    guarda el `onSend` del render en que se apretó el 🎤, y ése manda a la identidad de ESE render: sin
//    la key, una nota grabada en el chat A salía al contacto B (tests/whatsapp-sexta-tanda.test.ts:319).
//    Lo mismo los adjuntos juntados y el texto: nacen y mueren con su conversación.
// ⚠️ TODO WHATSAPP SALE CON LA `linea` DE LA IDENTIDAD ELEGIDA (`cuerpoTextoWhatsApp`,
//    `formArchivoWhatsApp`). Sin ella el servidor usa la línea por default y, en un negocio con dos
//    números, el mensaje sale por el que no es.
// ⚠️ MAKO NUNCA ENVÍA. «MaKo» escribe una sugerencia EN EL CAMPO y la persona decide (AGENTS.md, «un
//    canal propone y una persona confirma»). `sugerirConMaKo` no toca ningún endpoint de envío; lo fija
//    tests/chats-ventana.test.ts.
// ⚠️ EL BORRADOR DEL TEXTO VIVE EN EL NAVEGADOR CON EL WORKSPACE EN LA CLAVE (`claveBorradoresLocal`):
//    el super admin abre dos clientes en dos pestañas del mismo origen. Se lee DESPUÉS de montar (un
//    `useState` que lee `localStorage` desarma la hidratación cuando la ventana viene del server).
// ⚠️ INSTAGRAM Y MESSENGER: SÓLO TEXTO en v1 (docs/diseno-chats.md §6.4), y sólo dentro de la ventana
//    de 24 h: el servidor lo decide (`puedeEscribir`) y la pantalla sólo lo dice.

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { BorradorChat, ChatResumen, IdentidadCanal, MensajeChat } from '@/lib/chats-tipos';
import { CajaChat } from '@/app/_chat/CajaChat';
import type { AdjuntosDeCaja } from '@/app/admin/operaciones/AdjuntosCaja';
import { VistaAdjuntos, useListaAdjuntos } from '@/app/whatsapp/_shared/VistaAdjuntos';
import { enviarEnOrden, MAX_ADJUNTOS } from '@/app/whatsapp/_shared/adjuntos-vista';
import { IconoCanal } from './iconos-canal';
import { AvatarRio, Ico, ItemMenu, postJson, useAfuera } from './ventana-piezas';
import {
  TOPE_ARCHIVO, claveIdentidad, cuerpoTextoWhatsApp, esCanalMaKo, formArchivoWhatsApp, guardarBorradorLocal, identidadInicial,
  leerBorradorLocal, mensajesParaMaKo, motivoNoEnvio, ponerSugerencia, rotuloIdentidad, rutaArchivoWhatsApp,
} from './ventana-reglas';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
// La caja única vive con las hojas del Ops Center (`.co-caja`): la traen todas las pantallas que la usan.
import '@/app/admin/operaciones/centro.css';

/** Lo que el clip deja elegir (el mismo `accept` del hilo de la casa). */
const ACCEPT = 'image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx';

type Miembro = { nombre: string; foto_url: string | null };

export type ComposerProps = {
  ws: number | null;
  chat: ChatResumen;
  yo: { id: number; nombre: string };
  equipo: Miembro[];
  /** La conversación que MaKo lee para sugerir. */
  mensajes: MensajeChat[];
  /** Los borradores de MaKo pendientes para este contacto (`hilo.borradores`). */
  borradores: BorradorChat[];
  /** El mensaje optimista: aparece en el hilo ya, con un reloj. */
  onPendiente: (m: MensajeChat) => void;
  /** Salió. `real`: el mensaje que devolvió el canal (Instagram/Messenger), si lo devolvió. */
  onConfirmado: (tmpId: string, real: MensajeChat | null) => void;
  /** No salió: el optimista se va (y el texto vuelve al campo). */
  onFallido: (tmpId: string) => void;
  /** Algo salió (mensaje, archivo, audio, comentario, borrador): la ventana relee el hilo y la lista. */
  onEnviado: () => void;
  onAviso: (texto: string, error?: boolean, detalle?: string | null) => void;
  /** Lo que la ventana necesita para que SOLTAR un archivo sobre la conversación entre como adjunto (CajaChat: «arrastrar
   *  y soltar es de la pantalla»). Se avisa en cada cambio; `undefined` = este canal no adjunta. */
  onAdjuntos?: (a: AdjuntosDeCaja | undefined) => void;
};

/** `localStorage`, o null si el navegador no lo deja (modo privado, bloqueado). */
function almacen(): Storage | null {
  try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; }
}

let secuenciaTmp = 0;
const idTmp = () => `tmp:${Date.now().toString(36)}-${(secuenciaTmp++).toString(36)}`;

export default function Composer({
  ws, chat, yo, equipo, mensajes, borradores, onPendiente, onConfirmado, onFallido, onEnviado, onAviso, onAdjuntos,
}: ComposerProps) {
  const clave = chat.clave;
  const canales = chat.canales;

  // ── Por dónde se escribe ──
  // Se recuerda la identidad elegida por su clave; si el canal la reescribe (WhatsApp devuelve el jid
  // canónico, @lid → número), se sigue por la misma LÍNEA y no se salta a otra.
  const [elegida, setElegida] = useState<string | null>(null);
  const ident: IdentidadCanal | null =
    canales.find((c) => claveIdentidad(c) === elegida)
    ?? (elegida ? canales.find((c) => elegida.startsWith(`${c.canal}|${c.cuenta ?? ''}|`) && c.puedeEscribir) : undefined)
    ?? identidadInicial(canales);
  const motivo = motivoNoEnvio(ident, chat.bloqueado);
  const esWa = ident?.canal === 'whatsapp';
  // El EMAIL (17/10/2026): sale por /api/chats/email, con asunto (vacío = «Re: <el último que llegó>») y adjuntos.
  const esEmail = ident?.canal === 'email';
  const [asunto, setAsunto] = useState('');

  // ── El texto (con su borrador en el navegador) ──
  const [modo, setModo] = useState<'mensaje' | 'comentario'>('mensaje');
  const [texto, setTextoEstado] = useState('');
  const textoVivo = useRef('');
  const setTexto = (v: string | ((p: string) => string)) => {
    const next = typeof v === 'function' ? v(textoVivo.current) : v;
    textoVivo.current = next;
    setTextoEstado(next);
    guardarBorradorLocal(almacen(), ws, clave, next);
  };
  useEffect(() => {
    const guardado = leerBorradorLocal(almacen(), ws, clave);
    if (guardado && !textoVivo.current) { textoVivo.current = guardado; setTextoEstado(guardado); }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- una vez por montaje (la key es la conversación)
  }, []);
  const [nota, setNota] = useState('');

  const [enviando, setEnviando] = useState(false);
  const [fase, setFase] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<'canal' | null>(null);
  const cerrar = () => setAbierto(null);
  const cajaCanal = useAfuera<HTMLDivElement>(abierto === 'canal', cerrar);
  // El campo de la caja (CajaChat lo crece, le pone viñetas y los emojis en el cursor): se enfoca desde acá.
  const campo = useRef<HTMLTextAreaElement | null>(null);

  // ── Mandar un archivo o una nota de voz por WhatsApp (multipart, con la línea) ──
  async function mandarArchivo(i: IdentidadCanal, blob: Blob, nombre: string, tipo: '' | 'audio', caption?: string): Promise<boolean> {
    const fd = formArchivoWhatsApp(i, blob, nombre, { leadId: chat.leadId, caption, tipo });
    // Un grupo de MaKo sale por el canal de MaKo (el mismo multipart): `rutaArchivoWhatsApp`.
    const r = await fetch(rutaArchivoWhatsApp(i), { method: 'POST', body: fd, signal: AbortSignal.timeout(90_000) });
    const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (r.ok && j?.ok) return true;
    // `enviarEnOrden` toma el mensaje de lo que se tira y lo pone en su frase.
    throw new Error(j?.error || `Error ${r.status}`);
  }

  /**
   * NO SE SABE SI SALIÓ (se cortó por tiempo o por la red): ni «Fallido» con el texto de vuelta para reenviar,
   * ni «Enviado». Se relee el hilo (si salió, aparece) y se dice qué hacer. Verificado el 15/10/2026: con el texto
   * de vuelta en el campo, un Enter le mandaba el mismo mensaje dos veces al lead.
   */
  function incierto(tmp: string) {
    onFallido(tmp);
    onEnviado();
    setError('No sé si salió: revisa el hilo antes de reenviar.');
  }

  // ── El texto ──
  async function enviarTexto() {
    const t = textoVivo.current.trim();
    if (!t || enviando || motivo || !ident) return;
    const i = ident;
    const tmp = idTmp();
    // Una clave por MENSAJE: Zernio no manda dos veces el mismo pedido con la misma clave.
    const idempotencia = tmp.replace(/[^A-Za-z0-9-]/g, '').slice(0, 64);
    setEnviando(true); setError(null);
    onPendiente({
      id: tmp, tipo: 'mensaje', canal: i.canal, cuenta: i.cuenta, saliente: true, autor: null, texto: t, formato: 'text',
      mediaUrl: null, mediaMime: null, fecha: new Date().toISOString(), status: null, error: null,
    });
    // El campo se vacía ANTES de esperar (el envío de WhatsApp tarda lo que dura el «escribiendo…», hasta
    // 9 s): con el texto ahí, se leía duplicado. Si falla, vuelve, salvo que ya se haya escrito otra cosa.
    setTexto('');
    try {
      if (esCanalMaKo(i)) {
        // Un grupo de MaKo (el super admin en su barra): por el canal de MaKo, como en /agencia.
        const j = await postJson<{ ok: boolean; error?: string }>('/api/admin/mako-chats', { jid: i.ref, texto: t }, { timeoutMs: 45_000 });
        if (j.incierto) { incierto(tmp); return; }
        if (!j.ok) throw new Error(j.error || 'No se pudo enviar.');
        onConfirmado(tmp, null);
      } else if (i.canal === 'whatsapp') {
        // 45 s: por encima de lo que el servidor espera a Evolution (30 s) más la base. Cortar antes era decir
        // «no salió» de algo que el servidor igual mandó.
        const j = await postJson<{ ok: boolean; error?: string; chatJid?: string | null }>('/api/whatsapp/evolution/mensajes', cuerpoTextoWhatsApp(i, t, chat.leadId), { timeoutMs: 45_000 });
        if (j.incierto) { incierto(tmp); return; }
        if (!j.ok) throw new Error(j.error || 'No se pudo enviar.');
        // WhatsApp puede devolver OTRO chatJid (el canónico: el 9 o el 1 de AR/MX, un @lid). La lista
        // se relee (`onEnviado` → `onCambio`) y la identidad elegida se sigue por su línea, no por el jid.
        if (j.chatJid && j.chatJid !== i.ref) setElegida(`${i.canal}|${i.cuenta ?? ''}|${j.chatJid}`);
        onConfirmado(tmp, null);
      } else if (i.canal === 'email') {
        const j = await postJson<{ ok: boolean; error?: string; mensaje?: MensajeChat }>('/api/chats/email', { para: i.ref, texto: t, asunto: asunto.trim() || undefined, leadId: chat.leadId ?? undefined }, { timeoutMs: 60_000 });
        if (j.incierto) { incierto(tmp); return; }
        if (!j.ok) throw new Error(j.error || 'No se pudo enviar.');
        setAsunto('');
        onConfirmado(tmp, j.mensaje ?? null);
      } else {
        const j = await postJson<{ ok: boolean; error?: string; mensaje?: MensajeChat; terminal?: boolean }>('/api/chats/social', { convId: Number(i.ref), texto: t, idempotencia }, { timeoutMs: 45_000 });
        if (j.incierto) { incierto(tmp); return; }
        if (!j.ok) {
          // `terminal`: una regla de Meta (la ventana de 24 h se cerró mientras se escribía). Reintentar no
          // lo arregla: se relee el hilo para que la identidad pase a gris con su motivo.
          if (j.terminal) onEnviado();
          throw new Error(j.error || 'No se pudo enviar.');
        }
        onConfirmado(tmp, j.mensaje ?? null);
      }
      onEnviado();
    } catch (e) {
      onFallido(tmp);
      setTexto((d) => d || t);
      setError(e instanceof Error && e.message ? e.message : 'No se pudo enviar.');
    } finally {
      setEnviando(false);
      campo.current?.focus();
    }
  }

  // ── Los adjuntos: varios, con vista previa (la de la casa, pedido de Martín del 11/10) ──
  const lista = useListaAdjuntos({ maxBytes: TOPE_ARCHIVO, maxArchivos: MAX_ADJUNTOS, accept: ACCEPT });
  const puedeAdjuntar = (esWa || esEmail) && !motivo;
  function agregarArchivos(fs: File[]) {
    if (!fs.length || !puedeAdjuntar) return;
    const errores = lista.agregar(fs);
    setError(errores.length ? errores.join(' ') : null);
  }
  /**
   * El «+» de la caja (Documento, Fotos, Cámara, Pegar), pegar en el campo y soltar sobre la conversación: todo entra a la
   * vista de WhatsApp Web (`lista`), que se abre por encima. `items` va VACÍO a propósito: la caja no dibuja miniaturas
   * propias, porque lo adjuntado se ve (y se le escribe el pie) en esa vista.
   */
  const adjuntosCaja: AdjuntosDeCaja | undefined = modo === 'mensaje' && puedeAdjuntar ? {
    items: [], puede: !enviando, accept: ACCEPT, onSumar: agregarArchivos, onQuitar: () => {},
    onNoPuede: () => setError('Espera a que salga lo anterior.'),
    onSinImagen: (puedeLeer) => setError(puedeLeer ? 'No hay una imagen copiada.' : 'Este navegador no deja pegar.'),
  } : undefined;
  const avisarAdjuntos = useRef(onAdjuntos);
  avisarAdjuntos.current = onAdjuntos;
  useEffect(() => { avisarAdjuntos.current?.(adjuntosCaja); });
  /**
   * Manda los archivos EN ORDEN, el texto como pie del primero (como WhatsApp). La vista se cierra ya:
   * lo que sale se ve salir en el hilo. Si uno falla, los que faltan vuelven a la vista con el error.
   */
  async function enviarAdjuntos() {
    const items = lista.ref.current;
    if (!items.length || enviando || !ident || motivo) return;
    if (ident.canal === 'email') { await enviarEmailConAdjuntos(ident, items.map((it) => it.file)); return; }
    if (ident.canal !== 'whatsapp') return;
    const i = ident;
    const cap = textoVivo.current.trim();
    setEnviando(true); setError(null);
    lista.vaciar(); setTexto('');
    setFase(items.length === 1 ? 'Enviando archivo…' : `Enviando ${items.length} archivos…`);
    try {
      const r = await enviarEnOrden(items, cap, (it, caption) => mandarArchivo(i, it.file, it.file.name, '', caption));
      if (r.enviados.length) onEnviado();
      if (r.faltan.length) {
        lista.poner(r.faltan);
        if (!r.textoSalio && cap) setTexto((d) => d || cap);
        setError(r.error);
      }
    } finally { setEnviando(false); setFase(null); }
  }

  /**
   * Un email con ADJUNTOS: a diferencia de WhatsApp, sale UNO solo con todos los archivos y el texto como cuerpo. Si
   * falla, los archivos y el texto vuelven a su lugar.
   */
  async function enviarEmailConAdjuntos(i: IdentidadCanal, archivos: File[]) {
    const cuerpo = textoVivo.current.trim();
    const guardados = lista.ref.current;
    setEnviando(true); setError(null);
    lista.vaciar(); setTexto('');
    setFase(archivos.length === 1 ? 'Enviando email con su archivo…' : `Enviando email con ${archivos.length} archivos…`);
    try {
      const fd = new FormData();
      fd.set('para', i.ref);
      fd.set('texto', cuerpo);
      if (asunto.trim()) fd.set('asunto', asunto.trim());
      if (chat.leadId != null) fd.set('leadId', String(chat.leadId));
      for (const f of archivos) fd.append('archivos', f, f.name);
      const r = await fetch('/api/chats/email', { method: 'POST', body: fd, signal: AbortSignal.timeout(90_000) });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) throw new Error(j.error || 'No se pudo enviar.');
      setAsunto('');
      onEnviado();
    } catch (e) {
      lista.poner(guardados);
      setTexto((d) => d || cuerpo);
      setError(e instanceof Error && e.message ? e.message : 'No se pudo enviar.');
    } finally { setEnviando(false); setFase(null); }
  }

  // ── La nota de voz (sólo WhatsApp) ──
  // La sesión es la de la caja (`voz`): ✓ termina, se escucha, y recién la ➤ la entrega acá. Lo que manda es la identidad
  // de ESTE render: por eso el composer va con key por conversación.
  async function enviarAudio(blob: Blob) {
    if (!ident || ident.canal !== 'whatsapp' || motivo) { setError(motivo ?? 'La voz sale sólo por WhatsApp.'); return; }
    const i = ident;
    setEnviando(true); setError(null); setFase('Procesando audio…');
    try {
      let mp3: Blob;
      try {
        const { blobToMp3 } = await import('@/app/whatsapp/audio');
        mp3 = await blobToMp3(blob);
      } catch (e) {
        setError(`No se pudo procesar el audio${e instanceof Error && e.message ? ` (${e.message})` : ''}.`);
        return;
      }
      setFase('Enviando audio…');
      await mandarArchivo(i, mp3, 'nota-de-voz.mp3', 'audio');
      onEnviado();
    } catch (e) {
      setError(`No se pudo enviar el audio${e instanceof Error && e.message ? ` (${e.message})` : ''}.`);
    } finally { setEnviando(false); setFase(null); }
  }

  // ── MaKo sugiere (nunca envía) ──
  const [mako, setMako] = useState<{ cargando: boolean; sugs: string[]; i: number }>({ cargando: false, sugs: [], i: -1 });
  const ultimaSugerencia = useRef<string | null>(null);
  // En un grupo de MaKo no: el asesor sugiere qué contestarle a UN contacto.
  const makoDisponible = esWa && !motivo && !esCanalMaKo(ident);
  /**
   * El botón «MaKo»: la primera vez le pide a MaKo 2-3 mensajes para este contacto
   * (`/api/whatsapp/advisor`, action 'recommend', el mismo asesor de /whatsapp) y pone el primero EN EL
   * CAMPO; cada clic siguiente pone el próximo; después del último vuelve a pedir. No envía nada.
   */
  async function sugerirConMaKo() {
    if (!makoDisponible || !ident || mako.cargando) return;
    const poner = (s: string) => {
      const nuevo = ponerSugerencia(textoVivo.current, ultimaSugerencia.current, s);
      ultimaSugerencia.current = s;
      setTexto(nuevo);
      campo.current?.focus();
    };
    if (mako.i + 1 < mako.sugs.length) {
      const i = mako.i + 1;
      setMako({ ...mako, i });
      poner(mako.sugs[i]);
      return;
    }
    setMako({ cargando: true, sugs: [], i: -1 });
    const j = await postJson<{ ok: boolean; error?: string; recomendacion?: { sugerencias?: Array<{ texto?: string }> } }>('/api/whatsapp/advisor', {
      action: 'recommend',
      groupId: ident.ref,
      contacto: chat.nombre,
      empresa: chat.empresa,
      etapaLabel: chat.etapaLabel,
      leadId: chat.leadId,
      // El WhatsApp de MaKo es el no oficial: no hay ventana de 24 h que cuidar.
      ventanaAbierta: true,
      mensajes: mensajesParaMaKo(mensajes),
    });
    const sugs = (j.recomendacion?.sugerencias ?? []).map((s) => (s.texto ?? '').trim()).filter(Boolean);
    if (!j.ok || !sugs.length) {
      setMako({ cargando: false, sugs: [], i: -1 });
      onAviso('MaKo no pudo sugerir', true, j.error ?? null);
      return;
    }
    setMako({ cargando: false, sugs, i: 0 });
    poner(sugs[0]);
  }

  // ── El comentario (la nota del lead) ──
  async function enviarNota() {
    const t = nota.trim();
    if (!t || enviando || !chat.leadId) return;
    const tmp = idTmp();
    setEnviando(true); setError(null);
    onPendiente({
      id: tmp, tipo: 'comentario', canal: null, cuenta: null, saliente: true, autor: yo.nombre, texto: t, formato: 'text',
      mediaUrl: null, mediaMime: null, fecha: new Date().toISOString(), status: null, error: null,
    });
    setNota('');
    // La ruta devuelve el comentario YA guardado (`mensaje`, con su id `nota:<id>`): reemplaza al
    // optimista y la próxima lectura lo encuentra con el mismo id, sin parpadeo.
    const j = await postJson<{ ok: boolean; error?: string; mensaje?: MensajeChat }>('/api/chats/comentario', { leadId: chat.leadId, texto: t });
    if (j.ok) { onConfirmado(tmp, j.mensaje ?? null); onEnviado(); }
    else { onFallido(tmp); setNota((d) => d || t); setError(j.error || 'No se pudo comentar.'); }
    setEnviando(false);
    campo.current?.focus();
  }

  // ── El borrador de MaKo pendiente ──
  const borrador = borradores[0] ?? null;
  const [ocupadoBorrador, setOcupadoBorrador] = useState(false);
  async function resolverBorrador(accion: 'enviar' | 'descartar', silencioso = false): Promise<boolean> {
    if (!borrador || ocupadoBorrador) return false;
    setOcupadoBorrador(true);
    const j = await postJson<{ ok: boolean; error?: string; yaNoPendiente?: boolean }>('/api/whatsapp/evolution/borradores', { id: borrador.id, action: accion });
    setOcupadoBorrador(false);
    if (j.yaNoPendiente) { onAviso('Ese borrador ya salió', true, null); onEnviado(); return false; }
    if (!j.ok) { onAviso(accion === 'enviar' ? 'No se pudo enviar' : 'No se pudo descartar', true, j.error ?? null); return false; }
    if (!silencioso) onAviso(accion === 'enviar' ? 'Borrador enviado' : 'Borrador descartado');
    onEnviado();
    return true;
  }
  /**
   * «Editar»: el texto pasa al campo (por la línea del borrador, si el contacto la tiene) y el borrador
   * se DESCARTA. Si quedara pendiente, la cola lo podría mandar igual después de que la persona mandó su
   * versión editada: el mismo mensaje, dos veces.
   */
  async function editarBorrador() {
    if (!borrador) return;
    const b = borrador;
    // ⚠️ PRIMERO se descarta, y el texto pasa al campo SÓLO si el descarte se confirmó (15/10/2026). Si otro ya lo
    // estaba mandando, el descarte lo dice («Ese borrador ya salió») y no se ofrece una versión editada que el
    // lead recibiría además de la original.
    if (!(await resolverBorrador('descartar', true))) return;
    const suya = b.linea ? canales.find((c) => c.canal === 'whatsapp' && c.cuenta === b.linea) : null;
    if (suya) setElegida(claveIdentidad(suya));
    setModo('mensaje');
    setTexto(ponerSugerencia(textoVivo.current, null, b.texto));
    campo.current?.focus();
  }

  const alternarModo = () => { setModo((m) => (m === 'mensaje' ? 'comentario' : 'mensaje')); setAbierto(null); setError(null); campo.current?.focus(); };
  // Ctrl/⌘ + \ alterna mensaje y comentario (el atajo de respond.io): la caja no expone su teclado, así que se escucha en
  // la envoltura (la tecla sube desde el campo).
  const teclaEnvoltura = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === '\\') { e.preventDefault(); alternarModo(); }
  };

  const fotoYo = equipo.find((m) => m.nombre === yo.nombre)?.foto_url ?? null;

  const selectorCanal = (
    <div className="rio-canal" ref={cajaCanal}>
      <button type="button" className="rio-canal-btn" onClick={() => setAbierto((a) => (a === 'canal' ? null : 'canal'))}
        aria-expanded={abierto === 'canal'} aria-haspopup="menu" title={ident ? rotuloIdentidad(ident) : undefined}>
        {ident && <IconoCanal canal={ident.canal} size={16} />}
        <span className="rio-canal-txt">{ident ? rotuloIdentidad(ident) : 'Sin canal'}</span>
        {canales.length > 1 && <Ico n={abierto === 'canal' ? 'chevArriba' : 'chevAbajo'} s={16} />}
      </button>
      {abierto === 'canal' && canales.length > 1 && (
        <div className="rio-menu rio-menu-arriba rio-menu-canal" role="menu">
          {canales.map((c) => {
            const k = claveIdentidad(c);
            const no = !c.puedeEscribir || c.bloqueado;
            return (
              <ItemMenu key={k} icono={<IconoCanal canal={c.canal} size={24} />} elegido={!!ident && claveIdentidad(ident) === k}
                deshabilitado={no} detalle={no ? (c.motivoNoEscribir ?? (c.bloqueado ? 'Bloqueado' : null)) : null}
                title={rotuloIdentidad(c)} onClick={() => { setElegida(k); setAbierto(null); campo.current?.focus(); }}>
                {rotuloIdentidad(c)}
              </ItemMenu>
            );
          })}
        </div>
      )}
    </div>
  );

  const enComentario = modo === 'comentario';
  // El comentario sin lead no se puede guardar (es la nota del lead): la caja se apaga y lo dice. El alta está arriba.
  const sinLeadParaComentar = enComentario && !chat.leadId;
  const arriba = (
    <>
      <div className="rio-caja-arriba">
        {enComentario
          ? <span className="rio-caja-nota-tit"><AvatarRio ws={ws} nombre={yo.nombre} foto={fotoYo} size={20} />Comentario · sólo lo ve tu equipo</span>
          : selectorCanal}
        <button type="button" className="rio-btn-comentario" onClick={alternarModo} title="Ctrl + barra invertida" aria-pressed={enComentario}>
          {enComentario ? <><Ico n="x" s={14} />Volver al mensaje</> : <><Ico n="comentario" s={14} />Comentario</>}
        </button>
      </div>
      {esEmail && !enComentario && (
        <input className="rio-comp-asunto" value={asunto} disabled={!!motivo} maxLength={300}
          placeholder="Asunto (vacío: responde al último)" aria-label="Asunto" onChange={(e) => setAsunto(e.target.value)} />
      )}
    </>
  );

  return (
    // `data-esquina-ocupada`: el Enviar vive en el rincón de abajo a la derecha de la ventana, y la
    // esquina de los avisos (EsquinaAvisos) sube para no taparlo (AGENTS.md).
    <div className="rio-comp" data-esquina-ocupada="" onKeyDown={teclaEnvoltura}>
      {borrador && !enComentario && (
        <div className="rio-borrador">
          <div className="rio-borrador-cab">
            <span className="rio-borrador-tit"><span className="rio-borrador-ico"><Ico n="destello" s={16} /></span>Borrador de MaKo{borradores.length > 1 ? ` · ${borradores.length}` : ''}</span>
            <span className="rio-borrador-acc">
              <button type="button" className="rio-btn-texto" disabled={ocupadoBorrador} onClick={() => void resolverBorrador('descartar')}>Descartar</button>
              <button type="button" className="rio-btn" disabled={ocupadoBorrador} onClick={() => void editarBorrador()}>Editar</button>
              <button type="button" className="rio-btn rio-btn-mako" disabled={ocupadoBorrador || !!chat.bloqueado} onClick={() => void resolverBorrador('enviar')}>Enviar</button>
            </span>
          </div>
          <div className="rio-borrador-txt">{borrador.texto}</div>
        </div>
      )}
      {fase && <div className="rio-comp-fase"><span className="rio-giro rio-giro-chico" />{fase}</div>}
      {error && (
        <div className="rio-comp-error" role="alert">
          <span>{error}</span>
          <button type="button" className="rio-comp-error-x" onClick={() => setError(null)} aria-label="Cerrar"><Ico n="x" s={14} /></button>
          <ReportarASoporte />
        </div>
      )}

      {/* LA CAJA ÚNICA (app/_chat/CajaChat.tsx) con el motor de Chats. La clase `co-caja` es la de la caja en toda la app;
          `rio-caja` la acomoda a la ventana y la tiñe en modo comentario. */}
      <div className={`co-caja rio-caja${enComentario ? ' rio-caja-nota' : ''}`}>
        <CajaChat
          texto={enComentario ? nota : texto}
          onTexto={enComentario ? setNota : setTexto}
          onMandar={() => { if (enComentario) void enviarNota(); else void enviarTexto(); }}
          enviando={enviando}
          apagado={enComentario ? sinLeadParaComentar : !!motivo}
          placeholder={enComentario
            ? (sinLeadParaComentar ? 'Para comentar, primero agrégalo al CRM' : 'Solo lo ve tu equipo')
            : (motivo ?? (esEmail ? 'Escribe un email' : 'Escribe un mensaje'))}
          tituloMandar={enComentario ? 'Comentar' : 'Enviar'}
          enterManda
          campo={campo}
          altoMax={160}
          adjuntos={adjuntosCaja}
          arriba={arriba}
          alFinal={!enComentario ? (
            <button type="button" className="rio-mako" disabled={!makoDisponible || mako.cargando} onClick={() => void sugerirConMaKo()}
              title={!esWa ? 'Por ahora, sólo en WhatsApp' : motivo ?? 'MaKo sugiere un mensaje; tú decides si lo envías'}>
              {mako.cargando ? <span className="rio-giro rio-giro-chico" /> : <Ico n="varita" s={16} />}MaKo
            </button>
          ) : null}
          // La nota de voz es de WhatsApp; en los demás canales (y en el comentario) el micrófono dicta.
          voz={!enComentario && esWa && !motivo ? { onAudio: (blob) => enviarAudio(blob), onError: (m) => setError(m), rotuloEnviar: 'Enviar audio' } : undefined}
          onErrorMic={(m) => setError(m)}
        />
      </div>

      {/* La vista previa de los adjuntos tapa el hilo y la caja (la de WhatsApp Web), anclada a la
          ventana (`.rio-cuerpo` es el contenedor posicionado): esta caja no lo es a propósito. */}
      {lista.items.length > 0 && (
        <div className="rio-vista-adjuntos">
          <VistaAdjuntos
            items={lista.items}
            onAgregar={agregarArchivos}
            onQuitar={(id) => { lista.quitar(id); if (!lista.ref.current.length) setError(null); }}
            onCerrar={() => { lista.vaciar(); setError(null); }}
            texto={texto}
            onTexto={setTexto}
            onEnviar={() => void enviarAdjuntos()}
            accept={ACCEPT}
            maxArchivos={MAX_ADJUNTOS}
            enviando={enviando}
            error={error}
            acento="var(--rio-primary, #1a6eff)"
            placeholder="Escribe un mensaje"
          />
        </div>
      )}
    </div>
  );
}
