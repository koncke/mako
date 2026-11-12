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
//   5. LA IA DE LA PLATAFORMA SALE DE LA PLATAFORMA (Martín, 18/10/2026: «separá el ws1 de las claves de la plataforma…»):
//      `wsDelEntorno` (lib/credenciales.ts) da el workspace de la plataforma para la IA y el ws1 para el resto; la guarda
//      del punto 4 queda de baranda y ya no se dispara con nadie. Arnés `romper-separar-ws1.mjs` (base 6 / 0), diez
//      roturas, todas 5 / 1: `wsDelEntorno` con la IA en el ws1 · la hidratación sin el filtro por fuente · sin IA en la
//      plataforma en silencio · `guardarCredencial` reflejando con `OWNER_WS` · `credWs` prestándole el entorno al ws1 ·
//      la migración del arranque copiando la IA al ws1 · `conClaveDelNegocio` con la fila del ws1 · `esClaveDeIA` sin
//      Claude · el script de migración pisando una clave de la plataforma · y el script imprimiendo un valor. Restaurado: 6 / 0.
//   6. UN NEGOCIO CON SÓLO SU CLAUDE (20/10/2026, docs/investigacion-ops-center-19-10.md): el chat contesta con su clave
//      (`chatClaudeTools` → `permisoDeLaClaveDelNegocio`) y «Conectar tu IA» abre la que ya eligió (`iaParaConectar`). Arnés
//      `romper-solo-claude.mjs` (base 7 / 0), diez roturas, todas 6 / 1: `iaParaConectar` siempre Gemini · `avisoSinIA`
//      ignorando la elegida · el botón sin nombrar a Claude · el turno sin pasarla · `iaPropiaDelTurno` sin su Claude ·
//      `chatClaudeTools` sin probarla · con el permiso de la plataforma · pagada como gasto de MaKo · con thinking y effort ·
//      cayendo igual al Claude de la plataforma. Restaurado: 7 / 0.
//
// Correr: npx tsx --test tests/mako-sin-ia.test.ts
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { esDeConfiguracion, esRuido, sanearReporte } from '../lib/errores-app-reglas';
import {
  AVISO_SIN_IA, AVISO_SIN_IA_EQUIPO, ENV_DE_IA, IA_PARA_CONECTAR, SERVICIO_IA, avisoSinIA, faltaIADelNegocio, iaParaConectar,
  type RespuestaTurno,
} from '../lib/mako-turno-app-reglas';
import { evaluarClaveDelNegocio } from '../lib/veto-claude';
import { botonConectar, itemsDeRespuesta } from '../app/m/mako/chat-ui';
import { POR_QUE_IA_DE_MAKO, POR_QUE_LA_CONFIGURA_MAKO, esClaveDeIA, veredictoDeIA } from '../lib/ia-keys';
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
  // Nombra las IA que puede conectar (su Claude, su GPT, su Gemini: el Cerebro, 22/10/2026), nunca «la gratis».
  assert.doesNotMatch(AVISO_SIN_IA, /api|key|gratis|groq|proveedor|vos|tenés|conectá/i);
  // Sin Gemini desde el 25/10/2026 (Martín: «todo eso se hace con la app de escritorio de MaKo y conectado a su claude o GPT»).
  assert.match(AVISO_SIN_IA, /conecta tu Claude o tu GPT/);
  assert.doesNotMatch(AVISO_SIN_IA, /gemini/i);
  assert.equal(SERVICIO_IA, 'anthropic', 'el modal de su Claude, el mismo que manda WhatsApp (`linkKeysIA`; IA9: antes, Gemini)');
  assert.equal(servicioDeLink(`/integraciones?abrir=${SERVICIO_IA}`), SERVICIO_IA, 'es un modal que se abre suelto en cualquier tab');
  assert.equal(botonConectar(SERVICIO_IA), 'Conectar tu IA');

  // El turno: sin IA no registra el «responder», dice AVISO_SIN_IA y devuelve `conectar`.
  const turno = sinComentarios(leer('lib/mako-turno-app.ts'));
  // Rota: `...(fallo ? [...responder...])` sin el `!sinIA` → este test falla (el ticket #6 de vuelta).
  // Desde el 21/10 también sin lo que falló en la computadora del cliente (`falloDeLaPc`, tests/ia-pc.test.ts) ni en SU
  // cuenta (`deSuClave`: su Claude en pausa o su clave sin crédito, tests/ia-pc-revision.test.ts).
  assert.match(turno, /\.\.\.\(fallo && !sinIA(?: && !falloDeLaPc)?(?: && !deSuClave| && \(!deSuCuenta \|\| suOpenAI === 'no-existe'\))? \? \[\{ nombre: 'responder'/);
  assert.match(turno, /const sinIA = (?:!falloDeLaPc && )?(?:!deSuClave && |!deSuCuenta && )?faltaIADelNegocio\(fallo, fallo \? await iaPropiaDelTurno\(\) : null\)/);
  assert.match(turno, /provsDe, CASCADA_TOOLS/, 'cuenta con la MISMA lectura que la cascada');
  // Desde el 21/10, con su computadora conectada (aunque apagada) no se le pide otra IA: `&& !pc` (tests/ia-pc.test.ts); y
  // en un negocio con su propio Claude (D6b), lo que se le ofrece es SU IA, nunca Gemini (`iaParaConectar(…, negocio.suIA)`).
  // Antes van «no pude ver tu computadora» y «conecta tu computadora» (tests/ia-pc-segunda-revision.test.ts).
  assert.match(turno, /const sinIAEs = !respuesta && sinIA(?: && !pc)?\s*\?[\s\S]{0,280}avisoSinIA\(await esNegocioDelEntorno\(ws\)\.catch\(\(\) => false\), iaParaConectar\(await iaConFila\(\)(?:, negocio\.suIA)?\)\)\s*: null;/);
  // El porqué conocido (la PC, su clave, sin IA, la PC ilegible) y, sin porqué, AVISO_NO_PUDE (tests/ops-sin-silencio.test.ts).
  assert.match(turno, /const porQue = porQueSinRespuesta\(\{ delaPc, deSuClave: (?:deSuClave|deSuCuenta)\?\.aviso, sinIA: sinIAEs\?\.aviso, pcIlegible: pcIlegible && negocio\.suIA \? AVISO_PC_ILEGIBLE : null \}\);/);
  assert.match(turno, /aviso = \[aviso, porQue \?\? AVISO_NO_PUDE\]/);
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
  assert.match(sinComentarios(leer('app/_chat/HiloMako.tsx')), /\{x\.conectar && <ConectarDelAviso servicio=\{x\.conectar\} \/>\}/, 'el hilo dibuja el botón');
  // El de la ficha dibuja con ese MISMO hilo desde el 22/10/2026 (CR3).
  assert.match(sinComentarios(leer('app/crm/lead-view/MakoAnalystLead.tsx')), /<HiloMako key=\{leadId\} items=\{items\} quien=\{QUIEN\}/, 'el MaKo Analyst de la ficha');
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
  // IA16: fuera de D6b (con su Gemini y su Groq, D6b no le da Groq a `provsDe`, y la tarjeta decía «la de MaKo»).
  assert.match(src, /\(await conSoloSuIA\(false, \(\) => provsDe\(key as ProvName\)\)\)\.length > 0/, 'las baratas: la lectura de la cascada');
  assert.match(src, /credDelCliente\(envBase, ws\)/, 'la fila del negocio, sin el entorno que `credWs` le presta al ws1');
  assert.match(src, /credWsEstricta\(envBase, await wsDelEntorno\(envBase\)\), await credWsEstricta\(envBase, wsSA\)/, 'la de Anthropic: la frontera de conClaveDelNegocio');
  assert.match(src, /ws === wsSA\) return null/, 'la plataforma usa las suyas');
  // Y el modal lo dice: el campo se ve lleno y no es suyo.
  // Rota: el `alerta` del modal sin la copia → este test falla.
  // 26/10/2026: y si no, el texto de una tarjeta que no se conecta (Loom «Sin API», lib/grabadores) — nunca «Falta configurar».
  assert.match(sinComentarios(leer('app/integraciones/IntegracionesBoard.tsx')), /let alerta: string \| null = i\.detalle === POR_QUE_IA_DE_MAKO \|\| i\.detalle === POR_QUE_LA_CONFIGURA_MAKO \? i\.detalle : i\.sinConexion\?\.texto \?\? null;/);
});

