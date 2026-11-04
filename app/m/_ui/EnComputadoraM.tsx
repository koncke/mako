'use client';

// =============================================================================
// FilaEnComputadoraM — una fila de algo que se usa EN LA COMPUTADORA, con su motivo y la salida
// =============================================================================
// Referencia: Ajustes de iOS. Una fila que no tiene pantalla en el teléfono no es un link muerto ni un candado: dice
// «En la computadora» en la segunda línea y, al tocarla, abre una HOJA con el porqué (una o dos frases) y UN botón que
// la abre en la versión de computadora de este mismo teléfono. La salida es la misma de «Versión de computadora» (la
// última fila de More): la cookie de vista de escritorio (12 h, lib/movil-dispositivo.ts) y la URL con el `?ws=` de la
// pestaña (`conWs`). Nunca un link pelado: el desvío la taparía con «Esta pantalla se usa en la computadora».
//
// La usan More (una tab de la sidebar sin pantalla del teléfono, lib/movil-rutas.ts → SOLO_ESCRITORIO / EN_CAMINO) y
// las pantallas que tienen una sección de escritorio sin versión del teléfono (hoy, «Prompts»; hasta el 26/10/2026 también «Método»).
// Para una línea gris al FINAL de una pantalla («Pagos e historial · En la computadora»), sin hoja, está ComputadoraM.
// =============================================================================

import { useState, type ReactNode } from 'react';
import { useWs } from '@/app/_ui/Link';
import { Button } from '@/app/_ui/Button';
import { conWs } from '@/lib/ws-tab';
import { cookieVistaEscritorio } from '@/lib/movil-dispositivo';
import { FilaM } from './FilaM';
import { PieM } from './Piezas';
import { SheetM } from './SheetM';
import { useShellM } from './contexto';

/**
 * Abre UNA pantalla de escritorio en este teléfono: la cookie de vista con SU ruta y la URL con su `?ws=`. Desde el
 * 20/10/2026 la cookie es de esa pantalla sola: hasta ese día era de toda la app por 12 h y el teléfono quedaba en la
 * versión de computadora sin vuelta (Martín: «Veo MaKo mobile roto, como si estuviera en desktop»).
 */
export function abrirEnComputadora(href: string, ws: number | null) {
  document.cookie = cookieVistaEscritorio(href);
  window.location.href = conWs(href, ws);
}

export function FilaEnComputadoraM({ titulo, href, motivo, icono, leading }: {
  titulo: string;
  /** La ruta de ESCRITORIO que abre («Abrir en la computadora»). */
  href: string;
  /** Por qué no está en el teléfono: lo que lee la persona en la hoja. */
  motivo: string;
  /** Un ícono de app/_components/icons.tsx (o `leading`, para otro dibujo). */
  icono?: string;
  leading?: ReactNode;
}) {
  const ws = useWs();
  const [abierta, setAbierta] = useState(false);
  // En la app de iPhone no se dibuja: Apple la lee como relleno (guía 2.1, lib/tienda.ts).
  const { appIos } = useShellM();
  if (appIos) return null;
  return (
    <>
      <FilaM navegacion icono={leading ? undefined : icono} leading={leading} titulo={titulo} segunda="En la computadora" onClick={() => setAbierta(true)} />
      <SheetM
        abierto={abierta}
        onCerrar={() => setAbierta(false)}
        titulo={titulo}
        id="computadora"
        pie={(
          <PieM>
            <Button variant="primary" size="lg" full onClick={() => abrirEnComputadora(href, ws)}>Abrir en la computadora</Button>
          </PieM>
        )}
      >
        <p className="m-en-compu__motivo">{motivo}</p>
      </SheetM>
    </>
  );
}
