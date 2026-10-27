// =============================================================================
// Pedirle el avatar a MaKo lo arma con los clientes GANADOS (MAU-02 de Mauricio, 27/10/2026)
// =============================================================================
// Mauricio: «que redefina o defina mi avatar considerando los clientes que son ganados... no funciona al preguntar».
// `generarAvatares` nunca miraba a quién le vendió de verdad. Lo que fija:
//   1. `bloqueDeGanados` (lib/avatares-ganados.ts): con 3 o más ganados, el bloque AGREGADO (ticket, sexo, ingreso, lo más
//      contestado en el formulario, por dónde entraron), sin nombres, emails, teléfonos ni empresas; con menos, nada;
//   2. `generarAvatares` lo suma al pedido y, con él, el pedido va con `pii` (sólo IA que no entrena);
//   3. la pregunta como la escribió Mauricio trae la herramienta que los arma (`generar_avatares`), en la app y por WhatsApp.
//
// Probado rompiéndolo (27/10/2026): al pie del archivo.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { MINIMO_GANADOS, bloqueDeGanados, type GanadoParaAvatar } from '../lib/avatares-ganados';
import { clasificarIntencion } from '../lib/mako-intencion';
import { herramientasDelTurno } from '../lib/doer-herramientas';
import type { Vista } from '../lib/api-mako/registro';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');

const ganado = (x: Partial<GanadoParaAvatar> & { profesion?: string }): GanadoParaAvatar => ({
  sexo: 'mujer', ingreso_estimado: '2k-5k', monto_cierre_usd: 1500, pagina_registro: 'https://negocio-de-prueba.com/vsl?utm_source=ig',
  optin_respuestas: [
    { pregunta: '¿Cuál es tu nombre?', respuesta: 'Ana Pérez' },
    { pregunta: 'Tu email', respuesta: 'ana@correo.com' },
    { pregunta: '¿A qué te dedicás?', respuesta: x.profesion ?? 'coach' },
    { pregunta: 'WhatsApp', respuesta: '+54 9 11 5555-1234' },
  ],
  ...x,
});

test('1. con 3 o más ganados, el bloque agregado; con menos, nada (una anécdota no es un patrón)', () => {
  assert.equal(bloqueDeGanados([ganado({}), ganado({})].slice(0, MINIMO_GANADOS - 1)), '');
  const b = bloqueDeGanados([ganado({}), ganado({ profesion: 'Coach' }), ganado({ profesion: 'inmobiliaria', sexo: 'hombre', monto_cierre_usd: 500 }), ganado({ monto_cierre_usd: null })]);
  assert.match(b, /^LOS QUE YA TE COMPRARON/);
  assert.match(b, /Ganados en el CRM: 4; ticket promedio US\$1167 \(de 3 con monto\)/);
  assert.match(b, /Sexo \(de 4 con el dato\): mujer \(3\), hombre \(1\)/);
  assert.match(b, /«¿A qué te dedicás\?» \(contestaron 4\): coach \(3\), inmobiliaria \(1\)/, 'lo contestado, sin mayúsculas que separen');
  assert.match(b, /Por dónde entraron: \/vsl \(4\)/, 'la página, sin la UTM');
});

test('1. nada de contacto viaja: ni nombres, ni emails, ni teléfonos', () => {
  const b = bloqueDeGanados([ganado({}), ganado({}), ganado({})]);
  assert.doesNotMatch(b, /\bAna\b|Pérez|ana@correo|5555|\bnombre\b|\bemail\b|WhatsApp/i);
});

test('2. generarAvatares suma el bloque y, con él, el pedido va con `pii`', () => {
  const src = fuente('lib/avatares.ts');
  assert.match(src, /leerGanadosParaAvatar\(\)\.catch\(\(\) => \[\]\)/, 'una lectura que falla frena los avatares');
  assert.match(src, /const deLosGanados = bloqueDeGanados\(ganados\);/);
  assert.match(src, /\$\{deLosGanados \? `\\n\\n\$\{deLosGanados\}` : ''\}`;/, 'el bloque no llega al pedido');
  assert.match(src, /\.\.\.\(deLosGanados \? \{ pii: true \} : \{\}\),/, 'con datos de los clientes, el pedido iría a una IA que entrena');
});

function nombresDeSiempre(): string[] {
  const url = (rel: string) => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);
  const codigo = `import { MAKO_TOOLS } from ${url('lib/mako-tools.ts')}; import { MAKO_ACCION_TOOLS } from ${url('lib/mako-doer-acciones.ts')}; process.stdout.write(JSON.stringify([...MAKO_TOOLS, ...MAKO_ACCION_TOOLS].map((t) => t.name)));`;
  return JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', codigo], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 })) as string[];
}

test('3. la pregunta como la escribió Mauricio trae la herramienta que arma los avatares (app y WhatsApp)', () => {
  const deSiempre = nombresDeSiempre().map((name) => ({ name }));
  const PREGUNTAS = [
    'que redefina o defina mi avatar considerando los clientes que son ganados',
    'redefine mi avatar con los clientes ganados',
    'armame el avatar de cliente ideal con los que ya me compraron',
  ];
  for (const canal of ['app', 'whatsapp'] as const) {
    const vista: Vista = { canal, alcance: 'ejecutar', ws: 13, rol: 'admin', tabs: null };
    for (const m of PREGUNTAS) {
      const veredicto = clasificarIntencion(m, canal === 'app' ? { canal: 'app' } : {});
      const nombres = herramientasDelTurno({ veredicto, texto: m, agendaAbierta: false, deSiempre, vista, hayPendientes: false, contextoDelSi: null }).tools.map((x) => x.name);
      assert.ok(nombres.includes('generar_avatares'), `[${canal}] «${m}» → ${veredicto.intencion}: no trae generar_avatares (${nombres.slice(0, 8).join(', ')}…)`);
    }
  }
  // El avatar de un VIDEO o de un guion de anuncios es otro: esa regla no lo toma.
  for (const m of ['creá un video con el avatar Lucía', 'cambiá el avatar del guion de anuncios']) {
    assert.notEqual(clasificarIntencion(m, { canal: 'app' }).porque, 'pide armar o redefinir el avatar', `«${m}» cayó en el avatar del negocio`);
  }
});

// ── Probado rompiéndolo (27/10/2026) ─────────────────────────────────────────────────────────────────────────────────
// Cada cambio a mano, corrido y restaurado de memoria:
//   1. `bloqueDeGanados` sin el mínimo de 3 (una anécdota como patrón)   → rojo el 1 (el agregado).
//   2. las preguntas de contacto viajando (nombre, email, WhatsApp)       → rojo el 1 (nada de contacto).
//   3. el pedido sin `pii` con los ganados adentro                     → rojo el 2.
//   4. el bloque sin llegar al pedido                                     → rojo el 2.
//   5. la regla `PIDE_AVATAR` fuera (la pregunta de Mauricio, «consultar») → rojo el 3.
//   6. la regla tomando el avatar de un video                             → rojo el 3.
// La primera corrida dio rojo SIN romper nada en el 1: «Ana» sin bordes de palabra matcheaba «ganados».
