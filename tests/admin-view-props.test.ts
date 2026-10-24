// =============================================================================
// AdminView: una prop que se USA adentro de PanelClientes tiene que ESTAR en su firma
// =============================================================================
// El 24/10/2026, 87a4e5244 metió `{verComputadoras && <ComputadorasDelNegocio …/>}` dentro de
// `PanelClientes`, pero `verComputadoras` es una prop de `AdminView`, que es otra función de nivel
// superior del mismo archivo. En JavaScript eso no es un error de sintaxis: es un `ReferenceError` que
// sólo salta cuando alguien abre la ficha de un cliente. Y como el build de Vercel no chequea tipos
// (`typescript.ignoreBuildErrors`), llegó a producción y rompió la pantalla de Clientes del super admin.
//
// Lo que cuida este test: que ninguna prop declarada en `AdminView` se use dentro de `PanelClientes` sin
// que `PanelClientes` la reciba. Dos funciones en el mismo archivo se leen como si compartieran alcance,
// y no lo comparten.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FUENTE = readFileSync(join(process.cwd(), 'app/admin/AdminView.tsx'), 'utf8');

/** El cuerpo de una función de nivel superior: desde su `function X(` hasta la siguiente. */
function cuerpoDe(nombre: string, fuente: string): string {
  const re = new RegExp(`^(?:export )?function ${nombre}\\(`, 'm');
  const m = re.exec(fuente);
  if (!m) throw new Error(`no encontré la función ${nombre} en AdminView.tsx`);
  const desde = m.index;
  const resto = fuente.slice(desde + m[0].length);
  const siguiente = /^(?:export )?function \w+\(/m.exec(resto);
  return siguiente ? fuente.slice(desde, desde + m[0].length + siguiente.index) : fuente.slice(desde);
}

/** Los nombres desestructurados de la firma: `function X({ a, b = 1, c }: {…})`. */
function propsDe(cuerpo: string): Set<string> {
  const m = /^(?:export )?function \w+\(\{([^}]*)\}/.exec(cuerpo);
  if (!m) return new Set();
  return new Set(m[1].split(',').map((x) => x.trim().split('=')[0].trim()).filter(Boolean));
}

test('toda prop de AdminView que usa PanelClientes está en la firma de PanelClientes', () => {
  const propsAdminView = propsDe(cuerpoDe('AdminView', FUENTE));
  const panel = cuerpoDe('PanelClientes', FUENTE);
  const propsPanel = propsDe(panel);
  // El cuerpo sin su propia firma: ahí es donde un nombre suelto es un ReferenceError.
  const adentro = panel.slice(panel.indexOf(') {'));

  // Como IDENTIFICADOR suelto, no como clave de objeto (`titulo:`) ni como propiedad de otro (`x.icono`)
  // ni como atributo JSX (`titulo=`): ésos son otros `titulo`, no la prop de AdminView.
  const huerfanas = [...propsAdminView].filter(
    (p) => !propsPanel.has(p) && new RegExp(`(?<![.\\w'"\`])${p}(?![\\w:=])`).test(adentro),
  );

  assert.deepEqual(huerfanas, [],
    `PanelClientes usa props de AdminView que no recibe: ${huerfanas.join(', ')}. Son funciones distintas `
    + 'del mismo archivo: no comparten alcance. Pasásela desde donde AdminView dibuja <PanelClientes …/> '
    + 'y recibila en su firma.');
});

test('verComputadoras viaja de AdminView a PanelClientes (el caso de 87a4e5244)', () => {
  assert.ok(/<PanelClientes[\s\S]*?verComputadoras=\{verComputadoras\}/.test(FUENTE),
    'AdminView no le pasa verComputadoras a PanelClientes');
  assert.ok(propsDe(cuerpoDe('PanelClientes', FUENTE)).has('verComputadoras'),
    'PanelClientes no recibe verComputadoras en su firma');
});
