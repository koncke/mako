// =============================================================================
// Ticket #94 (13/11/2026): el Agency Dashboard vuelve al teléfono, SIN plata
// =============================================================================
// Joan Dowd (Código Inmobiliario) entró a MaKo en el teléfono y no encontró a sus clientes: sólo con «versión computadora».
// Martín, al reenviarlo: «Soluciona esto». El 4/11 la tab se había apagado en TODOS los teléfonos (lib/tienda.ts →
// `TABS_QUE_VENDEN`) porque decía lo que se le debe a MaKo: «Falta pagar», «Esperando su pago», «Renovación pendiente»,
// «Quién paga» y el número de «Pendientes». Vuelve sin eso: ver y entrar a cada cliente; More la muestra sólo a una agencia.
// La captura a 375 (el banco con la pantalla real y datos inventados) mostró además que en la media altura de la hoja la lista
// tapaba «Entrar a su cuenta»: la hoja abre entera.
// Correr: node --import tsx --test tests/agency-telefono-94.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TABS_QUE_VENDEN, esTabQueVende, sinFilas, sinLoQueVende } from '../lib/tienda';
import { masCompleto, type GrupoMasCompleto } from '../lib/movil-rutas';

const leer = (rel: string): string => readFileSync(join(import.meta.dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');
const keysDe = (grupos: GrupoMasCompleto[]) => grupos.flatMap((g) => g.filas.flatMap((f) => (f.tipo === 'grupo' ? [f.key, ...f.filas.map((x) => x.key)] : [f.key])));

test('1. Agency sale de lo que vende (Partners se queda) y More la trae para el admin', () => {
  assert.deepEqual([...TABS_QUE_VENDEN], ['partners']);
  assert.equal(esTabQueVende('agency'), false);
  // Para el admin de un negocio con capa de agencia, More (la parte pura) trae la fila; Partners, nunca.
  const keys = keysDe(masCompleto('admin', 'agencia', false));
  assert.ok(keys.includes('agency'), 'More sin Agency Dashboard');
  assert.ok(!keys.includes('partners'), 'volvió MaKo Partners al teléfono');
});

test('2. More la muestra SÓLO a una agencia (`esAgencia`); a cualquier otro negocio, no', () => {
  const fila = (key: string) => ({ tipo: 'pantalla' as const, key, label: key, icon: 'x', href: `/m/${key}`, seccion: null });
  const grupos: GrupoMasCompleto[] = [
    { id: 'menu', titulo: null, filas: [fila('agency'), fila('crm')] },
    { id: 'x', titulo: 'X', filas: [{ tipo: 'grupo', key: 'g', label: 'G', icon: 'x', filas: [fila('agency')] }] },
  ];
  assert.deepEqual(keysDe(sinFilas(grupos, (k) => k === 'agency')), ['crm'], 'también adentro de un desplegable, y el vacío se va');
  assert.deepEqual(keysDe(sinLoQueVende(grupos)), keysDe(grupos), 'sinLoQueVende ya no la saca');
  const mas = sinComentarios(leer('app/m/mas/page.tsx'));
  assert.match(mas, /const conAgency = ctx\.ws != null && \(await esAgencia\(ctx\.ws\)\);/);
  assert.match(mas, /const paraEste = conAgency \? completo : sinFilas\(completo, \(k\) => k === 'agency'\);/);
  assert.match(mas, /const grupos = appIos \? masParaAppIos\(paraEste, RUTA_PRONTO\) : paraEste;/);
});

test('3. la página ya no vuelve a More, y la puerta es la de la computadora', () => {
  const pagina = sinComentarios(leer('app/m/agency/page.tsx'));
  assert.doesNotMatch(pagina, /esTabQueVende/);
  assert.match(pagina, /if \(!admin && !esSuper\) redirect\(/, 'sólo el admin (o el super admin)');
  assert.match(pagina, /if \(!esSuper && deAgencia !== false\) redirect\(/, 'el cliente de una agencia no la ve');
});

test('4. el teléfono no dice lo que se le debe a MaKo: ni «Falta pagar» ni «Quién paga» ni «Pendientes»', () => {
  const app = sinComentarios(leer('app/m/agency/AgencyM.tsx'));
  for (const plata of [/Falta pagar/, /Esperando su pago/, /Renovación pendiente/, /Quién paga/, /ROTULO_QUIEN_PAGA/, /Pendientes/, /cobro\?\.pagar/, /renovacion/]) {
    assert.doesNotMatch(app, plata, `vuelve a decir ${plata}`);
  }
  // Una cuenta que espera un pago (o la aprobación) dice «Por habilitar»; las demás, como en la computadora.
  assert.match(app, /return \{ texto: 'Por habilitar', tono: 'neutro' \};/);
  assert.match(app, /if \(c\.estado === 'aprobado'\) return \{ texto: 'Activa', tono: 'good' \};/);
  // Los dos números: activas y clientes.
  assert.match(app, /const clientes = cuentas\.filter\(\(x\) => x\.estado !== 'revocado'\)\.length;/);
});

test('5. ver y ENTRAR a cada cliente: la hoja abre entera para que la lista no tape «Entrar a su cuenta»', () => {
  const app = sinComentarios(leer('app/m/agency/AgencyM.tsx'));
  assert.match(app, /<SheetM snap="alto" abierto=\{abierta && c != null\}/);
  assert.match(app, />Entrar a su cuenta<\/Button>/);
  assert.match(app, /fetch\('\/api\/agencia\/entrar'/);
  // «Dar de baja» se queda (no es una compra) y con su estilo del teléfono, no el botón crudo del navegador.
  assert.match(app, /<DarDeBaja className="m-agency-baja"/);
  assert.match(leer('app/m/agency/agency.css'), /\[data-m\] \.m-agency-baja \{[^}]*color: var\(--bad\)/);
});

test('6. la regla escrita donde todos la leen (AGENTS.md)', () => {
  const agents = leer('AGENTS.md');
  assert.match(agents, /\*\*El Agency Dashboard SÍ va en el teléfono, sin plata\*\* \(13\/11\/2026, ticket #94/);
  assert.match(agents, /\*\*Lo que existe para vender MaKo a otros \(MaKo Partners\) no va en NINGÚN teléfono\*\*/);
});
