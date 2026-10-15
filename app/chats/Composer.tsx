'use client';

// =============================================================================
// Composer — la caja de escribir de la ventana del chat, copiada de respond.io
// =============================================================================
// docs/diseno-chats.md §3; relevamiento respondio.md §1.5 (capturas a-composer, 29, 36, 37):
//   · Una TARJETA con borde de radio 8. Fila 1: el selector de canal («<ícono> WhatsApp (Ventas) ·
//     +52 55… ⌄», abre HACIA ARRIBA las identidades del contacto; las que no pueden escribir, grises con
//     su motivo) y a la derecha «MaKo» (el «AI Assist» de respond.io). Después el campo que crece con el
//     texto («Escribe un mensaje») y la barra de íconos de 20: emoji, voz, adjuntar. Enviar a la derecha,
//     28×28, azul #1a6eff (gris apagado).
//   · Abajo, «Agregar comentario»: el MODO COMENTARIO pliega la tarjeta del mensaje a su fila de canal y
//     abre la tarjeta durazno (#ffebd1, borde #fa8900) con «Solo lo ve tu equipo» y el enviar naranja. El
//     comentario es la NOTA DEL LEAD (la misma del CRM): sin lead, primero «Agregar al CRM».
//   · Arriba de la tarjeta, el BORRADOR DE MAKO pendiente (la cola de borradores de WhatsApp), con
//     «Enviar», «Editar» y «Descartar».
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

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { BorradorChat, ChatResumen, IdentidadCanal, MensajeChat } from '@/lib/chats-tipos';
import { EmojiPicker } from '@/app/whatsapp/EmojiPicker';
import { accionDeTecla, insertarEnCursor } from '@/app/whatsapp/_shared/ComposerWhatsApp';
import { useGrabacionVoz, BarraGrabacion } from '@/app/whatsapp/_shared/VoiceRecorder';
import { VistaAdjuntos, useListaAdjuntos } from '@/app/whatsapp/_shared/VistaAdjuntos';
import { enviarEnOrden, MAX_ADJUNTOS } from '@/app/whatsapp/_shared/adjuntos-vista';
import { IconoCanal } from './iconos-canal';
import { AvatarRio, Ico, ItemMenu, postJson, useAfuera } from './ventana-piezas';
import {
  TOPE_ARCHIVO, claveIdentidad, cuerpoTextoWhatsApp, formArchivoWhatsApp, guardarBorradorLocal, identidadInicial,
  leerBorradorLocal, mensajesParaMaKo, motivoNoEnvio, ponerSugerencia, rotuloIdentidad,
} from './ventana-reglas';

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
  /** Lo que va en lugar del comentario cuando el contacto no está en el CRM (el «+ Agregar al CRM»). */
  agregarAlCrm: ReactNode;
  onAviso: (texto: string, error?: boolean, detalle?: string | null) => void;
};

/** `localStorage`, o null si el navegador no lo deja (modo privado, bloqueado). */
function almacen(): Storage | null {
  try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; }
}

let secuenciaTmp = 0;
const idTmp = () => `tmp:${Date.now().toString(36)}-${(secuenciaTmp++).toString(36)}`;