test('un negocio cuya IA fuera el entorno: ni botón ni «pega tu key»; lo resuelve el equipo (la baranda)', () => {
  // Desde el 18/10 la IA del entorno sale de la plataforma y la guarda no se dispara con nadie: queda de baranda. Pregunta
  // `esNegocioDelEntorno`, con la MISMA `wsDelEntorno` que lee la hidratación, y la plataforma misma no cuenta.
  const cred = sinComentarios(leer('lib/credenciales.ts'));
  assert.match(cred, /const \[fuente, plataforma\] = await Promise\.all\(\[wsDelEntorno\('GEMINI_API_KEY'\), wsSuperAdmin\(\)\]\);\s*return ws === fuente && ws !== plataforma;/);

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
  const guarda = integ.indexOf('if (await esNegocioDelEntorno(ws)) return { fila: false, propia: false, delEntorno: true };');
  assert.ok(guarda > 0 && guarda < integ.indexOf('const wsSA = await wsSuperAdmin()'), 'la guarda va primero y sin leer nada');
  assert.match(integ, /\.\.\.\(v === 'equipo' \? \{ soloServidor: true \} : \{\}\)/, 'sin el formulario del modal');
  const board = sinComentarios(leer('app/integraciones/IntegracionesBoard.tsx'));
  assert.match(board, /const mostrarForm = i\.soloServidor === false;/);
  assert.match(board, /\) : i\.estado === 'falta' && i\.key !== 'google' && !delEquipo && !i\.sinConexion && \(/, 'sin «Falta configurar: GEMINI_API_KEY»');
  assert.match(board, /\|\| i\.detalle === POR_QUE_LA_CONFIGURA_MAKO \|\| !!i\.sinConexion( \|\||;)/, 'no es un pendiente suyo');
});

