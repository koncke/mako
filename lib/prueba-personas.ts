// =============================================================================
// Las PERSONAS FALSAS de «Probar» (23/10/2026)
// =============================================================================
// Martín, textual: «En Automations, en la parte de "Probar" el título de los "casos" debería ser el nombre de la
// persona falsa, NOMBRE Y APELLIDO, y que dentro en la prueba salga con ese nombre o con los datos falsos de ese
// perfil. Como tenemos varias fotos de perfil puedes crear varios datos falsos que se podrían utilizar en {{}}...
// En algún lugar debe decir Caso 1... Tal vez en el subtítulo.»
//
// Cada caso de «Probar» es un contacto con foto (`fotoDelCaso`, app/automations/PanelProbar.tsx). Hasta hoy la foto
// era lo único que lo distinguía y el mensaje salía siempre con el lead de ejemplo del catálogo («Luis Pérez»,
// «Acme»). Ahora la foto tiene dueño: una persona inventada, con nombre y apellido, y con SUS datos para las
// {{variables}} del lead. El caso k de la lista es la persona k (mismo orden que las fotos), siempre la misma.
//
// ⚠️ LAS FOTOS NO SON ARCHIVOS DEL REPO: son los retratos de randomuser.me que `PanelProbar` ya usaba (un banco de
// fotos de prueba con URL fija; ver `FOTOS_PRUEBA`). No se agregó ninguna imagen: el catálogo sólo les puso nombre.
// El género del nombre sigue al del retrato (`women/…` / `men/…`).
//
// ⚠️ TODO ES FALSO A PROPÓSITO: emails @ejemplo.com (el mismo dominio de los ejemplos de lib/variables-aviso.ts),
// teléfonos del rango «5555 01xx» (no es de nadie) y negocios que no existen. Nada viene de una persona real: no
// poner acá datos de un cliente, ni siquiera «parecidos».
//
// Pura (sin React ni server-only): la usan el panel y el test.

import { valoresVariablesLead } from './template-vars';

export type PersonaPrueba = {
  /** Estable: no cambia aunque cambie el orden de la lista. */
  id: string;
  /** Un solo nombre de pila, así `{{nombre}}` (la primera palabra) y esta clave dicen lo mismo. */
  nombre: string;
  /** Un solo apellido, por lo mismo: `{{apellido}}` es «el resto» del nombre completo. */
  apellido: string;
  /** La foto: la parte de la ruta de randomuser.me que `PanelProbar` ya usaba (p. ej. `women/44`). */
  foto: string;
  empresa: string;
  /** Sin `https://`, como el ejemplo de `lead_web` del catálogo. */
  web: string;
  email: string;
  telefono: string;
};

/** Cómo se llama la persona, entera: lo que dice el título del caso. */
export const nombreCompletoDe = (p: Pick<PersonaPrueba, 'nombre' | 'apellido'>): string => `${p.nombre} ${p.apellido}`;

/** Los retratos de siempre de la lista de casos, en su orden (no se tocó ninguno). */
export const FOTOS_PRUEBA = ['women/44', 'men/32', 'women/68', 'men/75', 'women/12', 'men/46', 'women/90', 'men/11', 'women/33', 'men/52', 'women/26', 'men/86'] as const;

/** La URL del retrato (la que ya se dibujaba). */
export const urlDeFoto = (foto: string): string => `https://randomuser.me/api/portraits/${foto}.jpg`;

// (El orden de las filas es el de `FOTOS_PRUEBA`: el test lo fija.) Teléfonos: +52 1 55 5555 0101, 0102, …
const fila = (
  n: number, nombre: string, apellido: string, empresa: string, slug: string,
): PersonaPrueba => ({
  id: slug,
  nombre,
  apellido,
  foto: FOTOS_PRUEBA[n],
  empresa,
  web: `${slug}.ejemplo.com`,
  email: `${nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()}.${apellido.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()}@ejemplo.com`,
  telefono: `+52 1 55 5555 ${String(101 + n).padStart(4, '0')}`,
});

/** Las personas falsas, una por foto. */
export const PERSONAS_PRUEBA: readonly PersonaPrueba[] = [
  fila(0, 'Valentina', 'Ríos', 'Boutique Luna Nueva', 'boutiquelunanueva'),
  fila(1, 'Mateo', 'Salazar', 'Salazar Muebles a Medida', 'salazarmuebles'),
  fila(2, 'Camila', 'Ortega', 'Ortega Contadores', 'ortegacontadores'),
  fila(3, 'Santiago', 'Paredes', 'Paredes Construcciones', 'paredesconstrucciones'),
  fila(4, 'Lucía', 'Fernández', 'Clínica Dental Sonrisa Viva', 'sonrisaviva'),
  fila(5, 'Andrés', 'Quintero', 'Quintero Logística', 'quinterologistica'),
  fila(6, 'Mariana', 'Cabrera', 'Cabrera Nutrición', 'cabreranutricion'),
  fila(7, 'Diego', 'Mendoza', 'Mendoza Seguros', 'mendozaseguros'),
  fila(8, 'Daniela', 'Villalobos', 'Villalobos Eventos', 'villaloboseventos'),
  fila(9, 'Joaquín', 'Bermúdez', 'Bermúdez Fitness', 'bermudezfitness'),
  fila(10, 'Renata', 'Aguilar', 'Aguilar Interiorismo', 'aguilarinteriorismo'),
  fila(11, 'Emiliano', 'Caballero', 'Caballero y Asociados', 'caballeroasociados'),
];

/** La persona del caso k (0 = el primero de la lista). Da la vuelta si hubiera más casos que personas. */
export function personaDelCaso(k: number): PersonaPrueba {
  const n = PERSONAS_PRUEBA.length;
  return PERSONAS_PRUEBA[((Math.trunc(k) % n) + n) % n];
}

/**
 * LOS DATOS DE LA PERSONA para las {{variables}} del lead, con las CLAVES EXACTAS del catálogo del «{ }»
 * (lib/variables-aviso.ts). El nombre sale de `valoresVariablesLead` —el mismo corte del motor: primera palabra =
 * nombre, el resto = apellido—, así «Probar» no puede decir otra cosa que el envío de verdad.
 *
 * Además de los del lead de la ficha, `optin_*` (quien «dejó sus datos» en una landing, el aviso que MaKo le manda al
 * equipo): en la prueba esa persona es esta misma. Lo demás del catálogo (etapa, reunión, pagos…) no es de la
 * persona: sigue con los ejemplos de siempre.
 */
export function datosDePersona(p: PersonaPrueba): Record<string, string> {
  const completo = nombreCompletoDe(p);
  return {
    ...valoresVariablesLead({ nombre: completo, empresa: p.empresa }),
    lead_nombre: completo,
    lead_empresa: p.empresa,
    lead_email: p.email,
    lead_telefono: p.telefono,
    lead_web: p.web,
    optin_quien: completo,
    optin_email: p.email,
    optin_telefono: p.telefono,
  };
}
