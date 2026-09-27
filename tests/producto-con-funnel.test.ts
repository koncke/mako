// =============================================================================
// Crear un producto desde el CRM: la cadena entera, o no aparece
// =============================================================================
// `v_funnel_productos` no es una tabla: es
//
//     select … from funnel_ofertas fo
//     join oferta_productos op on op.oferta_id = fo.oferta_id
//     … bool_or(fo.es_principal and op.rol = 'principal') as es_principal
//
// y `listarFunnels()` la lee con `.eq('es_principal', true)`. O sea que un producto
// aparece en el desplegable del CRM sólo si están las TRES filas Y los DOS flags.
// Si falta cualquiera de los cinco, el alta no tira ningún error: crea el producto,
// crea el funnel, y el desplegable sigue mostrando lo de antes. Es el modo de falla
// más caro de este repo — «la request contesta 200 y no se guarda nada».
//
// Por eso el test mira el FUENTE: no hay forma de probar la cadena sin escribir en
// la base de producción, y lo que se quiere fijar es la forma, no el viaje.
//
// Probado rompiéndolo (5 pases y 0 fallos con el código como está):
//   · se saca `upsertProducto`                      → 3 / 2
//   · se saca `ligarProducto`                       → 2 / 3
//   · `ligarProducto` pierde el rol 'principal'     → 4 / 1
//   · `ligarOfertaAFunnel` pierde el `true`         → 4 / 1

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const crudo = readFileSync(join(import.meta.dirname, '../lib/producto-con-funnel.ts'), 'utf8');
/** Sin comentarios: acá la prosa CITA las llamadas, así que buscarlas en el texto
 *  crudo encontraría la explicación en vez del código. Los de línea primero. */
const fuente = crudo.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('la cadena producto → oferta → funnel está completa', () => {
  for (const paso of ['upsertProducto(', 'upsertOferta(', 'ligarProducto(', 'crearFunnel(', 'ligarOfertaAFunnel(']) {
    assert.ok(fuente.includes(paso), `falta ${paso}: sin ese eslabón el producto no llega al desplegable`);
  }
});

test('los DOS flags de `es_principal` se ponen: son los que la vista mira', () => {
  // ⚠️ La vista hace `bool_or(fo.es_principal AND op.rol = 'principal')`. Con uno
  // solo de los dos, el producto existe, el funnel existe, y el desplegable no lo
  // muestra — sin un error en ningún lado.
  assert.ok(/ligarProducto\(ofertaId, productoId, 'principal'\)/.test(fuente), "op.rol tiene que ser 'principal'");
  assert.ok(/ligarOfertaAFunnel\(funnelId, ofertaId, true\)/.test(fuente), 'fo.es_principal tiene que ser true');
});

test('el orden es el de la cadena: no se puede ligar lo que todavía no existe', () => {
  const pos = (s: string) => {
    const i = fuente.indexOf(s);
    assert.ok(i >= 0, `falta ${s}`);
    return i;
  };
  assert.ok(pos('upsertProducto(') < pos('ligarProducto('), 'el producto va antes de ligarlo');
  assert.ok(pos('upsertOferta(') < pos('ligarProducto('), 'la oferta también');
  assert.ok(pos('crearFunnel(') < pos('ligarOfertaAFunnel('), 'el funnel va antes de ligarle la oferta');
  assert.ok(pos('upsertOferta(') < pos('crearFunnel('), 'y la oferta antes del funnel, que es quien la cuelga');
});

test('el nombre reservado del funnel por defecto no se puede repetir', () => {
  // Dos renglones con el mismo nombre en el desplegable no se pueden distinguir, y
  // el de la migración 0170 lo tienen TODOS los workspaces.
  assert.ok(/FUNNEL_DEFAULT_NOMBRE/.test(fuente), 'se compara contra el nombre reservado');
  assert.ok(/nombre\.toLowerCase\(\) === FUNNEL_DEFAULT_NOMBRE\.toLowerCase\(\)/.test(fuente), 'y sin importar mayúsculas');
});

test('el alta entra por el CRM y NO manda a otra pantalla', () => {
  const tb = readFileSync(join(import.meta.dirname, '../app/crm/CrmToolbar.tsx'), 'utf8')
    .replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/second-brain/.test(tb), 'el selector ya no manda al cerebro a crear el producto');
  assert.ok(/<NuevoProductoModal/.test(tb), 'se resuelve en un modal del propio CRM');
  assert.ok(/crearProductoAction/.test(tb), 'contra la acción que arma la cadena');
});
