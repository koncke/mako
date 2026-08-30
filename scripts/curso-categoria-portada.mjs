// Le pone CATEGORÍA y PORTADA a los cursos, desde el catálogo de la plataforma.
//
//   node scripts/curso-categoria-portada.mjs --ver     # dice qué haría
//   node scripts/curso-categoria-portada.mjs           # escribe catalogo.ts y baja tapas
//
// ⚠️ POR QUÉ: el pipeline emite `categoria: 'Cursos externos'` como DEFAULT, que agrupa por
// PROCEDENCIA («vinieron de afuera») y no por lo que alguien viene a buscar — que es el
// criterio que el propio mapa de catalogo.ts tiene escrito. Con 48 cursos, 38 caían ahí:
// un cajón que no ayuda a encontrar nada.
//
// La categoría de verdad es un DATO y está en el catálogo de la plataforma
// (`category`), igual que la tapa (`cover_image`). No hay que adivinarla.
//
// ⚠️ Y NO se inventa la que no está. «Diferentes» y «Hustlers» son cajones de la
//    plataforma que no dicen qué se busca; los cursos que solo tienen eso se quedan con lo
//    que traen. Un cajón nuestro no es mejor que el suyo.
//
// ⚠️ La tapa se baja de `cover_image`, que es la GRANDE (1536x1024). Ya se pagó publicar la
//    miniatura de la grilla (456x256) por rasparla del HTML en vez de leer la columna:
//    13,5 veces menos píxeles en 18 de 21 cursos. Ver docs/hallazgos-conocimiento.md.

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const tiene = (n) => process.argv.includes(`--${n}`);
const REPO = process.cwd();
const DIR = join(REPO, 'app', 'conocimientos');
const CAT_TS = join(DIR, 'catalogo.ts');
const PORTADAS = join(REPO, 'public', 'cono-portadas');
const PLATAFORMA = 'C:\\cursos\\catalogo-plataforma-full.json';

const norm = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '');

// ── Plataforma → vocabulario de la app ──────────────────────────────────────────────
// Las cinco primeras ya existían en catalogo.ts y se respetan tal cual. Las nuevas nombran
// lo que alguien busca, no el modelo de negocio: «Ecommerce» y no «Dropshipping».
const EQUIVALE = {
  'IA': 'Inteligencia Artificial',
  'ADS': 'Anuncios',
  'Edición de Video': 'Edición',
  'Desarrollo personal': 'Desarrollo personal',
  'Idiomas': 'Idiomas',
  // Redes Sociales y Auto Youtube son lo mismo para el que busca: alcance SIN pauta.
  // Es la categoría que la app ya usa para Inteligencia Viral y el método Fukuda.
  'Redes Sociales': 'Orgánico',
  'Auto Youtube': 'Orgánico',
  // Agencias va con «Negocios digitales» porque la app ya puso ahí Agency Navigator, con
  // el porqué escrito: armar y vender una agencia es negocio, no una disciplina aparte.
  'Agencias': 'Negocios digitales',
  'Hustlers': 'Negocios digitales',
  'Ecommerce': 'Ecommerce',
  'Ventas': 'Ventas',
  // ⚠️ 'Marketing' NO está, y es la traducción que más obvia parece: en un portal donde
  //    TODOS los cursos son de marketing, «Marketing» no separa nada — es el nombre del
  //    portal, no el de una sección. Traducirlo 1:1 abrió dos veces una sección de un solo
  //    curso, y las dos veces hubo que moverlo a mano después (Black Box de Canva → Edición,
  //    Automatiza tu WhatsApp → Ventas). Un curso así cae en el cajón y la guarda de abajo
  //    lo grita, que es lo correcto: la sección sale de su MATERIAL y la elige una persona.
  // ⚠️ ESTAS TRES GUARDAN DECISIONES DE MARTIN, y por eso NO son la traducción obvia.
  //
  //    Sin ellas el mapeo recrea la sección cada vez que llega un curso nuevo de esa
  //    categoría de origen, y hay que volver a moverlo a mano. Pasó dos veces: «Marca
  //    personal» y «Lanzamientos» se vaciaron por pedido suyo y volvieron solas con el
  //    siguiente curso. Su reclamo, textual: «revisá las categorías, que no te pase más
  //    eso, ya lo hablamos».
  //
  //    El criterio que él viene aplicando —y que ya estaba escrito en catalogo.ts para el
  //    método Fukuda— es que una sección de UN curso agrupa por modelo de negocio y no por
  //    lo que alguien viene a buscar. Marca personal, lanzamientos y afiliación son todas
  //    formas de alcance sin pauta: van a «Orgánico», que es donde él las mandó.
  'Marca Personal': 'Orgánico',
  'Lanzamientos': 'Orgánico',
  'Afiliados': 'Orgánico',
  'Finanzas / Inversiones': 'Finanzas',
  'Trading': 'Finanzas',
  'Crypto': 'Finanzas',
  'Ciberseguridad': 'Ciberseguridad',
  'Wordpress': 'Desarrollo web',
  // 'Diferentes' NO está a propósito: no dice qué se busca. Ver la cabecera.
};

