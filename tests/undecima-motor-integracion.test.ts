// =============================================================================
// Undécima tanda, ola 3 (w3-motor-integracion): el motor y Publicar adoptan lo de las olas 1 y 2
// =============================================================================
// Lo que Martín pidió y esto cuida (docs/diseno-undecima-tanda.md §1.11, §2 puntos 4, 6, 11-13 y decisiones 3 y 4,
// §5 y §6):
//   · punto 4: «En el mensaje dice "{{Mensaje de MaKo}}", ese dato NO existe... No es trackeable» → Publicar valida
//     los datos de TODA tarjeta (`problemasDeTokens`) en el server (`setSecuenciaPasos`, la API hereda el 400) y en el
//     lienzo (`frenoDelFlujo`), con la tarjeta a abrir. El RUNTIME no cambia: lo ya guardado (#239, #240) sigue
//     saliendo hasta que el script de flujos lo archive (§8.7);
//   · punto 6: «normalmente hay muchos datos que se pueden citar» → TODO envío del motor pone los datos con la MISMA
//     regla (`textoConDatos`: el renglón que nombra un dato sin valor se va entero), y la charla (`lead_contesta`)
//     pasa lo que escribió el lead como dato (`{{lead_escribio}}`);
//   · decisión 4 de la décima: «siempre por ubicación que se maneje por defecto» → la hora citada es la del NEGOCIO
//     para el lead Y para el equipo (`zonaPara` ya no mira el destino);
//   · punto 13: «El "Hasta" siempre es atado al objetivo» → `unaVez` / `hasta: 'una'` no existen;
//   · punto 11: «Toda la cantidad de tarjetas de "AI Step" deberían ser una sola» → `grafoAGuardar` junta
//     (`juntarPasosIA`).
// La zona del motor y el email en positivo tienen sus tests (tests/motor-freno-ventana.test.ts,
// tests/zona-negocio.test.ts, tests/decima-remitente-mako.test.ts).
//
// lib/nutricion.ts y lib/variables-resolver.ts son `server-only`: se leen sus fuentes SIN comentarios, recortados a su
// bloque. Lo puro (el freno, los datos, el evento) se ejecuta.
//
// PROBADO ROMPIÉNDOLO: ver ROTURAS al pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { frenoDelFlujo } from '../lib/flujo-conversacion';
import { problemasDeTokens } from '../lib/tokens-del-flujo';
import { pasosDelEvento } from '../lib/aviso-evento';
import { textoConDatos, valoresDeLoEscrito } from '../lib/variables-del-lead';
import { TRIGGER_AVISO_MAKO } from '../lib/disparadores';
import type { PasoGrafo } from '../lib/flujo-grafo';

const RAIZ = join(__dirname, '..');
const leer = (r: string): string => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const bloque = (src: string, abre: string, cierra: string, tope: number): string => {
  const i = src.indexOf(abre);
  assert.ok(i >= 0, `no encontré «${abre}»`);
  const f = src.indexOf(cierra, i + abre.length);
  assert.ok(f > i, `no encontré el cierre de «${abre}»`);
  const b = src.slice(i, f);
  assert.ok(b.length < tope, `el recorte de «${abre}» mide ${b.length}: está mirando otra cosa`);
  return b;
};
const NUT = sinComentarios(leer('lib/nutricion.ts'));
const RES = sinComentarios(leer('lib/variables-resolver.ts'));

const RELLENO = { orden: 0, canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo: '', template_wa: null, proveedor: 'no_oficial' } as const;
const wa = (id: string, cuerpo: string): PasoGrafo => ({ ...RELLENO, id, cuerpo, siguiente: null }) as PasoGrafo;
const mako = (id: string, mensaje: string): PasoGrafo =>
  ({ ...RELLENO, id, siguiente: null, accion: { operacion: 'avisar_al_equipo', params: { leadId: 'evento', mensaje } } }) as PasoGrafo;

// ── 1. Los datos: TODO envío del motor pasa por `textoConDatos` ───────────────────────────────────

