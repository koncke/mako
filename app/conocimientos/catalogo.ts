// =============================================================================
// El catálogo de cursos — FUENTE ÚNICA
// =============================================================================
// Lo consumen los DOS lados de /conocimientos:
//   • el portal del admin (`Conocimientos.tsx`), que lista y abre;
//   • el link compartido (`app/compartido/[token]/page.tsx`), que resuelve el
//     slug de un share `recurso='curso'`.
//
// Vive acá porque cada uno tenía su propia lista y se desincronizaron: el
// compartido armaba `[...CURSOS, CURSO_VSL]` y el portal seis fuentes. Los dos
// cursos que faltaban ("Curso de Claude AI - Rodrigo Rojo" y "Construir la
// app") se podían compartir desde la UI y su link daba **404**, sin ningún
// síntoma del lado del admin: el share se creaba bien, la fila estaba viva, y
// el 404 salía del `notFound()` del final de la búsqueda. Cada curso nuevo
// entraba roto por default.
//
// ⚠️ Un curso nuevo se suma ACÁ y en ningún otro lado.

import { CURSOS, type Curso, type Recurso } from './curso';
import { CURSO_VSL } from './curso-vsl';
import { CURSO_PRODUCTO_APP } from './curso-producto-app';
import { CURSO_AVATAR_APP } from './curso-avatar-app';
import { CURSO_CLAUDE_AI_RODRIGO_ROJO } from './curso-claude-ai-rodrigo-rojo';
import { CURSO_AUMENTA_TU_VALOR_Y_ATV_ADVANTAGE } from './curso-aumenta-tu-valor-y-atv-advantage';
import { CURSO_SELL_YOUR_KNOWLEDGE } from './curso-sell-your-knowledge';
import { CURSO_INTELIGENCIA_VIRAL_2026 } from './curso-inteligencia-viral-2026';
import { CURSO_M5_95 } from './curso-m5-95';
import { CURSO_VENDER_POR_FB_E_IG_ADS } from './curso-vender-por-fb-e-ig-ads';
import { CURSO_MANYCHAT_MASTER_INSTAGRAM } from './curso-manychat-master-instagram';
import { CURSO_JAQUE_BLUE_CREACION_DE_CONTENIDO } from './curso-jaque-blue-creacion-de-contenido';
import { CURSO_100M_MONEY_MODELS } from './curso-100m-money-models';
import { CURSO_MATEO_MAFFIA_BYF } from './curso-mateo-maffia-byf';
import { CURSO_MASTER_MARCA_PERSONAL_5_0 } from './curso-master-marca-personal-5-0';
import { CURSO_SOCIAL_FUNNEL } from './curso-social-funnel';
import { CURSO_UGC_SIM_ACADEMY_DE_MINDSHFT } from './curso-ugc-sim-academy-de-mindshft';
import { CURSO_HACKEANDO_LA_EDICION } from './curso-hackeando-la-edicion';
import { CURSO_PROGRAMA_RAIO } from './curso-programa-raio';
import { CURSO_BIGSEO_ACADEMY } from './curso-bigseo-academy';
import { CURSO_BLUEHACKER } from './curso-bluehacker';
import { CURSO_MASTERYHAUS } from './curso-masteryhaus';
import { CURSO_STORIES_MASTER } from './curso-stories-master';
import { CURSO_CLAUDE_ACADEMY_2026 } from './curso-claude-academy-2026';
import { CURSO_CURSOS_HEYGEN } from './curso-cursos-heygen';
import { CURSO_METODO_FUKUDA_PODER_ORGANICO } from './curso-metodo-fukuda-poder-organico';
import { CURSO_IMAN_GADZHI_AGENCY_NAVIGATOR } from './curso-iman-gadzhi-agency-navigator';
import { CURSO_INSTITUTO_DE_COMUNICACION } from './curso-instituto-de-comunicacion';
import { CURSO_CREATOR_CLUB } from './curso-creator-club';
import { CURSO_TRILOGIA_DE_BRIAN_TRACY } from './curso-trilogia-de-brian-tracy';
import { CURSO_CREATIVOS_UGC_REALISTAS } from './curso-creativos-ugc-realistas';
import { RECURSOS_UGC } from './curso-ugc-recursos';
import { CURSO_ANALISIS } from './AnalisisNegocio';
import { CURSO_BRANDING } from './BrandingMaKo';