const plataforma = JSON.parse(readFileSync(PLATAFORMA, 'utf8'));
const idx = new Map();
for (const c of plataforma) {
  if (c.slug) idx.set(norm(c.slug), c);
  if (c.title && !idx.has(norm(c.title))) idx.set(norm(c.title), c);
}

// ── Encontrar un curso en el catálogo de la plataforma ──────────────────────────────
/**
 * ⚠️ PEDIR IGUALDAD EXACTA DEJÓ NUEVE CURSOS SIN DATO, Y EL CERO NO SE DISTINGUE DE
 *    «NO ESTÁ EN LA PLATAFORMA».
 *
 * Y la causa de fondo no era la exigencia de igualdad: era que **el índice se construía
 * con DOS claves y se consultaba con UNA**. Arriba se indexa por slug Y por título, y los
 * tres call-sites hacían `idx.get(norm(slug))` a secas. Tres cursos con el título idéntico
 * al de la plataforma —«Curso de Claude AI - Rodrigo Rojo» es exacto carácter por
 * carácter— se daban por inexistentes porque su slug no coincidía. La mitad del índice
 * nunca se leyó, y nada lo dice: un `Map` al que no le preguntás no se queja.
 *
 * Encima de eso sí está la fragilidad de la igualdad exacta, que explica el resto: nuestro
 * `certificacion-marketing-digital-ia` contra su «Certificación en Marketing Digital
 * potenciada por IA», nuestro `us30-2-0` contra su `curso-us30-2-0`.
 *
 * Medido el 30/08/2026: de 13 cursos que el script daba por «no está en la plataforma»,
 * NUEVE estaban. Y el mismo cruce decide la tapa, así que los 9 aparecían además en la
 * lista de «sin tapa en disco» — un bug, dos síntomas, y el segundo se reportó como
 * «hay muchos que no tienen portada».
 *
 * ⚠️ Y ACÁ NO SE PUEDE ELEGIR EL PRIMER CANDIDATO. La descripción de otro curso en la
 *    tarjeta de éste no da error ni 404: da un texto plausible y equivocado, que es
 *    exactamente cómo se publicaron recursos que abrían el PDF de otro curso. Por eso
 *    hacen falta DOS señales que no dependan una de la otra, y ante la duda se ABSTIENE.
 */
const RUIDO = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'con', 'en', 'para', 'por',
  'un', 'una', 'al', 'su', 'tu', 'lo', 'que', 'como']);
const palabras = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !RUIDO.has(w));

// Cuántos títulos de la plataforma contienen cada palabra. «mastery» está en muchos y no
// distingue nada; «avatar» está en dos y lo distingue todo. Sin este peso, «AVATAR MASTERY
// - Ava Digital» empataba con «ChatGPT & IA Mastery».
const DOCS = new Map();
for (const p of plataforma) for (const w of new Set(palabras(`${p.slug} ${p.title}`))) DOCS.set(w, (DOCS.get(w) ?? 0) + 1);
const pesoDe = (w) => Math.log(1 + plataforma.length / (1 + (DOCS.get(w) ?? 0)));

