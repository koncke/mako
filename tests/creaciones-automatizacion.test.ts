// Una automatización publicada en la galería (lib/creaciones-automatizacion.ts) lleva la DEFINICIÓN y nada de su
// negocio: ni ids (audios, archivos, etiquetas, líneas, embudos, productos, otras automatizaciones), ni personas
// (remitente, emails, teléfonos), ni cuentas (la plantilla de su Meta, su voz clonada), ni los ejemplos del ensayo.
//
// Verificado rompiéndolo (13/10/2026), con la base en verde (5 de 5):
//   · sacar `.map(sinDatosDelNegocio)` → 2 fallos, 3 pases (el remitente, la plantilla, la voz y los params viajan).
//   · sacar `.map(cronSinIds)` (pasar los disparadores tal cual) → 1 fallo, 4 pases.
//   · `limpiarReferencias(c.pasos, NADA, {})` (sin los guiones) → 1 fallo, 4 pases (el audio queda vacío).
//   · cambiar `PARAM_ID` a /i (`Ids?$` sin distinguir mayúsculas) → 1 fallo, 4 pases (`paid` se borra).
import test from 'node:test';
import assert from 'node:assert/strict';
import { copiaDeFlujo, type CronCopiado, type PasoCopiado } from '../lib/flujo-copia';
import { definicionPublicable, leerDefinicionAutomatizacion, resumenAutomatizacion } from '../lib/creaciones-automatizacion';

const msg = (id: string, siguiente: string | null, extra: Record<string, unknown> = {}): PasoCopiado =>
  ({ id, canal: 'whatsapp', proveedor: 'no_oficial', delay_horas: 0, asunto: null, template_wa: null, tipo: 'texto', cuerpo: `hola ${id}`, siguiente, ...extra }) as unknown as PasoCopiado;
const ini = (siguiente: string): PasoCopiado => ({ id: 'entrada', nodo: 'inicio', siguiente, canal: 'whatsapp', delay_horas: 0, cuerpo: '' }) as unknown as PasoCopiado;

const DEL_NEGOCIO = ['ventas@minegocio.com', '+5491125052605', 'voz-clonada-77', 'plantilla_bienvenida', 'Juan <juan@minegocio.com>', '5491100000000@s.whatsapp.net'];

function copiaConTodo() {
  const pasos = [
    ini('a'),
    msg('a', 'b', { remitente: 'Juan <juan@minegocio.com>', template_wa: 'plantilla_bienvenida', template_idioma: 'es_MX', linea: 'mako-linea-2' }),
    msg('b', 'c', { tipo: 'audio', audio_id: 9, cuerpo: '' }),
    msg('c', 'd', { tipo: 'media', media_id: 4 }),
    {
      id: 'd', siguiente: 'e', canal: 'whatsapp', delay_horas: 0, cuerpo: '',
      accion: { operacion: 'mover_etapa_lead', params: { etapa: 'agendado', funnelId: 7, leadId: 12, etiquetaIds: [3], email: 'ventas@minegocio.com', telefono: '+5491125052605', destinatarioJid: '5491100000000@s.whatsapp.net', paid: true } },
    },
    { id: 'e', nodo: 'respuesta', casos: [], si_no: null, canal: 'whatsapp', delay_horas: 0, cuerpo: '', paso_ia: true, objetivo: 'agendar', audio: { voz: 'voz-clonada-77' }, ejemplos: [{ texto: 'sí, el martes' }] },
  ] as unknown as PasoCopiado[];
  const disparadores: CronCopiado[] = [{ id: 'd1', trigger_tipo: 'etapa', etapa: 'agendado', funnel_id: 7, producto_id: 2, etiqueta_id: 5 }];
  return copiaDeFlujo({ nombre: 'Bienvenida', emoji: '👋', pasos, disparadores, guiones: { 9: 'Hola, te habla Juan' } });
}

test('lo publicado no trae NADA del negocio: ni personas, ni cuentas, ni ids', () => {
  const pub = definicionPublicable(copiaConTodo());
  const texto = JSON.stringify(pub);
  for (const x of DEL_NEGOCIO) assert.ok(!texto.includes(x), `viajó «${x}»`);
  const a = pub.pasos.find((p) => p.id === 'a')!;
  for (const k of ['remitente', 'template_wa', 'template_idioma', 'linea']) assert.equal(k in a, false, `viajó ${k}`);
  const e = pub.pasos.find((p) => p.id === 'e')!;
  assert.deepEqual(e.audio, { voz: 'propia' }, 'la voz clonada de ESE negocio viajó');
  assert.equal('ejemplos' in e, false, 'viajaron los ejemplos del ensayo');
  assert.equal(e.objetivo, 'agendar', 'se perdió la creación (el objetivo)');
});

test('el paso «⚡ Acción» conserva lo que es la receta y pierde los ids y contactos', () => {
  const d = definicionPublicable(copiaConTodo()).pasos.find((p) => p.id === 'd')!;
  assert.deepEqual((d.accion as { params: Record<string, unknown> }).params, { etapa: 'agendado', paid: true });
});

test('un audio con guion pasa a TEXTO; un archivo queda sin elegir', () => {
  const pub = definicionPublicable(copiaConTodo());
  const b = pub.pasos.find((p) => p.id === 'b')!;
  assert.deepEqual([b.tipo, b.audio_id, b.cuerpo], ['texto', null, 'Hola, te habla Juan']);
  assert.equal(pub.pasos.find((p) => p.id === 'c')!.media_id, null);
  assert.equal(pub.guiones, undefined, 'los guiones ya se usaron: no viajan aparte');
});

test('el CRON viaja por su tipo y su etapa, sin los ids de su embudo', () => {
  const pub = definicionPublicable(copiaConTodo());
  assert.deepEqual(pub.disparadores, [{ id: 'd1', trigger_tipo: 'etapa', etapa: 'agendado' }]);
});

test('lo publicado se vuelve a leer como un flujo entero, y el resumen cuenta las tarjetas', () => {
  const pub = definicionPublicable(copiaConTodo());
  const l = leerDefinicionAutomatizacion(JSON.parse(JSON.stringify(pub)));
  assert.ok(l);
  assert.equal(l!.que, 'flujo');
  assert.deepEqual(resumenAutomatizacion(pub), { nombre: 'Bienvenida', detalle: '5 tarjetas' });
  assert.equal(leerDefinicionAutomatizacion({ mako: 'otra' }), null);
  assert.equal(resumenAutomatizacion(null), null);
});