/**
 * La sección de lo PROPIO: método, marca y criterios de la casa.
 *
 * Tiene nombre porque se usa en dos lugares —el mapa de abajo y el filtro de lo
 * compartible— y un literal repetido en los dos se desincroniza el día que
 * alguien renombre la sección: el mapa quedaría bien y el filtro dejaría de
 * excluir nada, sin que nada avise.
 */
export const CATEGORIA_PROPIA = 'MaKo';

/**
 * Cómo se agrupan los cursos en el selector, por slug.
 *
 * ⚠️ Vive ACÁ y no en cada curso porque CUATRO de ellos (`avatarhype`, `masteryhaus`,
 * `anuncio-ganador`, `100ads-analisis`) están dentro de `curso.ts`, que no tiene
 * generador propio: se mantiene a mano y no hay script que le vuelva a escribir la
 * categoría. Acá queda además UN solo lugar donde se lee el mapa completo de secciones
 * en vez de nueve archivos.
 *
 * ⚠️ Y NO pongas acá un curso que tenga archivo propio: el override de este mapa GANA
 * sobre lo que el archivo declara, así que una regeneración con otra categoría no se
 * vería. `bluehacker` salió de acá el 22/08/2026 al migrar a `curso-bluehacker.ts`.
 *
 * (El texto anterior decía que `curso.ts` es «auto-generado». Es FALSO: ningún script
 * lo escribe. La razón real de que estos datos vivan acá es que no hay generador que
 * los emita, no que se pierdan. Ver docs/hallazgos-conocimiento.md.)
 *
 * Un curso que no esté en el mapa conserva la categoría que trae — no se le inventa
 * una ni se lo manda a un cajón «Otros».
 */
const CATEGORIA: Record<string, string> = {
  // Cursos de terceros sobre el negocio digital
  'aumenta-tu-valor-y-atv-advantage': 'Negocios digitales',
  'sell-your-knowledge': 'Negocios digitales',
  // IA y generación de piezas
  'claude-ai-rodrigo-rojo': 'Inteligencia Artificial',
  // Publicidad paga
  'anuncio-ganador': 'Anuncios',
  // Alcance sin pauta
  'inteligencia-viral-2026': 'Orgánico',
  // Agency Incubator es armar y vender una agencia de servicios: prospección, ventas y
  // entrega. Va con los otros dos de negocio y no en «Cursos externos», que agrupa por
  // procedencia y no por lo que alguien viene a buscar.
  'iman-gadzhi-agency-navigator': 'Negocios digitales',
  // El de Fukuda es de afiliación en Hotmart, pero lo que ENSEÑA —y lo que le da el
  // nombre— es tráfico orgánico: un módulo entero de introducción, otro de lanzamientos
  // orgánicos y los bonos de Instagram y YouTube. Va con Inteligencia Viral y no en una
  // sección «Afiliados» propia: una sección de un solo curso agrupa por modelo de negocio
  // y no por lo que alguien viene a buscar, que es el criterio de este mapa.
  'metodo-fukuda-poder-organico': 'Orgánico',
  // Posicionamiento en buscadores. Sección propia y no «Orgánico»: las dos son tráfico
  // que no se paga por click, pero el que busca SEO busca SEO — la disciplina, sus
  // herramientas y su vocabulario— y no «lo que no es pauta». Decisión del dueño.
  'bigseo-academy': 'SEO',
  // Trabajar sobre uno mismo: voz, comunicación, presencia. Decisión del dueño.
  'instituto-de-comunicacion': 'Desarrollo personal',
  // Edición de video, junto al de Guille Collado.
  'creator-club': 'Edición',
  // Idiomas. Sección propia y no «Cursos externos» (el default que emite el pipeline):
  // un curso de inglés no comparte criterio de búsqueda con ninguna otra sección, y el
  // cajón «externos» agrupa por PROCEDENCIA, que no es lo que nadie viene a buscar.
  'programa-raio': 'Idiomas',
  // Lo propio: método, marca y criterios de la casa
  '100ads-analisis': CATEGORIA_PROPIA,
  'vsl-landing': CATEGORIA_PROPIA,
  'analisis-negocio': CATEGORIA_PROPIA,
  'branding-mako': CATEGORIA_PROPIA,
  'construir-app': CATEGORIA_PROPIA,
  'avatares-que-se-parecen': CATEGORIA_PROPIA,
};