const mismoAutor = (a, b) => {
  const A = new Set(palabras(a)), B = new Set(palabras(b));
  if (!A.size || !B.size) return false;
  let n = 0;
  for (const w of A) if (B.has(w)) n++;
  return n >= 2 || (n === 1 && Math.min(A.size, B.size) === 1);
};

/** Devuelve `{ p, como }`, o `{ ambiguo: [...] }`, o `null`. Nunca elige a ciegas. */
const buscarEnPlataforma = (slug, titulo) => {
  const exacto = idx.get(norm(slug)) ?? idx.get(norm(titulo));
  if (exacto) return { p: exacto, como: 'exacto' };

  // Señal 1: uno de los dos slugs CONTIENE al otro ya normalizado. `curso-us30-2-0`
  // contiene a `us30-2-0`. Se exige largo mínimo para que «trading» no matchee a medio
  // catálogo, y que el que contiene sea UNO SOLO — si son varios, no es una señal.
  const n = norm(slug);
  if (n.length >= 12) {
    const dentro = plataforma.filter((p) => {
      const q = norm(p.slug || '');
      return q && (q.includes(n) || n.includes(q)) && Math.min(q.length, n.length) >= 12;
    });
    if (dentro.length === 1) return { p: dentro[0], como: 'slug contenido' };
    if (dentro.length > 1) return { ambiguo: dentro.map((p) => p.title) };
  }

  // Señal 2: parecido de título ponderado por rareza, y el AUTOR como confirmación
  // independiente — nuestros títulos lo llevan pegado («… - Rodrigo Rojo»).
  const mias = new Set(palabras(`${slug} ${titulo}`));
  const totalMio = [...mias].reduce((s, w) => s + pesoDe(w), 0);
  const autorNuestro = (titulo.split(' - ')[1] ?? '').trim();
  const cand = [];
  for (const p of plataforma) {
    const suyas = new Set(palabras(`${p.slug} ${p.title}`));
    let comun = 0;
    for (const w of mias) if (suyas.has(w)) comun += pesoDe(w);
    if (!comun) continue;
    const totalSuyo = [...suyas].reduce((s, w) => s + pesoDe(w), 0);
    const score = comun / Math.min(totalMio, totalSuyo);
    const autorOk = !!(autorNuestro && p.instructor && mismoAutor(autorNuestro, p.instructor));
    cand.push({ p, score, autorOk });
  }
  if (!cand.length) return null;
  cand.sort((a, b) => (b.autorOk - a.autorOk) || (b.score - a.score));
  const [top, seg] = cand;

  // Se acepta con las DOS señales, o con una sola si es abrumadora Y despegada del segundo.
  if (top.autorOk && top.score >= 0.35) return { p: top.p, como: 'título + autor' };
  const margen = seg ? top.score - seg.score : 1;
  if (top.score >= 0.75 && margen >= 0.25) return { p: top.p, como: `título (margen ${margen.toFixed(2)})` };

  // Hay parecido y no alcanza para decidir: se DICE, no se elige.
  return { ambiguo: cand.slice(0, 3).map((c) => `${c.p.title} (${c.score.toFixed(2)}${c.autorOk ? ', autor ✓' : ''})`) };
};

let cat = readFileSync(CAT_TS, 'utf8');
const NL = cat.includes('\r\n') ? '\r\n' : '\n';

// ⚠️ Y el comentario de arriba no es un control: esto lo es. Un `\r` colgado no rompe el
//    build ni el typecheck, así que sin esta guarda el archivo se escribe mal y nadie se
//    entera. Si aparece uno, no se escribe NADA.
const escribir = (texto) => {
  const suelto = /\r(?!\n)/.exec(texto);
  if (suelto) {
    const ini = texto.lastIndexOf('\n', suelto.index) + 1;
    console.error(`\n  ✖ CR suelto — NO escribo. Contexto: ${JSON.stringify(texto.slice(ini, suelto.index + 1))}\n`);
    process.exit(1);
  }
  writeFileSync(CAT_TS, texto, 'utf8');
};

