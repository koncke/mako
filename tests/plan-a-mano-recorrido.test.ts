// =============================================================================
// «6 meses gratis»: el plan COMPLETO, de punta a punta, con la fecha a la vista y un aviso ANTES de que terminen (30/10/2026)
// =============================================================================
// Martín le ofreció a Gabriela «acceso a la app gratis por 6 meses». El Cerebro, 30/10: «Verificá que la opción de 6 meses del
// diálogo dé el plan COMPLETO... Eso es plata que un cliente paga y no recibe», y P16: avisar antes de que terminen y mostrar
// la fecha. Corre con el código real sobre una base de mentira (tests/_plan-a-mano-hijo.ts): la ruta que dispara el diálogo, los
// frenos que usa cada pantalla y el cron.
//
// Probado rompiéndolo (30/10/2026): al pie del archivo.
// Correr: node --import tsx --test tests/plan-a-mano-recorrido.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DIAS_AVISO_REGALO, avisosFinDeRegaloCerca, fechaConAnio, regaloParaMirar, textoDePlanAMano, tocaAvisarFinDeRegalo, type PlanAMano } from '../lib/plan-a-mano-reglas';
import { paraMirar } from '../lib/clientes-plataforma-reglas';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/^[ \t]*\/?\*.*$/gm, '');
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--experimental-test-module-mocks', '--import', 'tsx', join(RAIZ, 'tests', '_plan-a-mano-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'],
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;

const TODO_PASA = { 'prueba.videos': true, 'prueba.tomas': true, 'prueba.avatares': true, 'prueba.imagenes': true, 'prueba.exportar': true, 'web.landings_publicadas': true };
const NADA_PASA = { 'prueba.videos': false, 'prueba.tomas': false, 'prueba.avatares': false, 'prueba.imagenes': false, 'prueba.exportar': false, 'web.landings_publicadas': false };
const DIA = 86_400_000;
const AHORA = Date.parse('2026-10-30T12:00:00.000Z');

test('el diálogo da el plan COMPLETO: ningún freno de la prueba, aunque ya haya gastado todo lo de la prueba', () => {
  assert.equal(R.darRegalo.status, 200);
  assert.equal(R.darRegalo.body.planAMano.regalo, true);
  assert.deepEqual(R.frenosRegalo, TODO_PASA);
  assert.equal(R.usoRegalo, 99, 'mientras dura no suma a la cuenta de la prueba');
  assert.deepEqual(R.resumenRegalo, { enPrueba: false }, 'sin el cartel de «Versión de prueba» ni la franja');
  assert.ok(R.gratisHasta, 'Tu plan dice hasta cuándo');
});

test('el control: la misma cuenta con 30 días sí frena; y los 6 meses vencidos sin resolver, también', () => {
  assert.equal(R.dar30.status, 200);
  assert.equal(R.dar30.body.planAMano.regalo, undefined);
  assert.deepEqual(R.frenos30, NADA_PASA);
  assert.equal(R.gratisHastaPrueba, null, 'una prueba no dice «gratis hasta»');
  assert.deepEqual(R.frenosVencido, NADA_PASA);
});

test('a quien ya paga (o está en su prueba con tarjeta) no se le dan: los 6 meses no frenan ese cobro, y se dice', () => {
  for (const r of [R.aQuienPaga, R.aQuienPrueba]) {
    assert.equal(r.status, 400);
    assert.match(r.body.error, /no frenan ese cobro/);
  }
  assert.equal(R.quedoSetting, 0, 'no se guardó nada');
  assert.equal(R.pruebaAQuienPaga.status, 200, 'una prueba a mano no se bloquea: sigue como siempre');
});

test('el aviso ANTES: a la persona y a Martín, una vez, sólo a quien le toca', () => {
  const asuntos = R.mails.map((m: { asunto: string }) => m.asunto);
  const previos = R.mails.filter((m: { tag: string }) => m.tag === 'plan-a-mano-antes');
  assert.deepEqual(previos.filter((m: { to: string }) => m.to === 'dueno30@ejemplo.com').length, 1);
  assert.equal(previos.filter((m: { to: string; asunto: string }) => m.to === R.EMAIL_MAKO && /Termina pronto/.test(m.asunto)).length, 1);
  assert.ok(R.marcas[30].previo && !R.marcas[30].vencido, 'la marca del aviso previo no es la del fin');
  assert.equal(R.marcas[31].previo, false, 'falta mucho');
  assert.equal(R.marcas[32].previo, false, 'ya paga: no se le avisa');
  assert.ok(!asuntos.some((a: string) => /Termina y paga/.test(a)));
  assert.ok(!R.mails.some((m: { to: string }) => m.to === 'dueno32@ejemplo.com'));
  assert.ok(!R.mails.some((m: { to: string }) => m.to === 'dueno33@ejemplo.com'), 'ya estaba avisado');
  assert.ok(R.marcas[36].previo, 'sin dueño con email, Martín igual se entera y se marca');
  assert.equal(R.mailsEnSeco, 0, 'en seco no manda nada');
  assert.ok(R.seco.avisados >= 2, 'en seco cuenta a quiénes les tocaría');
});

