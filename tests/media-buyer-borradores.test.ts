// =============================================================================
// Campañas del Media Buyer: QUÉ cuenta se leyó, y lo que está sin publicar en Meta (MK-03, 27/10/2026)
// =============================================================================
// Joan no veía las campañas de Sergio y otros dos clientes. El 23/10 se midió que no estaban en la cuenta conectada (otra
// cuenta o un borrador) y /ads-manager pasó a decir qué cuenta leía; el 25/10 esa pantalla se borró con el rediseño y la
// pestaña Campañas volvió a no decirlo. Un borrador del Administrador de anuncios no existe para la API, así que no se
// puede listar: se dice la cuenta y se lleva a su «Revisar y publicar». Lo que Meta SÍ devuelve sin publicar (lo que
// retuvo esperando la aprobación de un admin, 2446984) va en su tarjeta: «Retenida en Meta: falta publicar».
//
// Correr: node --import tsx --test tests/media-buyer-borradores.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { campanasRetenidas } from '../lib/media-buyer/productos';
import { linkCampanasEnMeta } from '../lib/meta-cuenta-leida';
import type { NodoMB } from '../lib/media-buyer/motor';

const leer = (rel: string) => readFileSync(join(import.meta.dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const N = (x: Partial<NodoMB> & Pick<NodoMB, 'id' | 'nivel'>): NodoMB => ({
  nombre: x.id, parentId: null, configurado: 'ACTIVE', entrega: 'ACTIVE', presupuestoDia: null, nivelPresupuesto: null, creada: null, ...x,
});

test('una campaña queda retenida si Meta retuvo un anuncio o un conjunto suyo; lo borrado no cuenta', () => {
  const arbol = [
    N({ id: 'c1', nivel: 'campaign' }), N({ id: 's1', nivel: 'adset', parentId: 'c1' }), N({ id: 'a1', nivel: 'ad', parentId: 's1', retenido: true }),
    N({ id: 'c2', nivel: 'campaign' }), N({ id: 's2', nivel: 'adset', parentId: 'c2' }), N({ id: 'a2', nivel: 'ad', parentId: 's2' }),
    N({ id: 'c3', nivel: 'campaign' }), N({ id: 's3', nivel: 'adset', parentId: 'c3' }), N({ id: 'a3', nivel: 'ad', parentId: 's3', retenido: true, configurado: 'DELETED' }),
    N({ id: 'c4', nivel: 'campaign' }), N({ id: 's4', nivel: 'adset', parentId: 'c4', retenido: true }),
  ];
  assert.deepEqual([...campanasRetenidas(arbol)].sort(), ['c1', 'c4']);
  assert.equal(campanasRetenidas([N({ id: 'a9', nivel: 'ad', parentId: 'sin-conjunto', retenido: true })]).size, 0, 'un anuncio sin su conjunto no inventa campaña');
});

test('el link lleva a las campañas de ESA cuenta en el Administrador, con la campaña elegida', () => {
  assert.equal(linkCampanasEnMeta('act_1551449682972756'), 'https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=1551449682972756');
  assert.equal(linkCampanasEnMeta('1551449682972756', '120210000000000001'),
    'https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=1551449682972756&selected_campaign_ids=120210000000000001');
  assert.equal(linkCampanasEnMeta('act_1', 'no-es-un-id'), 'https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=1');
  assert.equal(linkCampanasEnMeta(null), null, 'sin cuenta no hay link (no se manda al Administrador de otra)');
});

test('la lectura de Meta marca lo retenido y trae el nombre de la cuenta', () => {
  const datos = sinComentarios(leer('lib/media-buyer/datos.ts'));
  assert.match(datos, /\.\.\.\(n\.issues\?\.some\(esAprobacionPendiente\) \? \{ retenido: true \} : \{\}\)/);
  assert.match(datos, /cuentaNombre: h\.account\.nombre \?\? null/);
  assert.match(datos, /cuentaNombre = m\.cuentaNombre;/);
  assert.match(datos, /adAccountId: act \?\? conexion\?\.adAccountId \?\? null, cuentaNombre,/);
});

test('el lienzo dice la cuenta y avisa «sin campañas» sólo con la cuenta leída entera', () => {
  const vista = sinComentarios(leer('lib/media-buyer/vista.ts'));
  assert.match(vista, /const aviso = datos\.parcial \? null : avisoSinCampanasNuevas\(\{ hayCampanas: vivas\.length > 0, ultima: ultimaCreada\(vivas\.map\(\(c\) => c\.creada\)\) \}\);/);
  assert.match(vista, /\.\.\.\(retenidas\.has\(c\.id\) \? \{ retenida: true \} : \{\}\)/);
  assert.match(vista, /fuente: datos\.fuente, moneda: datos\.moneda, cuenta, aviso \}/);
});

test('la pestaña lo dibuja: la tarjeta retenida con «Publicar», y al pie la cuenta con su «Revisar y publicar»', () => {
  const lz = sinComentarios(leer('app/ads-manager/Lienzo.tsx'));
  assert.match(lz, /cuenta: r\.cuenta \?\? null, aviso: r\.aviso \?\? null/, 'lo que manda la ruta llega al estado');
  assert.match(lz, /sub=\{c\.retenida \? 'Retenida en Meta: falta publicar'/);
  assert.match(lz, /marca=\{publicar\s*\? <a className="aa-chica-aplicar" href=\{publicar\} target="_blank" rel="noreferrer">Publicar ↗<\/a>/, 'lo retenido gana a los cambios de MaKo');
  assert.match(lz, /const cuenta = etiquetaCuentaMeta\(l\.cuenta\);/);
  assert.match(lz, />Revisar y publicar en Meta ↗<\/a>/);
  assert.match(lz, /todas\.length \? mensajeDeCampanas\(.*\) : l\.aviso \?\?/, 'sin campañas, el pie dice la frase de la cuenta y no «toca una campaña»');
  assert.doesNotMatch(lz, />Cuenta \{/, 'el «Cuenta» lo pone etiquetaCuentaMeta');
});

test('MaKo en el chat sabe lo mismo: la cuenta, lo retenido y que un borrador no llega por la API', () => {
  const api = sinComentarios(leer('lib/api-mako/areas/ads.run.ts'));
  assert.match(api, /cuentaNombre: d\.cuentaNombre \?\? null/);
  assert.match(api, /borradores: 'Un borrador del Administrador de anuncios no llega por la API/);
  assert.match(api, /\.\.\.\(retenidas\.has\(c\.id\) \? \{ retenidaEnMeta:/);
});
