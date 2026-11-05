// =============================================================================
// El CRM del onboarding, a medida de lo que vende (20/10/2026)
// =============================================================================
// Martín (pedido del 18/10, punto 10): «el armado del CRM también debe ser personalizado, no sé si está preseteado con lo
// que teníamos antes». MaKo elige el tipo (entre los de su canal) y nombra cada etapa con las palabras del negocio; las
// CLAVES no cambian (las nutriciones y las automatizaciones mueven por clave). lib/onboarding-crm.ts.
//
// ROTURAS (20/10/2026, arnés romper-crm-medida.js del scratchpad; base 5/0): el parse acepta un tipo de otro canal → 4/1 ·
// sin el tope del nombre → 4/1 · el «Sí, es correcto» ignora la propuesta → 4/1 · la siembra sin los nombres → 4/1 · la
// ruta no arma la propuesta al llegar al CRM → 4/1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { candidatosCrm, etapasConNombres, parsePropuestaCrm, tiposParaPrompt, TOPE_NOMBRE_ETAPA } from '../lib/onboarding-crm';
import { CRM_SI, leerRespuesta, mensajesDeArranque, tiposOfrecidos, type EstadoArranque, type HechosArranque } from '../lib/onboarding-arranque';
import { TIPOS_CRM } from '../lib/pipeline';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

const H: HechosArranque = {
  modo: 'oferta', nombreCuenta: 'Martín Koncke', nombreWorkspace: 'Consultorio Sonrisa', faseGuardada: true,
  canalNegocio: 'llamadas', loQueVende: true, conCrm: true, conTelefono: false, terminado: false,
  // Invierte de $600 a $3.000 al mes (la segunda opción de 'inversion'): con eso, por llamada, MaKo recomienda «Llamada de venta».
  faseNegocio: { respuestas: [0, 1, 0, 0, 0, 0], fase: 0 },
};
// Con «Agendan llamada» contestado (5/11/2026, la pregunta de la entrada va antes del CRM por llamada o por chat).
const QUIEN: EstadoArranque = { nombre: 'Martín', negocio: 'Consultorio Sonrisa', origen: 'Instagram', interes: 'ventas', pdfOk: 'si', entrada: 'agenda_sola' };

test('MaKo elige entre los tipos de SU canal, y la lista del prompt lleva clave y nombre de cada etapa', () => {
  const llamadas = candidatosCrm('llamadas');
  assert.ok(llamadas.length >= 1 && llamadas.every((t) => t.canal === 'llamadas'));
  assert.equal(candidatosCrm(null).length, TIPOS_CRM.filter((t) => t.pipeline.length).length, 'sin canal, todos');
  const lista = tiposParaPrompt(llamadas);
  assert.match(lista, /- llamada: «Llamada de venta»/);
  assert.match(lista, /agenda = Agenda R1/);
});

test('lo que devuelve la IA: un tipo de los candidatos, nombres cortos, sin claves inventadas ni repetidos', () => {
  const cands = candidatosCrm('llamadas');
  const ok = parsePropuestaCrm('{"tipo": "llamada", "etapas": {"lead": "Pidió información", "agenda": "Agendó su consulta", "inventada": "Otra", "ganado": "Empezó su tratamiento"}}', cands);
  assert.deepEqual(ok, { tipo: 'llamada', etapas: { lead: 'Pidió información', agenda: 'Agendó su consulta', ganado: 'Empezó su tratamiento' } });
  assert.equal(parsePropuestaCrm('{"tipo": "carrito", "etapas": {}}', cands), null, 'un tipo de otro canal no se acepta');
  assert.equal(parsePropuestaCrm('{"tipo": "no-existe"}', cands), null);
  assert.equal(parsePropuestaCrm('esto no es json', cands), null);
  const largo = 'x'.repeat(TOPE_NOMBRE_ETAPA + 1);
  const raro = parsePropuestaCrm({ tipo: 'llamada', etapas: { lead: largo, agenda: 'Agendó 📅', ganado: '' } }, cands);
  assert.deepEqual(raro, { tipo: 'llamada', etapas: {} }, 'un nombre largo, con emoji o vacío queda el de fábrica');
  const repetido = parsePropuestaCrm({ tipo: 'llamada', etapas: { lead: 'Consulta', agenda: 'consulta' } }, cands);
  assert.deepEqual(repetido?.etapas, { lead: 'Consulta' }, 'dos columnas con el mismo nombre no se distinguen');
  // Una terminal no puede decir lo contrario (revisión del Cerebro, 20/10): la columna de los que compraron no se llama «Perdido».
  const alReves = parsePropuestaCrm({ tipo: 'llamada', etapas: { ganado: 'Perdido', agenda: 'Agendó su consulta' } }, cands);
  assert.deepEqual(alReves?.etapas, { agenda: 'Agendó su consulta' });
});

