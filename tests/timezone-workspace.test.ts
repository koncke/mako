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

test('La zona se AVERIGUA, y por orden de autoridad', () => {
  const src = leer('../lib/timezone.ts');
  // Sobre el CÓDIGO: la prosa de arriba nombra las tres fuentes para explicarlas y
  // desordenaría los índices. (Tercera vez en esta sesión que un test se dispara
  // contra su propio comentario — vale como recordatorio.)
  const codigo = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  // Lo que el cliente ELIGIÓ en su herramienta de agenda manda sobre cualquier
  // inferencia nuestra.
  const iCal = codigo.indexOf('tzDeCalcom');
  const iGoo = codigo.indexOf('tzDelCalendarioGoogle');
  const iTel = codigo.indexOf('tzDeTelefono');
  assert.ok(iCal > 0 && iGoo > iCal && iTel > iGoo,
    'cambió el orden de las fuentes: el teléfono es una inferencia y va ÚLTIMO');
  assert.match(src, /resolverYGuardarTz/, 'tzDeWorkspace volvió a devolver el default sin averiguar nada');
});

test('Un default que no se pudo verificar NO se guarda', () => {
  // Guardarlo convierte «no pude averiguarlo» en «esta es su zona», y eso ya no se
  // reintenta nunca. Es la regla de la casa aplicada acá: no poder leer un dato no
  // es un valor del dato.
  const src = leer('../lib/timezone.ts');
  const i = src.indexOf('if (!hallada) return TZ_DEFAULT;');
  assert.ok(i > 0, 'se perdió la salida sin guardar');
  const antes = src.slice(Math.max(0, i - 500), i);
  assert.ok(!/setTimezoneWorkspace/.test(antes), 'se guarda el default antes de comprobar que se averiguó');
  assert.match(src, /Promise\.race/, 'la averiguación perdió su techo de tiempo: puede frenar un render');
});
