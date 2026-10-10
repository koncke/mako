// =============================================================================
// El editor de WhatsApp de la sexta tanda del Chatbot (09/10/2026, «FEEDBACK DE WHATSAPP» y «MaKo en
// WhatsApp»): lo que se decide sin DOM, EJECUTADO, y los enchufes que no se ven leyendo un archivo.
// =============================================================================
//   · 1 y 8, el audio que «no se podía escuchar»: el reproductor tiene ANCHO PROPIO en px (AudioPlay);
//   · 7, la grabación: ✓ termina, se escucha y recién la ➤ manda; 🎤 suma otro tramo (`crearSesionVoz`,
//     con un MediaRecorder falso y una unión falsa);
//   · 2, el número de CADA mensaje (`lineaDelPaso`/`lineaAlGuardar`) y el motor que lo usa;
//   · 11, la pausa entre los mensajes de una tarjeta (`pausaAntesDe`, los topes);
//   · 4, 5, 6, 9 y 12: los botones pegados, las palomitas, el guion sólo si MaKo lo propuso, editar un
//     audio con la barra de escucharlo, y la tarjeta con «+1 mensaje…» y su «…»;
//   · 3, el ✦ de MaKo: el pedido, el filtro de lo que escribe el modelo y la ruta (lib/mako-redacta.ts);
//   · MaKo en WhatsApp 1 y 2: la cabecera y el MISMO editor en modo grupo.
//
// Correr: node --import tsx --test tests/whatsapp-sexta-tanda.test.ts
// Probado rompiéndolo (09/10/2026): ver el pie del archivo.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AudioPlay, duracionVisible, tiempoDelReproductor } from '../app/whatsapp/_shared/AudioPlay';
import { BurbujaHilo, ANCHO_AUDIO } from '../app/whatsapp/_shared/BurbujaHilo';
import { crearSesionVoz, wavDe, barrasDeOnda, BarraGrabacion, ESTADO_VOZ_INICIAL, type EstadoVoz, type GrabacionVoz } from '../app/whatsapp/_shared/VoiceRecorder';
import {
  pausaAntesDe, pausasPosibles, pausaVisible, sanearParte, problemaDePartes, formaGuardada, partesAlGuardar, partesExplicitas,
  lineaDelPaso, lineaAlGuardar, PAUSA_ENTRE_PARTES_MS, PAUSA_TOTAL_MAX_S, type ParteMensaje,
} from '../lib/mensaje-partes';
import { lineaElegida, type LineaWa } from '../app/automations/SalidaWhatsApp';
import {
  EditorMensajeWhatsApp, EditorMensajeGrupo, CabeceraMakoEnWhatsApp, propuestaALista, enviarALista, rotuloPausa,
} from '../app/automations/EditorMensajeWhatsApp';
import { textoMasPartes, renglonesDeTarjeta } from '../app/automations/FlujoLienzo';
import { altoDeMensaje } from '../lib/flujo-conversacion';
import { pedidoDeRedacta, revisarRedacta, redactaSystem, userDeRedacta, sinVariablesAjenas, LECTURAS_REDACTA } from '../lib/mako-redacta';
import { VARIABLES_LEAD, VARIABLES_NEGOCIO } from '../lib/template-vars';
import { porId } from '../lib/api-mako/registro';
import type { PasoSecuenciaDto, AudioSetting } from '../app/automations/ChatAgentApp';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const bloque = (src: string, abre: string, cierra: string, tope: number): string => {
  const ini = src.indexOf(abre);
  assert.ok(ini >= 0, `no encontré «${abre}»`);
  const fin = src.indexOf(cierra, ini + abre.length);
  assert.ok(fin > ini, `no encontré el cierre «${cierra}»`);
  const b = src.slice(ini, fin);
  assert.ok(b.length < tope, `el recorte mide ${b.length}: está mirando otra cosa`);
  return b;
};

// ── 1 y 8: el audio que no se podía escuchar ─────────────────────────────────────────────────

test('el reproductor de una burbuja tiene ANCHO EN PX (un % adentro de una burbuja que se ajusta daba 0 o 43 px)', () => {
  const html = renderToStaticMarkup(createElement(BurbujaHilo, { contenido: { audio: { url: 'a.mp3', transcript: null } }, hora: '9:41' }));
  const estilo = /data-reproductor="true" style="([^"]*)"/.exec(html)?.[1] ?? '';
  assert.match(estilo, new RegExp(`(^|;)width:${ANCHO_AUDIO}px`), `el reproductor no lleva ancho en px: «${estilo}»`);
  assert.doesNotMatch(estilo, /min\(/, 'volvió el min(240px, 100%): porcentaje cíclico');
  assert.ok(html.includes('aria-label="Escuchar audio"'), 'sin el ▶');
  assert.ok(html.includes('<audio') && /<audio[^>]*display:none/.test(html), 'el <audio> es el motor, escondido: los controles son los nuestros');
  // La compacta vive en una tarjeta de ancho conocido: ahí sí, el 100%.
  const chica = renderToStaticMarkup(createElement(BurbujaHilo, { compacta: true, contenido: { audio: { url: 'a.mp3', transcript: null } } }));
  assert.match(/data-reproductor="true" style="([^"]*)"/.exec(chica)?.[1] ?? '', /width:100%/);
});

test('la duración: la del archivo si se sabe, si no la de la biblioteca; y el tiempo como WhatsApp', () => {
  assert.equal(duracionVisible(Number.POSITIVE_INFINITY, 42), 42, 'un MP3 sin Xing dice Infinity');
  assert.equal(duracionVisible(2.5, 42), 2.5);
  assert.equal(duracionVisible(Number.NaN, null), 0);
  assert.equal(tiempoDelReproductor(0, 75, false), '1:15', 'parado: el total');
  assert.equal(tiempoDelReproductor(12.9, 75, true), '0:12', 'sonando: lo que va');
  const html = renderToStaticMarkup(createElement(AudioPlay, { src: 'a.mp3', duracion: 75 }));
  assert.ok(html.includes('>1:15<'), 'antes de cargar se ve la duración de la biblioteca');
});

