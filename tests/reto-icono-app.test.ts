// =============================================================================
// EL RETO Y EL GRUPO SIN LA CRIATURA DE MAKO: cada uno con su avatar (20/11/2026)
// =============================================================================
// Martín en la llamada con Leila (Fathom 205366178, 00:39:14): «no debería tener la criatura de Mako, porque la criatura de Mako está
// reservada únicamente para Ops Center». Primero el reto llevó la baldosa de la app de MaKo; esa misma noche el Cerebro decidió los dos
// avatares, dibujados antes en un artefacto (https://claude.ai/artifact/6ixE1LC5s1Pe8bAYrfpCH4):
//   · el RETO (ASPECTO_RETO): un círculo con el degradé cálido de MaKo (amarillo a naranja) y una hoja de calendario blanca con un «7»
//     grande y «días» chico. En la fila de la lista, la cabecera, las burbujas, los puntitos, la entrada de cada día y la llegada.
//   · el GRUPO «MaKo <> negocio» (ASPECTO_GRUPO): el de un grupo de WhatsApp sin foto, un círculo gris claro con siluetas blancas, en
//     claro y en oscuro. En la fila de la lista y en la cabecera (y la portada) de ese chat; en el teléfono, la misma foto.
// Los dos son SVG en línea, sin hooks y sin ids. Se prueba lo DIBUJADO (`Muneco` con renderToStaticMarkup): con el título «MaKo»,
// `aspectoDe` devolvería la criatura.
//
// ⚠️ PROBADO ROMPIÉNDOLO: ver al pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Muneco } from '../app/admin/operaciones/Muneco';
import { ASPECTO_GRUPO, ASPECTO_MAKO, ASPECTO_RETO, sanearAspecto } from '../lib/centro-munecos';
import * as munecos from '../lib/centro-munecos';

const fuente = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const dibujo = (aspecto: typeof ASPECTO_MAKO, size = 26) => renderToStaticMarkup(createElement(Muneco, { titulo: 'MaKo', aspecto, animo: 'despierto', size }));

