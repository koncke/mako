'use client';

// =============================================================================
// Instalar MaKo — un paso por pantalla, ícono grande (iPhone y Android)
// =============================================================================
// iOS no tiene aviso de instalación (no hay `beforeinstallprompt`) y sólo da Web Push
// a la app agregada a inicio (16.4+). Así que el camino es manual y se cuenta de a un
// paso: Compartir → Agregar a inicio → abrir desde el ícono. El último paso importa:
// los avisos se activan desde la app INSTALADA, no desde esta pestaña de Safari.
//
// v3 (15/10/2026): «Instalar la app» es una sección de «Tu cuenta» y su fila está siempre, así
// que esta pantalla también la abre un Android al que Chrome no le dejó el aviso (ya se descartó,
// u otro navegador): ahí los pasos son los del menú del navegador (`pasosInstalar`, cuenta-ui.ts).
// Qué teléfono es se lee DESPUÉS de montar (el server no lo sabe): mientras tanto, sólo el nombre.
//
// El nombre va chico en la barra («Instalar la app», con «‹ Tu cuenta» a la izquierda) y la
// pantalla es el paso. El h1 queda para el lector de pantalla (`grande={false}`).
// =============================================================================

import { useEffect, useState } from 'react';
import { Button, ButtonLink } from '@/app/_ui/Button';
import { Icon } from '@/app/_components/icons';
import { esIOS, estaInstalada } from '@/lib/movil-instalar';
import { SECCIONES_CUENTA } from '@/lib/ajustes-secciones';
import { CabeceraM } from '../../_ui/CabeceraM';
import { pasosInstalar } from '../cuenta-ui';

// El mismo rótulo que «Tu cuenta» en la computadora (lib/ajustes-secciones.ts).
const TITULO = SECCIONES_CUENTA.find((s) => s.key === 'instalar')?.label ?? 'Instalar la app';

export function PasosInstalar() {
  const [paso, setPaso] = useState(0);
  const [plat, setPlat] = useState<{ ios: boolean; instalada: boolean } | null>(null);
  useEffect(() => { setPlat({ ios: esIOS(), instalada: estaInstalada() }); }, []);

  const cabecera = (
    <>
      <CabeceraM titulo={TITULO} grande={false} />
      <h1 className="m-sr">{TITULO}</h1>
    </>
  );

  if (!plat) return <div className="m-cuenta-paso">{cabecera}</div>;

  if (plat.instalada) {
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

  const pasos = pasosInstalar(plat.ios);
  const p = pasos[paso];
  const ultimo = paso === pasos.length - 1;
  return (
    <div className="m-cuenta-paso" aria-live="polite">
      {cabecera}
      <span className="m-cuenta-paso__ico"><Icon name={p.icono} size={64} /></span>
      <span className="m-cuenta-paso__n">{`Paso ${paso + 1} de ${pasos.length}`}</span>
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
