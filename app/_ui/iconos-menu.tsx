// =============================================================================
// iconos-menu — los íconos de línea ESTÁNDAR de cada opción de un desplegable
// =============================================================================
// Pedido de Martín (09/10/2026, sexta tanda, general 10), textual: «En los desplegables, también
// siempre con ÍCONO... Por ejemplo, en los desplegables de los 3 puntos en la sidebar... Pero en
// general, pon íconos en todos los desplegable, en todas las opciones... Al menos que veas que no se
// pueda estandarizar con un ícono, como las etapas del kanban que siempre son diferentes en cada
// usuario de MaKo».
//
// UN SET, POR NOMBRE. Una opción pide su ícono con una palabra (`icono: 'duplicar'`) y el desplegable
// de la casa (app/components/Dropdown.tsx) lo dibuja: así lo puede pedir también una lista armada en un
// `.ts` sin JSX (lib/editor-acciones.ts, lib/chatbot-lista-filtro.ts), y el mismo verbo lleva el mismo
// dibujo en toda la app. Un ícono copiado en cada pantalla es un ícono que diverge.
//
// ⚠️ LO QUE NO SE ESTANDARIZA NO LLEVA ÍCONO INVENTADO. Las etapas del kanban, los productos y las
//    etiquetas los nombra cada negocio: ahí va su color (`color` del renglón) o nada. Un ícono genérico
//    repetido en cada renglón no distingue a ninguno y es ruido.
// ⚠️ `borrar` ES SIEMPRE ROJO (general 9: «que siempre el ícono de borrar sea rojo»): lo pinta
//    `IconoMenu` con `--bad` y no se puede cambiar desde afuera. El dibujo es el de `IconoBorrar`
//    (./BotonBorrar.tsx), el mismo en un menú y en un botón suelto.
//
// Sin 'use client': son dibujos, los puede pintar el server. Línea de 1,9 sobre `currentColor`, así
// heredan el color del renglón y se dan vuelta solos en oscuro. Viewbox 24, como `Icon` del sidebar
// (app/_components/icons.tsx), que es OTRO set (el de los destinos de la barra) y no se toca.
// =============================================================================

import type { CSSProperties, ReactNode } from 'react';

/**
 * EL TACHO DE BORRAR (general 9, textual: «Cambia el botón de BORRAR con ese ícono de basura que no se
 * ve, no se entiende, busca un ícono más reconocible»). Lo que se veía era un 🗑 en `--faint` de 14 px
 * (el panel del lienzo) o un tacho de línea fina en gris: a ese tamaño y en gris se lee como una raya.
 * Éste es la silueta que todo el mundo reconoce —la TAPA más ancha que el cuerpo, la MANIJA arriba,
 * el cuerpo que se angosta abajo y dos ranuras— con el cuerpo RELLENO apenas (16 %): a 16 px el
 * relleno es lo que hace que se lea como un objeto y no como cuatro líneas.
 *
 * Vive acá, sin 'use client', para que lo usen igual el menú (`IconoMenu nombre="borrar"`) y el botón
 * suelto (`IconoBorrar` / `BotonBorrar`, ./BotonBorrar.tsx): un solo dibujo para «borrar» en la app.
 */
export const TRAZOS_BORRAR: ReactNode = (
  <>
    <path d="M6.2 7.2 7.3 19a2 2 0 0 0 2 1.8h5.4a2 2 0 0 0 2-1.8l1.1-11.8Z" fill="currentColor" fillOpacity={0.16} />
    <path d="M3.8 7.2h16.4" />
    <path d="M9.3 7.2V5a1.5 1.5 0 0 1 1.5-1.5h2.4A1.5 1.5 0 0 1 14.7 5v2.2" />
    <path d="M10.2 11v5.8M13.8 11v5.8" />
  </>
);