test('1. por qué: un renglón con un dato sin valor se va entero (el «Nuevo agendado» de §3)', () => {
  const aviso = '🎯 *Nuevo agendado*: {{nombre_completo}} reservó su {{reunion_cual}}.\nVino del anuncio "{{lead_utm_campaign}}".\n📱 {{lead_telefono}}\n✉️ {{lead_email}}\n\n👉 {{link_lead}}';
  const vars = { nombre_completo: 'Ana López', reunion_cual: '1ª reunión', lead_telefono: '+52 664 000 0000', link_lead: 'https://hola-mako.com/crm/5' };
  assert.equal(textoConDatos(aviso, vars),
    '🎯 *Nuevo agendado*: Ana López reservó su 1ª reunión.\n📱 +52 664 000 0000\n\n👉 https://hola-mako.com/crm/5',
    'sin el renglón opcional, «Vino del anuncio "{{lead_utm_campaign}}"» y «✉️ {{lead_email}}» llegaban crudos');
  // Lo que escribió el lead (la charla) es un dato, con su tope; vacío no entra (y su renglón se va).
  assert.deepEqual(valoresDeLoEscrito('  ¿cuánto cuesta?  '), { lead_escribio: '¿cuánto cuesta?' });
  assert.deepEqual(valoresDeLoEscrito(undefined), {});
});