/**
 * Miniatura de los cursos que NO la declaran en su propio archivo.
 *
 * Misma razón que `CATEGORIA`: estos cursos viven en `curso.ts`, que es auto-generado,
 * así que el dato se pierde si se escribe ahí. Los cursos del pipeline sí la declaran
 * solos (`curso-a-portal.mjs` la emite cuando el archivo existe).
 *
 * Las tres son las tapas REALES, que las pasó el dueño. Antes de eso hubo dos
 * intentos peores y conviene que quede escrito: la del catálogo de la plataforma
 * traía el logo del sitio en vez de la tapa, y para las que no existían en ningún
 * lado se generó una tipográfica con la marca de la casa — mejor que buscar en un
 * buscador una imagen que no se puede verificar, pero peor que la de verdad.
 *
 * ⚠️ La extensión importa y no es libre: sale de los BYTES del archivo, no del
 * nombre. `Bluehackers.webp` era webp de verdad, pero `AvatarHype.jpg` podría no
 * haberlo sido — un `.jpg` que en realidad es webp no lo pinta bien ningún navegador.
 *
 * Los cursos de la sección MaKo van a propósito SIN miniatura.
 */
const PORTADA: Record<string, string> = {
  'anuncio-ganador': '/cono-portadas/anuncio-ganador.jpg',
};

/**
 * Quién dicta cada curso, para los que NO lo declaran en su título.
 *
 * Vive acá por la misma razón que los dos mapas de arriba: estos cursos están en
 * `curso.ts`, que es auto-generado, y lo que se escriba ahí se pierde en la próxima
 * regeneración.
 *
 * ⚠️ La forma «Curso - Autor» NO se inventa acá: es la misma que produce el pipeline
 * en `curso-a-portal.mjs` (`tituloConAutor`), y por eso también repite su regla de no
 * duplicar cuando el título YA nombra al autor. Si las dos formas divergieran, la
 * grilla mostraría dos convenciones distintas según de dónde vino cada curso — que es
 * exactamente lo que este archivo existe para evitar.
 *
 * Los de la sección propia van sin autor: son de la casa.
 */
/**
 * El TÍTULO que se muestra, cuando el del pipeline no es el que corresponde.
 *
 * ⚠️ Va acá y no en la ficha por la misma razón que `CATEGORIA` y `AUTOR`:
 * `curso-a-portal.mjs` REESCRIBE `curso-<slug>.ts` en cada corrida, y arma el título
 * como «<curso del plan> - <autor>». Puesto allá, dura hasta la próxima publicación.
 *
 * Y el `curso` del plan NO se puede tocar para arreglarlo: es lo que nombra la carpeta
 * de Drive (`<Curso> - <Autor>`), así que cambiarlo manda el pipeline a una carpeta que
 * no existe y re-sube los 35 videos.
 *
 * AvatarHype es UN curso, no dos. Sus dos academias —«Creativos UGC Realistas» y
 * «Creativos Animados»— se publicaban como dos tarjetas separadas, y son el mismo
 * proveedor y el mismo material: ahora la segunda entra como un módulo más del curso
 * (ver la fusión en el plan) y la grilla muestra una sola tarjeta con su nombre real.
 */
