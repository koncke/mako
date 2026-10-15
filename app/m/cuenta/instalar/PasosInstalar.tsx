'use client';

// =============================================================================
// Instalar MaKo en un iPhone — un paso por pantalla, ícono grande
// =============================================================================
// iOS no tiene aviso de instalación (no hay `beforeinstallprompt`) y sólo da Web Push
// a la app agregada a inicio (16.4+). Así que el camino es manual y se cuenta de a un
// paso: Compartir → Agregar a inicio → abrir desde el ícono. El último paso importa:
// los avisos se activan desde la app INSTALADA, no desde esta pestaña de Safari.
//
// v2: el nombre va chico en la barra («Instalar MaKo», con «‹ Perfil» a la izquierda) y la
// pantalla es el paso. El h1 queda para el lector de pantalla (`grande={false}`).
// =============================================================================

import { useEffect, useState } from 'react';
import { Button, ButtonLink } from '@/app/_ui/Button';
import { Icon } from '@/app/_components/icons';
import { estaInstalada } from '@/lib/movil-instalar';
import { CabeceraM } from '../../_ui/CabeceraM';

const TITULO = 'Instalar la app'; // el mismo rótulo que «Tu cuenta» en la computadora

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

  const cabecera = (
    <>
      <CabeceraM titulo={TITULO} grande={false} />
      <h1 className="m-sr">{TITULO}</h1>
    </>
  );

  if (instalada) {
    return (
      <div className="m-cuenta-paso">
        {cabecera}
        <span className="m-cuenta-paso__ico"><Icon name="check" size={64} /></span>
        <p className="m-cuenta-paso__frase">MaKo ya está instalada.</p>
        <div className="m-cuenta-paso__acciones">
          <ButtonLink href="/m/cuenta" variant="primary" size="lg" full>Volver a mi cuenta</ButtonLink>
        </div>
      </div>
    );
  }

  const p = PASOS[paso];
  const ultimo = paso === PASOS.length - 1;
  return (
    <div className="m-cuenta-paso" aria-live="polite">
      {cabecera}
      <span className="m-cuenta-paso__ico"><Icon name={p.icono} size={64} /></span>
      <span className="m-cuenta-paso__n">{`Paso ${paso + 1} de ${PASOS.length}`}</span>
      <p className="m-cuenta-paso__frase">{p.frase}</p>
      <div className="m-cuenta-paso__acciones">
        {ultimo
          ? <ButtonLink href="/m/cuenta" variant="primary" size="lg" full>Volver a mi cuenta</ButtonLink>
          : <Button variant="primary" size="lg" full onClick={() => setPaso(paso + 1)}>Siguiente paso</Button>}
        {paso > 0 && <Button variant="tertiary" size="lg" full onClick={() => setPaso(paso - 1)}>Paso anterior</Button>}
      </div>
    </div>
  );
}
