'use client';

// =============================================================================
// GeneralM — la portada del teléfono: la hoja de General del negocio, apilada (v3, 14/10/2026)
// =============================================================================
// Martín (14/10/2026): la portada del teléfono es General, y General en el teléfono es lo MISMO que armó
// en la computadora con menos cosas (prototipo docs/prototipos/mako-mobile-tableros.html, aprobado). Así
// que no hay bloques propios del teléfono: cada bloque de la hoja se dibuja con la pieza de escritorio
// (`ElementoGeneral` → `dibujarBloque`, adentro de `ProveedorGeneral`, que trae CSS_BLOQUES y los datos de
// `armarDatosGeneral`), uno debajo del otro, en el orden de la hoja (arriba → abajo, izquierda → derecha:
// el de `enOrden`, app/dashboard/exportar.ts, que no se importa porque arrastra media lectura de datos).
//
//   · Bloque de General → su tarjeta. La letra de cada bloque va en `cqi` y `.gen-pieza` ya trae
//     `container-type: inline-size`, así que el mismo bloque baja de escala solo. La tarjeta mide lo que el
//     bloque dibuja (sin alto fijo): las listas con `gb-cabe` muestran todas sus filas.
//   · Texto → el texto, con las variables de quien mira (`conVariables`).
//   · Sección → el título de la parte («Hoy»).
//   · Gráfico del catálogo y lo demás → se cuentan y van en «en la computadora» (tanda 1).
//
// El bloque «Meta objetivo» lleva de arriba la tarjeta oscura (el «Fondo: Oscuro» que ya tienen todos los
// bloques): es el héroe que aprobó Martín en el prototipo. Si el negocio lo eligió oscuro, ya lo es.
// =============================================================================

import type { Elemento, Hoja } from '@/lib/graficos-catalogo';
import { conVariables, type ValoresVariables } from '@/lib/general-piezas';
import { ProveedorGeneral } from '@/app/general/ProveedorGeneral';
import type { DatosGeneral } from '@/app/general/datos-tipos';
import { ElementoGeneral } from '@/app/dashboard/ElementoGeneral';
import { ComputadoraM } from '@/app/m/_ui';

/** Los bloques que llevan la tarjeta oscura en el teléfono aunque en la hoja vayan claros. */
const HEROE = new Set(['cabecera']);

export function GeneralM({ hoja, datos, variables }: { hoja: Hoja; datos: DatosGeneral; variables: ValoresVariables }) {
  const componentes = [...hoja.componentes].sort((a, b) => a.y - b.y || a.x - b.x);
  let fuera = 0;
  const piezas = componentes.map((c) => {
    if (c.clase !== 'elemento') { fuera++; return null; }
    const e = c as Elemento;
    if (e.tipo === 'general' && e.general) {
      return (
        <article key={e.id} className="m-hoy-gen-tarjeta" data-heroe={HEROE.has(e.general.pieza) || undefined}>
          <ElementoGeneral e={e} />
        </article>
      );
    }
    if (e.tipo === 'texto') {
      const texto = conVariables(e.texto, variables).trim();
      return texto ? <p key={e.id} className="m-hoy-gen-texto" data-tam={e.tamano}>{texto}</p> : null;
    }
    if (e.tipo === 'seccion') return e.texto.trim() ? <h2 key={e.id} className="m-hoy-gen-parte">{e.texto.trim()}</h2> : null;
    fuera++;
    return null;
  });
  return (
    <ProveedorGeneral datos={datos} variables={variables}>
      <div className="m-hoy-gen">{piezas}</div>
      {fuera > 0 && <ComputadoraM que={fuera === 1 ? 'Un gráfico de esta hoja' : `${fuera} gráficos de esta hoja`} />}
    </ProveedorGeneral>
  );
}