// ── 7: grabar → TERMINAR → escuchar → mandar ─────────────────────────────────────────────────

class RecFalso {
  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(private contenido: string) {}
  start() { this.state = 'recording'; }
  stop() {
    if (this.state === 'inactive') return;
    this.state = 'inactive';
    setTimeout(() => { this.ondataavailable?.({ data: new Blob([this.contenido]) }); this.onstop?.(); }, 5);
  }
  pause() { this.state = 'paused'; }
  resume() { this.state = 'recording'; }
}

function armarSesion() {
  let n = 0;
  const uniones: number[] = [];
  const estados: EstadoVoz[] = [];
  const entregas: Array<{ texto: Promise<string>; secs: number }> = [];
  const s = crearSesionVoz((e) => estados.push(e), {
    pedirMicrofono: async () => ({ getTracks: () => [{ stop: () => {} }] }) as unknown as MediaStream,
    crearRecorder: () => new RecFalso(`tramo${++n}`) as unknown as MediaRecorder,
    unir: async (bs) => { uniones.push(bs.length); return new Blob(await Promise.all(bs.map((b) => b.text())).then((t) => [t.join('+')])); },
    crearUrl: (b) => `blob:${b.size}`,
    soltarUrl: () => {},
  });
  const onSend = (blob: Blob, secs: number) => { entregas.push({ texto: blob.text(), secs }); };
  return { s, estados, entregas, uniones, onSend, ultimo: () => estados[estados.length - 1] ?? ESTADO_VOZ_INICIAL };
}
const esperar = () => new Promise((r) => setTimeout(r, 25));

test('✓ TERMINA y NO manda: se escucha, y recién la ➤ lo entrega, una sola vez', async () => {
  const t = armarSesion();
  await t.s.start(t.onSend);
  assert.equal(t.ultimo().fase, 'grabando');
  t.s.terminar();
  await esperar();
  assert.equal(t.entregas.length, 0, '«al darle enviar... no se debe enviar, se debe terminar de grabar»');
  assert.equal(t.ultimo().fase, 'revisando');
  assert.ok(t.ultimo().revision?.url, 'sin algo para escuchar');
  await t.s.enviar();
  assert.equal(t.entregas.length, 1);
  assert.equal(await t.entregas[0]!.texto, 'tramo1');
  await t.s.enviar();
  assert.equal(t.entregas.length, 1, 'un segundo clic lo mandaba dos veces');
  assert.equal(t.ultimo().fase, 'quieta');
});

test('🎤 en la revisión graba OTRO tramo que se suma; la ➤ manda los dos unidos', async () => {
  const t = armarSesion();
  await t.s.start(t.onSend);
  t.s.terminar(); await esperar();
  await t.s.seguir();
  assert.equal(t.ultimo().fase, 'grabando');
  t.s.terminar(); await esperar();
  assert.deepEqual(t.uniones, [2], 'para escucharlo se unen los dos tramos');
  await t.s.enviar();
  assert.equal(await t.entregas[0]!.texto, 'tramo1+tramo2');
});

test('🗑 tira lo grabado, grabando o revisando, y no entrega nada', async () => {
  const a = armarSesion();
  await a.s.start(a.onSend);
  a.s.descartar(); await esperar();
  assert.equal(a.entregas.length, 0);
  assert.equal(a.ultimo().fase, 'quieta');
  const b = armarSesion();
  await b.s.start(b.onSend);
  b.s.terminar(); await esperar();
  b.s.descartar(); await b.s.enviar();
  assert.equal(b.entregas.length, 0);
});

test('editar un audio que ya existe (WhatsApp 9): se revisa, 🎤 le suma, y lo que sale es el nuevo', async () => {
  const t = armarSesion();
  await t.s.revisarExistente({ blob: new Blob(['base']), secs: 3 }, t.onSend);
  assert.equal(t.ultimo().fase, 'revisando');
  assert.equal(t.ultimo().secs, 3);
  await t.s.seguir();
  t.s.terminar(); await esperar();
  await t.s.enviar();
  assert.equal(await t.entregas[0]!.texto, 'base+tramo1');
});

// Revisión de la sexta tanda (10/10/2026, hallazgo 8): la sesión pone «grabando» y dibuja la barra ANTES
// de que el navegador entregue el micrófono (su cartel de permiso). Un 🗑 en ese rato dejaba, al dar
// Permitir, el MediaRecorder grabando sin ninguna barra; un ✓ dejaba la barra con `uniendo` y todo apagado,
// con el micrófono abierto y sin salida. Acá el permiso se contesta A MANO (`permitir`).
// PROBADO ROMPIÉNDOLO (10/10/2026, de a una y restaurando de memoria; base 31/0):
//   R8a el grabador arranca aunque el pedido se haya cancelado (sin el `mio !== intento`) → 29/2
//   R8b `terminar` sin mirar `pidiendoMic`                                                → 30/1
//   R8c `descartar` sin apagar `pidiendoMic`                                              → 30/1
//   R8d el ✓ de la barra sin apagarse mientras se pide el micrófono                        → 30/1
//   R8e el 🗑 también apagado mientras se pide (no habría cómo cancelar el pedido)         → 30/1
//   R8f el `stop` del grabador sin cancelar el pedido                                      → 30/1
//   R8g el `soltar` del grabador sin cancelar el pedido                                    → 30/1
// Restaurado: 31/0. (R8a y R8b también sin `--test-force-exit`: ningún proceso queda colgado.)
function armarMicPendiente() {
  const pedidos: Array<() => void> = [];
  const recs: RecFalso[] = [];
  let pistasParadas = 0;
  const estados: EstadoVoz[] = [];
  const entregas: number[] = [];
  const s = crearSesionVoz((e) => estados.push(e), {
    pedirMicrofono: () => new Promise<MediaStream>((res) => {
      pedidos.push(() => res({ getTracks: () => [{ stop: () => { pistasParadas++; } }] } as unknown as MediaStream));
    }),
    crearRecorder: () => { const r = new RecFalso(`tramo${recs.length + 1}`); recs.push(r); return r as unknown as MediaRecorder; },
    unir: async (bs) => new Blob(bs),
    crearUrl: (b) => `blob:${b.size}`,
    soltarUrl: () => {},
  });
  return {
    s, recs, entregas, onSend: (_b: Blob, secs: number) => { entregas.push(secs); },
    /** El navegador contesta el pedido más viejo con «Permitir». */
    permitir: async () => {
      const p = pedidos.shift();
      assert.ok(p, 'no había un pedido de micrófono pendiente');
      p!();
      await new Promise((r) => setTimeout(r, 0));
    },
    pistasParadas: () => pistasParadas,
    ultimo: () => estados[estados.length - 1] ?? ESTADO_VOZ_INICIAL,
  };
}

