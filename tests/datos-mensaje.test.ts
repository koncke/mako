// =============================================================================
// El «{ }» de la sexta tanda: UN catálogo en árbol, por destino, y todo lo que ofrece se resuelve
// =============================================================================
// Pedidos de Martín (09/10/2026): «Faltan datos que se pueden poner en el botón de "{}"... Siempre
// recuerda los desplegables tipo arbol y con los íconos al lado. Y no entiendo el dato "Tu negocio",
// si ya está el de "Empresa", el de "Tu negocio" eliminalo. Y esto para todos los lugares donde
// usamos el botón de {}» y «falta muchísimos datos posibles... Como datos de campaña, del second
// brain, de lo que sea... Para eso ya tenemos una API, hazlo bien y siempre como arbol».
//
// Lo que este test fija, y por qué cada cosa:
//   1. «Tu negocio» no se ofrece en NINGÚN destino, y el token `{{negocio}}` se sigue resolviendo;
//   2. el DESTINO filtra: al lead no le llegan links al CRM, su estado ni sus etiquetas; al equipo no
//      le llega la llave del portal del curso de un alumno;
//   3. ⚠️ TODO dato que el árbol ofrece tiene quien lo PONGA (AGENTS.md: «La previsualización de un
//      editor no puede resolver un token que el motor NO resuelve»): por cada fuente, la función pura
//      que la resuelve produce TODAS sus claves con un fixture completo;
//   4. cada función pura hace lo que dice (la hora en la zona del negocio, la próxima cuota, el avance
//      con la regla del portal, el precio, el día de la semana);
//   5. el resolvedor lee una entidad SÓLO si el texto la nombra, y el motor lo usa en sus TRES
//      envíos (el WhatsApp, el email y la respuesta de «Si responde»);
//   6. la búsqueda del selector encuentra por la palabra que uno tiene en la cabeza.
//
// PROBADO ROMPIÉNDOLO (09/10/2026): ver el pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  VARIABLES_AVISO, GRUPOS_VARIABLES, datosOfrecidos, variablesPara, fuentesQueNombra, buscarDatos,
  RUTA_DE_LINK, valoresDeEjemplo, CLAVE_MENSAJE_MAKO, type FuenteDato,
} from '../lib/variables-aviso';
import {
  valoresDelNombre, valoresDelLead, valoresConZona, valoresDelProducto, valoresDeEtiquetas, valoresDePagos,
  valoresDelCurso, valoresDelPerfil, valoresDelLeadMagnet, valoresDelMomento, valoresDelCobro,
  valoresDeLaProximaReunion, valoresDeRespuestasAgenda, valoresDelPago, valoresDeLoEscrito, valoresDelAnalisis, TOPE_ESCRITO,
} from '../lib/variables-del-lead';
import { detalleDelAviso } from '../lib/calcom';
import { VARIABLES_LEAD, VARIABLES_NEGOCIO, esVariableConocida } from '../lib/template-vars';
import { CLAVES_DE_CUOTA } from '../lib/cobranza';
import type { Lead } from '../lib/leads';
import type { Clase } from '../lib/curso';

const leer = (r: string): string => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const claves = (g: ReturnType<typeof datosOfrecidos>) => g.flatMap((x) => x.items.map((i) => i.key));

