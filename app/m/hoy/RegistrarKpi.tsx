'use client';

// =============================================================================
// Today — registrar el valor de un KPI MANUAL en el lugar (sin ir a /general)
// =============================================================================
// Reusa `registrarKpiAction` de app/general/actions.ts tal cual: el día lo pone el server
// (`hoyEnWorkspace`), no el teléfono. Su `bust()` sólo revalida /general, así que después
// se hace `router.refresh()` (el de app/_ui/Link: conserva el `?ws=`).
// =============================================================================

import { useState, useTransition } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Button } from '@/app/_ui/Button';
import { useConexion, useToastM } from '@/app/m/_ui';
import { haptico } from '@/lib/haptico';
import { registrarKpiAction } from '@/app/general/actions';

export function RegistrarKpi({ kpiId, cadencia, nombre }: { kpiId: string; cadencia: string; nombre: string }) {
  const router = useRouter();
  const toast = useToastM();
  const { enLinea } = useConexion();
  const [abierto, setAbierto] = useState(false);
  const [valor, setValor] = useState('');
  const [ocupado, empezar] = useTransition();

  if (!abierto) {
    return (
      <Button variant="secondary" size="md" onClick={() => setAbierto(true)} disabled={!enLinea}>
        {enLinea ? 'Registrar valor' : 'Sin conexión'}
      </Button>
    );
  }

  const n = Number(valor.replace(',', '.'));
  const valido = valor.trim() !== '' && Number.isFinite(n) && n >= 0;

  const guardar = () => {
    if (!valido || !enLinea) return;
    empezar(async () => {
      try {
        await registrarKpiAction(kpiId, cadencia, n);
        haptico('success');
        toast('Valor registrado');
        setAbierto(false);
        setValor('');
        router.refresh();
      } catch {
        haptico('error');
        toast('No se pudo guardar');
      }
    });
  };

  return (
    <form className="m-hoy-registrar" onSubmit={(e) => { e.preventDefault(); guardar(); }}>
      <input
        className="m-hoy-registrar__campo"
        inputMode="decimal"
        aria-label={`Valor de «${nombre}»`}
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        disabled={ocupado}
      />
      <Button type="submit" variant="primary" size="md" loading={ocupado} disabled={!valido || !enLinea}>
        Guardar valor
      </Button>
    </form>
  );
}
