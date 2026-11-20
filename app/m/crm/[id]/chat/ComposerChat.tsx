'use client';

// =============================================================================
// El composer del WhatsApp del lead (sólo texto en esta tanda), v2
// =============================================================================
// Manda por POST /api/whatsapp/evolution/mensajes CON LA LÍNEA DEL CHAT: el lead le escribió a
// ESE número, y `elegirLinea` rechaza una línea ajena en vez de caer a la de por defecto
// (lib/lineas-whatsapp.ts). Mandar sin `linea` —lo que hace la ficha de escritorio— sale por la
// línea por defecto, que puede ser otro número.
//
// Pegado abajo con `bottom: var(--m-abajo)` (la pantalla es de trabajo: sin barra, es el área
// segura). `data-m-sin-barra` esconde la barra también en el HTML del server, antes de hidratar.
// Al abrir, el hilo baja hasta el último mensaje (como cualquier app de mensajes). Sin red no se
// escribe: la cinta del shell ya dice desde cuándo son los datos.
// LO QUE ESCRIBE EL LEAD LLEGA SOLO (20/11/2026, movil-5): antes nada lo pedía mientras la pantalla estaba abierta. El mismo sondeo
// de /m/chats (cada 15 s, con la pantalla a la vista, sin un envío en curso), y lo que llega, lo que crece y lo suyo los sigue
// `useSeguirLaPagina` (app/m/_chat/SeguirLaPagina.tsx): como WhatsApp, a quien lee arriba no lo arrastra.
// =============================================================================

import { useEffect, useRef, useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import { useConexion, useToastM } from '@/app/m/_ui';
import { haptico } from '@/lib/haptico';
import { NuevosM, useSeguirLaPagina } from '@/app/m/_chat/SeguirLaPagina';
import { CADA_MS_HILO } from '@/app/m/chats/modelo';

export function ComposerChat({ leadId, chatJid, telefono, linea, ultimo, total }: {
  leadId: number; chatJid: string; telefono: string; linea: string | null;
  /** La clave del último mensaje dibujado y cuántos hay (movil-5). */
  ultimo: string; total: number;
}) {
  const router = useRouter();
  const toast = useToastM();
  const { enLinea } = useConexion();
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const seguir = useSeguirLaPagina(ultimo, total);
  /** Un envío en curso: lo único que frena el sondeo. */
  const enviandoAhora = useRef(false);

  useEffect(() => {
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !enviandoAhora.current) router.refresh();
    }, CADA_MS_HILO);
    return () => window.clearInterval(t);
  }, [router]);

  const enviar = async () => {
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true); enviandoAhora.current = true; setError(null);
    try {
      // ⚠️ CON SEÑAL DE CORTE: un fetch sin signal con la red caída no resuelve nunca.
      const r = await fetch('/api/whatsapp/evolution/mensajes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat: chatJid, telefono, texto: t, leadId, linea }),
        signal: AbortSignal.timeout(45_000),
      });
      const j = (await r.json().catch(() => ({ ok: false }))) as { ok: boolean; error?: string };
      if (!j.ok) { haptico('error'); setError(j.error ? `No salió: ${j.error.slice(0, 100)}` : 'No salió el mensaje.'); return; }
      setTexto('');
      if (area.current) area.current.style.height = '';
      haptico('success');
      toast('Enviado');
      // Lo suyo baja cuando aparece (antes, a los 300 ms: con la red lenta llegaba después, movil-2).
      seguir.esperarLoSuyo();
      router.refresh();
    } catch {
      haptico('error'); setError('No salió el mensaje. Revisa el chat antes de reintentar.');
    } finally {
      setEnviando(false); enviandoAhora.current = false;
    }
  };

  return (
    <div className="m-crm-composer" data-m-sin-barra>
      <NuevosM n={seguir.nuevos} onBajar={seguir.bajar} />
      {error && <p className="m-crm-error">{error}</p>}
      <div className="m-crm-composer__fila">
        <textarea
          ref={area}
          rows={1}
          aria-label="Responder por WhatsApp"
          placeholder={enLinea ? 'Responder' : 'Sin conexión'}
          value={texto}
          disabled={!enLinea || enviando}
          onChange={(e) => {
            setTexto(e.target.value);
            const el = e.target; el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
          }}
        />
        <button
          type="button"
          className="m-crm-enviar"
          aria-label="Enviar"
          aria-busy={enviando || undefined}
          disabled={!texto.trim() || !enLinea || enviando}
          onClick={enviar}
        >
          {enviando ? <span className="mk-spin m-crm-spin" aria-hidden /> : <IconoMenu nombre="enviar" size={20} />}
        </button>
      </div>
    </div>
  );
}
