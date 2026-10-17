'use client';

// =============================================================================
// El composer de un chat del teléfono: escribe por el canal elegido (17/10/2026)
// =============================================================================
// El de escritorio (app/chats/Composer.tsx), destilado a texto: arranca en el canal de la última actividad
// que puede escribir (`identidadInicial`), y si el contacto tiene más de uno se elige arriba del campo
// (WhatsApp de cada línea, Instagram, Messenger, Email). Sale por las MISMAS rutas que escritorio:
//   · WhatsApp → POST /api/whatsapp/evolution/mensajes con la LÍNEA de la identidad (`cuerpoTextoWhatsApp`):
//     sin ella el servidor elige la de por defecto y sale por otro número;
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
// =============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from '@/app/_ui/Link';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import { postJson } from '@/app/chats/ventana-piezas';
import { claveIdentidad, cuerpoTextoWhatsApp, identidadInicial, motivoNoEnvio, rotuloIdentidad } from '@/app/chats/ventana-reglas';
import { useConexion, useToastM } from '@/app/m/_ui';
import type { IdentidadCanal } from '@/lib/chats-tipos';
import { haptico } from '@/lib/haptico';
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

  // La identidad: la elegida si sigue existiendo (los canales llegan de nuevo con cada refresco), si no la inicial.
  const ident = useMemo(
    () => canales.find((i) => claveIdentidad(i) === elegida) ?? identidadInicial(canales),
    [canales, elegida],
  );
  const motivo = motivoNoEnvio(ident, bloqueado);

  useEffect(() => { setPie(document.getElementById('m-pie')); alFinal(); }, []);
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
    if (ident.canal === 'whatsapp') {
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
    <div className="m-chats-composer" data-m-sin-barra>
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
          onFocus={() => { escribiendo.current = true; }}
          onBlur={() => { escribiendo.current = enviando; }}
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
