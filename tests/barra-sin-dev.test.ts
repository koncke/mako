// =============================================================================
// MaKo Context, AI Models y Dev se fueron, y lo que vivía adentro tiene casa (25/10/2026)
// =============================================================================
// Martín (feedback de la tarde, puntos 13 a 15): «Elimina "https://hola-mako.com/contexto", lo de "Conocimientos" lo puedes
// llevar a esa tab, donde está el curso, y que solo yo como super admin vea esas anotaciones... Lo de "fases" esta deprecado.
// Lo de "Configuración" entiendo que la mayoría de cosas allí las personaliza el propio usuario... Como tambien "prompts".
// Elimina "https://hola-mako.com/modelos-ia"... Elimina "dev", ya no lo necesitamos». Lo que fija este archivo:
//   1. el menú de la foto del super admin ya no los tiene, y sus pantallas no existen;
//   2. los links viejos caen en su lugar nuevo (next.config.ts), no en un 404;
//   3. lo que se editaba SÓLO ahí no se perdió: el Conocimiento en Classroom › Methodology (sólo la plataforma), los prompts
//      en Settings › Prompts (la regla de Método), y las bibliotecas de Ads Writer en Copywriting;
//   4. nada enlaza a una pantalla que se fue: el grafo del Second Brain y lo que MaKo dice que sabe hacer.
//
// PROBADO ROMPIÉNDOLO (base 4/0): MaKo Context de vuelta en el menú → 1 rojo (1); sin el redirect de /contexto → 1 rojo (2);
// Methodology para cualquiera → 1 rojo (3); Prompts sin la regla de Método → 1 rojo (3); el grafo con /admin/dev otra vez →
// 1 rojo (4).

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SUPERADMIN_MENU, FAMILIAS } from '../app/_components/nav';
import { seccionesDe } from '../lib/clients-rutas';
import { seccionesNegocio } from '../lib/ajustes-secciones';
import { CAPACIDADES } from '../lib/mako-capacidades';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

test('1. el menú de la foto ya no tiene MaKo Context, AI Models ni Dev, y sus pantallas no existen', () => {
  // Sólo lo de este pedido: Billing y Client Agents se van con la vista nueva de clientes (/customers, el chat «Agencias y
  // clientes»), y fijarlos acá haría chocar las dos ramas al integrar.
  const etiquetas = SUPERADMIN_MENU.map((i) => i.label);
  for (const fuera of ['MaKo Context', 'AI Models', 'Dev']) assert.ok(!etiquetas.includes(fuera), `${fuera} volvió al menú de la foto`);
  assert.ok(etiquetas.includes('Knowledge'), 'Knowledge se queda en el menú de la foto');
  for (const r of ['app/contexto', 'app/m/contexto', 'app/modelos-ia', 'app/m/modelos-ia', 'app/conocimiento', 'app/admin/dev/page.tsx', 'app/admin/dev/[area]']) {
    assert.ok(!existsSync(join(RAIZ, r)), `${r} volvió`);
  }
  // Las bitácoras se QUEDAN: de ellas cuelgan el cierre de los tickets, el Progreso y el Cerebro.
  assert.ok(existsSync(join(RAIZ, 'app/admin/dev/registros.ts')) && existsSync(join(RAIZ, 'app/admin/dev/crm/bitacora.ts')));
});

test('2. los links viejos caen en su lugar nuevo, antes de dibujar', () => {
  const config = leer('next.config.ts');
  for (const [vieja, nueva] of [
    ['/contexto', '/classroom/methodology'], ['/conocimiento', '/classroom/methodology'], ['/modelos-ia', '/admin/operaciones'],
    ['/admin/dev', '/admin/operaciones'], ['/admin/dev/:path*', '/admin/operaciones'],
  ]) {
    assert.ok(config.includes(`{ source: '${vieja}', destination: '${nueva}', permanent: false }`), `${vieja} no redirige a ${nueva}`);
  }
});

test('3. lo que se editaba SÓLO ahí tiene casa: Methodology, Prompts y las bibliotecas de Ads Writer', () => {
  // El Conocimiento: una sub-tab de Classroom que ve sólo la plataforma, con la puerta de /contexto.
  assert.ok(seccionesDe(true).some((s) => s.id === 'methodology'), 'la plataforma no ve Methodology');
  assert.ok(!seccionesDe(false).some((s) => s.id === 'methodology'), 'un negocio ve Methodology');
  // Una sola grilla: la de la plataforma es Customers (negocios); el kanban de leads es de cada negocio, y para ella sería un
  // link que salta a /customers.
  assert.ok(!seccionesDe(true).some((s) => s.id === 'clients'), 'la plataforma ve «Clients» en Classroom: dos grillas');
  assert.ok(seccionesDe(false).some((s) => s.id === 'clients'), 'un negocio perdió su kanban');
  assert.match(sinComentarios(leer('app/admin/page.tsx')), /redirect\('\/customers'\);/, 'el super admin entra por su grilla');
  const metodologia = sinComentarios(leer('app/classroom/methodology/page.tsx'));
  assert.match(metodologia, /if \(!\(await getSesionAdmin\(\)\)\) notFound\(\);\s*return <ConocimientoView \/>;/);
  // Los prompts: una sección de Settings con la regla de Método, y la misma puerta.
  const conMetodo = seccionesNegocio({ general: true, integraciones: true, metodo: true, plan: true }).map((s) => s.key);
  const sinMetodo = seccionesNegocio({ general: true, integraciones: true, metodo: false, plan: true }).map((s) => s.key);
  assert.ok(conMetodo.includes('prompts'), 'falta Settings › Prompts');
  assert.ok(!sinMetodo.includes('prompts'), 'un negocio ve los prompts de la plataforma');
  const prompts = sinComentarios(leer('app/configuraciones/prompts/page.tsx'));
  assert.match(prompts, /if \(!\(await getSesionAdmin\(\)\)\) redirect\(/);
  assert.match(prompts, /<PromptsMaKo \/>\s*<Configuraciones embedded \/>/, 'la persona y los prompts de cada pantalla, los dos');
  // Las bibliotecas de Ads Writer: una sección de Copywriting, y la página las dibuja (ya no redirige a Dev).
  const copy = FAMILIAS.flatMap((f) => f.bloques.flat()).find((t) => t.key === 'copywriting');
  assert.ok(copy?.secciones?.some((s) => s.href === '/admin/guiones'), 'las bibliotecas no son una sección de Copywriting');
  assert.equal(copy?.match('/admin/guiones'), true, 'en las bibliotecas, la barra no marca Copywriting');
  const guiones = sinComentarios(leer('app/admin/guiones/page.tsx'));
  assert.match(guiones, /return <GuionesAdminView \/>;/);
  assert.doesNotMatch(guiones, /admin\/dev/);
});

test('4. nada enlaza a una pantalla que se fue: el grafo del Second Brain y lo que MaKo dice que sabe hacer', () => {
  assert.doesNotMatch(sinComentarios(leer('lib/cerebro-construccion.ts')), /\/admin\/dev\//, 'el grafo volvió a enlazar la bitácora de Dev');
  const contexto = CAPACIDADES.find((c) => c.id === 'contexto');
  assert.ok(contexto, 'la capacidad «contexto» es contrato de la API (listar_capacidades_mako): no se borra');
  assert.ok(!['/contexto', '/modelos-ia'].includes(contexto.ruta) && !contexto.ruta.startsWith('/admin/dev'), `«contexto» manda a ${contexto.ruta}`);
});
