'use client';

// =============================================================================
// DatosDeMau — traer (y devolver) el pedazo de Mau que corresponde a este lugar
// =============================================================================
// En el Archivero trae documentos, en el CRM leads, en el Chat Agent jugadas.
// Nunca "todo": para eso está el botón de completar el onboarding entero.
//
// Se pinta solo si la API dice que corresponde (super-admin de la agencia,
// parado en un workspace que no es el del dueño). En la cuenta real no existe.
//
// Uso:  <DatosDeMau ambito="archivero" />

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { AvisoFlotante } from './AvisoFlotante';

const MONO = "'Geist Mono', monospace";

type Props = {
  ambito: string;
  /** Texto del botón. Default: "Completar con los datos de Mau". */
  label?: string;
  /** Se llama después de traer o borrar. Si no se pasa, refresca la ruta. */
  onListo?: () => void;
  /** 'inline' (default), 'bloque' (solo, centrado) u 'oscuro' (sobre fondo negro). */
  variante?: 'inline' | 'bloque' | 'oscuro';
};

export function DatosDeMau({ ambito, label, onListo, variante = 'inline' }: Props) {
  const router = useRouter();
  const [disponible, setDisponible] = useState(false);
  const [completado, setCompletado] = useState(false);
  const [busy, setBusy] = useState<null | 'completar' | 'eliminar'>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; tono: 'info' | 'error' } | null>(null);

  const oscuro = variante === 'oscuro';
  const chip: CSSProperties = {
    fontFamily: MONO, fontSize: 11, letterSpacing: '.05em', textTransform: 'uppercase',
    padding: '7px 12px', borderRadius: 8, whiteSpace: 'nowrap', cursor: 'pointer',
    border: `1px ${oscuro ? 'solid rgba(243,240,231,.28)' : 'dashed var(--border-strong)'}`,
    background: 'transparent', color: oscuro ? '#F3F0E7' : 'var(--dim)',
  };

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
      if (!j.ok) { setAviso({ texto: j.error || 'No se pudo completar.', tono: 'error' }); return; }
      if (action === 'completar') {
        const n = j.copiado ?? 0;
        // Los avisos se muestran SIEMPRE: acá viaja el detalle de lo que no se
        // pudo copiar. Descartarlos hacía que un fallo se leyera como "no hay
        // nada que traer" y el bug quedaba invisible.
        const detalle = (j.avisos ?? []) as string[];
        setAviso({ texto: [n ? `Listo: ${n} elementos.` : 'No hay nada cargado en ese ámbito.', ...detalle].join(' · '), tono: detalle.length ? 'error' : 'info' });
        setCompletado(n > 0);
      } else {
        setAviso({ texto: `Eliminados: ${j.borrado ?? 0} elementos.`, tono: 'info' });
        setCompletado(false);
      }
      // Refresco suave: se vuelven a pedir los server components y la pantalla
      // se actualiza sin recargar la página entera (que pierde el scroll, el
      // estado del formulario y parpadea todo).
      if (onListo) onListo(); else router.refresh();

    } catch (e) {
      setAviso({ texto: e instanceof Error ? e.message : 'No se pudo completar.', tono: 'error' });
    } finally { setBusy(null); }
  }

  if (!disponible) return null;

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8,
      ...(variante === 'bloque' ? { justifyContent: 'center', width: '100%' } : {}),
    }}>
      <style>{'@keyframes mako-spin{to{transform:rotate(360deg)}}'}</style>

      <button type="button" onClick={() => void correr('completar')} disabled={busy !== null}
        style={{ ...chip, display: 'inline-flex', alignItems: 'center', gap: 7, opacity: busy ? 0.6 : 1 }}>
        {busy === 'completar' && (
          <span aria-hidden style={{ width: 11, height: 11, border: `2px solid ${oscuro ? 'rgba(243,240,231,.3)' : 'var(--border)'}`, borderTopColor: oscuro ? '#F3F0E7' : 'var(--dim)', borderRadius: '50%', display: 'inline-block', animation: 'mako-spin .8s linear infinite' }} />
        )}
        {busy === 'completar' ? 'Completando…' : (label ?? 'Completar con los datos de Mau')}
      </button>

      {completado && !confirmando && busy === null && (
        <button type="button" onClick={() => setConfirmando(true)}
          style={{ ...chip, color: oscuro ? '#FF9A9D' : 'var(--bad)', borderColor: oscuro ? 'rgba(229,72,77,.5)' : 'var(--bad)' }}>
          Eliminar
        </button>
      )}

      {confirmando && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: oscuro ? 'rgba(243,240,231,.8)' : 'var(--dim)', whiteSpace: 'nowrap' }}>
          ¿Eliminar lo que se trajo?
          <button type="button" onClick={() => void correr('eliminar')} disabled={busy !== null}
            style={{ ...chip, color: oscuro ? '#FF9A9D' : 'var(--bad)', borderColor: oscuro ? 'rgba(229,72,77,.5)' : 'var(--bad)', borderStyle: 'solid' }}>
            {busy === 'eliminar' ? 'Eliminando…' : 'Sí'}
          </button>
          <button type="button" onClick={() => setConfirmando(false)} style={{ ...chip, borderStyle: 'solid' }}>No</button>
        </span>
      )}

      {aviso && <AvisoFlotante mensaje={aviso.texto} tono={aviso.tono} onCerrar={() => setAviso(null)} />}
    </div>
  );
}