test('la IA de la plataforma sale de la PLATAFORMA, no del ws1: hidratación, lecturas, guardar y la migración', () => {
  // Martín (18/10/2026): «Sí: separá el ws1 de las claves de la plataforma (que salgan del ws9 o del entorno) para que
  // Mauricio pueda conectar su propia IA». Qué es IA: la cascada (con sus cuentas y rótulos), OpenAI, Cerebras y Claude.
  // IA8 (22/10/2026): OpenRouter y Cerebras se sacaron: sus claves ya no son «de IA» (nadie las lee).
  for (const c of ['GEMINI_API_KEY', 'GEMINI_API_KEY_4', 'GEMINI_API_KEY_4_ACCOUNT', 'GROQ_API_KEY_2', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY']) {
    assert.ok(esClaveDeIA(c), `${c} es de IA`);
  }
  for (const c of ['META_ACCESS_TOKEN', 'RESEND_API_KEY', 'FATHOM_WEBHOOK_SECRET', 'ANTHROPIC_CREDITO_CUENTA1', 'GEMINI_API_KEY_11', 'ELEVENLABS_API_KEY']) {
    assert.equal(esClaveDeIA(c), false, `${c} no es de IA (sigue como estaba)`);
  }
  const cred = sinComentarios(leer('lib/credenciales.ts'));
  // Rota: `wsDelEntorno` devolviendo el ws1 para la IA → este test falla.
  // Desde el 4/11/2026 la fuente la decide `saleDeLaPlataforma` (la IA, y la clave de correo de MaKo): lo fija por
  // comportamiento tests/email-cuenta-propia.test.ts (la hidratación corrida contra una base de mentira).
  assert.match(cred, /export async function wsDelEntorno\(clave: string\): Promise<number> \{\s*return saleDeLaPlataforma\(clave\) \? wsSuperAdmin\(\) : OWNER_WS;\s*\}/);
  assert.match(cred, /export const saleDeLaPlataforma = \(clave: string\): boolean => esClaveDeIA\(clave\) \|\| esClaveDeCorreoDeLaPlataforma\(clave\);/);
  // La hidratación: dos fuentes, y cada clave sólo de la suya; sin filas de IA en la plataforma, lo dice fuerte.
  assert.match(cred, /return \[\{ ws: OWNER_WS, dePlataforma: false \}, \.\.\.\(plataforma == null \? \[\] : \[\{ ws: plataforma, dePlataforma: true \}\]\)\];/);
  // Rota: la hidratación sin el filtro por fuente (el ws1 vuelve a poner su IA en el entorno) → este test falla.
  assert.match(cred, /if \(saleDeLaPlataforma\(clave\) !== f\.dePlataforma\) \{/);
  assert.match(cred, /descifrar\(r\.valor_enc as string, f\.ws, clave\)/);
  assert.match(cred, /if \(f\.dePlataforma && !legibles\) console\.error\(/, 'sin IA en la plataforma no queda en silencio');
  // Las lecturas «del dueño» y el reflejo al entorno preguntan lo mismo; ninguna compara con OWNER_WS a mano.
  assert.match(cred, /if \(ws === \(await wsDelEntorno\(clave\)\)\) aplicarAEnv\(clave, valor\);/, 'guardarCredencial');
  assert.match(cred, /if \(hidratadas\.has\(clave\) && ws === \(await wsDelEntorno\(clave\)\)\) \{/, 'eliminarCredencial');
  assert.match(cred, /const v = await credDeBase\(await wsDelEntorno\(clave\), clave\);/, 'envCred');
  assert.match(cred, /const base = await credWsEstricta\(clave, await wsDelEntorno\(clave\)\);/, 'esDeLaPlataforma');
  assert.equal((cred.match(/esValorReal\(process\.env\[clave\]\) && w?s? === \(await wsDelEntorno\(clave\)\)/g) ?? []).length, 2, 'credWs y credWsEstricta');
  assert.match(cred, /if \(esValorReal\(env\) && w === \(await wsDelEntorno\(clave\)\)\) \{/, 'estadoCampo');
  assert.doesNotMatch(cred, /(ws|w) === OWNER_WS && esValorReal|workspace_id', OWNER_WS\)|credDeBase\(OWNER_WS|credWsEstricta\(clave, OWNER_WS\)/, 'nada del entorno compara con OWNER_WS a mano');
  // Rota: la migración del arranque copiando la IA del entorno a la fila del ws1 (así se sembraron las copias) → falla.
  assert.match(cred, /if \(saleDeLaPlataforma\(clave\) && ws !== \(await wsDelEntorno\(clave\)\)\) continue;/);
  // Las fronteras de Claude ya no miran la fila del ws1.
  for (const f of ['lib/anthropic.ts', 'lib/integraciones.ts']) {
    const s = sinComentarios(leer(f));
    assert.doesNotMatch(s, /credWsEstricta\([^)]*, OWNER_WS\)/, `${f}: la clave de Claude no se compara con la fila del ws1`);
    // Con `{ ilegibleTira: true }` en la frontera de la IA (revisión adversarial de IA15).
    assert.match(s, /await credWsEstricta\((?:'ANTHROPIC_API_KEY'|envBase), await wsDelEntorno\((?:'ANTHROPIC_API_KEY'|envBase)\)(?:, \{ ilegibleTira: true \})?\)/, f);
  }
  // La migración: en seco salvo `--aplicar`, aditiva (nunca borra), sin pisar, y sin imprimir un valor.
  const mig = sinComentarios(leer('scripts/ia-del-ws1-a-la-plataforma.mts'));
  assert.match(mig, /const APLICAR = process\.argv\.includes\('--aplicar'\);/);
  assert.match(mig, /if \(!APLICAR\) \{[^}]*process\.exit\(0\); \}/, 'en seco no escribe');
  assert.doesNotMatch(mig, /eliminarCredencial|\.delete\(\)|\.from\('credenciales'\)\.(update|upsert|delete)/, 'no borra ni cambia nada: sólo guardarCredencial en la plataforma');
  assert.match(mig, /let hacia: string \| null = ocupadas\.has\(f\.clave\) \? null : f\.clave;/, 'no pisa una clave de la plataforma');
  assert.match(mig, /if \(yaTiene\.has\(huella\(f\.valor\)\)\)/, 'idempotente: un valor que ya está no se copia');
  assert.match(mig, /guardarCredencial\(plataforma, p\.hacia, p\.valor/);
  assert.doesNotMatch(mig, /console\.(log|error)\([^)]*\.valor\b[^)]*\)/, 'nunca imprime un valor');
});

test('un negocio con SÓLO su Claude: el chat contesta con su clave, y «Conectar tu IA» abre la que ya eligió', () => {
  // docs/investigacion-ops-center-19-10.md: «Un negocio que conectó sólo su Claude igual recibe el modal de Gemini».
  // 1. El botón abre la IA que el negocio ya tiene en su fila, para arreglarla; sin ninguna, Gemini.
  // Rota: `iaParaConectar` devolviendo siempre Gemini → este test falla.
  assert.equal(iaParaConectar(['anthropic']), 'anthropic');
  assert.equal(iaParaConectar(['groq', 'anthropic']), 'anthropic', 'su Claude antes que una gratis');
  assert.equal(iaParaConectar(['gemini', 'openai']), 'openai');
  // IA16: Groq ya no se ofrece para el chat (sólo escucha las notas de voz): con sólo Groq, se abre la de siempre.
  assert.equal(iaParaConectar(['groq']), SERVICIO_IA);
  assert.equal(iaParaConectar([]), SERVICIO_IA);
  assert.deepEqual(avisoSinIA(false, 'anthropic'), { aviso: AVISO_SIN_IA, conectar: 'anthropic' });
  assert.equal(avisoSinIA(true, 'anthropic').conectar, null, 'el workspace del entorno, sin botón igual');
  for (const s of IA_PARA_CONECTAR) {
    assert.equal(botonConectar(s), 'Conectar tu IA', `${s}: la IA se nombra como la piensa la persona`);
    assert.equal(servicioDeLink(`/integraciones?abrir=${s}`), s, `${s}: su modal se abre suelto, en la misma pantalla`);
  }
  // La credencial que se mira en su fila es la del catálogo de /integraciones.
  const catalogo = leer('lib/integraciones-catalogo.ts');
  for (const s of IA_PARA_CONECTAR) {
    assert.match(catalogo, new RegExp(`key: '${s}'[^\\n]*envs: \\['${ENV_DE_IA[s]}'`), `${s} → ${ENV_DE_IA[s]}`);
  }

  // 2. El veto deja que el chat (`mako-doer`) use la clave del negocio, con el modelo barato.
  const v = evaluarClaveDelNegocio({ feature: 'mako-doer', clave: 'sk-ant-del-negocio', clavesPlataforma: ['sk-ant-de-mako'], pausa: false });
  assert.ok(v.ok && v.permiso.model === 'claude-haiku-4-5' && v.permiso.clave === 'sk-ant-del-negocio');

  // 3. `chatClaudeTools`: si ninguna barata contestó (y no ejecutó nada), su Claude ANTES de tirar «sin proveedor».
  // Rota: sacar el intento con la clave del negocio → este test falla.
  const ant = sinComentarios(leer('lib/anthropic.ts'));
  const tools = ant.slice(ant.indexOf('export async function chatClaudeTools('));
  // Desde WA1 la misma lectura aparece antes, en `soloSuClaude` (directo a su clave): ésta es la de DESPUÉS de la cascada.
  const intento = tools.indexOf('const n = await permisoDeLaClaveDelNegocio(opts.feature).catch(() => null);', tools.indexOf('if (r) return { text: r.text'));
  assert.ok(intento > tools.indexOf('if (r) return { text: r.text') && intento < tools.indexOf("'sin proveedor gratis disponible'"),
    'después de la cascada que no contestó, antes de tirar');
  // Con su Claude en pausa, la pausa (no «sin proveedor», que le pedía conectar lo que ya tiene: revisión del 21/10/2026).
  assert.match(tools, /if \(n && 'permiso' in n\) delNegocio = n\.permiso;\s*else if \(n && 'pausa' in n && opts\.sinFallbackClaude\) throw new Error\(`falló la IA \(\$\{CLAUDE_EN_PAUSA\}\)`\);\s*else if \(opts\.sinFallbackClaude\) throw/);
  assert.match(tools, /if \(delNegocio\) permiso = delNegocio;/, 'el permiso es el de la puerta 2, no el de la plataforma');
  assert.match(tools, /const key = delNegocio \? delNegocio\.clave : await credWs\('ANTHROPIC_API_KEY'\);/, 'la clave que verificó el veto');
  assert.match(tools, /delNegocio\s*\? \{ model, max_tokens: opts\.maxTokens \?\? 4096, system: systemConCache, messages: msgs, tools \}/, 'el pedido que ya anda con su clave');
  // 12/11/2026: el system viaja como bloque con cache_control (tests/cache-de-prompt.test.ts); el pedido con su clave es el mismo.
  // La marca del gasto, PRIMERO: la del negocio, o la del crédito de la plataforma si su clave es el crédito (`marcaDelGasto`,
  // revisión del lote 2).
  assert.match(tools, /delNegocio \? \[marcaDelGasto\(delNegocio\), /, 'lo paga el negocio: su marca primero');
  assert.match(tools, /if \(!delNegocio\) \{\s*model = opts\.fallbackModel \?\? 'claude-sonnet-5';/, 'no cae a Claude de la plataforma');

  // 4. El turno cuenta su Claude como IA propia, y mira SU fila (no el entorno) para elegir qué abrir.
  // Rota: `iaPropiaDelTurno` sin su Claude → este test falla (le pediría conectar algo que ya tiene).
  const turno = sinComentarios(leer('lib/mako-turno-app.ts'));
  // Desde el 21/10 también en pausa: sigue siendo SU Claude, y lo que se le dice es la pausa (tests/ia-pc-revision.test.ts).
  // Sin poder comprobarla (revisión de IA5/IA12), «no sé», como el `catch`: ni la cuenta ni le pide conectarla.
  assert.match(turno, /const claude = await permisoDeLaClaveDelNegocio\(FEATURE\);\s*if \(claude && 'noPudeLeer' in claude\) return null;\s*if \(claude\) n\+\+;/);
  assert.match(turno, /for \(const s of IA_PARA_CONECTAR\) if \(await credDelCliente\(ENV_DE_IA\[s\]\)/);
});