const TITULO: Record<string, string> = {
  'creativos-ugc-realistas': 'AvatarHype',
  /**
   * ⚠️ EL CURSO NO ES EL QUE DICE SU NOMBRE, y el portal tiene que decir lo que el
   * material ES.
   *
   * La plataforma de origen lo publica como «Agency Navigator» y bajo ese slug se bajó.
   * Pero en los videos el propio Iman Gadzhi dice **«Agency Incubator»** —34 veces, en 22
   * de las 26 clases— y «Agency Navigator» no aparece NI UNA VEZ. Son dos productos
   * distintos de la misma persona: Incubator es el anterior y más barato.
   *
   * Y eso explica de paso los «14 huecos»: la numeración del autor llega a ~40 y hay 26,
   * lo que se lee como un Navigator incompleto. No lo es — es otro curso, completo o no,
   * pero otro. El diagnóstico obvio (curso mutilado) era el equivocado.
   *
   * El slug se deja como está: es el de la plataforma y cambiarlo rompería el link de
   * cualquiera que ya lo tenga. Lo que se corrige es lo que se LEE.
   */
  'iman-gadzhi-agency-navigator': 'Iman Gadzhi - Agency Incubator',
};

const AUTOR: Record<string, string> = {
  masteryhaus: 'Sofía Contreras',
  bluehacker: 'Marcos Razzetti',
  'anuncio-ganador': 'Jan Schroeder',
};

// Sin acentos y en minúsculas, para que «Sofia» no se sume a un título que ya dice
// «Sofía». Comparar en crudo daría un «X - Autor» duplicado y nadie lo miraría dos veces.
const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const conAutor = (titulo: string, autor?: string) =>
  autor && !sinAcentos(titulo).includes(sinAcentos(autor)) ? `${titulo} - ${autor}` : titulo;

// curso.ts es AUTO-GENERADO desde transcripciones: los cursos escritos a mano
// viven en su propio archivo y se suman acá.
/**
 * El curso de Avatar Hype se REHIZO desde la academia el 2026-08-17 y pasó de 6
 * clases a 30, así que el viejo (`avatarhype`, dentro del auto-generado `curso.ts`)
 * sale de la grilla: son el mismo curso con dos cortes distintos, y dejar los dos
 * hace que alguien abra el desactualizado creyendo que es el bueno.
 *
 * ⚠️ Se excluye ACÁ y no borrándolo de `curso.ts`, que es auto-generado: un borrado
 * allá vuelve en la próxima regeneración, en silencio y sin que nadie lo note.
 *
 * Sus 13 recursos NO se perdieron: viven en `curso-ugc-recursos.ts` y se cuelgan del
 * curso nuevo unas líneas más abajo. Si se saca esta exclusión, vuelven a aparecer
 * DUPLICADOS —una vez en cada curso—, que es la razón de que estas dos decisiones
 * estén pegadas y no en dos lugares distintos.
 * ⚠️ ES UN MAPA, NO UN CONJUNTO, Y ESO ES EL ARREGLO DE UN 404 QUE ESTUVO VIVO.
 * Un `Set` contesta «este slug ya no va», y con eso alcanza para sacarlo de la grilla
 * — pero NO contesta la otra pregunta, que es la que importa: «¿y el que YA está
 * apuntando ahí?». Un curso no vive solo en la grilla: vive también en cada link
 * compartido, cada favorito y cada `?curso=` que alguien mandó por WhatsApp.
 *
 * Medido el 2026-08-22 contra la base de producción: el share id=4 (ws 1, modo
 * invitados, SIN revocar, 13 visitas) apunta a `avatarhype` y desde el deploy del
 * 17/08 17:11Z devuelve 404. La persona que tenía el link vio una página de error
 * durante cinco días.
 *
 * Y el contador de visitas NUNCA lo iba a delatar: `registrarVisita()` corre DESPUÉS
 * del `notFound()` en `app/compartido/[token]/page.tsx`, así que un golpe al 404 no
 * suma. Las 13 visitas son todas anteriores al quiebre. Un link roto y un link que
 * nadie abrió se ven EXACTAMENTE IGUAL desde la métrica.
 *
 * Con el Map, `buscarCurso` resuelve el nombre viejo al nuevo: la grilla sigue
 * mostrando uno solo (el filtro de abajo no cambió) y el link viejo aterriza donde
 * corresponde. Reemplazar es REDIRIGIR, no borrar.
 */
const REEMPLAZADOS = new Map<string, string>([['avatarhype', 'creativos-ugc-realistas']]);

