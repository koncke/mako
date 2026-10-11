'use client';

// =============================================================================
// El composer del hilo de WhatsApp del lead (sólo texto en esta tanda).
// =============================================================================
// Manda por POST /api/whatsapp/evolution/mensajes CON LA LÍNEA DEL CHAT: el lead le
// escribió a ESE número, y `elegirLinea` rechaza una línea ajena en vez de caer a la
// de por defecto (lib/lineas-whatsapp.ts). Mandar sin `linea` —lo que hace la ficha
// de escritorio— sale por la línea por defecto, que puede ser otro número.
//
// Sin red no se escribe (la cinta del shell ya dice desde cuándo son los datos).
// `data-m-sin-barra` esconde la barra inferior mientras el chat está abierto.
// =============================================================================

import { useRef, useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Button } from '@/app/_ui/Button';
import { useConexion, useToastM } from '@/app/m/_ui';
import { haptico } from '@/lib/haptico';

export function ComposerChat({ leadId, chatJid, telefono, linea }: { leadId: number; chatJid: string; telefono: string; linea: string | null }) {
  const router = useRouter();
  const toast = useToastM();
  const { enLinea } = useConexion();
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);

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
      if (!j.ok) { haptico('error'); setError(j.error ? `No salió: ${j.error.slice(0, 100)}` : 'No salió el mensaje'); return; }
      setTexto('');
      toast('Enviado');
      router.refresh();
      window.setTimeout(() => window.scrollTo({ top: document.body.scrollHeight }), 300);
    } catch {
      haptico('error'); setError('No salió el mensaje. Revisa el chat antes de reintentar.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="mc-composer" data-m-sin-barra>
      <p className="mc-composer__aviso">Número no oficial: úsalo con criterio, nunca en masa.</p>
      <div className="mc-composer__fila">
        <textarea
          ref={area}
          rows={1}
          aria-label="Mensaje"
          placeholder={enLinea ? 'Escribe un mensaje' : 'Sin conexión'}
          value={texto}
          disabled={!enLinea || enviando}
          onChange={(e) => {
            setTexto(e.target.value);
            const el = e.target; el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
          }}
        />
        <Button variant="primary" size="md" loading={enviando} disabled={!texto.trim() || !enLinea} onClick={enviar}>Enviar</Button>
      </div>
      {error && <p className="mc-composer__error">{error}</p>}
    </div>
  );
}
