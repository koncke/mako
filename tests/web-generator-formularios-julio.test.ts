// =============================================================================
// Los formularios del Web Generator como fuente del lead (14/11/2026, la llamada con Julio Mazariegos)
// =============================================================================
// docs/relevo/llamada-julio-13-11.md, «Formularios y fuentes». Julio: «creo tres landings: una regalo, otra video, otra para
// agendar; ¿cómo distingo qué formulario dispara el flujo?». Martín, 14/11: «si se arma un formulario… que se pueda asignar
// dentro del lead entrante. Eso es súper importante». Lo que fija, punto por punto:
//   1. el Pixel lee las 10 respuestas que admite el formulario (leía 8 y perdía el resto sin avisar);
//   2. cada formulario y quiz tiene id estable y nombre, y la publicada los lleva (data-mako-form) para que el Pixel los mande;
//   3. las piezas de una landing (formularios, encuestas, quiz, agenda, pago) por nombre, y su asignación a un CRM;
//   4. el disparador «Envió el formulario X» (o cualquiera de la landing);
//   5. los tipos de campo nuevos (número, fecha, múltiple, desplegable, escala, consentimiento, oculto);
//   7. el quiz con saltos y selección múltiple;
//   9. la pieza nombrada en palabras (la API de MaKo);
//  10. el segmento de /email por cualquier CRM o etapa.
// Correr: node --import tsx --test tests/web-generator-formularios-julio.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TOPES, NODO } from '../lib/editor-landing/doc';
import { attrsFormulario, specFormulario, nombreDeFormulario } from '../lib/editor-landing/especificacion';
import { htmlDeArbol } from '../lib/editor-landing/grafico-svg';
import { sanearContenido } from '../lib/editor-landing/validar';
import { attrsQuiz, caminoDe, preguntasCompletas, puntajeDe, specQuiz, SALTO_FIN } from '../lib/editor-landing/quiz';
import {
  piezasDeContenido, asignacionesDe, conAsignacion, crmsDePieza, claveValida, piezaPorTexto, idDeFormularioPixel, paginaDePixel,
} from '../lib/editor-landing/piezas';
import {
  disparaPorEvento, problemaDeDisparador, sanearDisparador, firmaDisparador, textoDeDisparador, claseDeDisparador, CLASES_DISPARADOR, TRIGGER_FORMULARIO,
} from '../lib/disparadores';
import { segmentoCrm, segmentoDeCrm } from '../lib/segmento-crm';

/** El fuente con saltos de línea normales (el worktree de Windows los tiene en CRLF). */
const leer = (rel: string): string => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const BT = String.fromCharCode(96);
const BS = String.fromCharCode(92);

