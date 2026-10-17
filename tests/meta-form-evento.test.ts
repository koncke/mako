// =============================================================================
// «Nada por detrás», lote 3: «completó tu formulario de Meta» es una automatización de SuperAdmin (17/10/2026)
// =============================================================================
// docs/inventario-nada-por-detras.md, lote 3: `lead-formulario-meta` salía del store de /mensajes y lo que faltaba se tapaba
// con frases del código («sin teléfono», «Sin preguntas extra en el formulario.»). Ahora es el evento de la plataforma
// `lead_formulario_meta`: del lead salen su nombre y el link a su ficha, el formulario pasa sus datos
// (`datosFormularioMeta`) y lo que falta se lleva su renglón. Su fila nace PAUSADA, como nacía apagado.
//
// PROBADO ROMPIÉNDOLO (17/10/2026, arnés `romper.py` + `roturas-meta.json`; base 3 / 0). Pasan / fallan:
//   1. sin teléfono vuelve la frase de relleno                                     → 2 / 1
//   2. las respuestas sin su salto de línea (pegadas a «Lo que contestó:»)          → 2 / 1
//   3. el evento sin `lead` en lo que trae (no hay nombre ni link a su ficha)        → 2 / 1
//
// Correr: node --import tsx --test tests/meta-form-evento.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { datosDelEvento } from '../lib/aviso-evento';
import { EVENTOS_MAKO } from '../lib/disparadores';
import { datosFormularioMeta } from '../lib/meta-form-aviso';
import { plantillaPorId, pasosDePlantilla } from '../lib/plantillas-automatizaciones';
import { textoConDatos } from '../lib/variables-del-lead';
import { partesDeMako } from '../lib/mako-tarjeta';
import { variablesPara } from '../lib/variables-aviso';
import { AVISOS_SOLO_SUPERADMIN } from '../lib/avisos-catalogo';
import type { PasoGrafo } from '../lib/flujo-grafo';

const tarjeta = (): string => {
  const p = pasosDePlantilla(plantillaPorId('mako-lead-formulario-meta')!)[0] as unknown as PasoGrafo;
  const parte = partesDeMako((p.accion as { params?: Record<string, unknown> }).params)[0];
  return parte && 'cuerpo' in parte ? String(parte.cuerpo) : '';
};
/** Lo que pone el lead (su nombre y el link a su ficha) más los datos del formulario. */
const conLead = (d: Record<string, string>) => ({ nombre_completo: 'Silvana Ruiz', link_lead: 'https://hola-mako.com/crm/2731/resumen', ...d });

test('con todo: el teléfono, la campaña y lo que contestó, cada uno en su renglón', () => {
  const datos = datosFormularioMeta({ telefono: ' +52 1 55 1234 ', campana: 'Inmobiliario · Octubre', fieldData: [{ name: 'tipo_de_propiedad', values: ['Casa'] }, { name: 'zona', values: ['Norte'] }] });
  assert.equal(textoConDatos(tarjeta(), conLead(datos)),
    '📥 *Silvana Ruiz* completó tu formulario de Meta\n📱 +52 1 55 1234\n📢 Inmobiliario · Octubre\n📝 Lo que contestó:\n• Tipo de propiedad: Casa\n• Zona: Norte\n\nSu ficha 👉 https://hola-mako.com/crm/2731/resumen');
});

test('lo que falta se lleva su renglón, sin frases de relleno', () => {
  const datos = datosFormularioMeta({ telefono: null, campana: null, fieldData: null });
  assert.deepEqual(datos, {});
  assert.equal(textoConDatos(tarjeta(), conLead(datos)), '📥 *Silvana Ruiz* completó tu formulario de Meta\n\nSu ficha 👉 https://hola-mako.com/crm/2731/resumen');
});

test('es un evento de la plataforma, del super admin, que trae al lead y su formulario', () => {
  const ev = EVENTOS_MAKO.find((e) => e.subtipo === 'lead_formulario_meta');
  assert.ok(ev && ev.plataforma === true && ev.aviso === 'lead-formulario-meta');
  assert.ok(AVISOS_SOLO_SUPERADMIN.includes('lead-formulario-meta'));
  const ofrece = variablesPara(datosDelEvento('lead_formulario_meta')).map((v) => v.key);
  for (const k of ['nombre_completo', 'link_lead', 'meta_telefono', 'meta_respuestas']) assert.ok(ofrece.includes(k), `falta {{${k}}}`);
});
