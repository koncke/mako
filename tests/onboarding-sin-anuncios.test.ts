// =============================================================================
// Ninguna pregunta del arranque anuncia el final: el cierre se dice UNA vez, al final de verdad (18/10/2026)
// =============================================================================
// Martín (captura del 18/10): «no me puede estar diciendo "Antes de terminar"... "Una última cosa"... cada rato». Salían
// «Antes de terminar, Ayelen: ¿cómo llegaste a MaKo?» y después «Última cosa: ¿a qué WhatsApp te escribo…?».
// Este test recorre la conversación ENTERA, en los dos modos, hasta la última pregunta, y falla si algún mensaje de
// MaKo antes del cierre trae un anunciador.
//
// ROTURAS (18/10/2026, arnés romper-anuncios.js del scratchpad, con onboarding-preguntas y onboarding-arranque; base
// 35 / 0): vuelve «Antes de terminar» en el origen → 32 / 3 · vuelve «Última cosa» en el teléfono → 34 / 1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mensajesDeArranque, type EstadoArranque, type HechosArranque } from '../lib/onboarding-arranque';

const ANUNCIA = /antes de terminar|[uú]ltima cosa|una cosa m[aá]s|por [uú]ltimo|para terminar|para cerrar|ya casi (terminamos|estamos)|[uú]ltimo paso|[uú]ltima pregunta/i;

const H: HechosArranque = {
  modo: 'oferta', nombreCuenta: 'Ayelen Ruiz', nombreWorkspace: 'Consultesis', faseGuardada: true,
  canalNegocio: null, loQueVende: true, conCrm: true, conTelefono: true, terminado: false,
};

const textosDeMako = (e: EstadoArranque, h: HechosArranque) => {
  const { antes, despues } = mensajesDeArranque(e, h);
  return [...antes, ...despues].filter((m) => m.de === 'mako').map((m) => m.texto);
};

test('modo oferta: de la primera pregunta a la del teléfono, ninguna anuncia el final', () => {
  // En la etapa del teléfono se dibuja TODA la conversación hasta la última pregunta.
  const e: EstadoArranque = { nombre: 'Ayelen', negocio: 'Consultesis', crmTipo: 'llamada', origen: 'Instagram', interes: 'ventas' };
  const textos = textosDeMako(e, H);
  assert.ok(textos.length >= 6, `esperaba la conversación entera y vinieron ${textos.length} mensajes`);
  assert.ok(textos.some((t) => /WhatsApp/.test(t)), 'no llegó a la pregunta del teléfono');
  for (const t of textos) assert.doesNotMatch(t, ANUNCIA, `«${t}» anuncia el final antes de tiempo`);
});

test('modo plan: hasta la última pregunta, tampoco', () => {
  const plan: HechosArranque = { ...H, modo: 'plan', conCrm: false, conTelefono: false };
  // Con el diagnóstico contestado (en el modo plan lo dibuja el arranque con sus respuestas).
  const e: EstadoArranque = { nombre: 'Ayelen', negocio: 'Consultesis', queHace: 'Consultoría', canal: 'llamadas' as never, faseResp: Array.from({ length: 20 }, () => 0) };
  const textos = textosDeMako(e, plan);
  assert.ok(textos.some((t) => /llegaste a MaKo/.test(t)), 'no llegó a la pregunta del origen');
  for (const t of textos) assert.doesNotMatch(t, ANUNCIA, `«${t}» anuncia el final antes de tiempo`);
});
