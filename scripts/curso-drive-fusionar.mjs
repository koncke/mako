// Fusiona un curso del pipeline con una carpeta de Drive que YA existe y tiene su
// propia nomenclatura, y resuelve el id de Drive de TODAS las clases — las que ya
// estaban y las nuevas.
//
// Por qué existe: hay 41 cursos en el Drive del dueño, bajados a mano antes de este
// pipeline. Cuando uno de esos vuelve a aparecer, bajar el curso entero duplica
// decenas de GB sobre un espacio que ya es el cuello. «Vender Por FB E IG ADS» tenía
// 211 de 242 clases: bajar solo las 32 faltantes costó 3 GB en vez de 12.
//
// ⚠️ Lo que hace distinto a curso-a-drive.mjs, y por qué no alcanzaba aquél:
//
//   1. Los archivos viejos NO se llaman como los nombraría el pipeline. El de Drive
//      dice «1. Presentación.mp4» (numeración de su carpeta) y el plan espera
//      «212 - 01-Introducción.mp4» (orden global). Se cruzan por TÍTULO, no por
//      número.
//   2. El id se resuelve por RUTA, no por nombre suelto. `curso-a-drive.mjs` busca
//      `local_title = ?` en la base de Drive y, si hay varios, avisa «tomo el
//      primero». Acá eso sería un error silencioso y VISIBLE: hay cuatro archivos
//      llamados «1. Presentación» y nueve «Introducción al Módulo» en este curso, y
//      tomar el primero cuelga el video equivocado de una clase. La base tiene
//      `stable_parents`, así que se reconstruye la ruta y se desambigua con ella.
//
//   node <abs>\scripts\curso-drive-fusionar.mjs --plan C:\cursos\<slug>\plan.json \
//        --carpeta "ADS - Felipe Vergara"
//   …agregar --aplicar para copiar de verdad (sin él, simula).

import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const APLICAR = process.argv.includes('--aplicar');
const PLAN = arg('plan', '');
const DRIVE = arg('drive', 'G:\\My Drive\\MARKETING KONCEPT\\CURSOS');
const CARPETA = arg('carpeta', '');

if (!PLAN || !existsSync(PLAN)) { console.error('\n  ✖ Falta --plan <plan.json>\n'); process.exit(1); }
if (!CARPETA) { console.error('\n  ✖ Falta --carpeta "<nombre de la carpeta que YA existe en Drive>"\n'); process.exit(1); }

const plan = JSON.parse(readFileSync(PLAN, 'utf8').replace(/^\uFEFF/, ''));
const base = PLAN.replace(/[\\/]plan\.json$/i, '');
const dirCurso = join(DRIVE, CARPETA);
if (!existsSync(dirCurso)) { console.error(`\n  ✖ No existe ${dirCurso}\n`); process.exit(1); }

const limpio = (s) => String(s).normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
  .replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '').slice(0, 110) || 'sin-titulo';

// ── Normalización para cruzar títulos ────────────────────────────────────────
// Se saca el número de orden de los DOS lados (hasta dos veces: hay nombres como
// «02 1. Introducción») y se comparan solo las palabras con contenido.
const norm = (s) => String(s ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/^\s*\d{1,3}\s*[-.)]?\s*/, '')
  .replace(/^\s*\d{1,3}\s*[-.)]?\s*/, '')
  .replace(/\b\d{1,2}:\d{2}\b/g, '')
  .replace(/[^a-z0-9]+/gi, ' ').toLowerCase().trim();
const palabras = (s, n) => norm(s).split(' ').filter((w) => w.length > 2).slice(0, n).join(' ');
const cuerpo = (s) => palabras(s, 7);
// ⚠️ Igual que `norm` pero CONSERVANDO los números. Hace falta porque hay títulos
// donde el número ES lo único que distingue: en el módulo «3. Campañas de Mensajes»
// conviven «6. 4. Ascensión» y «7. 4. Ascensión». `norm` les saca el orden inicial
// (dos veces, por nombres tipo «02 1. Título») y las deja idénticas — con lo cual
// dos clases distintas competían por el mismo archivo. Este es el desempate final.
const normEstricto = (s) => String(s ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/gi, ' ').toLowerCase().trim();
// El plan prefija el módulo con su orden («12. IX. Potenciando…»); las carpetas que
// ya existen en Drive no lo llevan. Se saca acá y no en cada uso.
const sinPrefijoMod = (s) => String(s ?? '').replace(/^\s*\d{1,3}\.\s*/, '').trim();

