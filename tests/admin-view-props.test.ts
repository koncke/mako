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
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FUENTE = readFileSync(join(process.cwd(), 'app/admin/AdminView.tsx'), 'utf8');

/** El cuerpo de una función de nivel superior: desde su `function X(`/`export function X(` hasta la siguiente. */
function cuerpoDe(nombre: string, fuente: string): string {
  const re = new RegExp(`^(?:export )?function ${nombre}\(`, 'm');
  const m = re.exec(fuente);
  if (!m) throw new Error(`no encontré la función ${nombre} en AdminView.tsx`);
  const desde = m.index;
  const siguiente = /^(?:export )?function \w+\(/m.exec(fuente.slice(desde + m[0].length));
  return siguiente ? fuente.slice(desde, desde + m[0].length + siguiente.index) : fuente.slice(desde);
}

/** Los nombres desestructurados de la firma: `function X({ a, b = 1, c }: {…})`. */
function propsDe(cuerpo: string): Set<string> {
  const m = /^(?:export )?function \w+\(\{([^}]*)\}/.exec(cuerpo);
  if (!m) return new Set();
  return new Set(
    m[1].split(',').map((x) => x.trim().split('=')[0].trim()).filter(Boolean),
  );
}

describe('AdminView: el alcance de las props entre funciones del mismo archivo', () => {
  it('toda prop de AdminView que usa PanelClientes está en la firma de PanelClientes', () => {
    const propsAdminView = propsDe(cuerpoDe('AdminView', FUENTE));
    const panel = cuerpoDe('PanelClientes', FUENTE);
    const propsPanel = propsDe(panel);
    // El cuerpo sin su propia firma: ahí es donde un nombre suelto es un ReferenceError.
    const adentro = panel.slice(panel.indexOf(') {'));

    const huerfanas = [...propsAdminView].filter(
      (p) => !propsPanel.has(p) && new RegExp(`\b${p}\b`).test(adentro),
    );

    expect(huerfanas, `PanelClientes usa props de AdminView que no recibe: ${huerfanas.join(', ')}. ` +
      'Son funciones distintas del mismo archivo: no comparten alcance. Pasásela desde donde AdminView ' +
      'dibuja <PanelClientes …/> y recibila en su firma.').toEqual([]);
  });

  it('verComputadoras viaja de AdminView a PanelClientes (el caso de 87a4e5244)', () => {
    expect(FUENTE).toMatch(/<PanelClientes[^>]*verComputadoras=\{verComputadoras\}/s);
    expect(propsDe(cuerpoDe('PanelClientes', FUENTE)).has('verComputadoras')).toBe(true);
  });
});
