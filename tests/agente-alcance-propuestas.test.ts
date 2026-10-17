// =============================================================================
// Un token «Solo leer» NO deja propuestas por las puertas viejas de /api/agente (17/10/2026)
// =============================================================================
// `POST /api/agente/plan` y `POST /api/agente/lead` resolvían el workspace del bearer y nunca
// miraban su ALCANCE: un token acuñado como «Solo leer» —cuya tarjeta le promete al cliente
// «no deja nada pendiente ni propone cambios»— dejaba propuestas de tareas y de leads igual.
// `/api/v1` sí lo miraba (`permite`); estas dos son anteriores al alcance y quedaron afuera.
//
// Dos mitades:
// 1. La regla pura (`rechazoPorAlcance`): lectura no alcanza para proponer; proponer,
//    ejecutar y el formato viejo sin letra (que ES proponer), sí.
// 2. El CABLEADO, leyendo el fuente: toda ruta de app/api/agente que llama a `crearPropuesta`
//    pide `rechazoPorAlcance(…, 'proponer')` ANTES de esa llamada. Se barre la carpeta entera:
//    una tercera ruta que proponga mañana entra sola al guard.
//
// Probado rompiéndolo (17/10/2026): sacando el chequeo de /lead, falla 1 de 3 («lead/route.ts
// propone sin mirar el alcance»); con `ORDEN[tiene] >= ORDEN[minimo]` cambiado a `>= 0`,
// falla 1 de 3 (la regla pura: lectura pasaba).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { rechazoPorAlcance } from '../lib/api-mako/alcance';

const HEX = 'a'.repeat(32);

test('rechazoPorAlcance: «Solo leer» no propone; proponer, ejecutar y el formato viejo sí', () => {
  const lectura = rechazoPorAlcance(`mkoag_l_${HEX}`, 'proponer');
  assert.ok(lectura, 'un token de lectura tiene que rebotar');
  assert.match(lectura, /Solo leer/);
  assert.equal(rechazoPorAlcance(`mkoag_p_${HEX}`, 'proponer'), null);
  assert.equal(rechazoPorAlcance(`mkoag_e_${HEX}`, 'proponer'), null);
  // El formato viejo, sin letra, es `proponer`: es lo que esos tokens hacían el día que nació el alcance.
  assert.equal(rechazoPorAlcance(`mkoag_${HEX}`, 'proponer'), null);
  // Lo que no es un prefijo conocido es lectura (fail-closed).
  assert.ok(rechazoPorAlcance('cualquier-cosa', 'proponer'));
});

test('cada ruta de /api/agente que crea una propuesta mira el alcance ANTES', () => {
  const base = join(process.cwd(), 'app', 'api', 'agente');
  const conPropuesta: string[] = [];
  for (const d of readdirSync(base)) {
    const f = join(base, d, 'route.ts');
    if (!existsSync(f)) continue;
    const src = readFileSync(f, 'utf8');
    const llamada = src.search(/crearPropuesta\(/);
    if (llamada < 0) continue;
    conPropuesta.push(d);
    const chequeo = src.search(/rechazoPorAlcance\(.*'proponer'\)/);
    assert.ok(chequeo >= 0 && chequeo < llamada, `${d}/route.ts propone sin mirar el alcance`);
  }
  // Si esto baja a cero, el guard dejó de ver las rutas (se movieron o cambió el nombre).
  assert.ok(conPropuesta.includes('plan') && conPropuesta.includes('lead'), `rutas vistas: ${conPropuesta.join(', ')}`);
});

test('el 403 lo devuelve la ruta, con el texto de la regla', () => {
  for (const d of ['plan', 'lead']) {
    const src = readFileSync(join(process.cwd(), 'app', 'api', 'agente', d, 'route.ts'), 'utf8');
    assert.match(src, /if \(fuera\) return NextResponse\.json\(\{ ok: false, error: fuera \}, \{ status: 403 \}\)/, d);
  }
});