// ── La base local de Drive, con RUTA ─────────────────────────────────────────
const dbDeDrive = () => {
  const DFS = join(process.env.LOCALAPPDATA ?? '', 'Google', 'DriveFS');
  const buscar = (dir, prof = 0) => {
    if (prof > 3 || !existsSync(dir)) return null;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) { const r = buscar(p, prof + 1); if (r) return r; }
      else if (e.name === 'metadata_sqlite_db') return p;
    }
    return null;
  };
  return buscar(DFS);
};
// Un id de Drive de verdad, no el placeholder «local-46973» que la base pone ANTES
// de subir. Aceptarlo hizo reportar «20/20 OK» con cero archivos arriba.
const esIdReal = (id) => /^[A-Za-z0-9_-]{20,}$/.test(String(id ?? ''));

const indiceDrive = () => {
  const src = dbDeDrive();
  if (!src) return { error: 'no encontré metadata_sqlite_db' };
  const tmp = join(tmpdir(), `fus-${process.pid}.db`);
  copyFileSync(src, tmp);           // Drive la tiene lockeada
  const db = new DatabaseSync(tmp, { readOnly: true });
  const items = new Map();          // stable_id -> { id, titulo, carpeta }
  for (const r of db.prepare(`SELECT stable_id, id, local_title, is_folder, trashed FROM items WHERE trashed = 0`).all()) {
    items.set(String(r.stable_id), { id: r.id, titulo: r.local_title ?? '', carpeta: Number(r.is_folder) === 1 });
  }
  const padre = new Map();
  for (const r of db.prepare(`SELECT item_stable_id, parent_stable_id FROM stable_parents`).all()) {
    padre.set(String(r.item_stable_id), String(r.parent_stable_id));
  }
  db.close();
  try { unlinkSync(tmp); } catch { /* da igual */ }

  // Ruta completa de un item, subiendo por los padres. Con tope: un ciclo en la
  // base colgaría el script sin decir por qué.
  const rutaDe = (sid) => {
    const out = [];
    let cur = sid, guarda = 0;
    while (cur && guarda++ < 30) {
      const it = items.get(cur);
      if (!it) break;
      out.unshift(it.titulo);
      cur = padre.get(cur);
    }
    return out;
  };
  return { items, rutaDe };
};

console.log(`\n  Curso  : ${plan.curso}`);
console.log(`  Carpeta: ${dirCurso}`);
console.log(`  Modo   : ${APLICAR ? 'APLICAR' : 'simulación (agregá --aplicar)'}\n`);

// ── 1. Qué hay en la carpeta de Drive, en disco ──────────────────────────────
const enDisco = [];
const walk = (dir, rel = '') => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, rel ? `${rel}/${e.name}` : e.name);
    else if (/\.(mp4|m4v|mov|mkv|webm)$/i.test(e.name)) enDisco.push({ rel, nombre: e.name, ruta: p });
  }
};
walk(dirCurso);
console.log(`  En Drive: ${enDisco.length} videos`);

// ── 2. Cruzar plan ↔ disco ───────────────────────────────────────────────────
// Se agrupan los del disco por título; NUNCA un Set, porque los títulos se repiten
// (nueve «Introducción al Módulo», cuatro «Presentación») y un Set tapa ocho con una.
const porTitulo = new Map();
for (const d of enDisco) {
  const k = cuerpo(d.nombre.replace(/\.[^.]+$/, ''));
  if (!porTitulo.has(k)) porTitulo.set(k, []);
  porTitulo.get(k).push(d);
}

// ⚠️ El módulo NO se compara por igualdad. La plataforma guarda sus títulos
// TRUNCADOS a ~31 caracteres («I. Traffickers Profesionales vs») y la carpeta de
// Drive tiene el nombre entero («I. Traffickers Profesionales vs Traffickers
// Principales»). Con `===`, ningún módulo desempataba y 32 clases se resolvían al
// primer candidato que apareciera — o sea, potencialmente al video equivocado.
const encaja = (a, b) => {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  return x === y || x.startsWith(y) || y.startsWith(x);
};

