// =============================================================================
// El tablero y el alta del CRM — feedback de Martín del 12/10/2026 (frente B)
// =============================================================================
// Los puntos: 2 (la pestaña dice «MaKo - CRM»), 5 (el teléfono con banderas en todos lados),
// 20 + 27 + 28 (el alta de cuatro campos, sin «Cancelar», que abre la ficha), 21 (el total de
// plata de cada columna) y 22-26 (la barra: sin título, arriba del todo, el funnel primero con su
// cubo; las bandas dentro de «Filtrar» y el «⋯» a la derecha del todo, que viven en
// tests/crm-filtro-ads.test.ts y tests/crm-ficha-y-selector.test.ts).
//
// ⚠️ SE MIRA EL CÓDIGO, NO LA PROSA: los comentarios citan lo que se sacó («Cancelar», las fechas)
// y un guard que lee el archivo entero se acusaría a sí mismo (AGENTS.md).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { totalDeColumna, textoDelTotal, ayudaDelTotal, plataCorta } from '../app/crm/total-columna';
import { numeroTecleado, unirTelefono } from '../lib/paises';
import { tituloDe } from '../lib/titulo-tab';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const codigo = (rel: string) => sinComentarios(leer(rel));

// ── 21 · el total de plata de cada columna ───────────────────────────────────

const t = (o: { monto?: number; ingresoEstimado?: number | null; ventaTipo?: string | null }) =>
  ({ monto: o.monto ?? 0, ingresoEstimado: o.ingresoEstimado ?? null, ventaTipo: o.ventaTipo ?? null });

test('una columna ABIERTA suma el ingreso estimado, con la marca de estimado', () => {
  const r = totalDeColumna('agenda', [t({ ingresoEstimado: 1500 }), t({ ingresoEstimado: null }), t({ ingresoEstimado: 2500 }), t({ ingresoEstimado: -10 })]);
  assert.ok(r);
  assert.equal(r.clase, 'estimado');
  assert.equal(r.valor, 4000);
  assert.equal(r.cuantos, 2);
  assert.equal(r.de, 4);
  assert.equal(textoDelTotal(r), '≈ $4K');
  assert.match(ayudaDelTotal(r), /No es una venta/);
  // La venta de una tarjeta abierta (un monto viejo) NO es un estimado: no suma.
  assert.equal(totalDeColumna('agenda', [t({ monto: 900 })]), null);
});

test('Ganado suma lo VENDIDO: sin los «sin cobro», sin las suscripciones y sin el estimado', () => {
  const r = totalDeColumna('ganado', [
    t({ monto: 1000, ventaTipo: 'unico' }),
    t({ monto: 3000 }),                                  // sin tipo: cuenta como venta, como en Revenue
    t({ monto: 500, ventaTipo: 'sin_cobro' }),           // un becado no es una venta
    t({ monto: 0, ventaTipo: 'suscripcion' }),           // su plata es mensual: no suma acá
    t({ monto: 0, ingresoEstimado: 99999 }),             // el estimado no es lo vendido
  ]);
  assert.ok(r);
  assert.equal(r.clase, 'vendido');
  assert.equal(r.valor, 4000);
  assert.equal(r.cuantos, 2);
  assert.equal(r.suscripciones, 1);
  assert.equal(textoDelTotal(r), '$4K', 'lo vendido va sin «≈»');
  assert.match(ayudaDelTotal(r), /suscripciones \(1\)/);
});

test('las otras terminales no tienen total, y un 0 no se dibuja', () => {
  for (const k of ['perdido', 'descal', 'noresp']) assert.equal(totalDeColumna(k, [t({ monto: 800, ingresoEstimado: 800 })]), null, k);
  assert.equal(totalDeColumna('agenda', []), null);
  assert.equal(totalDeColumna('ganado', [t({ ventaTipo: 'sin_cobro', monto: 300 })]), null);
});

test('la plata va corta, en el formato de las tarjetas', () => {
  assert.equal(plataCorta(850), '$850');
  assert.equal(plataCorta(12_400), '$12.4K');
  assert.equal(plataCorta(1_250_000), '$1.3M');
});

