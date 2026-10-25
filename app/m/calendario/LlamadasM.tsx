'use client';

// =============================================================================
// LlamadasM — «Llamadas» del Calendario en el teléfono (25/10/2026)
// =============================================================================
// DESTILA la de la computadora (app/calendario/ListaLlamadas.tsx, copiada del «Appointment List View» de HighLevel): las
// mismas pestañas (Próximas · Pasadas · Canceladas, con su número), el mismo estado de cada llamada y las mismas tareas del
// Plan con fecha, con las piezas del teléfono (`FilaM`, `PildoraM`, `SegmentadoM`). Se entra por el MISMO selector de
// vistas del Calendario (Día · Agenda · Llamadas) y se sale por él. Lo puro (estado, pestañas, «Hoy/Mañana») sale de
// lib/calendario-llamadas.ts; los datos, de la misma lectura que la computadora (`leerLlamadasDeVenta`).
//
// Marcar la asistencia, en el teléfono, se hace en la ficha del lead (tocar la fila la abre): un desplegable en una fila
// de 44 px no se toca bien, y la ficha ya lo tiene con su «Deshacer».
// =============================================================================

import { useMemo, useState } from 'react';
import { CabeceraM, FilaM, ListaM, PildoraM, SeccionM, SegmentadoM, VacioM } from '@/app/m/_ui';
import { diaDe, horaDe, horaGoogle, type ItemCalendario } from '@/lib/calendario-modelo';
import {
  PESTANAS_LLAMADAS, TEXTO_ESTADO_LLAMADA, TONO_ESTADO_LLAMADA, estadoDeLlamada, llamadasDeLaPestana, rotuloDelDia,
  type LlamadaDeVenta, type PestanaLlamadas,
} from '@/lib/calendario-llamadas';
import { VISTAS_M } from './modelo';

export function LlamadasM({ llamadas, tareas, hoy, tz, ahora, fallos }: {
  llamadas: readonly LlamadaDeVenta[];
  tareas: readonly ItemCalendario[];
  hoy: string;
  tz: string;
  ahora: string;
  fallos: { llamadas?: boolean; tareas?: boolean };
}) {
  const [pestana, setPestana] = useState<PestanaLlamadas>('proximas');
  // El número azul del teléfono va sólo en lo que espera algo (app/m/_ui, `SegmentadoM`): las pasadas sin marcar.
  const sinMarcar = useMemo(() => llamadasDeLaPestana(llamadas, 'pasadas', ahora).filter((l) => estadoDeLlamada(l, ahora) === 'sin-marcar').length, [llamadas, ahora]);
  const filas = useMemo(() => llamadasDeLaPestana(llamadas, pestana, ahora), [llamadas, pestana, ahora]);
  const proximasTareas = useMemo(() => [...tareas].sort((a, b) => a.inicio.localeCompare(b.inicio)), [tareas]);
  return (
    <div className="m-calendario">
      <CabeceraM />
      <div className="m-calendario-seg">
        <SegmentadoM etiqueta="Vista" valor="llamadas"
          opciones={[...VISTAS_M.map((v) => ({ id: v.id as string, label: v.label, href: `/calendario?vista=${v.id}` })), { id: 'llamadas', label: 'Llamadas' }]} />
      </div>
      <div className="m-calendario-seg">
        <SegmentadoM etiqueta="Qué llamadas" valor={pestana} onCambio={setPestana}
          opciones={PESTANAS_LLAMADAS.map((p) => ({ id: p.id, label: p.nombre, n: p.id === 'pasadas' ? sinMarcar || null : null }))} />
      </div>
      {fallos.llamadas && <VacioM frase="No pudimos leer las llamadas del CRM. Prueba otra vez en un minuto." />}
      {!fallos.llamadas && filas.length === 0
        ? <VacioM frase={pestana === 'proximas' ? 'No tienes llamadas agendadas. Cuando un lead agende su R1 o su R2, aparece aquí.' : pestana === 'pasadas' ? 'Todavía no hay llamadas pasadas.' : 'Ninguna cancelada.'} />
        : (
          <ListaM etiqueta="Llamadas de venta">
            {filas.map((l) => {
              const estado = estadoDeLlamada(l, ahora);
              const cuando = `${rotuloDelDia(diaDe(l.inicio, tz), hoy)}${l.diaCompleto ? '' : `, ${horaGoogle(horaDe(l.inicio, tz))}`}`;
              return (
                <FilaM key={l.id} avatar={l.nombre} titulo={l.nombre} href={`/crm/${l.leadId}`}
                  segunda={[l.cual, cuando, l.closer].filter(Boolean).join(' · ')}
                  pill={<PildoraM tono={TONO_ESTADO_LLAMADA[estado]}>{TEXTO_ESTADO_LLAMADA[estado]}</PildoraM>} />
              );
            })}
          </ListaM>
        )}
      <SeccionM titulo="Tareas con fecha">
        {fallos.tareas
          ? <VacioM frase="No pudimos leer el Plan." />
          : proximasTareas.length === 0
            ? <VacioM frase="Nada por vencer. Las tareas del Plan con fecha aparecen aquí." />
            : (
              <ListaM etiqueta="Tareas con fecha">
                {proximasTareas.map((t) => {
                  const dia = diaDe(t.inicio, tz);
                  return (
                    <FilaM key={t.id} titulo={t.titulo} href={t.href ?? '/plan'}
                      segunda={[dia < hoy ? `Venció: ${rotuloDelDia(dia, hoy).toLowerCase()}` : rotuloDelDia(dia, hoy), t.detalle].filter(Boolean).join(' · ')}
                      pill={dia < hoy ? <PildoraM tono="bad">Vencida</PildoraM> : undefined} />
                  );
                })}
              </ListaM>
            )}
      </SeccionM>
    </div>
  );
}