// ⚠️ EL SALTO DE LÍNEA SE CAPTURA, NO SE ASUME QUE MIDE UNO. Con `\n};` fijo y un
//    archivo CRLF —que es como git deja TODO en disco acá, `core.autocrlf=true`— el punto
//    de inserción caía entre el `\r` y el `\n`, y cada bloque quedaba con un `\r` colgado:
//    una línea que es solo un retorno de carro. No rompe nada (el compilador lo trata como
//    espacio y el typecheck pasa) y no se ve en ningún listado — exactamente la forma de
//    falla de «en Windows, todo texto que cruza de una herramienta a otra trae \r».
const bloque = (nombre) => {
  const m = new RegExp(`const ${nombre}[^=]*=\\s*\\{([\\s\\S]*?)(\\r?\\n)\\};`).exec(cat);
  if (!m) return null;
  return {
    texto: m[1],
    fin: m.index + m[0].length - (m[2].length + 2),
    claves: new Set([...m[1].matchAll(/'([^']+)':\s*'/g)].map((x) => x[1])),
  };
};
const bCat = bloque('CATEGORIA');
const bPor = bloque('PORTADA');
if (!bCat) { console.error('\n  ✖ No encontré CATEGORIA en catalogo.ts\n'); process.exit(1); }

/**
 * Las fichas, con su slug REAL y su título.
 *
 * ⚠️ El nombre del archivo NO es el slug. `curso-producto-app.ts` declara
 *    `slug: 'construir-app'`, y una clave escrita con el nombre de archivo no la lee nadie:
 *    la categoría, la tapa o la descripción quedan puestas y no aparecen, sin ningún error.
 *    Es la misma trampa que «la unidad de un chequeo es la ENTIDAD, no el archivo».
 *
 * El título hace falta para el cruce flojo: es donde vive el autor.
 */
const IMPORTADAS = new Set([...cat.matchAll(/from '\.\/(curso-[^']+)'/g)].map((m) => m[1]));
const fichas = readdirSync(DIR)
  .map((f) => /^(curso-(.+))\.ts$/.exec(f))
  .filter(Boolean)
  // ⚠️ Un archivo en disco no es un curso del portal. `curso-creativos-animados.ts` quedó
  //    ahí después de fusionarse dentro de AvatarHype: el catálogo ya no lo importa, así
  //    que nadie lo ve. Sin este filtro el script le baja la tapa, le escribe el resumen y
  //    lo lista como pendiente — trabajo y ruido sobre algo que no existe para el usuario.
  .filter((m) => IMPORTADAS.has(m[1]))
  .map((m) => {
    const src = readFileSync(join(DIR, `${m[1]}.ts`), 'utf8');
    return {
      archivo: m[1],
      slug: /slug: '((?:[^'\\]|\\.)*)'/.exec(src)?.[1] ?? m[2],
      titulo: /titulo: '((?:[^'\\]|\\.)*)'/.exec(src)?.[1] ?? '',
      declaraPortada: /^\s*portada: '/m.test(src),
    };
  })
  .sort((a, b) => a.slug.localeCompare(b.slug));

// Las tapas que ya están en disco, por slug y con CUALQUIER extensión.
const yaEnDisco = new Map();
if (existsSync(PORTADAS)) {
  for (const f of readdirSync(PORTADAS)) yaEnDisco.set(f.replace(/\.[^.]+$/, ''), f);
}

const nuevasCat = [];
const bajarTapa = [];
const sinDato = [];
const ambiguos = [];
// El resultado del cruce se guarda por slug: lo usan la categoría, la tapa y el resumen,
// y buscarlo tres veces es tres oportunidades de que dos de ellas contesten distinto.
const enPlataforma = new Map();
for (const f of fichas) {
  const hit = buscarEnPlataforma(f.slug, f.titulo);
  if (hit?.ambiguo) ambiguos.push([f.slug, hit.ambiguo]);
  const p = hit?.p ?? null;
  enPlataforma.set(f.slug, hit ?? null);

  if (!bCat.claves.has(f.slug)) {
    const c = p && p.category && EQUIVALE[p.category];
    if (c) nuevasCat.push([f.slug, c, p.category]);
    else sinDato.push([f.slug, (p && p.category) || (hit?.ambiguo ? '(candidatos ambiguos — ver abajo)' : '(no está en la plataforma)')]);
  }
  // ⚠️ La extensión sale de los BYTES del origen y hay `.png` además de `.webp`/`.jpg`:
  //    preguntar por dos extensiones concretas es «existsSync no es un cruce» — daba
  //    falso sobre tapas que YA estaban y las volvía a bajar en cada corrida.
  const yaTiene = (bPor && bPor.claves.has(f.slug)) || yaEnDisco.has(f.slug);
  if (!yaTiene && p && p.cover_image) bajarTapa.push([f.slug, p.cover_image]);
}