test('1. el reto: el círculo con el degradé de amarillo a naranja y la hoja de calendario blanca con «7» y «días», también con el título «MaKo»', () => {
  const svg = dibujo(ASPECTO_RETO);
  assert.match(svg, /class="mun mun--reto"/);
  assert.match(svg, /border-radius:50%;background:linear-gradient\(150deg, #F8CB63 0%, #F2B01E 52%, #EC8A1F 100%\)/, 'el círculo con el degradé cálido, de amarillo a naranja');
  assert.match(svg, /<rect x="10\.5" y="8\.9" width="19" height="22\.6" rx="3\.6" fill="#fff"><\/rect>/, 'la hoja de calendario, blanca');
  assert.match(svg, /<text [^>]*font-size="12\.5" font-weight="800"[^>]*>7<\/text>/, 'el «7» grande');
  assert.match(svg, /<text [^>]*font-size="3\.9"[^>]*>días<\/text>/, '«días» chico, abajo');
  assert.ok(svg.indexOf('>7<') < svg.indexOf('>días<'), '«días» va debajo del «7»');
  assert.doesNotMatch(svg, /mun-cuerpo/, 'sin el cuerpo ni la cara de la criatura');
  assert.doesNotMatch(svg, / id="|<linearGradient|url\(#/, 'sin ids de SVG: dos en la misma pantalla no se pisan');
  // Al tamaño de la fila, de la cabecera y de la burbuja: el mismo dibujo.
  for (const px of [38, 34, 26]) assert.match(dibujo(ASPECTO_RETO, px), new RegExp(`width="${px}" height="${px}" viewBox="0 0 40 40"`));
});

test('2. el grupo: tres siluetas blancas en un círculo gris claro, que en oscuro baja de gris', () => {
  const svg = dibujo(ASPECTO_GRUPO, 38);
  assert.match(svg, /class="mun mun--grupo"/);
  assert.match(svg, /<circle cx="20" cy="20" r="20" fill="var\(--avatar-grupo-fondo, #DFE5E7\)"><\/circle>/, 'el círculo gris claro');
  assert.match(svg, /<g fill="var\(--avatar-grupo-figura, #FFFFFF\)">/, 'las siluetas, blancas');
  assert.equal((svg.match(/<circle /g) ?? []).length, 4, 'el círculo y tres cabezas');
  assert.equal((svg.match(/<path /g) ?? []).length, 3, 'tres cuerpos');
  assert.doesNotMatch(svg, /mun-cuerpo/, 'sin la criatura');
  assert.doesNotMatch(svg, / id="|<linearGradient|url\(#/, 'sin ids de SVG');
  // Los dos temas: el claro en :root y el oscuro en [data-tema="oscuro"], con otro gris.
  const css = fuente('app/globals.css');
  const claro = /--avatar-grupo-fondo: (#[0-9A-Fa-f]{6});\s*--avatar-grupo-figura: #FFFFFF;/.exec(css);
  assert.ok(claro && claro[1] === '#DFE5E7', 'el gris claro en :root');
  const oscuro = /\[data-tema="oscuro"\] \{[^}]*--avatar-grupo-fondo: (#[0-9A-Fa-f]{6});/.exec(css);
  assert.ok(oscuro, 'el grupo en oscuro, en [data-tema="oscuro"]');
  assert.notEqual(oscuro[1], claro[1], 'en oscuro, otro gris');
});

test('3. la criatura sigue igual para el Ops Center; los avatares no se eligen ni se guardan', () => {
  const criatura = dibujo(ASPECTO_MAKO);
  assert.match(criatura, /mun-cuerpo/);
  assert.doesNotMatch(criatura, /mun--reto|mun--grupo/);
  assert.equal(sanearAspecto(ASPECTO_RETO), null, 'la estrella de debajo tampoco se guarda');
  assert.equal(sanearAspecto({ forma: 'circulo', color: '--grafo-voz', cara: 'risa', icono: 'reto' })?.icono, undefined);
  assert.equal(sanearAspecto({ forma: 'circulo', color: '--grafo-voz', cara: 'risa', icono: 'grupo' })?.icono, undefined);
  assert.ok(!('ASPECTO_APP_MAKO' in munecos), 'la baldosa de la app ya no es el avatar del reto');
  // Muneco mira el ícono ANTES del título («MaKo» sería la criatura).
  const m = fuente('app/admin/operaciones/Muneco.tsx');
  const icono = m.indexOf('if (aspecto?.icono) { const Icono = ICONOS[aspecto.icono]; return <Icono size={size} style={style} />; }');
  assert.ok(icono > 0 && icono < m.indexOf('const { forma, color, cara, retrato } = aspectoDe(titulo, aspecto);'));
});

test('4. el reto no lleva la criatura en ningún lugar: la fila, la cabecera, las burbujas, los puntitos, la entrada y la llegada', () => {
  const chat = fuente('app/second-brain/reto/ChatDelReto.tsx');
  assert.ok(chat.includes('const quienMako = useMemo(() => ({ nombre: RETO_TITULO, aspecto: ASPECTO_RETO }), []);'), 'la caja y la charla (sus puntitos)');
  assert.ok(chat.includes("cabecera={{ clave: 'reto-7-dias', titulo: RETO_TITULO, aspecto: ASPECTO_RETO,"), 'la cabecera');
  assert.ok(chat.includes('<EntradaEscribiendo foto={<Muneco titulo="MaKo" aspecto={ASPECTO_RETO} animo="despierto" size={26} />} quien="MaKo" />'), 'la entrada de cada día');
  // Los puntitos de la cola y de la carga son burbujas: van con su foto.
  const burbuja = fuente('app/second-brain/reto/Burbuja.tsx');
  assert.ok(burbuja.includes("quien={{ titulo: 'MaKo', aspecto: ASPECTO_RETO }}"), 'las burbujas y los puntitos');
  assert.ok(fuente('app/second-brain/ChatSecondBrain.tsx').includes('<FilaDeChat titulo="Reto de 7 días" marca="sb-reto-chat" aspecto={ASPECTO_RETO}'), 'la fila de la lista');
  const llegada = fuente('app/second-brain/LlegadaAlReto.tsx');
  assert.ok(llegada.includes('<span className="sbl-foto" aria-hidden="true"><Muneco titulo="MaKo" aspecto={ASPECTO_RETO} animo="despierto" size={26} /></span>'), 'la llegada');
  for (const [f, s] of [['ChatDelReto', chat], ['Burbuja', burbuja], ['LlegadaAlReto', llegada]] as const) {
    assert.doesNotMatch(s, /\bASPECTO_MAKO\b|\bASPECTO_APP_MAKO\b|CriaturaMako/, `${f}: volvió la criatura de MaKo (o la baldosa)`);
  }
});

test('5. el grupo, sin la criatura: la fila de la lista (y su espera), la cabecera, la portada y la foto del teléfono', () => {
  const filas = fuente('app/_chat/grupo/FilasDelGrupo.tsx');
  assert.ok(filas.includes('<FilaDeChat key={f.ws} titulo={f.titulo} criatura="MaKo" aspecto={ASPECTO_GRUPO}'), 'la fila de la lista');
  assert.ok(filas.includes('<Muneco titulo="MaKo" aspecto={ASPECTO_GRUPO} animo="dormido" size={38} />'), 'la fila mientras carga');
  assert.doesNotMatch(filas, /\bASPECTO_MAKO\b/, 'FilasDelGrupo: volvió la criatura');
  const chat = fuente('app/second-brain/ChatDelGrupo.tsx');
  assert.ok(chat.includes("clave: `grupo-${ws}`, titulo, criatura: 'MaKo', aspecto: ASPECTO_GRUPO,"), 'la cabecera');
  assert.doesNotMatch(chat, /\bASPECTO_MAKO\b/, 'ChatDelGrupo: volvió la criatura');
  assert.ok(fuente('app/_chat/grupo/HiloDelGrupo.tsx').includes('<Muneco titulo="MaKo" aspecto={ASPECTO_GRUPO} animo="despierto" size={76} />'), 'la portada del chat');
  // El teléfono: la misma foto (antes, el ícono de personas en verde).
  const m = fuente('app/m/second-brain/FilasDelGrupoM.tsx');
  assert.ok(m.includes('export function FotoDelGrupo({ size = 48 }: { size?: number }) {\n  return <AvatarDelGrupo size={size} />;\n}'), 'la foto del grupo en el teléfono');
  assert.doesNotMatch(m, /name="users"/, 'el ícono verde de antes');
});

// ⚠️ PROBADO ROMPIÉNDOLO (20/11/2026, base 5/0; al restaurar, 5/0). Cada rotura, de a una, cae:
//   - Muneco sin mirar el ícono (`if (aspecto?.icono) …` borrado): el reto y el grupo vuelven a ser la criatura → 1, 2 y 3
//   - el reto con un <linearGradient id> en vez del fondo CSS → 1
//   - el reto sin el naranja (el degradé sólo dorado) → 1
//   - el grupo sin su gris en oscuro → 2
//   - las burbujas, la fila del reto, la cabecera del grupo o la foto del teléfono de vuelta a lo de antes (cada una por separado) → 4 o 5
