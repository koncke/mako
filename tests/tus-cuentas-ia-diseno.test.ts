// =============================================================================
// «Tus cuentas de IA», más corto (24/10/2026)
// =============================================================================
// Martín (por el Cerebro): «mejora el diseño del modal de "Tus cuentas de IA", esta bastante feo, mucha información, mucho
// scroll...». El Cerebro: no diseñarlo de cero, copiar la ESTRUCTURA de una app de referencia. Sin sesión abierta en ninguna, se
// copió de su AYUDA PÚBLICA, no de las apps: «Usage limit best practices» (support.claude.com: una barra por ventana con su
// reinicio), «Ver dispositivos con acceso a la cuenta» (support.google.com: cada dispositivo con nombre, lugar y estado, y al
// tocarlo, «Salir») y «Manage and optimize usage» (vercel.com/docs: lo consumido por recurso, el detalle aparte). Lo que es
// nuestro: el renglón único (sobre lo que el Uso ya copiaba el 16/10) y que la fila se abra en el lugar.
// Medido con las piezas reales en un Edge sin ventana (4 cuentas de Claude Code, 1 dispositivo y la API): de 2.155 px a 1.258 px.
// Lo que fija este test:
//   1. «Nueva cuenta» sigue ARRIBA (Martín, 23/10) pero en una fila; las tarjetas grandes, sólo sin nada conectado;
//   2. cada dispositivo es una fila que se abre: a la vista nombre, estado y lugar; «Conectada el» y «Desconectar» adentro; lo
//      que hace contestar a una sin cuenta («Iniciar sesión en Claude»), afuera, a la vista;
//   3. «Nuevo dispositivo», una fila que abre el tutorial en la descarga; la descarga, sólo en el cartel del chat sin la app
//      (app/_chat/AppPrimero.tsx, en el lugar de la caja: tests/app-de-escritorio-primero.test.ts);
//   4. cada ventana en una fila (la de claude.ai) SIN cambiar el orden del marcado, y «Medido hace X» arriba a la derecha;
//   5. la API plegada con su total a la vista; el interruptor del crédito de un negocio, el aviso de las claves y lo que avisa de
//      un plan («sin crédito», al 90%), afuera;
//   6. en el modal, sin tarjeta dentro de tarjeta ni doble separación.
// El orden del texto de cada tarjeta del Uso (nombre, plan, Runner, ventanas, «Medido hace X») lo siguen fijando
// tests/centro-uso.test.ts y tests/centro-uso-ultimo.test.ts: el marcado es el mismo, lo acomoda el CSS.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { agruparPorCuenta } from '../lib/ia-pc-reglas';
import { Barra, CuentasYDispositivos, DescargarMaKo, NuevoDispositivo, avisoAlAbrir } from '../app/integraciones/CuentasYDispositivos';
import { VistaCredito } from '../app/admin/operaciones/UsoCredito';
import type { LecturaCredito } from '../lib/credito-api';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const AHORA = Date.parse('2026-10-24T15:00:00Z');
const H = 3_600_000;