// ⚠️ Cada test SUELTA su sesión al final, pase o falle: un recorder falso que quedó «grabando» deja vivo
// el `setInterval` del grabador y el proceso del test no termina nunca (la primera corrida de las roturas
// se colgó así, con el archivo roto en el disco hasta que se mató el arnés y se restauró a mano).
test('🗑 mientras el navegador pide el micrófono CANCELA el pedido: al permitir no graba nada, y el siguiente 🎤 anda', async () => {
  const t = armarMicPendiente();
  try {
    const p = t.s.start(t.onSend);
    assert.equal(t.ultimo().fase, 'grabando');
    assert.equal(t.ultimo().pidiendoMic, true, 'la barra no sabe que el micrófono todavía no llegó');
    t.s.descartar();
    assert.equal(t.ultimo().fase, 'quieta');
    assert.equal(t.ultimo().pidiendoMic, false);
    await t.permitir(); await p;
    assert.equal(t.recs.length, 0, 'el micrófono quedó grabando sin ninguna barra');
    assert.equal(t.pistasParadas(), 1, 'el micrófono quedó abierto');
    assert.equal(t.ultimo().fase, 'quieta');
    // El siguiente 🎤 graba de verdad y su ✓ termina (antes el grabador viejo seguía «activo» y la barra se trababa).
    const p2 = t.s.start(t.onSend);
    await t.permitir(); await p2;
    assert.equal(t.recs.length, 1);
    assert.equal(t.ultimo().pidiendoMic, false);
    t.s.terminar(); await esperar();
    assert.equal(t.ultimo().fase, 'revisando');
    assert.equal(t.entregas.length, 0, '✓ termina, no manda');
  } finally { t.s.soltar(); }
});

test('✓ mientras se pide el micrófono no hace nada; al permitir se graba, y el ✓ termina. Desmontar en el medio lo suelta', async () => {
  const t = armarMicPendiente();
  const u = armarMicPendiente();
  try {
    const p = t.s.start(t.onSend);
    t.s.terminar();
    assert.equal(t.ultimo().uniendo, false, 'el ✓ dejaba la barra «cerrando» con todo apagado y el micrófono abierto');
    await t.permitir(); await p;
    assert.equal(t.ultimo().fase, 'grabando');
    assert.equal(t.ultimo().pidiendoMic, false);
    assert.equal(t.recs[0]?.state, 'recording');
    t.s.terminar(); await esperar();
    assert.equal(t.ultimo().fase, 'revisando');
    // Cerrar el panel (o cambiar de chat) mientras se pide: al volver, el micrófono se suelta y no graba.
    const pu = u.s.start(u.onSend);
    u.s.soltar();
    await u.permitir(); await pu;
    assert.equal(u.recs.length, 0);
    assert.equal(u.pistasParadas(), 1);
  } finally { t.s.soltar(); u.s.soltar(); }
});

test('el WAV de la unión es un WAV de verdad, y la onda cuenta barras con el ancho', () => {
  const w = wavDe([new Float32Array([0, 0.5]), new Float32Array([-1])], 48_000);
  assert.equal(w.type, 'audio/wav');
  assert.equal(w.size, 44 + 3 * 2);
  assert.equal(barrasDeOnda(400), 80);
  assert.equal(barrasDeOnda(10), 12, 'nunca menos de 12');
});

const voz = (e: Partial<EstadoVoz>): GrabacionVoz => ({
  ...ESTADO_VOZ_INICIAL, ...e,
  start: async () => {}, revisarExistente: async () => {}, terminar: () => {}, seguir: async () => {}, enviar: async () => {}, descartar: () => {}, pause: () => {}, resume: () => {},
});

test('la barra: grabando con el ✓ (nunca una ➤), revisando con ▶, 🎤 y la ➤ verde', () => {
  const grabando = renderToStaticMarkup(createElement(BarraGrabacion, { voz: voz({ fase: 'grabando', secs: 4 }) }));
  assert.ok(grabando.includes('aria-label="Terminar grabación"'));
  assert.ok(!grabando.includes('aria-label="Enviar audio"'), 'mientras graba la flecha es un ✓');
  assert.ok(grabando.includes('data-onda'), 'sin la onda');
  assert.match(/data-onda="true" style="([^"]*)"/.exec(grabando)?.[1] ?? '', /flex:1/, 'la onda no llena el ancho');
  const pausa = renderToStaticMarkup(createElement(BarraGrabacion, { voz: voz({ fase: 'grabando', paused: true }) }));
  assert.ok(pausa.includes('aria-label="Seguir grabando"'), 'en pausa, reanudar es un 🎤 (no otro ▶)');
  const rev = renderToStaticMarkup(createElement(BarraGrabacion, { voz: voz({ fase: 'revisando', revision: { url: 'blob:1', secs: 4 } }) }));
  for (const r of ['aria-label="Escuchar audio"', 'aria-label="Seguir grabando"', 'aria-label="Enviar audio"', 'aria-label="Borrar el audio"']) assert.ok(rev.includes(r), `falta ${r}`);
  assert.ok(!rev.includes('Terminar grabación'));
});

