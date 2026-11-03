// =============================================================================
// El Copywriter, tanda 3: cada tipo con sus estructuras de la biblioteca, y la mudanza de lo viejo
// =============================================================================
// Fija:
//   · la biblioteca es UNA: las estructuras de Reel y Story viven en lib/guion-estructuras.ts con su campo `tipos` (y el
//     saneo lo conserva); las siete de antes, sin el campo, siguen siendo de anuncios;
//   · el Ads Writer NO ve las de reel y story (`getEstructurasGuion` = sólo las de anuncios; el Copywriter y el editor
//     del super admin leen `getEstructurasTodas`); y un override guardado antes de que existieran las recibe igual;
//   · cada tipo arma sus secciones (Reel: Gancho → Historia → Moraleja → CTA); YouTube tiene la suya desde el 29/10/2026
//     (`youtube-retencion`, de claude-youtube) y el selector no queda vacío;
//   · la mudanza: /youtube-writer lleva al Copywriter a quien ya lo ve; /stories lleva SIEMPRE a los templates de Story
//     (29/10, deprecada); el Ads Writer ofrece «Abrir en Copywriter» sólo a quien ya lo ve; `/copywriter?nuevo=<tipo>`
//     abre «Nueva» con ese tipo y NO crea nada por abrir un link.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ESTRUCTURAS_GUION_DEFAULT, normalizarEstructurasGuion, soloDeAnuncios } from '../lib/guion-estructuras';
import { ANGULOS_GUION_DEFAULT } from '../lib/guion-angulos';
import { catalogosLite, estructuraPorDefecto, estructurasDelTipo } from '../lib/copywriter/catalogos';
import { bloquesDelDoc, docDeEstructura } from '../lib/copywriter/doc';

const raiz = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8').replace(/\r\n/g, '\n');

test('las de reel y story están en la biblioteca con su tipo; las siete de antes siguen siendo de anuncios', () => {
  const deReel = ESTRUCTURAS_GUION_DEFAULT.filter((e) => e.tipos?.includes('reel'));
  const deStory = ESTRUCTURAS_GUION_DEFAULT.filter((e) => e.tipos?.includes('story'));
  assert.ok(deReel.length >= 1 && deStory.length >= 1);
  assert.equal(soloDeAnuncios(ESTRUCTURAS_GUION_DEFAULT).length, 7, 'las siete de antes, y ninguna de orgánico');
  assert.ok(!soloDeAnuncios(ESTRUCTURAS_GUION_DEFAULT).some((e) => e.tipos?.includes('reel') || e.tipos?.includes('story')));
  // El saneo conserva el campo (si lo tirara, guardar la biblioteca desde /admin/guiones las volvería de anuncios).
  const n = normalizarEstructurasGuion(JSON.parse(JSON.stringify(ESTRUCTURAS_GUION_DEFAULT)));
  assert.deepEqual(n.find((e) => e.id === 'reel-viral')?.tipos, ['reel']);
  assert.equal(n.find((e) => e.id === 'pas')?.tipos, undefined);
  assert.deepEqual(normalizarEstructurasGuion([{ ...ESTRUCTURAS_GUION_DEFAULT[0], tipos: ['reel', 'nada', 'reel'] }])[0].tipos, ['reel']);
});

test('el Ads Writer lee sólo las de anuncios; el Copywriter y el super admin, todas; un override viejo recibe las nuevas', () => {
  const store = leer('lib/guion-estructuras-store.ts');
  assert.match(store, /return soloDeAnuncios\(await getEstructurasTodas\(\)\);/);
  assert.match(store, /conLasDeOrganicoNuevas\(parsed\)/);
  assert.match(leer('lib/copywriter/catalogos-server.ts'), /getEstructurasTodas\(\)/);
  assert.match(leer('lib/copywriter/ia.ts'), /getEstructurasTodas\(\)/);
  assert.match(leer('app/api/admin/guion-estructuras/route.ts'), /estructuras: await getEstructurasTodas\(\)/);
});

