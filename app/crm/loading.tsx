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
// `16px 44px 60px` (sin título desde el 12/10/2026), la fila de la barra de 40px y
// las columnas de 282px con `borderTop: 3px`. Un
// esqueleto más chico o más grande que lo que llega hace un salto que se nota más
// que un spinner, y entonces cuesta más de lo que ahorra.
//
// Y no lleva texto. Un «Cargando tus leads…» acá es una frase que aparece y
// desaparece en menos de un segundo sobre una pantalla que ya está diciendo, con
// su forma, que viene un tablero.

import { Skeleton } from '@/app/_ui';

/** Las cinco primeras columnas del pipeline por default, para que el ancho del
 *  scroll horizontal arranque donde va a arrancar. */
const COLUMNAS = [4, 3, 5, 2, 3];

export default function CargandoCrm() {
  return (
    <main aria-busy="true" aria-label="Cargando el CRM" style={{ flex: 1, minWidth: 0, padding: '16px 44px 60px', display: 'flex', flexDirection: 'column' }}>
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

      {/* KANBAN — mismas columnas de 282, mismo gap, mismo maxHeight. */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', paddingBottom: 14 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          {COLUMNAS.map((tarjetas, i) => (
            <div key={i} style={{ flex: 'none', width: 282, background: 'var(--surface)', border: '1px solid var(--border)', borderTop: '3px solid var(--border)', borderRadius: 16, padding: '13px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <Skeleton w={i % 2 ? 96 : 122} h={12} />
                <Skeleton w={24} h={16} radius={999} />
              </div>
              {Array.from({ length: tarjetas }).map((_, k) => (
                <div key={k} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 11, padding: '11px 13px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <Skeleton w={k % 3 === 0 ? '78%' : '58%'} h={14} />
                  <Skeleton w="42%" h={11} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
