// =============================================================================
// Una automatización que usa un medio SIN CONECTAR (décima tanda, GENERAL 6, 11/10/2026)
// =============================================================================
// Pedido de Martín, textual: «Si un usuario está creando una automatización que utiliza un medio que aún no
// conectó, en la tarjeta lo debe decir, y al momento de probarlo también. Y claro, no dejar publicarlo hasta
// que no lo configure. Y esas configuraciones siempre allí mismo, sin salirse de la pestaña.»
// Diseño: docs/diseno-automations-configuraciones.md §2.
//
// Lo que se fija:
//   · lib/medios-automatizacion.ts, EJECUTADO: qué medio usa cada tarjeta (con la línea de cada paso), qué
//     falta, qué frena (sólo lo que se SABE sin conectar) y el chip;
//   · el server: Publicar contesta 409 con el medio, Activar lo frena en `validarActivacion`, y GUARDAR no
//     (`setSecuenciaPasos` no lo mira); la medición de WhatsApp es la fila con número;
//   · las cuatro pantallas abren EL MISMO modal (ConectarMedio), y conectar vacía las lecturas cacheadas.
//
// PROBADO ROMPIÉNDOLO: ver `ROTURAS` al pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MEDIOS, MOTIVO_MEDIO, medioDePaso, mediosQueUsa, usosDeMedios, lineaDePaso, estadoDe, faltantes, frenoDeMedios,
  chipDeTarjeta, medioDelError, consultaDeMedios, mediosDeConsulta, type EstadoMedios, type Medio,
} from '../lib/medios-automatizacion';
import type { PasoGrafo } from '../lib/flujo-grafo';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const fuente = (r: string) => sinComentarios(leer(r));
const bloque = (src: string, desde: string, hasta: string) => {
  const ini = src.indexOf(desde);
  assert.ok(ini >= 0, `no encontré «${desde}»`);
  const fin = src.indexOf(hasta, ini + desde.length);
  assert.ok(fin > ini, `no encontré «${hasta}» después de «${desde}»`);
  return src.slice(ini, fin);
};

const P = (o: Record<string, unknown>) => ({ canal: 'whatsapp', delay_horas: 0, cuerpo: 'hola', ...o }) as unknown as PasoGrafo;
const WA = P({ id: 'a' });
const OFICIAL = P({ id: 'b', template_wa: 'bienvenida' });
const EMAIL = P({ id: 'c', canal: 'email', asunto: 'x' });
const IG = P({ id: 'd', canal: 'instagram' });
const MS = P({ id: 'e', canal: 'messenger' });
const RESPUESTA = P({ id: 'f', nodo: 'respuesta' });
const RESPUESTA_IG = P({ id: 'g', nodo: 'respuesta', canal: 'instagram' });
const MAKO = P({ id: 'h', accion: { operacion: 'avisar_al_equipo', params: {} } });
const ESPERA = P({ id: 'i', nodo: 'esperar' });
const OTRA_LINEA = P({ id: 'j', linea: 'mako_ws1_b' });

const SI = { conectado: true };
const NO = (m: keyof typeof MOTIVO_MEDIO) => ({ conectado: false, motivo: MOTIVO_MEDIO[m] });
const NOSE = { conectado: null, motivo: 'No pude comprobarlo' };