const LEAD = {
  id: 2498, nombre: 'Sofía Contreras', email: 'sofia@ejemplo.com', telefono: '+5215512345678', empresa: 'Inmobiliaria del Valle',
  web: 'inmobiliariadelvalle.com', created_at: '2026-10-02T15:00:00Z', updated_at: '2026-10-02T15:00:00Z',
  fecha_agenda: '2026-10-12', fecha_junta_1: '2026-10-14', fecha_junta_2: '2026-10-21',
  junta_1_at: '2026-10-15T01:00:00Z', junta_2_at: '2026-10-22T00:30:00Z',
  junta_1_url: 'https://meet.google.com/abc-defg-hij', junta_2_url: 'https://meet.google.com/klm-nopq-rst',
  asistio_j1: true, asistio_j2: false, calificado: true, cerro: true, estado_lead: 'ganado', motivo_perdida: 'sin presupuesto',
  monto_cierre_usd: 1500, fecha_cierre: '2026-09-28', total_cobrado_usd: 500, monto_cuota_usd: 250, dia_de_pago: 10,
  suscripcion_monto_usd: 500, origen_lead: 'instant_form', meta_campaign_name: 'Inmobiliario · Octubre', meta_adset_name: 'Dueños 35-55',
  meta_ad_name: 'Video testimonio 3', utm_source: 'facebook', utm_medium: 'cpc', utm_campaign: 'oct-leads', utm_content: 'video-3',
  respuesta_facturacion: 'US$ 10k - 30k', respuesta_colaboradores: '5 a 10', respuesta_objetivo: 'duplicar las ventas',
  respuesta_cuando_empezar: 'este mes', respuesta_inversion: 'US$ 1k - 3k', respuesta_decisor: 'sí',
  closer: 'Daniela', setter: 'Valeria',
  meta_field_data: [{ name: '¿qué_tipo_de_propiedad_buscas_vender?', values: ['una_casa'] }],
} as unknown as Lead;

const clase = (id: number, titulo: string, tarea = ''): Clase => ({
  id, productoId: 7, etapa: 'm1', orden: id, titulo, descripcion: '', tipo: 'video', minutos: null,
  videoTipo: 'youtube', videoUrl: 'https://www.youtube.com/watch?v=abc', videoPath: null, tarea, campos: [], obligatoria: true,
} as unknown as Clase);

/** Las claves que pone CADA fuente, con fixtures completos. Es lo que hace medible el punto 3. */
function porFuente(): Record<FuenteDato, Set<string>> {
  const set = (o: Record<string, string>) => new Set(Object.keys(o));
  return {
    nombre: set(valoresDelNombre(LEAD.nombre)),
    ficha: set(valoresDelLead(LEAD)),
    zona: set(valoresConZona(LEAD, 'America/Tijuana')),
    producto: set(valoresDelProducto({ etapaClave: 'agenda', etapas: [{ key: 'agenda', label: 'Agendado' }], producto: 'Mentoría' })),
    etiquetas: set(valoresDeEtiquetas(['Cualificado'])),
    pagos: set(valoresDePagos([{ numero: 1, monto_usd: 250, fecha_esperada: '2026-11-10', pagado: false }])),
    curso: set(valoresDelCurso({ clases: [clase(1, 'Bienvenida'), clase(2, 'Tu oferta')], progreso: new Map([[1, { estado: 'pendiente', pct: 100, hechaAt: null }]]), link: 'https://x/portal' })),
    perfil: set(valoresDelPerfil({ oferta_nombre: 'Mentoría', oferta_ticket: '5000', oferta_promesa: 'Escalar', oferta_garantia: '30 días', marca_nombre: 'Sol' })),
    lead_magnet: set(valoresDelLeadMagnet([{ nombre: 'Plantilla', enlace: 'https://ejemplo.com/p' }])),
    momento: set(valoresDelMomento(Date.parse('2026-10-09T15:00:00Z'), 'America/Mexico_City')),
    negocio: new Set(['negocio']),
    links: new Set(Object.keys(RUTA_DE_LINK)),
    // «Lo que arma MaKo» (11/10/2026) lo pone el emisor de un evento de MaKo (`ejecutarPaso`, lib/flujos.ts),
    // como la cuota la pone el cron de cobranza: lo fija tests/aviso-evento.test.ts leyendo ese fuente.
    evento: new Set(['link_lead', CLAVE_MENSAJE_MAKO]),
    cuota: new Set(CLAVES_DE_CUOTA),
    // El link para pagar (11/10/2026): su cobro pendiente más nuevo, de la tabla `cobros`.
    cobro: set(valoresDelCobro('https://x/pagar/abc')),
    // Undécima tanda (11/10/2026): la PRÓXIMA reunión (la fila + la zona + el momento), lo que contestó al agendar
    // (`lead_respuestas`), y lo que pasan los emisores en `datos`: el pago (`avisarPagoRecibido`) y lo que escribió
    // el lead (la charla). Esos dos se cruzan con su emisor en el test de abajo.
    proxima: set(valoresDeLaProximaReunion(PROXIMA, 'America/Tijuana', AHORA_PROXIMA)),
    respuestas: set(valoresDeRespuestasAgenda([{ respuestas: [{ q: '¿Tienes equipo?', a: 'Sí' }] }])),
    pago: set(valoresDelPago({ monto: 2300, moneda: 'USD', concepto: 'Mentoría', proveedor: 'stripe', renovacion: false, modo: 'prueba', alta: 'hecha' })),
    escrito: set(valoresDeLoEscrito('¿Puedo cambiar la hora?')),
    // 13/10/2026: lo que pasa el AI Analyst del Dashboard al terminar (`valoresDelAnalisis`).
    analisis: set(valoresDelAnalisis({ hoja: 'Ventas', resumen: 'Subieron.', hallazgos: ['Uno', 'Dos'], link: 'https://x/dashboard?hoja=1' })),
  };
}

