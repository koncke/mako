// =============================================================================
// El Copywriter, tanda 4: «Compartir para editar» — un guion se edita con un link, sin cuenta (D9)
// =============================================================================
// «Tu cliente entra y edita lo que le presentás» (Martín a Teo, 28/10/2026). Fija:
//   · qué link EDITA un guion (`guionDelShare`): el del Copywriter, de alcance `item`, con permiso `editar`, y el id del
//     guion sale de la FILA; nada más alcanza (un link de ver, de otro recurso, de otra familia);
//   · la tercera puerta de /api/compartir sólo administra links de guiones de SU workspace, y la del super admin no
//     los toca; un link de guion es SIEMPRE item + editar, de un guion vivo;
//   · lo que viaja con el link: el guion sin su lugar en el árbol y, de la biblioteca, sólo lo de ese guion;
//   · la ruta que guarda: pública por nombre EXACTO, el id del link y no del pedido, en el workspace del link, sin
//     propiedades ni sesión, y sin devolver el árbol del negocio;
//   · la página y el editor: la MISMA puerta, la pestaña no nombra el guion, el editor guarda por el link y sin MaKo;
//   · la marca de quién editó («Última edición»).
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { administraShare, type Share } from '../lib/shares';
import { GUION_SIN_NOMBRE, RECURSO_GUION, nombreDeShare } from '../lib/share-nombre';
import { guionDelShare, loQueViajaConElLink } from '../lib/copywriter/compartir-reglas';
import { ALGUIEN, TOPE_NOMBRE_VISITA, autorDeVisita, nombreDeVisita, quienYCuando, sanearEditado } from '../lib/copywriter/editado';
import { esPublicaDeEscritura, esPublicaSoloLectura } from '../lib/rutas-publicas';
import { catalogoCopy } from '../app/copywriter/editor/bloques';
import { docVacio } from '../lib/copywriter/doc';
import { propsNuevas, type GuionAbierto } from '../lib/copywriter/tipos';
import type { CatalogosCopy } from '../lib/copywriter/catalogos';

const raiz = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8').replace(/\r\n/g, '\n');

const share = (o: Partial<Share> = {}): Share => ({
  id: 1, workspace_id: 7, recurso: 'copywriter', alcance: 'item', recurso_id: 'gabc12345', modo: 'link',
  permiso: 'editar', etiqueta: 'Agenda llena', expira_at: null, revocado_at: null, ...o,
});

test('un link edita UN guion: el de la fila, y sólo si declara editar', () => {
  assert.equal(RECURSO_GUION, 'copywriter');
  assert.equal(guionDelShare(share()), 'gabc12345');
  assert.equal(guionDelShare(share({ permiso: 'ver' })), null, 'un link de ver no escribe');
  assert.equal(guionDelShare(share({ permiso: null })), null, 'una fila sin permiso no escribe');
  assert.equal(guionDelShare(share({ alcance: 'todo' })), null, 'un link que escribe apunta a UNA cosa');
  assert.equal(guionDelShare(share({ recurso: 'curso' })), null);
  assert.equal(guionDelShare(share({ recurso: 'dashboard' })), null);
  assert.equal(guionDelShare(share({ recurso_id: '../mako.copywriter.indice' })), null, 'el id es una página del Copywriter');
  assert.equal(guionDelShare(share({ recurso_id: null })), null);
  assert.equal(guionDelShare(share({ workspace_id: 0 })), null);
});

test('la puerta del guion administra sólo links de guiones de SU workspace; la del super admin, no', () => {
  const adm = { tipo: 'guion', ws: 7 } as const;
  assert.equal(administraShare(adm, { workspace_id: 7, recurso: 'copywriter', recurso_id: 'gabc12345' }), true);
  assert.equal(administraShare(adm, { workspace_id: 8, recurso: 'copywriter', recurso_id: 'gabc12345' }), false, 'otro negocio');
  assert.equal(administraShare(adm, { workspace_id: 7, recurso: 'curso', recurso_id: 'gabc12345' }), false);
  assert.equal(administraShare(adm, { workspace_id: 7, recurso: 'dashboard', recurso_id: 'gabc12345' }), false);
  assert.equal(administraShare(adm, { workspace_id: 7, recurso: 'copywriter', recurso_id: null }), false);
  assert.equal(administraShare({ tipo: 'plataforma', ws: 7 }, { workspace_id: 7, recurso: 'copywriter', recurso_id: 'gabc12345' }), false);
});

