// =============================================================================
// «Misma persona» apagada por defecto, sin cambiarle nada a ninguna que existía, y en cualquier orden (23/10/2026)
// =============================================================================
// Martín: «"Misma persona" apagado por defecto» y «No quiero nada para todas las automatizaciones». El Cerebro decidió:
// las NUEVAS nacen con la suya apagada (`CONFIG_DE_NACIMIENTO`, `nacerConfigAutomatizacion`) y las que EXISTÍAN guardan como
// suya la que heredaban (`fijarPersonaPropia`, scripts/misma-persona-propia.mts). Y después: «que el orden no importe»
// (deploy antes o después del script). La condición: «el anti-ban efectivo antes y después, medido igual».
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  CONFIG_DE_NACIMIENTO, fijarPersonaPropia, personaHorasDeLaAutomatizacion, sanearConfigAutomatizacion, tieneRitmoPropio,
  tieneConfigPropia, PERSONA_SIN_ESPERA, type ConfigAutomatizacion,
} from '../lib/config-automatizacion';
import { limitesDeFabrica, limitesVigentes, type LimitesEnvio } from '../lib/limites-envio';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

/** LA REGLA DE HOY EN PRODUCCIÓN (antes de este commit), copiada: sin las suyas, las del negocio. */
const hoy = (c: ConfigAutomatizacion, n: LimitesEnvio) => ({
  whatsapp: c.personaHoras?.whatsapp ?? n.wa.personaHoras,
  email: c.personaHoras?.email ?? n.email.personaHoras,
});

const NEGOCIOS: LimitesEnvio[] = [
  limitesDeFabrica({}),
  limitesVigentes('{"wa":{"personaHoras":48},"email":{"personaHoras":72}}', limitesDeFabrica({})),
  limitesVigentes('{"wa":{"dia":65,"hora":15}}', limitesDeFabrica({})), // el ws1: sin horas propias del negocio
  limitesVigentes('{"wa":{"personaHoras":3},"email":{"personaHoras":1}}', limitesDeFabrica({})),
];
// Lo guardado, CRUDO como está en app_settings (pasa por el saneo, como en el motor y en el script).
const GUARDADOS: Array<string | null> = [
  null, '', '{}',
  '{"horario":{"activo":true,"desde":9,"hasta":21,"dias":[1,2,3,4,5]}}',
  '{"goteo":{"minutos":5,"dia":50}}',
  '{"personaHoras":{"whatsapp":0}}',
  '{"personaHoras":{"email":0}}',
  '{"personaHoras":{"whatsapp":36}}',
  '{"personaHoras":{"whatsapp":0,"email":0}}',
  '{"personaHoras":{"whatsapp":24,"email":48}}',
  '{"personaHoras":{"whatsapp":999,"email":"x"}}', // fuera de rango: el saneo lo saca (es «del negocio»)
  'no es json',
];

test('EN CUALQUIER ORDEN el anti-ban de cada automatización que existía es el de hoy: deploy sin script, script sin deploy, y los dos', () => {
  let casos = 0;
  for (const n of NEGOCIOS) for (const g of GUARDADOS) {
    const c = sanearConfigAutomatizacion(g);
    const r = fijarPersonaPropia(c, n);
    assert.ok(!('error' in r), `no se pudo fijar ${g}`);
    const conScript = r.cambia ? sanearConfigAutomatizacion(r.valor) : c;
    const esperado = hoy(c, n);
    // 1. Deploy ANTES del script: el código nuevo lee lo guardado de hoy.
    assert.deepEqual(personaHorasDeLaAutomatizacion(c, n), esperado, `deploy primero: cambió con ${JSON.stringify(n.wa)} y ${g}`);
    // 2. Script ANTES del deploy: el código de hoy lee lo que el script escribió.
    assert.deepEqual(hoy(conScript, n), esperado, `script primero: cambió con ${JSON.stringify(n.wa)} y ${g}`);
    // 3. Los dos: el código nuevo lee lo que el script escribió.
    assert.deepEqual(personaHorasDeLaAutomatizacion(conScript, n), esperado, `los dos: cambió con ${JSON.stringify(n.wa)} y ${g}`);
    // Lo demás de la configuración no se toca.
    assert.deepEqual(conScript.horario, c.horario);
    assert.deepEqual(conScript.goteo, c.goteo);
    casos++;
  }
  assert.equal(casos, NEGOCIOS.length * GUARDADOS.length);
});

