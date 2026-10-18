// =============================================================================
// «Nada por detrás», lote 3: «Alguien dejó sus datos en tu landing» es una automatización de SuperAdmin (17/10/2026)
// =============================================================================
// docs/inventario-nada-por-detras.md, lote 3: `lead-de-landing` lo armaba la ruta del formulario (app/api/track/optin) con su
// texto en el código, en dos versiones: el lead que entró solo al CRM y el que quedó a REVISAR porque se parece a uno que ya
// está. Ahora es el evento de la plataforma `lead_de_landing`: la ruta pasa sólo los hechos (`datosOptin`) y la fila tiene
// los dos textos, que elige una CONDITION (`optin_revisar`). Todo viaja como datos: a revisar, todavía no hay lead.
//
// PROBADO ROMPIÉNDOLO (17/10/2026, arnés `romper.py` + `roturas-optin.json`; base 4 / 0). Pasan / fallan:
//   1. sin teléfono, el renglón 📱 vacío en vez de faltar                             → 3 / 1
//   2. «en N funnels» también con uno solo                                          → 3 / 1
//   3. la CONDITION de «a revisar» mira el valor al revés                             → 2 / 2
//   4. la ruta vuelve a pasar el texto escrito ahí                                    → 3 / 1
//   5. el duplicado sin quién es                                                      → 3 / 1
//
// Correr: node --import tsx --test tests/optin-evento.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { datosDelEvento, pasosDelEvento } from '../lib/aviso-evento';
import { EVENTOS_MAKO } from '../lib/disparadores';
import { datosOptin } from '../lib/optin-aviso';
import { plantillaPorId, pasosDePlantilla } from '../lib/plantillas-automatizaciones';
import { textoConDatos } from '../lib/variables-del-lead';
import { variablesPara } from '../lib/variables-aviso';
import { AVISOS_SOLO_SUPERADMIN } from '../lib/avisos-catalogo';
import { decidir } from '../lib/flujo-pasos';
import { hechosDelEvento } from '../lib/dato-evento';
import { normalizar } from '../lib/flujo-grafo';
import type { Coincidencia } from '../lib/leads-duplicados';

const leer = (rel: string): string => readFileSync(join(import.meta.dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

/** Corre la plantilla con esos datos, paso por paso como el runner: el texto que sale. */
function loQueSale(datos: Record<string, string>): string | null {
  const t = pasosDelEvento(normalizar(pasosDePlantilla(plantillaPorId('mako-lead-de-landing')!)), 'lead_de_landing');
  assert.equal(t.problema, null, `la plantilla no corre: ${t.problema}`);
  const hechos = hechosDelEvento(datos, Date.now());
  const ahora = new Date();
  let paso = 0;
  for (let vuelta = 0; vuelta < 20; vuelta++) {
    const d = decidir(t.pasos, { paso, desde: ahora, respondioAt: null, ahora, hechos });
    if (d.que === 'terminar') return null;
    if (d.que === 'ejecutar') {
      const p = d.paso as { texto?: string; partes?: Array<{ cuerpo?: string }> };
      return textoConDatos(String(p.partes?.[0]?.cuerpo ?? p.texto ?? ''), datos);
    }
    if (d.que !== 'saltar') throw new Error('la fila esperó: no tiene DELAY');
    paso = d.siguiente;
  }
  throw new Error('la fila dio más vueltas que pasos');
}

const ANA = { lead: { nombre: 'Ana Ruiz' }, motivo: 'telefono', texto: 'mismo teléfono (+52 1 55 1234)' } as unknown as Coincidencia;

test('entró solo: quién, su contacto, lo que completó, la campaña y los funnels, cada uno en su renglón', () => {
  const sale = loQueSale(datosOptin({
    nombre: 'Marina Olvera', telefono: '998 136 1529', email: null, respuestas: [['¿Qué buscas?', 'Vender mi casa'], ['Zona', 'Norte']],
    campana: 'oct-leads · video-3', funnels: 2, link: 'https://hola-mako.com/crm/2498', revisar: false,
  }))!;
  assert.equal(sale, '*Marina Olvera* dejó sus datos en tu landing\n📱 998 136 1529\n📝 Lo que completó:\n• ¿Qué buscas?: Vender mi casa\n• Zona: Norte\n📢 oct-leads · video-3\n🗂️ Entró a 2 funnels\n👉 https://hola-mako.com/crm/2498');
  // Sin nombre, quién es su email; sin respuestas, ni campaña, ni otros funnels, esos renglones no van.
  const minimo = loQueSale(datosOptin({ nombre: null, telefono: null, email: 'a@b.com', respuestas: [], campana: null, funnels: 1, link: 'https://x/crm/1', revisar: false }))!;
  assert.equal(minimo, '*a@b.com* dejó sus datos en tu landing\n✉️ a@b.com\n👉 https://x/crm/1');
});

test('a revisar: a quién se parece y por qué, y el link a la revisión', () => {
  const sale = loQueSale(datosOptin({
    nombre: 'Marina', telefono: '+52 1 55 1234', email: 'm@x.com', respuestas: [['Zona', 'Norte']], campana: 'oct', funnels: 1,
    link: 'https://hola-mako.com/crm/revisar/abc', revisar: true, duplicados: [ANA, ANA],
  }))!;
  assert.match(sale, /^🟡 \*Marina\* dejó sus datos en tu landing\n📱 \+52 1 55 1234\n✉️ m@x\.com\n👥 Ya tienes a «Ana Ruiz» \(y 1 más\) con el mismo teléfono \(\+52 1 55 1234\)\n/);
  assert.match(sale, /Necesito que lo mires: fundir dos contactos no se puede deshacer, por eso NO lo cargué solo\.\nDecides tú aquí 👉 https:\/\/hola-mako\.com\/crm\/revisar\/abc\n\n— MaKo$/);
  assert.doesNotMatch(sale, /Lo que completó/, 'el de revisar no lleva el formulario');
});

test('es un evento de la plataforma, del super admin, y ofrece sus datos', () => {
  const ev = EVENTOS_MAKO.find((e) => e.subtipo === 'lead_de_landing');
  assert.ok(ev && ev.plataforma === true && ev.aviso === 'lead-de-landing');
  assert.ok(AVISOS_SOLO_SUPERADMIN.includes('lead-de-landing'));
  const ofrece = variablesPara(datosDelEvento('lead_de_landing')).map((v) => v.key);
  for (const k of ['optin_quien', 'optin_revisar', 'optin_ya_tienes', 'optin_link']) assert.ok(ofrece.includes(k), `falta {{${k}}}`);
});

test('la ruta pasa sólo los hechos, por los dos caminos', () => {
  const src = leer('app/api/track/optin/route.ts');
  assert.doesNotMatch(src, /texto:\s*\[|texto: `\*\$\{quien\}/, 'volvió un texto armado en la ruta');
  assert.match(src, /funnels: tambien\.length \+ 1, link: linkApp\(`\/crm\/\$\{lead\.id\}`, wsEnContexto\(\)\), revisar: false,/);
  assert.match(src, /link: linkApp\(`\/crm\/revisar\/\$\{id\}`, wsEnContexto\(\)\), revisar: true, duplicados: dup,/);
  assert.ok(leer('scripts/mudanza-avisos-plataforma.mts').includes("{ plantilla: 'mako-lead-de-landing', evento: 'lead_de_landing' }"));
});
