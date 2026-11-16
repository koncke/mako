// =============================================================================
// «Con MaKo Pro» NO SE TIPEA, SE DERIVA — la ÚNICA derivación de /vsl (15/11/2026)
// =============================================================================
// Martín, sobre /planes (14/11/2026): «el de 47 debería estar bien limitado y restrictivo. En cambio el de 97 ya podés
// generar avatares de IA, podés editar videos, podés replicar landing… La idea es que compren el de 97, no el de 47».
// Las landings de funcionalidad NO llevan las columnas de planes (`TarjetasPlanes` no está en LandingCompetencia.tsx), así
// que el TEXTO es la única señal de plan: quien paga US$47 elige su plan leyendo esto.
//
// POR QUÉ UN ARCHIVO PROPIO: hasta el 15/11/2026 estas seis líneas estaban COPIADAS en copywriting.ts, image.ts y video.ts,
// y competitor-spy.ts:164 tenía el «Con MaKo Pro.» TIPEADO A MANO —justo lo que la regla prohíbe— porque no tenía ninguna
// copia. Cuatro copias son cuatro cosas que se desincronizan el día que una función se abre. Acá hay UNA, y la importan los
// datos y los diseños (./disenos/copywriting.tsx y ./disenos/image.tsx escriben texto propio y llaman a estas mismas dos).
//
// ⚠️ CERRAR EN ESENCIAL Y VENDER SON DOS COSAS: lo que está cerrado pero todavía no se vende
//    (`FUNCIONES_TODAVIA_NO_VENDIDAS`, hoy el avatar por `AI_AVATAR_SE_VENDE`) sale SIN aviso, porque decir «Con MaKo Pro»
//    ahí sería empezar a venderlo. Por eso la derivación mira las DOS listas, no sólo `FUNCIONES_SOLO_PRO`.
// ⚠️ Y EL CANDADO ES ANGOSTO: lib/editores-ia-pro.ts dice la lista exacta de lo que cierra 'ia-editores'. Marcar lo que
//    sigue abierto (los subtítulos, el lienzo, el kit de marca, la línea de tiempo) es mentir al revés y espanta al de
//    US$47. Cada landing anota en su cabecera qué palabras suyas son del candado y cuáles no.
// Lo mide tests/vsl-landings-dicen-el-plan.test.ts, dibujando las páginas.
// =============================================================================

import { FUNCIONES_SOLO_PRO, type FuncionSoloPro } from '@/lib/topes-plan';
import { FUNCIONES_TODAVIA_NO_VENDIDAS } from '@/lib/planes-comparacion';

/** Cerrada en Essential Y ya vendida: las dos condiciones, que es lo que decide si el aviso sale o no. */
export const seVendeEnPro = (f: FuncionSoloPro): boolean =>
  (FUNCIONES_SOLO_PRO as readonly string[]).includes(f) && !FUNCIONES_TODAVIA_NO_VENDIDAS.includes(f);

/** Al final de una frase (el molde de ./competitor-spy.ts, «Copia su sitio»). */
export const soloPro = (f: FuncionSoloPro): string => (seVendeEnPro(f) ? ' Con MaKo Pro.' : '');

/** Entre paréntesis, para una lista, un título o el metaDesc (el molde de ./crm.ts, los contactos de un grupo de WhatsApp). */
export const soloProEntre = (f: FuncionSoloPro): string => (seVendeEnPro(f) ? ' (Con MaKo Pro)' : '');
