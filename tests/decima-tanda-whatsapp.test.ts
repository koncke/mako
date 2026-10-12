// =============================================================================
// Décima tanda de Automations (11/10/2026): WhatsApp 2, 3, 5 y 6, Email 1 y Probar 1 y 2
// =============================================================================
// El pedido textual está en app/admin/dev/chatbot/bitacora.ts (el último hito). Lo que fija este test:
//   · WhatsApp 2: el ✏️ de la burbuja que se está editando CIERRA la edición (`alTocarEditar`).
//   · WhatsApp 3: lo de la barra no se pierde (lib/borrador-barra.ts): al salir entra al mensaje
//     (`listaAlSalir`), la copia local vale sólo para el mensaje como estaba (`firma`), y la sesión de voz
//     reporta lo grabado a cada trozo y al escucharlo (`onBorrador`), sin mandar nada.
//   · WhatsApp 5: la sugerencia del ✦ va en su recuadro arriba de la barra, no como burbujas.
//   · Email 1: el email de MaKo no se ofrece, no se elige, no se guarda en un paso, no se conecta como
//     dominio y no sale en una prueba (salvo la plataforma).
//   · Probar 1 y 2: el aviso de que la prueba salió, y el renglón «De → Para» que envuelve.
//
// ── Roturas ── al final.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { alTocarEditar, listaAlSalir, sugerenciaTras, type SugerenciaMaKo } from '../app/automations/EditorMensajeWhatsApp';
import { firmaDelMensaje, borradorAGuardar, borradorALeer, vozALeer, VIDA_BORRADOR_MS } from '../lib/borrador-barra';
import { crearSesionVoz, crearGrabadorVoz, TROZO_MS } from '../app/whatsapp/_shared/VoiceRecorder';
import {
  esRemitenteDeMako, esDominioDeMako, remitentesVinculados, remitenteDelPaso, remitenteAGuardar, remitenteDelNegocio,
  SIN_EMAIL_PROPIO, DOMINIOS_MAKO, dominioDe,
} from '../lib/email-remitente';
import { avisoDelRemitente } from '../app/automations/EditorEmailGmail';
import { lineaDeEnvio, CANALES_PROBAR } from '../app/automations/PanelProbar';
import { EMAIL_MAKO, REMITENTE_MAKO } from '../lib/app-url';
import type { ParteMensaje } from '../lib/mensaje-partes';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const EDITOR = sinComentarios(leer('app/automations/EditorMensajeWhatsApp.tsx'));
const esperar = (ms = 25) => new Promise((r) => setTimeout(r, ms));

// ── WhatsApp 2 ───────────────────────────────────────────────────────────────────────────────

