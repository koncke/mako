// =============================================================================
// Decimoquinta tanda de Automations (12/10/2026): los 8 puntos de Martín
// =============================================================================
// El pedido literal, en la entrada «Decimoquinta tanda» de docs/hallazgos-chatbot.md y en la bitácora
// (app/admin/dev/chatbot/bitacora.ts). Lo que se fija acá (lo puro se EJECUTA; el cableado, en el fuente sin
// comentarios y en LF):
//   1. el título «¿Qué vas a crear hoy?» arriba de la caja, en las dos puertas;
//   2. en el editor de Instagram / Messenger el lápiz y el tacho van PEGADOS a la burbuja (el arreglo del WhatsApp);
//   3. el botón de MaKo de los editores ES el logo (la chispa sola), no `MakoStar` (la chispa chica con el punto arriba);
//   4. el modal de conectar NO salta al crear o editar una tarjeta: sólo el chip, Publicar, Probar y Activar;
//   5. el click derecho del lienzo sin «Publicar», «Acomodar» ni «Centrar»;
//   6. el ejemplo de la caja para con el foco y VUELVE al salir sin escribir;
//   7. el «+» de la caja: subir un archivo o una imagen (MaKo arma el flujo de eso) y pegar un flujo;
//   8. «Copiar flujo» copia un TOKEN (mig 0265) y pegarlo dice «Flujo copiado: <nombre>».
//
// PROBADO ROMPIÉNDOLO: ver `ROTURAS` al pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  BarraPideselo, accionesMas, MAS_ARCHIVO, MAS_PEGAR, NO_ES_FLUJO, SIN_FLUJO_COPIADO, PEGALO_A_MANO, PLACEHOLDER_ARCHIVO,
} from '../app/automations/ChatMako';
import { seMueveElEjemplo, TITULO_CAJA, CSS_CAJA_PEDIDO, CSS_TOKENS_CASA, ChipCaja } from '../app/web-generator/CajaPedido';
import { pedidoConArchivo, TOPE_PEDIDO_MAKO, PEDIDO_SOLO_ARCHIVO, ACCEPT_ARCHIVO_FLUJO, EJEMPLOS } from '../app/automations/CrearConIA';
import {
  tokenDeBytes, tokenDeTexto, copiaPegada, resumenDeCopia, rotuloFlujoPegado, copiaDeFlujo, textoDeCopia, leerCopia,
  PREFIJO_TOKEN, LARGO_TOKEN, type PasoCopiado,
} from '../lib/flujo-copia';
import { BotonMako } from '../app/_ui/BotonMako';
import { BotonMakoWhatsApp } from '../app/automations/EditorMensajeWhatsApp';
import { BurbujaSocial } from '../app/automations/social-ui';
import * as medios from '../lib/medios-automatizacion';
import { marcasDeVoseo } from '../lib/puestas-data';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
// Las líneas primero y los bloques después (AGENTS.md: un `/*` adentro de un comentario de línea).
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const fuente = (r: string) => sinComentarios(leer(r));
const tramo = (src: string, desde: string, hasta: string, tope = 4_000): string => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no está «${desde}»`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no está el cierre «${hasta}»`);
  assert.ok(j - i <= tope, `el tramo de «${desde}» mide ${j - i} (> ${tope})`);
  return src.slice(i, j + hasta.length);
};

const CHAT = fuente('app/automations/ChatMako.tsx');
const CAJA = fuente('app/web-generator/CajaPedido.tsx');
const LIENZO_FLUJO = fuente('app/automations/FlujoLienzo.tsx');
const barra = (props: Partial<Parameters<typeof BarraPideselo>[0]> = {}) =>
  renderToStaticMarkup(createElement(BarraPideselo, { onPedido: () => {}, ...props }));

// ── 1. El título ─────────────────────────────────────────────────────────────────────────────────

