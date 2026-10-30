// =============================================================================
// Lo que un EJEMPLO no puede tener: gente real de este producto, voseo ni regionalismos (29/10/2026)
// =============================================================================
// Las plantillas de Create nacen con el ejemplo COMPLETO de un negocio ficticio (docs/plantillas-reales/README.md, 2.2), y
// cada tab prueba los suyos con esto: `problemasDelEjemplo(texto)` vacío.
//   · `REALES`: gente y negocios reales de este producto. Vivía en tests/variables-aviso.test.ts (la miraban el catálogo de
//     variables y los placeholders de los formularios); ahora la miran también los ejemplos de las cinco tabs. Son nombres que
//     YA están en el repo (bitácoras, hallazgos, catálogos), así que el guard no agrega información: caza LOS CONOCIDOS.
//   · El voseo, con `marcasDeVoseo` (lib/puestas-data.ts). ⚠️ El guard de tests/puente-panel-copy.test.ts sólo recorre `.ts`
//     y `.tsx`: el texto de un `.json` (los lienzos de Image) lo prueba su tab con esto.
//   · Los regionalismos que NO son voseo y el guard no ve: «remera», «celu», «dar vuelta» por invertir («darle la vuelta»
//     es neutro). En este plan se colaron «darla vuelta» y «dé vuelta» en Image y en el prompt de Offer.
// En AI Avatar el guion HABLADO sigue el acento del negocio (`acentoEsVoseante`): ahí el voseo no se prueba a ciegas.
// =============================================================================

import { marcasDeVoseo } from '../lib/puestas-data';

/** Gente y negocios REALES de este producto. Ningún ejemplo, placeholder ni catálogo los nombra. */
export const REALES = [
  'Mauricio', 'Leila', 'Martín', 'Joan', 'Juan Francisco',
  'Código Inmobiliario', 'Negocio que Escala', 'MasteryHaus', 'Vértice', 'AvatarHype',
  // Un lead de un cliente: el ejemplo de `reunion-recordatorio` lo nombraba, y un agendado
  // se lo mandó al grupo de otro (06/10/2026).
  'Francisco Ramos', 'Dental Ramos',
  // Clientes de Mauricio que nombraban los ejemplos del catálogo de mensajes (revisión del ws9, 10/10/2026).
  'Sergio Esquer', 'BG Trucking', 'Aspro',
] as const;

export const sinAcentos = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** Los REALES que nombra un texto (sin tildes ni mayúsculas, y adentro de otra palabra también: «Martínez» se marca, que
 *  un ejemplo puede llamarse de otra forma y un falso negativo le llega a un cliente). */
export function realesEn(texto: string): string[] {
  const t = sinAcentos(texto);
  return REALES.filter((r) => t.includes(sinAcentos(r)));
}

/** Regionalismos rioplatenses que no son voseo. «darle la vuelta» es neutro; «dar vuelta» (invertir) no. */
export const ARGENTINISMOS = /\b(remera|campera|vereda|chomba|celu)\b|\b(dar|da|dé|darla|darlo)\s+vuelta\b/giu;

/** Todo lo que un ejemplo no puede tener, en una lista legible (vacía = limpio). */
export function problemasDelEjemplo(texto: string): string[] {
  return [
    ...realesEn(texto).map((r) => `nombra a un real: «${r}»`),
    ...marcasDeVoseo(texto).map((m) => `voseo: «${m}»`),
    ...[...texto.matchAll(ARGENTINISMOS)].map((m) => `regionalismo: «${m[0]}»`),
  ];
}