// Hallazgo 8 (ver el arnés `armarMicPendiente`, arriba): la barra mientras el navegador pide el micrófono.
test('la barra con el micrófono pendiente: ⏸ y ✓ apagados, 🗑 prendido (es lo que cancela el pedido)', () => {
  const html = renderToStaticMarkup(createElement(BarraGrabacion, { voz: voz({ fase: 'grabando', pidiendoMic: true }) }));
  const boton = (rotulo: string) => new RegExp(`<button[^>]*aria-label="${rotulo}"[^>]*>`).exec(html)?.[0] ?? '';
  assert.match(boton('Terminar grabación'), /disabled=""/, 'un ✓ sin tramo que cerrar trababa la barra');
  assert.match(boton('Pausar grabación'), /disabled=""/);
  assert.ok(boton('Eliminar grabación'), 'falta el 🗑');
  assert.doesNotMatch(boton('Eliminar grabación'), /disabled=""/, 'sin el 🗑 no hay cómo cancelar el pedido del micrófono');
  // Y sin pedido pendiente, el ✓ vuelve a andar (no quedó apagado para siempre).
  const listo = renderToStaticMarkup(createElement(BarraGrabacion, { voz: voz({ fase: 'grabando' }) }));
  assert.doesNotMatch(new RegExp('<button[^>]*aria-label="Terminar grabación"[^>]*>').exec(listo)?.[0] ?? 'disabled=""', /disabled=""/);
});

test('NINGÚN composer manda al soltar: `audioAlSoltar` no decide nada, y la grabación es la sesión', () => {
  const comp = sinComentarios(leer('app/whatsapp/_shared/ComposerWhatsApp.tsx'));
  const cuerpo = comp.slice(comp.indexOf('export function ComposerWhatsApp('));
  assert.doesNotMatch(cuerpo.slice(cuerpo.indexOf('}: ComposerWhatsAppProps) {')), /audioAlSoltar/, 'el composer vuelve a mirar `audioAlSoltar`');
  assert.match(comp, /useGrabacionVoz\(async \(blob, secs\) => \{ await onAudio\?\.\(blob, secs\); \}, onErrorAudio\)/);
  for (const r of ['app/automations/GrabadorAudioPaso.tsx', 'app/automations/PasoAudioControl.tsx']) {
    const src = sinComentarios(leer(r));
    assert.match(src, /useGrabacionVoz\(subir, onError\)/, `${r} no usa la sesión de voz`);
    assert.match(src, /<BarraGrabacion voz=\{voz\}/, `${r} no dibuja la barra nueva`);
  }
  const hilo = sinComentarios(leer('app/whatsapp/_shared/ChatHilo.tsx'));
  assert.match(hilo, /key=\{draftKey \?\? 'hilo'\}/, 'una escucha a medias viajaría al chat de al lado');
});

// Revisión de la sexta tanda (10/10/2026, hallazgo 7): en /whatsapp, grabar en el chat A, terminar, tocar
// al lead B y apretar la ➤ mandaba la nota al lead A con la pantalla mostrando a B (la sesión guarda el
// `onSend` del render del 🎤, y ése lee el `sel` de A). ChatHilo ya llevaba la key; EmpresaInbox no.
// ⚠️ Acá SÓLO se sacan los comentarios de LÍNEA: el `acceptArchivo="image/*,…"` del composer abre un
// «bloque» para el regex de `sinComentarios` que se come el JSX hasta el próximo `*/` del archivo.
// PROBADO ROMPIÉNDOLO (10/10/2026, de a una y restaurando de memoria; base 28/0): sin la `key` → 27/1;
// devolviendo `audioAlSoltar` a la bandeja → 27/1; devolviéndolo al tipo del composer → 27/1.
test('/whatsapp: el composer va POR CONVERSACIÓN (`key`), y `audioAlSoltar` no existe más', () => {
  const sinLineas = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '');
  const inbox = sinLineas(leer('app/whatsapp/EmpresaInbox.tsx'));
  assert.match(inbox, /<ComposerWhatsApp\s+key=\{selConv\.chatJid\}\s+modo="enviar"/, 'una nota escuchada en el chat B salía al lead A');
  assert.doesNotMatch(inbox, /audioAlSoltar/, 'la bandeja vuelve a pedir que el audio salga al soltar');
  assert.doesNotMatch(sinLineas(leer('app/whatsapp/_shared/ComposerWhatsApp.tsx')), /audioAlSoltar/, 'la prop volvió al tipo del composer');
});

// «Esto en todos lados» (WhatsApp 7): los dos grabadores que faltaban (segunda pasada, parte «datos»).
// PROBADO ROMPIÉNDOLO (09/10/2026, arnés w2-datos/romper.mjs, restaurado de memoria): el onboarding del
// Video Generator de vuelta a `useVoiceRecorder` → 1 fallo; su barra con `alignSelf: 'center'` → 1 fallo;
// la tarea de audio del alumno con el grabador de video (`CampoGrabacionVideo`) → 1 fallo; sin el tope
// que termina la grabación → 1 fallo. Restaurado → verde.
test('el onboarding del Video Generator y la tarea de audio del alumno graban con la sesión: nada se guarda al soltar', () => {
  const vg = sinComentarios(leer('app/video-generator/OnboardingVideoGen.tsx'));
  const grabador = vg.slice(vg.indexOf('function GrabadorVoz('), vg.indexOf('const COLUMNAS_ACENTO'));
  assert.ok(grabador.length > 0 && grabador.length < 2500, `el recorte del grabador mide ${grabador.length}`);
  assert.match(grabador, /const voz = useGrabacionVoz\(onListo, setFallo\);/, 'el onboarding volvió a entregar al soltar');
  assert.doesNotMatch(vg, /useVoiceRecorder|VoiceRecorderBar/);
  assert.match(grabador, /<div style=\{\{ alignSelf: 'stretch', width: '100%' \}\}>\s*<BarraGrabacion voz=\{voz\}/, 'la barra no ocupa el ancho');
  const tarea = sinComentarios(leer('app/compartido/curso/[token]/TareaAlumno.tsx'));
  assert.match(tarea, /return p\.campo\.tipo === 'audio' \? <CampoGrabacionAudio \{\.\.\.p\} \/> : <CampoGrabacionVideo \{\.\.\.p\} \/>;/);
  const audio = tarea.slice(tarea.indexOf('function CampoGrabacionAudio('), tarea.indexOf('function CampoGrabacionVideo('));
  assert.match(audio, /const voz = useGrabacionVoz\(usar, \(m\) => setError\(m\)\);/);
  assert.match(audio, /<BarraGrabacion voz=\{voz\} ocupado=\{pct != null\} rotuloEnviar="Usar esta grabación" \/>/);
  assert.match(audio, /if \(faseVoz === 'grabando' && segVoz >= tope\) terminar\(\);/, 'el tope dejó de terminar la grabación');
  assert.match(audio, /void vozViva\.current\?\.revisarExistente\(\{ blob: b, secs \}\)/, 'una subida que falla perdería la grabación');
  // Y el grabador que entrega al soltar queda sólo donde no se manda un audio a nadie (el dictado del Plan).
  assert.doesNotMatch(sinComentarios(leer('app/whatsapp/_shared/VoiceRecorder.tsx')), /export function VoiceRecorderBar/);
});

