// =============================================================================
// El onboarding entiende TODOS los nichos y no deja entrar sin el setup (27/10/2026)
// =============================================================================
// Martín (27/10/2026), textual:
//   · «no quiero que el onboarding se personalice a cada cliente, quiero que el onboarding sea capaz de entender todos
//     los nichos y en este caso inmobiliarias».
//   · «no dejarlos avanzar hasta que no hayan hecho su setup, descargar la app de mako, instalar la extensión, conectar su
//     cuenta de Meta con login, etc... Claro que siempre el sistema debe detectar si ya lo tienen».
//
// Lo que fija este archivo, en cuatro partes:
//   1. CÓMO VENDE (lib/modelo-negocio.ts): se PROPONE con lo que contó, se confirma con un toque, y decide el canal del
//      diagnóstico, el CRM (sin R1/R2 para quien no vende con llamadas) y si el Plan arranca con proyectos de VSL.
//   2. SIN UN `if` POR CLIENTE: ninguna regla del arranque pregunta por un número de workspace.
//   3. EL SETUP (lib/setup-negocio.ts): lo DETECTADO decide; «no pude comprobarlo» frena; saltear sólo lo que se puede no
//      tener (Meta sin anuncios, la agenda sin reuniones).
//   4. EL CABLEADO: la ruta, la tarjeta (sin salir de la pantalla), el cierre, el Plan y la API.
//
// PROBADO ROMPIÉNDOLO (27/10/2026, arnés en el scratchpad que restaura de memoria; base: todos en verde). Cada rotura y lo
// que cayó está anotado al final del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MODELOS, MODELOS_NEGOCIO, canalDelModelo, modeloDeTexto, modeloGuardado, opcionesDeModelo, siembraVsl, usaAgenda, volumenDe,
} from '../lib/modelo-negocio';
import { aplicarSalto, estadoSetup, resumenSetup, saltoPermitido, setupGuardado, PASOS_SETUP } from '../lib/setup-negocio';
import {
  CRM_SI, SETUP_HECHO, SETUP_PREGUNTA, SI_ES_ESO, cierreDePasos, etapaDeArranque, leerRespuesta, mensajesDeArranque,
  type EstadoArranque, type HechosArranque,
} from '../lib/onboarding-arranque';
import { CAPAS } from '../lib/capas';
import { TIPOS_CRM } from '../lib/pipeline';
import { PLANTILLAS_MODELO } from '../lib/plantillas-modelo-reglas';
import { ladoDeLaPregunta } from '../app/onboarding/arranque-ui';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// ── 1. Cómo vende ──────────────────────────────────────────────────────────

test('se ENTIENDE el rubro de lo que contó, sin mirar quién es', () => {
  const casos: Array<[string, string | null]> = [
    ['Inmobiliaria Sur. Captamos propiedades con campañas de Meta y hacemos tasaciones', 'inmobiliaria'],
    ['Somos una agencia de bienes raíces', 'inmobiliaria'],
    ['Fabricamos piezas metalúrgicas por orden de compra', 'manufactura'],
    ['Mentoría de alto ticket para coaches', 'llamada'],
    ['Restaurante de comida mexicana con delivery', 'tienda'],
    ['Software para empresas de logística', 'b2b'],
    ['Leads con formularios de Facebook', 'formulario'],
    ['Vendo todo por WhatsApp', 'chat'],
    ['Hola', null],
    ['', null],
  ];
  for (const [texto, esperado] of casos) assert.equal(modeloDeTexto(texto), esperado, texto);
  // Lo específico gana: una inmobiliaria también habla de formularios y de empresas.
  assert.equal(modeloDeTexto('Inmobiliaria que capta con formularios a empresas'), 'inmobiliaria');
});

test('las opciones: lo leído primero, «Otro» siempre al final, y todas son de un toque', () => {
  const sin = opcionesDeModelo(null);
  assert.equal(sin.length, MODELOS_NEGOCIO.length);
  assert.equal(sin[sin.length - 1], MODELOS.otro.label);
  const con = opcionesDeModelo('inmobiliaria');
  assert.equal(con[0], MODELOS.inmobiliaria.label);
  assert.equal(con[con.length - 1], MODELOS.otro.label);
  assert.equal(new Set(con).size, con.length, 'una opción repetida');
  for (const m of MODELOS_NEGOCIO) assert.ok(MODELOS[m].label.length <= 34, `«${MODELOS[m].label}» no entra en un botón`);
});

