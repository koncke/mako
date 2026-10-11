'use client';

// =============================================================================
// Generando — una tarjeta, dos pasos: el diagnóstico y la oferta nueva
// =============================================================================
// Un solo paso por pantalla: mientras MaKo arma la oferta no hay nada más que
// hacer, así que no se muestra nada más. Los dos pasos se tildan a medida que
// terminan (es progreso REAL: cada uno es una llamada distinta), y si uno falla
// se reintenta DESDE ESE paso — un diagnóstico que ya salió no se vuelve a pagar.
//
// ⚠️ «Reintentar» nombra su objeto («Reintentar el diagnóstico»): un «Reintentar»
// a secas no dice qué se va a volver a hacer (app/_ui/Estados.tsx, ErrorState).

import { Button, Spinner } from '@/app/_ui';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import { MakoLoader } from '@/app/_components/MakoLoader';

export type PasoGeneracion = 'diagnostico' | 'oferta' | 'listo';

type EstadoPaso = 'pendiente' | 'activo' | 'hecho' | 'fallo';

function Marca({ estado }: { estado: EstadoPaso }) {
  const caja = { flex: 'none' as const, width: 26, height: 26, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' as const };
  if (estado === 'activo') return <span style={{ ...caja, color: 'var(--mako-ink)' }}><Spinner size={18} /></span>;
  if (estado === 'hecho') return <span aria-hidden style={{ ...caja, background: 'var(--good-bg)', border: '1.5px solid var(--good)', color: 'var(--good)' }}><IconoMenu nombre="check" size={15} /></span>;
  if (estado === 'fallo') return <span aria-hidden style={{ ...caja, background: 'var(--bad-bg)', border: '1.5px solid var(--bad)', color: 'var(--bad)' }}><IconoMenu nombre="cerrar" size={13} /></span>;
  return <span aria-hidden style={{ ...caja, border: '2px solid var(--border-strong)' }} />;
}

function Paso({ label, estado }: { label: string; estado: EstadoPaso }) {
  return (
    <li style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 'var(--fs-card)', fontWeight: estado === 'pendiente' ? 500 : 600, color: estado === 'pendiente' ? 'var(--faint)' : 'var(--ink)' }}>
      <Marca estado={estado} />
      <span>{label}</span>
    </li>
  );
}

export function Generando({ paso, corriendo, error, onReintentar, onVolver }: {
  /** El paso en curso (o el que falló). */
  paso: PasoGeneracion;
  corriendo: boolean;
  error: string | null;
  onReintentar: () => void;
  onVolver: () => void;
}) {
  const fallo = !!error && !corriendo;
  const estadoDiag: EstadoPaso = paso === 'diagnostico' ? (fallo ? 'fallo' : 'activo') : 'hecho';
  const estadoOferta: EstadoPaso = paso === 'oferta' ? (fallo ? 'fallo' : 'activo') : paso === 'listo' ? 'hecho' : 'pendiente';

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 4px 24px' }}>
      <div role="status" aria-live="polite" style={{
        width: '100%', maxWidth: 460, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24,
        padding: '36px 32px 32px', borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border)',
      }}>
        {!fallo && <MakoLoader width={132} gold="var(--mako)" />}
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 16, alignSelf: 'stretch', paddingInline: 'clamp(0px, 6vw, 40px)' }}>
          <Paso label="Diagnóstico" estado={estadoDiag} />
          <Paso label="Oferta nueva" estado={estadoOferta} />
        </ol>
        {!fallo && (
          <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--dim)', textAlign: 'center' }}>Puede tardar unos minutos.</p>
        )}
        {fallo && (
          <>
            <p role="alert" style={{ margin: 0, fontSize: 'var(--fs-md)', lineHeight: 1.45, color: 'var(--bad)', textAlign: 'center' }}>{error}</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Button variant="primary" onClick={onReintentar}>
                {paso === 'oferta' ? 'Reintentar la oferta' : 'Reintentar el diagnóstico'}
              </Button>
              <Button variant="tertiary" onClick={onVolver}>Volver al chat</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