const emparejadas = new Map(); // n -> item de disco
const faltantes = [];
const ambiguas = [];
for (const c of plan.clases) {
  const cands = porTitulo.get(cuerpo(c.titulo)) ?? [];
  const libres = cands.filter((x) => !x.usado);
  if (!libres.length) { faltantes.push(c); continue; }
  // Se puntúa: el módulo raíz vale más que el submódulo, y el submódulo desempata
  // entre clases homónimas del MISMO módulo («1. Presentación» en cuatro lugares).
  const puntuado = libres.map((x) => {
    const partes = String(x.rel).split('/').filter(Boolean);
    let p = 0;
    // El título COMPLETO manda sobre todo lo demás. La clave de agrupación usa las
    // primeras 7 palabras, y eso junta a «… con código (Paso #2)» con «(Paso #3)»
    // y hasta con «(Paso #6)»: lo que las distingue queda justo afuera del corte.
    const nombreSinExt = x.nombre.replace(/\.[^.]+$/, '');
    // El título EXACTO, números incluidos, es la señal más fuerte que hay.
    if (normEstricto(nombreSinExt) === normEstricto(c.titulo)) p += 8;
    if (norm(nombreSinExt) === norm(c.titulo)) p += 4;
    if (partes[0] && encaja(partes[0], sinPrefijoMod(c.modulo))) p += 2;
    if (c.submodulo && partes[1] && encaja(partes[1], c.submodulo)) p += 1;
    return { x, p };
  }).sort((a, b) => b.p - a.p);

  const mejor = puntuado[0];
  const empatados = puntuado.filter((q) => q.p === mejor.p);
  // Un empate en CERO es no tener ninguna señal: se elige igual (el título ya
  // coincide) pero se reporta, porque es el único caso que podría colgar mal.
  if (libres.length > 1 && (empatados.length > 1 || mejor.p === 0)) {
    ambiguas.push({ c, n: libres.length, p: mejor.p });
  }
  mejor.x.usado = true;
  emparejadas.set(c.n, mejor.x);
}
console.log(`  Emparejadas: ${emparejadas.size}/${plan.clases.length} · faltan ${faltantes.length}`);
if (ambiguas.length) {
  console.log(`  ⚠ ${ambiguas.length} con varios candidatos y sin módulo que desempate:`);
  for (const a of ambiguas.slice(0, 6)) console.log(`      n=${a.c.n} «${a.c.titulo.slice(0, 50)}» (${a.n} candidatos)`);
}

// ── 3. Copiar las que faltan, respetando la convención de la carpeta ─────────
// El nombre del módulo va SIN el «N. » que agrega el plan: las carpetas que ya
// existen se llaman «VIII. Cómo vender…», no «13 VIII. Cómo vender…». Meterle el
// prefijo dejaría dos convenciones conviviendo en la misma carpeta.

let copiadas = 0, yaEstaban = 0;
const nuevas = [];
const fallidas = [];
for (const c of faltantes) {
  const local = join(base, 'video', `${c.archivo}.mp4`);
  if (!existsSync(local)) { console.log(`  ✖ n=${c.n} no está bajada localmente`); continue; }
  const sub = c.submodulo ? limpio(sinPrefijoMod(c.submodulo)) : '';
  const dirDst = join(dirCurso, limpio(sinPrefijoMod(c.modulo)), sub);
  // El nombre conserva el orden DENTRO del módulo, como el resto de la carpeta.
  const dst = join(dirDst, `${limpio(c.titulo)}.mp4`);
  nuevas.push({ c, dst });
  if (existsSync(dst)) { yaEstaban++; continue; }
  if (APLICAR) {
    // ⚠️ Un fallo de copia NO puede abortar la fusión. Drive for Desktop devuelve
    // ECANCELED de vez en cuando —su filesystem virtual cancela mientras sincroniza—
    // y con una excepción suelta el script moría a mitad, dejando 12 de 31 copiadas
    // y sin resolver un solo id. Se reintenta, y lo que no salga se REPORTA al final
    // en vez de romper todo. Volver a correr retoma donde quedó (los que ya están se
    // saltean), así que un fallo cuesta un reintento, no la corrida.
    mkdirSync(dirDst, { recursive: true });
    let listo = false;
    for (let intento = 1; intento <= 3 && !listo; intento++) {
      try { copyFileSync(local, dst); listo = true; }
      catch (e) {
        if (intento === 3) { fallidas.push({ c, dst, err: e.code ?? e.message }); break; }
        await new Promise((r) => setTimeout(r, 1500 * intento));
      }
    }
    if (!listo) { console.log(`  ✖ ${basename(dst)} — ${fallidas.at(-1)?.err}`); continue; }
  }
  copiadas++;
  console.log(`  ${APLICAR ? '↑' : '·'} ${limpio(sinPrefijoMod(c.modulo))}\\${sub ? sub + '\\' : ''}${basename(dst)}`);
}
console.log(`\n  ${APLICAR ? 'Copiadas' : 'A copiar'}: ${copiadas} · ya estaban: ${yaEstaban}${fallidas.length ? ` · ✖ fallaron ${fallidas.length}` : ''}`);
if (fallidas.length) {
  console.log('  Fallaron (volvé a correr con --aplicar: retoma donde quedó):');
  for (const f of fallidas.slice(0, 8)) console.log(`      ${basename(f.dst)} — ${f.err}`);
}