test('si el de Martín no salió, no se marca y se intenta de nuevo; una vuelta más no repite', () => {
  assert.equal(R.marcas35SinMartin, null);
  assert.ok(R.vueltaSinMartin.errores > 0);
  assert.ok(R.marcas[35].previo, 'en la vuelta siguiente sale');
  assert.equal(R.mailsSegunda, 0, 'la segunda vuelta no repite');
});

test('al vencer: el aviso previo no consume el del fin, y un vencido no recibe el previo', () => {
  assert.ok(R.alVencerAsuntos.some((a: string) => a === 'Terminaron los 6 meses gratis de Termina pronto'), R.alVencerAsuntos.join(' | '));
  assert.ok(R.mails.some((m: { asunto: string }) => m.asunto === 'Terminaron los 6 meses gratis de Terminó'));
  assert.equal(R.marcas[34].previo, false);
  assert.equal(R.marcas[34].vencido, true);
  // Desde el 6/11/2026 (la copia de Polar) se resuelve en la ficha de ESE negocio (Admin › Customers › <negocio>, «Editar»).
  const aMartin = R.mails.filter((m: { to: string }) => m.to === R.EMAIL_MAKO);
  assert.ok(aMartin.length > 0, 'a Martín no le llegó ningún aviso');
  assert.ok(aMartin.every((m: { cuerpo: string }) => /\/admin\/customers\/\d+/.test(m.cuerpo)), 'el link lleva a donde se resuelve: la ficha del negocio en Admin');
  assert.ok(aMartin.every((m: { cuerpo: string }) => !/\/admin\?tab=/.test(m.cuerpo)), 'un `?tab=` viejo redirige a otra sección');
});

test('las reglas del aviso: la ventana, y una sola vez', () => {
  const p = (dias: number, extra: Partial<PlanAMano> = {}): PlanAMano => ({ desde: new Date(AHORA - 170 * DIA).toISOString(), hasta: new Date(AHORA + dias * DIA).toISOString(), avisadoAt: null, regalo: true, ...extra });
  assert.equal(DIAS_AVISO_REGALO, 14);
  assert.equal(tocaAvisarFinDeRegalo(p(14), AHORA), true, 'el día 14 justo');
  assert.equal(tocaAvisarFinDeRegalo(p(14.01), AHORA), false);
  assert.equal(tocaAvisarFinDeRegalo(p(1), AHORA), true);
  assert.equal(tocaAvisarFinDeRegalo(p(-1), AHORA), false, 'vencido: le toca el otro');
  assert.equal(tocaAvisarFinDeRegalo(p(5, { avisoPrevioAt: new Date(AHORA).toISOString() }), AHORA), false);
  assert.equal(tocaAvisarFinDeRegalo({ ...p(5), regalo: undefined }, AHORA), false, 'una prueba no lleva aviso previo');
  const a = avisosFinDeRegaloCerca({ negocio: 'Gabi', plan: 'MaKo Pro', hasta: p(10).hasta, linkPlan: 'L', linkCustomers: 'C' });
  assert.match(a.persona.cuerpo, new RegExp(fechaConAnio(p(10).hasta)));
  assert.match(a.persona.cuerpo, /Hasta ese día sigue todo igual/);
  assert.match(a.persona.cuerpo, /todo lo que cargaste/);
  assert.doesNotMatch(a.persona.cuerpo, /paus|cort|suspend|bloque/i, 'no se le dice que se corta: no se corta');
  assert.doesNotMatch(a.persona.cuerpo, /\b(?:tenés|podés|querés|escribinos|entrá)\b/i);
  assert.match(a.martin.cuerpo, /No se pausa nada/);
});

test('la fecha a la vista: la ficha del negocio en Admin, el teléfono y Tu plan', () => {
  const r = (dias: number, regalo = true): PlanAMano => ({ desde: new Date(AHORA).toISOString(), hasta: new Date(AHORA + dias * DIA).toISOString(), avisadoAt: null, ...(regalo ? { regalo: true as const } : {}) });
  assert.match(textoDePlanAMano(r(100), AHORA), /^Gratis hasta el \d+ de \w+ de 2027$/);
  assert.match(textoDePlanAMano(r(-1), AHORA), /^Sus 6 meses gratis terminaron el /);
  assert.match(textoDePlanAMano(r(7, false), AHORA), /^Prueba a mano hasta el /);
  assert.match(textoDePlanAMano(r(-1, false), AHORA), /^Su prueba a mano venció el /);
  assert.match(R.textos[31], /^Gratis hasta el /, 'la lista de Admin');
  assert.match(R.textos[34], /^Sus 6 meses gratis terminaron/);
  assert.equal(R.textos[22] ?? null, null, 'sin plan a mano, nada');
  // La ficha de un negocio de Admin (la copia de Polar, 6/11/2026; antes eran Customers y Accounts): la cabecera y «Plan a mano».
  const ficha = fuente('app/admin/_polar/datos/cliente-server.ts');
  assert.equal((ficha.match(/planAMano: fila\?\.planAManoTxt \?\? null,/g) ?? []).length, 2, 'la cabecera y el alta, con el texto de la lista');
  assert.match(fuente('app/admin/_polar/web/Customer/CustomerPage/CustomerDetailsSection.tsx'), /<Row label="Plan a mano" value=\{alta\.planAMano\} \/>/);
  assert.match(fuente('app/m/customers/CustomersM.tsx'), /c\.prueba \? 'En prueba gratis' : c\.planAManoTxt \?\? 'Plan a mano'/);
  assert.match(fuente('app/configuraciones/plan/PlanPanel.tsx'), /gratisHasta \? `Gratis hasta el \$\{gratisHasta\}` : 'Acordado con MaKo'/);
  assert.match(fuente('app/m/configuraciones/plan/PlanM.tsx'), /gratisHasta \? `Gratis hasta el \$\{gratisHasta\}` : 'Acordado con MaKo'/);
  assert.match(fuente('lib/api-mako/areas/negocio.run.ts'), /gratis_hasta: gratisHasta/, 'la API lo dice');
  assert.match(fuente('lib/api-mako/areas/cobros.run.ts'), /plan_a_mano: f\.planAManoTxt/);
});

