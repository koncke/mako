'use client';

// =============================================================================
// El composer de un chat del teléfono: escribe por el canal elegido (17/10/2026), con la caja de WhatsApp (13/11/2026)
// =============================================================================
// Arranca en el canal de la última actividad que puede escribir (`identidadInicial`), y si el contacto tiene más de uno se elige
// arriba del campo (WhatsApp de cada línea, Instagram, Messenger, Email). Sale por las MISMAS rutas que escritorio (app/chats/Composer.tsx):
//   · WhatsApp → POST /api/whatsapp/evolution/mensajes con la LÍNEA de la identidad (`cuerpoTextoWhatsApp`):
//     sin ella el servidor elige la de por defecto y sale por otro número; un grupo de MaKo (el super admin), por el
//     canal de MaKo (/api/admin/mako-chats, `esCanalMaKo`);
//   · Instagram / Messenger → POST /api/chats/social con UNA clave de idempotencia por mensaje (sólo texto, como escritorio);
//   · Email → POST /api/chats/email (el asunto vacío lo pone el servidor: «Re: …»).
// Si no se puede escribir por ahí, el campo lo dice (`motivoNoEnvio`, el de escritorio).
//
// LA CAJA DE WHATSAPP (13/11/2026, el prototipo que aprobó Martín: docs/prototipos/mako-mobile-chat.html): la caja ÚNICA de la app
// (CajaChat), en `.m-wa` (app/m/_chat/chat-wa.css). Lo que antes faltaba en el teléfono y escritorio ya tenía:
//   · ADJUNTAR (el clip: Documento, Fotos, Cámara, Pegar) por WhatsApp y por email: lo elegido se ve en la vista previa a pantalla
//     completa (VistaAdjuntosM, la de la casa) y sale EN ORDEN, el texto como pie del primero (`enviarEnOrden`), con el MISMO
//     multipart de escritorio (`formArchivoWhatsApp`, con la línea); un email sale UNO con todos los archivos;
//   · la NOTA DE VOZ, sólo por WhatsApp: se graba, se escucha y recién ahí sale como audio (`blobToMp3`).
//   ⚠️ A un LEAD lo adjuntado viaja como ARCHIVO, nunca leído y pegado como texto (`sinAdjuntos`, ticket #16, app/_chat/CajaChat.tsx).
//
// ⚠️ UN ENVÍO INCIERTO NO VUELVE AL CAMPO (regla de la casa, docs/hallazgos-chats.md): si la red se cortó
// o el servidor dio 504, el mensaje pudo salir; devolverlo invita a mandarlo dos veces.
//
// Al abrir: el último mensaje a la vista y la conversación marcada leída (POST /api/chats/estado `leido`, por
// persona). Con la pestaña a la vista, el hilo se vuelve a pedir cada 15 s (lo que hace escritorio).
// Pegado abajo por portal a #m-pie: PantallaM corre la página al tirar para refrescar, y algo fijo adentro
// se correría con el gesto (app/m/_ui/LEEME.md).
//
// ⚠️ EL TECLADO DE iOS NO ACHICA EL LAYOUT (ticket #51 de Leandro, 4/11/2026, la captura IMG_2572): este composer era el único
// pegado abajo que no lo medía. Quedaba flotando a mitad de pantalla con el hueco del área segura, y por debajo se veía pasar el hilo,
// a través de la barra translúcida del teclado de iOS 26. Con el teclado arriba: se corre lo que mide, sin el área segura, y su fondo
// tapa lo que queda debajo (`tecladoDelComposer`, app/m/mako/chat-ui.ts; lo mismo que ComposerOfferM). Y el hilo deja ese lugar al final.
// =============================================================================

import '@/app/admin/operaciones/centro.css';
import '@/app/m/operaciones/operaciones.css';
import '@/app/m/_chat/chat-wa.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from '@/app/_ui/Link';
import { CajaChat } from '@/app/_chat/CajaChat';
import type { AdjuntosDeCaja } from '@/app/admin/operaciones/AdjuntosCaja';
import { useListaAdjuntos } from '@/app/whatsapp/_shared/VistaAdjuntos';
import { enviarEnOrden, MAX_ADJUNTOS } from '@/app/whatsapp/_shared/adjuntos-vista';
import { VistaAdjuntosM } from '@/app/m/mako/VistaAdjuntosM';
import { postJson } from '@/app/chats/ventana-piezas';
import {
  TOPE_ARCHIVO, claveIdentidad, cuerpoTextoWhatsApp, esCanalMaKo, formArchivoWhatsApp, identidadInicial, motivoNoEnvio, rotuloIdentidad, rutaArchivoWhatsApp,
} from '@/app/chats/ventana-reglas';
import { useConexion, useToastM } from '@/app/m/_ui';
import type { IdentidadCanal } from '@/lib/chats-tipos';
import { haptico } from '@/lib/haptico';
import { tecladoDelComposer } from '@/app/m/mako/chat-ui';
import { CADA_MS_HILO } from '../modelo';