test('cada tipo con sus estructuras; YouTube con la suya desde el 29/10 (claude-youtube) y el selector no queda vacío', () => {
  const c = catalogosLite(ANGULOS_GUION_DEFAULT, ESTRUCTURAS_GUION_DEFAULT);
  assert.equal(estructuraPorDefecto(c, 'reel')?.id, 'reel-viral');
  assert.equal(estructuraPorDefecto(c, 'story')?.id, 'story-dia');
  // Hasta el 29/10/2026 YouTube no tenía estructura (no había fuente: D6). Ahora es `youtube-retencion`, de claude-youtube (MIT).
  assert.equal(estructuraPorDefecto(c, 'youtube')?.id, 'youtube-retencion');
  const yt = estructurasDelTipo(c, 'youtube');
  assert.equal(yt.propias, true);
  assert.ok(yt.estructuras.length > 0);
  assert.deepEqual(docDeEstructura(ESTRUCTURAS_GUION_DEFAULT.find((e) => e.id === 'youtube-retencion')!.etiquetas).content?.filter((b) => b.attrs?.seccion).map((b) => b.content?.[0]?.text).slice(2, 4), ['Bloque uno', 'CTA medio'], '«CTA medio», no «Cta medio»');
  // Una biblioteca guardada antes de que existiera la recibe igual (conLasDeOrganicoNuevas).
  assert.match(readFileSync(join(raiz, 'lib/guion-estructuras-store.ts'), 'utf8'), /!d\.tipos\.includes\('ad'\) && !ids\.has\(d\.id\)/);
  const reel = docDeEstructura(ESTRUCTURAS_GUION_DEFAULT.find((e) => e.id === 'reel-viral')!.etiquetas);
  assert.deepEqual(bloquesDelDoc(reel).filter((b) => b.tipo === 'seccion').map((b) => b.texto), ['Gancho', 'Historia', 'Moraleja', 'CTA']);
});

test('la mudanza: YouTube Writer y Stories llevan al Copywriter, y «Abrir en Copywriter» sólo para quien ya lo ve', () => {
  const yt = leer('app/youtube-writer/page.tsx');
  assert.match(yt, /if \(await veCopywriter\(\)\) redirect\(await rutaConWs\('\/copywriter\?nuevo=youtube'\)\);/);
  const stories = leer('app/stories/page.tsx');
  assert.match(stories, /redirect\(await rutaConWs\('\/copywriter\?nuevo=story'\)\);/, 'Stories se deprecó: va a los templates de Story');
  assert.ok(!/StoriesApp|Onboarding/.test(stories.replace(/^\/\/.*$/gm, '')), 'sin la tab vieja ni su onboarding');
  const ads = leer('app/ads-writer/page.tsx');
  assert.match(ads, /const conCopywriter = await veCopywriter\(\);/);
  assert.equal((ads.match(/conCopywriter=\{conCopywriter\}/g) ?? []).length, 3, 'las tres formas en que abre la tab');
  const global = leer('app/ads-writer/GuionesGlobal.tsx');
  assert.match(global, /props: \{ angulo: g\.anguloId \|\| null, estructura: g\.estructuraId \|\| null \}/, 'copia con su ángulo y su estructura');
  assert.match(global, /onAbrirEnCopywriter=\{conCopywriter \?/);
});

test('/copywriter?nuevo=<tipo> abre «Nueva» con el tipo y NO crea nada por abrir un link', () => {
  const page = leer('app/copywriter/page.tsx');
  assert.match(page, /const tipoInicial = esTipoGuion\(nuevo\) \? nuevo : null;/);
  assert.match(page, /const enNueva = sp\.nueva !== undefined \|\| !!tipoInicial;/);
  assert.match(page, /r\.ok && !enNueva \? masReciente/, 'con un tipo o con «Nueva», no salta a la última página');
  assert.ok(!/\bcrear\(|pedirCrear/.test(page), 'la página no crea guiones');
});
