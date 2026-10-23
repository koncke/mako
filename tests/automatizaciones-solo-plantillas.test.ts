// =============================================================================
// Ningún negocio arranca con automatizaciones: lo de fábrica es PLANTILLA (regla del 10/10/2026)
// =============================================================================
// Martín, textual (10/10): «Ningún negocio tiene que arrancar con ninguna automatización creada, para eso ya
// tenemos los templates». Y el 23/10, al ver «518 automatizaciones»: «Si existen las creó MaKo... revisa si por
// defecto al ingresar un cliente se le están creando automatizaciones que no deberían».
//
// Lo medido el 23/10 (docs/hallazgos-chatbot.md → «Las 518 automatizaciones»): hoy NINGÚN camino crea filas solo;
// lo que sembraba el alta en julio (el ws10 nació con 5, en el mismo segundo que el negocio) ya está archivado.
// Esto es lo que impide que vuelva, y no estaba escrito en ningún lado:
//
//   1. Insertan en `nutricion_secuencias` (lib/ y app/) SÓLO los creadores conocidos, y cada uno lo dispara una
//      persona: la galería y la sugerencia del CRM (plantilla-crear), duplicar, la copia entre negocios y las
//      estrellas (flujo-copia-negocio), ＋Nueva / Crear con IA / la API de MaKo con confirmación
//      (setting-secuencias) y los audios del onboarding confirmados en el chat (secuencias-audios). Un creador
//      nuevo entra a la lista a conciencia, con su motivo.
//   2. El ALTA de un negocio, el ONBOARDING, los CRON y los WEBHOOKS no llaman a ningún creador ni insertan: son
//      los caminos que corren sin que la persona pida una automatización.
//   3. El arnés del P0 (corre en el ws3 de producción) ARCHIVA su fila al terminar: pausarla sola dejaba una fila
//      viva por corrida, y así el ws3 juntó 370 en dos días.
//
// Lo que NO cubre: un cron que llame a una función intermedia que a su vez llame a un creador (el chequeo es por
// archivo, no por grafo de llamadas). Por eso el 1 es una lista cerrada: un creador nuevo se ve acá.
//
// ⚠️ PROBADOS ROMPIÉNDOLOS (23/10/2026, base en verde: 3 de 3), una rotura por vez:
//   · un `.from('nutricion_secuencias').insert(` en lib/alta-cliente.ts → 2 fallos (tests 1 y 2);
//   · `import { crearDesdePlantilla } from './plantilla-crear'` en lib/workspace.ts → 1 fallo (test 2);
//   · sacar el `archivada_at` del finally del arnés → 1 fallo (test 3).
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';

const RAIZ = resolve(import.meta.dirname, '..');
const rel = (p: string) => relative(RAIZ, p).replaceAll('\\', '/');

function archivos(dir: string): string[] {
  const abs = join(RAIZ, dir);
  if (!existsSync(abs)) return [];
  const out: string[] = [];
  for (const n of readdirSync(abs)) {
    if (n === 'node_modules' || n.startsWith('.')) continue;
    const p = join(abs, n);
    if (statSync(p).isDirectory()) out.push(...archivos(rel(p)));
    else if (/\.tsx?$/.test(n)) out.push(p);
  }
  return out;
}

const INSERTA = /from\(\s*['"]nutricion_secuencias['"]\s*\)\s*\.(insert|upsert)\(/;
const CREADORES = /\b(crearDesdePlantilla|crearDesdeCopia|duplicarSecuencia|armarSecuenciasDeAudios|crearSecuenciaDesdeEtapa|crearSecuenciaVacia)\b/;

// Quién crea, y QUÉ persona lo dispara.
const INSERTADORES: Record<string, string> = {
  'lib/plantilla-crear.ts': 'la galería, la sugerencia del CRM y crear_automatizacion_desde_plantilla (confirmada en el chat)',
  'lib/secuencia-duplicar.ts': 'Duplicar, en el lienzo o con confirmación en el chat',
  'lib/flujo-copia-negocio.ts': 'pegar la copia de otro negocio y usar una creación con estrella',
  'lib/setting-secuencias.ts': '＋Nueva, Crear con IA y crear_secuencia_mensajes (confirmada)',
  'lib/secuencias-audios.ts': 'armar_secuencias_de_audios, confirmado por el dueño en el chat',
};

test('1 · insertan en nutricion_secuencias sólo los creadores conocidos (los dispara una persona)', () => {
  const encontrados = [...archivos('lib'), ...archivos('app')]
    .filter((p) => INSERTA.test(readFileSync(p, 'utf8')))
    .map(rel)
    .sort();
  assert.deepEqual(encontrados, Object.keys(INSERTADORES).sort(),
    'un archivo nuevo inserta automatizaciones: si lo dispara una persona, sumalo a INSERTADORES con su motivo; si corre solo (alta, cron, seed), es una PLANTILLA de lib/plantillas-automatizaciones.ts');
});

test('2 · el alta, el onboarding, los cron y los webhooks no crean automatizaciones', () => {
  const sinPedido = [
    join(RAIZ, 'lib/workspace.ts'), join(RAIZ, 'lib/alta-cliente.ts'), join(RAIZ, 'lib/partners.ts'),
    ...readdirSync(join(RAIZ, 'lib')).filter((n) => /^onboarding.*\.ts$/.test(n)).map((n) => join(RAIZ, 'lib', n)),
    ...archivos('app/api/onboarding'), ...archivos('app/api/cron'), ...archivos('app/api/webhooks'),
  ].filter(existsSync);
  assert.ok(sinPedido.length > 20, `la lista de caminos sin pedido quedó corta (${sinPedido.length}): ¿se movieron las carpetas?`);
  const culpables = sinPedido
    .filter((p) => { const s = readFileSync(p, 'utf8'); return INSERTA.test(s) || CREADORES.test(s); })
    .map(rel);
  assert.deepEqual(culpables, [], 'ningún negocio arranca con automatizaciones (Martín, 10/10): lo de fábrica va como plantilla');
});

test('3 · el arnés del P0 archiva su automatización al terminar', () => {
  const s = readFileSync(join(RAIZ, 'scripts/arnes-automatizacion-punta-a-punta.mts'), 'utf8');
  const fin = s.slice(s.lastIndexOf('} finally {'));
  assert.match(fin, /nutricion_secuencias[\s\S]*archivada_at/, 'sin archivarla, cada corrida deja una fila viva en el ws3');
});