if (!APLICAR) {
  console.log('\n  Simulación. Con --aplicar copia y después resuelve los ids.\n');
  process.exit(0);
}

// ── 4. Resolver el id de Drive de las 242, POR RUTA ──────────────────────────
const idx = indiceDrive();
if (idx.error) { console.error(`\n  ✖ ${idx.error}\n`); process.exit(1); }

const porNombre = new Map();
for (const [sid, it] of idx.items) {
  if (it.carpeta) continue;
  if (!porNombre.has(it.titulo)) porNombre.set(it.titulo, []);
  porNombre.get(it.titulo).push({ sid, ...it });
}

// Resuelve un archivo por su ruta relativa dentro de la carpeta del curso.
const idPorRuta = (relDir, nombre) => {
  const cands = (porNombre.get(nombre) ?? []).filter((x) => esIdReal(x.id));
  if (!cands.length) return null;
  if (cands.length === 1) return cands[0].id;
  // Varios con el mismo nombre → desempata la RUTA. Comparar normalizado porque
  // Drive guarda el título tal cual y el disco pudo sanear algún caracter.
  const esperado = [CARPETA, ...String(relDir).split('/').filter(Boolean)].map((x) => norm(x));
  for (const c of cands) {
    const ruta = idx.rutaDe(c.sid).map((x) => norm(x));
    if (esperado.every((seg) => ruta.includes(seg))) return c.id;
  }
  return null; // ambiguo y sin ruta que lo confirme: mejor nada que el equivocado
};

console.log('\n  Resolviendo ids de Drive por ruta…');
const clases = [];
const sinId = [];
for (const c of plan.clases) {
  const enDrv = emparejadas.get(c.n);
  const nueva = nuevas.find((x) => x.c.n === c.n);
  const relDir = enDrv ? enDrv.rel : (nueva ? `${limpio(sinPrefijoMod(c.modulo))}/${c.submodulo ? limpio(sinPrefijoMod(c.submodulo)) : ''}` : '');
  const nombre = enDrv ? enDrv.nombre : (nueva ? basename(nueva.dst) : null);
  if (!nombre) { sinId.push(c); continue; }
  const id = idPorRuta(relDir, nombre);
  if (!id) { sinId.push(c); continue; }
  clases.push({
    n: c.n, titulo: c.titulo, duracion: c.duracion, modulo: c.modulo, submodulo: c.submodulo,
    videoId: id, preview: `https://drive.google.com/file/d/${id}/preview`, archivo: nombre,
  });
}

console.log(`  ${clases.length}/${plan.clases.length} con id real${sinId.length ? ` · ⚠ ${sinId.length} sin id` : ''}`);
if (sinId.length) {
  console.log('  Sin id (Drive puede seguir subiendo las nuevas):');
  for (const c of sinId.slice(0, 10)) console.log(`      n=${c.n} ${c.titulo.slice(0, 55)}`);
}

// ⚠️ Un id repetido en dos clases significa que el cruce colgó el MISMO video de
// dos lecciones. Es el error que este script existe para no cometer, así que se
// chequea sobre la salida en vez de confiar en el algoritmo.
const vistos = new Map();
const repetidos = [];
for (const c of clases) {
  if (vistos.has(c.videoId)) repetidos.push([vistos.get(c.videoId), c]);
  else vistos.set(c.videoId, c);
}
if (repetidos.length) {
  console.error(`\n  ✖ ${repetidos.length} id(s) de Drive repetidos entre clases distintas. NO escribo drive.json:`);
  for (const [a, b] of repetidos.slice(0, 8)) console.error(`      n=${a.n} y n=${b.n} → ${a.videoId}`);
  console.error('    Dos clases apuntando al mismo video es peor que una clase sin video.\n');
  process.exit(4);
}

writeFileSync(join(base, 'drive.json'), JSON.stringify({
  curso: plan.curso, carpeta: dirCurso, clases, recursos: [],
}, null, 2), 'utf8');
console.log(`\n  → ${join(base, 'drive.json')}\n`);