/**
 * Cuelga una lista de recursos de un curso generado, en las DOS puntas.
 *
 * ⚠️ SON DOS COSAS Y OLVIDARSE DE LA SEGUNDA NO ROMPE NADA VISIBLE. El portal dibuja
 * los recursos en dos lugares distintos:
 *   · la sección «Recursos» del curso, que sale de `curso.recursos` (CursoPortal:409);
 *   · el bloque de cada clase, que sale de `clase.recursoSlugs` (CursoPortal:678).
 * Inyectar solo `recursos` deja la sección del curso llena y TODAS las clases sin su
 * material. No hay error, no hay hueco: hay un curso donde el PDF del módulo 3 existe
 * y no aparece en ninguna de las 32 clases de ese módulo.
 *
 * El dato para reconstruir el segundo ya viaja en el primero: cada recurso trae
 * `clases: [n, …]`. Acá se da vuelta ese índice.
 *
 * Pasó el 22/08/2026: regenerar BlueHacker de 233 a 404 clases borró sus 8 recursos Y
 * los `recursoSlugs` de 56 clases. Lo vio el dueño en la pantalla; ningún chequeo lo
 * miraba. Ver docs/hallazgos-conocimiento.md.
 */
const conRecursos = (curso: Curso, recursos: Recurso[]): Curso => {
  const porClase = new Map<number, string[]>();
  for (const r of recursos) {
    for (const n of (r as { clases?: number[] }).clases ?? []) {
      porClase.set(n, [...(porClase.get(n) ?? []), r.slug]);
    }
  }
  return {
    ...curso,
    recursos,
    // Se RESPETA lo que la ficha ya traiga: si el generador pudo colgar el recurso
    // solo (porque el archivo estaba en la carpeta local), ese dato manda.
    clases: curso.clases.map((c) => (c.recursoSlugs?.length || !porClase.has(c.n)
      ? c
      : { ...c, recursoSlugs: porClase.get(c.n) as string[] })),
  };
};

export const CURSOS_TODOS: Curso[] = [
  ...CURSOS.filter((c) => !REEMPLAZADOS.has(c.slug)),
  CURSO_VSL, CURSO_ANALISIS, CURSO_BRANDING, CURSO_PRODUCTO_APP, CURSO_AVATAR_APP,
  CURSO_CLAUDE_AI_RODRIGO_ROJO, CURSO_AUMENTA_TU_VALOR_Y_ATV_ADVANTAGE,
  CURSO_SELL_YOUR_KNOWLEDGE, CURSO_INTELIGENCIA_VIRAL_2026, CURSO_M5_95,
  CURSO_VENDER_POR_FB_E_IG_ADS, CURSO_MANYCHAT_MASTER_INSTAGRAM,
  CURSO_JAQUE_BLUE_CREACION_DE_CONTENIDO, CURSO_100M_MONEY_MODELS,
  CURSO_MATEO_MAFFIA_BYF, CURSO_MASTER_MARCA_PERSONAL_5_0, CURSO_SOCIAL_FUNNEL,
  CURSO_UGC_SIM_ACADEMY_DE_MINDSHFT, CURSO_HACKEANDO_LA_EDICION,
  CURSO_PROGRAMA_RAIO, CURSO_BIGSEO_ACADEMY, CURSO_INSTITUTO_DE_COMUNICACION,
  // ⚠️ Este curso YA NO se inyecta, y el porqué vale para el próximo: la inyección era
  // un parche sobre un diagnóstico incompleto. Se creyó que el problema era «la
  // regeneración borró los 8 recursos publicados»; el problema real era que el curso
  // tiene **92** en su plataforma y el portal publicaba 8. Restaurar los 8 dejaba el
  // agujero de 84 tapado y con cara de arreglado.
  //
  // Ahora los 91 bajados salen del pipeline (plan.pdfs → curso-a-drive → curso-a-portal),
  // que es donde tienen que estar: se regeneran solos y no hay una segunda lista que
  // mantener. La lección: antes de restaurar lo que había, preguntá cuánto DEBERÍA haber.
  CURSO_BLUEHACKER,
  CURSO_MASTERYHAUS,
  CURSO_STORIES_MASTER,
  CURSO_CLAUDE_ACADEMY_2026,
  CURSO_CURSOS_HEYGEN,
  CURSO_METODO_FUKUDA_PODER_ORGANICO,
  CURSO_IMAN_GADZHI_AGENCY_NAVIGATOR,
  CURSO_CREATOR_CLUB, CURSO_TRILOGIA_DE_BRIAN_TRACY,
  // Los recursos y el modo réplica se inyectan acá porque el archivo del curso lo
  // REESCRIBE `curso-a-portal.mjs` en cada corrida: puestos allá, duran hasta la
  // próxima. `replica` hace que el curso se vea con la pantalla de su plataforma de
  // origen en vez de con la grilla del portal — ver CursoReplica.tsx.
  { ...conRecursos(CURSO_CREATIVOS_UGC_REALISTAS, RECURSOS_UGC), replica: true },
].map((c) => ({
  ...c,
  categoria: CATEGORIA[c.slug] ?? c.categoria,
  portada: c.portada ?? PORTADA[c.slug],
  titulo: TITULO[c.slug] ?? conAutor(c.titulo, AUTOR[c.slug]),
}));

