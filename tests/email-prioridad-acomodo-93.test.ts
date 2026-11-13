// =============================================================================
// Ticket #93 (13/11/2026): lo que le dejó a 34 leads nuevos de Mauricio sin su email, y las columnas que llegaron tarde
// =============================================================================
// Medido ese día en la base:
//   · EL TOPE DE EMAIL ES UNO POR NEGOCIO (500 por día, rodante). El 12/11 «Sprint correos · Fríos» (853 leads de junio a
//     octubre) mandó 398 a las 7 de Tijuana —su horario propio— y a las 9, cuando abre «Leads calientes · Email», quedaban
//     ~100: 34 de los 67 leads nuevos nunca recibieron el suyo. Ahora una lista fría deja el 20 % del día para los leads que
//     entraron por un canal en los últimos 7 días (lib/nutricion-prioridad.ts, el motor en lib/nutricion.ts).
//   · LAS COLUMNAS SÓLO MOVÍAN AL LLEGAR EL EVENTO. En «Sprint Ejecución» se eligieron a las 20:26 del 12/11, después de los
//     33 emails de las 17:02, y esos 33 quedaron en «Nuevo lead». Ahora, al elegirlas, lo que ya salió se acomoda
//     (`acomodarPorEmailsEnviados`, lib/email-eventos-crm.ts, desde `configurar_automatizacion`).
// Corre el motor REAL (`procesarEnvios`), la ruta REAL del webhook de Resend y el runner de la API sobre una base en memoria
// (tests/_email-campana-hijo.ts, escenarios «prioridad» y «acomodo»). Nada sale a la red.
// Correr: node --import tsx --test tests/email-prioridad-acomodo-93.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { esCalienteParaEmail, reservaEmailParaCalientes, emailSinLugar, textoPrioridadEmail, DIAS_CALIENTE_EMAIL } from '../lib/nutricion-prioridad';
import { eventoMasLejano, columnaParaAcomodar } from '../lib/email-eventos-crm-reglas';

const RAIZ = join(import.meta.dirname, '..');
const hijo = (esc: string) => {
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_email-campana-hijo.ts'), esc], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], timeout: 180_000,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;
};
const P = hijo('prioridad');
const A = hijo('acomodo');

test('1. la lista fría deja lugar: de un tope de 50 usa 40, y los leads nuevos que llegan después salen', () => {
  assert.equal(P.run1.frios, 40, 'sin la reserva se gastaba las 50');
  assert.equal(P.run1.nuevos, 0, 'todavía no les tocaba');
  assert.ok(P.run1.notas.includes('tope diario de email: lo que queda es para los leads nuevos'), 'dice por qué esperan los fríos');
  assert.equal(P.run2.nuevos, 5, 'a las «9» encuentran su lugar (el 12/11 encontraban el tope gastado)');
  assert.equal(P.run2.frios, 0, 'y la fría sigue sin pasar de su parte');
});

test('2. caliente para el email: entró por un canal en los últimos 7 días (o agendó); una lista vieja o importada, no', () => {
  const ahora = Date.parse('2026-11-12T15:00:00Z');
  // Los de «Fríos» de Mauricio: de junio a octubre, por formulario.
  assert.equal(esCalienteParaEmail({ created_at: '2026-07-14T10:00:00Z', origen_lead: 'instant_form' }, ahora), false);
  // Los de «Leads calientes»: del 12/11, por formulario.
  assert.equal(esCalienteParaEmail({ created_at: '2026-11-12T05:02:00Z', origen_lead: 'instant_form' }, ahora), true);
  assert.equal(esCalienteParaEmail({ created_at: '2026-11-06T16:00:00Z', origen_lead: 'instant_form' }, ahora), true, '6 días: los emails de bienvenida siguen');
  assert.equal(esCalienteParaEmail({ created_at: '2026-11-04T10:00:00Z', origen_lead: 'instant_form' }, ahora), false, `más de ${DIAS_CALIENTE_EMAIL} días`);
  assert.equal(esCalienteParaEmail({ created_at: '2026-11-12T10:00:00Z', origen_lead: null }, ahora), false, 'importado hoy: no es una entrada');
  assert.equal(esCalienteParaEmail({ created_at: '2026-07-14T10:00:00Z', origen_lead: 'instant_form', fecha_agenda: '2026-11-12' }, ahora), true, 'agendó');
});