/** Una R2 mañana a las 10:00 de Tijuana, en pie, con link: todo lo de «Próxima reunión» tiene valor. */
const PROXIMA = { junta_2_at: '2026-10-13T17:00:00Z', fecha_junta_2: '2026-10-13', asistio_j2: null, junta_2_url: 'https://meet.google.com/abc-defg-hij' };
const AHORA_PROXIMA = Date.parse('2026-10-12T17:00:00Z');

test('⛔ «Tu negocio» no se ofrece en NINGÚN «{ }», y el token se sigue resolviendo', () => {
  // Probado rompiéndolo (09/10/2026): `negocio` sin `oculta` → cae éste.
  for (const destino of ['lead', 'equipo'] as const) {
    const ks = claves(datosOfrecidos({ destino, conLead: true, conCuota: true }));
    assert.ok(!ks.includes('negocio'), `el «{ }» al ${destino} ofrece «Tu negocio»`);
    assert.ok(ks.includes('empresa'), `el «{ }» al ${destino} perdió «Empresa»`);
  }
  assert.ok(!VARIABLES_AVISO.some((v) => /tu negocio/i.test(v.label)), 'volvió el rótulo «Tu negocio»');
  assert.deepEqual(VARIABLES_NEGOCIO, [], 'los editores de WhatsApp y email lo siguen ofreciendo');
  // Resolverse: el motor lo conoce y el catálogo lo tiene (oculto).
  assert.equal(esVariableConocida('negocio'), true);
  assert.ok(VARIABLES_AVISO.some((v) => v.key === 'negocio' && v.oculta));
  // Y el «Empresa» del motor y el del catálogo son el MISMO token (los mensajes guardados lo usan).
  assert.deepEqual(VARIABLES_LEAD.map((v) => v.key), ['nombre', 'nombre_completo', 'apellido', 'empresa']);
  for (const k of VARIABLES_LEAD.map((v) => v.key)) assert.ok(VARIABLES_AVISO.some((v) => v.key === k && !v.oculta), `el árbol no tiene ${k}`);
});

test('⚠️ el DESTINO filtra: al lead, ni links al CRM ni su estado; al equipo, ni la llave del portal', () => {
  // Probado rompiéndolo (09/10/2026): `valePara` devolviendo siempre true → cae éste.
  const alLead = claves(datosOfrecidos({ destino: 'lead', conLead: true }));
  const alEquipo = claves(datosOfrecidos({ destino: 'equipo', conLead: true }));
  for (const k of ['link_crm', 'link_lead', 'lead_estado', 'lead_etiquetas', 'lead_campana', 'lead_utm_source', 'lead_asistio_r1']) {
    assert.ok(!alLead.includes(k), `al lead le ofrece ${k}`);
    assert.ok(alEquipo.includes(k), `al equipo no le ofrece ${k}`);
  }
  assert.ok(alLead.includes('curso_link') && !alEquipo.includes('curso_link'), 'el link del portal es SÓLO del lead');
  // Lo que pidió: la etapa, la reunión, los pagos, el curso, el Second Brain.
  for (const k of ['lead_etapa', 'lead_producto', 'lead_hora_r1', 'lead_link_r1', 'lead_proxima_cuota', 'curso_avance', 'negocio_oferta', 'negocio_lead_magnet_link', 'dia_semana']) {
    assert.ok(alLead.includes(k), `al lead le falta ${k}`);
  }
  // Y la campaña al equipo (MaKo en WhatsApp: «datos de campaña»).
  for (const k of ['lead_campana', 'lead_conjunto', 'lead_anuncio']) assert.ok(alEquipo.includes(k));
  // Sin destino es el equipo: los avisos de siempre no cambian de lista.
  assert.deepEqual(claves(datosOfrecidos({ conLead: true })), alEquipo);
});