test('lo que decide cada modelo: canal, CRM sin R1/R2, el Plan de VSL y la agenda', () => {
  // La inmobiliaria: cierra en persona, su CRM es su plantilla (sin reuniones R1/R2), sin proyectos de VSL.
  assert.equal(canalDelModelo('inmobiliaria'), 'presencial');
  assert.equal(MODELOS.inmobiliaria.plantilla, 'inmobiliaria');
  assert.ok(!PLANTILLAS_MODELO.inmobiliaria.funnel.pipeline.some((s) => /R1|R2|Calendly/i.test(s.label)));
  assert.equal(siembraVsl('inmobiliaria'), false);
  // Anuncios con formulario: el CRM de formulario, que no tiene etapas de reunión.
  const form = TIPOS_CRM.find((t) => t.id === MODELOS.formulario.tipoCrm);
  assert.ok(form && !form.pipeline.some((s) => s.kind === 'reunion'), 'el CRM de formulario trae una reunión');
  // La llamada de alto ticket y «Otro» siguen como antes (proyectos de VSL, la agenda obligatoria).
  assert.equal(siembraVsl('llamada'), true);
  assert.equal(siembraVsl(null), true, 'sin modelo guardado, lo de siempre');
  assert.equal(usaAgenda('tienda'), false);
  assert.equal(usaAgenda(null), true, 'sin modelo, la agenda queda obligatoria (el lado seguro)');
  // Todo modelo con plantilla trae su tipo de CRM (de ahí salen las entradas del funnel).
  for (const m of MODELOS_NEGOCIO) if (MODELOS[m].plantilla) assert.ok(MODELOS[m].tipoCrm, `${m}: sin tipo de CRM`);
});

test('la pregunta de volumen usa las palabras de su forma de vender, con los tramos de su canal', () => {
  const v = volumenDe('inmobiliaria', 'presencial');
  assert.match(v.texto, /tasaciones|visitas/);
  assert.ok(v.opciones.length >= 3);
  assert.doesNotMatch(volumenDe('formulario', 'conversaciones').texto, /llamadas/i);
  assert.deepEqual(volumenDe(null, 'llamadas'), volumenDe('llamada', 'llamadas'));
});

test('el modelo guardado tolera lo viejo o lo roto: lo que no es un modelo es «no hay»', () => {
  assert.equal(modeloGuardado('"inmobiliaria"'), 'inmobiliaria');
  assert.equal(modeloGuardado('inmobiliaria'), 'inmobiliaria');
  assert.equal(modeloGuardado('"marte"'), null);
  assert.equal(modeloGuardado(null), null);
});

// ── 2. Sin un `if` por cliente ─────────────────────────────────────────────

test('ninguna regla del arranque pregunta por un número de workspace', () => {
  const archivos = [
    'lib/modelo-negocio.ts', 'lib/setup-negocio.ts', 'lib/setup-negocio-server.ts', 'lib/onboarding-arranque.ts',
    'app/onboarding/TarjetaSetup.tsx', 'app/onboarding/ChatArranque.tsx', 'app/onboarding/arranque-ui.ts',
  ];
  for (const a of archivos) {
    const src = sinComentarios(leer(a));
    assert.doesNotMatch(src, /\bws\w*\s*[!=]==?\s*\d+/, `${a} pregunta por un workspace con número`);
    assert.doesNotMatch(src, /\b(?:workspace_id|wsId)\s*[!=]==?\s*\d+/, `${a} pregunta por un workspace con número`);
    assert.doesNotMatch(src, /\bOWNER_WS\b/, `${a} decide algo por el ws1`);
  }
});

// ── 3. El setup ────────────────────────────────────────────────────────────

