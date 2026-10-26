'use client';

// =============================================================================
// Integraciones en el teléfono: las secciones de la computadora y la hoja de cada una (Ajustes › Cuentas de iOS)
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
  /** Va en «Conectadas»: conectada, o una IA que configura el equipo de MaKo. */
  conectada: boolean;
  /** Un incidente abierto de este servicio: se lee en su fila. */
  problema: { estado: string; rojo: boolean } | null;
  /** Una pasarela o una del Leads Scraper: al final de «Sin conectar». */
  opcional: boolean;
  enComputadora: string;
};
export type ProblemaM = { id: number; servicio: string; estado: string; detalle: string | null; rojo: boolean; confirmado: boolean; enCurso: boolean };

export function IntegracionesM({ conectadas, sinConectar, historial, abrir, suelta = null }: {
  conectadas: IntegracionM[]; sinConectar: IntegracionM[]; historial: ProblemaM[]; abrir: string | null;
  /** La que pidió el link y no es una fila (`oculto`: las cuatro IA y Google Calendar, 25/10/2026). No se dibuja en la
   *  lista: sólo abre su hoja. */
  suelta?: IntegracionM | null;
}) {
  const ws = useWs();
  // `?abrir=<key>` (el link de un aviso, «Conectar Meta») abre esa hoja de entrada, como el modal en la computadora.
  // También la de una sin fila (`suelta`): el link que MaKo manda por WhatsApp para conectar una IA o la agenda.
  const [abierta, setAbierta] = useState<IntegracionM | null>(() => [...conectadas, ...sinConectar].find((i) => i.key === abrir)
    ?? (suelta?.key === abrir ? suelta : null));
  const [problema, setProblema] = useState<ProblemaM | null>(null);

  if (!conectadas.length && !sinConectar.length && !suelta) return <VacioM frase="Tu plan no tiene integraciones para configurar." />;

  return (
    <>
      {/* Lo mismo que la computadora, en el mismo orden (24/10/2026): «Tus cuentas de IA» arriba —su casa es /m/cuenta/ia—,
          «Conectadas», «Sin conectar» y el «Historial de problemas». */}
      <ListaM>
        <FilaM titulo="Tus cuentas de IA" segunda="Tu Claude, tu GPT o tu Gemini" href="/perfil/ia" />
      </ListaM>
      {conectadas.length > 0 && (
        <SeccionM titulo="Conectadas">
          <ListaM>
            {conectadas.map((i) => (
              <FilaM key={i.key} titulo={i.nombre} segunda={i.problema ? i.categoria : i.soloServidor ? 'La configura el equipo de MaKo.' : i.categoria}
                pill={i.problema
                  ? <PildoraM tono={i.problema.rojo ? 'bad' : 'warn'}>{i.problema.estado}</PildoraM>
                  : i.estado === 'conectada' ? <PildoraM tono="good">Conectada</PildoraM> : undefined}
                onClick={() => setAbierta(i)} />
            ))}
          </ListaM>
        </SeccionM>
      )}
      {sinConectar.length > 0 && (
        <SeccionM titulo="Sin conectar">
          <ListaM>
            {sinConectar.map((i) => (
              <FilaM key={i.key} titulo={i.nombre} segunda={i.problema ? i.detalle : i.descripcion}
                pill={i.problema ? <PildoraM tono="warn">{i.problema.estado}</PildoraM> : undefined} onClick={() => setAbierta(i)} />
            ))}
          </ListaM>
        </SeccionM>
      )}
      {historial.length > 0 && (
        <SeccionM titulo="Historial de problemas">
          <ListaM>
            {historial.map((p) => (
              <FilaM key={p.id} titulo={p.servicio} segunda={p.detalle ?? p.estado}
                pill={<PildoraM tono={p.enCurso ? (p.rojo ? 'bad' : 'warn') : 'neutro'}>{p.enCurso ? (p.confirmado ? 'En curso' : 'No se pudo leer') : 'Resuelto'}</PildoraM>}
                onClick={() => setProblema(p)} />
            ))}
          </ListaM>
        </SeccionM>
      )}

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
              {/* «Falta configurar: ANTHROPIC_API_KEY» nombra la variable, no algo que el cliente reconozca (25/10/2026): no va. */}
              {abierta.estado === 'conectada' ? 'Conectada' : 'Falta conectarla'}{abierta.detalle && !abierta.detalle.startsWith('Falta configurar') ? ` · ${abierta.detalle}` : ''}
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