test('⚠️ TODO lo que el árbol ofrece tiene quien lo PONGA: cada clave sale de la función de su fuente', () => {
  // AGENTS.md: un token ofrecido que nadie resuelve sale CRUDO al WhatsApp del lead. Probado
  // rompiéndolo (09/10/2026): sacar `lead_hora_r2` de `valoresConZona` → cae éste.
  const pone = porFuente();
  const faltan = VARIABLES_AVISO.filter((v) => !pone[v.fuente].has(v.key)).map((v) => `${v.key} (${v.fuente})`);
  assert.deepEqual(faltan, [], `el «{ }» ofrece datos que nadie resuelve: ${faltan.join(', ')}`);
  // Y cada fuente tiene su lectura en el resolvedor (una lectura por entidad nombrada).
  const res = sinComentarios(leer('lib/variables-resolver.ts'));
  for (const f of ['ficha', 'zona', 'producto', 'curso', 'etiquetas', 'pagos', 'cobro', 'perfil', 'lead_magnet', 'proxima', 'respuestas'] as const) {
    assert.match(res, new RegExp(`f\\.has\\('${f}'\\)`), `el resolvedor no lee «${f}»`);
  }
  assert.match(res, /if \(pide\('negocio'\)\)/);
  assert.match(res, /if \(zona && pide\('momento'\)\) Object\.assign\(out, valoresDelMomento\(Date\.now\(\), zona\)\);/);
  // El árbol: cada grupo con ícono, y ninguno vacío en el destino más amplio.
  for (const g of GRUPOS_VARIABLES) assert.ok(g.icono, `${g.key} sin ícono`);
  assert.equal(datosOfrecidos({ destino: 'equipo', conLead: true, conCuota: true, conAnalisis: true }).length, GRUPOS_VARIABLES.length);
  assert.ok(VARIABLES_AVISO.filter((v) => !v.oculta).length >= 70, 'se pidieron MUCHOS más datos');
  // La previa tiene con qué dibujar cada uno.
  const ej = valoresDeEjemplo();
  for (const v of VARIABLES_AVISO) assert.ok(ej[v.key]?.trim(), `${v.key} sin ejemplo`);
});