test('punto 1: «¿Qué vas a crear hoy?» arriba de la caja, en el modal (h2) y en la landing (h1), con la hoja de la caja', () => {
  assert.equal(TITULO_CAJA, '¿Qué vas a crear hoy?');
  const html = barra();
  const t = html.indexOf('<h2 class="gp-cc-titulo">¿Qué vas a crear hoy?</h2>');
  assert.ok(t >= 0, 'el modal no tiene el título');
  assert.ok(t < html.indexOf('<form class="gp-cc-caja"'), 'el título no va arriba de la caja');
  assert.match(fuente('app/web-generator/CajaCrear.tsx'), /titulo=\{\{ texto: TITULO_CAJA, nivel: 1 \}\}/);
  assert.doesNotMatch(fuente('app/web-generator/CajaCrear.tsx'), /<h1 className="gp-cc-titulo">/, 'la landing lo dibuja aparte (dos copias)');
  // La hoja del título es de la caja, y afuera de la landing tiene su color (`--gp-titulo`) y su hueco (16px, el de la landing).
  assert.match(CSS_CAJA_PEDIDO, /\.gp \.gp-cc-titulo \{ margin: 0; text-align: center; font-size: 34px; font-weight: 600;/);
  assert.match(CSS_TOKENS_CASA, /--gp-titulo: var\(--ink\)/);
  assert.match(CSS_TOKENS_CASA, /gap: 16px;/);
});

// ── 2. El lápiz y el tacho pegados a la burbuja de Instagram / Messenger ─────────────────────────

test('punto 2: la burbuja del editor social va al 100% y el tope lo pone la fila (el mismo arreglo del WhatsApp)', () => {
  // Ejecutada: con `maxAncho`, la burbuja deja el 78% de la conversación.
  const conversacion = renderToStaticMarkup(createElement(BurbujaSocial, { canal: 'instagram', children: 'Hola' }));
  assert.match(conversacion, /max-width:78%/);
  const editor = renderToStaticMarkup(createElement(BurbujaSocial, { canal: 'instagram', maxAncho: '100%', children: 'Hola' }));
  assert.match(editor, /max-width:100%/);
  assert.doesNotMatch(editor, /max-width:78%/);
  // El cableado: las burbujas del editor con `maxAncho="100%"` y la caja de la fila como la del WhatsApp.
  const social = fuente('app/automations/EditorMensajeSocial.tsx');
  const burbujas = tramo(social, 'const burbujaDe = (p: ParteMensaje): ReactNode => {', '\n  };', 1_600);
  assert.equal((burbujas.match(/<BurbujaSocial canal=\{canal\} maxAncho="100%">/g) ?? []).length, 2, 'una burbuja del editor quedó al 78%');
  assert.match(burbujas, /<ArchivoSocial canal=\{canal\} maxAncho="100%"/);
  assert.match(social, /<div style=\{\{ flex: '0 1 auto', minWidth: 0, maxWidth: 'calc\(100% - 70px\)', display: 'flex', justifyContent: 'flex-end', borderRadius: 20,/);
  // El WhatsApp sigue con el suyo.
  assert.match(fuente('app/automations/EditorMensajeWhatsApp.tsx'), /<div style=\{\{ flex: '0 1 auto', minWidth: 0, maxWidth: 'calc\(100% - 70px\)'/);
});

// ── 3. El botón de MaKo de los editores ES el logo ───────────────────────────────────────────────

test('punto 3: el botón de MaKo dibuja el LOGO (la chispa sola, 48×48), no la chispa chica con el punto arriba', () => {
  const html = renderToStaticMarkup(createElement(BotonMako, { onClick: () => {}, title: 'x', lado: 32 }));
  assert.match(html, /<svg width="32" height="32" viewBox="0 0 48 48"/, 'no es el logo, o no llena el botón');
  assert.doesNotMatch(html, /<circle/, 'volvió el punto chico de arriba (MakoStar)');
  assert.doesNotMatch(html, /viewBox="-12 -12 24 24"/, 'volvió MakoStar');
  // El de los editores (WhatsApp, Instagram, Messenger, MaKo en WhatsApp) es ese botón.
  const editor = renderToStaticMarkup(createElement(BotonMakoWhatsApp, { clave: 'x|1|0' }));
  assert.match(editor, /viewBox="0 0 48 48"/);
  assert.doesNotMatch(editor, /<circle/);
  // El de la cabecera de una automatización, el MISMO logo.
  assert.match(fuente('app/automations/SecuenciaPerfil.tsx'), /<MakoLogo size=\{Math\.min\(LADO_LOGO, lado\)\} animate=\{false\} \/>/);
  assert.doesNotMatch(fuente('app/_ui/BotonMako.tsx'), /MakoStar/);
});

// ── 4. El modal de conectar no interrumpe la edición ─────────────────────────────────────────────

test('punto 4: crear o editar una tarjeta no abre el modal de conectar; sólo el chip de la tarjeta lo abre en el lienzo', () => {
  assert.doesNotMatch(LIENZO_FLUJO, /pedirConectar|medioAConectarAlCrear|conectarOfrecido/, 'volvió el modal que salta al crear');
  assert.equal('medioAConectarAlCrear' in medios, false, 'volvió la regla del QR que salta');
  assert.equal('MEDIOS_QUE_SALTAN' in medios, false);
  // En el lienzo, `setConectarMedio` sólo en handlers: el chip «Sin conectar» y el cierre del modal.
  const llamadas = [...LIENZO_FLUJO.matchAll(/setConectarMedio\(/g)].map((m) => LIENZO_FLUJO.slice(Math.max(0, m.index! - 40), m.index! + 20));
  assert.equal(llamadas.length, 3, `cambió quién abre el modal: ${llamadas.join(' | ')}`);
  assert.match(LIENZO_FLUJO, /onConectar=\{rolAdmin && paso \? \(\) => setConectarMedio\(/);
  assert.match(LIENZO_FLUJO, /onCerrar=\{\(\) => setConectarMedio\(null\)\} onConectado=\{\(\) => setConectarMedio\(null\)\}/);
  // Publicar, Probar y Activar lo siguen abriendo (SecuenciaPerfil).
  const perfil = fuente('app/automations/SecuenciaPerfil.tsx');
  assert.match(perfil, /if \(medio\) \{ setConectarMedio\(medio\); setBusy\(null\); return; \}/);
  assert.match(perfil, /if \(medio\) setConectarMedio\(medio\);/);
  assert.match(perfil, /if \(falta\) \{ setErr\(null\); setLineaAConectar\(falta\.linea\); setConectarMedio\(falta\.medio\); return; \}/);
});

// ── 5. El click derecho del lienzo ───────────────────────────────────────────────────────────────

test('punto 5: el click derecho del fondo sólo crea tarjetas: sin «Publicar», «Acomodar» ni «Centrar»', () => {
  const ctx = tramo(fuente('app/_components/Lienzo.tsx'), 'function onContextMenu(', 'setMenu({ x: e.clientX, y: e.clientY, items });', 2_000);
  assert.doesNotMatch(ctx, /centrar|Centrar/, 'el lienzo volvió a sumar «Centrar»');
  assert.match(ctx, /: \(menuLienzo\?\.\(aGrafo\(e\.clientX, e\.clientY\)\) \?\? \[\]\);/);
  const menu = tramo(LIENZO_FLUJO, 'const menuLienzo = editable ?', ': undefined;', 600);
  assert.doesNotMatch(menu, /publicar|acomodar|Publicar|Acomodar/);
  assert.match(menu, /opcionesSueltas\(pasos\)\.map\(/);
  assert.doesNotMatch(fuente('app/automations/SecuenciaPerfil.tsx'), /onPublicar=|puedePublicar=/);
  // «Centrar» sigue en el zoom y «Acomodar» al lado del deshacer.
  assert.match(fuente('app/_components/Lienzo.tsx'), /<BotonChico onClick=\{\(\) => encuadrar\(true\)\} rotulo="Centrar">/);
  assert.match(LIENZO_FLUJO, /herramientas=\{conAcomodar\}/);
});

// ── 6. El ejemplo que vuelve ─────────────────────────────────────────────────────────────────────

test('punto 6: el ejemplo se mueve sin foco y vacío; tocar lo para y salir sin escribir lo vuelve a mover', () => {
  assert.equal(seMueveElEjemplo(true, false, ''), true, 'sin foco y vacía, quieto');
  assert.equal(seMueveElEjemplo(true, true, ''), false, 'con el foco se sigue moviendo');
  assert.equal(seMueveElEjemplo(true, false, 'algo'), false, 'con algo escrito se mueve');
  assert.equal(seMueveElEjemplo(false, false, ''), false, 'quien monta lo apagó (un archivo) y se mueve igual');
  // Tocar y salir sin escribir: vuelve (antes, `tocada` lo apagaba para siempre).
  const secuencia = [false, true, false].map((foco) => seMueveElEjemplo(true, foco, ''));
  assert.deepEqual(secuencia, [true, false, true]);
  // El foco es el de la CAJA: el form lo prende al entrar y lo apaga sólo si el foco se va FUERA de la caja.
  assert.match(CAJA, /onFocus=\{\(\) => setFoco\(true\)\}\s+onBlur=\{\(e\) => \{ if \(!e\.currentTarget\.contains\(e\.relatedTarget as Node \| null\)\) setFoco\(false\); \}\}/);
  assert.match(CAJA, /mover=\{seMueveElEjemplo\(p\.animar, foco, p\.valor\)\}/);
  // Dibujada: vacía, el primer ejemplo; con algo escrito, el placeholder quieto.
  assert.match(barra(), new RegExp(`placeholder="${EJEMPLOS[0]}"`));
});

// ── 7. El «+» de la caja ─────────────────────────────────────────────────────────────────────────

test('punto 7: el «+» sube un archivo o una imagen y pega un flujo; ya no repite «Lienzo en blanco» ni «Usar plantilla»', () => {
  assert.deepEqual(accionesMas(true).map((o) => [o.value, o.label]), [[MAS_ARCHIVO, 'Subir archivo o imagen'], [MAS_PEGAR, 'Pegar un flujo']]);
  assert.deepEqual(accionesMas(false).map((o) => o.value), [MAS_ARCHIVO], '«Pegar un flujo» sin poder crearlo');
  for (const o of accionesMas(true)) assert.doesNotMatch(o.label, /Lienzo en blanco|Usar plantilla/);
  assert.match(barra(), /aria-label="Agregar"/);
  // Qué se sube: documentos y capturas; audio y video no (para hablar está el micrófono).
  const acepta = ACCEPT_ARCHIVO_FLUJO.split(',');
  for (const e of ['.pdf', '.docx', '.txt', '.xlsx', '.png', '.jpg', '.webp', '.heic']) assert.ok(acepta.includes(e), e);
  for (const e of ['.mp3', '.mp4', '.wav', '.mov']) assert.ok(!acepta.includes(e), e);
  // Lo lee el lector de la casa (una imagen, por visión), sólo el admin, por multipart.
  const ruta = fuente('app/api/chat-agent/secuencias/archivo/route.ts');
  assert.match(ruta, /import \{ archivoATexto \} from '@\/lib\/archivo-a-texto';/);
  assert.match(ruta, /if \(ws == null \|\| rol !== 'admin'\) return falla\(403,/);
  assert.match(ruta, /await archivoATexto\(file, \{ feature: 'chatbot-crear-ia',/);
  assert.match(CHAT, /void leerArchivoParaPedido\(file, ac\.signal\)\.then\(/);
  assert.match(fuente('app/automations/archivo-pedido-cliente.ts'), /await fetch\(RUTA_ARCHIVO_PEDIDO, \{ method: 'POST', body: cuerpo, signal \}\)/);
  assert.match(fuente('app/api/chat-agent/secuencias/archivo/route.ts'), /const TOPE_BYTES = 15 \* 1024 \* 1024;/, 'el tope de la caja y el de la ruta');
  assert.match(CHAT, /onPedido\(pedidoConArchivo\(texto, \{ nombre: archivo\.nombre, texto: archivo\.texto \}\)\)/);
});

test('punto 7: el pedido con un archivo entra en el tope de MaKo, con lo escrito primero', () => {
  const largo = 'x'.repeat(5_000);
  const p = pedidoConArchivo('Que les dé la bienvenida', { nombre: 'proceso.pdf', texto: largo });
  assert.ok(p.length <= TOPE_PEDIDO_MAKO, `mide ${p.length}`);
  assert.ok(p.startsWith('Que les dé la bienvenida\n\nEl archivo «proceso.pdf»:\n'));
  assert.ok(p.endsWith('…'), 'recortó sin decirlo');
  // Sin escribir nada, el pedido por defecto; un archivo corto entra entero.
  const corto = pedidoConArchivo('  ', { nombre: 'captura.png', texto: 'Paso 1: saludar\n\n\n\nPaso 2: agendar' });
  assert.equal(corto, `${PEDIDO_SOLO_ARCHIVO}\n\nEl archivo «captura.png»:\nPaso 1: saludar\n\nPaso 2: agendar`);
  // Lo escrito no se come el tope entero: el archivo siempre tiene lugar.
  const mucho = pedidoConArchivo('y'.repeat(3_000), { nombre: 'a.txt', texto: 'dato' });
  assert.ok(mucho.includes('dato'), 'lo escrito se comió el archivo');
  // El tope es el de la ruta.
  assert.match(fuente('app/api/chat-agent/secuencias/ia/route.ts'), /body\.pedido\.trim\(\)\.slice\(0, 2000\)/);
  assert.equal(TOPE_PEDIDO_MAKO, 2_000);
});

// ── 8. El token ──────────────────────────────────────────────────────────────────────────────────

test('punto 8: el token: formato, en una frase, en minúsculas, y nada que se le parezca', () => {
  const t = tokenDeBytes([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 99]);
  assert.equal(t, 'MAKO-FLUJO-0123456789');
  assert.equal(tokenDeBytes([31, 32, 255, 18, 21, 24, 27, 10, 17, 30]), 'MAKO-FLUJO-Z0ZJNRVAHY', 'el & 31 o el alfabeto de Crockford');
  assert.throws(() => tokenDeBytes([1, 2, 3]));
  assert.equal(t.length, PREFIJO_TOKEN.length + LARGO_TOKEN);
  // El formato es el del check de la migración.
  const mig = leer('supabase/migrations/0265_flujo_copias.sql');
  const re = /check \(token ~ '(\^MAKO-FLUJO-\[0-9A-HJKMNP-TV-Z\]\{10\}\$)'\)/.exec(mig);
  assert.ok(re, 'la migración no valida el formato');
  assert.match(t, new RegExp(re![1]));
  assert.match(tokenDeBytes([255, 254, 253, 252, 251, 250, 249, 248, 247, 246]), new RegExp(re![1]));
  // En una frase, en minúsculas: sale normalizado.
  assert.equal(tokenDeTexto('Te paso el flujo: mako-flujo-z0zjmqv7hy, pégalo'), 'MAKO-FLUJO-Z0ZJMQV7HY');
  assert.equal(tokenDeTexto('MAKO-FLUJO-Z0ZJMQV7H'), null, 'nueve letras');
  assert.equal(tokenDeTexto('MAKO-FLUJO-Z0ZJMQV7HYY'), null, 'once letras');
  assert.equal(tokenDeTexto('MAKO-FLUJO-Z0ZJMQV7HI'), null, 'una I (no está en Crockford)');
  assert.equal(tokenDeTexto(42), null);
});

const COPIA = copiaDeFlujo({
  nombre: 'Bienvenida', pasos: [{ id: 'a', canal: 'whatsapp', delay_horas: 0, cuerpo: 'Hola' }] as unknown as PasoCopiado[],
});

test('punto 8: lo pegado en la caja: el token sale del texto; el texto entero de antes se sigue leyendo', () => {
  assert.deepEqual(copiaPegada('Usa este MAKO-FLUJO-0123456789 por favor'), { copia: 'MAKO-FLUJO-0123456789', resto: 'Usa este por favor' });
  assert.deepEqual(copiaPegada('MAKO-FLUJO-0123456789'), { copia: 'MAKO-FLUJO-0123456789', resto: '' });
  const entera = textoDeCopia(COPIA);
  assert.deepEqual(copiaPegada(entera), { copia: entera, resto: '' });
  assert.equal(copiaPegada('Confirmar la reunión un día antes'), null);
  assert.deepEqual(resumenDeCopia(COPIA), { nombre: 'Bienvenida', que: 'flujo', tarjetas: 1 });
  assert.equal(rotuloFlujoPegado('Bienvenida'), 'Flujo copiado: Bienvenida');
  // El chip que se ve EN LUGAR del campo.
  const chip = renderToStaticMarkup(createElement(ChipCaja, { icono: 'flujo', texto: rotuloFlujoPegado('Bienvenida'), onQuitar: () => {}, etiquetaQuitar: 'Quitar el flujo' }));
  assert.match(chip, /<span class="gp-cc-chip-texto">Flujo copiado: Bienvenida<\/span>/);
  assert.match(chip, /aria-label="Quitar el flujo"/);
  assert.match(CHAT, /const pegado = onFlujo \? copiaPegada\(v\) : null;\s*if \(pegado\) \{ setTexto\(pegado\.resto\); ponerFlujo\(pegado\.copia\); return; \}/);
  assert.match(CHAT, /enLugarDelCampo=\{flujo \? \(\s*<ChipCaja icono="flujo" texto=\{rotuloFlujoPegado\(flujo\.nombre \?\? '…'\)\}/);
  assert.match(CHAT, /if \(flujo\) \{ onFlujo\?\.\(flujo\.copia\); return; \}/);
});

test('punto 8: copiar guarda la copia y copia el token; sin la tabla, el texto entero; pegar lo resuelve el server', () => {
  // La lista copia por el server (y el portapapeles toma el permiso en el clic).
  const lista = fuente('app/automations/SimuladorWhatsApp.tsx');
  assert.match(lista, /await copiarAlPortapapeles\(textoParaCopiar\(copia, j\.id\)\);/);
  const cliente = fuente('app/automations/copia-flujo-cliente.ts');
  assert.match(cliente, /body: JSON\.stringify\(\{ action: 'copiar_flujo', copia: textoDeCopia\(copia\),/);
  assert.match(cliente, /return textoDeCopia\(copia\);\n\}/, 'sin token no cae al texto entero');
  // La ruta: copiar, leer, crear y limpiar aceptan el token; sin la tabla, 503 diciendo cuál falta.
  const ruta = fuente('app/api/chat-agent/secuencias/route.ts');
  assert.match(ruta, /if \(body\.action === 'copiar_flujo'\) \{/);
  assert.match(ruta, /copia = await resolverCopia\(body\.copia\);/);
  assert.equal((ruta.match(/if \(e instanceof FaltaTablaCopiasError\) return Response\.json\(\{ ok: false, falta: 'flujo_copias', error: e\.message \}, \{ status: 503 \}\);/g) ?? []).length, 2);
  assert.match(ruta, /if \(body\.action === 'limpiar_copia'\) return Response\.json\(\{ ok: true, pasos: await limpiarCopia\(copia\), copia \}\);/);
  // El server: la tabla con el cliente crudo (es de TODOS los negocios), y «falta la tabla» es PGRST205 / 42P01.
  const negocio = fuente('lib/flujo-copia-negocio.ts');
  assert.match(negocio, /e\.code === 'PGRST205' \|\| e\.code === '42P01'/);
  assert.match(negocio, /getSupabaseServer\(\)\.from\(TABLA_COPIAS\)\.select\('copia'\)\.eq\('token', t\)\.maybeSingle\(\)/);
  assert.match(negocio, /return c \? leerCopia\(JSON\.stringify\(c\)\) : null;/, 'lo guardado no pasa por la misma vara');
  // Ctrl+V en un lienzo también entiende el token.
  assert.match(LIENZO_FLUJO, /const token = copia \? null : tokenDeTexto\(texto\);/);
  assert.match(LIENZO_FLUJO, /body: JSON\.stringify\(\{ action: 'limpiar_copia', copia: token \?\? texto \}\)/);
  // La galería y el aviso al entrar dicen el nombre del token.
  assert.match(fuente('app/automations/GaleriaPlantillas.tsx'), /const r = await resumenDePegado\(t\);/);
  assert.match(fuente('app/automations/ChatAgentApp.tsx'), /const r = await resumenDePegado\(t\);\s*if \(r\?\.que === 'flujo'\) setOfrecerCopia/);
  // La copia de verdad se sigue leyendo entera (las que circulan).
  assert.ok(leerCopia(textoDeCopia(COPIA)));
});

test('punto 8: la migración 0265: el orden de despliegue, sin `workspace_id` (es de todos), RLS y revoke', () => {
  const ruta = 'supabase/migrations/0265_flujo_copias.sql';
  assert.ok(existsSync(new URL(`../${ruta}`, import.meta.url)));
  const sql = leer(ruta);
  assert.match(sql, /⚠️ ORDEN DE DESPLIEGUE:/);
  assert.match(sql, /create table if not exists flujo_copias \(/);
  assert.match(sql, /workspace_origen\s+bigint not null references workspaces\(id\) on delete cascade/);
  assert.doesNotMatch(sql.replace(/^--.*$/gm, ''), /workspace_id/, 'con `workspace_id` la acotaría getTenantDb y el token no se leería en otro negocio');
  assert.match(sql, /alter table flujo_copias enable row level security;/);
  assert.match(sql, /revoke all on flujo_copias from anon, authenticated;/);
  assert.doesNotMatch(leer('lib/workspace.ts'), /'flujo_copias'/, 'en TENANT_TABLES el token sólo se lee en el negocio que copió');
});

// ── El texto de pantalla: corto y en tú ──────────────────────────────────────────────────────────

test('los textos nuevos, en tú neutro y cortos', () => {
  const textos = [
    TITULO_CAJA, NO_ES_FLUJO, SIN_FLUJO_COPIADO, PEGALO_A_MANO, PLACEHOLDER_ARCHIVO, PEDIDO_SOLO_ARCHIVO,
    rotuloFlujoPegado('X'), ...accionesMas(true).map((o) => o.label),
  ];
  for (const t of textos) {
    assert.deepEqual(marcasDeVoseo(t), [], t);
    assert.ok(t.length <= 60, `«${t}» es largo para la pantalla`);
  }
});

// ── ROTURAS (12/10/2026) ──────────────────────────────────────────────────────────────────────────
// Una por vez, con scratchpad/agente-15/romper.mjs (guarda el original, rompe, corre ESTE archivo y restaura comprobando
// el sha1; nunca git). Base: 13 pass / 0 fail.
//   R1.  la caja sin el título                                              → 12 / 1 (punto 1)
//   R2.  la burbuja de texto del editor social vuelve al 78%                → 12 / 1 (punto 2)
//   R3.  el botón de MaKo vuelve a la chispa con el punto arriba            → 12 / 1 (punto 3)
//   R4.  el ＋ de una salida vuelve a abrir el modal de conectar al crear    → 12 / 1 (punto 4)
//   R5.  el lienzo vuelve a sumar «Centrar» al click derecho                → 12 / 1 (punto 5)
//   R6.  el ejemplo ignora el foco (se mueve mientras se escribe)           → 12 / 1 (punto 6)
//   R7.  el pedido con un archivo sin el tope de MaKo                       → 12 / 1 (punto 7, el pedido)
//   R8.  el token en minúsculas no se normaliza                             → 12 / 1 (punto 8, el token)
//   R9.  `limpiar_copia` no devuelve la copia (Ctrl+V de un token, roto)    → 12 / 1 (punto 8, el server)
//   R10. el token no sale de lo escrito en la caja                          → 12 / 1 (punto 8, la caja)
// Restaurado: 13 / 0.
