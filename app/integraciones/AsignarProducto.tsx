'use client';

// =============================================================================
// AsignarProducto — el PASO 2: qué producto vende esta página
// =============================================================================
// Pedido de MARTÍN el 06/10/2026, textual: «Tiene que ser otro paso en la
// configuración del pixel asignar PRODUCTO, ponlo como segundo paso… Y no solo se
// debería poder seleccionar 1 producto, si quiero puedo seleccionar más de 1.»
//
// Y la segunda vuelta, el mismo día, con cuatro cosas que esta pantalla hace por
// eso y que no se ven leyendo el código:
//
// 1. «Tardó mucho en encontrar mis productos… si son 2 literalmente.» Pedía sus
//    datos con server actions al montarse, y Next despacha las actions DE A UNA:
//    eran tres viajes en serie antes de la primera casilla. Ahora los productos y
//    las páginas bajan por props desde el server (`app/integraciones/page.tsx`) y
//    este paso se pinta en el primer frame. La única action que queda es GUARDAR.
//
// 2. «Hazlo también dentro de un desplegable.» Es el desplegable de la casa con la
//    elección múltiple (`varios` en app/components/Dropdown.tsx), no uno propio.
//
// 3. «Elimina el texto…» Se fue el párrafo que explicaba qué hace marcar varios.
//    El porqué vive acá: la pantalla dice qué está elegido y nada más.
//
// 4. «Sí o sí se debe marcar 1. Y si el workspace tiene solo 1 producto, que ya
//    aparezca marcado.» Por eso «sin marcar ninguno» dejó de existir como estado:
//    sin nada guardado se MUESTRA marcado el del negocio —que es exactamente a
//    dónde van hoy esos leads (`funnelsDeLanding` → `[null]`)—, y el último que
//    queda no se puede desmarcar. Es un CÁLCULO y no una escritura: abrir la
//    pantalla no guarda una decisión que nadie tomó.
// =============================================================================

import { useState } from 'react';
import { Select } from '@/app/_ui';
import { mismaPagina } from '@/lib/landing-paginas';
import type { LandingConfig } from '@/lib/landing-config';
import type { ProductoAsignable } from '@/lib/landing-funnel';
import { alternarValor } from '@/app/components/dropdown-varios';
import { guardarLandingAction } from './landing-config-actions';

export function AsignarProducto({ elegida, productos, landings, onLandings }: {
  elegida: string | null;
  /** Los productos del workspace, resueltos en el server. `null` = no se pudieron leer. */
  productos: ProductoAsignable[] | null;
  /** Las landings con su configuración. Es el MISMO estado que usa el paso 1. */
  landings: LandingConfig[];
  onLandings: (l: LandingConfig[]) => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ⚠️ SIN PRODUCTOS NO ES «NO TENÉS»: es que no se pudo leer. Un workspace siempre
  // tiene su embudo del negocio, así que el server baja `null` cuando la lista viene
  // vacía, y dibujar acá una casilla marcada sobre nada sería inventar el dato.
  if (!productos) {
    return <div style={{ fontSize: 12.5, color: 'var(--bad)' }}>No pude leer tus productos. Recarga la página.</div>;
  }

  const cfg = landings.find((l) => mismaPagina(l.url, elegida)) ?? null;
  const guardados = cfg?.funnelIds ?? [];
  const delNegocio = productos.find((p) => p.esDefault) ?? productos[0];

  // Lo que se MUESTRA marcado. Sin nada guardado es el del negocio, porque ahí es
  // donde entran hoy esos leads: mostrarlo vacío afirmaría que no van a ningún lado.
  const marcados = guardados.length ? guardados : [delNegocio.id];

  // ⚠️ EL VALOR GUARDADO ENTRA A LA LISTA AUNQUE EL EMBUDO YA NO SE PUEDA ELEGIR.
  // Un producto archivado no se ofrece, y si no se dibujara su renglón, el primer
  // guardado de cualquier otro lo borraría sin que nadie lo toque. Se muestra
  // marcado y diciendo qué le pasa, y se puede desmarcar.
  const huerfanos = guardados.filter((id) => !productos.some((p) => p.id === id));

  const opciones = [
    ...productos.map((p) => ({ value: String(p.id), label: p.nombre })),
    ...huerfanos.map((id) => ({ value: String(id), label: 'Producto archivado', sub: 'Sus leads entran al del negocio' })),
  ];

  const alternar = async (v: string) => {
    // ⚠️ El menú NO se cierra al tocar (es elección múltiple), así que se puede
    // tocar otro renglón mientras el primero se guarda. Sin esta guarda salen dos
    // guardados con el conjunto viejo y el segundo pisa al primero.
    if (!elegida || ocupado) return;
    // La MISMA regla del mínimo que usa el desplegable para no dejar desmarcar el
    // último: con una acá y otra allá, la primera vez que difieran se guarda un
    // conjunto que el menú no deja ver.
    const ids = alternarValor(marcados.map(String), v, 1).map(Number);
    if (ids.length === marcados.length && ids.every((x, i) => x === marcados[i])) return;
    setOcupado(true); setErr(null);
    // Se manda la lista ENTERA: es lo que hace que la vacía desasigne (ausente
    // sería «no los toques», ver `conLanding`) — aunque desde acá nunca se manda
    // vacía, por la regla del mínimo.
    const r = await guardarLandingAction(elegida, { funnelIds: ids });
    setOcupado(false);
    if (!r.ok) { setErr(r.error); return; }
    onLandings(r.landings);
  };

  return (
    <div>
      <Select
        ariaLabel="Productos de esta página"
        options={opciones}
        value=""
        varios={marcados.map(String)}
        minimo={1}
        onChange={(v) => { void alternar(v); }}
        disabled={ocupado}
      />
      {err && <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--bad)' }}>{err}</div>}
    </div>
  );
}
