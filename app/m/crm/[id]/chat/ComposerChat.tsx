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
// =============================================================================

import { useEffect, useRef, useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import { useConexion, useToastM } from '@/app/m/_ui';
import { haptico } from '@/lib/haptico';

const alFinal = () => window.scrollTo({ top: document.documentElement.scrollHeight });

export function ComposerChat({ leadId, chatJid, telefono, linea }: { leadId: number; chatJid: string; telefono: string; linea: string | null }) {
  const router = useRouter();
  const toast = useToastM();
  const { enLinea } = useConexion();
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  // Al abrir, el último mensaje a la vista.
  useEffect(() => { alFinal(); }, []);

  const enviar = async () => {
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true); setError(null);
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
      router.refresh();
      window.setTimeout(alFinal, 300);
    } catch {
      haptico('error'); setError('No salió el mensaje. Revisa el chat antes de reintentar.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="m-crm-composer" data-m-sin-barra>
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