// ── 11: la pausa entre los mensajes de una tarjeta ───────────────────────────────────────────

test('la pausa: la elegida (acotada a 10 s) o la de siempre (1 s), y el total de la tarjeta topeado', () => {
  assert.equal(PAUSA_ENTRE_PARTES_MS, 1000);
  assert.equal(pausaAntesDe({ tipo: 'texto', cuerpo: 'a' }), 1000);
  assert.equal(pausaAntesDe({ tipo: 'texto', cuerpo: 'a', pausa_s: 3 }), 3000);
  assert.equal(pausaAntesDe({ tipo: 'texto', cuerpo: 'a', pausa_s: 600 }), 10_000, 'el motor duerme en la corrida: nunca minutos');
  assert.deepEqual(sanearParte({ tipo: 'texto', cuerpo: 'a', pausa_s: 99 }), { tipo: 'texto', cuerpo: 'a', pausa_s: 10 });
  assert.deepEqual(sanearParte({ tipo: 'audio', audio_id: 3, pausa_s: -2 }), { tipo: 'audio', audio_id: 3 });
  assert.equal(pausaVisible({ tipo: 'texto', cuerpo: 'a' }, 0), null, 'la primera no tiene');
  const lista: ParteMensaje[] = [{ tipo: 'texto', cuerpo: 'a' }, { tipo: 'texto', cuerpo: 'b', pausa_s: 10 }, { tipo: 'texto', cuerpo: 'c' }];
  assert.deepEqual(pausasPosibles(lista, 2), [1, 2, 3, 5, 10], '10 + 10 entra en 20');
  // 10 + 5 + la de siempre (1) = 16: para la última quedan hasta 5 (y la de siempre también cuenta).
  const casi: ParteMensaje[] = [{ tipo: 'texto', cuerpo: 'a' }, { tipo: 'texto', cuerpo: 'b', pausa_s: 10 }, { tipo: 'texto', cuerpo: 'c', pausa_s: 5 }, { tipo: 'texto', cuerpo: 'd' }];
  assert.deepEqual(pausasPosibles(casi, 3), [1, 2, 3, 5], 'el total no pasa de 20');
  assert.equal(problemaDePartes({ canal: 'whatsapp', partes: casi }), null);
  assert.match(problemaDePartes({ canal: 'whatsapp', partes: [...casi.slice(0, 3), { tipo: 'texto', cuerpo: 'd', pausa_s: 10 }] }) ?? '', new RegExp(`tope es ${PAUSA_TOTAL_MAX_S} s`));
});

test('un audio seguido de un texto CON pausa se guarda como dos partes (el pie de antes no tiene dónde)', () => {
  const sin = formaGuardada([{ tipo: 'audio', audio_id: 3 }, { tipo: 'texto', cuerpo: 'link' }]);
  assert.deepEqual(sin.partes, [], 'sin pausa, el audio con pie de siempre');
  const con = formaGuardada([{ tipo: 'audio', audio_id: 3 }, { tipo: 'texto', cuerpo: 'link', pausa_s: 3 }]);
  assert.equal(con.partes.length, 2);
  assert.equal(con.cuerpo, '', 'el espejo de un audio no lleva el texto');
  // Y vuelve igual: lo que guarda `setSecuenciaPasos` y lo que lee el motor.
  const paso = { canal: 'whatsapp', ...con };
  assert.deepEqual(partesExplicitas(paso), [{ tipo: 'audio', audio_id: 3 }, { tipo: 'texto', cuerpo: 'link', pausa_s: 3 }]);
  assert.equal(partesAlGuardar(paso).partes?.length, 2);
});

test('el motor duerme la pausa de CADA parte (`pausaAntesDe`), no una constante', () => {
  const nut = sinComentarios(leer('lib/nutricion.ts'));
  const env = bloque(nut, 'async function enviarPartesDelPaso(', '\n}\n', 4_500);
  assert.match(env, /if \(k > 0\) await new Promise\(\(r\) => setTimeout\(r, pausaAntesDe\(p\)\)\);/);
  assert.doesNotMatch(env, /PAUSA_ENTRE_PARTES_MS/);
});

test('el editor pone la pastilla de la pausa ENTRE dos burbujas, y una edición conserva la suya', () => {
  const audios: AudioSetting[] = [];
  const paso: PasoSecuenciaDto = {
    id: 'm', orden: 1, canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo: 'a', template_wa: null, proveedor: 'no_oficial',
    partes: [{ tipo: 'texto', cuerpo: 'a' }, { tipo: 'texto', cuerpo: 'b', pausa_s: 3 }, { tipo: 'texto', cuerpo: 'c' }],
  };
  const html = renderToStaticMarkup(createElement(EditorMensajeWhatsApp, { paso, audios, adjuntos: [], onChange: () => {} }));
  assert.ok(!html.includes('data-pausa="0"'), 'antes de la primera no hay pausa');
  assert.match(html, /data-pausa="1"[\s\S]*?3 s/);
  assert.match(html, /data-pausa="2"[\s\S]*?1 s/);
  assert.equal(rotuloPausa(1.5), '1.5 s');
  assert.deepEqual(enviarALista([{ tipo: 'texto', cuerpo: 'a' }, { tipo: 'texto', cuerpo: 'b', pausa_s: 5 }], [{ tipo: 'texto', cuerpo: 'B' }], 1),
    [{ tipo: 'texto', cuerpo: 'a' }, { tipo: 'texto', cuerpo: 'B', pausa_s: 5 }]);
});