test('lo DETECTADO decide, y «no pude comprobarlo» frena igual que «falta»', () => {
  const pasos = [...PASOS_SETUP];
  const todo = Object.fromEntries(pasos.map((p) => [p, { hecho: true as const }]));
  assert.equal(estadoSetup(pasos, todo, {}, 'llamada').completo, true);
  const caida = estadoSetup(pasos, { ...todo, whatsapp: { noPude: 'No pude comprobarlo ahora.' } }, {}, 'llamada');
  assert.equal(caida.completo, false, 'una lectura caída dio el setup por hecho');
  assert.deepEqual(caida.faltan, ['whatsapp']);
  assert.equal(caida.items.find((i) => i.paso === 'whatsapp')?.estado, 'no_pude');
  // Sin medir nada, falta todo (un detector que no contestó no es «hecho»).
  assert.equal(estadoSetup(pasos, {}, {}, null).faltan.length, pasos.length);
  // Sin pasos (el super admin), completo: no hay nada que pedir.
  assert.equal(estadoSetup([], {}, {}, null).completo, true);
  assert.equal(resumenSetup(caida), 'Te falta 1 paso.');
});

test('saltear sólo lo que se puede no tener: Meta sin anuncios, la agenda sólo si no vende con reuniones', () => {
  assert.equal(saltoPermitido('meta', 'inmobiliaria'), 'sin_anuncios');
  assert.equal(saltoPermitido('calendario', 'tienda'), 'sin_agenda');
  assert.equal(saltoPermitido('calendario', 'inmobiliaria'), null, 'la inmobiliaria agenda visitas');
  for (const p of ['desktop', 'extension', 'whatsapp', 'ia'] as const) assert.equal(saltoPermitido(p, 'tienda'), null, `${p} se pudo saltear`);
  // Un salto guardado vale sólo si HOY está permitido para su modelo.
  const det = { calendario: { hecho: false as const } };
  assert.equal(estadoSetup(['calendario'], det, { calendario: 'sin_agenda' }, 'tienda').completo, true);
  assert.equal(estadoSetup(['calendario'], det, { calendario: 'sin_agenda' }, 'b2b').completo, false, 'un salto viejo destrabó a quien sí agenda');
  // aplicarSalto valida en positivo.
  assert.ok('error' in aplicarSalto({}, 'whatsapp', 'sin_anuncios', 'tienda'));
  assert.ok('error' in aplicarSalto({}, 'calendario', 'sin_agenda', 'b2b'));
  assert.deepEqual(aplicarSalto({}, 'meta', 'sin_anuncios', 'tienda'), { saltos: { meta: 'sin_anuncios' } });
  assert.deepEqual(aplicarSalto({ meta: 'sin_anuncios' }, 'meta', null, 'tienda'), { saltos: {} });
});

test('lo guardado se sanea: sólo saltos y versiones válidas, y un JSON roto tira (quien escribe no pisa lo que no entiende)', () => {
  const g = setupGuardado(JSON.stringify({ saltos: { meta: 'sin_anuncios', whatsapp: 'x', marte: 'sin_agenda' }, extension: { version: '0.74.5', at: 'hoy' } }));
  assert.deepEqual(g.saltos, { meta: 'sin_anuncios' });
  assert.equal(g.extension?.version, '0.74.5');
  assert.equal(setupGuardado(JSON.stringify({ extension: { version: '<script>', at: 'hoy' } })).extension, undefined);
  assert.throws(() => setupGuardado('{roto'));
});

test('cada plan pide lo que usa, y el paso «setup» está donde hay algo que pedir', () => {
  assert.deepEqual(CAPAS.completo.setup, ['desktop', 'extension', 'meta', 'whatsapp', 'calendario', 'ia']);
  assert.deepEqual(CAPAS.agencia.setup, CAPAS.completo.setup);
  assert.deepEqual(CAPAS.pm.setup, ['desktop', 'ia']);
  assert.deepEqual(CAPAS.superadmin.setup, []);
  for (const c of Object.values(CAPAS)) assert.equal(c.onboarding.includes('setup'), c.setup.length > 0, `capa ${c.id}`);
});

// ── 4. El chat de arranque ─────────────────────────────────────────────────

