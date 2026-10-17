'use client';

// =============================================================================
// Integraciones en el teléfono: la lista por categoría y la hoja de cada una (Ajustes › Cuentas de iOS)
// =============================================================================

import { useState } from 'react';
import { Button } from '@/app/_ui/Button';
import { useWs } from '@/app/_ui/Link';
import { FilaM, ListaM, PieM, PildoraM, SeccionM, SheetM, VacioM } from '@/app/m/_ui';
import { abrirEnComputadora } from '@/app/m/_ui/EnComputadoraM';

export type IntegracionM = {
  key: string; nombre: string; categoria: string; descripcion: string; estado: 'conectada' | 'falta'; detalle: string;
  paraQue: string | null;
  /** La configura el equipo de MaKo (una variable del servidor): el negocio no tiene nada que pegar. */
  soloServidor: boolean;
  enComputadora: string;
};
export type ProblemaM = { id: number; servicio: string; estado: string; detalle: string | null; rojo: boolean; confirmado: boolean };

export function IntegracionesM({ integraciones, problemas, abrir }: { integraciones: IntegracionM[]; problemas: ProblemaM[]; abrir: string | null }) {
  const ws = useWs();
  // `?abrir=<key>` (el link de un aviso, «Conectar Meta») abre esa hoja de entrada, como el modal en la computadora.
  const [abierta, setAbierta] = useState<IntegracionM | null>(() => integraciones.find((i) => i.key === abrir) ?? null);
  const [problema, setProblema] = useState<ProblemaM | null>(null);
  const categorias = [...new Set(integraciones.map((i) => i.categoria))];

  if (!integraciones.length) return <VacioM frase="Tu plan no tiene integraciones para configurar." />;

  return (
    <>
      {problemas.length > 0 && (
        <SeccionM titulo="Para resolver">
          <ListaM>
            {problemas.map((p) => (
              <FilaM key={p.id} icono="help" titulo={p.servicio} segunda={p.detalle ?? undefined}
                pill={<PildoraM tono={p.rojo ? 'bad' : 'warn'}>{p.confirmado ? p.estado : 'No se pudo leer'}</PildoraM>}
                onClick={() => setProblema(p)} />
            ))}
          </ListaM>
        </SeccionM>
      )}
      {categorias.map((c) => (
        <SeccionM key={c} titulo={c}>
          <ListaM>
            {integraciones.filter((i) => i.categoria === c).map((i) => (
              <FilaM key={i.key} titulo={i.nombre} segunda={i.detalle || undefined}
                pill={<PildoraM tono={i.estado === 'conectada' ? 'good' : 'warn'}>{i.estado === 'conectada' ? 'Conectada' : 'Falta'}</PildoraM>}
                onClick={() => setAbierta(i)} />
            ))}
          </ListaM>
        </SeccionM>
      ))}

      <SheetM id="integracion" abierto={abierta != null} onCerrar={() => setAbierta(null)} titulo={abierta?.nombre ?? ''}
        pie={abierta && !abierta.soloServidor ? (
          <PieM consecuencia="Conectar se hace en la computadora por ahora.">
            <Button variant={abierta.estado === 'falta' ? 'primary' : 'secondary'} size="lg" full onClick={() => abrirEnComputadora(abierta.enComputadora, ws)}>
              {abierta.estado === 'falta' ? 'Conectar en la computadora' : 'Abrir en la computadora'}
            </Button>
          </PieM>
        ) : undefined}>
        {abierta && (
          <>
            <p className="m-configuraciones-aviso" data-tono={abierta.estado === 'conectada' ? undefined : 'warn'}>
              {abierta.estado === 'conectada' ? 'Conectada' : 'Falta conectarla'}{abierta.detalle ? ` · ${abierta.detalle}` : ''}
            </p>
            <p className="m-configuraciones-texto">{abierta.descripcion}</p>
            {abierta.paraQue && <p className="m-configuraciones-texto m-configuraciones-texto--gris">{abierta.paraQue}</p>}
            {abierta.soloServidor && <p className="m-configuraciones-texto m-configuraciones-texto--gris">La configura el equipo de MaKo.</p>}
          </>
        )}
      </SheetM>

      <SheetM id="problema" abierto={problema != null} onCerrar={() => setProblema(null)} titulo={problema?.servicio ?? ''}>
        {problema && (
          <>
            <p className="m-configuraciones-aviso" data-tono={problema.rojo ? 'bad' : 'warn'}>{problema.estado}</p>
            {problema.detalle && <p className="m-configuraciones-texto">{problema.detalle}</p>}
            {!problema.confirmado && <p className="m-configuraciones-texto m-configuraciones-texto--gris">MaKo no pudo leer el estado: el problema puede ser la lectura y no la cuenta.</p>}
          </>
        )}
      </SheetM>
    </>
  );
}