test('/api/compartir: el link de un guion es SIEMPRE item + editar, de un guion vivo, y entra por su puerta', () => {
  const r = leer('app/api/compartir/route.ts');
  assert.match(r, /recurso: RECURSO_GUION, alcance: 'item', recursoId: id, modo, permiso: 'editar'/);
  assert.match(r, /if \(!vivo\.ok \|\| vivo\.pagina\.papelera\) return NO_ENCONTRADO\(\);/, 'no se acuña un link a algo borrado');
  assert.match(r, /guion: copy && wsValido \? \{ tipo: 'guion', ws: ws as number \} : null/);
  assert.match(r, /const nadie = \(a: Admins\) => !a\.plataforma && !a\.informe && !a\.guion;/);
  assert.match(r, /for \(const adm of \[a\.informe, a\.guion, a\.plataforma\]\)/, 'copiar, rotar y revocar también');
});

test('el nombre de un link de guion es su título de hoy, nunca el id', () => {
  const s = { recurso: RECURSO_GUION, recurso_id: 'gabc12345', etiqueta: 'El de ayer' };
  assert.equal(nombreDeShare(s, () => undefined, 'El de hoy'), 'El de hoy');
  assert.equal(nombreDeShare(s, () => undefined, null), 'El de ayer');
  assert.equal(nombreDeShare({ ...s, etiqueta: null }, () => undefined), GUION_SIN_NOMBRE);
});

test('lo que viaja con el link: sin su lugar en el árbol y, de la biblioteca, sólo lo de ese guion', () => {
  const g: GuionAbierto = {
    pagina: { id: 'gabc12345', titulo: 'T', emoji: null, tipo: 'ad', padre: 'gpadre123', orden: 4, actualizado: '2026-10-28T12:00:00.000Z' },
    doc: { version: 2, props: { ...propsNuevas('ad'), angulo: 'dolor', estructura: 'pas' }, contenido: docVacio() },
  };
  const c: CatalogosCopy = {
    angulos: [{ id: 'dolor', nombre: 'Dolor', emoji: '😩', cuando: '' }, { id: 'otro', nombre: 'Otro', emoji: '', cuando: '' }],
    estructuras: [{ id: 'pas', nombre: 'PAS', emoji: '', cuando: '', etiquetas: ['GANCHO'], tipos: ['ad'] }, { id: 'aida', nombre: 'AIDA', emoji: '', cuando: '', etiquetas: [], tipos: ['ad'] }],
  };
  const v = loQueViajaConElLink(g, c);
  assert.equal(v.guion.pagina.padre, null);
  assert.deepEqual(v.catalogos.angulos.map((a) => a.id), ['dolor']);
  assert.deepEqual(v.catalogos.estructuras.map((e) => e.id), ['pas']);
  const sin = loQueViajaConElLink({ ...g, doc: { ...g.doc, props: { ...g.doc.props, angulo: null, estructura: null } } }, c);
  assert.deepEqual(sin.catalogos, { angulos: [], estructuras: [] });
});

test('la ruta que guarda es pública por nombre EXACTO', () => {
  assert.equal(esPublicaDeEscritura('/api/compartido/guion'), true);
  assert.equal(esPublicaDeEscritura('/api/compartido/guion/borrar'), false, 'nada colgado abajo hereda el POST');
  assert.equal(esPublicaSoloLectura('/api/compartido/guion/borrar'), true);
});

