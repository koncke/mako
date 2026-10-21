'use client';

// =============================================================================
// NegocioM — el nombre del negocio en el teléfono (21/10/2026). La pantalla de la computadora es NombreNegocioPanel.tsx.
// =============================================================================

import { useState } from 'react';
import { Button } from '@/app/_ui/Button';
import { useRouter } from '@/app/_ui/Link';
import { haptico } from '@/lib/haptico';
import { guardarNombreNegocioAction } from '@/app/configuraciones/negocio-actions';
import { NOMBRE_NEGOCIO_MAX } from '@/lib/nombre-negocio';
import { ErrorM, useToastM } from '@/app/m/_ui';

export function NegocioM({ leido }: { leido: { nombre: string | null; puedeEditar: boolean } | null }) {
  const router = useRouter();
  const toast = useToastM();
  const [nombre, setNombre] = useState(leido?.nombre ?? '');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (leido == null) return <ErrorM frase="No se pudo leer el nombre de tu negocio." />;

  const guardar = async () => {
    if (ocupado) return;
    setOcupado(true); setError(null);
    try {
      const r = await guardarNombreNegocioAction(nombre);
      if (!r.ok) { haptico('error'); setError(r.error); return; }
      setNombre(r.nombre);
      haptico('success'); toast('Guardado');
      router.refresh();
    } catch (e) {
      haptico('error'); setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally { setOcupado(false); }
  };

  return (
    <>
      <label className="m-configuraciones-campo">
        <span>Nombre del negocio</span>
        <input className="m-configuraciones-entrada" value={nombre} maxLength={NOMBRE_NEGOCIO_MAX} autoComplete="organization"
          readOnly={!leido.puedeEditar} onChange={(e) => setNombre(e.target.value)} />
      </label>
      {!leido.puedeEditar && <p className="m-configuraciones-aviso">Solo quien administra el negocio puede cambiarlo.</p>}
      {error && <p className="m-configuraciones-aviso" data-tono="bad" role="alert">{error}</p>}
      {leido.puedeEditar && (
        <Button variant="primary" size="lg" full loading={ocupado} disabled={nombre.trim() === (leido.nombre ?? '').trim()} onClick={() => { void guardar(); }}>Guardar</Button>
      )}
    </>
  );
}
