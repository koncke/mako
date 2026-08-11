'use client';

// =============================================================================
// MensajesMaKo — la cáscara de /mensajes
// =============================================================================
// Solo el encabezado: la lista, la preview de chat y el CRUD viven en
// PlantillasView, que se reusa tal cual desde /agencia (una cosa, un lugar — si
// se copiara el componente, la copia se quedaría vieja en la primera edición).

import { MakoStar } from '../_components/MakoBrand';
import { PlantillasView } from '../agencia/PlantillasView';

export function MensajesMaKo() {
  return (
    <div style={{ width: '100%', maxWidth: 1080, margin: '0 auto', flex: 1, minWidth: 0, padding: '28px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <MakoStar size={24} color="var(--primary)" />
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>Mensajes de MaKo</h1>
      </div>
      <p style={{ margin: '0 0 20px', fontSize: 14.5, color: 'var(--dim)' }}>
        Todo lo que MaKo puede escribirle al dueño por WhatsApp. Se ve como llega, se edita, y se prende o se apaga uno por uno.
      </p>
      <PlantillasView />
    </div>
  );
}
