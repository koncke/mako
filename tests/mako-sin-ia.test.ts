// =============================================================================
// El negocio sin una IA propia: no es un bug, MaKo le pide que la conecte, y la grilla dice la verdad (18/10/2026)
// =============================================================================
// Los tickets #5 y #6 (Mauricio, ws1): MaKo no le contestó en el chat de la app —«responder: falló la IA (sin proveedor
// gratis disponible)»— y la Ticketera lo abrió como un bug que iba solo al Cerebro. No lo era: desde el 16/10 una key de
// la plataforma copiada en la fila de un negocio no cuenta como suya, y la decisión A de Martín es que cada negocio
// conecte SU IA. Lo que fija este archivo:
//   1. NO ABRE TICKET: los textos de la cascada sin ninguna cuenta son configuración del negocio (`esDeConfiguracion`),
//      y `registrarError` los descarta antes de abrir nada; un error de la plataforma («falta RESEND_API_KEY») sigue
//      siendo un bug;
//   2. MaKo LO DICE, corto, con un botón que abre el modal de las keys AHÍ MISMO (nunca un link a /integraciones), en
//      los tres hilos que dibujan un turno de la app; y el turno no registra el «responder» cuando falta la IA;
//   3. LA GRILLA DICE LA VERDAD: una IA está «Conectada» sólo si MaKo la puede usar como del negocio (`provsDe`, la
//      misma lectura de la cascada); una copia de la plataforma dice que es la de MaKo, también adentro del modal.
//
// PROBADO ROMPIÉNDOLO (18/10/2026, arnés del scratchpad `romper-sin-ia.mjs`: una rotura por vez, restaurada de memoria
// y comprobada con sha256; base 4 / 0). Las diez dieron 3 / 1, con el rojo en su test:
//   · CONFIGURACION vacía · `registrarError` sin el descarte de configuración;
//   · `faltaIADelNegocio` sin mirar el texto de la cascada · el turno registrando el «responder» igual;
//   · `itemsDeRespuesta` sin el `conectar` · el móvil sin `ConectarDelAviso` · el botón como `<Link>` a /integraciones
//     (⚠️ ése tests/integracion-sin-salir.test.ts NO lo ve —5 / 0—: su barrido busca el link escrito, y éste se arma con
//     un template literal; por eso el test de abajo mira el botón por su forma);
//   · `veredictoDeIA` leyendo la fila como propia · la grilla sin `iaDelNegocio` · el modal sin el aviso de la copia.
// Restaurado: 4 / 0.
//   4. EL WORKSPACE DEL ENTORNO (el ws1; el Cerebro, 18/10/2026): su fila es la que se copia a `process.env`, así que ni
//      el botón ni «pega la de tu cuenta»: «Ya lo está resolviendo el equipo de MaKo», y sus IA sin formulario. La guarda
//      pregunta `esElWsDelEntorno`, la MISMA constante que lee la hidratación. Arnés `romper-ws-entorno.mjs` (base 5 / 0),
//      diez roturas, todas 4 / 1: `avisoSinIA` ignorando el entorno · el turno sin preguntarlo · la hidratación de vuelta a
//      `OWNER_WS` a mano · `guardarCredencial` comparando con `OWNER_WS` · `veredictoDeIA` sin `delEntorno` ·
//      `iaDelNegocio` sin la guarda · la grilla con el formulario · el modal con «Falta configurar» · «Requiere tu
//      atención» con las del equipo · el modal sin el aviso del equipo. Restaurado: 5 / 0.
//
// Correr: npx tsx --test tests/mako-sin-ia.test.ts
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { esDeConfiguracion, esRuido, sanearReporte } from '../lib/errores-app-reglas';
import { AVISO_SIN_IA, AVISO_SIN_IA_EQUIPO, SERVICIO_IA, avisoSinIA, faltaIADelNegocio, type RespuestaTurno } from '../lib/mako-turno-app-reglas';
import { botonConectar, itemsDeRespuesta } from '../app/m/mako/chat-ui';
import { POR_QUE_IA_DE_MAKO, POR_QUE_LA_CONFIGURA_MAKO, veredictoDeIA } from '../lib/ia-keys';
import { servicioDeLink } from '../lib/integracion-en-tab';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