/** Lo que el clip deja elegir: el mismo `accept` de escritorio (app/chats/Composer.tsx). */
export const ACCEPT_LEAD = 'image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx';

const alFinal = () => window.scrollTo({ top: document.documentElement.scrollHeight });

type Respuesta = { ok: boolean; error?: string; incierto?: boolean };

/** Un archivo o una nota de voz por WhatsApp: el multipart de escritorio, con la línea de la identidad. Tira con el porqué. */
async function mandarArchivo(i: IdentidadCanal, blob: Blob, nombre: string, tipo: '' | 'audio', leadId: number | null, caption?: string): Promise<boolean> {
  const fd = formArchivoWhatsApp(i, blob, nombre, { leadId, caption, tipo });
  const r = await fetch(rutaArchivoWhatsApp(i), { method: 'POST', body: fd, signal: AbortSignal.timeout(90_000) });
  const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (r.ok && j?.ok) return true;
  throw new Error(j?.error || `Error ${r.status}`);
}

export function ComposerChatsM({ clave, leadId, canales, bloqueado }: {
  clave: string;
  leadId: number | null;
  canales: IdentidadCanal[];
  bloqueado: boolean;
}) {
  const router = useRouter();
  const toast = useToastM();
  const { enLinea } = useConexion();
  const [elegida, setElegida] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const textoVivo = useRef('');
  const ponerTexto = (v: string | ((p: string) => string)) => {
    const next = typeof v === 'function' ? v(textoVivo.current) : v;
    textoVivo.current = next;
    setTexto(next);
  };
  const [enviando, setEnviando] = useState(false);
  const [fase, setFase] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pie, setPie] = useState<HTMLElement | null>(null);
  const campo = useRef<HTMLTextAreaElement | null>(null);
  const escribiendo = useRef(false);
  const [enfocado, setEnfocado] = useState(false);
  const [teclado, setTeclado] = useState({ corrimiento: 0, abierto: false, reserva: 0 });

  // La identidad: la elegida si sigue existiendo (los canales llegan de nuevo con cada refresco), si no la inicial.
  const ident = useMemo(
    () => canales.find((i) => claveIdentidad(i) === elegida) ?? identidadInicial(canales),
    [canales, elegida],
  );
  const motivo = motivoNoEnvio(ident, bloqueado);
  const esWa = ident?.canal === 'whatsapp';
  const esEmail = ident?.canal === 'email';

  useEffect(() => { setPie(document.getElementById('m-pie')); alFinal(); }, []);
  // El campo de la caja: enfocado o no (para medir el teclado de iOS sólo mientras se escribe).
  useEffect(() => {
    const el = campo.current;
    if (!el) return;
    const entra = () => { escribiendo.current = true; setEnfocado(true); };
    // Tocar Enviar no cuenta como salir del campo (ComposerOfferM): la franja no se mueve bajo el dedo.
    const sale = () => { escribiendo.current = enviando; window.setTimeout(() => { if (document.activeElement !== campo.current) setEnfocado(false); }, 0); };
    el.addEventListener('focus', entra);
    el.addEventListener('blur', sale);
    return () => { el.removeEventListener('focus', entra); el.removeEventListener('blur', sale); };
  }, [pie, enviando]);
  // El teclado de iOS, con el campo enfocado (mirar siempre se confundiría con el zoom de dos dedos).
  useEffect(() => {
    const vv = window.visualViewport;
    const apagado = { corrimiento: 0, abierto: false, reserva: 0 };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!vv || !enfocado) { setTeclado(apagado); return; }
    const medir = () => setTeclado(tecladoDelComposer(window.innerHeight, vv));
    medir();
    vv.addEventListener('resize', medir);
    vv.addEventListener('scroll', medir);
    return () => { vv.removeEventListener('resize', medir); vv.removeEventListener('scroll', medir); };
  }, [enfocado]);
  // El hilo deja el lugar del teclado al final, y al abrirse se ve lo último.
  useEffect(() => {
    const raiz = document.documentElement;
    if (teclado.reserva) raiz.style.setProperty('--m-chats-teclado', `${teclado.reserva}px`);
    else raiz.style.removeProperty('--m-chats-teclado');
    return () => { raiz.style.removeProperty('--m-chats-teclado'); };
  }, [teclado.reserva]);
  useEffect(() => { if (teclado.abierto) alFinal(); }, [teclado.abierto]);
  // Leída al abrir (y no en cada refresco: la marca es de quien MIRA el hilo, una vez por visita).
  useEffect(() => { void postJson('/api/chats/estado', { clave, accion: 'leido' }); }, [clave]);
  // Lo nuevo llega solo, con la pestaña a la vista y sin un envío en curso.
  useEffect(() => {
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !escribiendo.current) router.refresh();
    }, CADA_MS_HILO);
    return () => window.clearInterval(t);
  }, [router]);

  /** Salió algo: el hilo se relee y se ve lo último. */
  const salio = (aviso = 'Enviado') => {
    haptico('success');
    toast(aviso);
    router.refresh();
    window.setTimeout(alFinal, 400);
  };

  const enviar = async () => {
    const t = textoVivo.current.trim();
    if (!t || enviando || !ident || motivo) return;
    setEnviando(true); escribiendo.current = true; setError(null);
    let j: Respuesta;
    if (esCanalMaKo(ident)) {
      // Un grupo de MaKo (el super admin, 24/10/2026, docs/diseno-chats.md §8.5): por el canal de MaKo, como en escritorio.
      j = await postJson<Respuesta>('/api/admin/mako-chats', { jid: ident.ref, texto: t }, { timeoutMs: 45_000 });
    } else if (ident.canal === 'whatsapp') {
      j = await postJson<Respuesta>('/api/whatsapp/evolution/mensajes', cuerpoTextoWhatsApp(ident, t, leadId), { timeoutMs: 45_000 });
    } else if (ident.canal === 'email') {
      j = await postJson<Respuesta>('/api/chats/email', { para: ident.ref, texto: t, leadId: leadId ?? undefined }, { timeoutMs: 60_000 });
    } else {
      j = await postJson<Respuesta>('/api/chats/social', { convId: Number(ident.ref), texto: t, idempotencia: crypto.randomUUID() }, { timeoutMs: 45_000 });
    }
    setEnviando(false); escribiendo.current = false;
    if (!j.ok && !j.incierto) {
      haptico('error');
      setError(j.error ? `No salió: ${j.error.slice(0, 100)}` : 'No salió el mensaje.');
      return;
    }
    ponerTexto('');
    if (j.incierto) { setError('No sé si salió. Mira el chat antes de volver a mandarlo.'); router.refresh(); return; }
    salio();
  };

  // ── Los adjuntos: varios, con su vista previa a pantalla completa (la de la casa) ──
  const lista = useListaAdjuntos({ maxBytes: TOPE_ARCHIVO, maxArchivos: MAX_ADJUNTOS, accept: ACCEPT_LEAD });
  const puedeAdjuntar = (esWa || esEmail) && !motivo && enLinea;
  function agregarArchivos(fs: File[]) {
    if (!fs.length || !puedeAdjuntar) return;
    const errores = lista.agregar(fs);
    setError(errores.length ? errores.join(' ') : null);
  }
  /** El clip de la caja: todo entra a la vista previa, que se abre por encima. La caja no dibuja miniaturas propias. */
  const adjuntosCaja: AdjuntosDeCaja | undefined = puedeAdjuntar ? {
    items: [], puede: !enviando, accept: ACCEPT_LEAD, onSumar: agregarArchivos, onQuitar: () => {},
    onNoPuede: () => setError('Espera a que salga lo anterior.'),
    onSinImagen: (puedeLeer) => setError(puedeLeer ? 'No hay una imagen copiada.' : 'Este navegador no deja pegar.'),
  } : undefined;

  /** WhatsApp: EN ORDEN, el texto como pie del primero. Email: UNO con todos. Lo que no salió vuelve a la vista con su porqué. */
  async function enviarAdjuntos() {
    const items = lista.ref.current;
    if (!items.length || enviando || !ident || motivo) return;
    const i = ident;
    const cap = textoVivo.current.trim();
    setEnviando(true); escribiendo.current = true; setError(null);
    lista.vaciar(); ponerTexto('');
    try {
      if (i.canal === 'email') {
        setFase(items.length === 1 ? 'Enviando email con su archivo…' : `Enviando email con ${items.length} archivos…`);
        const fd = new FormData();
        fd.set('para', i.ref);
        fd.set('texto', cap);
        if (leadId != null) fd.set('leadId', String(leadId));
        for (const it of items) fd.append('archivos', it.file, it.file.name);
        const r = await fetch('/api/chats/email', { method: 'POST', body: fd, signal: AbortSignal.timeout(90_000) });
        const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!r.ok || !j.ok) { lista.poner(items); ponerTexto((d) => d || cap); setError(j.error || 'No se pudo enviar.'); return; }
        salio();
        return;
      }
      setFase(items.length === 1 ? 'Enviando archivo…' : `Enviando ${items.length} archivos…`);
      const r = await enviarEnOrden(items, cap, (it, caption) => mandarArchivo(i, it.file, it.file.name, '', leadId, caption));
      if (r.enviados.length) salio(r.enviados.length === 1 ? 'Enviado' : `${r.enviados.length} enviados`);
      if (r.faltan.length) {
        lista.poner(r.faltan);
        if (!r.textoSalio && cap) ponerTexto((d) => d || cap);
        setError(r.error);
      }
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'No se pudo enviar.');
    } finally { setEnviando(false); escribiendo.current = false; setFase(null); }
  }

  // ── La nota de voz (sólo WhatsApp): se termina, se escucha, y recién la ➤ la entrega acá ──
  async function enviarAudio(blob: Blob) {
    if (!ident || ident.canal !== 'whatsapp' || motivo) { setError(motivo ?? 'La voz sale sólo por WhatsApp.'); return; }
    const i = ident;
    setEnviando(true); escribiendo.current = true; setError(null); setFase('Procesando audio…');
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
      await mandarArchivo(i, mp3, 'nota-de-voz.mp3', 'audio', leadId);
      salio();
    } catch (e) {
      setError(`No se pudo enviar el audio${e instanceof Error && e.message ? ` (${e.message})` : ''}.`);
    } finally { setEnviando(false); escribiendo.current = false; setFase(null); }
  }

  const cuerpo = (
    <div className="m-chats-composer m-wa" data-m-sin-barra data-teclado={teclado.abierto ? '' : undefined}
      style={teclado.corrimiento ? { transform: `translateY(${-teclado.corrimiento}px)` } : undefined}>
      {error && <p className="m-chats-error">{error}</p>}
      {fase && <p className="m-chats-fase" aria-live="polite">{fase}</p>}
      {canales.length > 1 && (
        <label className="m-chats-canal">
          <span className="m-chats-canal__k">Por</span>
          <select value={ident ? claveIdentidad(ident) : ''} onChange={(e) => setElegida(e.target.value)} aria-label="Por dónde se escribe">
            {canales.map((i) => <option key={claveIdentidad(i)} value={claveIdentidad(i)}>{rotuloIdentidad(i)}</option>)}
          </select>
        </label>
      )}
      <div className="m-operaciones-caja">
        {/* La caja ÚNICA de la app con la cara de WhatsApp: Enter baja de renglón y se manda con el botón. */}
        <CajaChat
          sinAdjuntos
          texto={texto}
          onTexto={(v) => { setError(null); ponerTexto(v); }}
          onMandar={() => { void enviar(); }}
          enviando={enviando}
          apagado={!enLinea || !!motivo}
          placeholder={!enLinea ? 'Sin conexión' : motivo ?? (esEmail ? 'Escribe un email' : 'Mensaje')}
          tituloMandar="Enviar"
          campo={campo}
          altoMax={null}
          fila="m-operaciones-caja__fila"
          adjuntos={adjuntosCaja}
          voz={esWa && !motivo ? { onAudio: (blob) => enviarAudio(blob), onError: (m) => setError(m), rotuloEnviar: 'Enviar audio' } : undefined}
          onErrorMic={(m) => setError(m)}
        />
      </div>
      {lista.items.length > 0 && (
        <VistaAdjuntosM
          items={lista.items}
          onAgregar={agregarArchivos}
          onQuitar={(id) => { lista.quitar(id); if (!lista.ref.current.length) setError(null); }}
          onCerrar={() => { lista.vaciar(); setError(null); }}
          texto={texto}
          onTexto={ponerTexto}
          onEnviar={() => void enviarAdjuntos()}
          accept={ACCEPT_LEAD}
          maxArchivos={MAX_ADJUNTOS}
          enviando={enviando}
          error={error}
          acento="var(--good)"
          placeholder="Añade un comentario"
        />
      )}
    </div>
  );
  // Antes de montar (el HTML del server) va en su lugar; después, en #m-pie.
  return pie ? createPortal(cuerpo, pie) : cuerpo;
}