test('idempotente: una segunda pasada no escribe, y la que ya tiene las suyas en los dos canales (una nueva) no se toca', () => {
  for (const n of NEGOCIOS) for (const g of GUARDADOS) {
    const r = fijarPersonaPropia(sanearConfigAutomatizacion(g), n);
    if (!r.cambia) continue;
    assert.deepEqual(fijarPersonaPropia(sanearConfigAutomatizacion(r.valor), n), { cambia: false }, `la segunda pasada vuelve a escribir ${g}`);
  }
  for (const n of NEGOCIOS) assert.deepEqual(fijarPersonaPropia(sanearConfigAutomatizacion(JSON.stringify(CONFIG_DE_NACIMIENTO)), n), { cambia: false }, 'el script prendió una nueva');
});

test('las NUEVAS nacen con la suya apagada, y así la leen el motor y la pantalla, con cualquier negocio', () => {
  const nace = sanearConfigAutomatizacion(JSON.stringify(CONFIG_DE_NACIMIENTO));
  assert.deepEqual(nace, { personaHoras: { whatsapp: PERSONA_SIN_ESPERA, email: PERSONA_SIN_ESPERA } }, 'el saneo no deja pasar lo que nace');
  for (const n of NEGOCIOS) assert.deepEqual(personaHorasDeLaAutomatizacion(nace, n), { whatsapp: 0, email: 0 });
  // La pantalla: con 0 h propias se ve apagada (y prender guarda el número que se ve, como suyo).
  const p = leer('app/automations/ConfigAutomatizacionPanel.tsx');
  assert.match(p, /const on = propio !== PERSONA_SIN_ESPERA;/);
  assert.match(p, /onCambio=\{\(x\) => guardar\('personaHoras', \{ \[canal\]: x \? valor : PERSONA_SIN_ESPERA \}\)\}/);
});