/** Los dibujos, por nombre. Agregar uno es sumar una entrada: el tipo `NombreIconoMenu` sale de acá. */
const TRAZOS = {
  agregar: <path d="M12 5v14M5 12h14" />,
  quitar: <><circle cx="12" cy="12" r="8.5" /><path d="M8.5 12h7" /></>,
  editar: <><path d="M4.5 19.5h3.8L19 8.8a2.2 2.2 0 0 0-3.1-3.1L5.2 16.4 4.5 19.5Z" /><path d="m14.3 7.3 3.1 3.1" /></>,
  renombrar: <><path d="M5 7V5.5h14V7" /><path d="M12 5.5v13" /><path d="M9.5 18.5h5" /></>,
  duplicar: <><rect x="8.5" y="8.5" width="11" height="11" rx="2" /><path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" /></>,
  copiar: <><rect x="8" y="3.5" width="8" height="3.5" rx="1" /><path d="M16 5.2h1.5a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V7.2a2 2 0 0 1 2-2H8" /></>,
  borrar: TRAZOS_BORRAR,
  archivar: <><rect x="3.5" y="4.5" width="17" height="4" rx="1" /><path d="M5.5 8.5v9.5a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8.5" /><path d="M10 12.5h4" /></>,
  restaurar: <><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" /><path d="M4.5 4.5v4h4" /></>,
  activar: <path d="M8 5.5v13l10.5-6.5L8 5.5Z" />,
  pausar: <path d="M9 5.5v13M15 5.5v13" />,
  mover: <><path d="M4.5 12h15" /><path d="m15 7.5 4.5 4.5-4.5 4.5" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  ver: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.8" /></>,
  ocultar: <><path d="M4 4l16 16" /><path d="M9.9 6A9.6 9.6 0 0 1 12 5.5C18 5.5 21.5 12 21.5 12a17 17 0 0 1-2.6 3.4M6.6 7.7C3.9 9.4 2.5 12 2.5 12S6 18.5 12 18.5a9 9 0 0 0 4.1-1" /></>,
  buscar: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.4-4.4" /></>,
  filtro: <path d="M4 5.5h16l-6.2 7.3v5.2l-3.6 1.8v-7L4 5.5Z" />,
  descargar: <><path d="M12 4v11" /><path d="m7.5 10.5 4.5 4.5 4.5-4.5" /><path d="M5 20h14" /></>,
  subir: <><path d="M12 15V4" /><path d="m7.5 8.5 4.5-4.5 4.5 4.5" /><path d="M5 20h14" /></>,
  enviar: <><path d="M20.5 3.5 10 14" /><path d="M20.5 3.5 14 20.5l-4-6.5-6.5-4 17-6.5Z" /></>,
  emoji: <><circle cx="12" cy="12" r="8.5" /><path d="M8.5 14.2a4.3 4.3 0 0 0 7 0" /><path d="M9.2 9.8h.01M14.8 9.8h.01" /></>,
  configurar: <><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>,
  etiqueta: <><path d="M3.5 11.6V4.5a1 1 0 0 1 1-1h7.1l8.9 8.9-8.1 8.1-8.9-8.9Z" /><circle cx="8" cy="8" r="1.3" /></>,
  'etiqueta-mas': <><path d="M3.5 11.6V4.5a1 1 0 0 1 1-1h7.1l8.9 8.9-8.1 8.1-8.9-8.9Z" /><path d="M11.5 10v5M9 12.5h5" /></>,
  'etiqueta-menos': <><path d="M3.5 11.6V4.5a1 1 0 0 1 1-1h7.1l8.9 8.9-8.1 8.1-8.9-8.9Z" /><path d="M9 12.5h5" /></>,
  nota: <><path d="M5 4.5h14v9.5l-6 6H5V4.5Z" /><path d="M13 20v-6h6" /><path d="M8.5 9h7M8.5 12.5h3.5" /></>,
  persona: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
  'persona-mas': <><circle cx="10" cy="8" r="3.5" /><path d="M3.5 20a6.5 6.5 0 0 1 13 0" /><path d="M19 8v5M16.5 10.5h5" /></>,
  equipo: <><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 5.2a3 3 0 0 1 0 5.6" /><path d="M17.5 14.2A5.5 5.5 0 0 1 21.5 20" /></>,
  cliente: <><circle cx="10" cy="8" r="3.5" /><path d="M3.5 20a6.5 6.5 0 0 1 13 0" /><path d="m15.5 11 2 2 3.5-4" /></>,
  producto: <><path d="M12 3.5 4.5 7.5v9l7.5 4 7.5-4v-9L12 3.5Z" /><path d="m4.5 7.5 7.5 4 7.5-4" /><path d="M12 11.5v9" /></>,
  etapa: <><rect x="4" y="4" width="4.3" height="16" rx="1" /><rect x="9.85" y="4" width="4.3" height="10" rx="1" /><rect x="15.7" y="4" width="4.3" height="13" rx="1" /></>,
  calificado: <><circle cx="12" cy="12" r="8.5" /><path d="m8.4 12.2 2.5 2.5 4.8-5" /></>,
  silenciar: <><path d="M4 4l16 16" /><path d="M9.5 5.3A5.5 5.5 0 0 1 17.5 10v3.5l1.5 2.5H8M6.5 8.6V13.5L5 16h3" /><path d="M10 19.5a2.2 2.2 0 0 0 4 0" /></>,
  avisar: <><path d="M6.5 10a5.5 5.5 0 0 1 11 0v3.5l1.5 2.5H5l1.5-2.5V10Z" /><path d="M10 19.5a2.2 2.2 0 0 0 4 0" /></>,
  whatsapp: <path d="M20.5 11.6a8.4 8.4 0 0 1-12.3 7.4L3.5 20.5l1.5-4.6A8.4 8.4 0 1 1 20.5 11.6Z" />,
  email: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 7 8.5 6 8.5-6" /></>,
  telefono: <path d="M5 4h3.5l1.8 4.5-2.3 1.4a10.5 10.5 0 0 0 6.1 6.1l1.4-2.3L20 15.5V19a1.5 1.5 0 0 1-1.6 1.5A16 16 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4Z" />,
  mako: <path d="M12 3.5c.6 3.9 2.6 5.9 6.5 6.5-3.9.6-5.9 2.6-6.5 6.5-.6-3.9-2.6-5.9-6.5-6.5 3.9-.6 5.9-2.6 6.5-6.5ZM18.5 15.5c.3 1.6 1 2.3 2.5 2.5-1.5.3-2.2 1-2.5 2.5-.3-1.5-1-2.2-2.5-2.5 1.5-.2 2.2-.9 2.5-2.5Z" />,
  curso: <><path d="M4.5 5.5A2 2 0 0 1 6.5 3.5h12v14h-12a2 2 0 0 0-2 2V5.5Z" /><path d="M4.5 19.5a2 2 0 0 0 2 2h12" /></>,
  calendario: <><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  reloj: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  cronometro: <><circle cx="12" cy="13.5" r="7" /><path d="M12 10v3.5l2 1.5M10 3h4M12 3v3.5" /></>,
  condicion: <><circle cx="6" cy="6" r="2" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="8" r="2" /><path d="M6 8v8M18 10c0 4-6 3.5-11 6.5" /></>,
  accion: <path d="M13 3 5 13.5h6l-1 7.5 8-10.5h-6l1-7.5Z" />,
  dinero: <><circle cx="12" cy="12" r="8.5" /><path d="M14.6 9.4c-.4-.9-1.4-1.4-2.6-1.4-1.5 0-2.6.8-2.6 2s1.1 1.6 2.6 2 2.6.8 2.6 2-1.1 2-2.6 2c-1.2 0-2.2-.5-2.6-1.4M12 6.5V8M12 16v1.5" /></>,
  archivo: <><path d="M6.5 3.5h7.5l4.5 4.5v12.5h-12v-17Z" /><path d="M14 3.5V8h4.5" /></>,
  imagen: <><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><circle cx="9" cy="9.5" r="1.6" /><path d="m4 18 5-5 4 4 2.5-2.5L20 19" /></>,
  video: <><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3" /></>,
  audio: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></>,
  plan: <><rect x="4.5" y="3.5" width="15" height="17" rx="2.5" /><path d="m7.5 8 1.2 1.2 2.2-2.4M7.5 13l1.2 1.2 2.2-2.4M13 8.2h3.5M13 13.2h3.5" /></>,
  grafico: <><path d="M4 20h16" /><rect x="5.5" y="12" width="3" height="6" rx=".8" /><rect x="10.5" y="7" width="3" height="11" rx=".8" /><rect x="15.5" y="9.5" width="3" height="8.5" rx=".8" /></>,
  web: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.3 2.4 3.4 5.2 3.4 8.5S14.3 18.1 12 20.5C9.7 18.1 8.6 15.3 8.6 12S9.7 5.9 12 3.5Z" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  cerrar: <path d="M6 6l12 12M18 6 6 18" />,
  mas: <path d="M5.5 12h.01M12 12h.01M18.5 12h.01" />,
  // ── Sumados en el barrido de la segunda pasada (09/10/2026), para los menús de «⋯» y los
  //    desplegables del resto de la app. Mismo trazo y viewbox que los de arriba.
  fijar: <><path d="M9 3.5h6l-.8 5.3 3.3 3.2H6.5l3.3-3.2L9 3.5Z" /><path d="M12 12v8.5" /></>,
  llave: <><circle cx="8" cy="15.5" r="3.5" /><path d="m10.5 13 8.5-8.5M15.5 8l2.5 2.5M13.3 10.2l2 2" /></>,
  candado: <><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></>,
  repetir: <><path d="m17 3.5 3 3-3 3" /><path d="M4 11.5V10a3.5 3.5 0 0 1 3.5-3.5H20" /><path d="m7 20.5-3-3 3-3" /><path d="M20 12.5V14a3.5 3.5 0 0 1-3.5 3.5H4" /></>,
  anuncio: <><path d="M4 10v4h3l7 4V6l-7 4H4Z" /><path d="M17 9a3.5 3.5 0 0 1 0 6" /></>,
  'persona-menos': <><circle cx="10" cy="8" r="3.5" /><path d="M3.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16.5 10.5h5" /></>,
  numero: <path d="M9.5 4 7.5 20M16.5 4l-2 16M4.5 9h15M3.5 15h15" />,
  texto: <path d="M4.5 6.5h15M4.5 12h15M4.5 17.5h9" />,
  titulo: <path d="M6 5v14M18 5v14M6 12h12" />,
  lista: <><path d="M9.5 6.5h10M9.5 12h10M9.5 17.5h10" /><path d="M5 6.5h.01M5 12h.01M5 17.5h.01" /></>,
  cita: <><path d="M5 6v12" /><path d="M9.5 8h9.5M9.5 12h9.5M9.5 16h6" /></>,
  arriba: <><path d="M12 19.5V5" /><path d="m6.5 10.5 5.5-5.5 5.5 5.5" /></>,
  abajo: <><path d="M12 4.5V19" /><path d="m6.5 13.5 5.5 5.5 5.5-5.5" /></>,
  abrir: <><path d="M13.5 4.5h6v6" /><path d="M19.5 4.5 11 13" /><path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" /></>,
  color: <path d="M12 3.5c3.6 4 6 7 6 10a6 6 0 0 1-12 0c0-3 2.4-6 6-10Z" />,
} satisfies Record<string, ReactNode>;

