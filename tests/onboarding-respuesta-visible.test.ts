// =============================================================================
// Tu respuesta aparece donde está la pregunta: nunca sólo los puntitos (18/10/2026)
// =============================================================================
// Martín, punto 11: «envío una respuesta rápida y automáticamente salen los tres puntos de MaKo respondiéndome, pero no
// sale la respuesta que yo envié». La respuesta optimista del arranque se agrega al lado (`antes` o `despues` de la
// conversación de Offer) que dice `ladoDeLaPregunta`. Cuando «¿Cómo llegaste?» y «¿Qué resolver primero?» pasaron al
// final, el mapa siguió diciendo `antes`: la respuesta quedaba arriba, fuera de la vista.
// La invariante: en CADA etapa con pregunta, y en los dos modos, el lado que dice `ladoDeLaPregunta` termina en esa
// pregunta abierta (un mensaje de MaKo con opciones o que espera texto).
//
// ROTURAS (18/10/2026, arnés romper-lado.js del scratchpad; base 2/0): «origen» de vuelta en `antes` → 1/1 · «interes»
// de vuelta en `antes` → 1/1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { etapaDeArranque, mensajesDeArranque, type EstadoArranque, type HechosArranque } from '../lib/onboarding-arranque';
import { ladoDeLaPregunta } from '../app/onboarding/arranque-ui';

const H: HechosArranque = {
  modo: 'oferta', nombreCuenta: 'Ayelen', nombreWorkspace: 'Cliente de Prueba', faseGuardada: true,
  canalNegocio: null, loQueVende: true, conCrm: true, conTelefono: false, terminado: false,
};
const FASE = { canal: 'llamadas' as never, faseResp: Array.from({ length: 20 }, () => 0) };

const casos: Array<[string, EstadoArranque, HechosArranque]> = [
  ['telefono', {}, { ...H, conTelefono: true }],
  ['codigo', { telefono: 'codigo' }, { ...H, conTelefono: true }],
  ['nombre', {}, H],
  ['negocio', { nombre: 'Ayelen' }, H],
  ['crm', { nombre: 'Ayelen', negocio: 'N' }, H],
  ['origen', { nombre: 'Ayelen', negocio: 'N', crmTipo: 'llamada' }, H],
  ['interes', { nombre: 'Ayelen', negocio: 'N', crmTipo: 'llamada', origen: 'Instagram' }, H],
];

test('modo oferta: el lado de la respuesta termina en la pregunta abierta, en cada etapa', () => {
  for (const [etapa, e, h] of casos) {
    assert.equal(etapaDeArranque(e, h), etapa, `el estado del caso «${etapa}» no cae en esa etapa`);
    const m = mensajesDeArranque(e, h);
    const lado = m[ladoDeLaPregunta(etapa as never, h.modo)];
    const ult = lado[lado.length - 1];
    const abierta = !!ult && ult.de === 'mako' && ((ult.opciones?.length ?? 0) > 0 || ult.texto.includes('?'));
    assert.ok(abierta, `«${etapa}»: la respuesta se dibujaría en el lado ${ladoDeLaPregunta(etapa as never, h.modo)}, lejos de su pregunta`);
  }
});

test('modo plan: también, con las del final en `antes`', () => {
  const plan: HechosArranque = { ...H, modo: 'plan', conCrm: false, conTelefono: false };
  const e: EstadoArranque = { nombre: 'Ayelen', negocio: 'N', queHace: 'Consultoría', ...FASE };
  assert.equal(etapaDeArranque(e, plan), 'origen');
  const lado = mensajesDeArranque(e, plan)[ladoDeLaPregunta('origen', 'plan')];
  assert.match(lado[lado.length - 1].texto, /llegaste a MaKo/);
});
