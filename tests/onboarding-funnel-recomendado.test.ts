// =============================================================================
// El primer ingreso: el funnel que recomienda MaKo, y lo que cambió del onboarding (5/11/2026, T2 de docs/mako-iniciativa/plan.md)
// =============================================================================
// Martín (29/10/2026): «lo primero que te recomiendo es que cargues tu oferta… "¿qué funnel te gustaría? ¿o quieres que te
// recomiende uno?", alimentado por su presupuesto, qué funnel desea, qué ya está haciendo o qué resultado le trajo». Lo que se fija:
//   1. `recomendarFunnel` (lib/funnel-recomendado.ts), la tabla de plan.md §3.3: respeta siempre el canal, gana la primera regla, y
//      el porqué lo escribe el código con los datos de la persona;
//   2. el arranque: por llamada o por chat pregunta «¿Cómo te llegan hoy los clientes?» (un hecho) antes del CRM; con webinar,
//      carrito o presencial no; y la recomendación sale de `recomendarFunnel` (el ejemplo de Ana: chat, «Nada o menos de $600»,
//      «Te escriben» → «Instagram orgánico», con su porqué);
//   3. ninguna pregunta del primer ingreso pide una acción («¿Te sirven?», «¿Lo cargo así?» se fueron), y la oferta va primero con
//      la frase de Martín;
//   4. la IA ya no elige el tipo: la ruta le pasa UN candidato, y el link del borrador del plan queda en el estado.
//
// Correr: node --import tsx --test tests/onboarding-funnel-recomendado.test.ts
// PROBADO ROMPIÉNDOLO (base 4/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { recomendarFunnel, CUANTOS_FUNNELS } from '../lib/funnel-recomendado';
import {
  CRM_SI, ENTRADA_NINGUNA, PREGUNTA_ENTRADA, VER_OTROS_TIPOS, etapaDeArranque, funnelDelArranque, leerRespuesta, mensajesDeArranque,
  type EstadoArranque, type HechosArranque,
} from '../lib/onboarding-arranque';
import { PREGUNTA_DE_ACCION } from '../lib/aperturas/reglas';
import { marcasDeVoseo } from '../lib/puestas-data';
import { TIPOS_CRM } from '../lib/pipeline';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. recomendarFunnel: respeta el canal, gana la primera regla, y el porqué lo escribe el código', () => {
  const r = (d: Parameters<typeof recomendarFunnel>[0]) => recomendarFunnel(d);
  // 1. El canal ya decide.
  assert.deepEqual(r({ canal: 'webinar', inversion: 4 }), { tipo: 'webinar', porque: 'Cierras en un webinar.' });
  assert.deepEqual(r({ canal: 'carrito' }), { tipo: 'carrito', porque: 'Vendes en tu página.' });
  assert.deepEqual(r({ canal: 'presencial' }), { tipo: 'presencial', porque: 'Cierras en persona.' });
  // 2. Ya le funciona y dijo la entrada: el de su canal y su entrada.
  const ya = 'Ya te funciona: lo medimos como está.';
  assert.deepEqual(r({ canal: 'llamadas', entrada: 'agenda_sola', funnelHoy: 2 }), { tipo: 'llamada', porque: ya });
  assert.deepEqual(r({ canal: 'llamadas', entrada: 'chat_saliente', funnelHoy: 3 }), { tipo: 'linkedin', porque: ya });
  assert.deepEqual(r({ canal: 'conversaciones', entrada: 'chat_entrante', funnelHoy: 2 }), { tipo: 'conversaciones', porque: ya });
  assert.deepEqual(r({ canal: 'conversaciones', entrada: 'landing', funnelHoy: 2 }), { tipo: 'recurso_gratis', porque: ya });
  // 3. Le dejan sus datos.
  assert.deepEqual(r({ canal: 'conversaciones', entrada: 'landing' }), { tipo: 'recurso_gratis', porque: 'Te dejan sus datos en un formulario.' });
  assert.deepEqual(r({ canal: 'conversaciones', entrada: 'formulario_anuncio' }), { tipo: 'formulario_meta', porque: 'Te dejan sus datos en el anuncio.' });
  // 4 a 6. Por chat: inversión, publica, o lo orgánico. El ejemplo de Ana (plan.md §3.2).
  assert.equal(r({ canal: 'conversaciones', entrada: 'chat_entrante', inversion: 1 }).tipo, 'conversaciones');
  assert.equal(r({ canal: 'conversaciones', entrada: 'chat_entrante', inversion: 0, creativos: 1 }).tipo, 'dm_funnel');
  assert.deepEqual(r({ canal: 'conversaciones', entrada: 'chat_entrante', inversion: 0, creativos: 0, funnelHoy: 1 }),
    { tipo: 'instagram', porque: 'Inviertes menos de $600 al mes: empieza sin pagar anuncios.' });
  // 7 y 8. Por llamada sin pagar anuncios.
  assert.equal(r({ canal: 'llamadas', entrada: 'chat_saliente', inversion: 3 }).tipo, 'linkedin', 'les escribe: LinkedIn aunque invierta');
  assert.equal(r({ canal: 'llamadas', entrada: 'agenda_sola', inversion: 0, creativos: 0 }).tipo, 'linkedin');
  assert.equal(r({ canal: 'llamadas', entrada: 'landing', inversion: 0, creativos: 2 }).tipo, 'youtube');
  // 9. Por llamada con inversión: la fase suma el video de venta y los anuncios a quien ya lo vio; desde la 4, dos reuniones.
  assert.deepEqual(r({ canal: 'llamadas', entrada: 'landing', inversion: 1, fase: 0 }), { tipo: 'llamada', porque: 'Con tu inversión: anuncios a una página donde agendan.' });
  assert.match(r({ canal: 'llamadas', entrada: 'landing', inversion: 1, fase: 1 }).porque, /, con un video de venta en la página\.$/);
  assert.match(r({ canal: 'llamadas', entrada: 'landing', inversion: 2, fase: 2 }).porque, /y anuncios para quien ya te vio\.$/);
  assert.equal(r({ canal: 'llamadas', entrada: 'landing', inversion: 2, fase: 3 }).tipo, 'dos_reuniones');
  // 10. Sin canal: el de siempre, sin porqué.
  assert.deepEqual(r({ canal: null }), { tipo: 'llamada', porque: '' });
  // Siempre respeta el canal: ningún tipo de otro canal, con cualquier combinación.
  const canales = ['llamadas', 'conversaciones', 'webinar', 'carrito', 'presencial'] as const;
  const entradas = [null, 'landing', 'agenda_sola', 'chat_entrante', 'chat_saliente', 'formulario_anuncio'] as const;
  for (const canal of canales) for (const entrada of entradas) for (const inversion of [0, 1, 4]) for (const funnelHoy of [0, 2]) for (const creativos of [0, 1]) {
    const x = r({ canal, entrada, inversion, funnelHoy, creativos, fase: 2 });
    assert.equal(TIPOS_CRM.find((t) => t.id === x.tipo)?.canal, canal, `${canal}/${entrada}: recomendó ${x.tipo}, de otro canal`);
    assert.deepEqual(marcasDeVoseo(x.porque), [], x.porque);
  }
  assert.equal(CUANTOS_FUNNELS, 12);
});