const H: HechosArranque = {
  modo: 'oferta', nombreCuenta: 'Ana Gómez', nombreWorkspace: 'Casas Norte', faseGuardada: false, canalNegocio: null,
  loQueVende: true, conCrm: true, conTelefono: false, terminado: false, conModelo: true,
  textoDelNegocio: 'Captamos propiedades para vender con campañas a formulario',
};
const E: EstadoArranque = { nombre: 'Ana', negocio: 'Casas Norte', pdfOk: 'si' };

/** Toca una opción de la última pregunta, como la pantalla (con su texto y la pregunta que contesta). */
function tocar(e: EstadoArranque, h: HechosArranque, label: string) {
  const { antes, despues } = mensajesDeArranque(e, h);
  const ultimo = [...antes, ...despues].filter((m) => m.de === 'mako').pop();
  const opcion = ultimo?.opciones?.indexOf(label) ?? -1;
  assert.ok(opcion >= 0, `«${label}» no está entre las opciones (${ultimo?.opciones?.join(' | ')})`);
  return leerRespuesta(e, h, { opcion, opcionTexto: label, pregunta: ultimo!.texto });
}

test('«¿Cómo vendes?» va antes del diagnóstico (y en modo plan, después de a qué se dedica), con lo leído primero', () => {
  assert.equal(etapaDeArranque(E, H), 'modelo');
  const { despues } = mensajesDeArranque(E, H);
  const q = despues.filter((m) => m.de === 'mako').pop()!;
  assert.match(q.texto, /Inmobiliaria/);
  assert.equal(q.opciones?.[0], MODELOS.inmobiliaria.label);
  assert.equal(ladoDeLaPregunta('modelo', 'oferta'), 'despues');
  const plan: HechosArranque = { ...H, modo: 'plan', conCrm: false };
  assert.equal(etapaDeArranque({ nombre: 'Ana', negocio: 'Casas Norte' }, plan), 'que_hace');
  assert.equal(etapaDeArranque({ nombre: 'Ana', negocio: 'Casas Norte', queHace: 'Inmobiliaria' }, plan), 'modelo');
  // Una conversación de antes (sin `conModelo`) no cambia.
  assert.equal(etapaDeArranque(E, { ...H, conModelo: undefined }), 'fase');
});

test('tocarlo lo guarda con su canal, y el diagnóstico no pregunta el canal y usa sus palabras', () => {
  const r = tocar(E, H, MODELOS.inmobiliaria.label);
  assert.ok(r.ok);
  assert.equal(r.patch.modelo, 'inmobiliaria');
  assert.equal(r.patch.canal, 'presencial');
  const e2 = { ...E, ...r.patch };
  assert.equal(etapaDeArranque(e2, H), 'fase');
  const textos = mensajesDeArranque(e2, H).despues.map((m) => m.texto);
  assert.ok(!textos.includes('¿Dónde cierras la venta?'), 'volvió a preguntar el canal');
  // Hasta la de volumen, que va con «tasaciones o visitas».
  let e = e2;
  for (let i = 0; i < 10 && etapaDeArranque(e, H) === 'fase'; i++) {
    const ultimo = mensajesDeArranque(e, H).despues.filter((m) => m.de === 'mako').pop()!;
    if (/tasaciones|visitas/.test(ultimo.texto)) return;
    const rr = leerRespuesta(e, H, { opcion: 0, opcionTexto: ultimo.opciones![0], pregunta: ultimo.texto });
    assert.ok(rr.ok, `la fase no avanzó: ${!rr.ok ? rr.error : ''}`);
    e = { ...e, ...rr.patch };
  }
  assert.fail('la pregunta de volumen no usó las palabras de la inmobiliaria');
});

test('lo ESCRITO se confirma con un toque antes de guardarse', () => {
  const sinLectura: HechosArranque = { ...H, textoDelNegocio: '' };
  const e0: EstadoArranque = { ...E, negocio: 'Casas Norte' };
  const r = leerRespuesta(e0, sinLectura, { texto: 'somos una inmobiliaria', pregunta: mensajesDeArranque(e0, sinLectura).despues.filter((m) => m.de === 'mako').pop()!.texto });
  assert.ok(r.ok);
  assert.equal(r.patch.modelo, undefined, 'lo escrito se guardó sin el toque');
  assert.equal(r.patch.opcionPorConfirmar?.id, 'modelo');
  const e1 = { ...e0, ...r.patch };
  const ok = tocar(e1, sinLectura, SI_ES_ESO);
  assert.ok(ok.ok && ok.patch.modelo === 'inmobiliaria');
});

