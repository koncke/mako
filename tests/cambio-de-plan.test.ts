// =============================================================================
// Cambiar el plan de un cliente: el guard, el mail y lo que dice la pantalla
// =============================================================================
// Tres cosas que ya fallaron en este repo, servidas juntas por primera vez acá:
//   · un guard que valida «es una capa» en vez de «es un plan VENDIBLE», y deja pasar
//     `superadmin` — que no es un plan, es cómo se identifica la PLATAFORMA;
//   · un mail que sale con el remitente de un inquilino, o que no sale y nadie se entera;
//   · una pantalla que dice «listo» sin distinguir si el aviso llegó.
//
// ⚠️ PROBADO ROMPIÉNDOLO, dos veces (29/09/2026):
//
//   1. Volviendo el guard a `if (!esCapaValida(capa))` a secas (sin el
//      `CAPAS_VENDIBLES.some`): falla 1 de 12 — «el guard exige un plan VENDIBLE».
//      Es el que importa: con esa sola línea, un POST con `capa:'superadmin'` le muda a
//      un cliente las credenciales y el remitente de MaKo.
//
//   2. Pintando de `warn` el caso «sin nadie adentro»: fallan 2 de 12. Es la decisión
//      que protege — un rojo sobre algo que no es una falla enseña a ignorar los rojos —
//      y nació del bug del 28/09 (una cuenta aprobada con cero usuarios).
//      Y forzando el «se avisó» a salir siempre: falla 1 de 12.
//
//      ⚠️ LA PRIMERA ROTURA QUE PROBÉ PARA ESTE CASO DIO 0 FALLOS: cambiar `if (!a)` por
//      `if (!a && !r?.enviado)` es EQUIVALENTE para todo lo que el server puede devolver
//      (sin nadie adentro, `enviado` siempre es false). O sea que no medía el test, medía
//      nada. Es la misma trampa que ya está escrita en `docs/hallazgos-customer-success.md`,
//      y la única forma de verla es correr la rotura en vez de razonarla.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { avisoCambioPlan } from '../lib/plan-aviso';
import { CAPAS_VENDIBLES, CAPAS_LISTA, capaDef } from '../lib/capas';
import { marcasDeVoseo } from '../lib/puestas-data';

const leer = (p: string) => readFileSync(resolve(import.meta.dirname, p), 'utf8');

// ── Lo que ve quien hizo el cambio ────────────────────────────────────────

test('se avisó: dice a quién, para que se pueda ver que la dirección es la buena', () => {
  const a = avisoCambioPlan({ enviado: true, a: 'dueno@cliente.com' }, 'Completo');
  assert.equal(a.tono, 'ok');
  assert.match(a.texto, /dueno@cliente\.com/);
  assert.match(a.texto, /Completo/);
});

test('NO salió: el plan cambió igual, y se dice a quién avisarle a mano', () => {
  const a = avisoCambioPlan({ enviado: false, a: 'dueno@cliente.com', error: 'dominio rebotado' }, 'Agencia');
  assert.equal(a.tono, 'warn');
  // El plan ESTÁ cambiado: decir sólo «falló» convierte un trámite en un incidente.
  assert.match(a.texto, /Agencia/);
  assert.match(a.texto, /dominio rebotado/);
  assert.match(a.texto, /Av.sale t. a dueno@cliente\.com/);
});

test('sin nadie adentro NO dice que se avisó, y NO es una falla', () => {
  // Es el estado que dejó el bug del 28/09. Un rojo acá enseñaría a ignorar los rojos, y
  // un «se le avisó» sería directamente falso.
  const a = avisoCambioPlan({ enviado: false, a: '' }, 'Project Manager');
  assert.equal(a.tono, 'ok');
  assert.match(a.texto, /nadie adentro/i);
  assert.doesNotMatch(a.texto, /se le avis/i);
});

test('sin resultado ninguno tampoco inventa un envío', () => {
  const a = avisoCambioPlan(null, 'Completo');
  assert.equal(a.tono, 'ok');
  assert.doesNotMatch(a.texto, /se le avis/i);
});

// ── El guard del endpoint ─────────────────────────────────────────────────

test('EL QUE IMPORTA: el guard exige un plan VENDIBLE, no cualquier capa', () => {
  // `esCapaValida('superadmin')` es TRUE: es una capa del catálogo. Pero no es un plan —
  // `wsSuperAdmin()` toma el menor id con esa capa, así que asignársela a un cliente le
  // muda las credenciales y el remitente de MaKo a su workspace.
  const r = leer('../app/api/admin/workspaces/route.ts');
  const caso = r.slice(r.indexOf("case 'capa':"), r.indexOf("case 'cara':"));
  assert.ok(/CAPAS_VENDIBLES\.some/.test(caso), 'el guard acepta cualquier capa, incluida superadmin');
});