// ── 2: el número de CADA mensaje ─────────────────────────────────────────────────────────────

test('la línea de un paso: sólo un WhatsApp NO oficial; con la clave manda lo que llega, sin ella se conserva', () => {
  assert.equal(lineaDelPaso({ canal: 'whatsapp', linea: 'mako_ws9_b' }), 'mako_ws9_b');
  assert.equal(lineaDelPaso({ canal: 'email', linea: 'mako_ws9_b' }), null);
  assert.equal(lineaDelPaso({ canal: 'whatsapp', proveedor: 'oficial', linea: 'mako_ws9_b' }), null);
  assert.equal(lineaDelPaso({ canal: 'whatsapp', linea: '  ' }), null);
  const previo = { canal: 'whatsapp', linea: 'mako_ws9_b' };
  assert.deepEqual(lineaAlGuardar({ canal: 'whatsapp', linea: 'mako_ws9_c' }, previo), { linea: 'mako_ws9_c' });
  assert.deepEqual(lineaAlGuardar({ canal: 'whatsapp', linea: null }, previo), {}, 'null = volver a la de la automatización');
  assert.deepEqual(lineaAlGuardar({ canal: 'whatsapp' }, previo), { linea: 'mako_ws9_b' }, 'un escritor que no sabe de líneas la borraba');
  assert.deepEqual(lineaAlGuardar({ canal: 'email' }, previo), {});
});

test('el motor manda CADA paso por su línea, y `setSecuenciaPasos` la guarda', () => {
  const nut = sinComentarios(leer('lib/nutricion.ts'));
  assert.match(nut, /const lineaSec = lineaDelPaso\(paso\) \?\? sec\.instance_name;/);
  // La línea pedida pasa por `canalDeLinea`: si no es del negocio no está en sus líneas y no manda.
  assert.match(nut, /const canalEvo = await canalDeLinea\(lineaSec\);/);
  assert.match(bloque(nut, 'export async function setSecuenciaPasos(', '\n}\n', 12_000),
    /\.\.\.lineaAlGuardar\(p, antes\.find\(\(q, j\) => idDe\(q, j\) === idDe\(flujo, i\)\)\),/);
});

test('el selector de un mensaje guarda la de por default con SU nombre, y no dice «Toda la automatización»', () => {
  const lineas: LineaWa[] = [{ linea: 'mako_ws9', rotulo: '+54 9', estado: 'conectado', esDefault: true }, { linea: 'mako_ws9_b', rotulo: 'Ventas', estado: 'conectado', esDefault: false }];
  assert.equal(lineaElegida('', lineas, false), null, 'la automatización: null es la de por default');
  assert.equal(lineaElegida('', lineas, true), 'mako_ws9', 'un mensaje: null sería «la de la automatización»');
  assert.equal(lineaElegida('mako_ws9_b', lineas, true), 'mako_ws9_b');
  assert.doesNotMatch(sinComentarios(leer('app/automations/SalidaWhatsApp.tsx')), /Toda la automatización/);
});

// ── 4, 5, 6, 9 y 12: el editor y la tarjeta ──────────────────────────────────────────────────

const pasoAudioTexto: PasoSecuenciaDto = {
  id: 'm', orden: 1, canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo: '', template_wa: null, proveedor: 'no_oficial',
  tipo: 'audio', audio_id: 7, partes: [{ tipo: 'audio', audio_id: 7 }, { tipo: 'texto', cuerpo: 'Te dejo el link abajo', pausa_s: 2 }],
};
const audio7: AudioSetting = { id: 7, titulo: 'Bienvenida', media_mime: 'audio/mpeg', duracion_s: 3, transcript: null, url: 'a.mp3' };

test('los botones van PEGADOS a la burbuja (la fila pone el tope) y cada burbuja lleva la hora y el ✓✓', () => {
  const html = renderToStaticMarkup(createElement(EditorMensajeWhatsApp, { paso: pasoAudioTexto, audios: [audio7], adjuntos: [], onChange: () => {} }));
  const fila = html.slice(html.indexOf('data-parte="1"'));
  assert.match(fila, /flex:0 1 auto;min-width:0;max-width:calc\(100% - 70px\)/, 'el envoltorio no se ajusta a la burbuja');
  assert.doesNotMatch(fila.slice(0, 1_200), /max-width:78%/, 'la burbuja con su 78% dejaba el hueco entre los botones y el mensaje');
  assert.equal((html.match(/viewBox="0 0 16 11"/g) ?? []).length, 2, 'faltan las palomitas');
  assert.ok(/\d\d:\d\d/.test(html), 'sin la hora');
});

