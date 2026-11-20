'use client';

// =============================================================================
// «Reiniciar onboarding» — en la barra de la vista de administrador, al lado de RESET (20/11/2026)
// =============================================================================
// Martín: «una opción en SuperAdmin para resetear al usuario sin que pierda su información… que pueda resetear el onboarding».
// RESET (PanelAgencia) vacía el negocio entero y sólo existe en el Cliente de Prueba. Éste borra SÓLO el estado del onboarding y
// del reto (lib/reiniciar-onboarding.ts dice qué sí y qué no), así que va en cualquier cliente que el super admin esté mirando.
// Quién puede lo decide el server (/api/admin/reiniciar-onboarding: super admin, nunca el negocio del dueño).
//
// ⚠️ Después de reiniciar NO navega al onboarding: mirándolo como administrador, cada paso que se toca avanza el onboarding DEL
// CLIENTE (el arranque se guarda en el negocio). Lo tiene que hacer la persona.

import { useState, type CSSProperties } from 'react';
import { AvisoFlotante } from './AvisoFlotante';

const MONO = "'Geist Mono', monospace";

const chip: CSSProperties = {
  fontFamily: MONO, fontSize: 11.5, letterSpacing: '.06em', textTransform: 'uppercase',
  padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(243,240,231,.3)',
  background: 'transparent', color: '#F3F0E7', cursor: 'pointer', whiteSpace: 'nowrap',
};

/** Lo que dice la confirmación: qué vuelve a empezar y qué NO se toca. */
export const TEXTO_REINICIAR = 'Vuelve a empezar el onboarding y el reto de 7 días. No borra nada de lo suyo: leads y CRM, cursos, automatizaciones, funnels, ofertas, conversaciones, archivos, plan y cobros quedan como están. Su WhatsApp sigue verificado.';

export function ReiniciarOnboarding({ cliente }: { cliente: string }) {
  const [confirmar, setConfirmar] = useState(false);
  const [busy, setBusy] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; tono: 'info' | 'error' } | null>(null);

  async function reiniciar() {
    setBusy(true); setAviso(null);
    try {
      const r = await fetch('/api/admin/reiniciar-onboarding', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aplicar: true }),
      });
      const j = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }));
      if (!j.ok) { setAviso({ texto: j.error || 'No se pudo reiniciar el onboarding.', tono: 'error' }); return; }
      setConfirmar(false);
      setAviso({ texto: `Listo: ${cliente} empieza el onboarding la próxima vez que entre. No se borró nada de lo suyo.`, tono: 'info' });
    } catch (e) {
      setAviso({ texto: e instanceof Error ? e.message : 'No se pudo reiniciar el onboarding.', tono: 'error' });
    } finally { setBusy(false); }
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      {confirmar ? (
        <>
          <span title={TEXTO_REINICIAR} style={{ fontSize: 12.5, color: '#F3F0E7', maxWidth: 420, lineHeight: 1.35 }}>
            ¿Reiniciar el onboarding de {cliente}? {TEXTO_REINICIAR}
          </span>
          <button type="button" onClick={() => void reiniciar()} disabled={busy} style={{ ...chip, borderColor: '#C8870C', color: '#F2C46B' }}>
            {busy ? 'Reiniciando…' : 'Sí, reiniciar'}
          </button>
          <button type="button" onClick={() => setConfirmar(false)} disabled={busy} style={chip}>No</button>
        </>
      ) : (
        <button type="button" onClick={() => setConfirmar(true)} title={TEXTO_REINICIAR} style={chip}>
          Reiniciar onboarding
        </button>
      )}
      {aviso && <AvisoFlotante mensaje={aviso.texto} tono={aviso.tono} onCerrar={() => setAviso(null)} />}
    </span>
  );
}
