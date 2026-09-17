'use client';

// =============================================================================
// BandejaPendientes — cada pendiente es una fila de MaKo en «Aprobación pendiente»
// =============================================================================
// Se usa la pieza <Mako estado="aprobacion"> de app/_ui, que es lo único que
// MaKo pone en una lista: la fila cerrada muestra el resumen y la consecuencia
// (qué escribe · si se deshace), y la segunda capa trae el detalle, lo que se
// va a ejecutar y los DOS botones. Nadie decide sin abrir.
//
// El cliente recibe datos PLANOS: acá no se importa el registro ni las defs
// (tests/api-mako-registro.test.ts lo prohíbe en un 'use client').
// =============================================================================

import { useState } from 'react';
import { EmptyState, Mako, Status, type DatoMako } from '@/app/_ui';
import { confirmarPendienteAction, cancelarPendienteAction } from './acciones';

export type FilaPendiente = {
  id: number;
  resumen: string;
  /** «vino por WhatsApp» / «vino del chat de la app» / «vino por la API» */
  origen: string;
  /** el título humano de la operación (o el slug, si ya no existe) */
  operacion: string;
  /** qué escribe y dónde, según la definición. null si la operación ya no existe */
  escribe: string | null;
  /** null = no se sabe (la operación ya no está en el registro) */
  reversible: boolean | null;
  /** «16 sep, 18:40 (en 42 min)», en la zona del workspace */
  vence: string;
  creada: string;
  payload: Record<string, unknown>;
};

type Marca =
  | { fase: 'confirmando' }
  | { fase: 'cancelando' }
  | { fase: 'hecha'; resumen: string }
  | { fase: 'cancelada'; resumen: string }
  | { fase: 'error'; error: string };

const MAX_VALOR = 240;

/** Un valor del payload, legible. Lo largo se corta: es para reconocer qué se
 *  va a ejecutar, no para auditarlo byte a byte. */
function valorLegible(v: unknown): string {
  if (v == null) return '—';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > MAX_VALOR ? `${s.slice(0, MAX_VALOR)}…` : s;
}

function LoQueSeEjecuta({ payload }: { payload: Record<string, unknown> }) {
  const entradas = Object.entries(payload);
  if (!entradas.length) return <span>Sin datos adicionales: se ejecuta tal como dice el resumen.</span>;
  return (
    <>
      {entradas.map(([k, v]) => (
        <span key={k}>
          <span style={{ fontWeight: 600 }}>{k}</span>: {valorLegible(v)}
        </span>
      ))}
    </>
  );
}

/** La fila cuando ya no hay nada que decidir (cancelada o falló). Misma anatomía
 *  que la fila de MaKo, sin marca dorada: acá ya no interviene la inteligencia. */
function FilaCerrada({ titulo, estado, tono, texto }: { titulo: string; estado: string; tono: 'neutral' | 'bad'; texto: string }) {
  return (
    <div className="mk-fila" role="status">
      <span className="mk-mako__marca" aria-hidden>
        <span className="mk-dot" style={{ background: tono === 'bad' ? 'var(--bad)' : 'var(--faint)' }} />
      </span>
      <span className="mk-fila__txt">
        <span className="mk-fila__l1">
          <span className="mk-fila__t">{titulo}</span>
          <Status tono={tono}>{estado}</Status>
        </span>
        <span className="mk-fila__c">{texto}</span>
      </span>
    </div>
  );
}

export function BandejaPendientes({ filas }: { filas: FilaPendiente[] }) {
  const [marcas, setMarcas] = useState<Record<number, Marca>>({});
  const marcar = (id: number, m: Marca) => setMarcas((prev) => ({ ...prev, [id]: m }));

  const confirmar = async (f: FilaPendiente) => {
    if (marcas[f.id]) return;
    marcar(f.id, { fase: 'confirmando' });
    const r = await confirmarPendienteAction(f.id);
    marcar(f.id, r.ok ? { fase: 'hecha', resumen: r.resumen } : { fase: 'error', error: r.error });
  };

  const cancelar = async (f: FilaPendiente) => {
    if (marcas[f.id]) return;
    marcar(f.id, { fase: 'cancelando' });
    const r = await cancelarPendienteAction(f.id);
    marcar(f.id, r.ok ? { fase: 'cancelada', resumen: r.resumen } : { fase: 'error', error: r.error });
  };

  if (!filas.length) {
    return (
      <EmptyState
        titulo="No hay acciones esperando confirmación"
        detalle="Cuando MaKo proponga algo por WhatsApp, por el chat o por la API, queda aquí hasta que lo confirmes, lo canceles o venza."
      />
    );
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', background: 'var(--surface)', overflow: 'hidden' }}>
      {filas.map((f) => {
        const m = marcas[f.id];
        if (m?.fase === 'hecha') {
          return (
            <Mako
              key={`${f.id}:hecha`}
              estado="completo"
              titulo={f.resumen}
              detalle={m.resumen}
              datos={[{ k: 'Resultado', v: m.resumen }, { k: 'Operación', v: f.operacion }]}
              cuando="recién"
            />
          );
        }
        if (m?.fase === 'cancelada') return <FilaCerrada key={`${f.id}:cancelada`} titulo={f.resumen} estado="Cancelada" tono="neutral" texto={m.resumen} />;
        if (m?.fase === 'error') return <FilaCerrada key={`${f.id}:error`} titulo={f.resumen} estado="No se pudo" tono="bad" texto={m.error} />;

        const enCurso = m?.fase === 'confirmando' || m?.fase === 'cancelando';
        const deshace = f.reversible === false ? 'no se puede deshacer' : f.reversible ? 'se puede deshacer' : null;
        const consecuencia = [f.escribe ?? `Operación: ${f.operacion}`, deshace].filter(Boolean).join(' · ');
        const datos: DatoMako[] = [
          { k: 'Operación', v: f.operacion },
          { k: 'De dónde vino', v: f.origen },
          { k: 'Propuesta', v: f.creada },
          { k: 'Vence', v: f.vence },
        ];
        // La misma key mientras se decide y mientras se ejecuta: el modal sigue
        // abierto con el botón en «Confirmando…». Al resolverse cambia la key,
        // la fila se vuelve a montar cerrada y muestra el resultado en la lista.
        return (
          <Mako
            key={`${f.id}:abierta`}
            estado="aprobacion"
            titulo={f.resumen}
            consecuencia={consecuencia}
            datos={datos}
            evidencia={<LoQueSeEjecuta payload={f.payload} />}
            evidenciaRotulo="Lo que se va a ejecutar"
            advertencia={
              f.reversible === false
                ? 'Esta acción no se puede deshacer una vez ejecutada.'
                : f.reversible
                  ? 'Esta acción se puede deshacer después desde su tab.'
                  : 'La operación ya no está en el registro de MaKo: al confirmar puede fallar.'
            }
            cuando={`vence ${f.vence}`}
            accion={{
              label: m?.fase === 'confirmando' ? 'Ejecutando…' : 'Confirmar y ejecutar',
              onClick: () => { if (!enCurso) void confirmar(f); },
            }}
            secundaria={
              enCurso
                ? undefined
                : { label: 'No ejecutar', onClick: () => { void cancelar(f); } }
            }
          />
        );
      })}
    </div>
  );
}