test('mientras se graba sólo aparece el guion que PROPUSO MaKo; ya no hay botón de pedirlo ahí', () => {
  const ed = sinComentarios(leer('app/automations/EditorMensajeWhatsApp.tsx'));
  assert.match(ed, /const mientrasGraba: ReactNode = guionMaKo \? \(/);
  assert.doesNotMatch(ed, /chat-agent\/onboarding\/guion-audio|RUTA_GUION|✦ guion/, 'volvió el «✦ guion» adentro de la grabación');
  // «Grabar con este guion» lo deja para leer y arranca a grabar en el mismo clic.
  const usar = bloque(ed, 'const usarGuion = (g: string) => {', '\n  };', 600);
  assert.match(usar, /ponerGuion\(g\);/);
  assert.match(usar, /composer\.current\?\.grabar\(\);/);
});

test('editar un audio abre la barra de escucharlo (con 🎤 para seguir), no el chip con una ✕', () => {
  const ed = sinComentarios(leer('app/automations/EditorMensajeWhatsApp.tsx'));
  assert.match(ed, /\? \{ url: audioEditado\.url, secs: audioEditado\.duracion_s, seguir: permiteAudio, rotuloUsar: 'Dejar este audio', onDescartar: /);
  assert.match(ed, /audioPendiente=\{audioPendiente\}/);
  const editar = bloque(ed, 'const editar = (i: number) => {', '\n  };', 1_000);
  assert.match(editar, /else \{ setAdjunto\(null\); escribir\(''\); \}/, 'un audio editado volvía como chip («Bienvenida ✕»)');
});

test('la tarjeta: «+1 mensaje…» abajo a la derecha, y el texto largo termina en «…» ADENTRO del alto estimado', () => {
  assert.equal(textoMasPartes(1), '+1 mensaje…');
  assert.equal(textoMasPartes(3), '+3 mensajes…');
  for (const largo of [10, 60, 140, 260, 600, 2000]) {
    for (const mas of [0, 2]) {
      const cuerpo = 'a'.repeat(largo);
      const partes = mas ? [{ tipo: 'texto' as const, cuerpo }, ...Array.from({ length: mas }, () => ({ tipo: 'texto' as const, cuerpo: 'otro' }))] : undefined;
      const paso = { id: 'x', orden: 1, canal: 'whatsapp' as const, delay_horas: 0, asunto: null, template_wa: null, tipo: 'texto' as const, cuerpo, ...(partes ? { partes } : {}) } as PasoSecuenciaDto;
      const lineas = renglonesDeTarjeta(paso, mas);
      const alto = altoDeMensaje(paso as unknown as Parameters<typeof altoDeMensaje>[0]);
      assert.ok(lineas >= 1 && lineas <= 5);
      assert.ok(47 + 18 + 6 + lineas * 18.125 + (mas ? 20 : 0) <= alto, `con ${largo} letras y +${mas} los ${lineas} renglones no entran en ${alto}`);
    }
  }
  const vista = bloque(sinComentarios(leer('app/automations/FlujoLienzo.tsx')), 'function VistaMensaje(', '\nfunction VistaEmail(', 4_500);
  assert.match(vista, /lineas=\{renglonesDeTarjeta\(paso, mas\)\}/, 'la tarjeta no corta con el alto que estima el árbol');
  assert.match(vista, /textAlign: 'right' \}\}>\{textoMasPartes\(mas\)\}/);
});

test('lo que propone MaKo: «Usar» reemplaza los mensajes, «Agregar» los suma, con el tope', () => {
  const lista: ParteMensaje[] = [{ tipo: 'audio', audio_id: 3 }];
  assert.deepEqual(propuestaALista(lista, ['Hola', '  '], 'reemplazar'), [{ tipo: 'texto', cuerpo: 'Hola' }]);
  assert.deepEqual(propuestaALista(lista, ['Hola'], 'agregar'), [{ tipo: 'audio', audio_id: 3 }, { tipo: 'texto', cuerpo: 'Hola' }]);
  assert.equal(propuestaALista([], Array.from({ length: 9 }, (_, i) => `m${i}`), 'reemplazar').length, 6);
});

// ── 3: el ✦ de MaKo que ayuda a escribir ─────────────────────────────────────────────────────

test('el pedido: sin pedido y sin mensaje no hay qué escribir; los textos topeados', () => {
  assert.equal(pedidoDeRedacta({ pedido: '  ', actual: '' }), null);
  const p = pedidoDeRedacta({ pedido: 'que agende', actual: '', permiteAudio: true, objetivo: 'x'.repeat(900) });
  assert.equal(p?.pedido, 'que agende');
  assert.equal(p?.objetivo.length, 200);
  assert.equal(p?.permiteAudio, true);
  assert.equal(pedidoDeRedacta({ pedido: 'x', permiteAudio: 'si' })?.permiteAudio, false, 'sólo un true literal');
});

test('lo que escribe el modelo: sin links inventados, sin voseo, sin variables que el motor no conoce; el guion sin piso', () => {
  const permitido = 'agenda en https://cal.com/negocio/30min';
  const r = revisarRedacta({
    mensajes: ['Hola {{nombre}}, agenda aquí: https://cal.com/negocio/30min', 'Mirá esto que tenés', 'Entra a https://inventado.com', 'Te escribo {{cupon}} ya'],
    audio: 'Hola, te dejo el link abajo.',
    nota: 'null',
  }, permitido, true);
  assert.deepEqual(r.mensajes, ['Hola {{nombre}}, agenda aquí: https://cal.com/negocio/30min', 'Te escribo  ya']);
  assert.equal(r.descartes.length, 2, `descartes: ${r.descartes.join(' | ')}`);
  assert.equal(r.audio, 'Hola, te dejo el link abajo.', 'un guion corto es un guion («debería poder crearlo igualmente»)');
  assert.equal(r.nota, null);
  assert.equal(revisarRedacta({ mensajes: ['a'], audio: 'Hola' }, '', false).audio, null, 'sin audio por este canal');
  assert.equal(revisarRedacta({ audio: Array.from({ length: 200 }, () => 'palabra').join(' ') }, '', true).audio, null, 'eso ya no es una nota de voz');
  assert.equal(sinVariablesAjenas('{{NOMBRE}} y {{otra}}'), '{{nombre}} y ');
});

test('el prompt ofrece las variables del catálogo VIVO del motor y lee lo que le dio el registro', () => {
  const sys = redactaSystem();
  for (const v of [...VARIABLES_LEAD, ...VARIABLES_NEGOCIO]) assert.ok(sys.includes(`{{${v.key}}}`), `falta {{${v.key}}}`);
  assert.ok(!sys.includes('{{variables}}'));
  const u = userDeRedacta(pedidoDeRedacta({ pedido: 'que agende', actual: 'Hola', permiteAudio: false })!, [{ rotulo: 'tu negocio', texto: 'Vendo casas' }]);
  assert.ok(u.includes('## TU NEGOCIO\nVendo casas'));
  assert.ok(u.includes('NO (no propongas audio)'));
  assert.ok(u.includes('mejóralo'));
});

