'use client';

// =============================================================================
// Client Agents en el teléfono: el feed de sesiones y la hoja de cada una (Linear e Intercom en el celular)
// =============================================================================
// Los números de arriba son los de la computadora. «redacciones» es la alarma y no una estadística: si sube, el filtro
// de «sólo turnos humanos» está dejando pasar cosas, y se ve en ámbar.
// =============================================================================

import { useState } from 'react';
import { FilaDatoM, FilaM, ListaM, PildoraM, SeccionM, SheetM } from '@/app/m/_ui';

export type SesionM = {
  id: number; cliente: string; cuando: string; titulo: string | null; resumen: string | null; redacciones: number;
  turnos: string[]; masTurnos: number;
};

const cuando = (iso: string) => new Date(iso).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export function AgenteM({ sesiones, resumen }: { sesiones: SesionM[]; resumen: { sesiones: number; clientes: number; mensajes: number; redacciones: number } }) {
  const [abierta, setAbierta] = useState<SesionM | null>(null);
  return (
    <>
      <ListaM>
        <FilaDatoM k="Sesiones" v={String(resumen.sesiones)} />
        <FilaDatoM k="Clientes" v={String(resumen.clientes)} />
        <FilaDatoM k="Mensajes" v={String(resumen.mensajes)} />
        <FilaM titulo="Redacciones" riel={<span className="m-num">{resumen.redacciones}</span>}
          pill={resumen.redacciones > 0 ? <PildoraM tono="warn">Revisar el filtro</PildoraM> : undefined} />
      </ListaM>
      <SeccionM titulo="Lo más nuevo">
        <ListaM>
          {sesiones.map((s) => (
            <FilaM key={s.id} titulo={s.cliente} segunda={s.titulo ?? s.turnos[0] ?? 'Sin título'} riel={<span className="m-agente-cuando">{cuando(s.cuando)}</span>}
              pill={s.redacciones > 0 ? <PildoraM tono="warn">{`${s.redacciones} ${s.redacciones === 1 ? 'redacción' : 'redacciones'}`}</PildoraM> : undefined}
              onClick={() => setAbierta(s)} />
          ))}
        </ListaM>
      </SeccionM>
      <SheetM id="sesion" abierto={abierta != null} onCerrar={() => setAbierta(null)} titulo={abierta?.cliente ?? ''} snap="alto">
        {abierta && (
          <>
            {abierta.titulo && <p className="m-agente-titulo">{abierta.titulo}</p>}
            {abierta.resumen && <p className="m-agente-resumen">{abierta.resumen}</p>}
            {abierta.turnos.length > 0 && (
              <ol className="m-agente-turnos">
                {abierta.turnos.map((t, i) => <li key={i}>{t}</li>)}
                {abierta.masTurnos > 0 && <li className="m-agente-mas">{`y ${abierta.masTurnos} mensajes más`}</li>}
              </ol>
            )}
          </>
        )}
      </SheetM>
    </>
  );
}
