'use client';

// =============================================================================
// FichaDeEjemplo — «Elegir qué datos te avisa MaKo» con un lead de EJEMPLO (el engranaje de «A revisar»)
// =============================================================================
// Martín, 16/10/2026 (punto 6): «"Elegir qué datos te avisa MaKo"... debería abrirme el detalle de un lead "ficticio" con
// el desplegable de "Datos sin marcar" abierto, y dentro de ese otro desplegable el botón de Basura rojo, y cuando le doy
// me pregunta ¿Ignorar siempre? y si le doy que sí, se desmarca de obligatorio ese bloque».
//
// El engranaje abre la ficha del PRIMER lead de la lista (uno de verdad, app/_components/MakoConfirmGate.tsx). Esto es
// para cuando no hay ninguno: la cabecera de la casa (`CabeceraDetalle`, la de toda ficha) con «Lead de ejemplo», y el
// MISMO «Datos sin marcar» de la ficha (./DatosSinMarcarCard.tsx) ABIERTO, con TODO lo que MaKo avisa hoy en el CRM
// principal. El basurero pregunta «¿Ignorar siempre?» y el sí apaga ese aviso en el funnel: el mismo `op: 'aviso'` que
// «Obligatorio» en la barra del bloque. Reemplaza al modal de interruptores (AvisosDatosModal), que se borró.
//
// ⚠️ NINGÚN DATO INVENTADO SE GUARDA: el lead de ejemplo no existe (no tiene id) y lo único que escribe es el aviso del
//    funnel. Lo que se ignora «sólo en este lead» no aplica: con `ignorarSiempre`, el «No» sólo cierra la pregunta.
// ⚠️ EL CRM ES EL PRINCIPAL (`funnelId: null`): «A revisar» mezcla funnels, y el principal es el respaldo de todos.
// =============================================================================

import { useEffect, useState } from 'react';
import { Modal } from '@/app/_ui/Modal';
import { CabeceraDetalle } from '@/app/_components/CabeceraDetalle';
import type { EstadoDatos } from '@/lib/datos-aviso';
import { leerFichaFunnelAction } from '../ficha-actions';
import { DatosSinMarcarCard } from './DatosSinMarcarCard';

/** Lo que avisa hoy el funnel, como los «datos sin marcar» de un lead al que le falta todo. Las asistencias no se ignoran. */
export function datosDeEjemplo(avisos: ReadonlyArray<{ id: EstadoDatos['avisar'][number]['id']; label: string; avisa: boolean; por: string }>): EstadoDatos {
  return {
    avisar: avisos.filter((a) => a.avisa && a.por !== 'siempre').map((a) => ({ id: a.id, label: a.label, estado: 'falta' as const, ignorable: true })),
    ocultos: [],
  };
}

export function FichaDeEjemplo({ onCerrar, onCambio }: { onCerrar: () => void; onCambio: () => void }) {
  const [datos, setDatos] = useState<EstadoDatos | null>(null);
  const [funnel, setFunnel] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    void leerFichaFunnelAction(null).then((r) => {
      if (!vivo) return;
      if (!r.ok) { setError(r.error); return; }
      setFunnel(r.ficha.funnel.nombre);
      setDatos(datosDeEjemplo(r.ficha.efectiva.avisos));
    }).catch(() => { if (vivo) setError('No pude leer los avisos.'); });
    return () => { vivo = false; };
  }, []);

  return (
    <Modal onCerrar={onCerrar} ancho={720} etiqueta="Lead de ejemplo"
      titulo={
        <CabeceraDetalle nombre="Lead de ejemplo" color="#5b7cfa" alto={92} tam={88} anillo={3}
          titulo={<span>Lead de ejemplo</span>}
          bajada={<span>{funnel ? `Así te avisa MaKo en «${funnel}»` : 'Así te avisa MaKo'}</span>}
          acciones={datos ? (
            <DatosSinMarcarCard leadId={0} datos={datos} abrirAlMontar ejemplo onSolucionar={() => {}} onCambio={onCambio}
              ignorarSiempre={{ funnelId: null }} />
          ) : undefined} />
      }>
      <div style={{ padding: '6px 0 4px', fontSize: 14, lineHeight: 1.5, color: 'var(--dim)' }}>
        {error ? <p role="alert" style={{ margin: 0, color: 'var(--bad)', fontWeight: 600 }}>{error}</p>
          : !datos ? <p style={{ margin: 0 }}>Leyendo…</p>
          : datos.avisar.length === 0 ? <p style={{ margin: 0 }}>MaKo no avisa de ningún dato en este funnel. Se prenden con «Obligatorio» en cada bloque de la ficha.</p>
          : <p style={{ margin: 0 }}>Toca el basurero rojo de un dato para que MaKo deje de avisarlo. Se vuelve a prender con «Obligatorio» en el bloque de la ficha.</p>}
      </div>
    </Modal>
  );
}
