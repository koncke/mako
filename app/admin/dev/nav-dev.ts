// =============================================================================
// Las 122 áreas, con la forma de una BARRA de navegación
// =============================================================================
// `/admin/dev` no dibuja una lista parecida a la barra: monta la barra de verdad
// (`BarraPreview` → `Familia` → `NavLink`) con estas familias adentro. Para eso
// las áreas tienen que hablar el idioma del nav, y eso es lo único que hace este
// archivo: traducir `AreaDev[]` a `NavFamilia[]`.
//
// Por qué importa que sea el mismo componente y no una copia: esta pantalla
// existe para DECIDIR cómo va a quedar Dev en la barra. Si se dibuja aparte, lo
// que se aprueba acá no es lo que después aparece allá. Es la misma lección que
// ya está escrita arriba de `BarraPreview`: «un catálogo que muestra un dibujo de
// la pieza en vez de la pieza no sirve para revisar nada».
//
// LOS SUB-DESPLEGABLES SON `grupos`, no filas anidadas. La barra ya tiene ese
// mecanismo: una colección se muestra como UNA fila que abre un panel al costado.
// Es lo que pidió el dueño —«prefiero que algunos desplegables a su vez tengan
// otros desplegables»— y sale gratis. Además resuelve el problema de tamaño: sin
// esto, Operate son 31 filas seguidas.

import type { NavFamilia, NavItem } from '@/app/_components/nav';
import { AREAS, FAMILIAS, porGrupo, type AreaDev } from './areas';

/** El ícono de cada familia. Los cinco primeros son los MISMOS que usa `nav.ts`
 *  para su familia homónima: si acá dijeran otra cosa, esta pantalla enseñaría
 *  una barra que no existe. */
const FAM_UI: Record<string, { pregunta: string; icon: string }> = {
  Operate: { pregunta: '¿Qué hago hoy con mis clientes?', icon: 'rayo' },
  Analyze: { pregunta: '¿Cómo viene el negocio?', icon: 'analytics' },
  'Sales Machine': { pregunta: '¿Con qué convierto?', icon: 'sales' },
  'Content Machine': { pregunta: '¿Qué publico?', icon: 'creativos' },
  MaKo: { pregunta: '¿Qué me puede resolver la IA?', icon: 'mako' },
  // Las tres que NO existen todavía en la barra y hay que elegirles ícono.
  Business: { pregunta: '¿Cómo cobra MaKo?', icon: 'tag' },
  Platform: { pregunta: '¿Cómo administro todo esto?', icon: 'admin' },
  Infra: { pregunta: '¿Qué sostiene la app?', icon: 'tools' },
};

/** El ícono de un área. El del catálogo si lo tiene; si no, uno por familia. */
const ICONO_FAM: Record<string, string> = {
  Operate: 'general', Analyze: 'graphics', 'Sales Machine': 'crm',
  'Content Machine': 'escribir', MaKo: 'mako', Business: 'tag',
  Platform: 'config', Infra: 'tools',
};

const itemDe = (a: AreaDev): NavItem => ({
  key: `dev-${a.slug}`,
  label: a.titulo,
  href: `/admin/dev/${a.slug}`,
  icon: a.agente ? 'agente' : ICONO_FAM[a.familia] ?? 'config',
  // El chip «pronto» de la barra dice exactamente lo que queremos decir de un
  // área sin código, y ya está dibujado.
  comingSoon: a.estado === 'por-construir',
  match: (p) => p === `/admin/dev/${a.slug}`,
});

/**
 * Las familias de Dev, listas para `BarraPreview`.
 *
 * `abiertas` es el conteo de tareas del plan por slug: entra como badge, que es
 * el número rojo de la barra. Se pasa por parámetro porque sale de la base y este
 * módulo no la toca (lo importa un componente de cliente).
 */
export function familiasDev(): NavFamilia[] {
  return FAMILIAS.map((familia) => {
    const grupos = porGrupo(familia);
    const sueltas = grupos.find((g) => !g.grupo)?.areas ?? [];
    const colecciones = grupos.filter((g) => g.grupo);
    return {
      key: keyDeFamilia(familia),
      label: familia,
      pregunta: FAM_UI[familia]?.pregunta ?? '',
      icon: FAM_UI[familia]?.icon ?? 'config',
      // Las áreas sin grupo van a la vista; las agrupadas, detrás de su colección.
      bloques: sueltas.length ? [sueltas.map(itemDe)] : [],
      grupos: colecciones.map((g) => ({
        key: `dev-g-${familia}-${g.grupo}`.toLowerCase().replace(/\s+/g, '-'),
        label: g.grupo,
        icon: ICONO_FAM[familia] ?? 'config',
        items: g.areas.map(itemDe),
      })),
    };
  });
}

/** El badge de cada key de ítem, para `contadorItem`. */
export function badgesDev(abiertasPorSlug: Record<string, number>): (key: string) => number {
  return (key) => abiertasPorSlug[key.replace(/^dev-/, '')] ?? 0;
}

/** La key que `familiasDev` le da a una familia. Un solo lugar: si cambia acá,
 *  cambia en los dos usos y no hay forma de que el contador no matchee. */
export const keyDeFamilia = (familia: string) => `dev-${familia.toLowerCase().replace(/\s+/g, '-')}`;

/** Cuántas tareas abiertas arrastra cada familia (el número de la fila plegada). */
export function contadorFamiliaDev(key: string, abiertasPorSlug: Record<string, number>): number {
  return AREAS
    .filter((a) => keyDeFamilia(a.familia) === key)
    .reduce((n, a) => n + (abiertasPorSlug[a.slug] ?? 0), 0);
}