/** El snippet del Pixel tal cual sale (como tests/landing-agenda-embebida.test.ts). */
function snippetEmitido(): string {
  const s = readFileSync(new URL('../lib/landing-token.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const desde = s.indexOf('return ' + BT + '<script>');
  const hasta = s.indexOf('</script>' + BT + ';', desde);
  const tpl = s.slice(desde + ('return ' + BT).length, hasta);
  const mapa: Record<string, string> = { n: '\n', t: '\t', r: '\r', [BS]: BS, [BT]: BT, $: '$' };
  let out = '';
  for (let i = 0; i < tpl.length; i++) {
    if (tpl[i] === BS && i + 1 < tpl.length) { out += mapa[tpl[i + 1]] ?? tpl[i + 1]; i++; } else out += tpl[i];
  }
  return out;
}

type Campo = { type: string; name?: string; id?: string; value: string; checked?: boolean; placeholder?: string; rotulo?: string; attrs?: Record<string, string> };
/** `otrosCampos` del Pixel EMITIDO, corrido sobre un formulario de mentira (sin DOM: nada de jsdom). */
function otrosCampos(campos: Campo[]): Record<string, string> | null {
  const gen = snippetEmitido();
  const desde = gen.indexOf('function otrosCampos(form) {');
  const hasta = gen.indexOf('// En captura y sin preventDefault', desde);
  assert.ok(desde > 0 && hasta > desde, 'no se encontró otrosCampos en el snippet emitido');
  const els = campos.map((c) => ({
    type: c.type, name: c.name ?? '', id: c.id ?? '', value: c.value, checked: c.checked === true, placeholder: c.placeholder ?? '',
    labels: c.rotulo ? [{ textContent: c.rotulo }] : [],
    getAttribute: (k: string) => c.attrs?.[k] ?? null,
    hasAttribute: (k: string) => !!c.attrs && k in c.attrs,
  }));
  const form = { querySelectorAll: () => els };
  return new Function('form', `${gen.slice(desde, hasta)}\nreturn otrosCampos(form);`)(form);
}

test('1. el Pixel lee las respuestas que admite el formulario (10), no 8', () => {
  const libres = Array.from({ length: TOPES.camposFormulario }, (_, i): Campo => ({ type: 'text', name: `respuesta-${i}`, value: `r${i}`, rotulo: `Pregunta ${i + 1}` }));
  const r = otrosCampos([{ type: 'email', name: 'email', value: 'a@b.co' }, ...libres]);
  assert.equal(Object.keys(r ?? {}).length, TOPES.camposFormulario, 'con n < 8 llegaban 8 y las otras se perdían sin aviso');
  assert.equal(r?.['Pregunta 10'], 'r9');
  // Y no más que eso: un formulario de afuera con 15 campos no manda 15.
  const muchos = Array.from({ length: 15 }, (_, i): Campo => ({ type: 'text', name: `x-${i}`, value: 'v', rotulo: `P${i}` }));
  assert.equal(Object.keys(otrosCampos(muchos) ?? {}).length, 10);
});

test('1b. la selección múltiple llega como UNA respuesta, y el campo oculto del Web Generator sí se lee', () => {
  const r = otrosCampos([
    { type: 'checkbox', name: 'respuesta-1', value: 'Ads', checked: true, rotulo: '¿Qué te interesa?' },
    { type: 'checkbox', name: 'respuesta-1', value: 'SEO', checked: false, rotulo: '¿Qué te interesa?' },
    { type: 'checkbox', name: 'respuesta-1', value: 'Email', checked: true, rotulo: '¿Qué te interesa?' },
    { type: 'hidden', name: 'respuesta-2', value: 'regalo', attrs: { 'data-mako-campo': '', 'data-rotulo': 'Campaña' } },
    { type: 'hidden', name: 'csrf', value: 'xyz' },
  ]);
  assert.deepEqual(r, { '¿Qué te interesa?': 'Ads, Email', 'Campaña': 'regalo' }, 'un hidden cualquiera (csrf) sigue afuera');
});

test('1c. el Pixel manda el formulario y la página (v29)', () => {
  const gen = snippetEmitido();
  assert.match(gen, /formulario_id: d\.formulario \|\| null/);
  assert.match(gen, /pagina_id: d\.paginaId \|\| paginaMako\(\)/);
  assert.match(gen, /formulario: String\(form\.getAttribute\('data-mako-form'\)/);
  const fuente = leer('../lib/landing-token.ts');
  assert.match(fuente, /export const SNIPPET_VERSION = 29;/);
  assert.match(fuente, /\n  29: '/, 'la novedad de la v29, para decírselo a quien quedó atrás');
});

const FORM = {
  type: NODO.formulario,
  attrs: {
    id: 'fRegalo1', nombre: '', campos: [
      { id: 'c1', tipo: 'nombre', etiqueta: 'Nombre', requerido: true, opciones: [] },
      { id: 'c2', tipo: 'email', etiqueta: 'Correo', requerido: true, opciones: [] },
    ], boton: 'Quiero el regalo', exito: 'Listo', redirigir: null,
  },
};
const tarjeta = (id: string, ...hijos: unknown[]) => ({ type: NODO.tarjeta, attrs: { id }, content: hijos });

test('2. cada formulario tiene id estable y nombre; la publicada los lleva para el Pixel', () => {
  const a = attrsFormulario({ ...FORM.attrs, nombre: '  Formulario Regalo ' });
  assert.equal(a.id, 'fRegalo1');
  assert.equal(a.nombre, 'Formulario Regalo');
  assert.equal(a.clase, 'formulario');
  assert.equal(nombreDeFormulario('', 'Lanzamiento', 'Inicio'), 'Lanzamiento · Inicio', 'el nombre de siempre');
  const html = htmlDeArbol(specFormulario(FORM.attrs, { modo: 'publico', fuente: { landing: 'Lanzamiento', pagina: 'Inicio', docId: 118, paginaId: 'p1' } }));
  assert.match(html, /data-mako-form="fRegalo1"/);
  assert.match(html, /data-mako-form-nombre="Lanzamiento · Inicio"/);
  assert.match(html, /data-mako-pagina="118:p1"/);
  // Sin la landing (el editor, la miniatura): nada que el Pixel lea.
  assert.doesNotMatch(htmlDeArbol(specFormulario(FORM.attrs, { modo: 'editor' })), /data-mako-form/);
});

test('2b. un formulario de antes (sin id) recibe uno DERIVADO: el mismo al guardar y al publicar; uno copiado, otro', () => {
  const sinId = { ...FORM, attrs: { ...FORM.attrs, id: undefined } };
  const doc = { v: 1, paginas: [{ id: 'p1', titulo: 'Inicio', ruta: '', doc: { type: 'doc', content: [tarjeta('t1', sinId, sinId)] } }] };
  const ids = (c: unknown): string[] => {
    const out: string[] = [];
    const ver = (n: unknown) => { const x = n as { type?: string; attrs?: { id?: string }; content?: unknown[] }; if (x?.type === NODO.formulario) out.push(String(x.attrs?.id)); (x?.content ?? []).forEach(ver); };
    (c as { paginas: Array<{ doc: unknown }> }).paginas.forEach((p) => ver(p.doc));
    return out;
  };
  const una = ids(sanearContenido(doc).contenido);
  const otra = ids(sanearContenido(doc).contenido);
  assert.equal(una.length, 2);
  assert.deepEqual(una, otra, 'determinista: guardar y publicar dan el mismo id');
  assert.notEqual(una[0], una[1], 'dos formularios no comparten id');
  // Repetido (un copiar y pegar del que ya tenía id): el segundo cambia, el primero no.
  const copiado = { ...doc, paginas: [{ ...doc.paginas[0], doc: { type: 'doc', content: [tarjeta('t1', FORM, FORM)] } }] };
  const c = ids(sanearContenido(copiado).contenido);
  assert.equal(c[0], 'fRegalo1');
  assert.notEqual(c[1], 'fRegalo1');
});

const QUIZ = {
  id: 'qDiag', nombre: '', titulo: 'Tu diagnóstico', intro: '', empezar: '', enviar: '', pideTelefono: false,
  preguntas: [
    { texto: '¿Tienes ventas?', opciones: [{ texto: 'Sí', puntos: 2 }, { texto: 'No', puntos: 0, saltarA: 2 }] },
    { texto: '¿Cuántas al mes?', opciones: [{ texto: 'Pocas', puntos: 1 }, { texto: 'Muchas', puntos: 3 }] },
    { texto: '¿Qué usas?', multiple: true, opciones: [{ texto: 'Ads', puntos: 1 }, { texto: 'Email', puntos: 2 }, { texto: 'Nada', puntos: 0, saltarA: SALTO_FIN }] },
  ],
  resultados: [{ desde: 0, titulo: 'Arrancando', texto: '', boton: '', href: '' }],
};

test('7. el quiz con saltos: el camino sigue la opción elegida, y lo que quedó afuera no suma', () => {
  const ps = preguntasCompletas(attrsQuiz(QUIZ));
  assert.equal(ps[2].multiple, true);
  assert.equal(ps[2].opciones[2].saltarA ?? null, null, 'una pregunta múltiple no salta');
  assert.deepEqual(caminoDe(ps, [0, 1, [0, 1]]), [0, 1, 2], '«Sí» sigue a la 2');
  assert.deepEqual(caminoDe(ps, [1, 1, [1]]), [0, 2], '«No» salta a la 3');
  // Lo elegido en la 2 antes de volver atrás y cambiar a «No» no cuenta.
  assert.equal(puntajeDe(ps, [1, 1, [0, 1]]), 0 + 1 + 2, 'sin los 3 de «Muchas»: no está en el camino');
  assert.equal(puntajeDe(ps, [0, 1, [0, 1]]), 2 + 3 + 1 + 2, 'la múltiple suma todas las marcadas');
  // Un salto hacia atrás no se guarda (daría vueltas): queda «la siguiente».
  assert.equal(attrsQuiz({ ...QUIZ, preguntas: [QUIZ.preguntas[0], { texto: 'x', opciones: [{ texto: 'a', puntos: 0, saltarA: 0 }, { texto: 'b', puntos: 0 }] }] }).preguntas[1].opciones[0].saltarA ?? null, null);
  const html = htmlDeArbol(specQuiz(QUIZ, { modo: 'publico', fuente: { landing: 'Diagnóstico', pagina: 'Inicio', docId: 7, paginaId: 'p1' } }));
  assert.match(html, /data-salta="2"/);
  assert.match(html, /type="checkbox" name="gmq-2"/);
  assert.match(html, /data-mako-form="qDiag"/);
  assert.match(html, /data-mako-form-nombre="Quiz Tu diagnóstico"/);
});

test('5. los tipos de campo nuevos se publican como controles reales', () => {
  const a = attrsFormulario({
    id: 'f1', campos: [
      { id: 'e', tipo: 'email', etiqueta: 'Correo', requerido: true },
      { id: 'n', tipo: 'numero', etiqueta: 'Presupuesto' },
      { id: 'd', tipo: 'fecha', etiqueta: 'Cuándo' },
      { id: 'm', tipo: 'multiple', etiqueta: 'Intereses', opciones: ['Ads', 'Email'], requerido: true },
      { id: 's', tipo: 'desplegable', etiqueta: 'País', opciones: ['MX', 'AR'] },
      { id: 'k', tipo: 'escala', etiqueta: 'Urgencia' },
      { id: 'c', tipo: 'consentimiento', etiqueta: 'Acepto', requerido: true },
      { id: 'o', tipo: 'oculto', etiqueta: 'Campaña', valor: 'regalo', requerido: true },
    ],
  });
  assert.equal(a.campos.length, 8);
  assert.equal(a.campos.find((c) => c.tipo === 'oculto')?.requerido, false, 'un oculto no se puede exigir');
  const html = htmlDeArbol(specFormulario(a, { modo: 'publico' }));
  assert.match(html, /type="number"/);
  assert.match(html, /type="date"/);
  assert.match(html, /<fieldset class="gm-campo" data-tipo="multiple" data-requerido="si">/);
  assert.equal((html.match(/type="checkbox"/g) ?? []).length, 3, 'dos de la múltiple y el consentimiento');
  assert.match(html, /<select[^>]*><option value="">Elige una opción<\/option><option value="MX">MX<\/option>/);
  assert.equal((html.match(/class="gm-escala"/g) ?? []).length, 1);
  assert.match(html, /<input type="hidden" name="[^"]+" value="regalo" data-mako-campo="" data-rotulo="Campaña"/);
  // «Múltiple» con una sola opción no se puede contestar: pasa a texto, como «opciones».
  assert.equal(attrsFormulario({ campos: [{ tipo: 'multiple', opciones: ['a'] }] }).campos[0].tipo, 'texto');
});

const CONTENIDO = {
  paginas: [
    { id: 'p1', titulo: 'Inicio', ruta: '', doc: { type: 'doc', content: [tarjeta('t1', FORM, { type: NODO.formulario, attrs: { ...FORM.attrs, id: 'fEnc', clase: 'encuesta', nombre: 'Encuesta NPS' } })] } },
    { id: 'p2', titulo: 'Agenda', ruta: 'agenda', doc: { type: 'doc', content: [tarjeta('t2', { type: NODO.insertado, attrs: { src: 'https://calendly.com/x/30min', proveedor: 'calendly' } })] } },
    { id: 'p3', titulo: 'Oferta', ruta: 'oferta', doc: { type: 'doc', content: [tarjeta('t3', { type: NODO.boton, attrs: { href: 'pago:44', texto: 'Comprar' } }, { type: NODO.quiz, attrs: QUIZ })] } },
  ],
};

test('3. las piezas de una landing, por nombre: formulario, encuesta, agenda, pago y quiz', () => {
  const ps = piezasDeContenido(118, 'Regalo', CONTENIDO as never, 'lead-magnet');
  const por = (tipo: string) => ps.filter((p) => p.tipo === tipo);
  assert.deepEqual(por('formulario').map((p) => [p.clave, p.nombre, p.rotulo]), [['form:fRegalo1', 'Regalo · Inicio', 'Descarga del lead magnet']]);
  assert.deepEqual(por('encuesta').map((p) => [p.clave, p.nombre]), [['form:fEnc', 'Encuesta NPS']]);
  assert.deepEqual(por('agenda').map((p) => p.clave), ['agenda:118:p2']);
  assert.deepEqual(por('pago').map((p) => [p.clave, p.productoId]), [['pago:118:p3', 44]]);
  assert.deepEqual(por('quiz').map((p) => [p.clave, p.nombre]), [['form:qDiag', 'Quiz Tu diagnóstico']]);
  // Dos formularios sin nombre propio en la misma página: no se llaman igual.
  const dos = piezasDeContenido(1, 'L', { paginas: [{ id: 'p', titulo: 'P', ruta: '', doc: { type: 'doc', content: [tarjeta('t', FORM, { ...FORM, attrs: { ...FORM.attrs, id: 'fOtro' } })] } }] } as never);
  assert.deepEqual(dos.map((p) => p.nombre), ['L · P', 'L · P · 2']);
});

test('3b. la asignación: el formulario rutea ANTES que la URL, y la agenda por su página', () => {
  let a = asignacionesDe('{"v":1,"asignadas":{"form:fRegalo1":[12],"basura":[1],"agenda:118:p2":[13]}}');
  assert.deepEqual(a, { 'form:fRegalo1': [12], 'agenda:118:p2': [13] }, 'lo que no es una clave se cae');
  a = conAsignacion(a, 'form:fRegalo1', 15, true);
  assert.deepEqual(a['form:fRegalo1'], [12, 15]);
  assert.deepEqual(crmsDePieza(a, { formularioId: 'fRegalo1' }), { clave: 'form:fRegalo1', funnels: [12, 15] });
  assert.deepEqual(crmsDePieza(a, { formularioId: null, pagina: { docId: 118, paginaId: 'p2' }, origen: 'agenda' }), { clave: 'agenda:118:p2', funnels: [13] });
  assert.equal(crmsDePieza(a, { formularioId: 'otro' }), null, 'sin asignar: sigue la URL, como antes');
  a = conAsignacion(conAsignacion(a, 'form:fRegalo1', 12, false), 'form:fRegalo1', 15, false);
  assert.equal(a['form:fRegalo1'], undefined, 'apagado el último, deja de estar asignado');
  assert.ok(claveValida('landing:118') && !claveValida('form:') && !claveValida('form:a b'));
  assert.equal(idDeFormularioPixel('fRegalo1'), 'fRegalo1');
  assert.equal(idDeFormularioPixel('<script>'), null);
  assert.deepEqual(paginaDePixel('118:p2'), { docId: 118, paginaId: 'p2' });
  assert.equal(paginaDePixel('118'), null);
});

test('3c. la ruta del opt-in rutea por la pieza ANTES que la campaña y la URL, y suma al contacto que ya existía', () => {
  const src = leer('../app/api/track/optin/route.ts');
  assert.match(src, /const funnelesDelLead: Array<number \| null> = porPieza \? porPieza\.funnels : porCampana\.asignada/);
  assert.match(src, /porMotivo\(dup, 'email'\), \.\.\.porMotivo\(dup, 'telefono'\)/);
  assert.match(src, /if \(exactos\.length === 1\)/);
  assert.match(src, /enrolarPorEvento\(leadId, 'formulario'/);
  assert.match(src, /enrolarPorEvento\(lead\.id, 'lead_nuevo'\)/, 'el lead nuevo entra a su secuencia en el acto, no con el barrido');
});

test('4. el disparador «Envió el formulario»: el mismo formulario o cualquiera de su landing', () => {
  const d = sanearDisparador({ id: 'd1', trigger_tipo: TRIGGER_FORMULARIO, pieza: { clave: 'form:fRegalo1', nombre: 'Regalo · Inicio' } });
  assert.ok(d);
  assert.deepEqual(d.pieza, { clave: 'form:fRegalo1', nombre: 'Regalo · Inicio' });
  assert.equal(claseDeDisparador(d), 'formulario');
  assert.ok(CLASES_DISPARADOR.some((c) => c.clase === 'formulario'));
  assert.equal(CLASES_DISPARADOR.length % 4, 0, '4+4: nunca una fila con un botón solo');
  const ctx = { formulario: 'form:fRegalo1', landing: 'landing:118' };
  assert.equal(disparaPorEvento(d, 'formulario', ctx), true);
  assert.equal(disparaPorEvento(d, 'formulario', { formulario: 'form:otro', landing: 'landing:118' }), false);
  const deLanding = sanearDisparador({ id: 'd2', trigger_tipo: TRIGGER_FORMULARIO, pieza: { clave: 'landing:118', nombre: 'Regalo' } })!;
  assert.equal(disparaPorEvento(deLanding, 'formulario', ctx), true);
  assert.equal(disparaPorEvento(deLanding, 'formulario', { formulario: 'form:x', landing: 'landing:9' }), false);
  assert.equal(disparaPorEvento(d, 'formulario', null), false, 'sin claves en el evento, nada');
  assert.equal(problemaDeDisparador({ id: 'd3', trigger_tipo: TRIGGER_FORMULARIO }, { unico: true }), 'Elige el formulario');
  assert.notEqual(firmaDisparador(d), firmaDisparador(deLanding), 'dos formularios no son el mismo CRON');
  const nombres = { deSiempre: () => '' } as unknown as Parameters<typeof textoDeDisparador>[1];
  assert.equal(textoDeDisparador(d, nombres), 'Envió el formulario «Regalo · Inicio»');
  assert.equal(textoDeDisparador(deLanding, nombres), 'Envió cualquier formulario de «Regalo»');
});

test('9. la pieza nombrada en palabras (la API): por clave, por nombre o la landing entera; con dos iguales, opciones', () => {
  const landings = [{ docId: 118, titulo: 'Regalo', piezas: piezasDeContenido(118, 'Regalo', CONTENIDO as never) }];
  assert.deepEqual(piezaPorTexto(landings, 'form:fEnc'), { ok: true, clave: 'form:fEnc', nombre: 'Encuesta NPS' });
  assert.deepEqual(piezaPorTexto(landings, 'encuesta nps'), { ok: true, clave: 'form:fEnc', nombre: 'Encuesta NPS' });
  assert.deepEqual(piezaPorTexto(landings, 'Regalo', { conLanding: true, tipos: ['quiz'] }), { ok: true, clave: 'landing:118', nombre: 'Regalo' });
  const r = piezaPorTexto(landings, 'no existe');
  assert.equal(r.ok, false);
});

test('10. /email: el segmento de cualquier CRM o etapa', () => {
  assert.deepEqual(segmentoCrm('crm:12'), { funnelId: 12, etapa: null });
  assert.deepEqual(segmentoCrm('crm:12:lead'), { funnelId: 12, etapa: 'lead' });
  assert.equal(segmentoCrm('crm:0'), null);
  assert.equal(segmentoCrm('crm:12:Lead Entrante'), null);
  assert.equal(segmentoDeCrm(12, 'agenda'), 'crm:12:agenda');
  const src = leer('../lib/email-marketing.ts');
  assert.match(src, /const crm = segmentoCrm\(segmento\);\n  if \(crm\) return leadsDeCrm\(supabase, crm\.funnelId, crm\.etapa\);/);
});
