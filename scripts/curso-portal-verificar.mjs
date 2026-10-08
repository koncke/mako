// Revisa que TODOS los cursos del portal se vean bien, sin abrir el navegador.
//
//   node --import tsx scripts/curso-portal-verificar.mjs
//
// Cada chequeo de acá salio de algo que Martin reporto mirando la pantalla. La idea es que
// no haya que volver a mirarla: 115 cursos no se revisan a ojo, y el que mira dos veces la
// misma grilla deja de ver.
//
// ⚠️ SE IMPORTA EL CATALOGO DE VERDAD, no se parsea el .ts con regex. Un parser propio
//    contesta sobre su propia lectura del archivo —ya me paso hoy: un regex de `grupo:`
//    que tambien matcheaba `subgrupo:` casi me hace reportar 14 problemas inexistentes—.
//    Lo que se dibuja sale de estos objetos, asi que estos objetos son lo que hay que
//    mirar.
//
// ⚠️ Y `tsx` IGNORA `'use client'`, asi que esto NO reemplaza a `npm run build`: un import
//    de valor desde un componente cliente pasa por aca y muere en Vercel.
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
// ⚠️ En Windows un import() dinamico con ruta absoluta necesita file://: sin eso node
//    lee «c:» como un esquema de URL y tira ERR_UNSUPPORTED_ESM_URL_SCHEME.
// `CURSOS_TODOS` es exactamente lo que dibuja la grilla: `Conocimientos.tsx` lo importa
// como `TODOS`. Ya trae los REEMPLAZADOS afuera, asi que revisar esto es revisar lo que se ve.
const { CURSOS_TODOS: CURSOS, VISTA_PROPIA } = await import(pathToFileURL(join(REPO, 'app/conocimientos/catalogo.ts')).href);

const problemas = [];
const avisa = (curso, gravedad, que) => problemas.push({ curso: curso.slug, gravedad, que });

// Cuantas transcripciones hay de verdad, para no creerle al `hasTx`.
const txEnDisco = (id) => existsSync(join(REPO, 'public/cono-tx', `${id}.json`));

/**
 * Cuantos modulos declara el plan de origen de un curso. `null` si no hay plan a mano —que
 * no es lo mismo que cero: «no se» y «no tiene» son respuestas distintas y el informe las
 * dice distinto.
 *
 * El slug de la ficha y el de la carpeta no coinciden siempre: la ficha le saca el «curso-»
 * y a veces un «de-», asi que se prueban las tres formas.
 */
const modulosDelPlan = (slug) => {
  for (const d of [slug, `curso-${slug}`, `curso-de-${slug}`]) {
    const p = `C:/cursos/${d}/plan.json`;
    if (!existsSync(p)) continue;
    try {
      const plan = JSON.parse(readFileSync(p, 'utf8').replace(/^\ufeff/, ''));
      return new Set((plan.clases ?? []).map((x) => x.modulo).filter(Boolean)).size;
    } catch { return null; }
  }
  return null;
};

const vistos = new Map();

