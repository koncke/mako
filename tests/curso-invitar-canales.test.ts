// =============================================================================
// curso-invitar-canales — la invitación al curso con el email y el WhatsApp PROPIOS del negocio
// =============================================================================
// Item 21 del audio del 08/10/2026 (docs/feedback-curso-08oct.md, minuto 09:30): «¿Y el email de qué va a
// ser? Mi email propio, tengo que conectar mi dominio» — «puedes conectar tu email, puedes conectar tu
// WhatsApp y a la persona le puede llegar por ambos lados».
//
// MEDIDO ANTES DE TOCAR: la invitación al curso salía SIEMPRE firmada «MaKo <equipo@hola-mako.com>»
// (lib/invitaciones.ts → `enviarDePlataforma`), tuviera o no el negocio su dominio verificado.
//
// Lo que estos tests cuidan:
//   · el REMITENTE sale del workspace del ALUMNO y nunca afirma un dominio que no es suyo: ni el sandbox,
//     ni el de MaKo (el ws1 lo tiene puesto como suyo), ni la credencial de la PLATAFORMA que `credWs` le
//     daría al ws1 (`OWNER_WS` es un cliente). Se EJECUTA la regla con DOS negocios distintos;
//   · los CANALES: el correo siempre, el WhatsApp adicional y apagado por default; la casilla se ofrece
//     sólo con línea conectada, envío prendido y teléfono (EJECUTADO);
//   · el ORDEN en el núcleo, EJECUTADO con dependencias inyectadas en un proceso hijo (`server-only` bajo
//     `react-server`): el WhatsApp sale DESPUÉS del correo y de anotarlo, nunca si el correo no salió, y
//     su falla no tira la invitación. ⛔ Sin mandar nada: el WhatsApp del ws1 está PRENDIDO.
//
// PROBADO ROMPIÉNDOLO (08/10/2026, scratchpad/general/romper-invitar.mjs, en memoria y sin git): al pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import {
  canalesDeInvitacion, ofreceWhatsapp, remitenteDeLaInvitacion, direccionDe, fraseWhatsapp, tieneTelefono,
} from '../lib/curso-invitar-canales';
import { textoInvitacionWhatsapp } from '../lib/invitacion-aviso';
import { marcasDeVoseo } from '../lib/puestas-data';

const RAIZ = join(import.meta.dirname, '..');
const leer = (p: string) => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
/** Desde la firma hasta el inicio de la siguiente declaración de nivel 0 que se nombra. */
const bloque = (src: string, firma: string, hasta: string) => {
  const ini = src.indexOf(firma);
  assert.ok(ini >= 0, `no está: ${firma}`);
  const fin = src.indexOf(hasta, ini + firma.length);
  assert.ok(fin > ini, `no encontré el final de ${firma}`);
  return src.slice(ini, fin);
};

// ── El remitente ──────────────────────────────────────────────────────────────

const SIN = { resendFrom: null, resendDominio: null, credFrom: null, credKeyPropia: false, dominioMako: 'hola-mako.com' };

test('el remitente sale del workspace del ALUMNO: con DOS negocios, cada uno firma con el suyo', () => {
  // AGENTS.md: «con UN solo valor configurado no se puede saber si lo leés del lugar correcto».
  const a = remitenteDeLaInvitacion({ ...SIN, resendFrom: 'Academia Uno <hola@uno.mx>', resendDominio: 'uno.mx' });
  const b = remitenteDeLaInvitacion({ ...SIN, resendFrom: 'Escuela Dos <cursos@dos.com>', resendDominio: 'dos.com' });
  assert.deepEqual(a, { via: 'negocio', from: 'Academia Uno <hola@uno.mx>', replyTo: 'hola@uno.mx' });
  assert.deepEqual(b, { via: 'negocio', from: 'Escuela Dos <cursos@dos.com>', replyTo: 'cursos@dos.com' });
  // Sin dominio conectado: el de MaKo, como siempre.
  assert.deepEqual(remitenteDeLaInvitacion(SIN), { via: 'mako' });
});

