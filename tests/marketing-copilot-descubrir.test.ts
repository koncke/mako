// =============================================================================
// Marketing CoPilot — lo que descubre charlando y el panel vivo (9/11/2026)
// =============================================================================
// Fija lo que sumó la batería (docs/relevo/marketing-copilot-pruebas.md): el funnel de email, la tienda y el negocio local, lo que el
// agente sabe y lo que le falta (`fichaDelNegocio`, la misma pieza que dibuja el panel), cómo se leen las respuestas rápidas, el
// recorrido, la cuenta y la comparación, y que nada se SUPONE (un presupuesto que no dijo no es «nada»).
// Probado rompiéndolo: al pie.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  FUNNELS, PREGUNTAS_DE_DATO, compararFunnels, cuentaDe, datosDeDecision, evaluarFunnel, fichaDelNegocio, leerDato, pasoDeCopiloto,
  recomendarFunnel, recorridoDe, sanearPerfil, funnelDelTexto, pasosDeLaSemana, esPreguntaHipotetica, type PerfilCopiloto,
} from '../lib/media-buyer/copiloto';
import { REGLAS_DEL_COPILOTO, negocioDelCopiloto } from '../lib/media-buyer/copiloto-contexto';

test('email es un funnel: sin anuncios ni llamadas, con su propuesta, su semana y su recorrido', () => {
  assert.ok(FUNNELS.some((f) => f.id === 'email'));
  assert.equal(funnelDelTexto('quiero armar un funnel de email para mi lista'), 'email');
  const p: PerfilCopiloto = { entrada: 'funnel', funnel: 'email', ticket: 900 };
  assert.equal(pasoDeCopiloto(p), 'competencia', 'email no pregunta presupuesto ni quién llama');
  const r = recorridoDe({ ...p, lista: 3200 });
  assert.equal(r.length, 4);
  assert.match(r[0].que, /3200 contactos, en tandas/);
  assert.match(negocioDelCopiloto(p), /pregunta cuántos contactos tiene/);
});

test('la tienda compra en la página: con plata, compra directa; un funnel con llamada no le sirve', () => {
  assert.equal(recomendarFunnel({ ticket: 45, presupuestoMes: 1500, llamadas: 'nadie', vende: 'tienda' }).funnel, 'carrito');
  assert.equal(recomendarFunnel({ ticket: 45, presupuestoMes: 0, llamadas: 'nadie', vende: 'tienda' }).funnel, 'organico');
  assert.equal(recomendarFunnel({ ticket: 45, presupuestoMes: 0, llamadas: 'nadie', vende: 'tienda', lista: 1100 }).funnel, 'email', 'con lista, primero escribirle');
  assert.equal(evaluarFunnel('mensajes', { ticket: 45, presupuestoMes: 1500, llamadas: 'yo', vende: 'tienda' }).sirve, false);
  // Sin `vende`, lo de siempre (tests/marketing-copilot-reglas.test.ts: 500 con «yo» sigue siendo carrito).
  assert.equal(recomendarFunnel({ ticket: 500, presupuestoMes: 300, llamadas: 'yo' }).funnel, 'carrito');
});

test('un curso de unos cientos de dólares con alguien que contesta: mensajes, y la compra directa después', () => {
  const r = recomendarFunnel({ ticket: 497, presupuestoMes: 600, llamadas: 'yo', vende: 'curso' });
  assert.equal(r.funnel, 'mensajes');
  assert.equal(r.masAdelante, 'carrito');
  assert.equal(recomendarFunnel({ ticket: 97, presupuestoMes: 600, llamadas: 'yo', vende: 'curso' }).funnel, 'carrito', 'debajo de 150 no se paga una charla');
  assert.equal(recomendarFunnel({ ticket: 497, presupuestoMes: 600, llamadas: 'nadie', vende: 'curso' }).funnel, 'carrito', 'si nadie contesta, la página');
});

