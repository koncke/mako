// =============================================================================
// El opt-in de una landing: las cuatro guardas que lo hacen seguro de repartir
// =============================================================================
// `/api/track/optin` es una ruta ABIERTA (el snippet corre en la página del
// cliente, sin sesión), así que lo que la hace segura no es el auth: son cuatro
// decisiones que tienen que seguir donde están. Son guards de CABLEADO — el
// cuerpo no se puede ejercitar sin Supabase, pero sí se puede exigir que los
// cables no se muevan.
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const RUTA = () => leer('../app/api/track/optin/route.ts');

test('NO escribe en leads: deja una propuesta', () => {
  const src = RUTA();
  assert.ok(/crearPropuesta\(/.test(src), 'el opt-in tiene que dejar una propuesta');
  assert.ok(
    !/from\(['"]leads['"]\)|insertLead|createLead/.test(src),
    'un endpoint abierto que escribe directo en leads mete basura de un bot adentro del CRM',
  );
});

test('el ruteo del workspace es fail-closed', () => {
  const src = RUTA();
  assert.ok(/wsPorIdentificador\(/.test(src), 'el workspace sale del token, no del body');
  assert.ok(/ws == null/.test(src), 'un token sin mapeo tiene que cortar');
  assert.ok(
    !/OWNER_WS|\?\?\s*1\b/.test(src),
    'sin workspace NO se cae al dueño: sería meterle los leads de otro en su CRM',
  );
});

test('solo ingesta si el negocio declaró la landing como entrada', () => {
  const src = RUTA();
  assert.ok(/getFunnel\(\)/.test(src), 'la puerta se lee de donde el cliente la configura (/funnel), no de una copia');
  assert.ok(/entradas\.includes\('landing'\)/.test(src), 'falta la puerta: sin esto el mismo snippet le llena el CRM a cualquiera');
  // 200 y no 403: la página del cliente no puede mostrarle un error a SU visitante
  // por una config que le falta al dueño de la página.
  const i = src.indexOf("entradas.includes('landing')");
  assert.ok(/return ok\(/.test(src.slice(i, i + 400)), 'un negocio sin la landing declarada recibe 200, no un error');
});

test('es idempotente: dos submits del mismo formulario no son dos leads', () => {
  const src = RUTA();
  assert.ok(/ref:\s*ref|ref,/.test(src), 'falta la ref de idempotencia');
  assert.ok(/`landing:\$\{email \?\? telefono\}`/.test(src), 'sin ref del emisor, la identidad es el contacto');
});

test('sin forma de contacto se rechaza en la puerta, no en la revisión', () => {
  const src = RUTA();
  assert.ok(/!email && !telefono/.test(src), 'un lead sin email ni teléfono no se puede trabajar');
});

test('la ruta es pública de verdad (vive bajo un prefijo de PUBLICOS)', () => {
  // Si no, proxy.ts la corta con 401 ANTES de que su código corra, y en local no
  // se ve porque sin AUTH_SECRET el middleware hace no-op.
  const publicas = leer('../lib/rutas-publicas.ts');
  assert.ok(/'\/api\/track'/.test(publicas), '/api/track tiene que seguir en PUBLICOS');
});
