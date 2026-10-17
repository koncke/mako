'use client';

// =============================================================================
// MonedaNegocioPanel — la moneda en que cobra el negocio (17/10/2026)
// =============================================================================
// La moneda del negocio existe desde la tanda B del CRM (`app_settings` 'negocio.moneda', lib/pagos.ts) y sólo se podía
// cambiar pidiéndoselo a MaKo (`cambiar_moneda_negocio`). Es el valor inicial con que la ficha pide un pago a mano; no
// toca lo ya cobrado. La cambia sólo el admin (la acción lo corta igual: esto sólo no ofrece lo que no puede).

import { useEffect, useState, useTransition } from 'react';
import { Select } from '@/app/_ui/Select';
import { GrupoAjustes, CuerpoGrupo } from '@/app/_ui/Ajustes';
import { guardarMonedaNegocioAction, monedaDelNegocioAction } from '@/app/crm/[id]/pagos-campo-actions';

/** Las monedas de los países donde vende MaKo, y las dos de referencia. Otra, por MaKo. */
const MONEDAS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'USD', label: 'USD · Dólar estadounidense' },
  { value: 'MXN', label: 'MXN · Peso mexicano' },
  { value: 'ARS', label: 'ARS · Peso argentino' },
  { value: 'COP', label: 'COP · Peso colombiano' },
  { value: 'CLP', label: 'CLP · Peso chileno' },
  { value: 'PEN', label: 'PEN · Sol peruano' },
  { value: 'UYU', label: 'UYU · Peso uruguayo' },
  { value: 'BRL', label: 'BRL · Real brasileño' },
  { value: 'EUR', label: 'EUR · Euro' },
];

export function MonedaNegocioPanel() {
  const [moneda, setMoneda] = useState<string | null>(null);
  const [puedeEditar, setPuedeEditar] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let vivo = true;
    monedaDelNegocioAction().then((r) => { if (vivo) { setMoneda(r.moneda); setPuedeEditar(r.puedeEditar); } }).catch(() => { if (vivo) setMoneda('USD'); });
    return () => { vivo = false; };
  }, []);

  const opciones = moneda && !MONEDAS.some((m) => m.value === moneda) ? [{ value: moneda, label: `${moneda} (actual)` }, ...MONEDAS] : MONEDAS;

  const cambiar = (nueva: string) => {
    if (!nueva || nueva === moneda) return;
    const antes = moneda;
    setMoneda(nueva);
    setAviso(null);
    start(async () => {
      const r = await guardarMonedaNegocioAction(nueva);
      if (r.ok) setAviso({ ok: true, texto: 'Moneda guardada' });
      else { setMoneda(antes); setAviso({ ok: false, texto: r.error }); }
    });
  };

  return (
    <GrupoAjustes titulo="Moneda del negocio" descripcion="La que se propone al registrar un pago. Lo ya cobrado no cambia.">
      <CuerpoGrupo>
        <Select ariaLabel="Moneda del negocio" value={moneda ?? ''} onChange={cambiar} options={[...opciones]}
          placeholder="Cargando…" disabled={moneda == null || !puedeEditar || pending} width={320} search />
        {!puedeEditar && moneda != null && <p className="aj-texto" style={{ margin: '8px 0 0' }}>La cambia quien administra el negocio.</p>}
        {aviso && <p className="aj-texto" role="status" style={{ margin: '8px 0 0', color: aviso.ok ? 'var(--good)' : 'var(--bad)' }}>{aviso.texto}</p>}
      </CuerpoGrupo>
    </GrupoAjustes>
  );
}