export default function Composer({
  ws, chat, yo, equipo, mensajes, borradores, onPendiente, onConfirmado, onFallido, onEnviado, agregarAlCrm, onAviso,
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
  const [abierto, setAbierto] = useState<'canal' | 'emoji' | 'emojiNota' | null>(null);
  const cerrar = () => setAbierto(null);
  const cajaCanal = useAfuera<HTMLDivElement>(abierto === 'canal', cerrar);
  const cajaEmoji = useAfuera<HTMLDivElement>(abierto === 'emoji', cerrar);
  const cajaEmojiNota = useAfuera<HTMLDivElement>(abierto === 'emojiNota', cerrar);
  const campo = useRef<HTMLTextAreaElement | null>(null);
  const campoNota = useRef<HTMLTextAreaElement | null>(null);
  const archivo = useRef<HTMLInputElement | null>(null);
  const cursor = useRef<number | null>(null);

  // El campo crece con el texto hasta 160 px; después scrollea. Y el cursor vuelve donde se insertó.
  useLayoutEffect(() => {
    for (const el of [campo.current, campoNota.current]) {
      if (!el) continue;
      el.style.height = 'auto';
      const alto = el.scrollHeight;
      el.style.height = `${Math.min(alto, 160)}px`;
      el.style.overflowY = alto > 160 ? 'auto' : 'hidden';
    }
    if (cursor.current != null) {
      const el = modo === 'comentario' ? campoNota.current : campo.current;
      const c = cursor.current;
      cursor.current = null;
      try { el?.setSelectionRange(c, c); } catch { /* el campo ya no está */ }
    }
  }, [texto, nota, modo]);

  const insertarEmoji = (em: string) => {
    if (modo === 'comentario') {
      const el = campoNota.current;
      const r = insertarEnCursor(nota, el?.selectionStart, el?.selectionEnd, em);
      cursor.current = r.cursor;
      setNota(r.valor);
    } else {
      const el = campo.current;
      const r = insertarEnCursor(textoVivo.current, el?.selectionStart, el?.selectionEnd, em);
      cursor.current = r.cursor;
      setTexto(r.valor);
    }
  };

  // ── Mandar un archivo o una nota de voz por WhatsApp (multipart, con la línea) ──
  async function mandarArchivo(i: IdentidadCanal, blob: Blob, nombre: string, tipo: '' | 'audio', caption?: string): Promise<boolean> {
    const fd = formArchivoWhatsApp(i, blob, nombre, { leadId: chat.leadId, caption, tipo });
    const r = await fetch('/api/whatsapp/evolution/mensajes', { method: 'POST', body: fd, signal: AbortSignal.timeout(90_000) });
    const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (r.ok && j?.ok) return true;
    // `enviarEnOrden` toma el mensaje de lo que se tira y lo pone en su frase.
    throw new Error(j?.error || `Error ${r.status}`);
  }

  // ── El texto ──
  async function enviarTexto() {
    const t = textoVivo.current.trim();
    if (!t || enviando || motivo || !ident) return;
    const i = ident;
    const tmp = idTmp();
    setEnviando(true); setError(null);
    onPendiente({
      id: tmp, tipo: 'mensaje', canal: i.canal, cuenta: i.cuenta, saliente: true, autor: null, texto: t, formato: 'text',
      mediaUrl: null, mediaMime: null, fecha: new Date().toISOString(), status: null, error: null,
    });
    // El campo se vacía ANTES de esperar (el envío de WhatsApp tarda lo que dura el «escribiendo…», hasta
    // 9 s): con el texto ahí, se leía duplicado. Si falla, vuelve, salvo que ya se haya escrito otra cosa.
    setTexto('');
    try {
      if (i.canal === 'whatsapp') {
        const j = await postJson<{ ok: boolean; error?: string; chatJid?: string | null }>('/api/whatsapp/evolution/mensajes', cuerpoTextoWhatsApp(i, t, chat.leadId));
        if (!j.ok) throw new Error(j.error || 'No se pudo enviar.');
        // WhatsApp puede devolver OTRO chatJid (el canónico: el 9 o el 1 de AR/MX, un @lid). La lista
        // se relee (`onEnviado` → `onCambio`) y la identidad elegida se sigue por su línea, no por el jid.
        if (j.chatJid && j.chatJid !== i.ref) setElegida(`${i.canal}|${i.cuenta ?? ''}|${j.chatJid}`);
        onConfirmado(tmp, null);
      } else {
        const j = await postJson<{ ok: boolean; error?: string; mensaje?: MensajeChat; terminal?: boolean }>('/api/chats/social', { convId: Number(i.ref), texto: t });
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
  const puedeAdjuntar = esWa && !motivo;
  function agregarArchivos(fs: File[]) {
    if (!fs.length || !puedeAdjuntar) return;
    const errores = lista.agregar(fs);
    setError(errores.length ? errores.join(' ') : null);
  }
  /**
   * Manda los archivos EN ORDEN, el texto como pie del primero (como WhatsApp). La vista se cierra ya:
   * lo que sale se ve salir en el hilo. Si uno falla, los que faltan vuelven a la vista con el error.
   */
  async function enviarAdjuntos() {
    const items = lista.ref.current;
    if (!items.length || enviando || !ident || ident.canal !== 'whatsapp' || motivo) return;
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

  // ── La nota de voz (sólo WhatsApp) ──
  // La sesión es la de la casa: ✓ termina, se escucha, y recién la ➤ la manda. `onSend` es el de ESTE
  // render (la identidad de cuando se apretó el 🎤): por eso el composer va con key por conversación.
  const voz = useGrabacionVoz(async (blob) => {
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
  }, (m) => setError(m));
  const grabando = voz.fase !== 'quieta';

  // ── MaKo sugiere (nunca envía) ──
  const [mako, setMako] = useState<{ cargando: boolean; sugs: string[]; i: number }>({ cargando: false, sugs: [], i: -1 });
  const ultimaSugerencia = useRef<string | null>(null);
  const makoDisponible = esWa && !motivo;
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
    campoNota.current?.focus();
  }

  // ── El borrador de MaKo pendiente ──
  const borrador = borradores[0] ?? null;
  const [ocupadoBorrador, setOcupadoBorrador] = useState(false);
  async function resolverBorrador(accion: 'enviar' | 'descartar', silencioso = false): Promise<boolean> {
    if (!borrador || ocupadoBorrador) return false;
    setOcupadoBorrador(true);
    const j = await postJson<{ ok: boolean; error?: string }>('/api/whatsapp/evolution/borradores', { id: borrador.id, action: accion });
    setOcupadoBorrador(false);
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
    const suya = borrador.linea ? canales.find((c) => c.canal === 'whatsapp' && c.cuenta === borrador.linea) : null;
    if (suya) setElegida(claveIdentidad(suya));
    setModo('mensaje');
    setTexto(ponerSugerencia(textoVivo.current, null, borrador.texto));
    await resolverBorrador('descartar', true);
    campo.current?.focus();
  }

  const alternarModo = () => { setModo((m) => (m === 'mensaje' ? 'comentario' : 'mensaje')); setAbierto(null); setError(null); };
  const teclaCampo = (e: KeyboardEvent<HTMLTextAreaElement>, enviar: () => void) => {
    // Ctrl/⌘ + \ alterna mensaje y comentario (el atajo de respond.io).
    if ((e.ctrlKey || e.metaKey) && e.key === '\\') { e.preventDefault(); alternarModo(); return; }
    if (accionDeTecla('enviar', { key: e.key, shiftKey: e.shiftKey, isComposing: e.nativeEvent.isComposing }) !== 'enviar') return;
    e.preventDefault();
    enviar();
  };

  const hayTexto = !!texto.trim();
  const fotoYo = equipo.find((m) => m.nombre === yo.nombre)?.foto_url ?? null;

  const selectorCanal = (
    <div className="rio-canal" ref={cajaCanal}>
      <button type="button" className="rio-canal-btn" onClick={() => setAbierto((a) => (a === 'canal' ? null : 'canal'))}
        aria-expanded={abierto === 'canal'} aria-haspopup="menu" title={ident ? rotuloIdentidad(ident) : undefined}>
        {ident && <IconoCanal canal={ident.canal} size={16} />}
        <span className="rio-canal-txt">{ident ? rotuloIdentidad(ident) : 'Sin canal'}</span>
        <Ico n={abierto === 'canal' ? 'chevArriba' : 'chevAbajo'} s={16} />
      </button>
      {abierto === 'canal' && (
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

  return (
    // `data-esquina-ocupada`: el Enviar vive en el rincón de abajo a la derecha de la ventana, y la
    // esquina de los avisos (EsquinaAvisos) sube para no taparlo (AGENTS.md).
    <div className="rio-comp" data-esquina-ocupada="">
      {borrador && modo === 'mensaje' && (
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
        </div>
      )}

      <div className={`rio-comp-card${modo === 'comentario' ? ' rio-comp-plegada' : ''}`}>
        <div className="rio-comp-f1">
          {selectorCanal}
          {modo === 'mensaje' ? (
            <button type="button" className="rio-mako" disabled={!makoDisponible || mako.cargando} onClick={() => void sugerirConMaKo()}
              title={!esWa ? 'Por ahora, sólo en WhatsApp' : motivo ?? 'MaKo sugiere un mensaje; tú decides si lo envías'}>
              {mako.cargando ? <span className="rio-giro rio-giro-chico" /> : <Ico n="varita" s={16} />}MaKo
            </button>
          ) : (
            <button type="button" className="rio-ico-btn" onClick={alternarModo} title="Volver al mensaje" aria-label="Volver al mensaje"><Ico n="chevDer" s={20} /></button>
          )}
        </div>
        {modo === 'mensaje' && (grabando ? (
          <div className="rio-comp-voz"><BarraGrabacion voz={voz} ocupado={enviando} /></div>
        ) : (
          <>
            <textarea ref={campo} className="rio-comp-campo" rows={1} value={texto} disabled={!!motivo}
              placeholder={motivo ?? 'Escribe un mensaje'} aria-label="Mensaje"
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => teclaCampo(e, () => void enviarTexto())}
              onPaste={(e) => {
                const fs = Array.from(e.clipboardData?.files ?? []);
                if (fs.length && puedeAdjuntar) { e.preventDefault(); agregarArchivos(fs); }
              }} />
            <div className="rio-comp-barra">
              <div className="rio-ancla" ref={cajaEmoji}>
                <button type="button" className="rio-ico-btn" disabled={!!motivo} title="Emojis" aria-label="Emojis"
                  aria-expanded={abierto === 'emoji'} onClick={() => setAbierto((a) => (a === 'emoji' ? null : 'emoji'))}><Ico n="emoji" s={20} /></button>
                {abierto === 'emoji' && <div className="rio-pop-arriba"><EmojiPicker onPick={insertarEmoji} onClose={cerrar} /></div>}
              </div>
              {esWa && (
                <button type="button" className="rio-ico-btn" disabled={!!motivo || enviando} title="Nota de voz" aria-label="Grabar nota de voz"
                  onClick={() => void voz.start()}><Ico n="micro" s={20} /></button>
              )}
              {esWa && (
                <>
                  <button type="button" className="rio-ico-btn" disabled={!puedeAdjuntar || enviando} title="Adjuntar archivos" aria-label="Adjuntar archivos"
                    onClick={() => archivo.current?.click()}><Ico n="clip" s={20} /></button>
                  <input ref={archivo} type="file" multiple accept={ACCEPT} hidden
                    onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ''; agregarArchivos(fs); }} />
                </>
              )}
              <span className="rio-comp-esp" />
              <button type="button" className="rio-enviar" disabled={!hayTexto || enviando || !!motivo} onClick={() => void enviarTexto()}
                title="Enviar" aria-label="Enviar"><Ico n="enviar" s={16} /></button>
            </div>
          </>
        ))}
      </div>

      {modo === 'comentario' && (
        <div className="rio-nota-card">
          {chat.leadId ? (
            <>
              <div className="rio-nota-f1">
                <AvatarRio ws={ws} nombre={yo.nombre} foto={fotoYo} size={24} />
                <textarea ref={campoNota} className="rio-comp-campo rio-nota-campo" rows={1} value={nota} autoFocus
                  placeholder="Solo lo ve tu equipo" aria-label="Comentario"
                  onChange={(e) => setNota(e.target.value)}
                  onKeyDown={(e) => teclaCampo(e, () => void enviarNota())} />
                <button type="button" className="rio-ico-btn" onClick={alternarModo} title="Cerrar comentario" aria-label="Cerrar comentario"><Ico n="x" s={18} /></button>
              </div>
              <div className="rio-comp-barra">
                <div className="rio-ancla" ref={cajaEmojiNota}>
                  <button type="button" className="rio-ico-btn" title="Emojis" aria-label="Emojis" aria-expanded={abierto === 'emojiNota'}
                    onClick={() => setAbierto((a) => (a === 'emojiNota' ? null : 'emojiNota'))}><Ico n="emoji" s={20} /></button>
                  {abierto === 'emojiNota' && <div className="rio-pop-arriba"><EmojiPicker onPick={insertarEmoji} onClose={cerrar} /></div>}
                </div>
                <span className="rio-comp-esp" />
                <button type="button" className="rio-enviar rio-enviar-nota" disabled={!nota.trim() || enviando} onClick={() => void enviarNota()}
                  title="Comentar" aria-label="Comentar"><Ico n="enviar" s={16} /></button>
              </div>
            </>
          ) : (
            <div className="rio-nota-sinlead">
              <span>Agrega el contacto al CRM para comentar</span>
              <span className="rio-alta-crm">{agregarAlCrm}</span>
              <button type="button" className="rio-ico-btn" onClick={alternarModo} title="Cerrar comentario" aria-label="Cerrar comentario"><Ico n="x" s={18} /></button>
            </div>
          )}
        </div>
      )}

      {modo === 'mensaje' && (
        <div className="rio-comp-pie">
          <button type="button" className="rio-btn-comentario" onClick={alternarModo} title="Ctrl + barra invertida">
            <Ico n="comentario" s={16} />Agregar comentario
          </button>
        </div>
      )}

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
