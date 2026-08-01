'use client';

// =============================================================================
// DatosDeMau — los dos botones que van donde falta algo
// =============================================================================
// "Completar con los datos de Mau" y "Eliminar los datos de Mau", acotados al
// lugar donde está parado el usuario: en el Archivero traen documentos, en el
// CRM traen leads, en Setting traen jugadas. Nunca "todo".
//
// Se pinta solo si la API dice que corresponde (super-admin de la agencia,
// parado en un workspace de prueba). En la cuenta real no existe.
//
// Uso:  <DatosDeMau ambito="archivero" onListo={recargar} />

import { useCallback, useEffect, useState, type CSSProperties } from 'react';

const MONO = "'Geist Mono', monospace";

type Props = {
  ambito: string;
  /** Se llama después de traer o borrar, para que la pantalla se refresque. */
  onListo?: () => void;
  /** 'inline' (default) o 'bloque' cuando va solo, centrado. */
  variante?: 'inline' | 'bloque';
};

const chip: CSSProperties = {
  fontFamily: MONO, fontSize: 11, letterSpacing: '.05em', textTransform: 'uppercase',
  padding: '6px 11px', borderRadius: 8, border: '1px dashed var(--border-strong)',
  background: 'transparent', color: 'var(--dim)', cursor: 'pointer', whiteSpace: 'nowrap',
};

export function DatosDeMau({ ambito, onListo, variante = 'inline' }: Props) {
  const [disponible, setDisponible] = useState(false);
  const [completado, setCompletado] = useState(false);
  const [busy, setBusy] = useState<null | 'completar' | 'eliminar'>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const mirar = useCallback(async () => {
    try {
      const j = await (await fetch('/api/datos-mau', { cache: 'no-store' })).json();
      setDisponible(!!j.disponible);
      setCompletado(Array.isArray(j.completados) && j.completados.includes(ambito));
    } catch (e) {
      // Sin este rastro, "la API dijo que no" y "nunca se llamó" se ven igual:
      // el componente desaparece en silencio y el bug parece de permisos.
      console.warn('[datos-mau] no se pudo consultar', e);
      setDisponible(false);
    }
  }, [ambito]);

  useEffect(() => { void mirar(); }, [mirar]);

  async function correr(action: 'completar' | 'eliminar') {
    setBusy(action); setAviso(null); setConfirmando(false);
    try {
      const j = await (await fetch('/api/datos-mau', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ambito }),
      })).json();
      if (!j.ok) { setAviso(j.error || 'No se pudo.'); return; }
      if (action === 'completar') {
        const n = j.copiado ?? 0;
        setAviso(n ? `Listo: ${n} cosas traídas.${(j.avisos ?? []).length ? ` ${j.avisos[j.avisos.length - 1]}` : ''}` : 'Mau no tiene nada cargado acá.');
        setCompletado(n > 0);
      } else {
        setAviso(`Borrado: ${j.borrado ?? 0} cosas.`);
        setCompletado(false);
      }
      onListo?.();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'No se pudo.');
    } finally { setBusy(null); }
  }

  if (!disponible) return null;

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8,
      ...(variante === 'bloque' ? { justifyContent: 'center', width: '100%', marginTop: 12 } : {}),
    }}>
      <button type="button" onClick={() => void correr('completar')} disabled={busy !== null}
        style={{ ...chip, opacity: busy ? 0.55 : 1 }}>
        {busy === 'completar' ? 'Trayendo…' : '↓ Completar con los datos de Mau'}
      </button>

      {completado && !confirmando && (
        <button type="button" onClick={() => setConfirmando(true)} disabled={busy !== null}
          style={{ ...chip, color: 'var(--bad)', borderColor: 'var(--bad)', opacity: busy ? 0.55 : 1 }}>
          Eliminar los datos de Mau
        </button>
      )}

      {confirmando && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--dim)' }}>
          ¿Borro lo que trajimos de Mau acá?
          <button type="button" onClick={() => void correr('eliminar')} disabled={busy !== null}
            style={{ ...chip, color: 'var(--bad)', borderColor: 'var(--bad)', borderStyle: 'solid' }}>
            {busy === 'eliminar' ? 'Borrando…' : 'Sí, borrar'}
          </button>
          <button type="button" onClick={() => setConfirmando(false)} style={{ ...chip, borderStyle: 'solid' }}>No</button>
        </span>
      )}

      {aviso && <span style={{ fontSize: 12.5, color: 'var(--dim)', flexBasis: '100%' }}>{aviso}</span>}
    </div>
  );
}
