// =============================================================================
// Offer · un @ o un link de Instagram se lee DE VERDAD, o MaKo dice que no pudo (22/10/2026)
// =============================================================================
// Martín: «también faltaba lo de Instagram, que no estaba buscando bien a los @». En el onboarding de una clienta (ws21)
// MaKo dijo «vi tu Instagram» sin leerlo. Ahora la pantalla trata un @ como el link a su perfil, la ruta lo pide por
// Business Discovery (la bio, la web y las últimas publicaciones) y, si no se puede, lo dice y pide que le cuenten.
// Medido el 22/10/2026 con su @ público: hoy no se puede (la conexión de la plataforma no tiene permiso de Instagram ni una
// cuenta vinculada: 'sin-cuenta'), y el lector de afuera tiene Instagram bloqueado. Los @ de este test son inventados.
//
// ⚠️ PROBADO ROMPIENDO LO QUE PERSIGUE (22/10/2026, arnés romper-ig.mjs en el scratchpad de la sesión). Los números, al
// lado de cada test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { instagramsDelTexto, leerPerfilDeMeta, noPudeLeerInstagram, textoDelPerfil } from '../lib/instagram-perfil';
import { linksDe } from '../app/offer/ayudas';

const leer = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const PERFIL = 'https://www.instagram.com/asesora_tesis_demo/';

// rotura (un @ no es un link): 1 fallo. rotura (el mail cuenta como @): 1 fallo. rotura (el punto final es del usuario): 1 fallo.
test('el @: con o sin @, el link con o sin barra o con parámetros; un mail o una ruta reservada no', () => {
  assert.deepEqual(instagramsDelTexto('mi ig es @asesora_tesis_demo.'), [PERFIL], 'el punto que cierra la frase no es del usuario');
  assert.deepEqual(instagramsDelTexto('Hola (@Tesis.Demo), ¿@tesis.demo?'), ['https://www.instagram.com/tesis.demo/'], 'en minúscula y una vez');
  assert.deepEqual(instagramsDelTexto('escribime a ana@gmail.com'), [], 'un mail no es un @');
  assert.deepEqual(instagramsDelTexto('@explore'), [], 'una ruta de Instagram no es un perfil');
  assert.deepEqual(linksDe('mi web www.tesisdemo.com y mi ig @tesis.demo'), ['https://www.tesisdemo.com', 'https://www.instagram.com/tesis.demo/']);
  assert.deepEqual(linksDe(`${PERFIL}?igsh=abc123 y @asesora_tesis_demo`), [`${PERFIL}?igsh=abc123`], 'el link y su @ son el mismo perfil');
});

const respuesta = {
  business_discovery: {
    username: 'Asesora_Tesis_Demo', name: 'Asesora · Tesis', biography: 'Te acompaño a terminar tu tesis.\nAsesorías 1 a 1.',
    website: 'https://tesisdemo.com', followers_count: 1520, media_count: 87,
    media: { data: [{ caption: 'Cómo elegir tu tema', timestamp: '2026-10-20T12:00:00+0000', media_type: 'IMAGE' }, { caption: '', timestamp: '2026-10-19T12:00:00+0000', media_type: 'VIDEO' }] },
  },
};

// rotura (sin la bio): 1 fallo. rotura (sin las publicaciones): 1 fallo. rotura (la cuenta que no está es un error): 1 fallo.
// rotura (el perfil se presenta como del dueño): 1 fallo.
test('Business Discovery: la bio, la web, las cifras y las publicaciones; y cada fallo con su motivo', () => {
  const r = leerPerfilDeMeta(200, respuesta);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.perfil.usuario, 'asesora_tesis_demo');
  assert.equal(r.perfil.bio, 'Te acompaño a terminar tu tesis. Asesorías 1 a 1.');
  assert.deepEqual(r.perfil.posts, [{ fecha: '2026-10-20', tipo: 'IMAGE', texto: 'Cómo elegir tu tema' }], 'una publicación sin texto no dice nada');
  const t = textoDelPerfil(r.perfil);
  // Un @ que nombra el dueño puede ser de su competencia: la IA no puede tomar esa bio como su negocio (revisión, B6).
  assert.match(t, /^Perfil de Instagram que nombró el dueño \(puede no ser el suyo: su competencia, un ejemplo\): @asesora_tesis_demo \(Asesora · Tesis\) — https:\/\/www\.instagram\.com\/asesora_tesis_demo\//);
  assert.match(t, /Bio: Te acompaño a terminar tu tesis\./);
  assert.match(t, /1520 seguidores · 87 publicaciones/);
  assert.match(t, /Últimas publicaciones:\n- 2026-10-20: Cómo elegir tu tema/);
  assert.deepEqual(leerPerfilDeMeta(400, { error: { code: 110, error_subcode: 2207013, message: 'Cannot find User' } }), { ok: false, motivo: 'no-esta', detalle: 'Cannot find User' });
  assert.equal((leerPerfilDeMeta(400, { error: { code: 10, message: 'Permission' } }) as { motivo: string }).motivo, 'sin-permiso');
});

// rotura (afirma que lo leyó): 1 fallo.
test('si no se pudo, MaKo lo dice y pide que le cuenten (nunca «vi tu Instagram», ni da por hecho que es suyo)', () => {
  assert.equal(noPudeLeerInstagram('tesis.demo', 'sin-cuenta'), 'No pude leer el Instagram @tesis.demo: Instagram no deja leerlo desde aquí. Si es el tuyo, cuéntame en una frase qué hace tu negocio y a quién le vende.');
  assert.match(noPudeLeerInstagram('tesis.demo', 'no-esta'), /^No encontré el Instagram @tesis\.demo\. Si es el tuyo,/);
});

// rotura (la ruta manda Instagram al lector de afuera): 1 fallo. rotura (una página sin Instagram vinculado no se dice): 1 fallo.
test('la ruta lee Instagram por Business Discovery ANTES de la página y del lector de afuera', () => {
  const r = sinComentarios(leer('app/api/offer/route.ts'));
  const f = r.slice(r.indexOf('async function leerLink('), r.indexOf('async function leerLink(') + 5_000);
  const ig = f.indexOf('const ig = usuarioDeUrlInstagram(link.leida);');
  assert.ok(ig > 0 && ig < f.indexOf('extraerLanding(') && ig < f.indexOf('leerConLectorExterno('), 'primero Instagram');
  assert.match(f, /if \(!perfil\.ok\) return no\(422, noPudeLeerInstagram\(ig, perfil\.motivo\)\);/);
  assert.match(f, /nombre: `Instagram @\$\{ig\}`, via: 'web', texto,/);
  const s = sinComentarios(leer('lib/instagram-perfil-server.ts'));
  assert.match(s, /if \(!ig\) return \{ ok: false, motivo: 'sin-cuenta'/, 'Meta omite el campo sin avisar: se dice');
  assert.match(s, /business_discovery\.username\(\$\{usuario\}\)\{\$\{CAMPOS_PERFIL\}\}/);
  assert.match(leer('lib/instagram-perfil.ts'), /export const CAMPOS_PERFIL = `username,name,profile_picture_url,biography,website,followers_count,media_count,media\.limit\(\$\{POSTS_A_LEER\}\)\{caption,timestamp,media_type\}`;/);
});