test('no afirma un dominio que no es suyo: sandbox, el de MaKo, uno que no es el verificado', () => {
  assert.deepEqual(remitenteDeLaInvitacion({ ...SIN, resendFrom: 'X <onboarding@resend.dev>', resendDominio: 'resend.dev' }), { via: 'mako' }, 'el sandbox no entrega a terceros');
  // El ws1 tiene hoy «MaKo <equipo@hola-mako.com>» como su resend_from: va por MaKo, que es quien firma eso.
  assert.deepEqual(remitenteDeLaInvitacion({ ...SIN, resendFrom: 'MaKo <equipo@hola-mako.com>', resendDominio: 'hola-mako.com' }), { via: 'mako' });
  assert.deepEqual(remitenteDeLaInvitacion({ ...SIN, resendFrom: 'X <yo@otro.com>', resendDominio: 'mio.com' }), { via: 'mako' }, 'un from de OTRO dominio que el verificado');
  assert.deepEqual(remitenteDeLaInvitacion({ ...SIN, resendFrom: 'X <yo@mio.com>', resendDominio: null }), { via: 'mako' }, 'un from sin su dominio verificado');
  assert.deepEqual(remitenteDeLaInvitacion({ ...SIN, resendFrom: 'no es un mail', resendDominio: 'mio.com' }), { via: 'mako' });
});