export type NombreIconoMenu = keyof typeof TRAZOS;

/** Los nombres del set, para quien tenga que validar uno que llega como texto. */
export const NOMBRES_ICONO_MENU = Object.keys(TRAZOS) as NombreIconoMenu[];

/**
 * ¿Este texto es un ícono del SET (y no la URL de una imagen)? Un nombre nunca trae `:` ni `/` ni `.`,
 * y una URL o un `data:` siempre los trae: así un mismo campo `icono` acepta las dos cosas sin que el
 * nombre de un ícono pueda leerse como una URL ni al revés.
 */
export function esIconoMenu(s: unknown): s is NombreIconoMenu {
  return typeof s === 'string' && Object.prototype.hasOwnProperty.call(TRAZOS, s);
}

/**
 * Le pone a cada opción el ícono de su `value` según un mapa, sin tocar la lista de quien la arma.
 *
 * Existe para las listas que viven en un módulo PURO con test (`opcionesDeCursoEnTarjeta`, un catálogo de
 * `lib/`): el ícono es cosa de la pantalla y un `deepEqual` sobre la lista no tiene por qué enterarse.
 * Una opción cuyo `value` no está en el mapa queda SIN ícono, igual que antes: un ícono genérico de
 * relleno no distingue a nadie. Y una que ya traía el suyo lo conserva.
 */
