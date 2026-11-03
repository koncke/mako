'use client';

// =============================================================================
// PermisoIaM — el permiso para la IA de terceros, en la app de iPhone (Apple 5.1.2(i), 3/11/2026)
// =============================================================================
// Referencia: el aviso de permisos de iOS, una hoja con qué se comparte y dos botones del mismo tamaño. Lo que la hoja nombra es lo que
// pide la guía: «with third-party AI», con los nombres. Sale UNA vez por persona (lib/ia-permiso-reglas.ts); «Ahora no» deja la
// app andando y se cambia en Tu cuenta › IA de terceros. Fuera de la app de iPhone no se dibuja.
// =============================================================================

import { useEffect, useState } from 'react';
import { Button } from '@/app/_ui/Button';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { ROTULO_FILA_IA, TEXTO_PERMISO_IA, type DecisionIa } from '@/lib/ia-permiso-reglas';
import { FilaM } from './FilaM';
import { PieM } from './Piezas';
import { SheetM } from './SheetM';
import { useShellM } from './contexto';

async function mandar(decision: DecisionIa): Promise<boolean> {
  try {
    const j = await (await fetch('/api/ia-permiso', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ decision }) })).json();
    return j?.ok === true;
  } catch { return false; }
}

function HojaPermisoIa({ abierta, onCerrar, onDecidir }: { abierta: boolean; onCerrar: () => void; onDecidir: (permitido: boolean) => void }) {
  const [ocupado, setOcupado] = useState<DecisionIa | null>(null);
  const [mal, setMal] = useState(false);
  const decidir = async (d: DecisionIa) => {
    setOcupado(d); setMal(false);
    const ok = await mandar(d);
    setOcupado(null);
    if (!ok) { setMal(true); return; }
    onDecidir(d === 'si');
    onCerrar();
  };
  return (
    <SheetM id="permiso-ia" abierto={abierta} onCerrar={onCerrar} ocupado={ocupado != null} titulo={TEXTO_PERMISO_IA.titulo} rotuloCerrar={TEXTO_PERMISO_IA.no}
      pie={(
        <PieM consecuencia={TEXTO_PERMISO_IA.despues}>
          <Button variant="primary" size="lg" full loading={ocupado === 'si'} disabled={ocupado != null} onClick={() => { void decidir('si'); }}>{TEXTO_PERMISO_IA.si}</Button>
          <Button variant="tertiary" size="lg" full loading={ocupado === 'no'} disabled={ocupado != null} onClick={() => { void decidir('no'); }}>{TEXTO_PERMISO_IA.no}</Button>
        </PieM>
      )}>
      <div className="m-permiso-ia">
        <p>{TEXTO_PERMISO_IA.que}</p>
        <p>{TEXTO_PERMISO_IA.quienes}</p>
        {mal && <p role="alert" className="m-permiso-ia__mal">No se guardó. Prueba otra vez.<ReportarASoporte /></p>}
      </div>
    </SheetM>
  );
}

/** Va en el shell: pregunta al abrir, si nunca se preguntó. */
export function PermisoIaM() {
  const { appIos } = useShellM();
  const [abierta, setAbierta] = useState(false);
  useEffect(() => {
    if (!appIos) return;
    let vivo = true;
    fetch('/api/ia-permiso', { cache: 'no-store' }).then((r) => r.json()).then((j) => { if (vivo && j?.ok && j.preguntar) setAbierta(true); }).catch(() => {});
    return () => { vivo = false; };
  }, [appIos]);
  if (!appIos) return null;
  return <HojaPermisoIa abierta={abierta} onCerrar={() => setAbierta(false)} onDecidir={() => {}} />;
}

/** La fila de Tu cuenta: para cambiarlo cuando quiera (Apple pide que se pueda retirar). */
export function FilaPermisoIaM() {
  const { appIos } = useShellM();
  const [abierta, setAbierta] = useState(false);
  const [permitido, setPermitido] = useState<boolean | null>(null);
  useEffect(() => {
    if (!appIos) return;
    let vivo = true;
    fetch('/api/ia-permiso', { cache: 'no-store' }).then((r) => r.json()).then((j) => { if (vivo && j?.ok) setPermitido(j.permitido === true); }).catch(() => {});
    return () => { vivo = false; };
  }, [appIos]);
  if (!appIos) return null;
  return (
    <>
      <FilaM navegacion titulo={ROTULO_FILA_IA} riel={permitido == null ? undefined : permitido ? 'Permitida' : 'Apagada'} onClick={() => setAbierta(true)} />
      <HojaPermisoIa abierta={abierta} onCerrar={() => setAbierta(false)} onDecidir={setPermitido} />
    </>
  );
}