test('el tablero dibuja el total en las columnas y reserva el renglón en todas si alguna tiene plata', () => {
  const b = codigo('app/crm/CrmBoard.tsx');
  // UNA cuenta por columna, sobre lo que la columna muestra (`filtered`, la misma que sus tarjetas).
  assert.match(b, /const totalesCol = new Map\(columnasKanban\.map\(\(c\) => \[c\.key, totalDeColumna\(c\.key, filtered\.filter\(\(l\) => effStage\(l\) === c\.key\)\)\] as const\)\);/);
  assert.match(b, /const hayPlataEnColumnas = \[\.\.\.totalesCol\.values\(\)\]\.some\(\(t\) => t != null\);/);
  // El renglón existe si ALGUNA columna tiene plata; el texto, sólo donde hay.
  assert.match(b, /\{hayPlataEnColumnas && \(\s*<div style=\{\{ minHeight: 16[^}]*\}\}>\s*\{total && \(/);
  assert.match(b, /\{textoDelTotal\(total\)\}/);
  // El contrato con el frente que agrega el dato: `ingresoEstimado` en CrmLead.
  assert.match(b, /ingresoEstimado: number \| null;/);
  //   ROTO A PROPÓSITO (2026-10-12), con el arnés que restaura de memoria, contra una base de 13 / 0:
  //   con Ganado sumando también los «sin cobro» (sin el `cuentaComoVenta`), pass 11 / fail 2 (la de
  //   Ganado y la de las terminales); con las abiertas sumando el `monto` en vez del estimado, 12 / 1;
  //   con `totalesCol` calculado sobre `leads` (sin los filtros), 12 / 1. Restaurado: 13 / 0.
});

// ── 22 · 23 · la barra sube y se va el título ────────────────────────────────

test('sin el título «CRM» con su ícono, y la barra arriba del todo (el esqueleto, igual)', () => {
  const b = codigo('app/crm/CrmBoard.tsx');
  assert.doesNotMatch(b, />CRM<\/h1>/, 'volvió el título');
  assert.doesNotMatch(b, /<Icon name="crm"/, 'volvió el ícono del título');
  assert.match(b, /<main className="crm-hover" style=\{\{ flex: 1, minWidth: 0, padding: '16px 44px 60px'/);
  const l = codigo('app/crm/loading.tsx');
  assert.match(l, /padding: '16px 44px 60px'/, 'el esqueleto tiene otro aire que el tablero: salta al cargar');
  assert.doesNotMatch(l, /<header/, 'el esqueleto todavía dibuja el header que se fue');
});

// ── 2 · la pestaña ───────────────────────────────────────────────────────────

test('la pestaña se reafirma cuando alguien pisa el <title> (el CRM es la única ruta con loading.tsx)', () => {
  const tt = codigo('app/_components/TituloTab.tsx');
  assert.match(tt, /const obs = new MutationObserver\(reafirmar\);/);
  assert.match(tt, /obs\.observe\(document\.head, \{ childList: true, subtree: true, characterData: true \}\);/);
  assert.match(tt, /obs\.disconnect\(\)/, 'el observador no se suelta al cambiar de ruta');
  // `reafirmar` no escribe si ya está bien: sin esto, su propia escritura lo volvería a disparar.
  assert.match(tt, /const reafirmar = \(\) => \{ if \(document\.title !== titulo\) document\.title = titulo; \};/);
  //   ROTO A PROPÓSITO (2026-10-12): sin el `obs.observe(document.head…)`, pass 12 / fail 1.
});

// Revisión del 12/10/2026: `tituloDe('/reportes-')` (un link roto) daba «MaKo - Reportes », y
// `document.title` lo devuelve sin el espacio final: `reafirmar` comparaba distinto SIEMPRE, escribía,
// la escritura volvía a disparar el MutationObserver, y la pestaña se congelaba en vez de mostrar el 404.
// ROTO A PROPÓSITO (12/10/2026), restaurando de memoria, contra 17 / 0 de base: `conMarca` sin
// normalizar los espacios → 16 / 1.
test('el título de la pestaña sale como lo devuelve document.title: si no, el observador reescribe sin fin', () => {
  // Lo que hace el getter de document.title: saca los espacios ASCII de las puntas y junta los repetidos.
  const comoLoLee = (s: string) => s.replace(/[\t\n\f\r ]+/g, ' ').trim();
  for (const ruta of ['/reportes-', '/a--b', '/-', '/crm-', '/crm', '/ads-manager', '/m/hoy', '/login']) {
    const t = tituloDe(ruta);
    assert.equal(comoLoLee(t), t, `${ruta} → «${t}»`);
  }
  assert.equal(tituloDe('/-'), 'MaKo', 'una ruta sin nombre no deja la marca con un guion colgando');
  // TituloTab compara contra `tituloDe` tal cual, sin otra transformación en el medio. (La ruta es
  // la de la URL, o en el teléfono la interna de /m: LAS MISMAS RUTAS, 13/10/2026.)
  assert.match(codigo('app/_components/TituloTab.tsx'), /const titulo = tituloDe\(ruta\);/);
});

// ── 20 · 27 · 28 · el alta ───────────────────────────────────────────────────

test('el alta son CUATRO campos: nombre, email, teléfono con banderas e Instagram', () => {
  const nf = codigo('app/crm/new/NewLeadForm.tsx');
  const nombres = [...nf.matchAll(/name="([a-z_0-9]+)"/g)].map((m) => m[1]);
  assert.deepEqual(nombres, ['nombre', 'email', 'telefono', 'instagram']);
  // Se fueron la empresa y las dos fechas («el resto se puede configurar dentro»).
  assert.doesNotMatch(nf, /fecha_agenda|fecha_junta_1|name="empresa"/);
  // El teléfono con el país primero, y lo que viaja es la lada unida al número.
  assert.match(nf, /<TelefonoConPais lada=\{lada\} numero=\{numero\}/);
  assert.match(nf, /const telefono = numero\.replace\(\/\\D\/g, ''\) \? unirTelefono\(lada, numero\) : '';/);
  // Instagram: el buscador del contrato, y se guarda el USUARIO. Desde el segundo feedback del
  // 12/10 (punto 2) arranca con lo escrito en el borrador (`key` + `textoInicial`).
  assert.match(nf, /<InstagramBuscador key=\{igKey\} textoInicial=\{igInicial\} valor=\{perfil\} onElegir=\{setPerfil\} onTexto=\{setIgEscrito\} \/>/);
  assert.match(nf, /<input type="hidden" name="instagram" value=\{instagramDelAlta\(perfil\?\.usuario, igEscrito\)\} \/>/);
});

// ⚠️ UN @ TIPEADO Y NO ELEGIDO DE LA LISTA SE GUARDA (revisión del 12/10/2026). El buscador sólo
// entregaba el perfil ELEGIDO, así que «@martinkoncke» + «Crear lead» sin tocar «Usar @…» creaba el
// lead sin Instagram y sin aviso. Lo decide `instagramDelAlta` (app/crm/campo-inline.ts) con la regla
// de la ficha (`usuarioInstagram`); el buscador le pasa lo escrito al alta por `onTexto`.
//   ROTO A PROPÓSITO (2026-10-12), tres veces, cada una contra la base en verde (este archivo 14/0):
//   · `instagramDelAlta` devolviendo sólo lo elegido (`usuarioInstagram(elegido) ?? ''`): pass 13 / fail 1.
//   · el hidden del alta vuelto a `perfil?.usuario ?? ''`: pass 13 / fail 1 (lo caza el de los cuatro campos).
//   · sin `onTexto?.(e.target.value)` en el `onChange` del buscador: pass 13 / fail 1.
test('el alta guarda el @ escrito en el buscador aunque no se haya elegido de la lista', async () => {
  const { instagramDelAlta } = await import('../app/crm/campo-inline');
  // Lo elegido manda; si no hay, lo escrito cuando es un usuario (con o sin @, o el link del perfil).
  assert.equal(instagramDelAlta('martinkoncke', 'otra.cosa'), 'martinkoncke');
  assert.equal(instagramDelAlta(null, '@MartinKoncke'), 'martinkoncke');
  assert.equal(instagramDelAlta(undefined, ' martin_koncke '), 'martin_koncke');
  assert.equal(instagramDelAlta(null, 'https://www.instagram.com/martinkoncke/?igsh=x'), 'martinkoncke');
  // Un nombre, un post o nada no son un usuario: no se manda nada (el server tampoco lo guardaría).
  assert.equal(instagramDelAlta(null, 'Martin Koncke'), '');
  assert.equal(instagramDelAlta(null, 'https://www.instagram.com/p/ABC123/'), '');
  assert.equal(instagramDelAlta(null, ''), '');
  // El buscador le pasa lo escrito al alta en cada tecla, y lo limpia al elegir un perfil.
  const ib = codigo('app/crm/new/InstagramBuscador.tsx');
  assert.match(ib, /onChange=\{\(e\) => \{ setTexto\(e\.target\.value\); onTexto\?\.\(e\.target\.value\);/);
  assert.match(ib, /onElegir\(p\);\n\s*setTexto\(''\);\n\s*onTexto\?\.\(''\);/);
});

test('sin «Cancelar», y «Crear lead» en la fila de abajo, con «Traer de otro funnel»', () => {
  const nf = codigo('app/crm/new/NewLeadForm.tsx');
  assert.doesNotMatch(nf, />\s*Cancelar\s*</, 'volvió «Cancelar»: la ✕ del modal ya cierra');
  assert.doesNotMatch(nf, /onCerrar/, 'una prop sin uso: el form ya no cierra nada');
  const i = nf.indexOf('Traer de otro funnel');
  const j = nf.indexOf("'Crear lead'");
  assert.ok(i > 0 && j > i, '«Crear lead» va en la misma fila, después de «Traer de otro funnel»');
  assert.ok(!nf.slice(i, j).includes('</div>'), '«Traer» y «Crear lead» quedaron en filas distintas');
});

test('el server guarda el Instagram del alta con la regla de la ficha, y sin la mig 0258 un alta sin él entra igual', () => {
  const ac = codigo('app/crm/actions.ts');
  assert.match(ac, /instagram: usuarioInstagram\(emptyToNull\(formData\.get\('instagram'\)\)\),/);
  const le = codigo('lib/leads.ts');
  assert.match(le, /\.\.\.\(input\.instagram\?\.trim\(\) \? \{ instagram: input\.instagram\.trim\(\) \} : \{\}\),/,
    'el insert nombra `instagram` siempre: sin la columna se rechaza el alta ENTERA');
});

test('al crear se abre la ficha del lead nuevo, también desde el placeholder de una columna', () => {
  const b = codigo('app/crm/CrmBoard.tsx');
  assert.match(b, /if \(etapa\) \{ setAltaPendiente\(\{ id, etapa \}\); setFichaTrasAlta\(id\); \} else setSelectedId\(id\);/);
  // Espera a que la columna haya hecho lo suyo (sus diálogos), y a que no haya otra alta abierta.
  assert.match(b, /if \(fichaTrasAlta == null \|\| altaPendiente \|\| hayDialogoDeSoltar \|\| altaAbierta\) return;\s*setSelectedId\(fichaTrasAlta\);/);
  // Y es la MISMA ficha que abre una tarjeta.
  assert.match(b, /<LeadEditModal leadId=\{selected\.id\}/);
  // El esqueleto de esa ficha mide lo mismo que la ficha (punto 14, frente C).
  const m = codigo('app/crm/LeadEditModal.tsx');
  assert.match(m, /maxWidth: ANCHO_FICHA_LEAD/);
  assert.doesNotMatch(m, /maxWidth: 760/);
  //   ROTO A PROPÓSITO (2026-10-12): con el placeholder sin `setFichaTrasAlta` (como antes: la ficha
  //   no se abría), pass 12 / fail 1; con el esqueleto de vuelta en 760, 12 / 1.
});

// ── 5 · el teléfono con banderas, en todos lados que se CARGA uno ─────────────

// Revisión del 12/10/2026: el campo del número borraba el «+» y dejaba los dígitos del país adentro:
// pegar «+54 9 11 2233-4455» con México elegido guardaba «525491122334455», en los siete montajes.
// ROTO A PROPÓSITO (12/10/2026), restaurando de memoria, contra 17 / 0 de base:
//   · `numeroTecleado` sin partir lo que arranca con «+»                            → 16 / 1
//   · el campo vuelve a `onNumero(e.target.value.replace(…))`                        → 16 / 1
//   · la lada y el número en el mismo evento (sin esperar a que la lada vuelva)     → 16 / 1
test('un número pegado o escrito con su «+código» se parte: el código va al selector, nunca adentro del número', () => {
  assert.deepEqual(numeroTecleado('+54 9 11 2233-4455'), { lada: '+54', numero: '91122334455' });
  assert.equal(unirTelefono('+54', numeroTecleado('+54 9 11 2233-4455').numero), '5491122334455', 'un solo código de país');
  assert.deepEqual(numeroTecleado('+52 1 55 1234 5678'), { lada: '+52', numero: '15512345678' });
  // Mientras se tipea el código, el «+» queda en el campo y no se decide nada.
  assert.deepEqual(numeroTecleado('+'), { lada: null, numero: '+' });
  assert.deepEqual(numeroTecleado('+5'), { lada: null, numero: '+5' });
  // Sin «+», como siempre: dígitos, espacios y guiones.
  assert.deepEqual(numeroTecleado('223 355-0684'), { lada: null, numero: '223 355-0684' });
  assert.deepEqual(numeroTecleado('22a3+3'), { lada: null, numero: '2233' });
  const c = codigo('app/_components/TelefonoConPais.tsx');
  assert.match(c, /const r = numeroTecleado\(e\.target\.value\);/);
  // La lada va primero y el número espera a que vuelva por props: con un padre que guarda los dos en
  // un objeto (`setDraft({ ...draft, lada })`), dos llamadas seguidas pisan la lada con la vieja.
  assert.match(c, /if \(r\.lada && r\.lada !== lada\) \{ pendiente\.current = \{ lada: r\.lada, numero: r\.numero \}; onLada\(r\.lada\); return; \}/);
  assert.match(c, /if \(!p \|\| p\.lada !== lada\) return;\s*pendiente\.current = null;\s*onNumero\(p\.numero\);/);
});

test('cada lugar que carga un teléfono monta TelefonoConPais, y ninguno vuelve al input pelado', () => {
  // Los que se pasaron el 12/10/2026, más los que ya lo usaban. La ficha del lead es del frente D
  // (app/crm/lead-view/CampoEditable.tsx).
  const conBanderas = [
    'app/crm/new/NewLeadForm.tsx', 'app/crm/StageMoveDialog.tsx', 'app/agencia/GrupoDetalleModal.tsx',
    'app/configuraciones/TelefonosPanel.tsx', 'app/customer-success/curso/InvitarAlumnos.tsx',
    'app/customer-success/NuevoCliente.tsx', 'app/perfil/PerfilTabs.tsx', 'app/automations/OnboardingChatAgent.tsx',
    'app/plan/board/ReunionTareas.tsx', 'app/onboarding/OnboardingWizard.tsx', 'app/perfil/DestinatariosLista.tsx',
    'app/automations/PanelProbar.tsx',
  ];
  for (const f of conBanderas) {
    const src = codigo(f);
    assert.match(src, /<TelefonoConPais\b/, `${f} no monta el selector con banderas`);
    assert.doesNotMatch(src, /type="tel"|inputMode="tel"/, `${f} volvió a un input de teléfono pelado`);
  }
  //   ROTO A PROPÓSITO (2026-10-12): con un `<input type="tel">` de vuelta en StageMoveDialog, 12 / 1.
});

test('lo que viaja al server tiene la MISMA forma que antes en cada lugar', () => {
  // Los dígitos con la lada (`unirTelefono`): alta del CRM, stage move, grupos de la agencia, la prueba
  // del Chat Agent, Customer Success y la tarea de una reunión — los server de todos sacan los dígitos.
  for (const f of ['app/crm/new/NewLeadForm.tsx', 'app/crm/StageMoveDialog.tsx', 'app/agencia/GrupoDetalleModal.tsx',
    'app/automations/OnboardingChatAgent.tsx', 'app/customer-success/NuevoCliente.tsx', 'app/customer-success/curso/InvitarAlumnos.tsx',
    'app/plan/board/ReunionTareas.tsx']) {
    assert.match(codigo(f), /unirTelefono\(/, `${f} manda otra cosa que los dígitos con la lada`);
  }
  // Los teléfonos del workspace se guardaban como se escribían, «+52 686 399 6369», y la lista los
  // muestra tal cual: siguen saliendo así (la lada, un espacio y lo escrito).
  assert.match(codigo('app/configuraciones/TelefonosPanel.tsx'), /`\$\{d\.lada\} \$\{d\.numero\.trim\(\)\}`/);
  // El del perfil se escribía «+5216861234567»: sigue con el «+» adelante.
  assert.match(codigo('app/perfil/PerfilTabs.tsx'), /`\+\$\{unirTelefono\(t\.lada, t\.numero\)\}`/);
});

// ⚠️ UN TELÉFONO DEL WORKSPACE QUE NO SE TOCÓ SE GUARDA COMO ESTABA (revisión del 12/10/2026). Partirlo
// en país y número y volver a unirlo no es neutro: los espacios se van, y uno guardado sin lada que no
// empieza con ningún código de país vuelve con «+52» adelante — OTROS dígitos, otro `numero_norm` —
// por cambiarle sólo la etiqueta.
//   ROTO A PROPÓSITO (2026-10-12), contra la base en verde (este archivo 15/0): sin la vuelta al
//   original en `numeroAGuardar`, pass 14 / fail 1; sin `original: t.numero` al editar, pass 14 / fail 1.
test('un teléfono del workspace que no se tocó viaja como estaba guardado', async () => {
  const { splitTelefono, unirTelefono } = await import('../lib/paises');
  // Lo que pasaba sin la vuelta: los dígitos de un número local guardado sin lada cambiaban.
  const viejo = '044 55 1234 5678';
  const p = splitTelefono(viejo);
  assert.notEqual(unirTelefono(p.lada, p.resto), viejo.replace(/\D/g, ''), 'el caso ya no reproduce el cambio de dígitos');
  const tp = codigo('app/configuraciones/TelefonosPanel.tsx');
  assert.match(tp, /const antes = splitTelefono\(d\.original\);\s*if \(antes\.lada === d\.lada && antes\.resto === d\.numero\) return d\.original;/);
  assert.match(tp, /setters: t\.setters, original: t\.numero \}\);/);
});