test('el medio de cada tarjeta: WhatsApp sólo el no oficial; «Si responde» escucha; una acción (MaKo) no cuenta', () => {
  assert.equal(medioDePaso(WA), 'whatsapp');
  assert.equal(medioDePaso(OFICIAL), null, 'una plantilla de Meta no sale por una línea nuestra');
  assert.equal(medioDePaso(P({ id: 'k', tipo: 'audio', audio_id: 3, template_wa: 'x' })), 'whatsapp', 'un audio sale siempre por el no oficial');
  assert.equal(medioDePaso(EMAIL), 'email');
  assert.equal(medioDePaso(IG), 'instagram');
  assert.equal(medioDePaso(MS), 'messenger');
  assert.equal(medioDePaso(RESPUESTA), 'whatsapp', '«Si responde» escucha la charla de WhatsApp');
  assert.equal(medioDePaso(RESPUESTA_IG), 'instagram');
  assert.equal(medioDePaso(MAKO), null, '«MaKo en WhatsApp» sale por la línea de MaKo, no la del negocio');
  assert.equal(medioDePaso(ESPERA), null);
  assert.deepEqual(mediosQueUsa([MS, EMAIL, WA, MAKO, WA, IG]), ['whatsapp', 'email', 'instagram', 'messenger'], 'sin repetir, en el orden de MEDIOS');
  assert.deepEqual(mediosQueUsa([MAKO, ESPERA, OFICIAL]), []);
  assert.deepEqual(mediosQueUsa(null), []);
  assert.deepEqual(MEDIOS, ['whatsapp', 'email', 'instagram', 'messenger']);
});

test('la línea: la del paso si eligió otra, si no la de la automatización', () => {
  assert.equal(lineaDePaso(OTRA_LINEA, 'mako_ws1'), 'mako_ws1_b');
  assert.equal(lineaDePaso(WA, 'mako_ws1'), 'mako_ws1');
  assert.equal(lineaDePaso(WA, null), null);
  assert.deepEqual(usosDeMedios([WA, OTRA_LINEA, EMAIL, WA], 'mako_ws1'),
    [{ medio: 'whatsapp', linea: 'mako_ws1' }, { medio: 'whatsapp', linea: 'mako_ws1_b' }, { medio: 'email', linea: null }]);
});

test('el estado por línea: la que existe, la que no está (sin conectar) y la que no se pudo leer (no sé)', () => {
  const e: EstadoMedios = { whatsapp: { porDefecto: SI, lineas: { mako_ws1: SI, mako_ws1_b: NO('whatsapp') } }, email: NO('email') };
  assert.deepEqual(estadoDe(e, 'whatsapp', null), SI);
  assert.deepEqual(estadoDe(e, 'whatsapp', 'mako_ws1_b'), NO('whatsapp'));
  assert.equal(estadoDe(e, 'whatsapp', 'otra')?.conectado, false, 'una línea que ya no está es «sin conectar»');
  assert.equal(estadoDe({ whatsapp: { porDefecto: NOSE, lineas: {} } }, 'whatsapp', 'otra')?.conectado, null,
    'sin las líneas leídas, una línea que no aparece es «no sé», no «sin conectar»');
  assert.equal(estadoDe(e, 'instagram', null), undefined, 'lo que no se midió no avisa');
  assert.equal(estadoDe(null, 'email', null), undefined);
});

test('lo que falta y lo que FRENA: sólo lo que se sabe sin conectar; «no pude comprobarlo» avisa y no frena', () => {
  const e: EstadoMedios = { whatsapp: { porDefecto: NO('whatsapp'), lineas: {} }, email: NOSE, instagram: SI };
  const f = faltantes(usosDeMedios([IG, EMAIL, WA], null), e);
  assert.deepEqual(f.map((x) => [x.medio, x.conectado]), [['whatsapp', false], ['email', null]]);
  assert.deepEqual(frenoDeMedios(f), { medio: 'whatsapp', error: 'Conecta tu WhatsApp' });
  assert.equal(frenoDeMedios(faltantes(usosDeMedios([EMAIL], null), e)), null, '«no pude comprobarlo» no frena');
  assert.equal(frenoDeMedios(faltantes(usosDeMedios([IG], null), e)), null);
  assert.equal(frenoDeMedios([]), null);
});

