// =============================================================================
// La reunión que se agendó en horario de México para un cliente argentino
// =============================================================================
// 25/08/2026. El dueño: «Se agendó una reunión y se preseteó al horario de MEX,
// cuando ese cliente es de otro país. Y es MUY fácil que obtengas esa info si se
// tiene conexión a Google Calendar».
//
// Tenía razón en las dos mitades. La causa no era un cálculo mal hecho:
// `setTimezoneWorkspace` existía desde que se hizo multi-inquilino y **no tenía un
// solo call-site**. Nadie fijaba nunca la zona, así que TODOS los clientes caían al
// default (America/Tijuana, donde vive el primer cliente). Medido: de 8 workspaces,
// uno solo tenía zona, y estaba puesta a mano en la base.
//
// Y el dato estaba a una llamada: Cal.com contesta `timeZone: America/Buenos_Aires`
// con la key que el cliente YA tenía cargada, y el `timeZone` de Google viajaba en
// una respuesta que ya pedíamos y descartábamos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tzDeTelefono, splitTelefono } from '../lib/paises';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');

test('El teléfono da la zona SOLO donde el país tiene una sola', () => {
  assert.equal(tzDeTelefono('5492233550684'), 'America/Argentina/Buenos_Aires');
  assert.equal(tzDeTelefono('59899123456'), 'America/Montevideo');
  assert.equal(tzDeTelefono('34600123456'), 'Europe/Madrid');
});

test('Donde la lada NO dice la hora, se devuelve null en vez de adivinar', () => {
  // ⚠️ Lo que NO está en la tabla es lo importante. México tiene cuatro zonas y
  // Estados Unidos seis: un cliente de Tijuana y uno de Cancún comparten el +52 y
  // tienen tres horas de diferencia. Adivinar ahí es peor que el default, porque
  // se guarda y nadie lo vuelve a mirar.
  assert.equal(tzDeTelefono('5216862168122'), null, 'México (+52) no puede resolverse por lada');
  assert.equal(tzDeTelefono('12125551234'), null, 'Estados Unidos (+1) no puede resolverse por lada');
  assert.equal(tzDeTelefono('5511987654321'), null, 'Brasil (+55) no puede resolverse por lada');
  assert.equal(tzDeTelefono('56912345678'), null, 'Chile (+56) tiene dos zonas');
  assert.equal(tzDeTelefono(''), null);
  assert.equal(tzDeTelefono(null), null);
});

test('Toda zona de la tabla es una IANA que el runtime entiende', () => {
  // Un nombre mal escrito no rompe acá: rompe al formatear una fecha, semanas
  // después y en la pantalla de un cliente.
  const src = leer('../lib/paises.ts');
  const bloque = src.slice(src.indexOf('const TZ_POR_LADA'), src.indexOf('/** `542233550684`'));
  const zonas = [...bloque.matchAll(/'([A-Za-z]+\/[A-Za-z_/]+)'/g)].map((m) => m[1]);
  assert.ok(zonas.length > 20, `no se pudo leer la tabla (${zonas.length})`);
  for (const z of zonas) {
    assert.doesNotThrow(() => new Intl.DateTimeFormat('es', { timeZone: z }), `zona inválida: ${z}`);
  }
});

test('Y toda lada de la tabla existe en el catálogo de países', () => {
  // Si una lada se escribe mal, `splitTelefono` nunca la produce y esa fila es
  // código muerto que parece cobertura.
  const src = leer('../lib/paises.ts');
  const bloque = src.slice(src.indexOf('const TZ_POR_LADA'), src.indexOf('/** `542233550684`'));
  const ladas = [...bloque.matchAll(/'(\+\d+)':/g)].map((m) => m[1]);
  for (const l of ladas) {
    // Se prueba con un número real de esa lada: si splitTelefono no la reconoce,
    // la fila no se puede alcanzar nunca.
    const { lada } = splitTelefono(`${l.slice(1)}600123456`);
    assert.equal(lada, l, `la lada ${l} de TZ_POR_LADA no la produce splitTelefono`);
  }
});