console.log(`\n  ${fichas.length} curso(s) · ${nuevasCat.length} categoría(s) nueva(s) · ${bajarTapa.length} tapa(s) por bajar\n`);
for (const [s, c, orig] of nuevasCat) console.log(`     ${s.padEnd(44)} ${orig.padEnd(22)} → ${c}`);
// Los que salieron del cruce flojo se listan SIEMPRE, aunque no haya nada nuevo que
// escribir: un match por parecido es una decisión, y una decisión que nadie ve no se
// puede corregir. El «exacto» no se lista porque no es una decisión.
const flojos = fichas.filter((f) => enPlataforma.get(f.slug)?.p && enPlataforma.get(f.slug).como !== 'exacto');
if (flojos.length) {
  console.log(`\n  ${flojos.length} cruzado(s) por PARECIDO — revisá que sean el mismo curso:`);
  for (const f of flojos) {
    const h = enPlataforma.get(f.slug);
    console.log(`     · ${f.slug.padEnd(40)} [${h.como}]`);
    console.log(`       nuestro:  ${f.titulo}`);
    console.log(`       de ellos: ${h.p.title}`);
  }
}
if (ambiguos.length) {
  console.log(`\n  ⚠️  ${ambiguos.length} con candidatos AMBIGUOS — no elijo ninguno:`);
  for (const [s, lista] of ambiguos) console.log(`     · ${s}\n         ${lista.join('\n         ')}`);
}
if (sinDato.length) {
  console.log(`\n  ${sinDato.length} se quedan como están (no se les inventa categoría):`);
  for (const [s, por] of sinDato) console.log(`     · ${s.padEnd(44)} ${por}`);
}
if (tiene('ver')) { console.log('\n  (--ver: no escribí nada)\n'); process.exit(0); }

// ── 1. las categorías ───────────────────────────────────────────────────────────────
if (nuevasCat.length) {
  const texto = NL + '  // Puestas por scripts/curso-categoria-portada.mjs desde el `category` de la'
    + NL + '  // plataforma. El comentario al lado es la categoría de origen.' + NL
    + nuevasCat.map(([s, c, o]) => `  '${s}': '${c}',${' '.repeat(Math.max(1, 34 - s.length - c.length))}// ${o}`).join(NL) + NL;
  cat = cat.slice(0, bCat.fin) + texto + cat.slice(bCat.fin);
  escribir(cat);
  console.log(`\n  ✓ ${nuevasCat.length} categoría(s) escritas en catalogo.ts`);
}

