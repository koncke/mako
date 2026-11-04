'use client';

// =============================================================================
// El composer de un chat del teléfono: escribe por el canal elegido (17/10/2026)
// =============================================================================
// El de escritorio (app/chats/Composer.tsx), destilado a texto: arranca en el canal de la última actividad
// que puede escribir (`identidadInicial`), y si el contacto tiene más de uno se elige arriba del campo
// (WhatsApp de cada línea, Instagram, Messenger, Email). Sale por las MISMAS rutas que escritorio:
//   · WhatsApp → POST /api/whatsapp/evolution/mensajes con la LÍNEA de la identidad (`cuerpoTextoWhatsApp`):
//     sin ella el servidor elige la de por defecto y sale por otro número; un grupo de MaKo (el super admin), por el
//     canal de MaKo (/api/admin/mako-chats, `esCanalMaKo`);
//   · Instagram / Messenger → POST /api/chats/social con UNA clave de idempotencia por mensaje;
//   · Email → POST /api/chats/email (el asunto vacío lo pone el servidor: «Re: …»).
// Si no se puede escribir por ahí, el campo lo dice (`motivoNoEnvio`, el de escritorio).
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

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from '@/app/_ui/Link';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import { postJson } from '@/app/chats/ventana-piezas';
import { claveIdentidad, cuerpoTextoWhatsApp, esCanalMaKo, identidadInicial, motivoNoEnvio, rotuloIdentidad } from '@/app/chats/ventana-reglas';
import { useConexion, useToastM } from '@/app/m/_ui';
import type { IdentidadCanal } from '@/lib/chats-tipos';
import { haptico } from '@/lib/haptico';
import { tecladoDelComposer } from '@/app/m/mako/chat-ui';
import { CADA_MS_HILO } from '../modelo';

const alFinal = () => window.scrollTo({ top: document.documentElement.scrollHeight });

type Respuesta = { ok: boolean; error?: string; incierto?: boolean };

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
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pie, setPie] = useState<HTMLElement | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const escribiendo = useRef(false);
  const [enfocado, setEnfocado] = useState(false);
  const [teclado, setTeclado] = useState({ corrimiento: 0, abierto: false, reserva: 0 });

  // La identidad: la elegida si sigue existiendo (los canales llegan de nuevo con cada refresco), si no la inicial.
  const ident = useMemo(
    () => canales.find((i) => claveIdentidad(i) === elegida) ?? identidadInicial(canales),
    [canales, elegida],
  );
  const motivo = motivoNoEnvio(ident, bloqueado);

  useEffect(() => { setPie(document.getElementById('m-pie')); alFinal(); }, []);
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

  const enviar = async () => {
    const t = texto.trim();
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
    setTexto('');
    if (area.current) area.current.style.height = '';
    if (j.incierto) { setError('No sé si salió. Mira el chat antes de volver a mandarlo.'); router.refresh(); return; }
    haptico('success');
    toast('Enviado');
    router.refresh();
    window.setTimeout(alFinal, 400);
  };

  const cuerpo = (
    <div className="m-chats-composer" data-m-sin-barra data-teclado={teclado.abierto ? '' : undefined}
      style={teclado.corrimiento ? { transform: `translateY(${-teclado.corrimiento}px)` } : undefined}>
      {error && <p className="m-chats-error">{error}</p>}
      {canales.length > 1 && (
        <label className="m-chats-canal">
          <span className="m-chats-canal__k">Por</span>
          <select value={ident ? claveIdentidad(ident) : ''} onChange={(e) => setElegida(e.target.value)} aria-label="Por dónde se escribe">
            {canales.map((i) => <option key={claveIdentidad(i)} value={claveIdentidad(i)}>{rotuloIdentidad(i)}</option>)}
          </select>
        </label>
      )}
      <div className="m-chats-composer__fila">
        <textarea
          ref={area}
          rows={1}
          aria-label={ident ? `Responder por ${ident.rotulo}` : 'Responder'}
          placeholder={!enLinea ? 'Sin conexión' : motivo ?? 'Responder'}
          value={texto}
          disabled={!enLinea || enviando || !!motivo}
          onFocus={() => { escribiendo.current = true; setEnfocado(true); }}
          onBlur={() => {
            escribiendo.current = enviando;
            // Tocar Enviar no cuenta como salir del campo (ComposerOfferM): la franja no se mueve bajo el dedo.
            window.setTimeout(() => { if (document.activeElement !== area.current) setEnfocado(false); }, 0);
          }}
          onChange={(e) => {
            setTexto(e.target.value);
            const el = e.target; el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
          }}
        />
        <button
          type="button"
          className="m-chats-enviar"
          aria-label="Enviar"
          aria-busy={enviando || undefined}
          disabled={!texto.trim() || !enLinea || enviando || !!motivo}
          onClick={() => { void enviar(); }}
        >
          {enviando ? <span className="mk-spin m-chats-spin" aria-hidden /> : <IconoMenu nombre="enviar" size={20} />}
        </button>
      </div>
    </div>
  );
  // Antes de montar (el HTML del server) va en su lugar; después, en #m-pie.
  return pie ? createPortal(cuerpo, pie) : cuerpo;
}