test('las etapas con sus nombres: mismas claves y en el mismo orden', () => {
  const llamada = TIPOS_CRM.find((t) => t.id === 'llamada')!;
  const con = etapasConNombres(llamada.pipeline, { agenda: 'Agendó su consulta' });
  assert.deepEqual(con.map((s) => s.key), llamada.pipeline.map((s) => s.key));
  assert.equal(con.find((s) => s.key === 'agenda')?.label, 'Agendó su consulta');
  assert.deepEqual(etapasConNombres(llamada.pipeline, null), llamada.pipeline);
});

test('la propuesta manda: va primero, y «Sí, ese» elige ESE tipo', () => {
  const e: EstadoArranque = { ...QUIEN, crmPropuesta: { tipo: 'dos_reuniones', etapas: { agenda: 'Primera consulta' } } };
  assert.equal(tiposOfrecidos('llamadas', false, e.crmPropuesta).tipos[0].id, 'dos_reuniones');
  assert.equal(tiposOfrecidos('llamadas', false, null).tipos[0].id, 'llamada', 'sin propuesta, la plantilla de su canal');
  assert.ok(mensajesDeArranque(e, H).despues.some((m) => m.id === 'arr-crm' && m.opciones?.[0] === CRM_SI));
  assert.deepEqual(leerRespuesta(e, H, { opcion: 0, opcionTexto: CRM_SI }), { ok: true, patch: { crmTipo: 'dos_reuniones' } });
  assert.deepEqual(leerRespuesta({ ...QUIEN, crmPropuesta: null }, H, { opcion: 0, opcionTexto: CRM_SI }), { ok: true, patch: { crmTipo: 'llamada' } });
});

test('la ruta la arma UNA vez al llegar al CRM, y siembra con sus nombres', () => {
  const ruta = sinComentarios(leer('app/api/onboarding/arranque/route.ts'));
  assert.match(ruta, /if \(h\.conCrm && \(etapa === 'pdf' \|\| etapa === 'cobro' \|\| etapa === 'fase' \|\| etapa === 'entrada'\) && nuevo\.crmPropuesta === undefined && !nuevo\.crmTipo\) \{/);
  // Desde el 5/11/2026 la IA recibe UN candidato, el que decidió `recomendarFunnel`: sólo nombra sus etapas.
  assert.match(ruta, /if \(etapaDeArranque\(nuevo, h2\) === 'crm'\) \{\n\s*await guardarEstadoArranque\(\{ crmPropuesta: await propuestaDeCrm\(nuevo, h2\.canalNegocio, funnelDelArranque\(nuevo, h2\)\.tipo\)\.catch\(\(\) => null\) \}\);/);
  assert.match(ruta, /sembrarCrmPrincipal\(patch\.crmTipo, e\.negocio \?\? '', e\.crmPropuesta\?\.tipo === patch\.crmTipo \? e\.crmPropuesta\.etapas : undefined\)/);
  const server = sinComentarios(leer('lib/onboarding-arranque-server.ts'));
  assert.match(server, /const s = \{ \.\.\.siembra, pipeline: etapasConNombres\(siembra\.pipeline, nombres\) \};/);
  assert.match(sinComentarios(leer('app/onboarding/ChatArranque.tsx')), /const etapas = etapasConNombres\(tipo\.pipeline, p\?\.tipo === tipo\.id \? p\.etapas : null\);/,
    'la tarjeta tiene que mostrar los nombres que se van a sembrar');
});
