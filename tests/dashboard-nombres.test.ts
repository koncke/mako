// =============================================================================
// dashboard-nombres — una fila del Dashboard se lee con el NOMBRE que la app ya usa, no con la clave de la base (11/11/2026)
// =============================================================================
// Producción a 1440, ws 3: Comercial decía «calendly» y «carga_manual»; Contenido e IA, «chatbot-crear-ia» y «offer».
// Lo que fija:
//   · el origen del lead se nombra como el CRM («Calendly», «Cargado a mano») y la función de la IA como el catálogo;
//   · la CLAVE no cambia (un filtro guardado sigue filtrando) y lo que no tiene nombre queda como está;
//   · «(sin dato)» y «Otros» no se tocan, y una fuente sin nombres devuelve el mismo objeto.
// Si falla: lib/graficos-nombres.ts.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nombrarFilas, nombreDeClave } from '../lib/graficos-nombres';
import { OTROS, SIN_DATO, type Resultado } from '../lib/graficos-agregar';
import { ORIGEN_LEAD } from '../app/crm/origen-lead';
import { CATALOGO_MODELOS } from '../lib/model-catalogo';

const res = (claves: string[]): Resultado => ({
  columnas: [{ id: 'agendas', nombre: 'Agendas', formato: 'entero' }] as never, totales: [claves.length], fuera: 0, clase: 'categoria',
  filas: claves.map((k, i) => ({ clave: k, etiqueta: k, valores: [i + 1] })),
});

test('el origen del lead se nombra como el CRM; la clave no cambia', () => {
  const r = nombrarFilas(res(['calendly', 'carga_manual', 'instant_form', 'facebook', SIN_DATO]), 'leads', 'origen');
  assert.deepEqual(r.filas.map((f) => f.etiqueta), ['Calendly', 'Cargado a mano', 'Meta · Instant Form', 'facebook', SIN_DATO],
    'un utm_source suelto («facebook») y «(sin dato)» quedan como están');
  assert.deepEqual(r.filas.map((f) => f.clave), ['calendly', 'carga_manual', 'instant_form', 'facebook', SIN_DATO]);
  assert.equal(nombreDeClave('leads', 'origen', 'carga_manual'), ORIGEN_LEAD.carga_manual.lista);
});

test('la función de la IA se nombra con el label del catálogo de modelos', () => {
  const r = nombrarFilas(res(['chatbot-crear-ia', 'dashboard-hoja-ia', 'El Archivero', OTROS]), 'ia', 'funcion');
  const label = (k: string) => CATALOGO_MODELOS.find((f) => f.feature === k)!.label;
  assert.deepEqual(r.filas.map((f) => f.etiqueta), [label('chatbot-crear-ia'), label('dashboard-hoja-ia'), 'El Archivero', OTROS]);
  assert.equal(r.filas[0].clave, 'chatbot-crear-ia');
});

test('sin nombres para esa fuente o dimensión, el resultado es el mismo objeto', () => {
  const r = res(['calendly']);
  assert.equal(nombrarFilas(r, 'leads', 'closer'), r);
  assert.equal(nombrarFilas(r, 'ia', 'modelo'), r, 'el modelo ya es su nombre («claude-haiku-4-5»)');
  assert.equal(nombrarFilas(r, 'leads', null), r);
});