test('CADA alta de una automatización la hace nacer apagada (o copia la de su original): ninguna nace heredando', () => {
  // Los archivos de la app que insertan en `nutricion_secuencias`.
  const archivos = execFileSync('git', ['ls-files', 'lib', 'app'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' })
    .split('\n').filter((f) => /\.(ts|tsx)$/.test(f));
  const insertan = archivos.filter((f) => /from\(\s*['"]nutricion_secuencias['"]\s*\)\s*\.(insert|upsert)\(/.test(leer(f)));
  // Cada uno con su forma: nace apagada, recibe `nacer` por sus dependencias, o copia la de su original.
  const COMO: Record<string, RegExp> = {
    'lib/setting-secuencias.ts': /try \{ await nacerConfigAutomatizacion\(id\); \} catch/,
    'lib/secuencias-audios.ts': /try \{ await nacerConfigAutomatizacion\(\(nueva as \{ id: number \}\)\.id\); \} catch/,
    'lib/flujo-copia-negocio.ts': /if \(o\.configDe\) await copiarConfigAutomatizacion\(o\.configDe, id\);\n\s+else await nacerConfigAutomatizacion\(id\);/,
    'lib/plantilla-crear.ts': /await deps\.nacer\?\.\(nueva\.id\);/,
    // «Duplicar» es la copia de una del MISMO negocio: hereda la de su original (`copiarConfigAutomatizacion`).
    'lib/secuencia-duplicar.ts': /copiarConfig/,
  };
  assert.deepEqual(insertan.sort(), Object.keys(COMO).sort(), 'un alta nueva de una automatización: hacela nacer con `nacerConfigAutomatizacion` y sumala acá');
  for (const [f, rx] of Object.entries(COMO)) assert.match(leer(f), rx, `${f} no la hace nacer apagada`);
  // CUÁNTAS altas tiene cada archivo: una más en un archivo que ya está en la lista también tiene que nacer apagada.
  const ALTAS: Record<string, number> = { 'lib/setting-secuencias.ts': 2 };
  for (const f of insertan) {
    const n = (leer(f).match(/from\(\s*['"]nutricion_secuencias['"]\s*\)\s*\.(insert|upsert)\(/g) ?? []).length;
    assert.equal(n, ALTAS[f] ?? 1, `${f} tiene ${n} altas: cada una nace apagada (y se cuenta acá)`);
  }
  // Y ANTES del return: una llamada que quedó después de un `return` no corre.
  const ss = leer('lib/setting-secuencias.ts');
  for (const quien of ['crearSecuenciaDesdeEtapa', 'crearSecuenciaVacia']) {
    assert.match(ss, new RegExp(`if \\(error\\) throw new Error\\(\`${quien}: \\$\\{error\\.message\\}\`\\);\\n\\s+const id = \\(data as \\{ id: number \\}\\)\\.id;\\n[^\\n]*\\n\\s+try \\{ await nacerConfigAutomatizacion\\(id\\); \\} catch`), `${quien} vuelve antes de hacerla nacer`);
  }
  // Y cada llamador de la galería le pasa `nacer`.
  const llamadores = archivos.filter((f) => f !== 'lib/plantilla-crear.ts' && /crearDesdePlantilla\(/.test(leer(f)));
  assert.ok(llamadores.length >= 3);
  for (const f of llamadores) assert.match(leer(f), /crearDesdePlantilla\([^)]*?\{\n\s+db: [^\n]+\n\s+setPasos: setSecuenciaPasos,\n\s+setDisparadores: guardarDisparadores,\n\s+nacer: nacerConfigAutomatizacion,/, `${f} crea desde una plantilla sin hacerla nacer apagada`);
  // La que nace es ésta.
  assert.match(leer('lib/config-automatizacion-db.ts'), /await setSetting\(claveConfigAutomatizacion\(secuenciaId\), JSON\.stringify\(CONFIG_DE_NACIMIENTO\)\);/);
});

test('si las horas del negocio no entran en el rango de una automatización, no se escribe otra cosa: se dice', () => {
  const fuera: LimitesEnvio = { ...NEGOCIOS[0], wa: { ...NEGOCIOS[0].wa, personaHoras: 100 } };
  const r = fijarPersonaPropia({}, fuera);
  assert.ok('error' in r && /no entran en el rango/.test(r.error));
});

test('el aviso de Prospección mira el RITMO (horario o goteo), no la «Misma persona» con la que ahora nacen todas', () => {
  assert.equal(tieneConfigPropia(CONFIG_DE_NACIMIENTO), true);
  assert.equal(tieneRitmoPropio(CONFIG_DE_NACIMIENTO), false, 'una nueva de Prospección no avisaría nunca');
  assert.equal(tieneRitmoPropio({ goteo: { minutos: 5 } }), true);
  assert.equal(tieneRitmoPropio({ horario: null }), true);
  assert.match(leer('app/automations/ConfiguracionesBoton.tsx'), /return tieneRitmoPropio\(\(await getConfigAutomatizacionAction\(secuenciaId\)\)\.config\);/);
});

test('el script: simulacro por defecto, compare-and-set, idempotente y con la MISMA regla del motor para lo heredado', () => {
  const s = leer('scripts/misma-persona-propia.mts');
  assert.match(s, /const aplicar = process\.argv\.includes\('--aplicar'\);/);
  assert.match(s, /\.eq\('value', previo as string\)/, 'sin compare-and-set pisa un cambio hecho mientras tanto');
  assert.match(s, /const delNegocio = limitesVigentes\(lim\.data\?\.value \?\? null, fabrica\);/);
  assert.match(s, /fijarPersonaPropia\(sanearConfigAutomatizacion\(previo \?\? null\), delNegocio\)/);
  assert.equal((s.match(/\.eq\('workspace_id', ws\)/g) ?? []).length, 3, 'cada lectura y escritura con su negocio');
});