test('email con una lista chica no sirve: primero se junta', () => {
  assert.equal(evaluarFunnel('email', { ticket: 900, presupuestoMes: 0, llamadas: 'yo', lista: 200 }).sirve, false);
  assert.equal(evaluarFunnel('email', { ticket: 900, presupuestoMes: 0, llamadas: 'yo', lista: 3200 }).sirve, true);
});

test('lo que sabe y lo que falta: lo imprescindible primero, según el funnel; lo sabido no se esconde', () => {
  const vacio = fichaDelNegocio({});
  assert.deepEqual(vacio.falta.filter((d) => d.imprescindible).map((d) => d.clave), ['vende', 'ticket', 'ventasMes', 'meta', 'presupuestoMes', 'llamadas']);
  assert.ok(vacio.falta.some((d) => d.clave === 'pais' && !d.imprescindible));
  const tienda = fichaDelNegocio({ vende: 'tienda', ticket: 45 });
  assert.ok(tienda.falta.some((d) => d.clave === 'margen' && d.imprescindible), 'una tienda sin margen no sabe cuánto puede costar una venta');
  assert.ok(!tienda.falta.some((d) => d.clave === 'llamadas'), 'en una tienda nadie atiende');
  const organico = fichaDelNegocio({ entrada: 'funnel', funnel: 'organico', ticket: 1800, ritmo: 3 });
  assert.ok(!organico.falta.some((d) => d.clave === 'presupuestoMes'), 'orgánico no pide presupuesto');
  assert.ok(organico.falta.some((d) => d.clave === 'horas'));
  const vsl = fichaDelNegocio({ entrada: 'funnel', funnel: 'vsl-llamada', ticket: 5000, presupuestoMes: 2000, llamadas: 'yo', casos: 'si', meta: 4, vende: 'servicio', ventasMes: 1, pais: 'España' });
  assert.equal(vsl.falta.length, 0);
  assert.deepEqual(vsl.sabe.slice(0, 3).map((d) => d.clave), ['vende', 'ticket', 'ventasMes']);
  // Cada pregunta tiene respuestas rápidas que se entienden con la misma pieza.
  for (const [k, q] of Object.entries(PREGUNTAS_DE_DATO)) {
    const leidas = q.opciones.filter((o) => leerDato(k as never, o));
    assert.ok(leidas.length >= q.opciones.length - 1, `${k}: no se entienden sus pastillas (${q.opciones.join(', ')})`);
  }
});

test('leer una respuesta escrita: números de chat, «3 mil», un país; lo que no se entiende es null', () => {
  assert.deepEqual(leerDato('meta', '15 alumnas'), { meta: 15 });
  assert.deepEqual(leerDato('presupuestoMes', 'unos 3 mil'), { presupuestoMes: 3000 });
  assert.deepEqual(leerDato('presupuestoMes', 'US$1.500'), { presupuestoMes: 1500 });
  assert.deepEqual(leerDato('margen', '60%'), { margen: 60 });
  assert.deepEqual(leerDato('vende', 'tengo una tienda en Shopify'), { vende: 'tienda' });
  assert.deepEqual(leerDato('casos', 'Todavía no'), { casos: 'no' });
  assert.deepEqual(leerDato('pais', 'México'), { pais: 'México' });
  assert.equal(leerDato('meta', 'no sé'), null);
  assert.equal(leerDato('margen', '150'), null);
});

test('nada se supone: sin funnel, un presupuesto que no dijo no es «nada» (si no, los anuncios saldrían «no le sirve»)', () => {
  assert.equal(datosDeDecision({ ticket: 900, llamadas: 'yo' }), null);
  assert.ok(datosDeDecision({ ticket: 900, llamadas: 'yo', presupuestoMes: 400 }));
  assert.ok(datosDeDecision({ entrada: 'funnel', funnel: 'organico', ticket: 1800 }), 'orgánico no lleva plata: se completa');
  assert.ok(datosDeDecision({ ticket: 45, presupuestoMes: 1500, vende: 'tienda' }), 'en una tienda nadie atiende');
  assert.ok(compararFunnels({ ticket: 900, llamadas: 'yo' }).every((c) => c.sirve === null));
  const n = negocioDelCopiloto({ entrada: 'funnel', ticket: 900, llamadas: 'yo' });
  assert.match(n, /todavía no se pueden comparar con sus números \(falta cuánto puede poner en anuncios\)/);
  assert.doesNotMatch(n, /LO QUE DICEN LAS REGLAS DE MAKO/);
});