test('«Para mirar» lo pide cuando faltan 14 días o terminó sin resolver, nunca antes, y a quien ya factura no', () => {
  const p = (dias: number): PlanAMano => ({ desde: new Date(AHORA).toISOString(), hasta: new Date(AHORA + dias * DIA).toISOString(), avisadoAt: null, regalo: true });
  assert.equal(regaloParaMirar(p(100), AHORA), null);
  assert.match(regaloParaMirar(p(10), AHORA)!, /terminan el/);
  assert.match(regaloParaMirar(p(-3), AHORA)!, /terminaron el/);
  assert.equal(regaloParaMirar({ ...p(3), regalo: undefined }, AHORA), null);
  const base = { ws: 1, nombre: 'Gabi', estado: 'activo', creado: '2026-01-01T00:00:00Z', prueba: false, pagoPendiente: false, motivoRiesgo: null, sinEntrar: 1, onboardingHecho: true } as const;
  assert.deepEqual(paraMirar([{ ...base, regaloPorTerminar: 'Sus 6 meses gratis terminan el 1 de mayo de 2027' }], AHORA).map((i) => [i.motivo, i.texto]), [['regalo', 'Sus 6 meses gratis terminan el 1 de mayo de 2027']]);
  assert.deepEqual(paraMirar([{ ...base }], AHORA), []);
  const vista = fuente('lib/clientes-plataforma.ts');
  assert.match(vista, /regaloPorTerminar: mano && mrr\.usd === 0 && mrr\.sinDolares === 0 && !enPrueba\(cs\) \? regaloParaMirar\(mano, ahoraMs\) : null/);
});

// Roturas (30/10/2026; base 35 / 0, junto con plan-a-mano y planes-tres-bloques), cada una restaurada (pasan / fallan):
//   · los 6 meses llevan los topes de la prueba               -> 33 / 2
//   · `estadoDePrueba` no los mira                            -> 33 / 2
//   · vencidos siguen sin topes                               -> 32 / 3
//   · la ruta se los da a quien ya paga                       -> 34 / 1
//   · `pagaSuPlan` no ve la prueba con tarjeta                -> 34 / 1
//   · `pagaSuPlan` no ve lo pagado por la pasarela            -> 33 / 2
//   · el aviso previo le llega a quien ya paga                -> 33 / 2
//   · el previo usa `estadoDePrueba` (nadie lo recibe)        -> 32 / 3
//   · el previo se come el aviso del fin                      -> 32 / 3
//   · el previo no se marca (repite cada día)                 -> 33 / 2
//   · la marca no se lee                                      -> 33 / 2
//   · la ventana de 14 días no se respeta                     -> 33 / 2
//   · también a una prueba de 7 días                          -> 34 / 1
//   · se marca aunque Martín no se enteró                     -> 33 / 2
//   · el link vuelve a /admin (desde el 6/11/2026: a la ficha, /admin/customers/<ws>) -> 33 / 2
//   · Accounts sin la fecha / no la dibuja (desde el 6/11: la ficha de Admin) -> 34 / 1 cada una
//   · la ficha, el teléfono o Tu plan sin la fecha            -> 34 / 1 cada una
//   · «Para mirar» no lo pide                                 -> 34 / 1
//   · una prueba dice «gratis hasta»                          -> 34 / 1
//   · la tarjeta vuelve a decir embudo; la promesa, setter; la pregunta, CRM -> 34 / 1 cada una
//   · la garantía no coincide con /reembolsos                 -> 33 / 2
//   · la tabla vuelve a prometer anuncios                     -> 34 / 1
// El arnés, medido por el control: sin el filtro `not.is.null`, `estadoDePrueba` tragaba el error, decía «no está en prueba» y los
// frenos de los 6 meses daban bien por la razón equivocada. Los delató la prueba de 30 días, que no frenaba.
// Lo que NO corre acá: el envío real de los mails y las pantallas dibujadas (van a mirarse al desplegar).
