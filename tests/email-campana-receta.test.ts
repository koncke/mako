// =============================================================================
// La receta de la campaña de email (4/11/2026, punto 8 de la campaña de email de Mauricio)
// =============================================================================
// Mauricio arma la campaña desde su Claude: la guía «Una campaña de email con Claude» de /api-mako (el mensaje que se le
// pega a Claude) y la sección 5 de la skill del cliente (lib/agente-skill.ts → plugin/skills/mako/SKILL.md). Las dos son
// instrucciones: una ruta vieja o una operación que no sale por HTTP es un 404 en la campaña de un cliente, que no sabe
// leerlo. Acá se cruzan contra la tabla REST real (RUTAS_REST) y el registro real (porId), y la skill se GENERA.
//
// Probado ROMPIÉNDOLO (4/11/2026), sobre una base de 4 / 0: una ruta de la guía cambiada (/email/dominio → /email/dominios)
// → 3 / 1; una operación de la skill que no existe (fijar_remitente → fijar_remitente_mail) → 3 / 1; una que no sale por
// HTTP en la skill (las columnas por `agregar_lead_a_producto`) → 3 / 1. Restaurado, 4 / 0.
//
// Correr: node --import tsx --test tests/email-campana-receta.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RUTAS_REST } from '../lib/api-mako/rest';
import { porId } from '../lib/api-mako/registro';
import { agenteSkillMarkdown } from '../lib/agente-skill';
import { ARTICULOS, GRUPOS_ARTICULOS } from '../app/api-mako/articulos-meta';

const RAIZ = join(import.meta.dirname, '..');
const guia = (): string => {
  const src = readFileSync(join(RAIZ, 'app', 'api-mako', 'Articulos.tsx'), 'utf8').replace(/\r\n/g, '\n');
  const ini = src.indexOf('function CampanaEmail(');
  assert.ok(ini > 0, 'no encontré la guía');
  return src.slice(ini);
};

test('la guía está en la barra de la documentación', () => {
  assert.ok('campana-email' in ARTICULOS);
  assert.ok(GRUPOS_ARTICULOS.some((g) => (g.articulos as readonly string[]).includes('campana-email')));
});

test('la guía nombra rutas REST que existen, con su método', () => {
  const rutas = [...guia().matchAll(/(GET|POST|PUT|PATCH|DELETE) \/api\/v1(\/[a-zA-Z0-9/{}_-]+)/g)];
  assert.ok(rutas.length >= 12, `sólo ${rutas.length} rutas en la guía: el barrido quedó ciego`);
  for (const [, metodo, ruta] of rutas) {
    assert.ok(RUTAS_REST.some(([m, r]) => m === metodo && r === ruta), `la guía nombra ${metodo} ${ruta}, que no existe`);
  }
});

test('la skill (generada) nombra operaciones que existen y salen por HTTP', () => {
  const skill = agenteSkillMarkdown('https://hola-mako.com', null);
  const ini = skill.indexOf('## 5. Una campaña de email');
  assert.ok(ini > 0, 'la skill no tiene la receta');
  const seccion = skill.slice(ini, skill.indexOf('\n## ', ini + 5));
  const ids = [...new Set([...seccion.matchAll(/`([a-z]+(?:_[a-z]+)+)`/g)].map((m) => m[1]))];
  assert.ok(ids.length >= 10, `sólo ${ids.length} operaciones: el barrido quedó ciego`);
  for (const id of ids) {
    const d = porId(id);
    assert.ok(d, `la skill nombra «${id}», que no existe`);
    assert.ok((d!.canales as readonly string[]).includes('http'), `«${id}» no sale por HTTP: el Claude del cliente no la ve`);
  }
});

test('el plugin público está generado con la receta', () => {
  const plugin = readFileSync(join(RAIZ, 'plugin', 'skills', 'mako', 'SKILL.md'), 'utf8');
  assert.match(plugin, /## 5\. Una campaña de email a los leads/);
});