test('el chip de la tarjeta: «Sin conectar» (frena) o «Sin comprobar» (avisa); nada si está o no se midió', () => {
  const e: EstadoMedios = { whatsapp: { porDefecto: SI, lineas: { mako_ws1: SI, mako_ws1_b: NO('whatsapp') } }, email: NOSE };
  assert.equal(chipDeTarjeta(WA, e, 'mako_ws1'), null);
  assert.deepEqual(chipDeTarjeta(OTRA_LINEA, e, 'mako_ws1'), { texto: 'Sin conectar', medio: 'whatsapp', frena: true }, 'el paso con su propia línea mira ESA');
  assert.deepEqual(chipDeTarjeta(EMAIL, e, null), { texto: 'Sin comprobar', medio: 'email', frena: false });
  assert.equal(chipDeTarjeta(IG, e, null), null, 'no medido: sin chip');
  assert.equal(chipDeTarjeta(MAKO, e, null), null);
});

test('el error de Publicar/Activar dice el medio, y la consulta al server viaja sólo con medios conocidos', () => {
  assert.equal(medioDelError('Conecta tu WhatsApp'), 'whatsapp');
  assert.equal(medioDelError('No se activó: Conecta tu email.'), 'email');
  assert.equal(medioDelError('Falta elegir la acción'), null);
  assert.equal(medioDelError(null), null);
  assert.equal(consultaDeMedios(['whatsapp', 'email']), 'medios=whatsapp%2Cemail');
  assert.deepEqual(mediosDeConsulta('email,whatsapp,ftp, instagram'), ['whatsapp', 'email', 'instagram']);
  assert.deepEqual(mediosDeConsulta(null), []);
});

// ── El server ─────────────────────────────────────────────────────────────────────────────

test('Publicar: 409 con el medio ANTES de guardar; GUARDAR (setSecuenciaPasos) no lo mira', () => {
  const ruta = fuente('app/api/whatsapp/secuencias/route.ts');
  const patch = bloque(ruta, 'if (Array.isArray(body.pasos)) {', 'if (typeof body.activa');
  const i409 = patch.indexOf('if (medios.falta) return Response.json({ ok: false, error: medios.falta.error, medio: medios.falta.medio }, { status: 409 });');
  const iGuarda = patch.indexOf('await setSecuenciaPasos(id, body.pasos as PasoSecuencia[]);');
  assert.ok(i409 > 0 && iGuarda > i409, 'Publicar guarda un flujo con el medio sin conectar');
  // Duodécima tanda: con el CRON (tests/publicar-cron-social.test.ts), y «no pude comprobarlo» sigue sin frenar.
  assert.match(patch, /const medios = await medioSinConectar\(body\.pasos as PasoSecuencia\[\], linea, disparadores\)\.catch\(\(\) => SIN_MEDIOS\);/, '«no pude comprobarlo» no frena');
  assert.match(patch, /: await lineaDeSecuencia\(id\)\.catch\(\(\) => null\);/, 'el medio no se mide con la línea de la automatización');
  const nutri = fuente('lib/nutricion.ts');
  const guardar = bloque(nutri, 'export async function setSecuenciaPasos(', '\nasync function filasCohorte<T>(');
  assert.doesNotMatch(guardar, /medioSinConectar|estadoMedios/, 'guardar no es publicar: la galería y duplicar crean borradores sin el medio');
});

test('Activar: `validarActivacion` frena un medio sin conectar, después de las reglas de Publicar', () => {
  const nutri = fuente('lib/nutricion.ts');
  const val = bloque(nutri, 'export async function validarActivacion(', '\nexport async function setSecuenciaActiva(');
  assert.match(val, /\.select\('pasos, instance_name'\)/);
  const iReglas = val.indexOf('{ soloValidar: true }');
  const iMedio = val.indexOf("const { medioSinConectar, disparadoresDeSecuencia, asegurarAvisosSociales, SIN_MEDIOS } = await import('@/lib/disparadores-canales');");
  assert.ok(iReglas > 0 && iMedio > iReglas);
  assert.match(val, /if \(medios\.falta\) throw new PasosInvalidosError\(`No se activó: \$\{medios\.falta\.error\}\.`\);/);
  assert.match(val, /medioSinConectar\([\s\S]{0,120}?, linea, disparadores\)\.catch\(\(\) => SIN_MEDIOS\)/);
});