export function conIconos<T extends { value: string; icono?: unknown }>(ops: readonly T[], mapa: Readonly<Partial<Record<string, NombreIconoMenu>>>): T[] {
  return ops.map((o) => (o.icono !== undefined || !mapa[o.value] ? o : { ...o, icono: mapa[o.value] }));
}

/**
 * Un ícono del set. Hereda el color del texto (`currentColor`), salvo `borrar`, que es ROJO siempre.
 *
 * ⚠️ Un nombre que no existe NO dibuja un punto ni un cuadrado vacío: no dibuja nada. Un `<Icon
 *    name="inventado">` que pinta un punto se lee como un ícono a medio cargar (AGENTS.md). El tipo
 *    `NombreIconoMenu` es lo que evita el nombre inventado; esto es la red si llega por texto.
 */
export function IconoMenu({ nombre, size = 17, style }: { nombre: NombreIconoMenu; size?: number; style?: CSSProperties }) {
  const trazo = esIconoMenu(nombre) ? TRAZOS[nombre] : null;
  if (!trazo) return null;
  const rojo = nombre === 'borrar';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={rojo ? 2 : 1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden
      style={{ flex: 'none', display: 'block', ...style, ...(rojo ? { color: 'var(--bad)' } : null) }}>
      {trazo}
    </svg>
  );
}