test('la credencial cuenta SÓLO con la key PROPIA del cliente (la de la plataforma nunca es «su dominio»)', () => {
  assert.deepEqual(remitenteDeLaInvitacion({ ...SIN, credFrom: 'Negocio <a@negocio.com>', credKeyPropia: true }),
    { via: 'negocio', from: 'Negocio <a@negocio.com>', replyTo: 'a@negocio.com' });
  assert.deepEqual(remitenteDeLaInvitacion({ ...SIN, credFrom: 'Negocio <a@negocio.com>', credKeyPropia: false }), { via: 'mako' });
  // Y el server las lee DEL CLIENTE, con el ws del parámetro como PRIMERA línea (lib/invitaciones.ts).
  const inv = sinComentarios(leer('lib/invitaciones.ts'));
  const rem = bloque(inv, 'async function remitenteDelNegocio(', 'async function enviarDelNegocio(');
  assert.match(rem, /runWithWorkspace\(ws, async \(\) => \{/);
  assert.match(rem, /credDelCliente\('RESEND_FROM', ws\)/);
  assert.match(rem, /credDelCliente\('RESEND_API_KEY', ws\)/);
  assert.doesNotMatch(rem, /credWs\(/, 'credWs le da al ws1 —un cliente— las credenciales de la plataforma');
  const mail = bloque(inv, 'export async function invitarAlCursoPorEmail(', 'export async function invitarLiderPorEmail(');
  // El cuerpo arranca después del `}> {` que cierra el tipo de retorno (que trae su propio `{`).
  const primera = mail.slice(mail.indexOf('}> {') + 4).trim().split('\n')[0];
  assert.equal(primera, 'const rem = await remitenteDelNegocio(p.ws);', 'el remitente no es lo primero que se resuelve');
  assert.match(mail, /rem\.via === 'negocio' \? await enviarDelNegocio\(p\.ws, rem, mail\) : await enviarDePlataforma\(mail\)/);
  // El del negocio sale adentro de SU workspace y con el from EXPLÍCITO.
  const neg = bloque(inv, 'async function enviarDelNegocio(', 'export async function invitarAlCursoPorEmail(');
  assert.match(neg, /runWithWorkspace\(ws, async \(\) => \{/);
  assert.match(neg, /from: rem\.from,\s*replyTo: rem\.replyTo,/);
});

test('direccionDe: «Nombre <a@b.c>» y «a@b.c», en minúsculas; lo demás no es una dirección', () => {
  assert.equal(direccionDe('Academia <Hola@Uno.MX>'), 'hola@uno.mx');
  assert.equal(direccionDe(' a@b.co '), 'a@b.co');
  assert.equal(direccionDe('Academia'), null);
  assert.equal(direccionDe(''), null);
  assert.equal(direccionDe(null), null);
});

// ── Los canales ───────────────────────────────────────────────────────────────

test('los canales: el correo SIEMPRE; el WhatsApp sólo si se pide, y nunca solo', () => {
  assert.deepEqual(canalesDeInvitacion(undefined), ['email'], 'el default (la invitación al ganar no pasa canales)');
  assert.deepEqual(canalesDeInvitacion(['email']), ['email']);
  assert.deepEqual(canalesDeInvitacion(['email', 'whatsapp']), ['email', 'whatsapp']);
  assert.deepEqual(canalesDeInvitacion(['whatsapp']), ['email', 'whatsapp'], 'un WhatsApp sin correo no figura como invitación');
  assert.deepEqual(canalesDeInvitacion('whatsapp'), ['email'], 'un texto suelto no es una lista');
  assert.deepEqual(canalesDeInvitacion(['sms', 'paloma']), ['email']);
});

test('la casilla «También por WhatsApp»: línea conectada, envío prendido y teléfono, las tres', () => {
  const si = { lineaConectada: true, envioPrendido: true, conTelefono: true };
  assert.equal(ofreceWhatsapp(si), true);
  assert.equal(ofreceWhatsapp({ ...si, lineaConectada: false }), false, 'sin línea conectada');
  assert.equal(ofreceWhatsapp({ ...si, envioPrendido: false }), false, 'con el envío del negocio apagado');
  assert.equal(ofreceWhatsapp({ ...si, conTelefono: false }), false, 'sin teléfono');
  assert.equal(tieneTelefono('+52 1 55 1234 5678'), true);
  for (const t of [null, undefined, '', '  ', 'sin número']) assert.equal(tieneTelefono(t), false, `teléfono «${String(t)}»`);
});

test('las dos pestañas preguntan con el MISMO booleano (el banco encontró la lista pasando un «si» sin dígitos)', () => {
  // Hasta el banco del 08/10/2026 la lista le pasaba `telefono: … ? 'si' : null` a una regla que contaba
  // DÍGITOS: la casilla no aparecía nunca en «Clientes sin invitar», con este archivo en verde.
  const comp = sinComentarios(leer('app/customer-success/curso/InvitarAlumnos.tsx'));
  assert.match(comp, /conTelefono: wa\.conTelefono\.has\(id\)/);
  assert.match(comp, /conTelefono: tieneTelefono\(telefono\)/);
  assert.match(sinComentarios(leer('app/customer-success/curso/invitar-actions.ts')), /if \(tieneTelefono\(f\.telefono\)\) conTelefono\.push\(Number\(f\.id\)\);/);
});

test('el texto del WhatsApp: corto, con el negocio, el link SOLO en su renglón, y en neutro', () => {
  const t = textoInvitacionWhatsapp({ nombre: 'Teresa de Jesús', programa: 'Negocio que Escala', negocio: 'Academia Uno', enlace: 'https://x.test/api/compartido/curso/entrar?t=c1.1.2.3.f' });
  assert.equal(t, 'Hola Teresa, tu acceso a Negocio que Escala de Academia Uno ya está listo.\nEntra desde aquí:\nhttps://x.test/api/compartido/curso/entrar?t=c1.1.2.3.f');
  assert.ok(t.length < 300, 'un WhatsApp se lee de una pasada');
  assert.deepEqual(marcasDeVoseo(t), []);
  assert.match(textoInvitacionWhatsapp({ programa: '', enlace: 'L' }), /^Hola, tu acceso a tu programa ya está listo\./);
  assert.equal(fraseWhatsapp({ enviado: true }), 'También por WhatsApp.');
  assert.equal(fraseWhatsapp({ enviado: false, motivo: 'sin teléfono' }), 'WhatsApp: sin teléfono.');
  assert.equal(fraseWhatsapp({ enviado: false }), 'WhatsApp: no salió.');
});

// ── El núcleo, EJECUTADO con dependencias inyectadas (⛔ sin mandar nada) ────

type Caso = { r: Record<string, unknown> & { whatsapp?: { enviado: boolean; motivo?: string } }; log: string[] };
function correrNucleo(): Record<string, Caso> {
  const archivo = JSON.stringify(pathToFileURL(join(RAIZ, 'lib/curso-invitar.ts')).href);
  // ⚠️ SIN BACKTICKS adentro: este código va en un template literal.
  const codigo = `
    const { invitarAlCurso } = await import(${archivo});
    const salida = {};
    function deps(o) {
      const log = [];
      const d = {
        enWorkspace: async (ws, fn) => { log.push('ws:' + ws); return await fn(); },
        capaConCs: async () => true,
        lead: async () => ({ nombre: 'Ana Pérez', email: 'ana@x.mx', ganado: true, telefono: 'telefono' in o ? o.telefono : '5215512345678' }),
        acceso: async () => null,
        cursos: async () => ['Negocio que Escala'],
        linkDeEntrada: async () => 'https://x/api/compartido/curso/entrar?t=c1.9.21.1.f',
        reclamar: async () => true,
        soltar: async () => { log.push('soltar'); },
        negocio: async () => 'Academia Uno',
        entrarConGoogle: () => 'https://x/login',
        mandar: async (m) => { log.push('mandar:ws=' + m.ws); return o.mandar || { enviado: true, enlace: m.enlace }; },
        mandarWhatsapp: async (m) => {
          log.push('whatsapp:' + m.telefono + ':' + m.enlace);
          if (o.waTira) throw new Error('se cayó evolution');
          return o.wa || { enviado: true };
        },
        marcar: async () => { log.push('marcar'); },
        guardarEmailDelLead: async () => {},
      };
      return { d, log };
    }
    async function caso(nombre, p, o) {
      const { d, log } = deps(o || {});
      const r = await invitarAlCurso(Object.assign({ ws: 9, leadId: 21, autor: 'Equipo' }, p), d);
      salida[nombre] = { r, log };
    }
    await caso('soloCorreo', {}, {});
    await caso('conWhatsapp', { canales: ['email', 'whatsapp'] }, {});
    await caso('soloWhatsappPedido', { canales: ['whatsapp'] }, {});
    await caso('correoCaido', { canales: ['email', 'whatsapp'] }, { mandar: { enviado: false, error: 'dominio sin verificar', enlace: 'e' } });
    await caso('whatsappTira', { canales: ['email', 'whatsapp'] }, { waTira: true });
    await caso('whatsappNo', { canales: ['email', 'whatsapp'] }, { wa: { enviado: false, motivo: 'sin teléfono' }, telefono: null });
    console.log(JSON.stringify(salida));
  `;
  const out = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', codigo], {
    cwd: RAIZ, encoding: 'utf8', timeout: 170_000, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const linea = out.trim().split('\n').filter((x) => x.startsWith('{')).pop();
  assert.ok(linea, `el hijo no devolvió JSON:\n${out}`);
  return JSON.parse(linea) as Record<string, Caso>;
}
let NUC: Record<string, Caso> | null = null;
const nuc = () => (NUC ??= correrNucleo());

test('sin canales es lo de siempre: sólo correo, y el correo sabe de QUÉ negocio es (su ws)', { timeout: 180_000 }, () => {
  const s = nuc().soloCorreo;
  assert.ok(!s.log.some((x) => x.startsWith('whatsapp:')), 'mandó un WhatsApp que nadie pidió');
  assert.equal(s.r.whatsapp, undefined);
  assert.ok(s.log.includes('mandar:ws=9'), 'el correo no recibe el workspace del alumno: el remitente se resolvería con otro');
});

test('con WhatsApp: el MISMO link, DESPUÉS del correo y de anotarlo', { timeout: 180_000 }, () => {
  const s = nuc().conWhatsapp;
  const m = s.log.indexOf('mandar:ws=9');
  const k = s.log.indexOf('marcar');
  const w = s.log.findIndex((x) => x.startsWith('whatsapp:'));
  assert.ok(m >= 0 && k > m && w > k, `el orden es correo → anotar → WhatsApp: ${s.log.join(' | ')}`);
  assert.equal(s.log[w], 'whatsapp:5215512345678:https://x/api/compartido/curso/entrar?t=c1.9.21.1.f');
  assert.deepEqual(s.r.whatsapp, { enviado: true });
  assert.equal(s.r.enviado, true);
  // Pedir sólo WhatsApp manda igual el correo: la invitación tiene UN estado.
  const solo = nuc().soloWhatsappPedido;
  assert.ok(solo.log.includes('mandar:ws=9') && solo.log.some((x) => x.startsWith('whatsapp:')));
});

test('si el correo NO salió, el WhatsApp tampoco (un mensaje de menos, nunca uno de más)', { timeout: 180_000 }, () => {
  const s = nuc().correoCaido;
  assert.ok(!s.log.some((x) => x.startsWith('whatsapp:')), 'salió un WhatsApp de una invitación que figura sin mandar');
  assert.deepEqual(s.r.whatsapp, { enviado: false, motivo: 'no salió el correo' });
  assert.ok(s.log.includes('soltar'));
});

test('el WhatsApp que falla (o tira) no tira la invitación: el correo ya salió y quedó anotado', { timeout: 180_000 }, () => {
  const t = nuc().whatsappTira;
  assert.equal(t.r.tipo, 'mandado');
  assert.equal(t.r.enviado, true);
  assert.deepEqual(t.r.whatsapp, { enviado: false, motivo: 'no salió' });
  const n = nuc().whatsappNo;
  assert.deepEqual(n.r.whatsapp, { enviado: false, motivo: 'sin teléfono' });
  assert.ok(n.log.some((x) => x === 'whatsapp:null:https://x/api/compartido/curso/entrar?t=c1.9.21.1.f'), 'el teléfono del CRM no llega a quien decide');
});

// ── El cableado: la action, el modal y la dependencia real ───────────────────

test('la action sanea los canales en el SERVER, con su tope; el modal los manda y la casilla nace apagada', () => {
  const acc = sinComentarios(leer('app/customer-success/curso/invitar-actions.ts'));
  assert.match(acc, /const canales = canalesDeInvitacion\(opts\?\.canales\);/);
  assert.match(acc, /if \(canales\.includes\('whatsapp'\) && items\.length > TOPE_TANDA_WHATSAPP\)/);
  assert.match(acc, /canales: canalesDeInvitacion\(datos\.canales\)/);
  // La disponibilidad se pregunta a la MISMA línea por la que sale (la de por default).
  const op = bloque(acc, 'export async function opcionesDeInvitarAction(', 'async function conEstado(');
  assert.match(op, /getInstanciaRow\(\)/);
  assert.match(op, /envioWhatsappHabilitado\(\)/);
  assert.match(op, /lineaConectada: linea\?\.estado === 'conectado'/);
  const comp = sinComentarios(leer('app/customer-success/curso/InvitarAlumnos.tsx'));
  assert.equal((comp.match(/const \[porWhatsapp, setPorWhatsapp\] = useState\(false\);/g) ?? []).length, 2, 'la casilla nace prendida en alguna pestaña');
  // Las dos pestañas mandan lo que dice la casilla. Y «Volver a invitar» (el alta de cero cuyo correo no
  // salió reintenta SÓLO la invitación, 09/10/2026) manda lo que se pidió AL CREAR, guardado en `listo`:
  // con el borrador ya vacío, `ofreceWa` dice que no y el WhatsApp marcado se perdía (revisión de la corrida).
  assert.equal((comp.match(/canalesCon\(ofreceWa && porWhatsapp\)/g) ?? []).length, 2, 'una pestaña no manda los canales');
  assert.match(comp, /conWhatsapp: ofreceWa && porWhatsapp \}\);/, 'lo pedido al crear no queda guardado para reintentar');
  assert.equal((comp.match(/canalesCon\(listo\.conWhatsapp\)/g) ?? []).length, 1, '«Volver a invitar» no manda lo pedido al crear');
  assert.equal((comp.match(/\{ofreceWa && \(\s*<Checkbox checked=\{porWhatsapp\}/g) ?? []).length, 2, 'la casilla se dibuja sin poder mandarse');
  assert.match(comp, /opcionesDeInvitarAction\(idsSinInvitar\)/);
});

test('la dependencia real: el teléfono, el interruptor del negocio, la línea conectada y el bloqueo, ANTES de mandar', () => {
  const src = sinComentarios(leer('lib/curso-invitar.ts'));
  const wa = bloque(src, 'async function mandarInvitacionPorWhatsapp(', '\n}\n');
  const i = (s: string) => { const n = wa.indexOf(s); assert.ok(n >= 0, `falta «${s}»`); return n; };
  const envio = i('envio.enviarYEspejar(');
  for (const corte of ["if (!telefono) return", 'if (!(await flags.envioWhatsappHabilitado()))', "if (linea?.estado !== 'conectado')", 'if (await bloqueos.estaBloqueado(telefono))']) {
    assert.ok(i(corte) < envio, `«${corte}» se mira después de mandar`);
  }
  // Por la línea de POR DEFAULT: sin `linea` (la elige `elegirLinea`), igual que la que se ofrece.
  assert.doesNotMatch(wa, /linea:/, 'el envío nombra una línea distinta de la que ofreció la casilla');
  assert.match(src, /mandarWhatsapp: \(m\) => mandarInvitacionPorWhatsapp\(m\),/);
  // La invitación automática al ganar (del CRM) no pasa canales: sigue siendo sólo correo.
  assert.doesNotMatch(sinComentarios(leer('lib/crm-curso-al-ganar.ts')), /canales/);
});

// ── ROTURAS ──────────────────────────────────────────────────────────────────────
// Medido el 08/10/2026 (scratchpad/general/romper.mjs + roturas.mjs, en memoria y sin git). Con todo en
// su lugar: 14 pass / 0 fail. Cada rotura, sola, dio 13 / 1 (la 26, 12 / 2):
//  20. el dominio de MaKo cuenta como «su dominio» · 22. un from de otro dominio que el verificado
//      → «no afirma un dominio que no es suyo…»
//  21. la credencial cuenta sin key propia · 28. el remitente leído con `credWs` · 29. cableado al ws1
//      → «la credencial cuenta SÓLO con la key PROPIA…»
//  23. pedir sólo WhatsApp saca el correo                      → «los canales…»
//  24. la casilla se ofrece con el envío apagado               → «la casilla…»
//  25. el WhatsApp sale aunque nadie lo pidió                  → «sin canales es lo de siempre…»
//  26. el correo no recibe el ws del alumno                    → ese y «con WhatsApp…» (11 / 2)
//  27. una falla del WhatsApp tira la invitación               → «el WhatsApp que falla…»
//  30. los canales sin sanear en la action · 31. la casilla nace prendida → «la action sanea…»
//  32. el WhatsApp sin mirar el interruptor del negocio        → «la dependencia real…»
//  38. vuelve el bug que encontró el banco (la lista pasa un «si» sin dígitos) → «las dos pestañas…»