const H: HechosArranque = {
  modo: 'oferta', nombreCuenta: '', nombreWorkspace: '', faseGuardada: true, canalNegocio: 'conversaciones', loQueVende: true,
  conCrm: true, conTelefono: false, terminado: false,
  // Ana: factura poco, invierte «Nada o menos de $600», saca 0 a 3 piezas, vende sin sistema (plan.md §3.2).
  faseNegocio: { respuestas: [0, 0, 0, 0, 1, 1], fase: 0 },
};
const ANA: EstadoArranque = { nombre: 'Ana', negocio: 'Cierre Consultivo', origen: 'Instagram', interes: 'anuncios', pdfOk: 'si' };

test('2. el arranque: «¿Cómo te llegan hoy los clientes?» por llamada o por chat, y la recomendación de recomendarFunnel', () => {
  assert.equal(etapaDeArranque(ANA, H), 'entrada');
  const pide = mensajesDeArranque(ANA, H).despues.at(-1)!;
  assert.equal(pide.texto, PREGUNTA_ENTRADA);
  assert.deepEqual(pide.opciones, ['Te escriben', 'Llenan un formulario', 'Tú les escribes', ENTRADA_NINGUNA], 'los rótulos de ENTRADAS, sin el del anuncio');
  const porLlamada = mensajesDeArranque(ANA, { ...H, canalNegocio: 'llamadas' }).despues.at(-1)!;
  assert.deepEqual(porLlamada.opciones, ['Agendan llamada', 'Llenan un formulario', 'Tú les escribes', ENTRADA_NINGUNA]);
  // Tocar o escribir lo mismo; con otras palabras, se propone y se confirma con un toque (nada escrito se guarda sin él).
  assert.deepEqual(leerRespuesta(ANA, H, { opcion: 0, opcionTexto: 'Te escriben' }), { ok: true, patch: { entrada: 'chat_entrante' } });
  assert.deepEqual(leerRespuesta(ANA, H, { opcion: 3, opcionTexto: ENTRADA_NINGUNA }), { ok: true, patch: { entrada: 'ninguna' } });
  const escrita = leerRespuesta(ANA, H, { texto: 'la mayoría llenan el formulario de mi web' });
  assert.ok(escrita.ok && escrita.patch.opcionPorConfirmar?.id === 'entrada', 'lo escrito espera el toque');
  // El ejemplo de Ana: «Te escriben» → «Instagram orgánico», con su porqué, y «Sí, ese» lo elige.
  const ana = { ...ANA, entrada: 'chat_entrante' as const };
  assert.equal(etapaDeArranque(ana, H), 'crm');
  const crm = mensajesDeArranque(ana, H).despues.find((m) => m.id === 'arr-crm')!;
  assert.equal(crm.texto, 'Hay 12 funnels en MaKo. Para ti: «Instagram orgánico». Inviertes menos de $600 al mes: empieza sin pagar anuncios.');
  assert.deepEqual(crm.opciones, [CRM_SI, VER_OTROS_TIPOS]);
  assert.equal(crm.tarjeta, 'crm', 'con la tarjeta de sus etapas');
  assert.deepEqual(leerRespuesta(ana, H, { opcion: 0, opcionTexto: CRM_SI }), { ok: true, patch: { crmTipo: 'instagram' } });
  assert.equal(funnelDelArranque(ana, H).tipo, 'instagram');
  // Con webinar, carrito o presencial, el canal ya decide: no se pregunta la entrada.
  for (const canal of ['webinar', 'carrito', 'presencial'] as const) {
    assert.equal(etapaDeArranque(ANA, { ...H, canalNegocio: canal }), 'crm', canal);
    assert.match(mensajesDeArranque(ANA, { ...H, canalNegocio: canal }).despues.find((m) => m.id === 'arr-crm')!.texto, new RegExp(`Para ti: «${TIPOS_CRM.find((t) => t.id === canal)!.label}»`));
  }
  // Sin la fase guardada todavía, cuenta lo contestado en la conversación de la oferta.
  const sinGuardar = funnelDelArranque({ ...ana, faseResp: [0, 1, 0, 0, 1, 1] }, { ...H, faseNegocio: null });
  assert.equal(sinGuardar.tipo, 'conversaciones', 'con inversión, un anuncio que abre la charla');
});