test('la medición: WhatsApp = la fila conectada CON número; sólo se mide lo que se pide; GET ?medios=', () => {
  const dc = fuente('lib/disparadores-canales.ts');
  assert.match(dc, /l && l\.estado === 'conectado' && l\.numero \? \{ conectado: true, cuenta: l\.numero \}/, '«conectando» sin número no es conectado');
  const medir = bloque(dc, 'export async function estadoMedios(', 'export async function medioSinConectar(');
  assert.match(medir, /await Promise\.all\(usa\.map\(/, 'mide lo que no se pidió');
  assert.match(medir, /emailConectado\(\)/, 'el email no es el de `emailConectado` (sandbox o remitente de MaKo)');
  assert.match(medir, /conTope\(cuentasConectadas\(ws, plataformaDe\(m\)\), 8000\)/, 'Zernio sin tope cuelga el Publicar');
  assert.match(medir, /else out\[m\] = NO_SE;/, '«no pude» no es «sin conectar»');
  const ruta = fuente('app/api/chat-agent/secuencias/route.ts');
  assert.match(ruta, /const pedidos = req\.nextUrl\?\.searchParams\.get\('medios'\);\s*if \(pedidos != null\) \{\s*try \{ return Response\.json\(\{ ok: true, medios: await estadoMedios\(mediosDeConsulta\(pedidos\)\) \}\); \}/);
});

// ── Las pantallas ─────────────────────────────────────────────────────────────────────────

test('las cuatro pantallas abren EL MISMO modal (ConectarMedio), y el de Probar se mudó ahí', () => {
  for (const r of ['app/automations/PanelProbar.tsx', 'app/automations/FlujoLienzo.tsx', 'app/automations/SecuenciaPerfil.tsx',
    'app/automations/EditorDisparadores.tsx', 'app/automations/EditorMensajeSocial.tsx']) {
    assert.match(fuente(r), /<ConectarMedio /, `${r} no conecta ahí mismo`);
  }
  assert.doesNotMatch(fuente('app/automations/PanelProbar.tsx'), /function VincularEmisor|<EvolutionConnect /, 'volvió la copia del modal en Probar');
  // Instagram/Messenger: la ventana emergente y el sondeo, no una pestaña con `noopener` de la que no se sabe la vuelta.
  assert.doesNotMatch(fuente('app/automations/EditorMensajeSocial.tsx'), /window\.open\(j\.url, '_blank', 'noopener'\)/);
  const cm = fuente('app/automations/ConectarMedio.tsx');
  assert.match(cm, /const ventana = window\.open\('', 'mako-conectar', /, 'la ventana no se abre en el clic (el navegador la bloquea)');
  // Decimocuarta tanda: conectado = una cuenta que ANTES no estaba (con una ya conectada, «hay alguna» cerraba al instante).
  assert.match(cm, /const nueva = e\?\.ok && Array\.isArray\(e\.cuentas\) \? cuentaNueva\(antes, e\.cuentas\) : null;\n\s+if \(nueva\) \{/);
  // WhatsApp RECONECTA la línea de la automatización; sólo «Vincular nuevo» crea otra.
  assert.match(cm, /\{nueva\s*\? <EvolutionConnect key="nueva-linea" nueva /);
  assert.match(cm, /: <EvolutionConnect key=\{`linea-\$\{linea \?\? ''\}`\} linea=\{linea\} /);
});

test('conectar vacía las lecturas cacheadas: el estado de los medios y los canales del CRON', () => {
  const cm = fuente('app/automations/ConectarMedio.tsx');
  assert.match(bloque(cm, 'export function avisarMedioConectado(', '\n}'), /cacheMedios\.clear\(\);/);
  const cron = fuente('app/automations/EditorDisparadores.tsx');
  assert.match(cron, /useAlConectarMedio\(\(\) => \{ canalesDeLaVisita = null; setVuelta\(\(v\) => v \+ 1\); \}\);/, 'el CRON sigue diciendo «Conecta tu…» después de conectar');
  assert.match(cron, /\}, \[activo, vuelta\]\);/);
  // Y los pagos (Stripe o Mercado Pago) se conectan con el modal de /integraciones ABIERTO ACÁ (14/10/2026: «para una
  // integración jamás se debe salir de la tab»; antes, /integraciones en una ventana): al conectarse, se vuelve a
  // preguntar. Rotura (base en verde): sacar el `onConectado` de Stripe → 1 fallo.
  assert.doesNotMatch(cron, /window\.open\(/);
  assert.match(cron, /<BotonIntegracion servicio="stripe" [^>]*onConectado=\{\(\) => avisarMedioConectado\(\)\}>/);
  assert.match(cron, /<BotonIntegracion servicio="mercadopago" [^>]*onConectado=\{\(\) => avisarMedioConectado\(\)\}>/);
});

test('la tarjeta lleva el chip y Probar dice «Conectar»', () => {
  const fl = fuente('app/automations/FlujoLienzo.tsx');
  assert.match(fl, /const chip = paso \? chipDeTarjeta\(paso, medios, linea\?\.actual \?\? null\) : null;/);
  assert.match(fl, /<button type="button" data-chip-medio data-no-pan /, 'sin data-no-pan el lienzo se come el clic del chip');
  const pp = fuente('app/automations/PanelProbar.tsx');
  assert.match(pp, /const sinConectar = medioProbar != null && estadoDe\(estadoMedio \?\? null, medioProbar, secuencia\.instance_name \?\? null\)\?\.conectado === false;/);
  // (17/10/2026, #852: cuando la automatización sólo le habla al grupo, el botón es «Probar en el grupo»; «Conectar» es
  // el de las demás.)
  assert.match(pp, /\{rolAdmin && !real && !social && !enElGrupo && \(sinConectar\s*\? <Button size="sm" data-conectar-medio/);
  const perfil = fuente('app/automations/SecuenciaPerfil.tsx');
  // Decimocuarta tanda (punto 4): el 409 abre el modal y NO deja el chip rojo «Conecta tu …» al lado de «Activar».
  assert.match(perfil, /const medio = rp\.medio \? medioDelError\(e\) : null;\s*if \(medio\) \{ setConectarMedio\(medio\); setBusy\(null\); return; \}/);
});

// ── ROTURAS (11/10/2026) ──────────────────────────────────────────────────────────────────
// Una por vez, con el arnés config10-roturas.mjs del scratchpad (guarda el original en memoria, lo reescribe y
// comprueba el sha1; nunca `git checkout`), este archivo solo. Base: 12 pass / 0 fail.
//   M1. un paso con plantilla oficial cuenta como la línea no oficial                         → 11 / 1
//   M2. «no pude comprobarlo» (`conectado: null`) frena Publicar                             → 11 / 1
//   M3. la ruta sin el 409: Publicar guarda con el medio sin conectar                         → 11 / 1
//   M4. sin las líneas leídas, una línea desconocida da «sin conectar»                        → 11 / 1
//   M5. conectar no vacía `canalesDeLaVisita` (el CRON seguía diciendo «Conecta tu…»)       → 11 / 1
// Restaurado: 12 / 0.
// Duodécima tanda (12/10/2026; ahora 13 tests acá), arnés scratchpad/wf-duodecima/ui-boton-qr/romper.mjs sobre este
// archivo, tests/automations-duodecima-boton.test.ts y el de la décima (base 36 / 0): «salta con cualquier chip,
// también "no pude comprobarlo"» (R3), «ignora lo ya ofrecido» (R4) y «el email salta» (R5) → 34 / 2 cada una, y uno de
// los dos caídos es «el QR que salta al crear… la MISMA regla que el chip». Restaurado: 36 / 0.
// Duodécima tanda, ig-publicar (12/10/2026; `medioSinConectar` devuelve { falta, sociales } y recibe el CRON), arnés
// scratchpad/wf-duodecima/ig-publicar/romper.mjs: la ruta o Activar sin la lista del CRON → 12 / 1 cada una (base 13 / 0).
// Lo que hace el CRON lo fija tests/publicar-cron-social.test.ts.
