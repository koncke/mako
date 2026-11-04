// =============================================================================
// /crm — esqueleto de la primera carga
// =============================================================================
// Sin este archivo, Next deja la pantalla ANTERIOR a la vista hasta que el server
// termina de leer los leads (1.142 en el workspace del dueño). Se reportó como
// «haces clic y no pasa nada», que es exactamente lo que se ve: el CRM es
// `force-dynamic`, así que no hay nada cacheado que mostrar mientras carga, y sin
// un `loading.tsx` el router no tiene con qué reemplazar la pantalla vieja.
//
// ⚠️ LAS MEDIDAS SON LAS DE `CrmBoard`, no aproximadas a ojo: el padding
// `16px 44px 4px` y el alto de la pantalla del Kanban (22/10/2026, `ALTO_TABLERO`), la fila de la barra de 40px y
// las columnas de 304px, del alto del tablero. Un
// esqueleto más chico o más grande que lo que llega hace un salto que se nota más
// que un spinner, y entonces cuesta más de lo que ahorra.
//
// Desde el 23/10/2026 lo tapa CargandoMako (la criatura y la barra), como la capa del Ops Center.
//
// Y no lleva texto. Un «Cargando tus leads…» acá es una frase que aparece y
// desaparece en menos de un segundo sobre una pantalla que ya está diciendo, con
// su forma, que viene un tablero.

import { Skeleton } from '@/app/_ui';
import { CargandoMako } from '@/app/_ui/CargandoMako';

/** Las cinco primeras columnas del pipeline por default, para que el ancho del
 *  scroll horizontal arranque donde va a arrancar. */
const COLUMNAS = [4, 3, 5, 2, 3];

export default function CargandoCrm() {
  return (
    <main aria-busy="true" aria-label="Cargando el CRM" style={{ flex: 1, minWidth: 0, padding: '16px 44px 4px', display: 'flex', flexDirection: 'column', height: 'calc(100dvh - var(--barra-agencia, 0px))', minHeight: 0, position: 'relative' }}>
      {/* SIN HEADER desde el 12/10/2026 (puntos 22-23): el título «CRM» se fue y la barra sube
          arriba del todo, con 16 de aire y no 34. La barra: funnel · vista · buscar · filtrar
          ····· + Nuevo lead · ⋯ (las bandas viven adentro de «Filtrar»). Desde el segundo feedback
          del 12/10 es un CONTENEDOR del ancho del kanban, redondeado: la misma caja que dibuja CrmBoard. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 }}>
        <Skeleton w={190} h={40} radius={10} />
        <Skeleton w={96} h={40} radius={11} />
        <Skeleton w={260} h={40} radius={10} />
        <Skeleton w={104} h={40} radius={10} />
        <span style={{ flex: 1 }} />
        <Skeleton w={136} h={40} radius={10} />
        <Skeleton w={40} h={40} radius={10} />
      </div>

      {/* KANBAN — mismas columnas de 304, mismo gap, del alto del tablero. */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', paddingBottom: 8 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', height: '100%' }}>
          {COLUMNAS.map((tarjetas, i) => (
            <div key={i} style={{ flex: 'none', width: 304, background: 'var(--fondo-columna)', borderRadius: 18, padding: '14px 10px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <Skeleton w={i % 2 ? 96 : 122} h={12} />
                <Skeleton w={24} h={16} radius={999} />
              </div>
              {Array.from({ length: tarjetas }).map((_, k) => (
                <div key={k} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 12px 10px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <Skeleton w={k % 3 === 0 ? '78%' : '58%'} h={14} />
                  <Skeleton w="42%" h={11} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      {/* Y encima, EL loader de las tabs grandes (23/10/2026, Martín: «quiero que sean todos como el de Ops Center»): tapa el
          esqueleto como la capa del Ops Center y se ve a los 150 ms. El esqueleto queda debajo con las medidas del tablero. */}
      <CargandoMako cubre que="el CRM" />
    </main>
  );
}