test('las funciones de cada entidad dicen lo que dicen', () => {
  // La hora de la reunión en la zona del NEGOCIO (01:00 UTC del 15/10 = 18:00 del 14 en Tijuana), con la forma de
  // todas desde la undécima tanda («6:00 p. m.», `horaDe`).
  assert.deepEqual(valoresConZona(LEAD, 'America/Tijuana'), { lead_hora_r1: '6:00 p. m.', lead_hora_r2: '5:30 p. m.' });
  assert.deepEqual(valoresConZona({ junta_1_at: null, junta_2_at: 'basura' }, 'America/Tijuana'), {}, 'sin hora no se inventa una');
  // La etapa con su rótulo; una clave que el producto ya no tiene no se dice (sería un slug).
  assert.deepEqual(valoresDelProducto({ etapaClave: 'agenda', etapas: [{ key: 'agenda', label: 'Agendado' }], producto: ' Mentoría ' }), { lead_etapa: 'Agendado', lead_producto: 'Mentoría' });
  assert.deepEqual(valoresDelProducto({ etapaClave: 'vieja', etapas: [{ key: 'agenda', label: 'Agendado' }], producto: null }), {});
  // Sin etiquetas es un hecho.
  assert.deepEqual(valoresDeEtiquetas([]), { lead_etiquetas: 'ninguna' });
  assert.deepEqual(valoresDeEtiquetas(['Cualificado', ' Seguimiento ']), { lead_etiquetas: 'Cualificado, Seguimiento' });
  // La próxima cuota es la primera sin pagar; las pagadas, sin el cobro inicial.
  const p = valoresDePagos([
    { numero: 2, monto_usd: 250, fecha_esperada: '2026-12-10', pagado: false },
    { numero: 0, monto_usd: 500, fecha_esperada: '2026-09-29', pagado: true },
    { numero: 1, monto_usd: 250, fecha_esperada: '2026-11-10', pagado: false },
  ]);
  assert.deepEqual(p, { lead_proxima_cuota: 'US$ 250', lead_proxima_cuota_vence: '10/11', lead_cuotas_pagadas: '0 de 2' });
  assert.deepEqual(valoresDePagos([]), {}, 'sin plan no hay «0 de 0»');
  // El curso con la regla del PORTAL: sin tarea, visto al 100 % cuenta; con tarea, sólo enviada.
  const c = valoresDelCurso({
    clases: [clase(1, 'Bienvenida'), clase(2, 'Tu oferta', 'Escribe tu oferta'), clase(3, 'Cierre')],
    progreso: new Map([[1, { estado: 'pendiente', pct: 100, hechaAt: null }], [2, { estado: 'pendiente', pct: 100, hechaAt: null }]]),
    link: null,
  });
  assert.deepEqual(c, { curso_avance: '1 de 3', curso_pct: '33 %', curso_proxima_clase: 'Tu oferta' });
  assert.deepEqual(valoresDelCurso({ clases: [], progreso: new Map(), link: null }), {}, 'sin curso, nada');
  // El precio de la oferta: número → plata; texto libre, tal cual.
  assert.equal(valoresDelPerfil({ oferta_ticket: '5000' }).negocio_precio, 'US$ 5.000');
  assert.equal(valoresDelPerfil({ oferta_ticket: 'USD 1,500' }).negocio_precio, 'US$ 1.500');
  assert.equal(valoresDelPerfil({ oferta_ticket: 'desde 5 mil' }).negocio_precio, 'desde 5 mil');
  assert.deepEqual(valoresDelPerfil({}), {}, 'un hueco del perfil no se inventa');
  // El lead magnet: el primero con nombre, y su link si lo tiene.
  assert.deepEqual(valoresDelLeadMagnet([{ nombre: '' }, { nombre: 'Plantilla' }]), { negocio_lead_magnet: 'Plantilla' });
  // El momento en la zona: viernes 9/10 a las 9:00 en Ciudad de México.
  assert.deepEqual(valoresDelMomento(Date.parse('2026-10-09T15:00:00Z'), 'America/Mexico_City'), { fecha: '09/10', hora: '9:00 a. m.', dia_semana: 'viernes' });
  // El nombre partido como el motor.
  assert.deepEqual(valoresDelNombre('  Sofía   Contreras Ruiz '), { nombre: 'Sofía', nombre_completo: 'Sofía Contreras Ruiz', lead_nombre: 'Sofía Contreras Ruiz', apellido: 'Contreras Ruiz' });
});