test('3. la reserva: el 20 % del tope de hoy, sólo si hay leads nuevos; un caliente usa el tope entero', () => {
  assert.equal(reservaEmailParaCalientes({ topeDia: 500, hayCalientes: true }), 100);
  assert.equal(reservaEmailParaCalientes({ topeDia: 500, hayCalientes: false }), 0, 'una campaña sola usa su tope entero');
  assert.equal(reservaEmailParaCalientes({ topeDia: 1, hayCalientes: true }), 0);
  // El 12/11 de Mauricio: 500 de presupuesto. La fría para en 400; un nuevo sale hasta el 500.
  assert.equal(emailSinLugar({ caliente: false, enCorrida: 399, presupuesto: 500, reserva: 100 }), false);
  assert.equal(emailSinLugar({ caliente: false, enCorrida: 400, presupuesto: 500, reserva: 100 }), true);
  assert.equal(emailSinLugar({ caliente: true, enCorrida: 400, presupuesto: 500, reserva: 100 }), false);
  assert.equal(emailSinLugar({ caliente: true, enCorrida: 500, presupuesto: 500, reserva: 100 }), true);
  assert.match(textoPrioridadEmail(500), /Una lista fría usa como mucho 400 de los 500 del día: los otros 100 quedan para los leads nuevos\./);
});

test('4. el motor pregunta por el lead: la reserva no se saltea por el camino del tope', () => {
  const motor = readFileSync(join(RAIZ, 'lib', 'nutricion.ts'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(motor, /paso\.canal === 'email' && emailLlenoPara\(insc\.lead_id\)\)/);
  assert.doesNotMatch(motor, /const emailLleno = \(\): boolean => emailsEnCorrida >= presupuestoEmail;/, 'el tope sin la reserva');
  assert.match(motor, /const calientesEmail = conEmail\.length && presupuestoEmail > 0 \? await calientesParaEmail\(supabase\) : new Set<number>\(\);/);
});

test('5. columnas elegidas DESPUÉS de mandar: lo que ya salió se acomoda (abrió, clic, rebotó, le salió)', () => {
  assert.equal(A.enviados, 5);
  assert.deepEqual(A.antes, { 606: 'casa:em_entrada', 611: 'em_entrada', 612: 'em_entrada', 613: 'em_entrada', 614: 'em_entrada' }, 'sin columnas, nada se movía');
  assert.equal(A.ejec.ok, true);
  assert.deepEqual(A.despues, { 606: 'casa:em_enviado', 611: 'em_enviado', 612: 'em_abrio', 613: 'em_clic', 614: 'em_rebotado' }, 'agregados y casa');
  assert.match(A.ejec.resumen, /De los 5 leads que ya recibieron emails, moví 5 \(2 a «Enviado», 1 a «Abrió», 1 a «Hizo clic», 1 a «Rebotados»\)\./);
  assert.match(A.ejec2.resumen, /moví 0\./, 'guardar otra vez no mueve lo que ya está');
});

test('6. la regla del acomodo, sola: lo más lejos que llegó, y el escalón de abajo si esa columna no se eligió', () => {
  assert.equal(eventoMasLejano([]), null);
  assert.equal(eventoMasLejano([{}, { abierto_at: 'x' }]), 'abrio');
  assert.equal(eventoMasLejano([{ abierto_at: 'x', clic_at: 'y' }]), 'clic');
  assert.equal(eventoMasLejano([{ abierto_at: 'x' }, { rebotado_at: 'z' }]), 'rebote');
  // «Sprint Ejecución» eligió sólo enviado y abrió: quien hizo clic va a «Abrió correo».
  const etapas = [{ key: 'lead', label: 'Nuevo lead' }, { key: 'st0', label: 'Correo enviado' }, { key: 'st1', label: 'Abrió correo' }];
  assert.deepEqual(columnaParaAcomodar({ enviado: 'st0', abrio: 'st1' }, etapas, 'clic'), { evento: 'abrio', columna: 'st1' });
  assert.deepEqual(columnaParaAcomodar({ enviado: 'st0' }, etapas, 'abrio'), { evento: 'enviado', columna: 'st0' });
  // Un rebotado sin columna de rebotados no va a «Correo enviado»: no se mueve.
  assert.equal(columnaParaAcomodar({ enviado: 'st0', abrio: 'st1' }, etapas, 'rebote'), null);
});

test('7. configurar_automatizacion acomoda después de contestar (con una lista grande son cientos)', () => {
  const run = readFileSync(join(RAIZ, 'lib', 'api-mako', 'areas', 'chatbot.run.ts'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(run, /const acomodo = await acomodarEnSegundoPlano\(ctx\.ws, id\);/);
  assert.match(run, /after\(async \(\) => \{ await correr\(\); \}\);/);
});