test('3. ninguna pregunta del primer ingreso pide una acción, y la oferta va primero con la frase de Martín', () => {
  const ana = { ...ANA, entrada: 'chat_entrante' as const };
  const todo = [...mensajesDeArranque(ana, H).antes, ...mensajesDeArranque(ana, H).despues].filter((m) => m.de === 'mako');
  for (const m of todo) assert.doesNotMatch(m.texto.split(/(?<=[.!])\s+/).pop() ?? '', PREGUNTA_DE_ACCION, m.texto);
  assert.ok(todo.some((m) => m.id === 'arr-oferta' && m.texto === 'Gracias, Ana. Lo primero es tu oferta: con ella conozco Cierre Consultivo y te ayudo en todo lo demás.'));
  const src = leer('lib/onboarding-arranque.ts');
  assert.doesNotMatch(sinComentarios(src), /¿Lo cargo así\?|¿Te sirven\?/, 'las dos preguntas de acción se fueron');
  assert.match(src, /Entendí que cobras así: «\$\{etiquetaCobro\(h\.cobroLeido\)\}»\. ¿Es así\?/);
  assert.doesNotMatch(sinComentarios(src), /rutaDeEntrada|ruta: '\/ads-writer'/, 'la ruta muerta del interés');
});

test('4. la IA ya no elige el tipo (UN candidato), y el link del borrador del plan queda en el estado', () => {
  const srv = sinComentarios(leer('lib/onboarding-arranque-server.ts'));
  assert.match(srv, /const uno = tipo \? candidatosCrm\(null\)\.filter\(\(t\) => t\.id === tipo\) : \[\];/);
  assert.match(srv, /candidatos: uno\.length \? uno : candidatosCrm\(canal\)/);
  assert.match(srv, /faseNegocio: diag \? \{ respuestas: diag\.respuestas, fase: diag\.fase \} : null,/);
  assert.match(srv, /crmRecomendado: funnelDelArranque\(e, h\)\.tipo,/, 'la tarjeta muestra el recomendado');
  const ruta = sinComentarios(leer('app/api/onboarding/arranque/route.ts'));
  assert.match(ruta, /propuestaDeCrm\(nuevo, h2\.canalNegocio, funnelDelArranque\(nuevo, h2\)\.tipo\)/);
  const plan = sinComentarios(leer('app/api/onboarding/plan-arranque/route.ts'));
  assert.match(plan, /await guardarEstadoArranque\(\{ planBorrador: \{ id: r\.id, n: r\.n \} \}\)\.catch\(/, 'el link del borrador ya no se pierde');
  assert.match(sinComentarios(leer('app/onboarding/ChatArranque.tsx')), /tipoCrmPorId\(vista\.crmRecomendado\)/);
});

// PROBADO ROMPIÉNDOLO (5/11/2026, base 4/0):
//   · la regla 6 recomienda «Conversaciones por chat» en vez de «Instagram orgánico»   → 2/2 (1, 2)
//   · la llamada con menos de $600 cae en «Llamada de venta» en vez de LinkedIn       → 3/1 (1)
//   · la entrada se pregunta también con webinar                                     → 3/1 (2)
//   · el cobro vuelve a «¿Lo cargo así?»                                             → 3/1 (3)
//   · la ruta le pasa los candidatos de su canal a la IA (sin el recomendado)        → 3/1 (4)
