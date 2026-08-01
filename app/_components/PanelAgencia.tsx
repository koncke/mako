'use client';

// =============================================================================
// PanelAgencia — los controles de la agencia sobre el cliente de prueba
// =============================================================================
// Vive en la barra de "estás viendo el dashboard de X", al lado de "Salir de la
// vista". Por qué ahí y no adentro de cada tab: los botones por-lugar se
// esconden justo cuando hacen falta — una tab apagada redirige al onboarding,
// un empty state desaparece apenas hay un dato, y el paso del Archivero solo se
// pinta si YA hay archivos. La barra, en cambio, está en todas las pantallas.
//
// Dos cosas:
//   · Datos de Mau — traer o devolver el pedazo que quieras, ámbito por ámbito.
//   · Reset — vaciar el cliente entero y volver a empezar, con confirmación.
//
// Se pinta solo si /api/datos-mau dice que corresponde (super-admin de la
// agencia, parado en un workspace que no es el del dueño).

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';

const MONO = "'Geist Mono', monospace";

type Ambito = { key: string; label: string; nota: string | null };

const chip: CSSProperties = {
  fontFamily: MONO, fontSize: 11.5, letterSpacing: '.06em', textTransform: 'uppercase',
  padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(243,240,231,.3)',
  background: 'transparent', color: '#F3F0E7', cursor: 'pointer', whiteSpace: 'nowrap',
};

export function PanelAgencia({ cliente }: { cliente: string }) {
  const router = useRouter();
  const [disponible, setDisponible] = useState(false);
  const [ambitos, setAmbitos] = useState<Ambito[]>([]);
  const [completados, setCompletados] = useState<string[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [confirmarReset, setConfirmarReset] = useState(false);
  const caja = useRef<HTMLDivElement | null>(null);

  const mirar = useCallback(async () => {
    try {
      const j = await (await fetch('/api/datos-mau', { cache: 'no-store' })).json();
      setDisponible(!!j.disponible);
      setAmbitos(Array.isArray(j.ambitos) ? j.ambitos : []);
      setCompletados(Array.isArray(j.completados) ? j.completados : []);
    } catch (e) {
      console.warn('[datos-mau] no se pudo consultar', e);
      setDisponible(false);
    }
  }, []);

  useEffect(() => { void mirar(); }, [mirar]);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (!caja.current?.contains(e.target as Node)) setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [abierto]);

  async function correr(action: 'completar' | 'eliminar', ambito: string) {
    setBusy(`${action}:${ambito}`); setAviso(null);
    try {
      const j = await (await fetch('/api/datos-mau', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ambito }),
      })).json();
      if (!j.ok) { setAviso(j.error || 'No se pudo.'); return; }
      const detalle = (j.avisos ?? []) as string[];
      setAviso(action === 'completar'
        ? [j.copiado ? `Traídos: ${j.copiado} elementos.` : 'No hay nada cargado en ese ámbito.', ...detalle].join(' · ')
        : `Eliminados: ${j.borrado ?? 0} elementos.`);
      await mirar();
      // Refresco suave, no recarga: recargar la página entera pierde el scroll
      // y el estado del formulario, y se ve como si la app se hubiera caído.
      router.refresh();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'No se pudo.');
    } finally { setBusy(null); }
  }

  async function resetear() {
    setBusy('reset'); setAviso(null); setConfirmarReset(false);
    try {
      const j = await (await fetch('/api/datos-mau', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      })).json();
      if (!j.ok) { setAviso(j.error || 'No se pudo resetear.'); return; }
      const filas = Object.values((j.borrado ?? {}) as Record<string, number>).reduce((a, b) => a + b, 0);
      setAviso(`Workspace vaciado: ${filas} registros y ${j.archivos ?? 0} archivos.`);
      // El navegador guarda borradores y marcas de leído sin distinguir
      // workspace: si no se limpian, el cliente "reseteado" sigue pareciendo
      // lleno y encima muestra restos de OTRO cliente.
      try { Object.keys(localStorage).filter((k) => k.toLowerCase().startsWith('mako')).forEach((k) => localStorage.removeItem(k)); } catch { /* modo privado */ }
      setTimeout(() => { window.location.href = '/onboarding'; }, 1200);
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'No se pudo resetear.');
    } finally { setBusy(null); }
  }

  if (!disponible) return null;

  return (
    <div ref={caja} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
      {aviso && <span style={{ fontSize: 12, color: 'rgba(243,240,231,.75)', maxWidth: 320, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{aviso}</span>}

      <button type="button" onClick={() => setAbierto((a) => !a)} style={chip}>
        Datos de Mau {abierto ? '▴' : '▾'}
      </button>

      {confirmarReset ? (
        <>
          <span style={{ fontSize: 12.5, color: '#F3F0E7' }}>¿Vaciar por completo {cliente}?</span>
          <button type="button" onClick={() => void resetear()} disabled={busy !== null}
            style={{ ...chip, borderColor: '#E5484D', color: '#FF9A9D' }}>
            {busy === 'reset' ? 'Vaciando…' : 'Sí, vaciar'}
          </button>
          <button type="button" onClick={() => setConfirmarReset(false)} style={chip}>No</button>
        </>
      ) : (
        <button type="button" onClick={() => setConfirmarReset(true)} disabled={busy !== null}
          style={{ ...chip, borderColor: 'rgba(229,72,77,.55)', color: '#FF9A9D' }}>
          Reset
        </button>
      )}

      {abierto && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 300, width: 380,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
          boxShadow: '0 18px 44px rgba(23,21,17,.32)', padding: '10px 0', maxHeight: '70vh', overflowY: 'auto',
        }}>
          <div style={{ padding: '4px 14px 10px', fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5, borderBottom: '1px solid var(--border)' }}>
            Trae a <strong style={{ color: 'var(--ink)' }}>{cliente}</strong> solo la parte de Mau que necesites probar. «Quitar» elimina lo que se trajo, no lo que hayas creado tú.
          </div>
          {ambitos.map((a) => {
            const hecho = completados.includes(a.key);
            return (
              <div key={a.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', textTransform: 'capitalize' }}>{a.key}</div>
                  <div style={{ fontSize: 12, color: 'var(--faint)', lineHeight: 1.4 }}>{a.label}</div>
                </div>
                <button type="button" onClick={() => void correr('completar', a.key)} disabled={busy !== null}
                  style={{ flex: 'none', fontFamily: MONO, fontSize: 10.5, letterSpacing: '.05em', textTransform: 'uppercase', padding: '5px 10px', borderRadius: 7, border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--dim)', cursor: 'pointer' }}>
                  {busy === `completar:${a.key}` ? '…' : 'Traer'}
                </button>
                {hecho && (
                  <button type="button" onClick={() => void correr('eliminar', a.key)} disabled={busy !== null}
                    style={{ flex: 'none', fontFamily: MONO, fontSize: 10.5, letterSpacing: '.05em', textTransform: 'uppercase', padding: '5px 10px', borderRadius: 7, border: '1px solid var(--bad)', background: 'transparent', color: 'var(--bad)', cursor: 'pointer' }}>
                    {busy === `eliminar:${a.key}` ? '…' : 'Quitar'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