export const buscarCurso = (slug: string | null | undefined): Curso | undefined => {
  if (!slug) return undefined;
  // El salto por REEMPLAZADOS va ACÁ y no en cada pantalla: es el único punto por el
  // que pasan la grilla, el link compartido y el `?curso=` de la URL. Puesto en el
  // llamador, la próxima pantalla que resuelva un curso nace sin él.
  return CURSOS_TODOS.find((c) => c.slug === (REEMPLAZADOS.get(slug) ?? slug));
};

/**
 * Los dos cursos que NO se dibujan con `CursoPortal`: tienen vista propia.
 * Los slugs se nombran acá —y no sueltos en cada `if`— para que el portal y el
 * link compartido decidan por el MISMO dato.
 *
 *  • `analisis`: es un formulario interactivo con las 5 fases, no clases de
 *    video. Compartido, lo dibuja `AnalisisCompartido`.
 *  • `branding`: es una galería de archivos que viven en Storage. NO se
 *    comparte como curso: tiene su propio recurso de share (`recurso='branding'`,
 *    que resuelve por `Galeria`), porque el alcance puede ser una sección o una
 *    pieza suelta y no el curso entero.
 */
export const VISTA_PROPIA = {
  analisis: CURSO_ANALISIS.slug,
  branding: CURSO_BRANDING.slug,
} as const;

/**
 * Los cursos que puede ver alguien SIN LOGIN cuando se comparte la TAB ENTERA.
 *
 * Se queda afuera **toda la sección `CATEGORIA_PROPIA`** — el método, la marca y
 * los criterios de la casa. Es lo que pidió el dueño el 13/8/2026: un link
 * repartido a un tercero muestra la formación, no lo nuestro. Eso ya cubre a
 * Branding, que además no se podría servir aunque quisiéramos: su material son
 * bytes en un bucket privado que se piden a `/api/branding`, admin-only, así que
 * un invitado vería la galería vacía sin entender por qué. Branding tiene su
 * propio share (`recurso='branding'`), más fino: por sección o por pieza.
 *
 * ⚠️ Esto NO gobierna el share de UN curso suelto. Compartir un curso de esta
 * sección a propósito sigue funcionando —es un acto explícito, y su link ya está
 * repartido— y se corta revocándolo desde el modal. Lo que se filtra acá es qué
 * entra en el «compartí la tab», que es lo que nadie eligió curso por curso.
 *
 * Se calcula sobre `CURSOS_TODOS`, así que un curso nuevo entra solo: la
 * exclusión se declara por sección, nunca la inclusión por lista (una lista de
 * incluidos deja afuera en silencio a todo lo que nadie se acordó de sumar).
 */
export const CURSOS_COMPARTIBLES: Curso[] = CURSOS_TODOS.filter(
  // Dos condiciones y no una, porque son dos razones distintas: la sección es
  // una decisión de producto (puede cambiar), y Branding es una imposibilidad
  // técnica (no cambia). Si alguien saca Branding del mapa de secciones, la
  // primera deja de cubrirlo y la segunda lo sigue tapando.
  (c) => c.categoria !== CATEGORIA_PROPIA && c.slug !== VISTA_PROPIA.branding,
);