// ── 11/10/2026 · la undécima tanda de Automations, decisión 4 de la décima ─────────────────────
// Lo de arriba (averiguar la zona en la LECTURA y guardarla) se dio vuelta: una lectura con efectos obligó a tres
// módulos de la API a reimplementar una lectura que no escribiera, y al motor a tener su propio default (Ciudad de
// México) para no pagar la carrera de red por tick. Ahora la zona se DETECTA del navegador de los admins propios del
// negocio (app/_components/zona-actions.ts) y, para los que nadie abre, de las integraciones del cliente
// (`inferirZonaDesdeIntegraciones`) y del backfill. `tzDeWorkspace` es LA lectura: una consulta, sin red.
//
// Probado rompiéndolo (11/10/2026), una rotura por vez con este archivo solo; base 7 pasan / 0 fallan:
//   T1. el teléfono antes que Meta en `averiguarZona`                                 → 6 / 1 (el orden de las fuentes)
//   T2. `tzDeWorkspace` vuelve a llamar a `inferirZonaDesdeIntegraciones`            → 6 / 1 (la lectura no sale a la red)
//   T3. `inferirZonaDesdeIntegraciones` sin el `Promise.race` de 4 s                  → 6 / 1 (techo y sin escribir)
//   T4. el memo guarda una lectura fallida (`p.catch(() => {})`)                      → 6 / 1 (techo y sin escribir)

/** El cuerpo de una función de lib/timezone.ts, sin comentarios. */
const TZ = leer('../lib/timezone.ts').replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const cuerpoDe = (abre: string, cierra: string): string => {
  const i = TZ.indexOf(abre);
  assert.ok(i >= 0, `no encontré «${abre}» en lib/timezone.ts`);
  const f = TZ.indexOf(cierra, i + abre.length);
  return TZ.slice(i, f > i ? f : undefined);
};

test('La zona se INFIERE de las integraciones del cliente, por orden de autoridad', () => {
  // Lo que el cliente ELIGIÓ en su herramienta de agenda manda; después la cuenta publicitaria de Meta (su
  // `timezone_name`: el ws1 y el ws4 dicen America/Tijuana, el ws11 America/Cancun); el teléfono, ÚLTIMO.
  const inf = cuerpoDe('async function averiguarZona(', '\n}\n');
  const iCal = inf.indexOf('tzDeCalcom');
  const iGoo = inf.indexOf('tzDelCalendarioGoogle');
  const iMeta = inf.indexOf('cuentaMeta');
  const iTel = inf.indexOf('tzDeTelefono');
  assert.ok(iCal > 0 && iGoo > iCal && iMeta > iGoo && iTel > iMeta,
    'cambió el orden de las fuentes: Cal.com → Google → Meta → teléfono (el teléfono es una inferencia y va ÚLTIMO)');
  assert.match(inf, /timezoneName/, 'de Meta se usa la zona de la cuenta, no el país fiscal');
});

test('Una LECTURA de la zona no sale a la red ni escribe', () => {
  // `tzDeWorkspace` tiene ~53 llamadas en ~40 archivos: es `zonaDelNegocio` con su nombre de siempre.
  assert.match(cuerpoDe('export async function tzDeWorkspace(', '\n}\n'), /return zonaDelNegocio\(ws\);/);
  const lectura = cuerpoDe('const SIN_ZONA', 'export type ResultadoZona');
  for (const prohibido of ['inferirZonaDesdeIntegraciones', 'averiguarZona', 'fijarZonaDelNegocio', 'escribirZonaSi', '.insert(', '.update(', '.upsert(', 'fetch(']) {
    assert.ok(!lectura.includes(prohibido), `la lectura de la zona usa ${prohibido}`);
  }
  assert.match(lectura, /\.eq\('workspace_id', ws\)/, 'la zona se lee por workspace EXPLÍCITO');
});

test('La inferencia tiene techo y NO guarda: decide quien la usa, y un error de lectura no se memoriza', () => {
  const inf = cuerpoDe('export function inferirZonaDesdeIntegraciones(', '\n}\n');
  assert.match(inf, /Promise\.race/, 'la inferencia perdió su techo de tiempo: puede frenar una pantalla');
  assert.match(inf, /setTimeout\(\(\) => r\(null\), 4000\)/);
  const fuentes = cuerpoDe('async function averiguarZona(', '\n}\n');
  assert.ok(!/fijarZonaDelNegocio|escribirZonaSi|setSetting|\.upsert\(|\.insert\(/.test(inf + fuentes), 'la inferencia guarda lo que averiguó');
  // «No pude leer» no es un valor: se devuelve el default SIN memorizarlo.
  assert.match(TZ, /p\.catch\(\(\) => \{ if \(memo\.get\(ws\)\?\.p === p\) memo\.delete\(ws\); \}\);/);
});
