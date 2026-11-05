// =============================================================================
// LA GUARDA: un envío nuevo a un grupo que saltee la copia, ROJO (3/11/2026)
// =============================================================================
// Requisito 3 de Martín: TODOS los avisos que salen por WhatsApp caen también en el grupo de la app, sin depender de que WhatsApp los entregue. WhatsApp baneó la línea de MaKo, y con la voz fuera de la mitad de los
// grupos, un envío que no copia es un aviso que nadie lee. La copia vive en `copiarAlGrupo` (lib/grupo-app.ts) y se llama desde las puertas de lib/mako-grupo.ts y desde `emitirAviso`.
//
// Cómo se llega a un grupo hoy, medido el 3/11/2026 con `git grep`: tres envíos crudos (`/message/sendText` en lib/mako-grupo.ts, y `enviarPartesPorEv`, de lib/mako-tarjeta.ts) y sus puertas. Esta guarda fija:
//   1. QUIÉN TOCA LAS RUTAS DE ENVÍO DE EVOLUTION: tres archivos. Uno nuevo, rojo.
//   2. QUIÉN CONTIENE EL ENVÍO CRUDO, dentro de lib/mako-grupo.ts. Una función nueva, rojo.
//   3. QUIÉN LLAMA a cada puerta que NO copia sola, con su porqué. Un llamador nuevo, rojo: que copie, o que diga acá por qué no.
//   4. QUE LAS PUERTAS QUE COPIAN LO HAGAN ANTES DEL INTENTO: de eso depende que el aviso exista con la línea caída y que el eco no duplique.
//   5. Y que `memoria: null` y `sinCopia` (quien llama ya copió) sean sólo de `emitirAviso`.
// La guarda se prueba a sí misma: `auditar` recibe los fuentes, y abajo se le da un envío inventado.
//
// PROBADO ROMPIÉNDOLO: al final del archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
const sinComentarios = (src: string) => src.replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/([;{}(),])[ \t]*\/\/.*$/gm, '$1');