test('y tampoco se le cambia el plan A la plataforma', () => {
  const r = leer('../app/api/admin/workspaces/route.ts');
  const caso = r.slice(r.indexOf("case 'capa':"), r.indexOf("case 'cara':"));
  assert.ok(/wsSuperAdmin\(\)/.test(caso), 'se le puede cambiar el plan al workspace de la plataforma');
});

test('`superadmin` no está entre los planes que se ofrecen', () => {
  assert.ok(!CAPAS_VENDIBLES.some((c) => c.id === 'superadmin'));
  // Y sigue existiendo en el catálogo: la lista de arriba es un FILTRO, no la verdad.
  assert.ok(CAPAS_LISTA.some((c) => c.id === 'superadmin'));
});

// ── El mail ───────────────────────────────────────────────────────────────

test('el aviso NO puede tumbar el cambio: va después del update y devuelve, no tira', () => {
  const r = leer('../app/api/admin/workspaces/route.ts');
  const caso = r.slice(r.indexOf("case 'capa':"), r.indexOf("case 'cara':"));
  const iUpdate = caso.indexOf('actualizarWorkspace(body.id, { capa })');
  const iMail = caso.indexOf('avisarCambioDePlan(');
  assert.ok(iUpdate > 0 && iMail > 0, 'falta el update o el aviso');
  assert.ok(iUpdate < iMail, 'el mail sale ANTES de escribir el cambio');
  assert.ok(/catch \(e\)/.test(caso.slice(iMail)), 'un mail que tira se lleva puesto un cambio ya escrito');
});

test('el preflight del sandbox corta ANTES de mandar', () => {
  // Con el remitente sin configurar, Resend acepta contra @resend.dev y responde OK: el
  // sistema informa «enviado» y no llega nada.
  const m = leer('../lib/aviso-plan.ts');
  const iSandbox = m.indexOf('resend\\.dev');
  const iEnvio = m.indexOf('await sendEmail(');
  assert.ok(iSandbox > 0 && iEnvio > 0, 'faltan el preflight o el envío');
  assert.ok(iSandbox < iEnvio, 'el chequeo del remitente quedó DESPUÉS del envío');
});

test('el mail sale con el remitente de la PLATAFORMA y en su workspace', () => {
  const m = leer('../lib/aviso-plan.ts');
  assert.ok(/runWithWorkspace\(await wsSuperAdmin\(\)/.test(m), 'el mail no corre en el workspace de la plataforma');
  assert.ok(/from: REMITENTE_MAKO/.test(m), 'el remitente sale de la config de un inquilino');
  assert.ok(/replyTo: EMAIL_MAKO/.test(m), 'responder no llega a una casilla que alguien lee');
});

test('el cuerpo le habla al CLIENTE: sin jerga interna y sin voseo', () => {
  const m = leer('../lib/aviso-plan.ts');
  const cuerpo = m.slice(m.indexOf('const bodyText'), m.indexOf('].join('));
  // «capa» y «workspace» son nuestras palabras. La del cliente es PLAN.
  assert.ok(!/\bcapa\b|\bworkspace\b/i.test(cuerpo), 'el mail usa jerga interna');
  // Y el texto que lee un cliente va en neutro, como `invitarPorEmail`: la voz
  // rioplatense es la de MaKo hablándole a Martín.
  //
  // ⚠️ SE USA `marcasDeVoseo`, EL DETECTOR QUE YA EXISTE, y no un regex escrito acá. El
  // primero que puse marcaba «Entra desde aquí» —que es el imperativo NEUTRO, o sea
  // justo lo correcto— y hacía fallar el test sobre un texto bueno. Un detector propio
  // al lado de uno que ya está es la forma de que los dos digan cosas distintas sobre
  // la misma frase.
  assert.deepEqual(marcasDeVoseo(cuerpo), [], 'el mail le vosea a un cliente');
  assert.ok(/queRecibe/.test(m), 'el mail no dice qué incluye el plan nuevo');
});

test('todas las capas tienen su texto para el cliente', () => {
  // Si una nace sin él, el mail de ESE plan sale a medias y nada lo avisa.
  for (const c of CAPAS_LISTA) {
    assert.ok(capaDef(c.id).queRecibe.trim().length > 20, `${c.id} no dice qué recibe el cliente`);
  }
});