// ── 2. las tapas ────────────────────────────────────────────────────────────────────
if (bajarTapa.length) {
  mkdirSync(PORTADAS, { recursive: true });
  let ok = 0;
  for (const [slug, url] of bajarTapa) {
    try {
      const r = await fetch(url);
      if (!r.ok) { console.log(`     ✖ ${slug}: HTTP ${r.status}`); continue; }
      const buf = Buffer.from(await r.arrayBuffer());
      // ⚠️ Una tapa de 0 bytes o un HTML de error se ven igual que un éxito desde `r.ok`.
      if (buf.length < 2000) { console.log(`     ✖ ${slug}: vino ${buf.length} B, no es una imagen`); continue; }
      const ext = /\.(webp|jpg|jpeg|png)/i.exec(url)?.[1]?.toLowerCase() ?? 'jpg';
      writeFileSync(join(PORTADAS, `${slug}.${ext === 'jpeg' ? 'jpg' : ext}`), buf);
      ok++;
      console.log(`     ✓ ${slug} (${(buf.length / 1024).toFixed(0)} KB)`);
    } catch (e) { console.log(`     ✖ ${slug}: ${e.message}`); }
  }
  console.log(`\n  ✓ ${ok}/${bajarTapa.length} tapa(s) bajada(s) a public/cono-portadas`);
}
// ── 3. enganchar las tapas que están en disco y nadie mira ──────────────────────────
// ⚠️ BAJAR EL ARCHIVO NO ES PONER LA PORTADA. El generador declara `portada` en la ficha
//    SOLO si el archivo ya existía el día que la emitió; una tapa que llega después queda
//    en disco sin que nada la nombre — y el síntoma es «algunos cursos no tienen
//    miniatura», que se lee como que la tapa no se bajó. Medido el 28/08/2026: 42 archivos
//    en `public/cono-portadas` y UNA sola entrada en el mapa.
//
//    Por eso se escribe en el mapa `PORTADA` de catalogo.ts y no se regenera la ficha: el
//    mapa existe justamente para sobrevivir a la próxima regeneración, que pisa el .ts.
// Se releen las DOS cosas que el propio script acaba de mover: el disco (la sección 2 bajó
// tapas nuevas) y el archivo (escribir CATEGORIA corrió los offsets del bloque de abajo).
const enDisco = new Map();
if (existsSync(PORTADAS)) {
  for (const f of readdirSync(PORTADAS)) enDisco.set(f.replace(/\.[^.]+$/, ''), f);
}
cat = readFileSync(CAT_TS, 'utf8');
const bPor2 = bloque('PORTADA');
const nuevasPor = [];
if (bPor2) {
  for (const f of fichas) {
    if (bPor2.claves.has(f.slug) || !enDisco.has(f.slug)) continue;
    // La ficha ya la declara: no se duplica el dato en dos lugares.
    if (f.declaraPortada) continue;
    nuevasPor.push([f.slug, enDisco.get(f.slug)]);
  }
}
if (nuevasPor.length) {
  const texto = NL + '  // Enganchadas por scripts/curso-categoria-portada.mjs: el archivo estaba en disco'
    + NL + '  // pero la ficha se había emitido antes de que existiera.' + NL
    + nuevasPor.map(([s, f]) => `  '${s}': '/cono-portadas/${f}',`).join(NL) + NL;
  cat = cat.slice(0, bPor2.fin) + texto + cat.slice(bPor2.fin);
  escribir(cat);
  console.log(`\n  ✓ ${nuevasPor.length} tapa(s) enganchada(s) en el mapa PORTADA`);
  for (const [s, f] of nuevasPor) console.log(`     · ${s.padEnd(44)} ${f}`);
} else {
  console.log(`\n  Todas las tapas de disco ya están enganchadas.`);
}

const sinTapa = fichas.filter((f) => !enDisco.has(f.slug)).map((f) => f.slug);
if (sinTapa.length) console.log(`\n  ${sinTapa.length} sin tapa en disco: ${sinTapa.join(', ')}`);

// ── 3b. el RESUMEN: de qué va el curso ──────────────────────────────────────────────
/**
 * La `short_description` de la plataforma, que es de dónde salen también la categoría y
 * la tapa. Sin ella la tarjeta sólo dice CUÁNTO material hay («33 clases en 2 módulos») y
 * no QUÉ se aprende, que es la pregunta de quien mira una grilla de 90 cursos.
 *
 * ⚠️ Los otros tres campos que trae la plataforma —`description`, `what_you_learn`,
 *    `requirements`— están VACÍOS en las 130 filas: existen en el esquema y no en el dato.
 *    Ir a buscar ahí un texto más largo devuelve la cadena vacía, no un error.
 *
 * ⚠️ Y no se inventa la que falta: un curso sin descripción se queda sin resumen. Ver el
 *    porqué en el comentario del mapa, en catalogo.ts.
 */
