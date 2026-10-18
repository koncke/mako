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
//
// Correr: npx tsx --test tests/mako-sin-ia.test.ts
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { esDeConfiguracion, esRuido, sanearReporte } from '../lib/errores-app-reglas';
import { AVISO_SIN_IA, SERVICIO_IA, faltaIADelNegocio, type RespuestaTurno } from '../lib/mako-turno-app-reglas';
import { botonConectar, itemsDeRespuesta } from '../app/m/mako/chat-ui';
import { POR_QUE_IA_DE_MAKO, veredictoDeIA } from '../lib/ia-keys';
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
  assert.match(turno, /else if \(sinIA\) \{\s*aviso = \[aviso, AVISO_SIN_IA\]/);
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
  assert.match(sinComentarios(leer('app/integraciones/IntegracionesBoard.tsx')), /let alerta: string \| null = i\.detalle === POR_QUE_IA_DE_MAKO \? i\.detalle : null;/);
});
