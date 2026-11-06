// =============================================================================
// Los tickets de Leandro se ejecutan sin esperar a Martín (26/10/2026)
// =============================================================================
// Martín, desde el Centro (13:19): «los tickets que vengan de Leandro pasen 100% sin mi aprobación, es decir, todo lo que
// Leandro suba a la tiquetera lo ejecutes directamente sin preguntarme... y tú después le tienes que ir avisando... por el grupo
// de WhatsApp de MaKo los tickets que ya van siendo resueltos». Esto fija:
//   1. un ticket de su negocio (ws 10) va al arreglo automático sea bug, pedido o pregunta, con la marca de la regla;
//   2. sigue esperando a Martín lo delicado (cobros, accesos, borrados, envíos), lo que escribe en producción y todo con el
//      interruptor apagado; sin la regla, nada cambia;
//   3. la marca se guarda y se ve (la bandeja, lo que lee el Cerebro), y el alta la toma del negocio;
//   4. desplegado, el aviso va a su grupo por el camino del equipo, con la prueba del hito.
//
// PROBADO ROMPIÉNDOLO (26/10/2026): ver el registro al final del archivo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { aprobadoPorRegla, clasificar, estadoInicial, leerTriage, sanearContexto, type EntradaTriage } from '../lib/tickets-reglas';

const RAIZ = join(import.meta.dirname, '..');
const leer = (p: string) => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const e = (titulo: string, descripcion = ''): EntradaTriage => ({ tipoDeclarado: null, declaradoPor: 'persona', titulo, descripcion, contexto: sanearContexto({}) });

test('1. un ticket de Leandro va al arreglo automático sea bug, pedido o pregunta, con la marca de la regla', () => {
  assert.equal(aprobadoPorRegla(10), 'Leandro');
  assert.equal(aprobadoPorRegla(3), null);
  assert.equal(aprobadoPorRegla(null), null);
  for (const [titulo, tipo] of [['Quiero que se pueda exportar la lista de leads', 'pedido'], ['¿Cómo hago para cambiar el logo?', 'pregunta'], ['El botón de guardar no funciona', 'bug']] as const) {
    const t = clasificar(e(titulo), { aprobadoPorRegla: 'Leandro' });
    assert.equal(t.tipo, tipo, titulo);
    assert.equal(t.autoArreglo, true, `${titulo}: esperó a Martín`);
    assert.equal(t.regla, 'Leandro');
    assert.equal(estadoInicial(t), 'en_curso');
    assert.ok(t.porque.some((p) => p.startsWith('Aprobado por regla: Leandro.')), 'sin la marca que lee Martín');
  }
});

test('2. lo delicado, lo que escribe en producción y el interruptor apagado siguen esperando a Martín; sin la regla, nada cambia', () => {
  for (const titulo of ['No me deja cobrar con tarjeta', 'Corrijan mis datos en la base de datos', 'Quiero que hagan una migración de mis contactos']) {
    const t = clasificar(e(titulo), { aprobadoPorRegla: 'Leandro' });
    assert.equal(t.autoArreglo, false, `${titulo}: salió sin Martín`);
    assert.equal(t.regla, undefined);
    assert.ok(t.porque.some((p) => p.startsWith('Aprobado por regla (Leandro), pero')), titulo);
  }
  assert.equal(clasificar(e('Quiero que se pueda exportar'), { aprobadoPorRegla: 'Leandro', apagado: true }).autoArreglo, false, 'con el interruptor apagado');
  const sin = clasificar(e('Quiero que se pueda exportar la lista de leads'));
  assert.equal(sin.autoArreglo, false, 'un pedido de otro negocio salió sin Martín');
  assert.equal(sin.regla, undefined);
});

test('3. la marca se guarda y se ve; el alta la toma del negocio', () => {
  const t = clasificar(e('Quiero que se pueda exportar'), { aprobadoPorRegla: 'Leandro' });
  assert.equal(leerTriage(JSON.parse(JSON.stringify(t)))?.regla, 'Leandro', 'la regla se pierde al leer lo guardado');
  // Desde el 27/10 también con `hastaUnDia` (Leila): tests/feedback-2710-tanda1.test.ts. Desde el 30/10 con `decideMartin` (el pedido
  // delegado desde el grupo que decide Martín: tests/despacho-grupo.test.ts, el 13).
  // Cada argumento por separado, adentro de la llamada al triage (5/11/2026: sumar `deAgencia` al final ponía rojo la línea entera).
  const db = sinComentarios(leer('lib/tickets-db.ts'));
  const i = db.indexOf('let triage = clasificar(');
  assert.ok(i >= 0, 'no encontré la llamada al triage en crearTicket');
  const llamada = db.slice(i, db.indexOf('\n', i));
  assert.match(llamada, /aprobadoPorRegla: reglaDelNegocio\(n\.identidad\.ws\)\?\.nombre \?\? null/, 'el alta no toma la regla del negocio');
  assert.match(llamada, /hastaUnDia: reglaDelNegocio\(n\.identidad\.ws\)\?\.hastaUnDia/, 'el alta no toma el tope de un día');
  assert.match(llamada, /[{,]\s*decideMartin\s*[,}]/, 'el alta no le pasa lo que decide Martín');
  assert.match(leer('app/tickets/bandeja/BandejaTickets.tsx'), /t\.triage\.regla \? `aprobado por regla: \$\{t\.triage\.regla\}`/, 'la bandeja no la muestra');
  assert.match(leer('scripts/tickets.ts'), /APROBADO POR REGLA \(\$\{triage\.regla\}\)[\s\S]*?NO lo reclasifiques/, 'el Cerebro no sabe que no lo devuelva');
});

test('4. desplegado, el aviso va a su grupo por el camino del equipo, con la prueba del hito', () => {
  const cierre = sinComentarios(leer('lib/tickets-cierre.ts'));
  const bloque = cierre.slice(cierre.indexOf('if (aprobadoPorRegla(ws)'));
  assert.ok(bloque.length > 20, 'el cierre no mira la regla');
  assert.match(bloque, /f\.canal !== 'whatsapp' && f\.estado === 'resuelto'\) \{\s*const hito = desplegados\.get\(f\.id\)/, 'sin la prueba del despliegue, o repetido por WhatsApp');
  assert.match(bloque, /avisarArregloAlGrupo\(\{ ws, clave: `ticket:\$\{f\.id\}`, texto: textoArregloAlGrupo\(f\), prueba, origen: 'ticketera', ws1Seguro: ws === 1 \}\)/);
});

// PROBADO ROMPIÉNDOLO (26/10/2026, base 4/0): la regla ignorada → 3 rojos (1, 2 y 3); sin mirar lo delicado → 1 rojo (2); sin lo que
// escribe en producción → 1 rojo (2); la regla también con el interruptor apagado → 1 rojo (2); `leerTriage` sin la regla → 1 rojo
// (3); el alta sin pasar el negocio → 1 rojo (3); el cierre sin el aviso al grupo → 1 rojo (4).