/** El error tal como lo manda el turno (lib/mako-turno-app.ts → `fallasDeMako`). */
const deMako = (mensaje: string) => sanearReporte({ origen: 'mako', nombre: 'responder', mensaje, etiqueta: 'contestarte' })!;

test('sin IA del negocio no abre ticket: es configuración; un error de la plataforma sigue siendo un bug', () => {
  // Rota: vaciar CONFIGURACION → este test falla (el «sin proveedor gratis disponible» del ws1 volvería a ser un bug).
  for (const m of [
    'falló la IA (sin proveedor gratis disponible)',
    'sin proveedor de IA barata (falta GROQ_API_KEY)',
    'falló la IA (red gratis salteada: lleva datos de clientes)',
  ]) {
    const r = deMako(m);
    assert.ok(esDeConfiguracion(r), `es configuración: ${m}`);
    assert.equal(esRuido(r), false, `no es ruido (no lo tapa otra regla): ${m}`);
  }
  for (const m of ['falta RESEND_API_KEY', 'Claude vetado — «mako-doer» no está en la lista blanca', "Cannot read properties of undefined (reading 'etapa')"]) {
    assert.equal(esDeConfiguracion(deMako(m)), false, `sigue siendo un bug: ${m}`);
  }
  // Y `registrarError` lo descarta ANTES de calcular la huella o tocar la base.
  const src = sinComentarios(leer('lib/errores-app.ts'));
  const i = src.indexOf("motivo: 'configuracion'");
  assert.ok(i > 0 && i < src.indexOf('huellaDe(r)'), 'registrarError: el descarte de configuración va antes de la huella');
  assert.match(src, /if \(esDeConfiguracion\(r\)\) return \{ ok: false, motivo: 'configuracion' \}/);
});

