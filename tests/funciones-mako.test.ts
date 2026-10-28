// =============================================================================
// El catálogo de las funciones de MaKo (lib/funciones-mako.ts) no se queda viejo (28/10/2026)
// =============================================================================
// Martín: «que el Second Brain de SuperAdmin tenga conocimiento de todas las funcionalidades». El catálogo es lo que un
// chat lee para saber qué hace cada función; si una tab nueva no suma su entrada, MaKo la niega. Lo que fija:
//   1. cada key VIVA del nav (no «pronto») es de exactamente una función, y ninguna función nombra una key que no existe;
//   2. lo derivado sale del nav: nombre, ruta, familia y quién la ve;
//   3. las conexiones apuntan a otra función, el área de obra existe y las fuentes están en el repo;
//   4. lo que reemplaza cada una es lo que dice AGENTS.md («se nombra por su fuente»), y lo que Chats no hace es lo de
//      docs/diseno-chats.md.
//
// Probado rompiéndolo (28/10/2026): al pie del archivo.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ENTRADAS, funcionDeKey, funcionesMako } from '../lib/funciones-mako';
import { TODOS_LOS_ITEMS } from '../app/_components/nav';
import { AREAS } from '../app/admin/dev/areas';

const RAIZ = join(import.meta.dirname, '..');

test('1. cada key viva del nav es de exactamente una función, y ninguna función nombra una key que no existe', () => {
  const vivas = TODOS_LOS_ITEMS.filter((i) => !i.comingSoon).map((i) => i.key);
  const pronto = new Set(TODOS_LOS_ITEMS.filter((i) => i.comingSoon).map((i) => i.key));
  const todas = new Set(TODOS_LOS_ITEMS.map((i) => i.key));
  for (const k of vivas) {
    const de = ENTRADAS.filter((e) => e.keys.includes(k));
    assert.equal(de.length, 1, `la key «${k}» del nav es de ${de.length} funciones: súmala a lib/funciones-mako.ts (o sácala de la que sobra)`);
  }
  for (const e of ENTRADAS) {
    for (const k of e.keys) {
      assert.ok(todas.has(k), `«${k}» no es una key del nav`);
      assert.ok(!pronto.has(k), `«${k}» está «pronto» en el nav: una función que no existe no va en el catálogo`);
    }
  }
});

test('2. el nombre, la ruta, la familia y quién la ve salen del nav', () => {
  for (const f of funcionesMako()) {
    const item = TODOS_LOS_ITEMS.find((i) => i.key === f.key)!;
    assert.equal(f.nombre, item.label);
    assert.equal(f.ruta, item.href);
    assert.ok(f.familia, `«${f.key}» sin familia`);
  }
  assert.equal(funcionDeKey('whatsapp')?.key, 'chats', 'WhatsApp se configura desde Chats');
  assert.equal(funcionDeKey('landing-writer')?.nombre, 'Web Generator');
  assert.equal(funcionDeKey('chats')?.familia, 'Today');
  assert.equal(funcionDeKey('ai-avatar-voces')?.soloSuperAdmin, true);
  assert.equal(funcionDeKey('crm')?.soloSuperAdmin, false);
});

test('3. las conexiones apuntan a otra función, el área de obra existe, las fuentes están y nada va vacío', () => {
  const slugs = new Set(AREAS.map((a) => a.slug));
  for (const f of funcionesMako()) {
    assert.ok(f.que.trim().length > 40 && f.que.length <= 400, `«${f.key}»: el «que» va en dos o tres frases`);
    assert.ok(f.hace.length >= 1, `«${f.key}» no dice qué hace`);
    assert.ok(f.alias.length >= 1 && f.alias.every((a) => a === a.toLowerCase() && a.trim()), `«${f.key}»: los alias van en minúscula`);
    for (const c of f.conecta ?? []) {
      assert.ok(funcionDeKey(c.a), `«${f.key}» se conecta con «${c.a}», que no es una función`);
      assert.notEqual(funcionDeKey(c.a)?.key, f.key, `«${f.key}» se conecta consigo misma`);
      assert.ok(c.motivo.trim(), 'una conexión sin motivo no se dibuja');
    }
    if (f.slugDev) assert.ok(slugs.has(f.slugDev), `«${f.key}»: el área «${f.slugDev}» no está en app/admin/dev/areas.ts`);
    for (const fu of f.fuentes) assert.ok(existsSync(join(RAIZ, fu)), `«${f.key}»: la fuente ${fu} no está en el repo`);
  }
});

test('4. lo que reemplaza cada una es lo de AGENTS.md, y lo que Chats no hace es lo de su diseño', () => {
  const agents = readFileSync(join(RAIZ, 'AGENTS.md'), 'utf8').replace(/\s+/g, ' ');
  for (const [key, app, frase] of [
    ['video-editor', 'CapCut', 'el Video Editor es CapCut'], ['image-editor', 'Canva', 'el Image Editor es Canva'],
    ['landing-writer', 'Gamma', 'Web Generator es Gamma'], ['graphics', 'Looker Studio', 'el Dashboard es Looker Studio'],
    ['chats', 'respond.io', 'los Chats son respond.io'],
  ] as const) {
    assert.ok(agents.includes(frase), `AGENTS.md ya no dice «${frase}»: revisar el catálogo`);
    assert.equal(funcionDeKey(key)?.reemplaza, app, `«${key}» no dice que reemplaza a ${app}`);
  }
  const chats = funcionDeKey('chats')!;
  const noHace = (chats.noHace ?? []).join(' · ').toLowerCase();
  for (const x of ['llamadas', 'traducir', 'unir contactos', 'todavía no']) assert.ok(noHace.includes(x), `Chats no dice que no hace «${x}»`);
  assert.equal(chats.estado, 'parcial', 'Chats todavía no hace todo lo de respond.io: el estado es honesto');
});

// ── Probado rompiéndolo (28/10/2026) ─────────────────────────────────────────────────────────────────────────────────
// Cada cambio a mano, corrido y restaurado (sha1 igual):
//   1. Chats sin la key `email`                                            → rojo el 1.
//   2. una key «pronto» (`thumbnails`) en una función                       → rojo el 1.
//   3. una conexión a una key que no existe                                 → rojo el 3.
//   4. el Video Editor «reemplaza a Premiere»                              → rojo el 4.
//   5. Chats sin «Llamadas de voz» en lo que no hace                       → rojo el 4.