/**
 * El techo de 185 caracteres, que NO es un gusto: la portada del curso recorta la
 * descripcion a 3 lineas y en esa columna entran ~93 caracteres por linea. Lo que pase de
 * ahi no se lee en ningun lado.
 *
 * ⚠️ Y ESTO TENIA QUE SER AUTOMATICO. Las 87 descripciones se acortaron a mano el
 *    30/08/2026 y ese mismo dia la cola publico dos cursos nuevos con 452 y 473
 *    caracteres: un arreglo que hay que repetir a mano en cada curso nuevo no es un
 *    arreglo, es una tarea. Es la misma leccion que `curso-al-catalogo.mjs`, que se
 *    escribio para automatizar un paso manual y quedo como otro paso manual.
 *
 * ⚠️ RECORTA, NO REESCRIBE. Corta en un limite de clausula —punto o coma— y se queda con
 *    el prefijo mas largo que entre. Nunca agrega ni reformula: una descripcion que dice
 *    de menos sigue siendo cierta, una que dice de mas no. Si ni la primera clausula
 *    entra, se deja entera y se avisa: es preferible una linea larga a una frase cortada
 *    al medio.
 */
const TOPE_RESUMEN = 185;
const recortadas = [];
const recortar = (texto) => {
  if (texto.length <= TOPE_RESUMEN) return texto;
  // Los cortes posibles, de mayor a menor: el final de cada clausula que entre en el tope.
  let mejor = '';
  for (const m of texto.matchAll(/[.,;:]\s+/g)) {
    const hasta = m.index + 1;                 // se conserva el signo
    if (hasta > TOPE_RESUMEN) break;
    mejor = texto.slice(0, hasta);
  }
  if (!mejor) { recortadas.push([texto.length, null]); return texto; }
  const final = mejor.replace(/[,;:]$/, '.').trim();
  recortadas.push([texto.length, final.length]);
  return final;
};

cat = readFileSync(CAT_TS, 'utf8');
const bRes = bloque('RESUMEN');
const nuevasRes = [];
const sinResumen = [];
if (!bRes) console.log('\n  (no hay mapa RESUMEN en catalogo.ts — me lo salteo)');
else {
  for (const f of fichas) {
    if (bRes.claves.has(f.slug)) continue;
    // El cruce ya se hizo arriba: rehacerlo acá es la forma de que dos partes del mismo
    // script contesten distinto sobre el mismo curso.
    const d = (enPlataforma.get(f.slug)?.p?.short_description ?? '').replace(/\s+/g, ' ').trim();
    if (d) nuevasRes.push([f.slug, recortar(d)]);
    else sinResumen.push(f.slug);
  }
}
if (nuevasRes.length) {
  // La comilla simple es el delimitador del mapa, así que un apóstrofo adentro del texto
  // —«el día a día», «l'entreprise»— parte la cadena y rompe el build. Se escapa.
  const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const texto = NL + '  // Puestos por scripts/curso-categoria-portada.mjs desde la `short_description`'
    + NL + '  // del catálogo de la plataforma.' + NL
    + nuevasRes.map(([s, d]) => `  '${s}': '${esc(d)}',`).join(NL) + NL;
  cat = cat.slice(0, bRes.fin) + texto + cat.slice(bRes.fin);
  escribir(cat);
  console.log(`\n  ✓ ${nuevasRes.length} resumen(es) escrito(s) en el mapa RESUMEN`);
}
if (recortadas.length) {
  const cortadas = recortadas.filter((r) => r[1]);
  const enteras = recortadas.filter((r) => !r[1]);
  if (cortadas.length) console.log(`\n  ${cortadas.length} descripcion(es) recortada(s) al tope de ${TOPE_RESUMEN}: ${cortadas.map((r) => `${r[0]}→${r[1]}`).join(', ')}`);
  if (enteras.length) console.log(`  ⚠️  ${enteras.length} pasan de ${TOPE_RESUMEN} y NO se pudieron cortar en una clausula: quedaron enteras, revisalas a mano`);
}
if (sinResumen.length) {
  console.log(`\n  ${sinResumen.length} sin resumen (la plataforma no los describe, no se les inventa uno):`);
  console.log(`     ${sinResumen.join(', ')}`);
}