test('¿falta la IA del negocio?: el texto de la cascada, o cero cuentas propias; sin saber, no se inventa', () => {
  // Rota: `faltaIADelNegocio` mirando sólo la cuenta (sin el texto de la cascada) → este test falla.
  assert.equal(faltaIADelNegocio(null, 0), false, 'sin fallo no hay nada que decir');
  assert.equal(faltaIADelNegocio('falló la IA (sin proveedor gratis disponible)', null), true, 'la cascada no tuvo con qué probar');
  assert.equal(faltaIADelNegocio('falló la IA (gemini: HTTP 500)', 0), true, 'cero cuentas propias');
  assert.equal(faltaIADelNegocio('falló la IA (gemini: HTTP 500)', 2), false, 'tiene la suya: fue otra cosa');
  assert.equal(faltaIADelNegocio('falló la IA (gemini: HTTP 500)', null), false, 'no se pudo leer: no se le pide conectar algo que quizá ya está');
  // Corto y en sus palabras: sin «API key», sin el proveedor, y diciendo qué hacer.
  assert.ok(AVISO_SIN_IA.length <= 100, AVISO_SIN_IA);
  assert.doesNotMatch(AVISO_SIN_IA, /api|key|gemini|groq|proveedor|vos|tenés|conectá/i);
  assert.match(AVISO_SIN_IA, /Conecta la tuya/);
  assert.equal(SERVICIO_IA, 'gemini', 'el modal de las keys de IA, el mismo que manda WhatsApp (`linkKeysIA`)');
  assert.equal(servicioDeLink(`/integraciones?abrir=${SERVICIO_IA}`), SERVICIO_IA, 'es un modal que se abre suelto en cualquier tab');
  assert.equal(botonConectar(SERVICIO_IA), 'Conectar tu IA');

  // El turno: sin IA no registra el «responder», dice AVISO_SIN_IA y devuelve `conectar`.
  const turno = sinComentarios(leer('lib/mako-turno-app.ts'));
  // Rota: `...(fallo ? [...responder...])` sin el `!sinIA` → este test falla (el ticket #6 de vuelta).
  assert.match(turno, /\.\.\.\(fallo && !sinIA \? \[\{ nombre: 'responder'/);
  assert.match(turno, /const sinIA = faltaIADelNegocio\(fallo, fallo \? await iaPropiaDelTurno\(\) : null\)/);
  assert.match(turno, /provsDe, CASCADA_TOOLS/, 'cuenta con la MISMA lectura que la cascada');
  assert.match(turno, /const sinIAEs = !respuesta && sinIA \? avisoSinIA\(esElWsDelEntorno\(ws\)\) : null;/);
  assert.match(turno, /if \(!respuesta\) aviso = \[aviso, sinIAEs\?\.aviso \?\? AVISO_NO_PUDE\]/);
  assert.match(turno, /pantallas, conectar \}/);
});

test('el chat lo dice MaKo, con el botón que abre el modal ahí mismo, en los tres hilos', () => {
  const r: RespuestaTurno = {
    ok: false, sesion: { id: 1, titulo: null, pinned: false, updatedAt: '' }, mensajes: [], aviso: AVISO_SIN_IA,
    paraLaPersona: [], propuestas: [], pantallas: [], conectar: 'gemini',
  };
  // Rota: `itemsDeRespuesta` sin el `conectar` → este test falla (el aviso quedaría como un cartel de «no pude»).
  const [x] = itemsDeRespuesta(r);
  assert.deepEqual({ k: x.k, tono: x.k === 'aviso' ? x.tono : null, conectar: x.k === 'aviso' ? x.conectar : null }, { k: 'aviso', tono: 'mako', conectar: 'gemini' });
  const [y] = itemsDeRespuesta({ ...r, conectar: null, aviso: 'No pude contestar ahora.' });
  assert.ok(y.k === 'aviso' && y.tono === 'plataforma' && !y.conectar, 'sin `conectar`, el cartel de siempre');

  // El botón es el del modal (BotonIntegracion), nunca un link que saca de la tab.
  const boton = sinComentarios(leer('app/_chat/ConectarDelAviso.tsx'));
  assert.match(boton, /<BotonIntegracion servicio=\{servicio\}/);
  assert.doesNotMatch(boton, /<Link|href=|\/integraciones/);
  // Rota: sacar `ConectarDelAviso` de uno de los hilos → este test falla.
  for (const f of ['app/_chat/HiloMako.tsx', 'app/m/mako/ChatMako.tsx', 'app/crm/lead-view/MakoAnalystLead.tsx']) {
    assert.match(sinComentarios(leer(f)), /\{x\.conectar && <ConectarDelAviso servicio=\{x\.conectar\} \/>\}/, `${f} dibuja el botón`);
  }
});

test('la grilla: «Conectada» sólo si MaKo la puede usar como del negocio; una copia dice que es la de MaKo', () => {
  // Rota: `veredictoDeIA` devolviendo «conectada» con sólo la fila → este test falla (el ws1 con siete «Conectada»).
  assert.equal(veredictoDeIA({ fila: true, propia: true }), 'conectada');
  assert.equal(veredictoDeIA({ fila: false, propia: true }), 'conectada', 'una segunda cuenta suya sin la base también es suya');
  assert.equal(veredictoDeIA({ fila: true, propia: false }), 'copia', 'guardada y no es suya: la de MaKo');
  assert.equal(veredictoDeIA({ fila: false, propia: false }), 'falta');
  assert.doesNotMatch(POR_QUE_IA_DE_MAKO, /vos|tenés|pegá/i);

  const src = sinComentarios(leer('lib/integraciones.ts'));
  // Rota: sacar la rama de `iaDelNegocio` de `integracionDeDef` → este test falla.
  const i = src.indexOf('const ia = await iaDelNegocio(d.key, d.envs[0])');
  assert.ok(i > 0 && i < src.lastIndexOf("'Conectada y operativa.'"), 'la pregunta de la IA va antes del «Conectada» de siempre');
  assert.match(src, /\(await provsDe\(key as ProvName\)\)\.length > 0/, 'las baratas: la lectura de la cascada');
  assert.match(src, /credDelCliente\(envBase, ws\)/, 'la fila del negocio, sin el entorno que `credWs` le presta al ws1');
  assert.match(src, /credWsEstricta\(envBase, OWNER_WS\), await credWsEstricta\(envBase, wsSA\)/, 'la de Anthropic: la frontera de conClaveDelNegocio');
  assert.match(src, /ws === wsSA\) return null/, 'la plataforma usa las suyas');
  // Y el modal lo dice: el campo se ve lleno y no es suyo.
  // Rota: el `alerta` del modal sin la copia → este test falla.
  assert.match(sinComentarios(leer('app/integraciones/IntegracionesBoard.tsx')), /let alerta: string \| null = i\.detalle === POR_QUE_IA_DE_MAKO \|\| i\.detalle === POR_QUE_LA_CONFIGURA_MAKO \? i\.detalle : null;/);
});

test('el workspace del ENTORNO (el ws1): ni botón ni «pega tu key»; lo resuelve el equipo, con la lectura de la hidratación', () => {
  // La guarda no compara con un 1: pregunta `esElWsDelEntorno`, y la hidratación lee del MISMO `WS_DEL_ENTORNO`. Si la
  // hidratación cambia de fuente sin la constante, este test lo frena.
  const cred = sinComentarios(leer('lib/credenciales.ts'));
  assert.match(cred, /export const WS_DEL_ENTORNO: number = OWNER_WS;/);
  assert.match(cred, /export const esElWsDelEntorno = \(ws: number \| null \| undefined\): boolean => ws === WS_DEL_ENTORNO;/);
  // Rota: la hidratación de vuelta a `OWNER_WS` a mano → este test falla.
  assert.match(cred, /\.from\('credenciales'\)\.select\('clave, valor_enc'\)\.eq\('workspace_id', WS_DEL_ENTORNO\)/, 'la hidratación lee de WS_DEL_ENTORNO');
  assert.match(cred, /descifrar\(r\.valor_enc as string, WS_DEL_ENTORNO, r\.clave as string\)/);
  assert.match(cred, /if \(esElWsDelEntorno\(ws\)\) aplicarAEnv\(clave, valor\);/, 'guardarCredencial copia al entorno con la misma pregunta');
  assert.doesNotMatch(cred, /workspace_id', OWNER_WS\)|ws === OWNER_WS\) aplicarAEnv/, 'ninguna copia al entorno compara con OWNER_WS a mano');

  // El chat: sin botón y diciendo que lo resuelve el equipo. Rota: `avisoSinIA` ignorando `delEntorno` → este test falla.
  assert.deepEqual(avisoSinIA(true), { aviso: AVISO_SIN_IA_EQUIPO, conectar: null });
  assert.deepEqual(avisoSinIA(false), { aviso: AVISO_SIN_IA, conectar: SERVICIO_IA });
  assert.equal(AVISO_SIN_IA_EQUIPO, 'Para contestarte necesito una IA conectada. Ya lo está resolviendo el equipo de MaKo.');
  const [x] = itemsDeRespuesta({
    ok: false, sesion: { id: 1, titulo: null, pinned: false, updatedAt: '' }, mensajes: [], aviso: AVISO_SIN_IA_EQUIPO,
    paraLaPersona: [], propuestas: [], pantallas: [], conectar: null,
  });
  assert.ok(x.k === 'aviso' && !x.conectar, 'el aviso del ws1 no trae botón');

  // La grilla: «la configura el equipo», sin formulario, fuera de «Requiere tu atención» y del contador.
  // Rota: `veredictoDeIA` sin mirar `delEntorno` → este test falla.
  assert.equal(veredictoDeIA({ fila: true, propia: true, delEntorno: true }), 'equipo', 'gana sobre «conectada»');
  assert.equal(veredictoDeIA({ fila: true, propia: false, delEntorno: true }), 'equipo', 'y sobre «la de MaKo»');
  assert.doesNotMatch(POR_QUE_LA_CONFIGURA_MAKO, /pega|key|tuya/i);
  const integ = sinComentarios(leer('lib/integraciones.ts'));
  const guarda = integ.indexOf('if (ws != null && esElWsDelEntorno(ws)) return { fila: false, propia: false, delEntorno: true };');
  assert.ok(guarda > 0 && guarda < integ.indexOf('const wsSA = await wsSuperAdmin()'), 'la guarda va primero y sin leer nada');
  assert.match(integ, /\.\.\.\(v === 'equipo' \? \{ soloServidor: true \} : \{\}\)/, 'sin el formulario del modal');
  const board = sinComentarios(leer('app/integraciones/IntegracionesBoard.tsx'));
  assert.match(board, /const mostrarForm = i\.soloServidor === false;/);
  assert.match(board, /\) : i\.estado === 'falta' && i\.key !== 'google' && !delEquipo && \(/, 'sin «Falta configurar: GEMINI_API_KEY»');
  assert.match(board, /\|\| i\.detalle === POR_QUE_LA_CONFIGURA_MAKO;/, 'no es un pendiente suyo');
});