test('la ruta: el id del LINK, en su workspace, sin propiedades ni sesión, y sin devolver el árbol', () => {
  const r = leer('app/api/compartido/guion/route.ts');
  assert.match(r, /const a = accesoDeGuion\(acceso\);/);
  assert.match(r, /return await enSuWorkspace\(a, async \(\) => \{/);
  assert.match(r, /if \(!vivo\.ok \|\| vivo\.pagina\.papelera\) return NO\(\);/, 'un guion en la Papelera no se edita');
  assert.match(r, /guardar\(\{ id: a\.id, version: b\.version as number, contenido: b\.contenido \}, autor\)/);
  assert.ok(!/b\.id\b|b\.props|getUsuarioActual|getSesion|cookies\(/.test(r), 'ni id ni propiedades del pedido, ni la sesión');
  assert.match(r, /return r\.ok \? json\(\{ ok: true \}\) : falla\(r\.status, r\.error\);/, 'renombrar no le devuelve el árbol del negocio');
  assert.match(r, /new URL\(origen\)\.host === req\.headers\.get\('host'\)/);
});

test('la página pública usa la MISMA puerta, no nombra el guion y carga el editor aparte', () => {
  const p = leer('app/compartido/[token]/page.tsx');
  assert.match(p, /const a = accesoDeGuion\(acceso\);/);
  assert.match(p, /if \(acceso\?\.share\.recurso === RECURSO_GUION\) return \{ \.\.\.GENERICA, title: 'Guion compartido' \};/);
  assert.match(p, /import GuionCompartido from '\.\/GuionCompartidoPerezoso';/);
  assert.match(leer('app/compartido/[token]/GuionCompartidoPerezoso.tsx'), /dynamic\(\(\) => import\('\.\/GuionCompartido'\)\)/);
  const g = leer('app/compartido/[token]/GuionCompartido.tsx');
  assert.match(g, /compartido=\{\{ guardar \}\}/);
  assert.ok(!/pedirGuardar\(|'\/api\/copywriter'/.test(g), 'nunca guarda por la ruta de la tab (la sesión de quien abre)');
});

test('el editor con link guarda por el link y no ofrece MaKo', () => {
  assert.ok(!catalogoCopy([], { conMako: false }).some((b) => b.id === 'mako'));
  assert.ok(catalogoCopy([]).some((b) => b.id === 'mako'), 'en la tab, sí');
  const e = leer('app/copywriter/editor/EditorGuion.tsx');
  assert.match(e, /const r = conLink\n\s+\? await conLink\.guardar\(/);
  // El cuerpo (BlockNote) arma el «/» con el catálogo, sin MaKo cuando es un link (CuerpoNotion: `catalogoCopy(p.etiquetas, { conMako: p.conMako })`).
  assert.match(e, /conMako=\{!compartido\}/);
  assert.match(leer('app/copywriter/editor/CuerpoNotion.tsx'), /catalogoCopy\(p\.etiquetas, \{ conMako: p\.conMako \}\)/);
  assert.match(e, /\{!compartido && \(\n\s+<button type="button" role="menuitem" className="nt-menu-fila" data-peligro=""/, 'sin la Papelera');
});

test('la marca de quién editó: el invitado, el nombre escrito o «alguien con el link»', () => {
  assert.deepEqual(autorDeVisita(null, '  Ana   Pérez '), { por: 'Ana Pérez', afuera: true });
  assert.deepEqual(autorDeVisita(null, ''), { por: ALGUIEN, afuera: true });
  assert.deepEqual(autorDeVisita(null, 42), { por: ALGUIEN, afuera: true });
  assert.deepEqual(autorDeVisita({ nombre: null, email: 'leila@negocio.com' }, 'Otra'), { por: 'leila@negocio.com', afuera: true }, 'la invitación gana');
  assert.deepEqual(autorDeVisita({ nombre: 'Leila', email: 'leila@negocio.com' }, ''), { por: 'Leila', afuera: true });
  assert.equal(nombreDeVisita('x'.repeat(200))?.length, TOPE_NOMBRE_VISITA);
  assert.equal(nombreDeVisita('a\u0000\nb'), 'a b');
  const at = '2026-10-28T20:05:00.000Z';
  assert.equal(sanearEditado({ por: 'Ana', afuera: true, at: 'ayer' }), null);
  assert.equal(sanearEditado({ por: '  ', afuera: true, at }), null);
  assert.deepEqual(sanearEditado({ por: 'Ana', afuera: 'si', at }), { por: 'Ana', afuera: false, at }, 'afuera sólo con true');
  assert.match(quienYCuando({ por: 'Ana', afuera: true, at }), /^Ana con el link · /);
  assert.match(quienYCuando({ por: ALGUIEN, afuera: true, at }), /^Alguien con el link · /);
  assert.ok(!quienYCuando({ por: ALGUIEN, afuera: true, at }).includes('con el link con el link'));
  assert.match(quienYCuando({ por: 'Martín', afuera: false, at }), /^Martín · /);
});

test('guardar deja la marca: desde la tab, quien está en la sesión', () => {
  const s = leer('lib/copywriter/server.ts');
  assert.match(s, /const editado = autor \? \{ \.\.\.autor, at: new Date\(\)\.toISOString\(\) \} : leido\.doc\.editado \?\? null;/);
  assert.match(s, /editado: sanearEditado\(o\.editado\),/);
  const t = leer('app/api/copywriter/route.ts');
  assert.match(t, /\{ por, afuera: false \}\)\);/);
});