test('1. el motor: ningún envío pone los datos «crudos»; sólo el asunto y el preheader (una línea) usan `aplicarVariables`', () => {
  // `aplicarVariables` sin el renglón opcional, SÓLO en el asunto y el preheader del email: son UNA línea, y el renglón
  // opcional se llevaría el asunto entero («(sin asunto)»).
  const crudos = [...NUT.matchAll(/aplicarVariables\((?:[^()]|\([^()]*\))*\)/g)].map((m) => m[0]);
  assert.deepEqual(crudos, ["aplicarVariables(paso.asunto ?? '', vars)", "aplicarVariables(paso.preheader ?? '', vars)"],
    'un envío del motor volvió a poner los datos sin el renglón opcional');
  assert.doesNotMatch(NUT, /resolverVariables\(/);
  // Cada envío, con la MISMA regla.
  const partes = bloque(NUT, 'async function enviarPartesDelPaso(', '\n}\n', 6_000);
  assert.match(partes, /const t = textoConDatos\(p\.cuerpo, a\.vars\);\s*if \(!t\.trim\(\)\) continue;/, 'una parte de WhatsApp');
  assert.match(partes, /const caption = textoConDatos\(p\.cuerpo \?\? '', a\.vars\)\.trim\(\);/, 'el pie de un archivo');
  assert.match(NUT, /const cuerpoNO = textoConDatos\(textoDelPaso\(paso\), varsNO\);/, 'el WhatsApp no oficial (texto, audio y archivo)');
  assert.match(NUT, /\? \{ texto: textoConDatos\(r\.texto, varsNO\), autor: 'ia' \}/, 'el paso en modo IA');
  assert.match(NUT, /const texto = textoConDatos\(b\.texto, varsNO\);/, 'el borrador de varias partes');
  assert.match(NUT, /const cuerpo = textoConDatos\(paso\.cuerpo, vars\);/, 'el cuerpo del email');
  assert.match(NUT, /const pie = textoConDatos\(textoDelPaso\(p\), await datosParaElLead\(/, 'el mensaje de una rama de «Si responde»');
  // Instagram y Messenger: Zernio recibe el texto FINAL (`partesConDatos`) y ningún dato más (`vars: {}`), así no se
  // ponen dos veces.
  const social = bloque(NUT, '} else if (esCanalSocial(paso.canal)) {', "} else if (waOn && paso.canal === 'whatsapp' && paso.proveedor === 'no_oficial') {", 3_000);
  assert.match(social, /partes: partesConDatos\(partesDe\(paso\), varsSocial\),\s*vars: \{\},/);
  const pcd = bloque(NUT, 'function partesConDatos(', '\n}\n', 600);
  assert.equal((pcd.match(/textoConDatos\(p\.cuerpo, vars\)/g) ?? []).length, 2, 'el texto y el pie de un archivo');
  // Un mensaje que quedó vacío (cada renglón nombraba un dato sin valor) no sale en blanco: se omite.
  assert.match(NUT, /if \(!t\.texto\.trim\(\)\) \{\s*estado = 'omitido'; nota = 'quedó vacío: sus datos no tienen valor';/);
});

test('1. la tarjeta «MaKo en WhatsApp» (flujo, evento y ⚡ Acción): `conVariables` = `textoConDatos`', () => {
  const con = bloque(RES, 'export async function conVariables(', '\n}\n', 600);
  assert.match(con, /return textoConDatos\(texto, await valoresDeVariables\(ctx, texto, datos\)\);/);
  assert.doesNotMatch(RES, /resolverVariables\(/, 'el resolvedor volvió a poner los datos sin el renglón opcional');
  // lib/flujos.ts no pone datos por su cuenta: las dos tarjetas pasan por `conVariables`.
  const flujos = sinComentarios(leer('lib/flujos.ts'));
  assert.doesNotMatch(flujos, /aplicarVariables\(|resolverVariables\(|textoConDatos\(/);
  assert.equal((flujos.match(/conVariables\(/g) ?? []).length, 2);
  // `{{mensaje_mako}}` SE SIGUE INYECTANDO en el evento hasta la limpieza (§8.7): #239 y #240 viven hasta el script.
  assert.match(flujos, /\.\.\.\(ctx\.texto \? \{ \[CLAVE_MENSAJE_MAKO\]: ctx\.texto \} : \{\}\)/);
});

test('1. «Un lead contesta»: los emisores del motor pasan lo que ESCRIBIÓ como dato (`{{lead_escribio}}`)', () => {
  const emisiones = [...NUT.matchAll(/emitirDelCatalogo\('wa-mensaje-entrante', \{([\s\S]*?)\n\s*\}\);/g)].map((m) => m[1]);
  assert.equal(emisiones.length, 3, 'la charla cerrada, la redacción y el aviso de «Si responde»');
  // (16/10/2026: los dos del AI Step citan lo que DIJO en una nota de voz, con 🎤: `escritoParaElAviso`. La charla
  // cerrada no escucha —no hay quien conteste— y sigue con lo escrito.)
  for (const e of emisiones) assert.match(e, /\n\s*datos: valoresDeLoEscrito\((texto|escritoParaElAviso\(texto, c\.voz\))\),/, 'un aviso de la charla sin lo que escribió el lead');
  // Y el del hand-off (lib/chat-agent-handoff.ts), que lo hizo la ola 1.
  assert.match(sinComentarios(leer('lib/chat-agent-handoff.ts')), /datos: valoresDeLoEscrito\(input\.mensaje\),/);
});

// ── 2. Publicar valida los datos de TODA tarjeta ────────────────────────────────────────────────

test('2. el server: `setSecuenciaPasos` frena con `problemasDeTokens` (y Activar también), con la tarjeta a abrir', () => {
  const pub = bloque(NUT, 'export async function setSecuenciaPasos(', '\n}\n', 16_000);
  const datos = pub.indexOf('problemasDeTokens(grafo, triggerDeLaFila, await subtipoDeFilaEvento(supabase, id, previo))');
  assert.ok(datos > 0, 'Publicar no valida los datos de las tarjetas');
  assert.ok(pub.indexOf('const errores = validarGrafo(grafo);') < datos, 'primero la forma, después los datos');
  assert.ok(datos < pub.indexOf('if (o?.soloValidar) return;'), 'Activar no validaría los datos');
  assert.ok(datos < pub.indexOf('.update({ pasos: grafo,'), 'se escribiría antes de validar');
  assert.match(pub, /if \(datoMalo\) throw new PasosInvalidosError\(`No se guardó: \$\{datoMalo\.motivo\}`, datoMalo\.tarjeta\);/);
  assert.match(pub, /const triggerDeLaFila = String\(\(previo as \{ trigger_tipo\?: unknown \} \| null\)\?\.trigger_tipo \?\? ''\);/);
  // El evento de la fila, leído SÓLO para una fila de evento, y una lectura que falla tira.
  const sub = bloque(NUT, 'async function subtipoDeFilaEvento(', '\n}\n', 1_200);
  assert.match(sub, /!== TRIGGER_AVISO_MAKO\) return undefined;/);
  assert.match(sub, /if \(error\) throw new Error\(/);
  assert.match(sub, /return eventoDeFila\(\{ trigger_tipo: TRIGGER_AVISO_MAKO,/);
  // El error lleva la tarjeta (la API lo contesta 400 por `PasosInvalidosError`).
  assert.match(NUT, /constructor\(m: string, tarjeta: string \| null = null\) \{ super\(m\); this\.name = 'PasosInvalidosError'; this\.tarjeta = tarjeta; \}/);
  // ENCHUFADA (cierre de la ola 3): Activar la conserva, la ruta de Publicar la contesta y el lienzo la abre.
  // Probado rompiéndolo (wf-undecima/enchufador/roturas.cjs): la ruta sin `tarjeta` → 28 / 2 (con flujo-motor-grafo,
  // base 30 / 0); el lienzo sin `problemasDeTokens` → 22 / 2 (con flujo-conversacion, base 24 / 0).
  assert.match(NUT, /throw new PasosInvalidosError\(e\.message\.replace\(\/\^No se guardó:\/, 'No se activó:'\), e\.tarjeta\);/);
  assert.match(sinComentarios(leer('app/api/whatsapp/secuencias/route.ts')),
    /if \(err instanceof PasosInvalidosError\) return Response\.json\(\{ ok: false, error: msg, \.\.\.\(err\.tarjeta \? \{ tarjeta: err\.tarjeta \} : \{\}\) \}, \{ status: 400 \}\);/);
  const perfil = sinComentarios(leer('app/automations/SecuenciaPerfil.tsx'));
  assert.match(perfil, /const tarjeta = typeof rp\.tarjeta === 'string' && rp\.tarjeta \? rp\.tarjeta : e \? tarjetaDelError\(e, pasos\) : null;/);
  // Y el lienzo frena con la MISMA `problemasDeTokens` antes de mandar (el CRON y el evento de la fila).
  assert.match(perfil, /frenoDelFlujo\(ps, faltanEnAccion, problemasDeTokens\(ps, disparo\.trigger_tipo, eventoMako \?\? undefined\)\)/);
});

test('2. el lienzo: `frenoDelFlujo` frena con lo que `problemasDeTokens` encontró, DESPUÉS de lo estructural', () => {
  const malo = [wa('w1', 'Hola {{nombre}}, mira {{link_crm}}')];
  const datos = problemasDeTokens(malo, 'etapa_actual');
  assert.deepEqual(frenoDelFlujo(malo, null, datos), { error: 'No existe: {{link_crm}}', tarjeta: 'w1' });
  // El #239 de hoy: «MaKo en WhatsApp» con `{{mensaje_mako}}` en el evento «Un lead agenda».
  const de239 = [mako('ma_aviso', '{{mensaje_mako}}')];
  assert.deepEqual(frenoDelFlujo(de239, null, problemasDeTokens(de239, TRIGGER_AVISO_MAKO, 'lead_agendo')),
    { error: 'No existe: {{mensaje_mako}}', tarjeta: 'ma_aviso' });
  // Lo estructural primero: una tarjeta vacía se completa antes de discutir sus datos.
  assert.deepEqual(frenoDelFlujo([wa('w1', '')], null, [{ tarjeta: 'w1', motivo: 'No existe: {{x}}' }]),
    { error: 'Falta completar «WHATSAPP»', tarjeta: 'w1' });
  // Sin datos (quien no conoce la fila), como antes; y un flujo bien escrito no frena.
  assert.equal(frenoDelFlujo(malo, null), null);
  const bien = [wa('w1', 'Hola {{nombre}}, te recuerdo tu reunión {{reunion_cuando}} a las {{reunion_hora}}.\nPara entrar: {{reunion_link}}')];
  assert.equal(frenoDelFlujo(bien, null, problemasDeTokens(bien, 'etapa_actual')), null);
  // El valor de `problemasDeTokens` NO se importa en lib/flujo-conversacion.ts (el ciclo con lib/disparadores.ts).
  assert.doesNotMatch(sinComentarios(leer('lib/flujo-conversacion.ts')), /^import \{[^}]*\} from '\.\/tokens-del-flujo';/m);
});

test('2. es PUBLICAR, no el runtime: el emisor del evento sigue corriendo el #239 de hoy hasta el script', () => {
  const t = pasosDelEvento([mako('ma_aviso', '{{mensaje_mako}}')], 'lead_agendo');
  assert.equal(t.problema, null, 'el motor dejaría de mandar el aviso de #239/#240 entre el deploy y el script');
  assert.equal(t.pasos.length, 1);
});

// ── 3. La zona de la hora citada no mira el destino ──────────────────────────────────────────────

test('3. `zonaPara` es la zona del NEGOCIO, la misma para el lead y para el equipo', () => {
  const z = bloque(RES, 'async function zonaPara(', '\n}\n', 300);
  assert.match(z, /^async function zonaPara\(ws: number\): Promise<string> \{\s*return zonaDelNegocio\(ws\);$/);
  assert.doesNotMatch(z, /destino|equipo|lead/, 'la zona volvió a depender de a quién le llega');
  assert.match(RES, /\? await zonaPara\(ctx\.ws\)\.catch\(\(\) => null\) : null;/);
  assert.doesNotMatch(RES, /zonaDelMotor|getSetting\(KEY_TIMEZONE\)|tzDeWorkspace/, 'una segunda lectura de la zona');
});

// ── 4. AI Step: uno por medio al guardar, y sin «Hasta» ─────────────────────────────────────────

test('4. `grafoAGuardar` JUNTA (`juntarPasosIA`), y «Hasta una respuesta» no existe', () => {
  const g = bloque(NUT, 'function grafoAGuardar(', '\n}\n', 400);
  assert.match(g, /const junto = juntarPasosIA\(normalizar\(limpio\)\);/);
  assert.doesNotMatch(NUT, /separarPasosIA/);
  assert.doesNotMatch(NUT, /unaVez|trasUna|hasta === 'una'|Contestó una vez/, 'volvió «Hasta una respuesta» al redactor');
  const esc = bloque(sinComentarios(leer('lib/setting-estrategia.ts')), 'export type EscenarioSecuencia = {', '\n};', 2_000);
  assert.doesNotMatch(esc, /\bhasta\??:/, 'el escenario volvió a tener «Hasta»');
});

// ── ROTURAS (11/10/2026, arnés scratchpad/wf-undecima/w3-motor-integracion/romper.cjs) ─────────────────────────
// Una por vez sobre el worktree, restaurada desde la copia en memoria y comparada por md5 (nunca `git checkout`).
// Corridos juntos: este archivo + tests/motor-freno-ventana + tests/zona-negocio + tests/motor-tick +
// tests/decima-remitente-mako + tests/decima-revision. Base 51 pasan / 0 fallan; al final, igual. «pasan / fallan»:
//   R1. `zonaDelMotor` vuelve a Ciudad de México sin zona (lib/nutricion-grafo-motor.ts)      → 48 / 3 (motor-freno-ventana
//       «sin zona…», zona-negocio «UN solo default» y su barrido)
//   R2. la ventana del motor cae a Ciudad de México si no puede leer la zona (`zonaDeLaVentana`) → 49 / 2 (el corte de
//       motor-freno-ventana y el barrido de zona-negocio)
//   R3. el WhatsApp no oficial con `aplicarVariables` crudo (`cuerpoNO`)                         → 50 / 1 (1. el motor)
//   R4. Publicar sin `problemasDeTokens` (`setSecuenciaPasos` no frena)                          → 50 / 1 (2. el server)
//   R5. `frenoDelFlujo` ignora los datos                                                         → 50 / 1 (2. el lienzo)
//   R6. `zonaPara` vuelve a mirar el destino (al lead, Ciudad de México)                          → 49 / 2 (3. y el barrido)
//   R7. `conVariables` sin el renglón opcional (`resolverVariables`)                             → 50 / 1 (1. la tarjeta)
//   R8. la charla cerrada sin lo que escribió el lead                                            → 50 / 1 (1. «Un lead contesta»)
//   R9. Instagram/Messenger con los datos crudos (`vars` a Zernio, sin `partesConDatos`)          → 50 / 1 (1. el motor)
