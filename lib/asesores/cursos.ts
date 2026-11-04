// =============================================================================
// De qué curso sale cada referente — el eslabón entre el asesor y su Second Brain (2/11/2026)
// =============================================================================
// Martín: «me interesa que se avance con los gurús, y el second brain de cada uno».
//
// La capa de un gurú (`lib/cerebro-referente.ts`) necesita SU curso, y hasta acá no había forma de
// saber cuál es: `Asesor.curso` guarda el TÍTULO en prosa («Social Funnel»), no el slug con el que
// se busca en el catálogo. Este mapa es ese eslabón.
//
// ⚠️ CADA SLUG ESTÁ VERIFICADO CONTRA EL CAMPO `slug:` DEL ARCHIVO DEL CURSO, nunca deducido del
// nombre de la carpeta ni del nombre de la persona. Deducirlo ya puso dos nombres mal en
// producción —«Jaime Jiguera» por **Higuera** y «Jordi Sigues» por **Segués**— y buscar por el
// nombre tal como lo escribió quien pidió la tarea tampoco sirve: «Puigrredon» sin tilde y «Mafia»
// con una efe no encuentran nada. Lo cuida `tests/asesores-cursos.test.ts`, que abre los archivos.
//
// ⚠️ ESTÁN LOS DOCE, no sólo los dos que ya tienen ficha. Los otros diez entran solos el día que se
// cargue su ficha y su `IdAsesor`: el mapa no es lo que falta de ellos.
//
// ⚠️ UN GURÚ DE LA GALERÍA QUE NO ESTÁ ACÁ NO TIENE BASE DE CONOCIMIENTOS, Y NO LO DICE NADIE (3/11/2026).
// Martín: «Cuando le escribo a algun guru, aun no me respondo con su base de conocimientos». El mapa
// tenía 3 de los 22 de la galería: `cursoDe` devolvía null, el chat seguía con la ficha y el Second
// Brain decía «todavía no tiene su curso», Hormozi incluido. Los que faltaban salen del encabezado de SU
// ficha (`lib/asesores/ficha-*.ts`, «de las transcripciones de … (app/conocimientos/curso-….ts)»), que
// es de donde se destiló: lo cuida `tests/asesores-cursos.test.ts`. Sumar uno acá pide regenerar el
// índice: `node scripts/generar-clases-de-referentes.mjs`.
//
// ⚠️ Samuel Albaa COMPARTE CURSO con Agustín Nievas, y es a propósito: «Growing Closer» es de los
// dos. Su ficha destila SU parte —el *appointment setter*: manejar la conversación y conseguir la
// llamada—, que es distinta del cierre, que es lo de Nievas.
// =============================================================================

/** El `slug` del curso del que sale la ficha de cada referente. La clave es su `IdAsesor`. */
export const CURSO_DE_REFERENTE: Readonly<Record<string, string>> = {
  // ── Los que ya tienen ficha ───────────────────────────────────────────────
  'emilio-puigrredon': 'social-funnel',
  'julian-alborna': 'inteligencia-viral-2026',
  // ── Los diez que faltan (su ficha, no su curso: el curso ya está localizado) ──
  'juan-carrizo': 'aumenta-tu-valor-y-atv-advantage',
  'vilma-nunez': 'certificacion-marketing-digital-ia',
  'andy-landa': 'manychat-master-instagram',
  'romuald-fons': 'bigseo-academy',
  'mateo-maffia': 'mateo-maffia-byf',
  'sergio-begueria': 'instituto-de-marca-personal',
  'alvaro-luque': 'the-perfect-launch',
  'francisco-doglio': 'arcadia',
  'gonzalo-sere': 'growing-content-specialist',
  'samuel-albaa': 'growing-closer-agustin-nievas-samuel-albaa',
  // Nievas ya era referente de antes y sale del MISMO curso que Albaa.
  'agustin-nievas': 'growing-closer-agustin-nievas-samuel-albaa',
  // ── El resto de la galería, cada uno con el curso del que sale su ficha ──
  'hormozi': '100m-money-models',
  'juan-ads': 'metolodogia-jads',
  'julian-otalora': 'metodo-contenido-irresistible',
  'sofia-contreras': 'masteryhaus',
  'marcos-razzetti': 'agencia-6-cifras-v2',
  'victor-heras': 'master-marca-personal-5-0',
  'derek-chamizo': 'universidad-de-youtube',
  'david-turu': 'academia-de-lanzamiento',
  'ximena-fukuda': 'metodo-fukuda-poder-organico',
  'guille-collado': 'hackeando-el-algoritmo',
  'marc-verdu': 'nuevo-organic-ecom-3-0-junio-2026',
  'ramiro-cubria': 'sell-your-knowledge',
  'iman-gadzhi': 'iman-gadzhi-agency-navigator',
  'felipe-vergara': 'vender-por-fb-e-ig-ads',
  'jaime-higuera': 'growth-partner',
  'adria-sola': 'instituto-de-comunicacion',
  'augusto-bianchi': 'academia-five-stars',
  'tino-mossu': 'la-universidad-del-closer',
  'jordi-segues': 'tiktok-100k-jordi-segues',
};

/** El slug del curso de un referente, o `null` si todavía no se le asignó uno. */
export const cursoDeReferente = (id: string): string | null => CURSO_DE_REFERENTE[id] ?? null;