test('el CRM: la inmobiliaria acepta su plantilla; anuncios con formulario, el CRM de formulario', () => {
  const conFase: HechosArranque = { ...H, faseGuardada: true, canalNegocio: 'presencial' };
  const inmo: EstadoArranque = { ...E, modelo: 'inmobiliaria' };
  assert.equal(etapaDeArranque(inmo, conFase), 'crm');
  const r = tocar(inmo, conFase, CRM_SI);
  assert.ok(r.ok);
  assert.equal(r.patch.crmPlantilla, 'inmobiliaria');
  assert.equal(r.patch.crmTipo, undefined);
  assert.equal(etapaDeArranque({ ...inmo, ...r.patch }, conFase), 'origen', 'con la plantilla aceptada no se vuelve a preguntar el CRM');
  const form: EstadoArranque = { ...E, modelo: 'formulario' };
  const rf = tocar(form, { ...conFase, canalNegocio: 'conversaciones' }, CRM_SI);
  assert.ok(rf.ok && rf.patch.crmTipo === 'formulario_meta', 'anuncios con formulario no recibió su CRM');
});

test('el setup va antes del cierre y sólo lo DETECTADO lo pasa; el cierre lo cierra recién completo', () => {
  const fin: EstadoArranque = { ...E, modelo: 'inmobiliaria', crmPlantilla: 'inmobiliaria', origen: 'Instagram', interes: 'ventas' };
  const base: HechosArranque = { ...H, faseGuardada: true, canalNegocio: 'presencial' };
  const falta = estadoSetup(['desktop', 'meta'], { desktop: { hecho: true } }, {}, 'inmobiliaria');
  const listo = estadoSetup(['desktop', 'meta'], { desktop: { hecho: true }, meta: { hecho: true } }, {}, 'inmobiliaria');
  assert.equal(etapaDeArranque(fin, { ...base, setup: falta }), 'setup');
  assert.equal(etapaDeArranque(fin, { ...base, setup: listo }), 'cierre');
  const card = mensajesDeArranque(fin, { ...base, setup: falta }).despues.pop()!;
  assert.equal(card.texto, SETUP_PREGUNTA);
  assert.equal(card.tarjeta, 'setup');
  assert.equal(card.opciones, undefined, 'la tarjeta tiene sus botones: sin respuestas rápidas que tilden algo');
  // Lo escrito no tilda nada: dice qué falta.
  const r = leerRespuesta(fin, { ...base, setup: falta }, { texto: 'listo' });
  assert.ok(!r.ok && /Tu cuenta de Meta/.test(r.error));
  // Pasado con la tarjeta delante, queda dibujado con su respuesta.
  const hist = mensajesDeArranque({ ...fin, setupListo: true }, { ...base, setup: listo }).despues.map((m) => m.texto);
  assert.ok(hist.includes(SETUP_HECHO));
  // El cierre: «setup» sólo con el setup completo.
  const pasos = CAPAS.completo.onboarding;
  assert.ok(!cierreDePasos(pasos, { telefonoVerificado: true, metaConectado: true }).some((c) => c.paso === 'setup'));
  assert.deepEqual(cierreDePasos(pasos, { telefonoVerificado: true, metaConectado: true, setupCompleto: true }).find((c) => c.paso === 'setup'), { paso: 'setup', done: true });
});

// ── 5. El cableado ─────────────────────────────────────────────────────────