test('1. «Nueva cuenta» arriba, en una fila; las tarjetas grandes, sólo sin nada conectado (y ya leído)', () => {
  const ui = sinComentarios(leer('app/integraciones/TusCuentasIA.tsx'));
  assert.match(ui, /const vacia = !!estado && !grupos\.cuentas\.length && !grupos\.sinCuenta\.length;/, 'grande sólo con el estado leído y nada conectado');
  assert.match(ui, /className=\{`tci-bloque tci-bloque--nueva\$\{vacia \? '' : ' tci-bloque--nueva-fila'\}`\}/);
  assert.match(ui, /<div className=\{vacia \? 'tci-grandes' : 'tci-chicas'\}>/);
  const nueva = ui.indexOf('<NuevaCuenta onElegir={setEligiendo} vacia={vacia} />');
  assert.ok(nueva > 0 && nueva < ui.indexOf('<CuentasYDispositivos grupos={grupos}'), 'sigue arriba (Martín, 23/10/2026)');
  const css = leer('app/integraciones/tus-cuentas-ia.css');
  assert.match(css, /\.tci-bloque--nueva-fila \{ flex-direction: row;/, 'en una fila');
  assert.match(css, /\.tci-chica \{ display: inline-flex;[^}]*min-height: 32px;/);
  assert.match(css, /@media \(pointer: coarse\) \{\n\s*\.tci-boton, \.tci-opcion, \.tci-chica,/, 'en el teléfono, del tamaño de un dedo');
});

test('2. cada dispositivo, una fila que se abre: «Desconectar» adentro; «Iniciar sesión en Claude», a la vista', () => {
  const grupos = agruparPorCuenta([
    { id: 1, nombre: 'MSI', esMia: true, enLinea: true, ultimoLatido: new Date(AHORA - 20_000).toISOString(), version: '0.4.2+windows', sistema: 'Windows', ubicacion: 'Grandbourg, Buenos Aires, Argentina', conectadaAt: '2026-10-22T12:00:00Z', cuentas: [{ proveedor: 'claude', email: 'mauricio@gmail.com', plan: 'max', usado5h: 30, usadoSemana: 12 }] },
    { id: 3, nombre: 'Notebook', esMia: true, enLinea: true, ultimoLatido: new Date(AHORA - 20_000).toISOString(), version: '0.4.2+windows', sistema: 'Windows', ubicacion: null, conectadaAt: '2026-10-23T12:00:00Z', cuentas: [] },
  ], () => true);
  const html = renderToStaticMarkup(createElement(CuentasYDispositivos, {
    grupos, ahora: AHORA, onDesconectar: () => {},
    extraSinCuenta: () => createElement('a', { className: 'tci-boton tci-boton--suave', href: 'mako://iniciar-sesion' }, 'Iniciar sesión en Claude'),
  }));
  const filas = html.split('<li class="tci-disp"').slice(1);
  assert.equal(filas.length, 2);
  for (const f of filas) {
    assert.match(f, /^ data-dispositivo="\d+"><details class="tci-disp__pliegue"><summary class="tci-disp__resumen">/, 'la fila entera es lo que se toca');
    const [resumen, resto] = f.split('</summary>');
    assert.doesNotMatch(resumen, /Desconectar|Conectada el/, 'a la vista sólo nombre, estado y lugar');
    const [detalle, afuera] = resto.split('</details>');
    assert.match(detalle, /Conectada el .*>Desconectar<\/button>/, 'cuándo se conectó y «Desconectar», en el detalle');
    if (f.includes('Notebook')) assert.match(afuera, /Iniciar sesión en Claude/, 'lo que la hace contestar, fuera del pliegue');
  }
  assert.match(filas[0], /<span class="tci-disp__nombre">MSI<\/span>.*En línea.*<span class="tci-nota tci-disp__donde">Windows · Grandbourg, Buenos Aires, Argentina<\/span><span class="tci-flecha" aria-hidden="true"><\/span><\/span><\/summary>/);
  // La grilla y la flecha van en un <span> de adentro, nunca en el <summary>: WebKit ≤ 16 no lo deja ser grilla (WebKit 167111).
  for (const css of [leer('app/integraciones/tus-cuentas-ia.css'), leer('app/admin/operaciones/centro.css')].map((c) => c.replace(/\/\*[\s\S]*?\*\//g, ''))) {
    assert.doesNotMatch(css, /summary[^{,]*\{[^}]*display: (grid|flex)/, 'un <summary> con grilla');
    assert.doesNotMatch(css, /summary[^{,]*::after/, 'la flecha como ::after del <summary>');
  }
  // Sin nada que mostrar adentro (ni fecha ni «Desconectar»), no hay pliegue: una fila quieta.
  const quieta = renderToStaticMarkup(createElement(CuentasYDispositivos, { grupos: agruparPorCuenta([{ ...grupos.cuentas[0].dispositivos[0], cuentas: [{ proveedor: 'claude', email: 'x@y.com' }], conectadaAt: null } as never], () => true), ahora: AHORA }));
  assert.doesNotMatch(quieta, /<details|<summary/);
  assert.match(quieta, /<div class="tci-disp__resumen"><span class="tci-disp__caja">/);
  assert.doesNotMatch(quieta, /tci-flecha/, 'sin pliegue, sin flecha');
  // Adentro de <summary>, sólo texto en línea.
  assert.doesNotMatch(html.match(/<summary[\s\S]*?<\/summary>/g)!.join(''), /<(p|div|h\d)\b/);
  // Al cerrarlo, la pregunta «¿Desconectarla?» no queda armada para la próxima vez.
  const fila = sinComentarios(leer('app/integraciones/CuentasYDispositivos.tsx'));
  assert.match(fila, /onToggle=\{\(e\) => \{ if \(!e\.currentTarget\.open\) setSeguro\(false\); \}\}/);
  // El foco no se pierde: al preguntar va a «Cancelar»; al cancelar (o si falla), vuelve a «Desconectar» (revisión del 24/10).
  assert.match(fila, /if \(seguro\) cancelar\.current\?\.focus\(\);\n\s*else if \(volverAlBoton\.current\) \{ volverAlBoton\.current = false; pedir\.current\?\.focus\(\); \}/);
  assert.match(fila, /<button ref=\{cancelar\} [^>]*onClick=\{noPreguntar\}>Cancelar<\/button>/);
  assert.match(fila, /<button ref=\{pedir\} [^>]*onClick=\{\(\) => setSeguro\(true\)\}>Desconectar<\/button>/);
  assert.match(fila, /finally \{ setOcupado\(false\); noPreguntar\(\); \}/);
});

test('3. «Nuevo dispositivo», una fila que abre el tutorial; la descarga, sólo en el cartel del chat sin la app', () => {
  // 24/10/2026 (Martín: «diseña bien ese cartel, no el botón feo que está al final del modal que no lo ve nadie»; el Cerebro: «el
  // botón del final del modal se va»): la fila punteada, sin botones ni avisos; la descarga vive en AppPrimero.tsx.
  const html = renderToStaticMarkup(createElement(NuevoDispositivo, { onAbrir: () => {} }));
  assert.equal(html, '<button type="button" class="tci-nuevo-fila"><span class="tci-nuevo-fila__mas" aria-hidden="true">+</span><span class="tci-nuevo-fila__titulo">Nuevo dispositivo</span><span class="tci-nota">Otra computadora con esta misma cuenta</span></button>');
  assert.match(sinComentarios(leer('app/integraciones/TusCuentasIA.tsx')), /nuevoDispositivo=\{\(c\) => <NuevoDispositivo onAbrir=\{\(\) => abrirTutorialEn\(2, c\.proveedor\)\} \/>\}/, 'abre el tutorial en la descarga, con la IA de esa cuenta');
  const css = leer('app/integraciones/tus-cuentas-ia.css');
  assert.match(css, /\.tci-nuevo-fila \{ display: flex;[^}]*border: 1px dashed var\(--border-strong\);/, 'punteada: no se confunde con «Nueva cuenta»');
  assert.doesNotMatch(css, /\.tci-nuevo-disp|\.tci-pie/, 'sin el recuadro viejo');
  // La descarga (con la detección del sistema) es una pieza que el cartel monta: el instalador del sistema de esta computadora.
  const descarga = renderToStaticMarkup(createElement(DescargarMaKo, { className: 'x' }));
  // Desde el 24/10/2026 con su `title` (el botón «Instalar MaKo» de la caja dice corto y el `title`, el sistema).
  assert.equal(descarga, '<a class="x" href="/api/ia-pc/descargar?os=windows" title="Descargar MaKo para Windows">Descargar MaKo para Windows</a>', 'sin navegador, Windows');
  assert.match(avisoAlAbrir(), /^Si Windows dice «protegió su PC»/);
});

test('4. cada ventana en una fila, como claude.ai › Uso, sin cambiar el orden del marcado; «Medido hace X» arriba a la derecha', () => {
  // El marcado: nombre, %, barra, cuándo se reinicia (así lo lee un lector de pantalla y así lo leen los tests del Uso).
  const h = renderToStaticMarkup(createElement(Barra, { titulo: 'Semana', pct: 47, repone: new Date(AHORA + 30 * H).toISOString(), ahora: AHORA }));
  const orden = ['tci-nombre">Semana', 'tci-pct">47% usado', 'class="tci-barra"', 'Se reinicia'].map((x) => h.indexOf(x));
  assert.ok(orden.every((i, k) => i >= 0 && (k === 0 || i > orden[k - 1])), `el orden del marcado cambió: ${orden}`);
  // La fila la arma la grilla: nombre | barra | %, y abajo lo que dice cuándo se reinicia; en el teléfono, apilado.
  const tci = leer('app/integraciones/tus-cuentas-ia.css');
  assert.match(tci, /\.tci-ventana \{ display: grid; grid-template-columns: minmax\(0, 9\.5rem\) minmax\(48px, 1fr\) minmax\(6\.5rem, auto\); grid-template-areas: "nombre barra pct";/, 'con un mínimo en el %, las barras terminan alineadas');
  assert.match(tci, /\.tci-ventana > \.tci-fila \{ display: contents; \}/);
  assert.match(tci, /\.tci-ventana > \.tci-nota \{ grid-column: 1 \/ -1;/);
  const telefono = tci.slice(tci.indexOf('@media (max-width: 560px) {'), tci.indexOf('\n}', tci.indexOf('@media (max-width: 560px) {')));
  assert.match(telefono, /\.tci-ventana \{ grid-template-columns: minmax\(0, 1fr\) auto; grid-template-areas: "nombre pct" "barra barra";/, 'en el teléfono, apilado');
  const co = leer('app/admin/operaciones/centro.css');
  assert.match(co, /\.co-uso__ventana, \.co-uso__credito\.co-uso__credito--barra \{ display: grid; grid-template-columns: minmax\(0, 9\.5rem\) minmax\(48px, 1fr\) minmax\(6\.5rem, auto\); grid-template-areas: "nombre barra pct";/);
  assert.match(co, /\.co-uso__ventana > \.co-uso__fila, \.co-uso__credito--barra > \.co-uso__fila \{ display: contents; \}/);
  assert.match(co, /\.co-uso__ventana, \.co-uso__credito\.co-uso__credito--barra \{ grid-template-columns: minmax\(0, 1fr\) auto; grid-template-areas: "nombre pct" "barra barra";/, 'en el teléfono, apilado');
  // Las cuentas del Uso: una lista agrupada, y «Medido hace X» debajo del Runner (antes, un renglón suelto al final).
  assert.match(co, /\.co-uso__lista \{ display: flex; flex-direction: column; border: 1px solid var\(--border\);/);
  assert.match(co, /\.co-uso__cuenta \{ padding: 12px 14px; display: grid;/);
  assert.match(co, /\.co-uso__cuenta > \.co-uso__fila \{ display: contents; \}/);
  assert.match(co, /\.co-uso__cuenta > \.co-uso__medido \{ grid-column: 2; grid-row: 2;/);
  // La grilla va con la clase doble: con `.co-uso__credito--barra` sola empata con `.co-uso__credito { display: flex }`, que está
  // más abajo en el archivo, y gana ésa (pasó: la fila del crédito quedaba apilada).
  assert.doesNotMatch(co, /^\.co-uso__ventana, \.co-uso__credito--barra \{ display: grid/m);
});

test('5. la API plegada con su total a la vista; el interruptor y el aviso de las claves, afuera', () => {
  const fila = (cuenta: string, o: Record<string, unknown>) => ({ cuenta, vinculada: true, desde: null, renueva: null, gastadoUsd: 0.25, llamadas: 1, delNegocio: [], sinCreditoAt: null, vinculableDesde: null, ...o });
  const lectura = {
    ok: true,
    filas: [fila('claude1', {}), fila('claude2', { gastadoUsd: 0.1 }), fila('claude3', { vinculada: false, gastadoUsd: null }), fila('claude4', { vinculada: false, gastadoUsd: null })],
    total: { gastadoUsd: 0.35, vinculadas: 2, rindeUsd: 400, totalUsd: 800 },
    negociosSinLeer: true,
    asignados: [{ ws: 1, quien: 'Mauricio (ws1)', cuenta: 'claude1', prendido: true, gastadoUsd: 1.5, llamadas: 30 }],
  } as unknown as Extract<LecturaCredito, { ok: true }>;
  const html = renderToStaticMarkup(createElement(VistaCredito, { lectura, cuentas: [], onCambiar: () => {} }));
  assert.match(html, /<details class="co-uso__pliegue"><summary class="co-uso__api-cab"><span class="co-uso__api-caja"><span class="co-uso__fila"><span class="co-uso__titulo">API<\/span><span class="co-uso__pct">US\$0,35 de US\$800 este mes<\/span><\/span><span class="co-uso__reinicio">2 de 4 vinculadas: hoy rinden US\$400<\/span><span class="co-uso__flecha" aria-hidden="true"><\/span><\/span><\/summary>/, 'a la vista, el total y cuántas faltan');
  const [adentro, afuera] = html.split('</details>');
  assert.equal((adentro.match(/class="co-uso__credito/g) ?? []).length, 4, 'cada plan, al abrirla');
  assert.equal((adentro.match(/co-uso__credito--barra/g) ?? []).length, 2, 'las vinculadas, con su barra en una fila');
  assert.match(adentro, /El saldo real, en platform\.claude\.com → Billing/);
  assert.match(afuera, /role="switch" aria-checked="true"/, 'el interruptor que pidió Martín, a la mano');
  assert.match(afuera, /No pude leer las claves de los negocios/, 'el total está incompleto: se dice a la vista');
  assert.doesNotMatch(html, /<details[^>]* open/, 'cerrada al abrir el modal');
  assert.doesNotMatch(afuera, /data-alerta-credito/, 'sin nada que avisar, ninguna alerta');
  // LO QUE AVISA NO SE PLIEGA (revisión del 24/10): un plan sin crédito o al 90% deja su línea afuera; un total sano no lo dice.
  const conAlertas = { ...lectura, filas: [fila('claude1', { gastadoUsd: 190 }), fila('claude2', { sinCreditoAt: '2026-10-20T15:00:00Z' }), ...lectura.filas.slice(2)] } as unknown as LecturaCredito;
  const [, fuera] = renderToStaticMarkup(createElement(VistaCredito, { lectura: conAlertas, cuentas: [] })).split('</details>');
  assert.match(fuera, /<p class="co-uso__hacer" data-alerta-credito="">[^<]*: lleva US\$190 de US\$200<\/p>/, 'el plan al 90%, a la vista');
  assert.match(fuera, /<p class="co-uso__hacer" data-alerta-credito="">[^<]*: Anthropic dijo «sin crédito» el 20\/10<\/p>/, '«sin crédito», a la vista');
});

test('6. en el modal: sin tarjeta dentro de tarjeta ni doble separación', () => {
  const ui = sinComentarios(leer('app/integraciones/TusCuentasIA.tsx'));
  assert.match(ui, /<section className=\{`tci\$\{sinCabecera \? ' tci--suelta' : ''\}`\} aria-labelledby="tci-titulo">/);
  assert.match(leer('app/integraciones/tus-cuentas-ia.css'), /\.tci--suelta \{ margin: 0; padding: 0; border: 0; border-radius: 0; background: none; \}/);
  // Lo del super admin: el modal ya separa a cada hijo (app/_ui/ui.css, `.mk-modal__cuerpo > *`): sin margen ni raya propios.
  const co = leer('app/admin/operaciones/centro.css');
  assert.match(co, /\.co-uso__mas \{ display: flex; flex-direction: column; gap: 10px; \}/);
  assert.match(leer('app/_ui/ui.css'), /\.mk-modal__cuerpo > \*:not\(\.mk-modal__fondo\) \+ \*:not\(\.mk-modal__fondo\) \{ border-top: 1px solid var\(--border\); \}/);
});
