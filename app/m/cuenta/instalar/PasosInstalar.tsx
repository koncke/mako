'use client';

// =============================================================================
// Instalar MaKo en un iPhone — un paso por pantalla, ícono grande
// =============================================================================
// iOS no tiene aviso de instalación (no hay `beforeinstallprompt`) y sólo da Web Push
// a la app agregada a inicio (16.4+). Así que el camino es manual y se cuenta de a un
// paso: Compartir → Agregar a inicio → abrir desde el ícono. El último paso importa:
// los avisos se activan desde la app INSTALADA, no desde esta pestaña de Safari.
// =============================================================================

import { useEffect, useState } from 'react';
import { Button, ButtonLink } from '@/app/_ui/Button';
import { Icon } from '@/app/_components/icons';
import { estaInstalada } from '@/lib/movil-instalar';

// ⚠️ El set de íconos no tiene el de «Compartir» de iOS: va el del navegador.
const PASOS: ReadonlyArray<{ icono: string; frase: string }> = [
  { icono: 'web', frase: 'Toca Compartir en la barra de Safari.' },
  { icono: 'grid', frase: 'Elige «Agregar a inicio».' },
  { icono: 'mako', frase: 'Abre MaKo desde el ícono nuevo.' },
];

export function PasosInstalar() {
  const [paso, setPaso] = useState(0);
  const [instalada, setInstalada] = useState(false);
  useEffect(() => { setInstalada(estaInstalada()); }, []);

  if (instalada) {
    return (
      <div className="mc-paso">
        <span className="mc-paso__ico"><Icon name="check" size={64} /></span>
        <p className="mc-paso__frase">MaKo ya está instalada.</p>
        <div className="mc-paso__acciones">
          <ButtonLink href="/m/cuenta" variant="primary" size="lg" full>Volver a mi cuenta</ButtonLink>
        </div>
      </div>
    );
  }

  const p = PASOS[paso];
  const ultimo = paso === PASOS.length - 1;
  return (
    <div className="mc-paso" aria-live="polite">
      <span className="mc-paso__ico"><Icon name={p.icono} size={64} /></span>
      <span className="mc-paso__n">{`Paso ${paso + 1} de ${PASOS.length}`}</span>
      <p className="mc-paso__frase">{p.frase}</p>
      <div className="mc-paso__acciones">
        {ultimo
          ? <ButtonLink href="/m/cuenta" variant="primary" size="lg" full>Volver a mi cuenta</ButtonLink>
          : <Button variant="primary" size="lg" full onClick={() => setPaso(paso + 1)}>Siguiente paso</Button>}
        {paso > 0 && <Button variant="tertiary" size="md" full onClick={() => setPaso(paso - 1)}>Paso anterior</Button>}
      </div>
    </div>
  );
}