for (const c of CURSOS) {
  const clases = c.clases ?? [];

  // ── Identidad ───────────────────────────────────────────────────────────────────────
  if (vistos.has(c.titulo)) avisa(c, 'ALTO', `titulo repetido con «${vistos.get(c.titulo)}»: en la grilla se ven como dos veces el mismo`);
  else vistos.set(c.titulo, c.slug);

  // ── La tarjeta y la portada ─────────────────────────────────────────────────────────
  // Reportado el 30/08: «algunos no tienen miniatura».
  //
  // ⚠️ EL CAMPO ES `portada`, y la primera version de este chequeo miraba `tapa`, que no
  //    existe: marco 118 de 118. Cuando un chequeo marca TODO, el roto es el chequeo — y
  //    ese error es peor que no tener chequeo, porque 118 renglones de alarma se leen como
  //    ruido y esconden los tres que importan.
  // ⚠️ Una ficha PROPIA de MaKo sin portada no esta rota: `Card` tiene una variante sin
  //    imagen a proposito —«si la miniatura da 404, la tarjeta vuelve a la variante SIN
  //    imagen, no se queda con el marco vacio»— y esas seis se escribieron asi. Lo que si
  //    es un hueco es un curso EXTERNO sin tapa: ahi el pipeline tenia que traer una.
  if (!c.portada) avisa(c, c.categoria === 'MaKo' ? 'BAJO' : 'ALTO',
    c.categoria === 'MaKo' ? 'sin portada (ficha propia: sale la tarjeta sin imagen, es a proposito)'
      : 'sin portada: la tarjeta sale sin imagen y el pipeline tenia que traer una');
  else if (c.portada.startsWith('/') && !existsSync(join(REPO, 'public', c.portada.split('?')[0].slice(1)))) {
    avisa(c, 'ALTO', `la portada apunta a un archivo que no existe: ${c.portada}`);
  } else if (!c.portada.includes('/cono-portadas/')) {
    // `catalogo.ts` lo dice textual donde arma el fallback: «ES UN FALLBACK, NO LA FORMA DE
    // PONER UNA PORTADA». Se ve algo, y es el frame de una clase, no una tapa.
    avisa(c, 'BAJO', 'usa el fallback (un frame de clase), no una tapa propia');
  }

  // Reportado el 30/08: «los estas categorizando a todos como Cursos externos y eso esta
  // muy mal».
  if (!c.categoria || c.categoria === 'Cursos externos') {
    avisa(c, 'ALTO', `categoria generica («${c.categoria ?? 'ninguna'}»)`);
  }

  // El resumen entra en la portada del hero: largo rompe el diseno, y eso ya se pidio.
  if (!c.resumen) avisa(c, 'MEDIO', 'sin descripcion: el hero queda con el titulo solo');
  else if (c.resumen.length > 190) avisa(c, 'MEDIO', `descripcion de ${c.resumen.length} caracteres: rompe el hero (tope 185)`);

  // El titulo del hero. «Eleva tu vida con IA - Vishen, Vykintas Glodenis, Manon Dave» fue
  // el ejemplo textual de lo que no entra.
  const enHero = c.tituloCorto ?? c.titulo ?? '';
  if (enHero.length > 58) avisa(c, 'MEDIO', `titulo de ${enHero.length} caracteres en el hero: «${enHero.slice(0, 50)}…»`);

  // ── Las clases ──────────────────────────────────────────────────────────────────────
  if (!clases.length) {
    // ⚠️ Un curso sin `clases` no siempre es un curso vacio: las fichas propias de MaKo
    //    —«Analisis de Negocio», «Branding MaKo»— son documentos y se dibujan por otro
    //    lado. Distinguirlos es la diferencia entre un informe util y uno que hay que
    //    aprender a ignorar.
    //    (Antes miraba `c.replica`, que el catálogo ponía en TODOS los cursos: con eso todo curso sin
    //    clases salía «BAJO», también uno vaciado de verdad. El flag se fue el 08/10/2026; lo que dice
    //    que es una ficha de documento es tener VISTA PROPIA o recursos.)
    const esDoc = Object.values(VISTA_PROPIA).includes(c.slug) || (c.recursos?.length ?? 0) > 0;
    avisa(c, esDoc ? 'BAJO' : 'ALTO',
      esDoc ? 'sin clases (es una ficha de documento, no un curso de video)'
        : 'CERO clases: la ficha existe y el curso esta vacio');
    continue;
  }

  /**
   * Reportado el 29/08: «0 modulos» sobre cursos que si los tienen.
   *
   * ⚠️ SE COMPARA CONTRA EL PLAN, NO CONTRA CERO. La primera version avisaba cada vez que
   *    un curso no tenia modulos, y marco 8 que estan PERFECTOS: su plataforma de origen
   *    tampoco los agrupa, asi que dibujarlas sueltas es lo correcto. Un chequeo que marca
   *    comportamiento sano no es conservador, es ruido — y el ruido esconde lo que
   *    importa, que es el curso al que la ficha le PERDIO los modulos que el origen si
   *    tenia.
   */
  const modulos = new Set(clases.map((x) => x.grupo).filter(Boolean));
  if (!modulos.size && clases.length > 3) {
    const enPlan = modulosDelPlan(c.slug);
    if (enPlan > 0) avisa(c, 'ALTO', `el origen tiene ${enPlan} modulos y la ficha dibuja las ${clases.length} clases sueltas`);
    else if (enPlan === null) avisa(c, 'BAJO', `${clases.length} clases sueltas (no encuentro su plan para comparar)`);
    // enPlan === 0: el origen tampoco las agrupa. Esta bien y no se dice nada.
  }

  // Reportado el 28/08: «que en cada modulo se reinicie el contador».
  const porGrupo = new Map();
  for (const x of clases) if (x.grupo) porGrupo.set(x.grupo, [...(porGrupo.get(x.grupo) ?? []), x]);
  for (const [g, xs] of porGrupo) {
    const vns = xs.map((x) => x.vn).filter((v) => typeof v === 'number');
    if (vns.length === xs.length && vns.length > 1 && Math.min(...vns) !== 1) {
      avisa(c, 'BAJO', `el modulo «${String(g).slice(0, 30)}» empieza a numerar en ${Math.min(...vns)}, no en 1`);
    }
  }

  // La transcripcion: que lo que la ficha PROMETE exista. Es el bug que dejo 12 cursos con
  // la pestana vacia en produccion.
  const prometidas = clases.filter((x) => x.hasTx && x.videoId);
  const sinArchivo = prometidas.filter((x) => !txEnDisco(x.videoId));
  if (sinArchivo.length) avisa(c, 'ALTO', `${sinArchivo.length} clase(s) prometen transcripcion y el .json no esta`);

  // Y al reves: transcripciones que existen y la ficha no ofrece.
  const calladas = clases.filter((x) => !x.hasTx && x.videoId && txEnDisco(x.videoId));
  if (calladas.length) avisa(c, 'MEDIO', `${calladas.length} clase(s) TIENEN transcripcion y la ficha no la ofrece`);

  // Un video sin id no se puede reproducir: la clase abre y no pasa nada.
  const sinVideo = clases.filter((x) => !x.videoId);
  if (sinVideo.length) avisa(c, 'BAJO', `${sinVideo.length} clase(s) sin video (abren y no reproducen)`);

  // Titulos de clase vacios o duplicados dentro del mismo curso.
  const sinTitulo = clases.filter((x) => !String(x.titulo ?? '').trim());
  if (sinTitulo.length) avisa(c, 'ALTO', `${sinTitulo.length} clase(s) sin titulo`);
}

// ── Informe ───────────────────────────────────────────────────────────────────────────
const orden = { ALTO: 0, MEDIO: 1, BAJO: 2 };
problemas.sort((a, b) => orden[a.gravedad] - orden[b.gravedad] || a.curso.localeCompare(b.curso));

console.log(`\n  ${CURSOS.length} cursos en el portal · ${problemas.length} cosa(s) para mirar\n`);
if (!problemas.length) { console.log('  ✓ todos se ven bien.\n'); process.exit(0); }

let actual = '';
for (const p of problemas) {
  if (p.gravedad !== actual) { console.log(`  ── ${p.gravedad} ──`); actual = p.gravedad; }
  console.log(`     ${p.curso.padEnd(38)} ${p.que}`);
}
const altos = problemas.filter((p) => p.gravedad === 'ALTO').length;
console.log(`\n  ${altos} de gravedad ALTA (se ven mal a simple vista)\n`);
process.exit(altos ? 1 : 0);
