// Arma `recursos.json` para un curso de /curso/ a partir de lo que la plataforma YA
// declaró en su API, y lo cruza con los archivos que hay en disco.
//
// Por qué existe: `curso-pdfs.mjs` nombra cada archivo con el título que lee del DOM del
// curso, y para eso necesita una pestaña abierta EN la página del curso con los módulos
// desplegados. Cuando esa pestaña no está —o está y los acordeones están cerrados— la
// asociación sale vacía y los archivos caen al nombre de respaldo: `recurso-01`,
// `recurso-02`, … El script avisa («Asocié 0 archivo(s) a su clase») pero no falla, así
// que la corrida termina en verde y el curso se publica con los recursos numerados.
//
// Ya pasó dos veces: los 38 de Iman Gadzhi y los 106 de la Certificación en Marketing
// Digital. En los dos casos los títulos de verdad estaban a mano todo el tiempo, en el
// volcado de la API que el propio pipeline había guardado al lado.
//
// ⚠️ EL CRUCE NO SE ADIVINA, SE VERIFICA. El nombre `recurso-NN` codifica la POSICIÓN en
// `plan.pdfs`, y `recursos-api.json` trae `file_size` de cada recurso. Se exige que el
// tamaño en disco coincida con el declarado: si no coincide, ese archivo se deja afuera y
// se informa. Un índice que mezcla dos recursos es peor que uno incompleto — el archivo
// se abre y el título dice otra cosa, y eso nadie lo audita después.
//
//   node <abs>\scripts\curso-recursos-indice.mjs --plan C:\cursos\<slug>\plan.json
//   node <abs>\scripts\curso-recursos-indice.mjs --plan … --escribir
//
// Sin --escribir solo informa (es un diagnóstico barato antes de tocar nada).

import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { enlacesDeRecursos } from './curso-comun.mjs';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const PLAN = arg('plan', '');
const ESCRIBIR = process.argv.includes('--escribir');
if (!PLAN || !existsSync(PLAN)) { console.error('\n  ✖ Falta --plan <plan.json>\n'); process.exit(1); }

// El BOM de PowerShell 5.1 mata a JSON.parse: ver la nota en curso-bajar.mjs.
const leer = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
const base = dirname(PLAN);
const plan = leer(PLAN);

const fApi = join(base, 'recursos-api.json');
const fMod = join(base, 'modulos-api.json');
if (!existsSync(fApi)) { console.error(`\n  ✖ No está ${fApi} — este script cruza contra el volcado de la API.\n`); process.exit(1); }
const api = leer(fApi);
const mods = existsSync(fMod) ? leer(fMod) : [];

const tituloMod = new Map(mods.map((m) => [m.id, m.title]));
const padreDe = new Map(mods.map((m) => [m.id, m.parent_module_id ?? null]));
const porId = new Map(api.map((r) => [r.id, r]));

// Dónde caen los archivos: `curso-pdfs.mjs` escribe en pdfs/, los de VIP en recursos/.
const dirs = ['pdfs', 'recursos'].filter((d) => existsSync(join(base, d)));
const enDisco = new Map();
for (const d of dirs) for (const f of readdirSync(join(base, d))) enDisco.set(f, join(base, d, f));

const items = [];
const sinArchivo = [];
const noCuadra = [];
const sinMeta = [];

enlacesDeRecursos(plan, base).forEach((url, i) => {
  let id = null;
  try { id = new URL(url).searchParams.get('id'); } catch { /* una URL rota no es un recurso */ }
  const meta = id ? porId.get(id) : null;
  const raiz = `recurso-${String(i + 1).padStart(2, '0')}`;
  const nombre = [...enDisco.keys()].find((f) => f.replace(/\.[^.]+$/, '') === raiz);

  if (!nombre) { sinArchivo.push(`${raiz} — ${meta?.title ?? '(sin metadata)'}`); return; }
  if (!meta) { sinMeta.push(nombre); return; }

  const bytes = statSync(enDisco.get(nombre)).size;
  // Tolerancia de 2 bytes: el tamaño declarado a veces redondea. Más que eso NO se
  // acepta — la coincidencia de tamaño es la ÚNICA prueba de que la posición no mintió.
  if (Math.abs(bytes - meta.file_size) > 2) {
    noCuadra.push(`${nombre}: disco ${bytes} B vs API ${meta.file_size} B  («${meta.title}»)`);
    return;
  }

  const padre = padreDe.get(meta.module_id);
  items.push({
    nombre,
    // Estos cursos cuelgan cada recurso de un MÓDULO, nunca de una lección: la API trae
    // `module_id` y no hay campo de lección. Decirlo explícito acá evita que el generador
    // caiga en su heurística de «la clase del prefijo numérico», que en BlueHacker colgó
    // 51 de 53 recursos de la clase equivocada.
    nivel: 'modulo',
    modulo: (padre ? tituloMod.get(padre) : tituloMod.get(meta.module_id)) ?? null,
    submodulo: padre ? (tituloMod.get(meta.module_id) ?? null) : null,
    tituloReal: meta.title,
    recursoId: meta.id,
    bytes,
    clave: 'posicion+bytes',
  });
});

const salida = { curso: plan.curso ?? plan.titulo ?? '', total: items.length, items };

console.log(`\n  ${salida.curso}`);
console.log(`  ${items.length} recurso(s) cruzados y VERIFICADOS por tamaño`);
if (sinArchivo.length) {
  console.log(`\n  ${sinArchivo.length} declarado(s) por la API y SIN bajar:`);
  for (const s of sinArchivo.slice(0, 30)) console.log(`      ${s}`);
  if (sinArchivo.length > 30) console.log(`      … y ${sinArchivo.length - 30} más`);
}
if (noCuadra.length) {
  console.log(`\n  ⚠️ ${noCuadra.length} con el tamaño DISTINTO al declarado — quedan afuera:`);
  for (const s of noCuadra) console.log(`      ${s}`);
}
if (sinMeta.length) console.log(`\n  ${sinMeta.length} en disco sin metadata en la API: ${sinMeta.slice(0, 8).join(', ')}`);

const huerfanos = [...enDisco.keys()].filter((f) => !items.some((x) => x.nombre === f));
if (huerfanos.length) console.log(`\n  ${huerfanos.length} archivo(s) en disco que no entraron: ${huerfanos.slice(0, 8).join(', ')}`);

if (!ESCRIBIR) { console.log('\n  (diagnóstico: sin --escribir no toqué nada)\n'); process.exit(0); }

const destino = join(base, 'recursos.json');
// ⚠️ NO se pisa a ciegas: si ya hay un índice, lo de antes puede tener correcciones a
// mano. Se fusiona por nombre y gana lo que YA estaba.
if (existsSync(destino)) {
  const viejo = leer(destino);
  const previos = new Map((viejo.items ?? []).map((i) => [i.nombre, i]));
  let conservados = 0;
  for (const it of items) if (previos.has(it.nombre)) { Object.assign(it, previos.get(it.nombre)); conservados++; }
  for (const [n, it] of previos) if (!items.some((x) => x.nombre === n)) items.push(it);
  salida.total = items.length;
  console.log(`  (había un recursos.json: conservé ${conservados} entrada(s) previas)`);
}
writeFileSync(destino, JSON.stringify(salida, null, 2), 'utf8');
console.log(`\n  → ${destino}  (${items.length} items)`);
console.log('\n  Ahora: curso-a-drive --solo-ids  y despues  curso-a-portal\n');