// ── 4. ¿quedó alguno en el cajón? ───────────────────────────────────────────────────
/**
 * ⚠️ «Cursos externos» ES EL DEFAULT DEL PIPELINE, Y NADIE LO MIRA.
 *
 * Un curso que la plataforma no conoce se publica ahí y no falla nada: aparece en la
 * grilla, con su tapa y sus clases, en una sección que agrupa por PROCEDENCIA. Se
 * descubre cuando el dueño abre el portal y lo ve — que es como se descubrió las dos
 * veces anteriores.
 *
 * Esto no lo puede arreglar el script solo: la categoría de un curso que la plataforma no
 * conoce sale de su MATERIAL, y eso lo decide una persona. Lo que sí puede es no dejar que
 * pase en silencio.
 */
const cat3 = readFileSync(CAT_TS, 'utf8');
const mapaCat = new Map([...(/const CATEGORIA[^=]*=\s*\{([\s\S]*?)\r?\n\};/.exec(cat3)?.[1] ?? '')
  .matchAll(/'([^']+)':\s*'([^']*)'/g)].map((x) => [x[1], x[2]]));
const enElCajon = [];
for (const f of fichas) {
  const src = readFileSync(join(DIR, `${f.archivo}.ts`), 'utf8');
  const propia = /categoria: '([^']*)'/.exec(src)?.[1] ?? '';
  if ((mapaCat.get(f.slug) ?? propia) === 'Cursos externos') enElCajon.push(f.slug);
}
if (enElCajon.length) {
  console.log(`\n  ⚠️  ${enElCajon.length} curso(s) quedaron en «Cursos externos» — hay que darles categoría a mano:`);
  for (const s of enElCajon) console.log(`     · ${s}`);
  console.log('     (la plataforma no los conoce: la categoría sale de lo que ENSEÑAN, y eso lo decide una persona)');
}

/**
 * ⚠️ Y LAS SECCIONES DE UN SOLO CURSO, que es el reclamo de verdad.
 *
 * «Cursos externos» es el caso obvio, pero el que se repite es otro: llega un curso con
 * una categoría de origen que Martín ya había vaciado —«Marca personal», «Lanzamientos»,
 * «Afiliados», «Marketing»— y la sección REAPARECE con un curso adentro. Pasó tres veces
 * en un día, y las tres las encontró él abriendo el portal.
 *
 * No se corrige solo a propósito: a dónde va depende de lo que el curso ENSEÑA, y sus
 * decisiones anteriores sobre la misma categoría de origen fueron a lugares distintos
 * (un «Marketing» fue a Negocios digitales y otro a Orgánico). Un mapeo automático ahí
 * estaría adivinando. Lo que sí se puede es que no pase en silencio.
 *
 * No se avisa de las que son de uno A PROPÓSITO: Idiomas y Ciberseguridad son disciplinas
 * enteras, no cajones. La lista está acá para que agregar una sea una decisión explícita.
 */
const DE_UNO_A_PROPOSITO = new Set([
  // Disciplinas enteras: quien busca inglés busca inglés, no «lo que no es otra cosa».
  'Idiomas', 'Ciberseguridad', 'SEO',
  // Las secciones de la casa. No salen del catálogo de la plataforma, no se comparten en
  // los links, y su tamaño no dice nada: son el método y la marca, no un cajón.
  'MaKo', 'Producto y construcción', 'VSL y Landing Page',
]);
const porSeccion = new Map();
for (const f of fichas) {
  const src = readFileSync(join(DIR, `${f.archivo}.ts`), 'utf8');
  const suSlug = f.slug;
  const cat = mapaCat.get(suSlug) ?? (/categoria: '([^']*)'/.exec(src)?.[1] ?? '');
  if (!cat || cat === 'Cursos externos') continue;
  porSeccion.set(cat, [...(porSeccion.get(cat) ?? []), suSlug]);
}
const deUno = [...porSeccion].filter(([c, xs]) => xs.length === 1 && !DE_UNO_A_PROPOSITO.has(c));
if (deUno.length) {
  console.log(`\n  ⚠️  ${deUno.length} sección/es con UN SOLO curso — revisá si corresponde:`);
  for (const [c, xs] of deUno) console.log(`     · «${c}»  →  ${xs[0]}`);
  console.log('     (una sección de un curso agrupa por modelo de negocio, no por lo que alguien busca)');
}

console.log(`\n  Verificá con:  npm run typecheck\n`);