test('⚠️ una lectura por ENTIDAD que el texto NOMBRA, y el motor la usa en sus CUATRO envíos', () => {
  // Probado rompiéndolo (09/10/2026): el email del motor volviendo a `valoresVariablesLead` solo → cae éste.
  // Integración de la segunda pasada: el cuarto es Instagram/Messenger (`enviarPasoSocial`). Con ese
  // envío todavía en `valoresVariablesLead` (como estaba antes de enchufarlo) daba 3 → cae éste.
  assert.deepEqual([...fuentesQueNombra('Hola {{nombre}}, tu reunión es el {{lead_fecha_r1}} a las {{lead_hora_r1}}')].sort(), ['ficha', 'nombre', 'zona']);
  assert.deepEqual([...fuentesQueNombra('Sin datos, {{inventada}}')], []);
  assert.deepEqual([...fuentesQueNombra('{{negocio_oferta}} y {{negocio_lead_magnet}}')].sort(), ['lead_magnet', 'perfil']);
  const motor = sinComentarios(leer('lib/nutricion.ts'));
  const usos = motor.match(/await datosParaElLead\(JSON\.stringify\((paso|p)\), valoresVariablesLead\(/g) ?? [];
  assert.equal(usos.length, 4, `el motor resuelve el «{ }» en ${usos.length} de sus 4 envíos (WhatsApp, email, «Si responde», Instagram/Messenger)`);
  // Lo oficial (las plantillas de Meta) sigue con lo de siempre: sus parámetros los registra Meta.
  assert.match(motor, /bodyParams: valoresVariablesLead\(lead, \{ negocio \}\),/);
  // `datosParaElLead` no lee nada si lo que el texto nombra ya lo tiene el motor en la mano.
  const res = sinComentarios(leer('lib/variables-resolver.ts'));
  const dpl = res.slice(res.indexOf('export async function datosParaElLead('));
  assert.match(dpl, /\.filter\(\(t\) => !\(t\.slice\(2, -2\)\.toLowerCase\(\) in base\)\)/);
  assert.match(dpl, /if \(!fuentesQueNombra\(faltan\.join\(' '\)\)\.size\) return base;/);
  assert.match(dpl, /destino: 'lead'/);
  assert.match(dpl, /return \{ \.\.\.extra, \.\.\.base \};/, 'lo que el motor tiene en la mano es más nuevo: gana');
});

test('la búsqueda del selector encuentra por la palabra que uno tiene en la cabeza', () => {
  const g = datosOfrecidos({ destino: 'equipo', conLead: true, conCuota: true });
  const de = (q: string) => buscarDatos(g, q).map((r) => r.dato.key);
  assert.ok(de('saldo').includes('lead_saldo'), 'por el token');
  assert.ok(de('reunion').includes('lead_fecha_r1'), 'sin tildes');
  assert.ok(de('PAGOS').length >= 8, 'por el nombre de la rama');
  assert.deepEqual(de('   '), [], 'sin texto no hay resultados (se ve el árbol)');
  assert.ok(de('link curso').length === 0, 'el link del portal no está en el «{ }» del equipo');
  assert.ok(buscarDatos(datosOfrecidos({ destino: 'lead', conLead: true }), 'link curso').some((r) => r.dato.key === 'curso_link'));
});

test('el selector: árbol con ícono por rama, buscador, texto plano y sin filtrar por su cuenta', () => {
  // Probado rompiéndolo (09/10/2026): el árbol sin `<Icon name={g.icono}` → cae éste.
  const src = sinComentarios(leer('app/_components/SelectorDatos.tsx'));
  assert.match(src, /^'use client';/m);
  assert.match(src, /<Icon name=\{g\.icono\} size=\{17\} \/>/, 'las ramas sin su ícono');
  assert.match(src, /aria-expanded=\{on\}/, 'las ramas no se abren ni se cierran');
  assert.match(src, /buscarDatos\(grupos, q\)/, 'la búsqueda no es la del catálogo');
  assert.match(src, /onElegir\(d\.key\)/);
  // La pieza NO decide qué se ofrece: eso es del catálogo (`datosOfrecidos`).
  assert.doesNotMatch(src, /variablesPara|soloPara|alcance/);
  assert.doesNotMatch(src, /chip/i, 'un chip lo borra el serializador del editor');
});

// ── Undécima tanda (11/10/2026): lo que reemplaza a «{{mensaje_mako}}» ───────────────────────────────────────
// Martín, punto 4: «ese dato NO existe... No es trackeable». Lo que el código de cada aviso pegaba en un token pasa
// a datos que se citan: la próxima reunión (tests/proxima-reunion), lo que contestó al agendar, lo que escribió el
// lead y el pago. Los dos últimos los pasa su EMISOR en `datos` (como la cuota de la cobranza).

test('lo que contestó al agendar: la ÚLTIMA fila, con los MISMOS renglones que el aviso de Cal.com', () => {
  const qa = [
    { q: '¿Hace cuánto que formas parte del rubro inmobiliario?', a: '5 años' },
    { q: 'Tu Instagram', a: '@ejemplo' },
    { q: '   ', a: 'sin pregunta' }, { q: 'Vacía', a: ' ' },
  ];
  const v = valoresDeRespuestasAgenda([{ respuestas: qa }, { respuestas: [{ q: 'vieja', a: 'no' }] }]);
  // La misma función que arma el aviso de hoy (`detalleDelAviso`, sin contacto): un renglón, una forma.
  const delAviso = detalleDelAviso({ telefono: null, email: null, respuestas: qa.slice(0, 2).map((x) => ({ clave: 'c', rotulo: x.q, valor: x.a })) });
  assert.equal(v.lead_respuestas_agenda, delAviso.join('\n'));
  assert.equal(v.lead_respuestas_agenda, '• Hace cuánto que formas parte del rubro…: 5 años\n• Instagram: @ejemplo');
  // Más de seis: «+N en el resumen» (la ficha del CRM, adonde lleva el link del aviso).
  const muchas = Array.from({ length: 8 }, (_, i) => ({ q: `Pregunta ${i + 1}`, a: 'Sí' }));
  assert.match(valoresDeRespuestasAgenda([{ respuestas: muchas }]).lead_respuestas_agenda!, /\n• \+2 en el resumen$/);
  // Sin fila, sin respuestas con texto o con basura: nada (y su renglón se va).
  assert.deepEqual(valoresDeRespuestasAgenda([]), {});
  assert.deepEqual(valoresDeRespuestasAgenda([{ respuestas: 'roto' }]), {});
  assert.deepEqual(valoresDeRespuestasAgenda([{ respuestas: [{ q: 'x', a: '' }, null] }]), {});
});

test('lo que escribió el lead: el texto, cortado en una palabra si es largo; vacío no entra', () => {
  assert.deepEqual(valoresDeLoEscrito('  ¿Puedo cambiar la hora?  '), { lead_escribio: '¿Puedo cambiar la hora?' });
  assert.deepEqual(valoresDeLoEscrito('   '), {});
  assert.deepEqual(valoresDeLoEscrito(null), {});
  const largo = valoresDeLoEscrito('palabra '.repeat(60)).lead_escribio!;
  assert.ok(largo.length <= TOPE_ESCRITO && largo.endsWith('…'), `cortó mal: ${largo.length}`);
});

test('⚠️ el PAGO por CÓDIGO: el monto con su moneda, la pasarela, el tipo, la prueba y el alta de MaKo', () => {
  assert.deepEqual(valoresDelPago({ monto: 2300, moneda: 'USD', concepto: ' Mentoría ', proveedor: 'stripe', renovacion: false, modo: 'real', alta: null }),
    { pago_monto: 'US$ 2.300', pago_concepto: 'Mentoría', pago_pasarela: 'Stripe', pago_tipo: 'Primer pago' });
  // La renovación trae SU monto y su moneda; la prueba se dice; el alta de una venta de MaKo también.
  const r = valoresDelPago({ monto: 1500.5, moneda: 'MXN', concepto: 'Plan', proveedor: 'mercadopago', renovacion: true, modo: 'prueba', alta: 'ya_tenia_cuenta' });
  assert.equal(r.pago_monto, '$ 1.500,50 MXN');
  assert.equal(r.pago_pasarela, 'Mercado Pago');
  assert.equal(r.pago_tipo, 'Renovación');
  assert.equal(r.pago_modo, 'Prueba');
  assert.equal(r.pago_alta, 'Ya tenía cuenta');
  assert.equal(valoresDelPago({ monto: 1, moneda: 'USD', concepto: null, proveedor: 'stripe', renovacion: false, modo: 'real', alta: 'error' }).pago_alta, 'El alta falló');
  // Sin valor NO entra (y el renglón se va): un pago real no dice «Prueba», un alta pendiente no dice nada.
  const real = valoresDelPago({ monto: 1, moneda: 'USD', concepto: '', proveedor: 'stripe', renovacion: false, modo: 'real', alta: 'pendiente' });
  for (const k of ['pago_modo', 'pago_alta', 'pago_concepto']) assert.ok(!(k in real), `${k} entró sin valor`);
});

test('CABLEADO: los emisores pasan los datos (el pago y la charla), y el texto de siempre se queda hasta la limpieza', () => {
  // lib/cobros.ts lleva `server-only` (no carga bajo tsx): se lee su fuente sin comentarios.
  const cobros = sinComentarios(leer('lib/cobros.ts'));
  const aviso = cobros.slice(cobros.indexOf('async function avisarPagoRecibido('), cobros.indexOf('async function estadoDelAlta('));
  assert.ok(aviso.length > 200, 'no encontré el aviso del pago');
  assert.match(aviso, /const alta = await estadoDelAlta\(c\);\n\s*const cuenta = lineaDelAlta\(c, alta\);/, 'el alta se lee dos veces (o ninguna)');
  assert.match(aviso, /datos: valoresDelPago\(\{\n\s*monto: p\.monto, moneda: p\.moneda, concepto: c\.concepto, proveedor: c\.proveedor,\n\s*renovacion: p\.renovacion, modo: c\.modo, alta,\n\s*\}\),/, 'el aviso del pago no pasa sus datos');
  assert.match(aviso, /\n\s*texto: `💰 \*Entró un pago\*/, 'el texto de siempre (compatibilidad de `{{mensaje_mako}}`) se fue antes de la limpieza');
  const handoff = sinComentarios(leer('lib/chat-agent-handoff.ts'));
  assert.match(handoff, /lead: \{ id: input\.leadId, nombre: input\.leadNombre \?\? null \},\n\s*datos: valoresDeLoEscrito\(input\.mensaje\),/, 'la charla no pasa lo que escribió el lead');
});

// ── Roturas (09/10/2026) ─────────────────────────────────────────────────────────────────────
// Arnés en el scratchpad, una por vez, restaurada DE MEMORIA (nunca `git checkout`), corriendo este
// archivo con tests/paso-variables-editor y tests/variables-aviso. Base: 34 / 0. Restaurado: 34 / 0.
//   D1. `negocio` sin `oculta` («Tu negocio» de vuelta en el árbol)              → 33 / 1
//   D2. `valePara` siempre true (al lead le llegan los links del CRM)            → 31 / 3
//   D3. `valoresConZona` sin la hora de la 2ª reunión (ofrecida y sin resolver)  → 32 / 2
//   D4. el email del motor con `valoresVariablesLead` solo (sin el árbol)        → 33 / 1
//   D5. las ramas del selector sin su ícono                                      → 33 / 1
//   D6. `datosParaElLead` lee aunque el motor ya tenga el dato en la mano       → 33 / 1
//   D7. el avance del curso contando lo ABIERTO y no lo completado              → 33 / 1
//   D8. la búsqueda sensible a tildes y mayúsculas                               → 33 / 1
//   PV1. `aplicarVariables` sin dígitos en las dos llaves (paso-variables-editor) → 33 / 1
//   PV2. «Tu negocio» de vuelta en VARIABLES_NEGOCIO                             → 32 / 2
// Undécima tanda (11/10/2026, arnés scratchpad/wf-undecima/w1-datos-catalogo/romper.mjs, restaurado con md5).
// Este archivo solo: base 11 / 0, restaurado 11 / 0.
//   R14. lo que contestó al agendar con la fila más VIEJA en vez de la última                  → 10 / 1
//   R15. `pago_modo` puesto en '' en un pago real (su renglón no se iría)                       → 10 / 1
//   R16. `avisarPagoRecibido` sin pasar sus `datos`                                             → 10 / 1
//   R17. la charla (lib/chat-agent-handoff.ts) sin pasar lo que escribió                        → 10 / 1
//   R18. el resolvedor sin la lectura de `lead_respuestas`                                      → 10 / 1
//   R19. la hora de las reuniones otra vez en 24 h («18:00»: dos formas de la misma hora)      → 10 / 1
// Con tests/proxima-reunion (base 19 / 0): la estricta acepta una fecha sin hora               → 17 / 2
// Con tests/calcom-respuestas (base 31 / 0): el aviso de Cal.com con otros renglones que el dato → 28 / 3
