'use client';

// =============================================================================
// Approvals en el teléfono: una fila por aprobación y la hoja de cada una (5/11/2026)
// =============================================================================
// Copiado de la lista de deploys de la app de Vercel en el celular: el nombre, el estado en una pastilla y cuánto hace, y el
// detalle en una hoja. Los textos y el orden salen de lib/vigia-aprobaciones.ts (`listaDeAprobaciones`): los mismos que la
// computadora y que la API de MaKo.
// =============================================================================

import { useState } from 'react';
import { ButtonLink } from '@/app/_ui/Button';
import { haceTxtCorto } from '@/lib/admin-errores-reglas';
import type { FilaLista, TonoFila } from '@/lib/vigia-aprobaciones';
import { FilaDatoM, FilaM, ListaM, PieM, PildoraM, SheetM, type TonoPildora } from '@/app/m/_ui';
import { FilaEnComputadoraM } from '@/app/m/_ui/EnComputadoraM';

const TONO: Record<TonoFila, TonoPildora> = { bad: 'bad', warn: 'warn', info: 'info', neutral: 'neutro', good: 'good' };

export function ApprovalsM({ filas, ahoraMs }: { filas: readonly FilaLista[]; ahoraMs: number }) {
  const [abierta, setAbierta] = useState<FilaLista | null>(null);
  const conClave = filas.some((f) => f.falta.some((x) => x.integracion));
  return (
    <>
      <ListaM>
        {filas.map((f) => (
          <FilaM key={f.id} titulo={f.nombre}
            segunda={f.leido ? `Leído ${haceTxtCorto(f.leido, ahoraMs)}${f.viejo ? ' (viejo)' : ''}` : 'Sin leer todavía'}
            pill={<PildoraM tono={TONO[f.tono]}>{f.estadoCorto}</PildoraM>} onClick={() => setAbierta(f)} />
        ))}
      </ListaM>
      {conClave && (
        <ListaM>
          <FilaEnComputadoraM icono="integraciones" titulo="Cargar una clave" href="/admin/approvals"
            motivo="Es pegar el archivo que baja Apple o Google: se hace en la computadora, con el botón «Cargarla» de cada fila." />
        </ListaM>
      )}
      <SheetM id="aprobacion" abierto={abierta != null} onCerrar={() => setAbierta(null)} titulo={abierta?.nombre ?? ''}
        pie={abierta ? (
          <PieM consecuencia="Se abre el panel de la plataforma, con tu sesión.">
            <ButtonLink href={abierta.link} variant="primary" size="lg" full newTab>Abrir el panel</ButtonLink>
          </PieM>
        ) : undefined}>
        {abierta && (
          <ListaM>
            <FilaDatoM k="Estado" v={abierta.estadoCorto} />
            {abierta.version && <FilaDatoM k="Versión" v={abierta.version} />}
            {abierta.desde && <FilaDatoM k="Desde" v={haceTxtCorto(abierta.desde, ahoraMs)} />}
            <FilaDatoM k="Leído" v={abierta.leido ? `${haceTxtCorto(abierta.leido, ahoraMs)}${abierta.viejo ? ' (viejo)' : ''}` : 'Todavía no'} />
            {abierta.detalle && <FilaDatoM k="Detalle" v={abierta.detalle} />}
            {abierta.queHacer && <FilaDatoM k="Qué hacer" v={abierta.queHacer} />}
            {abierta.motivo && <FilaDatoM k="No pude leerlo" v={abierta.motivo} />}
            {abierta.falta.map((x) => <FilaDatoM key={x.texto} k="Falta" v={x.texto} />)}
            {abierta.nota && <FilaDatoM k="Nota" v={abierta.nota} />}
          </ListaM>
        )}
      </SheetM>
    </>
  );
}
