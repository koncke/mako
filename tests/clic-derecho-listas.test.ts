// =============================================================================
// El clic derecho (y mantener presionado) en las listas de la app (Leandro, ws10, 24/10/2026, f26)
// =============================================================================
// Textual: «Tengo que implementar el click derecho en toda la app, o sea, el click derecho casi que en toda la app se
// tiene que poder usar». El CRM y el Classroom ya lo tenían; el 27/10/2026 se sumó a las listas de Chats, Customers,
// Offer («Tu oferta»), Integraciones, Partners (la tabla del programa y el Agency Dashboard), Automations y Web Generator
// (el Panel), todas con la MISMA pieza: app/_ui/useMenuContextual.ts (cuándo y dónde abre, con el dedo también) y
// app/_ui/MenuContextual.tsx (cómo se dibuja). Lo que ofrece cada una sale de su función pura (app/<tab>/menu-contextual-*.ts,
// o `opcionesDeFila` en Automations) y es LO MISMO que su «⋯» o, sin «⋯», lo que el elemento ya hace.
//
// Este archivo recorre las listas: (1) la pieza y el dedo, (2) cada lista ofrece lo de su «⋯» y cada opción hace lo que
// hace el «⋯», y (3) cada pantalla la monta (fila con `propsDe`, el menú con `porDedo`, ningún `onContextMenu` a mano).
//
// Correr: node --import tsx --test tests/clic-derecho-listas.test.ts
// PROBADO ROMPIÉNDOLO (27/10/2026): 30 roturas, de a una y restaurando de la copia en memoria. Base 12/0; cada rotura dio
// 11/1 (la última, 10/2) y ninguna pasó en verde. Cuáles, en el comentario de cada test.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ListaMenuContextual, type EntradaMenuContextual, type ItemMenuContextual } from '../app/_ui/MenuContextual';
import { MANTENER_MS, NO_ABRE_EN, TOLERANCIA_PX, dondeAbre, seCorrio } from '../app/_ui/useMenuContextual';
import { accionDeMenuChat, itemsFilaChat } from '../app/chats/menu-contextual-chats';
import { destinoCliente, itemsCliente } from '../app/customers/menu-contextual-customers';
import { itemsTuOferta } from '../app/offer/menu-contextual-offer';
import { itemsIntegracion } from '../app/integraciones/menu-contextual-integraciones';
import { itemsPartnerPrograma } from '../app/partners/menu-contextual-partners';
import { ROTULO_ACCION_CUENTA, accionDeCuenta, itemsCuentaAgency } from '../app/agency/menu-contextual-agency';
import { itemsFilaAutomatizacion } from '../app/automations/menu-contextual-automations';
import { opcionesDeFila } from '../app/automations/SimuladorWhatsApp';
import { itemsRenglonLanding } from '../app/web-generator/menu-contextual-landings';
import type { FilaPanel } from '../app/web-generator/panel-reglas';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
/** Sin comentarios: la casa explica en el comentario lo que la línea hace, y un guard que no los saca se contesta solo. */
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
/** El trozo entre dos marcas (la primera aparición de cada una después de la anterior). */
const entre = (src: string, desde: string, hasta: string) => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré «${hasta}» después de «${desde}»`);
  return src.slice(i, j);
};
/** Los renglones con rótulo (los de los submenús también), sin separadores. */
const renglones = (xs: ReadonlyArray<EntradaMenuContextual>): ItemMenuContextual[] =>
  xs.flatMap((x) => (x ? [x, ...(x.hijos ?? [])] : []));
const rotulos = (xs: ReadonlyArray<EntradaMenuContextual>) => renglones(xs).map((x) => x.label);
const ids = (xs: ReadonlyArray<EntradaMenuContextual>) => xs.filter((x): x is ItemMenuContextual => !!x).map((x) => x.id);
const dibujar = (items: ReadonlyArray<EntradaMenuContextual>) =>
  renderToStaticMarkup(createElement(ListaMenuContextual, { items, onElegir: () => {} }));

// ── 1. La pieza: cuándo abre, dónde, y el dedo ────────────────────────────────────────────────────────────────

// Roturas: `dondeAbre` sin la rama `tragado` → 1 fallo. Sin la rama `dedo` (abre en el cursor) → 1 fallo. Sin el borde para
// el teclado (abre en 0,0) → 1 fallo.
test('dónde abre: nada con el eco del dedo, donde está el dedo si Android ganó la carrera, el cursor, o el borde con el teclado', () => {
  const borde = { left: 40, top: 300 };
  assert.equal(dondeAbre({ tragado: true, dedo: null, cursor: { x: 9, y: 9 }, borde }), null, 'el eco de Android no abre otro');
  assert.deepEqual(dondeAbre({ tragado: false, dedo: { x: 120, y: 80 }, cursor: { x: 0, y: 0 }, borde }), { x: 120, y: 80, porDedo: true });
  assert.deepEqual(dondeAbre({ tragado: false, dedo: null, cursor: { x: 500, y: 210 }, borde }), { x: 500, y: 210, porDedo: false });
  assert.deepEqual(dondeAbre({ tragado: false, dedo: null, cursor: { x: 0, y: 0 }, borde }), { x: 52, y: 312, porDedo: false }, 'Mayús+F10 llega sin punto');
  // Un dedo que se corre está scrolleando: el reloj se corta.
  assert.equal(seCorrio(10, 10, 10 + TOLERANCIA_PX, 10), false);
  assert.equal(seCorrio(10, 10, 10, 11 + TOLERANCIA_PX), true);
  // El Ops Center midió que Android dispara su `contextmenu` a los ~450 ms (MensajeWA, LARGO_MS): el reloj va después.
  assert.ok(MANTENER_MS > 450);
});

// Roturas: sin `contains(t)` (el clic derecho de un menú portaleado abre el de la fila) → 1 fallo. Sin la guarda del mouse
// en `onPointerDown` (el clic izquierdo mantenido abre el menú) → 1 fallo. Sin `stopPropagation` en el clic tragado (levantar
// el dedo abre la fila además del menú) → 1 fallo. Sin el `-webkit-touch-callout` de la fila → 1 fallo.
test('el hook: no abre por un portal ni escribiendo, el reloj es sólo del dedo, y el clic de levantar el dedo se traga', () => {
  const src = sinComentarios(leer('app/_ui/useMenuContextual.ts'));
  const toca = entre(src, 'function leToca(', '\n}\n');
  assert.match(toca, /if \(!e\.currentTarget\.contains\(t\)\) return false;/, 'un evento de React sube por los portales');
  assert.match(toca, /if \(t\.closest\(NO_ABRE_EN\)\) return false;/);
  assert.match(toca, /!document\.querySelector\('\[aria-modal="true"\]'\)/, 'con un modal abierto, ninguno');
  for (const s of ['textarea', 'select', '[contenteditable="true"]', 'input:not([type="checkbox"])']) assert.ok(NO_ABRE_EN.includes(s), `escribiendo en ${s}, el del navegador`);
  const abajo = entre(src, 'onPointerDown:', 'onPointerMove:');
  assert.match(abajo, /if \(e\.pointerType === 'mouse' \|\| !leToca\(e\)\) return;/);
  assert.match(abajo, /setTimeout\(\(\) => \{[^}]*abrir\(de, x, y, true\);\s*\}, MANTENER_MS\)/);
  const clic = entre(src, 'onClickCapture:', '\n      },');
  assert.match(clic, /if \(!tragar\.current\) return;/);
  assert.match(clic, /e\.stopPropagation\(\);/);
  assert.match(entre(src, 'onContextMenu:', 'onPointerDown:'), /e\.preventDefault\(\);[\s\S]*dondeAbre\(\{ tragado: tragar\.current, dedo: gesto\.current/);
  // Con el dedo: ni el globo de un link de iOS ni la selección de texto.
  assert.match(leer('app/_ui/ui.css'), /@media \(pointer: coarse\) \{\s*\[data-con-menu\] \{ -webkit-touch-callout: none;/);
});

// Roturas: `otroClicDerecho` sin mirar `dedoListo` (el eco de Android cierra el menú que el dedo acaba de abrir) → 1 fallo.
// Sin `onClickCapture` en el panel (levantar el dedo elige el renglón de debajo) → 1 fallo.
test('MenuContextual abierto por dedo: el eco de Android no lo cierra y el clic de levantar el dedo no elige', () => {
  const src = sinComentarios(leer('app/_ui/MenuContextual.tsx'));
  assert.match(src, /const dedoListo = useRef\(!porDedo\);/);
  assert.match(src, /document\.addEventListener\('pointerdown', listo, true\);/, 'listo recién con OTRO toque');
  assert.match(src, /const otroClicDerecho = \(e: MouseEvent\) => \{ if \(dedoListo\.current && !adentro\(e\.target\)\) onCerrarRef\.current\(\); \};/);
  assert.match(entre(src, 'const frenarClicDelDedo', '};'), /if \(dedoListo\.current \|\| e\.detail === 0\) return;/, 'el teclado (detail 0) sí elige');
  assert.equal((src.match(/onClickCapture=\{frenarClicDelDedo\}/g) ?? []).length, 2, 'en el menú y en su submenú');
});

// ── 2. Cada lista: lo de su «⋯» (o lo que el elemento ya hace), y cada opción hace lo mismo ─────────────────────

// Roturas: Asignar sin lead → 1 fallo. «Agregar al CRM» con lead → 1 fallo. Volver a ofrecer Cerrar → 1 fallo (el cruce). Un
// `alta:` que no lleva el funnel elegido → 1 fallo.
test('Chats: lo del «⋯» de la fila, en el mismo orden, y cada opción manda la MISMA acción', () => {
  const equipo = [{ nombre: 'Ana', foto_url: null }, { nombre: 'MaKo', foto_url: null }];
  const conLead = { leadId: 7, asignado: 'Ana', canales: [] };
  const sinLead = { leadId: null, asignado: null, canales: [{ canal: 'whatsapp', telefono: '1' }] } as never;
  const grupo = { leadId: null, asignado: null, canales: [] };
  const dos = [{ id: 5, nombre: 'Uno' }, { id: 6, nombre: 'Dos' }] as never;
  const items = itemsFilaChat(conLead, equipo, null);
  assert.deepEqual(ids(items), ['abrir', 'ficha', 'asignar']);
  assert.deepEqual(ids(itemsFilaChat(sinLead, equipo, null)), ['abrir', 'alta:'], 'sin lead: agregarlo, sin Asignar');
  assert.deepEqual(ids(itemsFilaChat(sinLead, equipo, dos)), ['abrir', 'agregar'], 'con 2+ funnels: en cuál');
  assert.deepEqual(ids(itemsFilaChat(grupo, equipo, null)), ['abrir'], 'un grupo no ofrece nada del CRM');
  // Los rótulos fijos del «⋯» (sus `label` y los títulos de sus grupos) están TODOS acá, y al revés.
  const mas = sinComentarios(entre(leer('app/chats/ListaChats.tsx'), 'function MasAcciones(', '\n}\n'));
  const delMas = new Set([...mas.matchAll(/(?:label|title): '([^']+)'/g)].map((m) => m[1]).filter(Boolean));
  const todos = new Set([...rotulos(items), ...rotulos(itemsFilaChat(sinLead, equipo, null)), ...rotulos(itemsFilaChat(sinLead, equipo, dos))]);
  for (const r of delMas) assert.ok(todos.has(r), `el «⋯» tiene «${r}» y el clic derecho no`);
  const propios = [...todos].filter((r) => !['Abrir', 'MaKo', 'Ana', 'Uno', 'Dos'].includes(r));
  for (const r of propios) assert.ok(delMas.has(r), `el clic derecho tiene «${r}» y el «⋯» no`);
  // Mismos valores que el «⋯» (`alta:<id>`, `asig:<nombre>`), y las mismas acciones.
  assert.match(mas, /value: `alta:\$\{p\.id\}`/);
  assert.match(mas, /value: `asig:\$\{m\.nombre\}`/);
  assert.deepEqual(accionDeMenuChat('ficha', conLead), { tipo: 'ficha' });
  assert.deepEqual(accionDeMenuChat('alta:', conLead), { tipo: 'agregar', funnelId: null });
  assert.deepEqual(accionDeMenuChat('alta:6', conLead), { tipo: 'agregar', funnelId: 6 });
  assert.deepEqual(accionDeMenuChat('asig:', conLead), { tipo: 'asignar', setter: null });
  assert.equal(accionDeMenuChat('asig:Ana', conLead), null, 'asignar al que ya está no hace nada (como el «⋯»)');
  assert.equal(accionDeMenuChat('abrir', conLead), 'abrir');
  assert.ok(dibujar(items).includes('aria-haspopup="menu"'), 'Asignar es submenú');
});

// Roturas: el menú sin «Abrir» → 1 fallo. «Eliminar» sin rojo → 1 fallo. `opcionesDeFila` con un renglón nuevo que el menú no
// copia (un `.slice(0, -1)` en el map) → 1 fallo.
test('Automations: las opciones del «⋯» son las de `opcionesDeFila`, con «Abrir» arriba y «Eliminar» separado y en rojo', () => {
  const op = opcionesDeFila(true, true);
  const items = itemsFilaAutomatizacion(op, false);
  assert.deepEqual(rotulos(items), ['Abrir', ...op.map((o) => o.label)]);
  assert.equal(items[items.length - 2], null);
  const eliminar = items[items.length - 1];
  assert.ok(eliminar && eliminar.id === 'eliminar' && eliminar.peligro);
  assert.ok(itemsFilaAutomatizacion(op, true).filter((x): x is ItemMenuContextual => !!x && x.id !== 'abrir').every((x) => x.deshabilitado), 'con una acción en vuelo, apagadas (como el «⋯»)');
  assert.match(dibujar(items), /color:var\(--bad\)[^"]*"[^>]*>.*Eliminar/, 'Eliminar en rojo');
  // Cada opción la hace `accionFila`, la MISMA función del «⋯».
  const src = sinComentarios(leer('app/automations/SimuladorWhatsApp.tsx'));
  assert.match(src, /onChange=\{\(v\) => void accionFila\(j, v\)\}/, 'el «⋯»');
  assert.match(src, /onElegir=\{\(id\) => \{ if \(id === 'abrir'\) elegir\(filaDelMenu\.id\); else void accionFila\(filaDelMenu, id\); \}\}/, 'el clic derecho');
  const accion = entre(src, 'const accionFila = async', '\n  };\n');
  for (const o of op) assert.ok(accion.includes(`accion === '${o.value}'`) || accion.includes(`accion !== '${o.value}'`), `accionFila no atiende «${o.label}»`);
  // Sólo donde hay «⋯»: un admin, una fila que no se está creando (ni renombrando).
  assert.match(src, /clicDerecho=\{menuFila\.propsDe\(j\.id, rolAdmin && !creando && renombrando !== j\.id\)\}/);
  assert.match(src, /menu=\{rolAdmin && !creando \? \(/);
});

// Roturas: el menú sin «Copiar enlace público» → 1 fallo. `elegirEnRenglon` con «Duplicar» que no duplica (llama a
// `archivar`) → 1 fallo. El enlace también sin publicar → 1 fallo.
test('Web Generator: cada renglón del «⋯» está en el clic derecho, en el mismo orden, y hace la MISMA llamada', () => {
  const src = sinComentarios(leer('app/web-generator/Inicio.tsx'));
  const mas = entre(src, '<MenuFlotante ancla={menu.ancla}', '</MenuFlotante>');
  const [analizada, doc] = mas.split(') : (');
  /** Los renglones del «⋯»: rótulo y lo que llama (con `mf` → `f`, el nombre del clic derecho). */
  const delMas = (trozo: string) => [...trozo.matchAll(/texto="([^"]+)" onClick=\{\(\) => \{ setMenu\(null\); (.+?); \}\}/g)]
    .map((m) => ({ rotulo: m[1], llama: m[2].replace(/\bmf\b/g, 'f') }));
  const elegir = entre(src, 'const elegirEnRenglon = ', '\n  };\n');
  // Diagnóstico va antes de las dos ramas; después, la de una analizada y la de una landing.
  const iAnalizada = elegir.indexOf("if (f.tipo === 'analizada')");
  const iDoc = elegir.indexOf("if (id === 'abrir')");
  assert.ok(iAnalizada > 0 && iDoc > iAnalizada, 'leí las ramas de elegirEnRenglon');
  const ramaAnalizada = elegir.slice(0, iDoc);
  const ramaDoc = elegir.slice(0, iAnalizada) + elegir.slice(iDoc);
  const docConEnlace = { id: 1, titulo: 'Mi landing', slug: 'mi', publicadoAt: '2026-10-01' } as unknown as Extract<FilaPanel, { doc: unknown }>['doc'];
  const casos: Array<[FilaPanel, string, string]> = [
    [{ tipo: 'analizada', clave: 'a', nombre: 'x.com', url: 'https://x.com' }, analizada, ramaAnalizada],
    [{ tipo: 'landing', clave: 'b', nombre: 'Mi landing', doc: docConEnlace }, doc, ramaDoc],
  ];
  for (const [fila, trozo, rama] of casos) {
    const items = itemsRenglonLanding(fila);
    const esperados = delMas(trozo);
    assert.ok(esperados.length >= 3, `leí el «⋯» de ${fila.tipo}`);
    assert.deepEqual(rotulos(items), esperados.map((e) => e.rotulo), `${fila.tipo}: los mismos renglones, en el mismo orden`);
    for (const e of esperados) {
      const it = renglones(items).find((x) => x.label === e.rotulo);
      assert.ok(it, e.rotulo);
      assert.ok(rama.includes(`id === '${it.id}'`), `«${e.rotulo}» no tiene su rama en elegirEnRenglon`);
      const suRama = rama.slice(rama.indexOf(`id === '${it.id}'`)).split('\n')[0];
      assert.ok(suRama.includes(e.llama), `«${e.rotulo}»: el «⋯» llama ${e.llama} y el clic derecho no`);
    }
    assert.equal(items[items.length - 1]?.peligro, true, 'Eliminar al final, en rojo');
  }
  // El enlace público, con la MISMA condición que el «⋯».
  assert.match(doc, /\{!!mf\.doc\.slug && !!mf\.doc\.publicadoAt && \(/);
  const sinPublicar = { ...docConEnlace, publicadoAt: null };
  assert.ok(!rotulos(itemsRenglonLanding({ tipo: 'landing', clave: 'c', nombre: 'n', doc: sinPublicar })).includes('Copiar enlace público'));
});

// Roturas: `accionDeCuenta` sin mirar quién paga (le ofrece «Pagar su mes» a la que paga su cliente) → 1 fallo. El botón de
// la fila escrito a mano otra vez (sin `accionDeCuenta`) → 1 fallo.
test('Agency Dashboard (Partners): «Abrir» y el botón de la fila, decidido por UNA regla que usan la fila, la ficha y el menú', () => {
  const c = (o: Partial<Parameters<typeof accionDeCuenta>[0]>) => ({ cobro: null, paga: 'agencia', estado: 'aprobado', ...o }) as Parameters<typeof accionDeCuenta>[0];
  assert.equal(accionDeCuenta(c({ cobro: { pagar: 'https://pago' } as never }), false), 'pagar');
  assert.equal(accionDeCuenta(c({ cobro: { pagar: 'https://pago' } as never, paga: 'cliente' }), false), 'inspeccionar', 'lo que paga su cliente lo ve él');
  assert.equal(accionDeCuenta(c({ cobro: { renovacion: { activada: false, link: 'l', desde: null } } as never }), false), 'renovacion');
  assert.equal(accionDeCuenta(c({ estado: 'pendiente' }), false), null);
  assert.equal(accionDeCuenta(c({ estado: 'pendiente' }), true), 'inspeccionar', 'el super admin entra a cualquiera');
  assert.deepEqual(rotulos(itemsCuentaAgency('pagar')), ['Abrir', 'Pagar su mes']);
  assert.deepEqual(rotulos(itemsCuentaAgency(null)), ['Abrir']);
  const src = sinComentarios(leer('app/agency/AgencyApp.tsx'));
  const accionDe = entre(src, 'const accionDe = ', '\n  };\n');
  assert.match(accionDe, /const a = accionDeCuenta\(c, superAdmin\);/);
  assert.match(accionDe, /\{ROTULO_ACCION_CUENTA\[a\]\}/);
  assert.match(accionDe, /onClick=\{\(\) => hacerAccion\(c\)\}/);
  assert.match(src, /items=\{itemsCuentaAgency\(accionDeCuenta\(cuentaDelMenu, superAdmin\)\)\}/);
  assert.match(src, /onElegir=\{\(id\) => \{ if \(id === 'abrir'\) setAbiertaWs\(cuentaDelMenu\.ws\); else hacerAccion\(cuentaDelMenu\); \}\}/);
  assert.deepEqual(Object.values(ROTULO_ACCION_CUENTA), ['Pagar su mes', 'Activar renovación', 'Inspeccionar']);
});

// Roturas: «Marcar pagado» también sin deuda → 1 fallo.
test('Partners (el programa): «Marcar pagado», con la MISMA condición que el botón de la fila, y nada más', () => {
  assert.deepEqual(rotulos(itemsPartnerPrograma({ aCobrarUsd: 150 }, false)), ['Marcar pagado']);
  assert.deepEqual(itemsPartnerPrograma({ aCobrarUsd: 0 }, false), [], 'sin deuda, sin menú');
  assert.equal(itemsPartnerPrograma({ aCobrarUsd: 150 }, true)[0]?.deshabilitado, true, 'apagado mientras se anota');
  const src = sinComentarios(leer('app/partners/ProgramaPartners.tsx'));
  assert.match(src, /\{p\.aCobrarUsd > 0 && \(\s*<button type="button" className="pg-pagar"/, 'el botón de la fila');
  assert.match(src, /onElegir=\{\(id\) => \{ if \(id === 'marcar_pagado'\) void pagar\(delMenu\); \}\}/, 'la MISMA función que el botón');
  assert.match(src, /<tr key=\{p\.ws\} \{\.\.\.menu\.propsDe\(p\.ws, itemsPartnerPrograma\(p, pagando === p\.ws\)\.length > 0\)\}>/);
});

// Roturas: `destinoCliente('administrar')` a otra pestaña → 1 fallo.
test('Customers: lo de la ficha sin abrirla (verla, entrar, administrar), con los MISMOS destinos que sus links', () => {
  assert.deepEqual(rotulos(itemsCliente()), ['Ver ficha', 'Entrar a su cuenta', 'Administrar']);
  assert.equal(destinoCliente('entrar', 12), '/inicio?ws=12');
  assert.equal(destinoCliente('administrar', 12), '/admin?tab=accounts&cuenta=12');
  const src = sinComentarios(leer('app/customers/CustomersApp.tsx'));
  const ficha = entre(src, 'function Ficha(', '\n}\n');
  assert.ok(ficha.includes('href={`/inicio?ws=${f.ws}`}') && ficha.includes('href={`/admin?tab=accounts&cuenta=${f.ws}`}'), 'los links de la ficha');
  assert.equal((src.match(/\{\.\.\.menu\.propsDe\(\{ ws: [af]\.ws, nombre: [af]\.nombre \}\)\}/g) ?? []).length, 2, 'en «Para mirar» y en la lista');
});

// Roturas: el menú de una tarjeta conectada que dice «Conectar» → 1 fallo. «Abrir» que no abre su modal → 1 fallo.
test('Integraciones: la tarjeta abre su modal, como su clic («Conectar» si todavía no está)', () => {
  assert.deepEqual(rotulos(itemsIntegracion(false)), ['Conectar']);
  assert.deepEqual(rotulos(itemsIntegracion(true)), ['Abrir']);
  const src = sinComentarios(leer('app/integraciones/IntegracionesBoard.tsx'));
  assert.match(src, /onClick=\{\(\) => abrirTarjeta\(i\)\} \{\.\.\.menuTarjeta\.propsDe\(\{ key: i\.key, nombre: i\.nombre, conectada \}\)\}/);
  // Lo mismo que el clic: una red social abre Zernio (`abrirTarjeta`), no su tarjeta suelta.
  assert.match(src, /if \(id === 'abrir' && i\) abrirTarjeta\(i\);/);
});

// Roturas: «Armar» sin apagarse mientras MaKo contesta → 1 fallo. El menú del riel con un tercer renglón → 1 fallo.
test('Offer: «Tu oferta» ofrece sus dos botones (el de armar, con su rótulo, y «Ver mi oferta»), y sin ninguno no hay menú', () => {
  const a = { puedeConcluir: true, hayConclusion: true, etiquetaArmar: 'Actualizar el PDF', ocupado: true };
  assert.deepEqual(rotulos(itemsTuOferta(a)), ['Actualizar el PDF', 'Ver mi oferta']);
  assert.equal(itemsTuOferta(a)[0]?.deshabilitado, true, 'como el botón: apagado mientras MaKo contesta');
  assert.deepEqual(itemsTuOferta({ ...a, puedeConcluir: false, hayConclusion: false }), []);
  const src = sinComentarios(leer('app/offer/PiezasRail.tsx'));
  const botones = entre(src, 'function Acciones(', '\n}\n');
  assert.ok(botones.includes('{etiquetaArmar}') && botones.includes('Ver mi oferta'), 'los botones de abajo');
  assert.match(src, /onElegir=\{\(id\) => \{ if \(id === 'armar'\) acciones\.onArmar\(\); else if \(id === 'ver'\) acciones\.onVer\(\); \}\}/);
  assert.equal((src.match(/\{\.\.\.menu\.props\}>/g) ?? []).length, 2, 'en el riel y en la barra del celular');
});

// ── 3. Cada pantalla la monta, con la MISMA pieza ──────────────────────────────────────────────────────────────────

const PANTALLAS = [
  'app/chats/ListaChats.tsx',
  'app/customers/CustomersApp.tsx',
  'app/offer/PiezasRail.tsx',
  'app/integraciones/IntegracionesBoard.tsx',
  'app/partners/ProgramaPartners.tsx',
  'app/agency/AgencyApp.tsx',
  'app/automations/SimuladorWhatsApp.tsx',
  'app/web-generator/Inicio.tsx',
];

// Roturas: una pantalla sin `porDedo` en el menú (mantener presionado lo abre y el eco lo cierra) → 1 fallo. Un
// `onContextMenu` escrito a mano en una fila → 1 fallo. Una pantalla que importa la pieza y no la usa en una fila (la tabla
// de Partners) → 2 fallos (éste y el de Partners).
test('las ocho pantallas: la fila con `propsDe` del hook, el menú de la casa con `porDedo`, y ningún clic derecho a mano', () => {
  for (const r of PANTALLAS) {
    const src = sinComentarios(leer(r));
    assert.match(src, /import \{ useMenuContextual(, type PropsMenuFila)? \} from '@\/app\/_ui\/useMenuContextual';/, `${r}: el hook de la casa`);
    assert.match(src, /import \{ MenuContextual \} from '@\/app\/_ui\/MenuContextual';/, `${r}: la pieza de la casa`);
    assert.match(src, /\.propsDe\(/, `${r}: la fila no lleva el clic derecho`);
    const menus = [...src.matchAll(/<MenuContextual [^>]*?porDedo=\{[a-zA-Z]+\.abierto\.porDedo\}/g)];
    assert.ok(menus.length >= 1, `${r}: el menú sin \`porDedo\` (el eco de Android lo cerraría)`);
    assert.doesNotMatch(src, /onContextMenu=/, `${r}: un clic derecho a mano (va por useMenuContextual)`);
  }
  // En las dos filas que tienen otro componente adentro, la fila entera lleva los props.
  assert.match(sinComentarios(leer('app/chats/ListaChats.tsx')), /<div role="listitem" className="rio-fila" data-sel=\{sel \? 'true' : undefined\} \{\.\.\.conMenu\}>/);
  assert.match(sinComentarios(leer('app/automations/SimuladorWhatsApp.tsx')), /<div className=\{`chb-fila\$\{on \? ' is-on' : ''\}`\} \{\.\.\.clicDerecho\}/);
  assert.match(sinComentarios(leer('app/web-generator/Inicio.tsx')), /\{\.\.\.menuCtx\.propsDe\(f\.clave\)\}>/);
});