test('WhatsApp 2: el ✏️ de la burbuja que se edita cierra la edición; con algo escrito, otra no se abre', () => {
  assert.equal(alTocarEditar(2, 2, true), 'cerrar', 'tocar Editar otra vez tiene que cerrar la edición');
  assert.equal(alTocarEditar(2, 2, false), 'cerrar');
  assert.equal(alTocarEditar(null, 1, false), 'abrir');
  assert.equal(alTocarEditar(null, 1, true), 'ocupado', 'lo escrito en la barra no se pisa');
  assert.equal(alTocarEditar(0, 1, true), 'ocupado');
  // Los DOS ✏️ (varias partes y un solo mensaje) lo usan, y cerrar es soltar la barra (como la ✕).
  for (const fn of ['const editar = (i: number) => {', 'const editarElUnico = () => {']) {
    const cuerpo = EDITOR.slice(EDITOR.indexOf(fn), EDITOR.indexOf('};', EDITOR.indexOf(fn)));
    assert.ok(cuerpo.length > 40 && cuerpo.length < 900, `no encontré ${fn} (${cuerpo.length})`);
    assert.match(cuerpo, /alTocarEditar\(editando, /);
    assert.match(cuerpo, /if \(q === 'cerrar'\) \{ setError\(null\); limpiarBarra\(\); return; \}/);
  }
  assert.match(EDITOR, /aria-pressed=\{editando === i\}/, 'el lápiz dice que está apretado');
});

// ── WhatsApp 3: al salir, a la burbuja ────────────────────────────────────────────────────────

const t = (cuerpo: string): ParteMensaje => ({ tipo: 'texto', cuerpo });

test('WhatsApp 3: lo que quedó en la barra entra al mensaje al salir, como «Enviar»', () => {
  assert.deepEqual(listaAlSalir([t('Hola')], 'Te escribo', null, null, false), [t('Hola'), t('Te escribo')], 'al final');
  assert.deepEqual(listaAlSalir([t('Hola'), t('Chau')], 'Hola!', null, 0, false), [t('Hola!'), t('Chau')], 'editando, en su lugar');
  assert.deepEqual(listaAlSalir([], 'Mirá', { tipo: 'media', media_id: 7 }, null, false), [{ tipo: 'media', media_id: 7, cuerpo: 'Mirá' }], 'el archivo con su pie');
  assert.equal(listaAlSalir([t('Hola')], '   ', null, null, false), null, 'una barra vacía no suma nada');
  assert.equal(listaAlSalir([t('Hola')], 'otro', null, null, true), null, '«adaptado a cada persona» va de UN mensaje: queda la copia local');
  const seis = Array.from({ length: 6 }, (_, i) => t(`m${i}`));
  assert.equal(listaAlSalir(seis, 'el séptimo', null, null, false), null, 'el tope de partes');
  // La salida corre al tick siguiente del desmontaje (StrictMode monta dos veces) y suma también el audio.
  assert.match(EDITOR, /saliendo\.current = true;\s*window\.setTimeout\(\(\) => \{ if \(saliendo\.current\) alSalir\(\); \}, 0\);/);
  const salir = EDITOR.slice(EDITOR.indexOf('const alSalir = () => {'), EDITOR.indexOf('useEffect(() => {', EDITOR.indexOf('const alSalir = () => {')));
  assert.match(salir, /const actual = partesDe\(pasoVivo\.current\);\s*const lista = listaAlSalir\(actual, v\.barra, v\.adjunto, v\.editando, /);
  assert.match(salir, /if \(lista && JSON\.stringify\(lista\) !== JSON\.stringify\(actual\)\) aplicarPartes\(lista\);/, 'una burbuja abierta y sin tocar no es un cambio');
  assert.match(salir, /usarAudio\(blob, voz\.secs, \{ dondeIba: voz\.dondeIba, saliendo: true \}\)/, 'el audio sin mandar no se sube al salir');
  // Y el paso nuevo se anota en el acto: el audio que termina de subir se suma DESPUÉS del texto, no encima.
  assert.match(EDITOR, /vivo\.current\.onChange\(cambiosDePaso\(antes, despues\)\);\s*pasoVivo\.current = despues;/);
});

// ── WhatsApp 3: la copia en el navegador ──────────────────────────────────────────────────────

test('WhatsApp 3: la copia local vale sólo para el mensaje como estaba, y caduca', () => {
  const paso = { canal: 'whatsapp', cuerpo: 'Hola', tipo: 'texto' };
  const firma = firmaDelMensaje(paso);
  assert.notEqual(firma, firmaDelMensaje({ ...paso, cuerpo: 'Hola, ¿cómo vas?' }), 'otro mensaje, otra firma');
  const ahora = 1_000_000;
  assert.equal(borradorAGuardar(firma, '  ', null, null, ahora), null, 'una barra vacía no deja copia');
  const b = borradorAGuardar(firma, 'Te escribo', { tipo: 'media', media_id: 4 }, 1, ahora)!;
  const crudo = JSON.stringify(b);
  assert.deepEqual(borradorALeer(crudo, firma, ahora + 1000), b);
  assert.equal(borradorALeer(crudo, firmaDelMensaje({ ...paso, cuerpo: 'Hola' + '!' }), ahora), null,
    'si lo de la barra ya entró al mensaje (la firma cambió), no se restaura dos veces');
  assert.equal(borradorALeer(crudo, firma, ahora + VIDA_BORRADOR_MS + 1), null, 'una barra de hace semanas no vuelve');
  assert.equal(borradorALeer('{basura', firma, ahora), null);
  assert.equal(borradorALeer(JSON.stringify({ ...b, adjunto: { tipo: 'media', media_id: -3 }, texto: '' }), firma, ahora), null, 'lo ilegible no vuelve');
  const voz = { firma, tramos: [new Blob(['a']), new Blob([])], secs: 12.4, dondeIba: null, t: ahora };
  const v = vozALeer(voz, firma, ahora)!;
  assert.equal(v.tramos.length, 1, 'un tramo vacío no cuenta');
  assert.equal(v.secs, 12);
  assert.equal(vozALeer({ ...voz, tramos: [] }, firma, ahora), null);
  assert.equal(vozALeer(voz, 'otra', ahora), null);
  // La pantalla: se restaura al montar (si en la pestaña no había nada escrito), se guarda a cada cambio, y el
  // composer recibe el borrador de la voz.
  assert.match(EDITOR, /const b = borradorALeer\(leerBarraLocal\(claveBorrador\), firma, ahora\);/);
  assert.match(EDITOR, /guardarBarraLocal\(claveBorrador, borradorAGuardar\(firma, barra, adjunto, editando, Date\.now\(\)\)\);/);
  assert.match(EDITOR, /onBorradorVoz=\{permiteAudio \? alBorradorVoz : undefined\}/);
  assert.match(EDITOR, /void guardarVozLocal\(clave, \{ firma: f, tramos: b\.tramos, secs: b\.secs, dondeIba: ed, t: Date\.now\(\) \}\);/);
});

// ── WhatsApp 3: la sesión de voz reporta lo grabado, sin mandar ───────────────────────────────

class RecTrozos {
  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  mimeType = 'audio/webm';
  timeslice: number | undefined;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(private contenido: string) {}
  start(ts?: number) { this.state = 'recording'; this.timeslice = ts; }
  /** Lo que el navegador entrega cada `timeslice`. */
  trozo(texto: string) { this.ondataavailable?.({ data: new Blob([texto]) }); }
  stop() {
    if (this.state === 'inactive') return;
    this.state = 'inactive';
    setTimeout(() => { this.ondataavailable?.({ data: new Blob([this.contenido]) }); this.onstop?.(); }, 5);
  }
  pause() { this.state = 'paused'; }
  resume() { this.state = 'recording'; }
}

/** Toda sesión que un test abre se suelta al final: el reloj de la grabación es un setInterval, y si un assert
 * corta el test a la mitad (una rotura), el archivo no terminaría nunca. */
const abiertas: Array<{ soltar: () => void }> = [];
after(() => { for (const s of abiertas) s.soltar(); });

function armarSesion() {
  const recs: RecTrozos[] = [];
  const s = crearSesionVoz(() => {}, {
    pedirMicrofono: async () => ({ getTracks: () => [{ stop: () => {} }] }) as unknown as MediaStream,
    crearRecorder: () => { const r = new RecTrozos(`fin${recs.length + 1}`); recs.push(r); return r as unknown as MediaRecorder; },
    unir: async (bs) => new Blob([(await Promise.all(bs.map((b) => b.text()))).join('+')]),
    crearUrl: (b) => `blob:${b.size}`,
    soltarUrl: () => {},
  });
  abiertas.push(s);
  const borradores: Array<{ textos: Promise<string[]>; secs: number } | null> = [];
  const entregas: string[] = [];
  const onBorrador = (b: { tramos: Blob[]; secs: number } | null) => {
    borradores.push(b ? { textos: Promise.all(b.tramos.map((x) => x.text())), secs: b.secs } : null);
  };
  return { s, recs, borradores, entregas, onBorrador, onSend: (blob: Blob) => { void blob.text().then((x) => entregas.push(x)); } };
}

test('WhatsApp 3: la sesión reporta lo grabado a cada trozo y al escucharlo; tirarlo avisa null; no manda nada', async () => {
  const a = armarSesion();
  await a.s.start(a.onSend, undefined, a.onBorrador);
  assert.equal(a.recs[0]!.timeslice, TROZO_MS, 'sin trozos, recargar a mitad de una grabación la pierde entera');
  a.recs[0]!.trozo('uno');
  a.recs[0]!.trozo('dos');
  assert.equal(a.borradores.length, 2);
  assert.deepEqual(await a.borradores[1]!.textos, ['unodos'], 'el borrador es TODO lo grabado del tramo hasta ahora');
  a.s.terminar(); await esperar();
  const ultimo = a.borradores[a.borradores.length - 1]!;
  assert.deepEqual(await ultimo.textos, ['unodosfin1'], 'al pasar a escucharlo, el audio entero');
  // 🎤 seguir: el borrador lleva el tramo de antes ADELANTE.
  await a.s.seguir();
  a.recs[1]!.trozo('tres');
  assert.deepEqual(await a.borradores[a.borradores.length - 1]!.textos, ['unodosfin1', 'tres']);
  a.s.descartar();
  assert.equal(a.borradores[a.borradores.length - 1], null, '🗑 tira también el borrador');
  assert.equal(a.entregas.length, 0, 'el borrador no MANDA nada: sólo la ➤');
  // Sin `onBorrador`, el grabador graba como siempre (todo al parar).
  const b = armarSesion();
  await b.s.start(b.onSend);
  assert.equal(b.recs[0]!.timeslice, undefined);
  b.s.descartar();   // el reloj de la grabación es un setInterval: sin parar, el test no termina
  // Un audio que YA existía (WA9) no es un borrador hasta que se le graba algo.
  const c = armarSesion();
  await c.s.revisarExistente({ blob: new Blob(['viejo']), secs: 3 }, c.onSend, undefined, c.onBorrador);
  assert.equal(c.borradores.length, 0, 'abrir un audio guardado lo volvería a subir al salir');
});

test('WhatsApp 3: una grabación CANCELADA (desmontar) no deja trozo; el grabador solo, igual', async () => {
  const rec = new RecTrozos('x');
  const trozos: string[] = [];
  const g = crearGrabadorVoz(() => {}, {
    pedirMicrofono: async () => ({ getTracks: () => [{ stop: () => {} }] }) as unknown as MediaStream,
    crearRecorder: () => rec as unknown as MediaRecorder,
  });
  await g.start(() => {}, undefined, (b) => { void b.text().then((x) => trozos.push(x)); });
  rec.trozo('a');
  g.soltar();
  await esperar();
  assert.deepEqual(trozos, ['a'], 'lo cancelado no se reporta (el editor se queda con el último trozo)');
});

// ── WhatsApp 5: la sugerencia, arriba de la barra ─────────────────────────────────────────────

test('WhatsApp 5: la sugerencia de MaKo es un recuadro arriba de la barra, que se pliega; no burbujas', () => {
  const s: SugerenciaMaKo = { mensajes: ['Hola'], audio: 'guion', nota: null, plegada: false };
  assert.deepEqual(sugerenciaTras(s, 'mensajes'), { ...s, mensajes: [] }, 'usar los mensajes deja el guion');
  assert.equal(sugerenciaTras({ ...s, audio: null }, 'mensajes'), null, 'usada entera, se va');
  // En la barra, ANTES del composer; la ✕ la pliega y el renglón plegado la abre.
  const barra = EDITOR.slice(EDITOR.indexOf('<div data-barra'), EDITOR.indexOf('</div>', EDITOR.indexOf('<div data-barra')));
  assert.ok(barra.indexOf('{sugerenciaNodo}') >= 0 && barra.indexOf('{sugerenciaNodo}') < barra.indexOf('{composerNodo}'), 'la sugerencia va arriba de la barra');
  assert.match(EDITOR, /onClick=\{\(\) => ponerSugerencia\(\{ \.\.\.sugerencia, plegada: true \}\)\} title="Cerrar"/, 'cerrar la pliega');
  assert.match(EDITOR, /✦ Ver sugerencia de MaKo/);
  const nodo = EDITOR.slice(EDITOR.indexOf('const sugerenciaNodo'), EDITOR.indexOf('const textoActual'));
  assert.doesNotMatch(nodo, /BurbujaHilo|Ticks/, 'la sugerencia no es un mensaje enviado');
  // El panel del ✦ entrega la propuesta y ya no la dibuja como burbujas.
  const redacta = sinComentarios(leer('app/automations/MakoRedacta.tsx'));
  assert.doesNotMatch(redacta, /BurbujaHilo/, 'las sugerencias volvieron a ser burbujas en el panel');
  // Decimotercera tanda (punto 8): también el asunto (sólo el email lo trae; WhatsApp no lo usa).
  assert.match(redacta, /onPropuesta\(\{ mensajes: lista\.mensajes, asunto: lista\.asunto, audio: lista\.audio, nota: lista\.nota, sinVoz: lista\.sinVoz \}\)/);
  assert.match(EDITOR, /onPropuesta=\{alProponer\}/);
});

// ── Email 1 ───────────────────────────────────────────────────────────────────────────────────

test('Email 1: el email de MaKo no es el de un cliente (salvo la plataforma)', () => {
  assert.ok(esDominioDeMako(dominioDe(REMITENTE_MAKO)), `el dominio de EMAIL_MAKO (${EMAIL_MAKO}) no está en DOMINIOS_MAKO (${DOMINIOS_MAKO.join(', ')})`);
  assert.equal(esRemitenteDeMako('MaKo <equipo@hola-mako.com>'), true);
  assert.equal(esRemitenteDeMako('ventas@send.hola-mako.com'), true, 'un subdominio también');
  assert.equal(esRemitenteDeMako('Ana <ana@hola-makos.com>'), false, 'un dominio parecido no');
  assert.equal(esRemitenteDeMako('Ana <ana@valle.mx>'), false);
  const ws1 = { remitente: 'MaKo <equipo@hola-mako.com>', sandbox: false };
  assert.deepEqual(remitentesVinculados(ws1), [], 'el «De» del ws1 ofrecía el email de MaKo');
  // Undécima tanda: la regla es POSITIVA (remitenteDelNegocio). El de MaKo en un cliente no pasa; en la
  // plataforma, con su dominio reclamado, sí.
  const hechos = { resendFrom: ws1.remitente, resendDominio: null, credFrom: null, keyPropia: false, plataforma: false };
  assert.deepEqual(remitenteDelNegocio(hechos), { puede: false, motivo: 'de-mako' });
  assert.deepEqual(remitentesVinculados({ ...ws1, plataforma: true }), ['MaKo <equipo@hola-mako.com>'], 'la plataforma sí lo usa: es el suyo');
  assert.equal(remitenteDelNegocio({ ...hechos, plataforma: true, resendDominio: 'hola-mako.com' }).puede, true);
  assert.equal(remitenteDelPaso('Ventas <ventas@hola-mako.com>', 'MaKo <equipo@hola-mako.com>'), null, 'un paso no elige otro email de MaKo');
  // Ni el del workspace mismo (segunda pasada): con `from` explícito el ws1 se salteaba el corte de `sendEmail`.
  // Sin `from` sale el mismo para la plataforma (tests/decima-remitente-mako.test.ts).
  assert.equal(remitenteDelPaso('MaKo <equipo@hola-mako.com>', 'MaKo <equipo@hola-mako.com>'), null, 'un paso no lleva NUNCA un email de MaKo');
  assert.equal(remitenteAGuardar('Ventas <ventas@hola-mako.com>', undefined), null, 'no se guarda en un paso');
  assert.equal(remitenteAGuardar(undefined, 'MaKo <equipo@hola-mako.com>'), null);
  // El de MaKo en un cliente llega como el sandbox: el «De» dice lo mismo que frena el envío.
  assert.equal(avisoDelRemitente({ sandbox: true, envioHabilitado: true }), SIN_EMAIL_PROPIO, 'el «De» lo dice');
  // El server: la ruta del dominio no lo conecta ni arma un remitente con él, y la prueba de verdad no sale.
  const ruta = sinComentarios(leer('app/api/email/dominio/route.ts'));
  assert.equal((ruta.match(/if \(esDominioDeMako\(dominio\) && !\(await esPlataforma\(g\.ws\)\)\) return Response\.json\(\{ ok: false, error: NO_ES_TUYO \}, \{ status: 403 \}\);/g) ?? []).length, 2,
    'crear y remitente, los dos');
  assert.match(ruta, /plataforma,\n\s*\};/, 'el «De» no sabe si es la plataforma');
  const prueba = sinComentarios(leer('lib/prueba-paso.ts'));
  // Undécima: una sola puerta positiva. Sin remitente propio (el de MaKo en un cliente llega como el
  // sandbox) no sale, sin rama «de MaKo» ni excepción del super admin. Probado rompiéndolo
  // (wf-undecima/enchufador/roturas-e11.cjs): el freno DESPUÉS de reclamar el tope → 8 / 1 (base 9 / 0).
  const iSin = prueba.indexOf("if (mensaje.canal === 'email' && await remitenteEsSandbox()) {");
  const iCupo = prueba.indexOf('hayLugar = await reclamarCupoPrueba(');
  assert.ok(iSin > 0 && iSin < iCupo, 'el chequeo va antes del tope (un pedido rechazado no gasta un lugar)');
  assert.match(prueba, /if \(mensaje\.canal === 'email' && await remitenteEsSandbox\(\)\) \{\n\s+return \{ ok: false, error: SIN_EMAIL_PROPIO \};/);
  assert.doesNotMatch(prueba, /const deMako|wsSuperAdmin/, 'volvió la rama «de MaKo» de la décima');
});

// ── Probar 1 y 2 ──────────────────────────────────────────────────────────────────────────────

test('Probar 1: al salir la prueba de verdad, un aviso corto con dónde mirar, UNO por prueba', () => {
  assert.equal(CANALES_PROBAR.email.enviado, 'Enviado · revisa tu bandeja');
  assert.equal(CANALES_PROBAR.whatsapp.enviado, 'Enviado · revisa tu WhatsApp');
  for (const c of Object.values(CANALES_PROBAR)) assert.ok(c.enviado.split(/\s+/).length <= 5, `«${c.enviado}» es largo para un toast`);
  const panel = sinComentarios(leer('app/automations/PanelProbar.tsx'));
  const mandar = panel.slice(panel.indexOf('const mandarReal = ('), panel.indexOf('const mostrarParte = ('));
  // Duodécima tanda (§2.8): el aviso lo pide `onEnviado` SIN el gate del recorrido, y el toast vive en la lista
  // (SimuladorWhatsApp). Lo fija entero tests/automations-duodecima-entrada.test.ts.
  assert.match(mandar, /\} else if \(primero\) \{\n\s+const texto = CANALES_PROBAR\[c\.canal\]\.enviado;\n\s+onEnviado\?\.\(texto\);/,
    'el aviso va con el PRIMERO que sale, si salió');
  assert.match(sinComentarios(leer('app/automations/SimuladorWhatsApp.tsx')), /<Toast state=\{avisoEnviado\} onClose=\{cerrarAviso\} \/>/);
});

test('Probar 2: «De → Para» envuelve; la flecha va pegada al destino', () => {
  assert.equal(lineaDeEnvio('MaKo <equipo@hola-mako.com>', 'martinkoncke@gmail.com'), 'MaKo <equipo@hola-mako.com> →\u00a0martinkoncke@gmail.com');
  assert.equal(lineaDeEnvio(null, '+52 55 1234 5678'), 'Llega a\u00a0+52 55 1234 5678');
  const panel = sinComentarios(leer('app/automations/PanelProbar.tsx'));
  const linea = panel.slice(panel.indexOf('data-linea-envio'), panel.indexOf('</div>', panel.indexOf('data-linea-envio')));
  assert.ok(linea.length > 0 && linea.length < 800, `no encontré el renglón (${linea.length})`);
  assert.doesNotMatch(linea, /recorte|textOverflow|whiteSpace: 'nowrap'/, 'el renglón volvió a cortarse');
  assert.match(linea, /whiteSpace: 'normal'/);
  assert.match(linea, /overflowWrap: 'anywhere'/);
  assert.match(linea, /lineaDeEnvio\(rotuloEmisor, destinoLegible\(destino, esEmail\)\)/);
});

// ── Roturas (11/10/2026, arnés del scratchpad, una por vez y restaurando DE MEMORIA; base 9 / 0) ──────────
//   R1. `alTocarEditar` sin la rama «cerrar» (el ✏️ otra vez reabre)             → 8 / 1 (WhatsApp 2).
//   R2. `borradorALeer` sin comparar la firma (se restauraría dos veces)        → 8 / 1 (la copia local).
//   R3. el grabador sin trozos (`r.start()` siempre)                            → 8 / 1 (la sesión).
//   R4. `remitentesVinculados` ofreciendo el email de MaKo                      → 8 / 1 (Email 1).
//   R5. `lineaDeEnvio` con un espacio común antes del destino                   → 8 / 1 (Probar 2).
// Y el `after` que suelta las sesiones existe por R3: con un assert cortando el test a la mitad, el reloj de la
// grabación (un setInterval) dejaba el archivo colgado hasta el tope del arnés.