/** Los fuentes donde puede vivir un envío, sin los tests. También lo que todavía no está commiteado. */
function fuentes(): Map<string, string> {
  const salida = execFileSync('git', ['grep', '--untracked', '-l', '-E', 'message/send|enviarTextoVozMaKo|enviarPorWhatsApp|enviarPartesPorEv|enviarPartesAJid|enviarAGrupoJid|enviarPartesAlGrupoMaKo|enviarAlGrupoMaKo|enviarAlGrupoSuperAdmin', '--', 'lib', 'app', 'scripts'], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const out = new Map<string, string>();
  for (const f of salida.split('\n').map((x) => x.trim()).filter(Boolean)) if (/\.(ts|tsx|mts|mjs|js)$/.test(f)) out.set(f.replace(/\\/g, '/'), sinComentarios(readFileSync(join(RAIZ, f), 'utf8')));
  return out;
}

/** 1. Lo que toca las rutas de envío de Evolution. */
const TOCAN_EVOLUTION: Record<string, string> = {
  'lib/mako-grupo.ts': 'las puertas de los grupos: se miran abajo',
  'lib/mako-tarjeta.ts': '`enviarPartesPorEv`, sin base: lo llama sólo lib/mako-grupo.ts',
  'lib/evolution.ts': 'a LEADS y a personas, nunca a un grupo: `enviarTexto` deja sólo dígitos, y un jid de grupo deja de serlo',
  'lib/mako-salida-drivers.ts': 'la cañería del bot 1 a 1 (4/11/2026): la usa sólo lib/mako-salida.ts, cuya puerta no deja salir a un jid de grupo (se mira abajo)',
  'app/admin/dev/chatbot/bitacora.ts': 'un texto de la bitácora, que nombra la ruta: no manda nada',
};
/** 2. Las funciones de lib/mako-grupo.ts que contienen un envío crudo. */
const CRUDAS_EN_MAKO_GRUPO: Record<string, string> = {
  enviarTextoVozMaKo: 'el envío de texto: la llaman las puertas de abajo',
  enviarPorWhatsApp: 'el cuerpo de `enviarAlGrupoMaKo`, que copia antes',
  enviarDmVozMaKo: 'un DM, el código de verificación: no es un grupo',
};
/**
 * 3. Quién llama a lo que NO copia solo.
 *
 * `enviarAGrupoJid` y `reaccionarMensaje` copian si hay contexto de turno (lib/grupo-salida.ts); sin contexto, sólo van a WhatsApp.
 * `enviarPartesAJid` y `enviarPartesAlGrupoMaKo` nunca copian: las partes las copia quien las prepara.
 */
const LLAMADORES: Record<string, Record<string, string>> = {
  enviarTextoVozMaKo: {
    'lib/mako-grupo.ts': 'la bienvenida y la línea de la agencia (no son avisos: se ven por el eco si la línea está), `enviarAlGrupoSuperAdmin` y `enviarAGrupoJid` (copian antes) y `enviarAPersonaMaKo` (un DM)',
  },
  enviarPorWhatsApp: { 'lib/mako-grupo.ts': 'sólo `enviarAlGrupoMaKo`' },
  enviarPartesPorEv: { 'lib/mako-grupo.ts': 'sólo `enviarPartesAJid`', 'lib/mako-tarjeta.ts': 'su definición' },
  enviarPartesAJid: {
    'lib/mako-grupo.ts': 'sólo `enviarPartesAlGrupoMaKo`',
    'lib/mako-chat.ts': 'el panel de /agencia y los Chats del super admin: una persona del equipo por la línea. Sólo si llega, y se ve por su eco',
  },
  enviarPartesAlGrupoMaKo: {
    'lib/mako-grupo.ts': 'su definición',
    'lib/avisos.ts': '`emitirAviso`, que copia antes',
    'lib/probar-grupo-envio.ts': '«Probar en el grupo», que copia antes',
    'lib/recibos.ts': 'el recibo de un pago de MaKo (`despacharWhatsApp`), que copia antes: al hilo siempre, escondido a los invitados',
  },
  enviarAGrupoJid: {
    'lib/mako-doer-in.ts': 'el turno de MaKo: `manejarEntranteDoer`, `manejarEntranteDeLaApp` y `flushHuerfanos` abren el contexto que copia. Los 14 sitios no cambian',
    'lib/mako-chat.ts': 'el panel de /agencia: se ve por su eco (`esFirmaDelEquipo`)',
    'app/api/admin/avisos-demo/route.ts': 'un grupo suelto de demostración, sin negocio: no hay hilo donde copiar',
    'lib/mako-grupo.ts': 'su propia definición',
  },
};
/** 4. Las puertas que copian, y lo que va DESPUÉS de la copia. */
const COPIAN: Array<{ archivo: string; funcion: string; despues: RegExp }> = [
  { archivo: 'lib/mako-grupo.ts', funcion: 'enviarAlGrupoMaKo', despues: /enviarPorWhatsApp\(/ },
  { archivo: 'lib/mako-grupo.ts', funcion: 'enviarAlGrupoSuperAdmin', despues: /enviarTextoVozMaKo\(/ },
  { archivo: 'lib/mako-grupo.ts', funcion: 'enviarAGrupoJid', despues: /enviarTextoVozMaKo\(/ },
  { archivo: 'lib/avisos.ts', funcion: 'emitirAviso', despues: /enviarPartesAlGrupoMaKo\(/ },
  { archivo: 'lib/probar-grupo-envio.ts', funcion: 'enviarPruebaAlGrupo', despues: /enviarPartesAlGrupoMaKo\(/ },
  { archivo: 'lib/recibos.ts', funcion: 'despacharWhatsApp', despues: /enviarPartesAlGrupoMaKo\(/ },
];

/** El cuerpo de una función por su nombre: hasta el próximo `}` en la columna 0. */
function cuerpoDe(src: string, nombre: string): string | null {
  const m = new RegExp(`^(?:export )?(?:async )?function ${nombre}\\b`, 'm').exec(src);
  if (!m) return null;
  const resto = src.slice(m.index);
  const fin = /\n}\n/.exec(resto);
  return fin ? resto.slice(0, fin.index) : resto;
}
/** Las funciones de un fuente que contienen algo. */
function funcionesCon(src: string, re: RegExp): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/^(?:export )?(?:async )?function (\w+)/gm)) {
    const c = cuerpoDe(src, m[1]);
    if (c && re.test(c)) out.push(m[1]);
  }
  return out;
}

export function auditar(f: Map<string, string>): string[] {
  const malos: string[] = [];
  // 1.
  for (const [archivo, src] of f) if (/\/message\/send/.test(src) && !TOCAN_EVOLUTION[archivo]) malos.push(`${archivo} toca /message/send de Evolution: un envío a un grupo tiene que pasar por lib/mako-grupo.ts y copiar con copiarAlGrupo`);
  // 2.
  const mg = f.get('lib/mako-grupo.ts') ?? '';
  for (const fn of funcionesCon(mg, /\/message\/send(Text|Media|WhatsAppAudio)/)) if (!CRUDAS_EN_MAKO_GRUPO[fn]) malos.push(`lib/mako-grupo.ts: ${fn} manda directo a Evolution y no está en la lista: que copie con copiarAlGrupo, o que diga acá por qué no`);
  // 3.
  for (const [puerta, permitidos] of Object.entries(LLAMADORES)) {
    for (const [archivo, src] of f) {
      if (new RegExp(`\\b${puerta}\\(`).test(src) && !permitidos[archivo]) malos.push(`${archivo} llama a ${puerta}, que no copia al grupo de la app: usa enviarAlGrupoMaKo, o copia con copiarAlGrupo y sumalo acá con su porqué`);
    }
  }
  // Dentro de mako-grupo.ts: `enviarTextoVozMaKo` sólo desde donde se dijo.
  const conTexto = funcionesCon(mg, /\benviarTextoVozMaKo\(/).filter((x) => x !== 'enviarTextoVozMaKo').sort();
  const esperadas = ['aplicarEquipoDeAgencia', 'asegurarGrupoMaKo', 'enviarAGrupoJid', 'enviarAPersonaMaKo', 'enviarAlGrupoSuperAdmin'];
  for (const x of conTexto) if (!esperadas.includes(x)) malos.push(`lib/mako-grupo.ts: ${x} manda por enviarTextoVozMaKo sin copiar`);
  // 4.
  for (const { archivo, funcion, despues } of COPIAN) {
    const c = cuerpoDe(f.get(archivo) ?? '', funcion);
    if (!c) { malos.push(`${archivo}: no encuentro ${funcion}`); continue; }
    const i = c.search(/copiarAlGrupo\(/);
    const j = c.search(despues);
    if (i < 0) malos.push(`${archivo}: ${funcion} no copia al grupo de la app`);
    else if (j >= 0 && i > j) malos.push(`${archivo}: ${funcion} copia DESPUÉS de intentar WhatsApp: con la línea caída no queda, y el eco duplica`);
  }
  // 5.
  for (const [archivo, src] of f) {
    if (archivo !== 'lib/avisos.ts' && /enviarAlGrupoMaKo\([^;]*,\s*null\)/.test(src)) malos.push(`${archivo}: \`enviarAlGrupoMaKo(..., null)\` no copia: es sólo de emitirAviso`);
    if (archivo !== 'lib/avisos.ts' && /sinCopia:\s*true/.test(src)) malos.push(`${archivo}: \`sinCopia\` es sólo de emitirAviso`);
  }
  return malos;
}

test('⛔ TODO lo que sale a un grupo pasa por la copia', () => {
  const f = fuentes();
  assert.ok(f.size >= 15, `la guarda dejó de ver los archivos (vio ${f.size})`);
  assert.deepEqual(auditar(f), []);
});

test('la guarda se prueba: un archivo nuevo que le pega a Evolution, rojo', () => {
  const f = fuentes();
  f.set('lib/un-aviso-nuevo.ts', "export const x = () => ev(`/message/sendText/${voz}`, { method: 'POST', body: JSON.stringify({ number: jid, text }) });");
  assert.ok(auditar(f).some((m) => m.includes('lib/un-aviso-nuevo.ts toca /message/send')));
});

test('la guarda se prueba: un llamador nuevo de una puerta que no copia, rojo', () => {
  for (const puerta of ['enviarAGrupoJid', 'enviarPartesAJid', 'enviarPartesAlGrupoMaKo']) {
    const f = fuentes();
    f.set('lib/un-aviso-nuevo.ts', `export const x = () => ${puerta}(jid, 'hola');`);
    assert.ok(auditar(f).some((m) => m.includes(`lib/un-aviso-nuevo.ts llama a ${puerta}`)), puerta);
  }
});

test('la guarda se prueba: una función nueva en lib/mako-grupo.ts con el envío crudo, rojo', () => {
  const f = fuentes();
  f.set('lib/mako-grupo.ts', `${f.get('lib/mako-grupo.ts')}\nexport async function otroAviso(jid: string) {\n  return ev(\`/message/sendText/\${x}\`, { method: 'POST' });\n}\n`);
  assert.ok(auditar(f).some((m) => m.includes('otroAviso manda directo')));
});

test('la guarda se prueba: copiar después de WhatsApp, o no copiar, rojo', () => {
  const f = fuentes();
  const mg = f.get('lib/mako-grupo.ts')!;
  const c = cuerpoDe(mg, 'enviarAlGrupoMaKo')!;
  f.set('lib/mako-grupo.ts', mg.replace(c, c.replace(/copiarAlGrupo\(/, 'noCopiar(')));
  assert.ok(auditar(f).some((m) => m.includes('enviarAlGrupoMaKo no copia')));
  const g = fuentes();
  const av = g.get('lib/avisos.ts')!;
  const e = cuerpoDe(av, 'emitirAviso')!;
  // Mover la copia al final.
  const linea = /const copia: Copia \| null[\s\S]*?pushYaSalio: a\.push !== false \}\);\n/.exec(e)![0];
  g.set('lib/avisos.ts', av.replace(e, e.replace(linea, '').replace(/const push = await pushP;/, `${linea}const push = await pushP;`)));
  assert.ok(auditar(g).some((m) => m.includes('emitirAviso copia DESPUÉS')));
});

test('la guarda se prueba: `memoria: null` o `sinCopia` fuera de emitirAviso, rojo', () => {
  const f = fuentes();
  f.set('lib/un-aviso-nuevo.ts', "export const x = () => enviarAlGrupoMaKo(ws, 'hola', null);");
  assert.ok(auditar(f).some((m) => m.includes('no copia: es sólo de emitirAviso')));
  const g = fuentes();
  g.set('lib/un-aviso-nuevo.ts', "export const x = () => enviarAlGrupoSuperAdmin('hola', { sinCopia: true });");
  assert.ok(auditar(g).some((m) => m.includes('`sinCopia` es sólo de emitirAviso')));
});

test('quien reintenta con el resultado del aviso cuenta `enApp` como que llegó', () => {
  const leer = (rel: string) => sinComentarios(readFileSync(join(RAIZ, rel), 'utf8'));
  assert.match(leer('app/api/cron/avisos-resumen/route.ts'), /res\.wa \|\| res\.enApp \|\| res\.apagado/, 'las filas del resumen quedarían pendientes y volverían cada mañana');
  const vigilante = leer('lib/lineas-vigilante.ts');
  assert.equal((vigilante.match(/const llego = r\.wa \|\| r\.enApp === true \|\| r\.email === true;/g) ?? []).length, 2);
  assert.match(leer('lib/reunion-auto.ts'), /aviso\.wa \|\| aviso\.enApp/);
  assert.equal((leer('lib/curso-mensajes.ts').match(/r\.wa \|\| r\.enApp/g) ?? []).length, 3);
  assert.match(leer('lib/aviso-evento.ts'), /rs\.some\(\(r\) => r\.enApp\)/);
});

/**
 * LOS BLOQUES DEL SYSTEM DEL TURNO DEL GRUPO. Una semilla sólo atrapa lo que alguien sembró: un bloque nuevo que le cuente algo del negocio a un invitado (¿tiene Google Calendar conectado?, ¿qué citó?) da verde en
 * tests/grupos-ops-turno.test.ts. Así que la lista es fija, y sumar uno obliga a decidirlo: con `hayInvitado`, vacío, salvo que no diga nada del negocio.
 */
// `vozDelCanal` (4/11/2026): la voz del grupo o del chat de a dos, dos constantes. `ctxGoogle`: si el negocio tiene su Google Calendar conectado, vacío con un invitado.
const BLOQUES_DEL_SYSTEM = ['DEEP_LINKS', 'LARGO_WHATSAPP', 'aviso', 'baseDelSystem', 'bloqueTools', 'conMemoria', 'ctxAgenda', 'ctxFalla', 'ctxGoogle', 'ctxHoy', 'ctxPend', 'ctxPuntos', 'reglaDeLasMarcas', 'vozDelCanal'];

test('⛔ un bloque nuevo en el system del turno del grupo se decide para un invitado', () => {
  const doer = sinComentarios(readFileSync(join(RAIZ, 'lib/mako-doer-in.ts'), 'utf8'));
  const armado = /const armado = `.*$/m.exec(doer)?.[0] ?? '';
  assert.ok(armado, 'no encuentro el system del turno: esta guarda dejó de mirar');
  const bloques = [...new Set([...armado.matchAll(/\$\{\s*(\w+)/g)].map((m) => m[1]))].sort();
  assert.deepEqual(bloques, BLOQUES_DEL_SYSTEM, 'cambió lo que entra al system: si el bloque nuevo dice algo del negocio, con `hayInvitado` va vacío (como `ctxFalla` y `ctxPuntos`); después se suma acá');
  // Los que traen algo del negocio, vacíos con un invitado.
  assert.match(doer, /const conMemoria = hayInvitado \? \(bloqueQuienEscribe/, 'la memoria del turno le llegaría a un invitado');
  assert.match(doer, /const ctxFalla = hayInvitado \? ''/, 'el estado de las claves del negocio le llegaría a un invitado');
  assert.match(doer, /const ctxPuntos = hayInvitado \? ''/);
  assert.match(doer, /const vigentes = hayInvitado \? \[\]/, 'las pendientes (`ctxPend`) le llegarían a un invitado');
  assert.match(doer, /const agendaAbierta = hayInvitado \? null/, 'la agenda abierta (`ctxAgenda`) le llegaría a un invitado');
  assert.match(doer, /const ctxGoogle = hayInvitado \? ''/, 'si el negocio tiene su Google Calendar conectado le llegaría a un invitado');
  // La cita (`ctxCita`, ticket #40) va sólo en la rama de la memoria que no es de invitado.
  const ramaDelInvitado = /const conMemoria = hayInvitado \? [^\n]*/.exec(doer)?.[0] ?? '';
  assert.ok(ramaDelInvitado, 'no encuentro la memoria del turno: esta guarda dejó de mirar');
  assert.doesNotMatch(ramaDelInvitado, /ctxCita|ctxParaElEquipo|ctxPedidos|ctxYaSeHablo|ctxMostrado/, 'la memoria del negocio le llegaría a un invitado');
});

test('la cañería del bot 1 a 1 no escribe en un grupo: su puerta lo corta antes', () => {
  const salida = sinComentarios(readFileSync(join(RAIZ, 'lib/mako-salida.ts'), 'utf8'));
  const puerta = /async function salidaPara\(jid: string\)[^\n]*\n\s*if \(jid\.endsWith\('@g\.us'\)\) return \{ error:/.test(salida);
  assert.ok(puerta, 'lib/mako-salida-drivers.ts tocaría un grupo sin copiar: `salidaPara` tiene que cortar un jid de grupo antes de todo');
  // Y nadie más usa la cañería: si otro archivo la importa, su excepción de arriba deja de valer.
  const usan = execFileSync('git', ['grep', '--untracked', '-l', '-E', `(from|import\\() *['"](\\./|@/lib/|\\.\\./lib/)mako-salida-drivers['"]`, '--', 'lib', 'app', 'scripts'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n').map((x) => x.trim()).filter((x) => /\.(ts|tsx|mts|mjs|js)$/.test(x) && x !== 'lib/mako-salida-drivers.ts');
  assert.deepEqual(usan, ['lib/mako-salida.ts']);
});

// PROBADO ROMPIÉNDOLO (3/11/2026): una rotura por vez sobre el código real, corriendo este archivo, y restaurada. Las 5 dieron rojo:
//   · un archivo nuevo le pega a Evolution → 1 en rojo: «⛔ TODO lo que sale a un grupo pasa por la copia»
//   · un llamador nuevo de enviarAGrupoJid → 1 en rojo: «⛔ TODO lo que sale a un grupo pasa por la copia»
//   · enviarAlGrupoSuperAdmin no copia → 1 en rojo: «⛔ TODO lo que sale a un grupo pasa por la copia»
//   · enviarAlGrupoMaKo no copia → 1 en rojo: «⛔ TODO lo que sale a un grupo pasa por la copia»
//   · la prueba no copia → 1 en rojo: «⛔ TODO lo que sale a un grupo pasa por la copia»

//   · (4/11/2026) un bloque nuevo en el system (`${ctxGoogle}`) → 1 en rojo: «un bloque nuevo en el system del turno del grupo»
// PROBADO ROMPIÉNDOLO (4/11/2026, al llevarlo a main): una por vez, sobre el código real y restaurada, base 9/0:
//   · `ctxGoogle` sin `hayInvitado` → 1 en rojo: «un bloque nuevo en el system del turno del grupo»
//   · `ctxCita` en la memoria del invitado → 1 en rojo: «un bloque nuevo en el system del turno del grupo»
//   · `salidaPara` (lib/mako-salida.ts) sin el corte de los grupos → 1 en rojo: «la cañería del bot 1 a 1 no escribe en un grupo»