test('el contexto sale del REGISTRO de la API de MaKo (lecturas que existen), y la ruta no paga ni guarda', () => {
  for (const l of LECTURAS_REDACTA) {
    const d = porId(l.id);
    assert.ok(d, `«${l.id}» no existe en el registro`);
    assert.equal(d!.tipo, 'lectura', `«${l.id}» no es una lectura`);
  }
  const ruta = sinComentarios(leer('app/api/chat-agent/redactar/route.ts'));
  assert.match(ruta, /ejecutarOperacion\(l\.id, l\.input \?\? \{\}, ctx, 'json'\)/);
  assert.match(ruta, /\(await getRolWsEfectivo\(\)\) !== 'admin'/);
  assert.doesNotMatch(ruta, /chatClaude|from '@\/lib\/anthropic'|setSecuenciaPasos|\.from\(/, 'la ruta paga, o escribe');
  assert.match(ruta, /pin\.provider !== 'anthropic' && pin\.provider !== 'openai'/, 'un pin pago se usaría');
  assert.match(ruta, /motivo: `⚠ red de plataforma/);
  assert.match(ruta, /errorDeCascada\(errores, 'escribir el mensaje'\)/, 'los errores de la red eligieran el texto del cliente');
});

// Revisión de la sexta tanda (10/10/2026, hallazgo 9): con `sinVoz: true` el panel ofrece «Que la aprenda
// MaKo» y «Escribirla yo», y los dos terminan en `setVozGuia` sin comparar con lo que había. La ruta leía
// con `getVozGuia` (vía `getSetting`, que vuelve null un error de Supabase) + `.catch(() => null)`: un
// negocio con su guía escrita a mano, ante una lectura caída, veía que no tenía voz y un clic se la pisaba.
// PROBADO ROMPIÉNDOLO (10/10/2026, restaurando de memoria; base 32/0): `sinVoz: !hayVoz` (null = «no hay»)
// → 31/1; la lectura estricta sin su `.catch` (una lectura caída tira el ✦ entero) → 31/1;
// `hayVozGuiaEstricto` leyendo con `getSetting` → 31/1.
test('el ✦ ofrece configurar la voz sólo si SE MIDIÓ que no hay: «no pude leer» no es «no tienes voz»', () => {
  const ruta = sinComentarios(leer('app/api/chat-agent/redactar/route.ts'));
  assert.match(ruta, /hayVozGuiaEstricto\(\)\.catch\(\(\) => null\)/, 'una lectura caída tumbaría la propuesta entera');
  assert.match(ruta, /sinVoz: hayVoz === false,/, 'con la lectura caída el panel ofrece pisar la guía');
  assert.doesNotMatch(ruta, /getVozGuia\(/, 'la lectura tolerante convierte «no pude leer» en «no hay voz»');
  // Y la estricta TIRA de verdad: lee con `getSettingEstricto`, no con `getSetting`.
  const est = bloque(sinComentarios(leer('lib/nutricion-generator.ts')), 'export async function hayVozGuiaEstricto(', '\n}\n', 400);
  assert.match(est, /await getSettingEstricto\(KEY_VOZ\)/);
});

// ── MaKo en WhatsApp 1 y 2 ───────────────────────────────────────────────────────────────────

test('«MaKo en WhatsApp»: el MISMO editor, UN texto, con «{ }», sin mic ni clip, firmado por MaKo', () => {
  const html = renderToStaticMarkup(createElement(EditorMensajeGrupo, { texto: 'Llegó {{nombre}}', onTexto: () => {} }));
  assert.ok(html.includes('aria-label="Insertar un dato"'));
  assert.ok(html.includes('aria-label="Emojis"'));
  assert.ok(!html.includes('Grabar nota de voz') && !html.includes('Adjuntar archivo'));
  assert.ok(html.includes('>MaKo<'), 'la burbuja no la firma MaKo');
  assert.ok(renderToStaticMarkup(createElement(CabeceraMakoEnWhatsApp)).includes('MaKo en WhatsApp'));
  const flujo = sinComentarios(leer('app/automations/FlujoLienzo.tsx'));
  assert.match(flujo, /if \(paso && esMako\(paso\)\) return <CabeceraMakoEnWhatsApp \/>;/);
  assert.match(bloque(flujo, 'function cabeceraDe(', '\n}\n', 800), /if \(claseDe\(paso\) === 'accion'\) return esMako\(paso\);/);
});

// ── Probado rompiéndolo (09/10/2026), de a una y restaurando DE MEMORIA (arnés del scratchpad). ──
// Base 26/0; 27 roturas, 27 cazadas (pasan/fallan):
//  R1 la burbuja vuelve a `min(240px, 100%)` (el bug)                   → 25/1
//  R2 ✓ entrega en el acto, como antes                                  → 22/4
//  R3 la ➤ no vacía la revisión antes de entregar (dos clics, dos envíos) → 25/1
//  R4 🎤 reemplaza el tramo en vez de sumarlo                            → 24/2
//  R5 la barra grabando con la ➤ «Enviar audio» en vez del ✓             → 25/1
//  R6 ChatHilo sin el composer por conversación (`key`)                  → 25/1
//  R7 la pausa sin el tope de 10 s                                       → 25/1
//  R8 sin el tope de 20 s por tarjeta                                    → 25/1
//  R9 audio + texto con pausa colapsado al pie de siempre                → 25/1
//  R10 el motor duerme una constante                                     → 25/1
//  R11 sin la clave, la línea del paso se pierde                         → 25/1
//  R12 el motor manda por la línea de la secuencia                       → 25/1
//  R13 `setSecuenciaPasos` sin guardar la línea                          → 25/1
//  R14 un mensaje guarda `null` por la de por default                    → 25/1
//  R15 la burbuja vuelve a topearse sola (el hueco de WhatsApp 4)        → 25/1
//  R16 sin las palomitas                                                 → 25/1
//  R17 mientras graba se lee el texto aunque MaKo no propuso nada        → 25/1
//  R18 «Grabar con este guion» no arranca a grabar                       → 25/1
//  R19 editar un audio vuelve a ser el chip                              → 25/1
//  R20 la tarjeta corta siempre a 5 renglones                            → 25/1
//  R21 un link inventado pasa                                            → 25/1
//  R22 vuelve el piso de 25 palabras del guion                           → 25/1
//  R23 el prompt con sólo las variables del lead                         → 25/1
//  R24 la ruta sin el guard de admin                                     → 25/1
//  R25 una lectura que no existe en el registro                          → 25/1
//  R26 «MaKo en WhatsApp» con micrófono                                  → 25/1
//  R27 la tarjeta MAKO sin su cabecera                                   → 25/1