test('la comparación usa las mismas reglas que el aviso, y viaja al agente', () => {
  const p: PerfilCopiloto = { entrada: 'funnel', funnel: 'vsl-llamada', ticket: 900, presupuestoMes: 400, llamadas: 'equipo', lista: 3200 };
  const c = compararFunnels(p);
  assert.equal(c.length, FUNNELS.length);
  assert.equal(c.find((x) => x.funnel.id === 'vsl-llamada')!.sirve, false);
  assert.equal(c.find((x) => x.funnel.id === 'email')!.sirve, true);
  const n = negocioDelCopiloto(p);
  assert.match(n, /LOS FUNNELS PARA ESTE NEGOCIO \(úsalo cuando pida pasar de uno a otro/);
  assert.match(n, /VSL con llamada: NO \(/);
  assert.match(n, /Email: le sirve/);
});

test('la cuenta: con la meta y el ticket, cuánto entra y cuánto puede costar cada venta; en una tienda, el margen avisa', () => {
  assert.equal(cuentaDe({ ticket: 497 }), null, 'sin meta no hay cuenta');
  const c = cuentaDe({ ticket: 497, meta: 15, presupuestoMes: 600, ventasMes: 4 })!;
  assert.deepEqual(c.lineas.map((l) => l.etiqueta), ['Entra por mes', 'Cada venta puede costar hasta', 'Hoy']);
  assert.match(c.lineas[0].valor, /7,455/);
  assert.match(c.lineas[2].valor, /te faltan 11/);
  const tienda = cuentaDe({ ticket: 45, meta: 50, margen: 60, presupuestoMes: 1500 })!;
  assert.ok(tienda.lineas.some((l) => l.etiqueta === 'Ojo'), '1.500 / 50 = 30 por venta > 27 que deja: se avisa');
  assert.match(c.nota, /no una promesa/);
});

test('el recorrido: cuatro etapas por funnel, y lo que NO tiene no se inventa (casos)', () => {
  for (const f of FUNNELS) {
    const r = recorridoDe({ entrada: 'funnel', funnel: f.id, ticket: 1000, presupuestoMes: 600, llamadas: 'yo', ritmo: 3 });
    assert.equal(r.length, 4, f.id);
    assert.deepEqual(r.map((e) => e.id), ['atraer', 'captar', 'convencer', 'cerrar'], f.id);
  }
  assert.deepEqual(recorridoDe({}), []);
  const sinCasos = recorridoDe({ entrada: 'funnel', funnel: 'vsl-llamada', ticket: 5000, presupuestoMes: 2000, llamadas: 'yo' });
  assert.match(sinCasos[2].que, /nunca se inventan/);
});

test('lo que la segunda corrida de la batería cazó: «¿y si…?» no decide, proponer no es guardar, ninguna tasa inventada, la semana con pantallas', () => {
  const R = REGLAS_DEL_COPILOTO;
  assert.match(R, /«¿y si en vez de X hago Y\?» NO es una decisión/);
  assert.match(R, /nunca digas «guardé» ni «cambié»/);
  assert.match(R, /sólo si en ESTE turno llamaste a copiloto_media_buyer/);
  assert.match(R, /UNA vez; si dice que sí \(aunque agregue otra pregunta\), lo propones en ese turno/);
  assert.match(R, /tampoco un porcentaje de caída, de cierre o de conversión/);
  assert.match(R, /mientras falte algo IMPRESCINDIBLE, terminas con UNA pregunta de LO QUE TE FALTA/);
  assert.match(R, /un dato que no dijo no se pone, tampoco como 0/);
  // Sin las reglas corridas (nada guardado), los umbrales viajan igual: el negocio real del ws 9 recibió un VSL con US$1.500 de ticket.
  for (const p of [{}, { entrada: 'funnel' as const }]) assert.match(negocioDelCopiloto(p), /LOS UMBRALES DE MAKO .*VSL con llamada, desde \$3,000 de ticket y \$1,500 al mes/);
  assert.doesNotMatch(negocioDelCopiloto({ entrada: 'funnel', funnel: 'formulario', ticket: 3000, presupuestoMes: 1000, llamadas: 'equipo' }), /LOS UMBRALES DE MAKO/, 'con las reglas corridas no hace falta');
  const n = negocioDelCopiloto({ entrada: 'funnel', funnel: 'formulario', ticket: 3000, presupuestoMes: 1000, llamadas: 'equipo' });
  assert.match(n, /ESTA SEMANA \(lo que ve en su panel[^)]*\): 1\. Escribir el anuncio y las preguntas \(Copywriting\)/);
  // La misma pieza que el panel.
  assert.deepEqual(pasosDeLaSemana({ entrada: 'funnel', funnel: 'organico', ritmo: 3, objetivo: 'ventas' }).map((s) => s.pantalla), ['Copywriting', 'Carruseles', 'Copywriting', 'Calendario']);
});

test('una PREGUNTA por otro funnel no lo cambia: lo cumple el código, no el prompt (tres corridas lo cambiaban igual)', () => {
  for (const t of ['¿Y si en vez de anuncios me enfoco en orgánico? Me da miedo quemar plata.', '¿Y si mejor hago un webinar?', '¿Me conviene YouTube?',
    '¿El email marketing sirve para que vuelvan a comprar?', '¿Y si hago contenido con influencers en vez de anuncios?']) assert.equal(esPreguntaHipotetica(t), true, t);
  for (const t of ['Cambiemos a orgánico', 'Dale, guardalo como orgánico', 'Prefiero YouTube, ¿cuándo empiezo?', 'Sí, dejalo guardado. ¿Y si el CPA sale caro?',
    'Quiero cambiar a email, ¿se puede?', 'Puedo poner US$600', '']) assert.equal(esPreguntaHipotetica(t), false, t);
  const run = readFileSync(join(import.meta.dirname, '..', 'lib/api-mako/areas/ads.run.ts'), 'utf8');
  const prep = run.slice(run.indexOf('copiloto_media_buyer: {'), run.indexOf('modo_agente_media_buyer: {'));
  assert.match(prep, /cambio\.funnel && cambio\.funnel !== actual\.funnel && esPreguntaHipotetica\(ctx\.mensajeUsuario\)/, 'la guarda está en el preparar');
});

test('los datos nuevos se guardan saneados (y basura no entra)', () => {
  const p = sanearPerfil({ vende: 'tienda', meta: 50.4, ventasMes: -3, casos: 'quizas', pais: '  Chile  ', margen: 200, lista: 1100, horas: 4 });
  assert.deepEqual(p, { vende: 'tienda', meta: 50, pais: 'Chile', lista: 1100, horas: 4 });
});

// ── Probado rompiéndolo (9/11/2026) ───────────────────────────────────────────
// Cada cambio a mano, corrido y restaurado:
//   1. `datosDeDecision` sin la guarda de `dijoLaPlata`                       → rojo «nada se supone».
//   2. la tienda sin su rama en `recomendarFunnel`                             → rojo «la tienda compra en la página».
//   3. 'margen' fuera de los imprescindibles de una tienda en `fichaDelNegocio` → rojo «lo que sabe y lo que falta».
//   4. `cuentaDe` sin el «Ojo» del margen                                      → rojo «la cuenta».