test('la ruta del arranque: mira el setup, saltea con la regla, guarda la extensión vista y siembra la plantilla', () => {
  const ruta = sinComentarios(leer('app/api/onboarding/arranque/route.ts'));
  assert.match(ruta, /case 'setup': \{/);
  assert.match(ruta, /case 'setup-saltar': \{[\s\S]*?guardarSalto\(paso, salto, e\.modelo \?\? null\)/);
  assert.match(ruta, /case 'setup-extension': \{[\s\S]*?guardarExtensionVista\(version\)/);
  assert.match(ruta, /if \(patch\.crmPlantilla\) \{\s*const r = await sembrarCrmDePlantilla\(patch\.crmPlantilla, tipoCrmDe\(e\.modelo\)\);/);
});

test('el servidor: cada detector con su red, la PC y Meta con las piezas de su área, y el cierre con la plantilla', () => {
  const det = sinComentarios(leer('lib/setup-negocio-server.ts'));
  assert.match(det, /medir\(p, detectores\[p\]\)/, 'un detector sin su try: una lectura caída tumbaría a los otros');
  assert.match(det, /listarPcDelNegocio\(ws\)/);
  assert.match(det, /integracionConectada\('meta', ws\)/);
  assert.match(det, /listarLineas\(\)/);
  assert.match(det, /googleCalendarConectado\(\)/);
  assert.doesNotMatch(det, /negocioConSuIA\(/, 'negocioConSuIA contesta «sí» ante la duda: acá la duda es «no pude»');
  const srv = sinComentarios(leer('lib/onboarding-arranque-server.ts'));
  assert.match(srv, /setupCompleto: !!h\.setup\?\.completo/);
  assert.match(srv, /setSetting\(CLAVE_MODELO, JSON\.stringify\(e\.modelo\)\)/);
  assert.match(srv, /m\.aplicarPlantillaModelo\(e\.crmPlantilla!, 'user'\)/);
});

test('la tarjeta conecta sin salir: Meta por Zernio, WhatsApp por QR, la IA en su modal y la extensión de la tienda', () => {
  const t = sinComentarios(leer('app/onboarding/TarjetaSetup.tsx'));
  assert.match(t, /<BotonIntegracion servicio="meta"/);
  assert.match(t, /<BotonIntegracion servicio="google"/);
  assert.match(t, /<ConectarMedio medio="whatsapp"/);
  assert.match(t, /<TusCuentasIA sinCabecera \/>/);
  assert.match(t, /EXTENSION_EN_TIENDA \? EXTENSION_URL_TIENDA : conWs\('\/extension\/instalar', ws\)/);
  assert.match(t, /useExtensionInstalada\(\)/);
  assert.match(t, /action: 'setup-extension', version: extension/);
  assert.doesNotMatch(t, /href=["'`]\/integraciones/, 'un link a /integraciones saca de la pantalla');
  const chat = sinComentarios(leer('app/onboarding/ChatArranque.tsx'));
  assert.match(chat, /if \(t === 'setup'\) return vista\.setup \? <TarjetaSetup/);
});

test('el Plan no siembra proyectos de VSL a quien no vende así, y «Tus cuentas de IA» se abre durante el onboarding', () => {
  const seeds = sinComentarios(leer('lib/todo-seeds.ts'));
  assert.match(seeds, /if \(modelo === 'no-pude' \|\| !siembraVsl\(modelo\)\) return \[\];/);
  assert.match(sinComentarios(leer('app/perfil/ia/page.tsx')), /requireRolWs\(\['closer', 'setter'\], \{ gateOnboarding: false \}\)/);
});

test('la API: leer el setup y saltear, en el registro y por REST', () => {
  const def = leer('lib/api-mako/areas/negocio.def.ts');
  assert.match(def, /id: 'ver_setup_herramientas'/);
  assert.match(def, /id: 'saltar_paso_setup', area: 'negocio', tipo: 'accion', confirmacion: 'chat', reversible: true/);
  const rest = leer('lib/api-mako/rest.ts');
  assert.match(rest, /\['GET', '\/negocio\/onboarding\/setup', 'ver_setup_herramientas'\]/);
  assert.match(rest, /\['PUT', '\/negocio\/onboarding\/setup\/\{paso\}', 'saltar_paso_setup'\]/);
  const run = sinComentarios(leer('lib/api-mako/areas/negocio.run.ts'));
  assert.match(run, /ver_setup_herramientas: \{\s*leer: async/);
  assert.match(run, /saltar_paso_setup: \{\s*preparar: seguro/);
});

// PROBADO ROMPIÉNDOLO (27/10/2026): las roturas y lo que cayó van en docs/hallazgos-onboarding.md («Todos los nichos y
// el setup obligatorio»).
