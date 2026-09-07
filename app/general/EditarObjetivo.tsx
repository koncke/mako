'use client';

// =============================================================================
// Los dos editores de la tira del Q: el objetivo y la capacidad instalada
// =============================================================================
// Son DOS cajas y no una con dos secciones, a propósito. El objetivo contesta
// «¿a dónde vamos?» y la capacidad «¿podemos entregarlo?»: son dos preguntas
// distintas, se tocan en momentos distintos, y juntarlas produce el formulario de
// seis campos que la regla de la casa —un paso por pantalla— viene a evitar.
//
// ⚠️ EL SANEO DE VERDAD ESTÁ EN LA SERVER ACTION, no acá. Lo de este archivo es
// comodidad de tipeo: un `<select>` no impide nada y el navegador manda lo que
// quiere. Ver el bloque de `guardarObjectiveAction`.
// =============================================================================

import { useState, useTransition } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Modal, Button, TextField, Select } from '@/app/_ui';
import { guardarObjectiveAction, cerrarObjectiveAction, setCapacidadAction } from './actions';
import type { MetricaObjetivo } from '@/lib/objectives-modelo';

const METRICAS: Array<{ value: MetricaObjetivo; label: string; hint: string }> = [
  { value: 'cash_usd', label: 'Cobrado (USD)', hint: 'Lo que efectivamente entró en el período.' },
  { value: 'sold_usd', label: 'Firmado (USD)', hint: 'Lo comprometido en contratos, aunque no esté cobrado.' },
  { value: 'cierres', label: 'Cierres', hint: 'Cuántos leads se ganaron.' },
  { value: 'agendas', label: 'Reuniones agendadas', hint: 'Cuántas R1 se reservaron.' },
  { value: 'leads', label: 'Leads nuevos', hint: 'Cuántos contactos entraron al CRM.' },
  { value: 'libre', label: 'Otra cosa (la mido yo)', hint: 'MaKo no puede leerla: el avance lo cargas tú.' },
];

const hintDe = (m: string) => METRICAS.find((x) => x.value === m)?.hint ?? '';

export function EditarObjetivo({ objetivo, anio, quarter, disparador }: {
  objetivo: { id: string; titulo: string; metrica: string; metaValor: number; quarter: number | null; avanceManual: number | null } | null;
  anio: number;
  quarter: number;
  disparador: React.ReactNode;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [pendiente, arrancar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [titulo, setTitulo] = useState(objetivo?.titulo ?? 'Facturación del trimestre');
  const [metrica, setMetrica] = useState(objetivo?.metrica ?? 'cash_usd');
  const [meta, setMeta] = useState(objetivo ? String(objetivo.metaValor) : '');
  const [anual, setAnual] = useState(objetivo ? objetivo.quarter === null : false);
  const [avance, setAvance] = useState(objetivo?.avanceManual != null ? String(objetivo.avanceManual) : '');

  const guardar = () => {
    setError(null);
    arrancar(async () => {
      try {
        await guardarObjectiveAction({
          id: objetivo?.id,
          anio,
          quarter: anual ? null : quarter,
          titulo,
          metrica,
          metaValor: Number(meta) || 0,
          avanceManual: metrica === 'libre' && avance !== '' ? Number(avance) : null,
        });
        setAbierto(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  const cerrar = () => {
    if (!objetivo) return;
    setError(null);
    arrancar(async () => {
      try {
        await cerrarObjectiveAction(objetivo.id);
        setAbierto(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  return (
    <>
      <span onClick={() => setAbierto(true)} role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAbierto(true); } }}
        style={{ cursor: 'pointer' }}>
        {disparador}
      </span>

      {abierto && (
        <Modal
          titulo={objetivo ? objetivo.titulo : 'Nuevo objetivo'}
          encabezado={anual ? `Año ${anio}` : `${anio} · Q${quarter}`}
          onCerrar={() => setAbierto(false)}
          pie={
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', width: '100%' }}>
              {objetivo && (
                // «Cerrar» y no «Borrar»: el objetivo de un trimestre pasado es
                // historia del negocio. Sale de la vista, no de la base.
                <Button variant="tertiary" onClick={cerrar} disabled={pendiente}>Cerrar este objetivo</Button>
              )}
              <span style={{ flex: 1 }} />
              <Button variant="secondary" onClick={() => setAbierto(false)} disabled={pendiente}>No guardar</Button>
              <Button onClick={guardar} loading={pendiente}>Guardar objetivo</Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <TextField label="Qué persigues" value={titulo} onChange={(e) => setTitulo(e.target.value)}
              placeholder="Facturación del trimestre" maxLength={80} />
            <Select label="Cómo se mide" value={metrica} onChange={setMetrica} hint={hintDe(metrica)}
              options={METRICAS.map((m) => ({ value: m.value, label: m.label }))} />
            <TextField label="Meta" value={meta} onChange={(e) => setMeta(e.target.value)}
              type="number" min="0" inputMode="decimal"
              prefix={metrica === 'cash_usd' || metrica === 'sold_usd' ? 'US$' : undefined} />
            {metrica === 'libre' && (
              <TextField label="Avance de hoy" value={avance} onChange={(e) => setAvance(e.target.value)}
                type="number" min="0" inputMode="decimal"
                hint="Como MaKo no puede leer esta métrica, el número lo pones tú." />
            )}
            <Select label="Período" value={anual ? 'anual' : 'q'} onChange={(v) => setAnual(v === 'anual')}
              options={[
                { value: 'q', label: `Este trimestre (Q${quarter} ${anio})` },
                { value: 'anual', label: `Todo el año ${anio}` },
              ]}
              hint="Un objetivo anual se sigue viendo dentro de cada trimestre." />
            {error && <span className="mk-err" role="alert">{error}</span>}
          </div>
        </Modal>
      )}
    </>
  );
}

export function EditarCapacidad({ cupo, mesesEntrega, disparador }: {
  cupo: number | null;
  mesesEntrega: number;
  disparador: React.ReactNode;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [pendiente, arrancar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [c, setC] = useState(cupo === null ? '' : String(cupo));
  const [m, setM] = useState(String(mesesEntrega));

  const guardar = () => {
    setError(null);
    arrancar(async () => {
      try {
        await setCapacidadAction(c, m);
        setAbierto(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  return (
    <>
      <span onClick={() => setAbierto(true)} role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAbierto(true); } }}
        style={{ cursor: 'pointer' }}>
        {disparador}
      </span>

      {abierto && (
        <Modal
          titulo="Capacidad instalada"
          onCerrar={() => setAbierto(false)}
          ancho={440}
          pie={
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', width: '100%' }}>
              <Button variant="secondary" onClick={() => setAbierto(false)} disabled={pendiente}>No guardar</Button>
              <Button onClick={guardar} loading={pendiente}>Guardar capacidad</Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <TextField label="¿A cuántos clientes puedes atender a la vez?" value={c}
              onChange={(e) => setC(e.target.value)} type="number" min="0" inputMode="numeric"
              hint="Los clientes activos no se preguntan: salen del CRM." />
            <TextField label="¿Cuántos meses dura tu entrega?" value={m}
              onChange={(e) => setM(e.target.value)} type="number" min="1" inputMode="numeric"
              hint="Es cuánto tiempo un cliente de pago único ocupa un lugar. Las suscripciones usan su propio plazo." />
            {error && <span className="mk-err" role="alert">{error}</span>}
          </div>
        </Modal>
      )}
    </>
  );
}
