// =============================================================================
// email-remitente — QUIÉN manda un email de un flujo, y QUIÉN lo firma (punto 16 de la cuarta tanda)
// =============================================================================
// Pedido de Martín (09/10/2026): «En la opción de "De" se debería poder elegir el email remitente…
// Abajo del todo pusiste "MaKo / Si no quieres recibir más estos correos, darme de baja." eso no tiene
// sentido, es una automatización de cada cliente, no debería decir MaKo».
//
// Lo que fija:
//   · el pie de un email de un CLIENTE firma con el nombre de SU NEGOCIO, nunca con el nombre visible
//     del remitente (en el ws1 ese nombre es «MaKo»; desde el sandbox, «Mauricio Bustos» para todos);
//     el link de baja se queda; los mails de la PLATAFORMA siguen firmando «MaKo»; y lo mismo en los
//     broadcasts de /email y en la prueba de verdad de «Probar» (un barrido sobre app/ y lib/);
//   · el remitente de un paso sólo se usa si es del MISMO DOMINIO que el del workspace (la cuenta de
//     Resend es una para todos: sin esto un paso mandaría en nombre de otro cliente);
//   · los vinculados del «De», y que el motor y `setSecuenciaPasos` los usen (los dos lados).
//
// ── Roturas ── al final.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  sanearRemitente, direccionDe, dominioDe, esRemitenteSandbox, remitenteDelPaso, remitentesVinculados,
  opcionesDeRemitente, remitenteAGuardar, firmaDelPie, partesDeRemitente,
  remitenteDelNegocio, problemaDeRemitenteGuardado, SIN_EMAIL_PROPIO, POR_QUE_SIN_EMAIL, NO_ES_TUYO,
  type HechosRemitente,
} from '../lib/email-remitente';
import { MOTIVO_MEDIO } from '../lib/medios-automatizacion';
import { renderEmailHtml } from '../lib/email-html';
import { paramsDeVista, nombreDelRemitente } from '../app/automations/EditorEmailGmail';
import { remitenteVisible } from '../app/automations/PanelProbar';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// ── El pie ───────────────────────────────────────────────────────────────────────────────────

test('el pie del ws1 firma «Mauricio Bustos» (su negocio) y no «MaKo» (su remitente), con el link de baja', () => {
  // El caso de la captura: el remitente del ws1 es «MaKo <equipo@hola-mako.com>» (medido en la base).
  const html = renderEmailHtml(paramsDeVista({ asunto: 'Tu llamada', preheader: '', cuerpo: 'Hola', negocio: 'Mauricio Bustos', remitente: 'MaKo <equipo@hola-mako.com>' }));
  const pie = html.slice(html.lastIndexOf('border-top:1px solid'));
  assert.match(pie, />Mauricio Bustos</, 'el pie no firma con el negocio');
  assert.doesNotMatch(pie, />MaKo</, 'el pie volvió a firmar con el nombre del remitente');
  assert.match(pie, /darme de baja<\/a>/, 'el link de baja se queda: es lo que separa un mail de un spam');
  // Y desde el sandbox, el nombre de OTRO cliente no firma nada.
  const sand = renderEmailHtml(paramsDeVista({ asunto: 'a', preheader: '', cuerpo: 'x', negocio: 'Codigo Inmobiliario', remitente: 'Mauricio Bustos <onboarding@resend.dev>' }));
  assert.doesNotMatch(sand.slice(sand.lastIndexOf('border-top:1px solid')), /Mauricio Bustos/);
});

test('firmaDelPie: el nombre del negocio, sin espacios de más; sin negocio, sin firma', () => {
  assert.equal(firmaDelPie('  Inmobiliaria   del Valle '), 'Inmobiliaria del Valle');
  assert.equal(firmaDelPie(''), '');
  assert.equal(firmaDelPie(null), '');
  assert.equal(firmaDelPie(undefined), '');
});

test('los mails de la PLATAFORMA siguen firmando MaKo (no pasan por la firma del negocio)', () => {
  assert.match(sinComentarios(leer('lib/invitaciones.ts')), /fromName: 'MaKo',/);
  assert.match(sinComentarios(leer('lib/aviso-plan.ts')), /fromName: 'MaKo',/);
  const aviso = renderEmailHtml({ subject: 's', bodyText: 'b', marca: 'mako' });
  assert.match(aviso, /Te lo manda MaKo/, 'la banda y el pie de la plataforma cambiaron');
});

// ⚠️ EL MISMO BUG VIVÍA EN OTROS DOS LUGARES (09/10/2026, al cerrar el punto 16): los broadcasts de
// /email (lib/email-marketing.ts, el envío y su prueba) firmaban `displayNameDe(getEmailFrom())` —«MaKo»
// en los broadcasts del ws1 a SUS leads— y la prueba de verdad de «Probar» (lib/prueba-paso.ts) llegaba
// sin firma, o sea distinta del mail que recibe el lead. El barrido mira TODO app/ y lib/: una firma
// nueva con el nombre visible del remitente falla acá, no en la bandeja de un lead.
const FUENTES = ['app', 'lib'].flatMap((d) => (readdirSync(new URL(`../${d}`, import.meta.url), { recursive: true }) as string[])
  .filter((f) => /\.tsx?$/.test(f)).map((f) => `${d}/${f.replace(/\\/g, '/')}`));
/**
 * Los únicos que firman con el nombre visible de un remitente, con su porqué. `lib/invitaciones.ts`
 * (`enviarDelNegocio`): manda con el remitente PROPIO del negocio, que sólo existe si verificó SU dominio
 * (`remitenteDeLaInvitacion` descarta el sandbox y el de MaKo), así que ese nombre lo eligió el negocio.
 */
const FIRMA_CON_REMITENTE_PERMITIDA = new Set(['lib/invitaciones.ts']);

test('NINGÚN mail de un cliente firma con el nombre visible del remitente: los broadcasts y la prueba firman con el negocio', () => {
  const firmanConRemitente = FUENTES.filter((f) => /fromName:\s*displayNameDe\(/.test(sinComentarios(leer(f))));
  assert.ok(FUENTES.length > 500, `el barrido leyó ${FUENTES.length} archivos: está mirando otra cosa`);
  assert.deepEqual(firmanConRemitente.filter((f) => !FIRMA_CON_REMITENTE_PERMITIDA.has(f)), [],
    'un mail firma con el nombre visible del remitente («MaKo» en el ws1, otro cliente desde el sandbox)');
  // Y el permiso no queda colgado: si ya no firma así, la excepción se va.
  for (const f of FIRMA_CON_REMITENTE_PERMITIDA) assert.ok(firmanConRemitente.includes(f), `${f} ya no firma con su remitente: sacalo de la lista`);

  // Los broadcasts: el envío y su prueba, los DOS con la firma del negocio.
  const mk = sinComentarios(leer('lib/email-marketing.ts'));
  const fn = mk.slice(mk.indexOf('async function firmaDelNegocioActual('), mk.indexOf('\n}\n', mk.indexOf('async function firmaDelNegocioActual(')));
  assert.ok(fn.length > 60 && fn.length < 400, `el recorte de firmaDelNegocioActual mide ${fn.length}`);
  assert.match(fn, /return ws \? firmaDelPie\(\(await getWorkspace\(ws\)\)\?\.nombre\) : '';/, 'la firma de los broadcasts no es el negocio');
  assert.deepEqual([...mk.matchAll(/fromName: ([^,}]+)/g)].map((m) => m[1]!.trim()), ['await firmaDelNegocioActual()', 'fromNameWs']);
  assert.match(mk, /const fromNameWs = await firmaDelNegocioActual\(\);/);

  // La prueba de verdad de «Probar»: la misma firma que el envío.
  const pp = sinComentarios(leer('lib/prueba-paso.ts'));
  assert.match(pp, /\? await getWorkspace\(p\.ws\)\.then\(\(w\) => firmaDelPie\(w\?\.nombre\)\)\.catch\(\(\) => ''\)/, 'la prueba no firma con el negocio');
  assert.match(pp, /renderEmailHtml\(\{ subject: envio\.asunto, bodyText: envio\.texto, bodyHtml: envio\.html \|\| undefined, fromName: firma \}\)/,
    'la prueba de «Probar» llega sin la firma que recibe el lead');
});

// ── Leer un remitente ────────────────────────────────────────────────────────────────────────

test('sanearRemitente: las dos formas, en minúsculas y sin lo que inyecta un encabezado', () => {
  assert.equal(sanearRemitente('Ana Pérez <Ana@Valle.MX>'), 'Ana Pérez <ana@valle.mx>');
  assert.equal(sanearRemitente(' hola@valle.mx '), 'hola@valle.mx');
  assert.equal(sanearRemitente('"Ana, ventas" <ana@valle.mx>'), 'Ana ventas <ana@valle.mx>', 'el nombre sale con el saneo de la ruta');
  assert.equal(sanearRemitente('<ana@valle.mx>'), 'ana@valle.mx');
  assert.equal(sanearRemitente('Ana <ana@valle.mx>\r\nBcc: x@y.com'), null, 'un salto de renglón es inyección de encabezados');
  assert.equal(sanearRemitente('Ana <a@b@valle.mx>'), null);
  assert.equal(sanearRemitente('Ana <ana@valle>'), null, 'un dominio sin TLD');
  assert.equal(sanearRemitente('Ana <an a@valle.mx>'), null);
  assert.equal(sanearRemitente('ana'), null);
  assert.equal(sanearRemitente(''), null);
  assert.equal(sanearRemitente(null), null);
  assert.equal(sanearRemitente(42), null);
  assert.equal(sanearRemitente(`Ana <${'a'.repeat(250)}@valle.mx>`), null);
  assert.equal(direccionDe('Ana <ANA@valle.mx>'), 'ana@valle.mx');
  assert.equal(dominioDe('Ana <ana@Valle.mx>'), 'valle.mx');
  assert.equal(dominioDe('nada'), null);
  assert.deepEqual(partesDeRemitente('Ana <ana@valle.mx>'), { nombre: 'Ana', mail: 'ana@valle.mx' });
  assert.deepEqual(partesDeRemitente('ana@valle.mx'), { nombre: 'ana@valle.mx', mail: 'ana@valle.mx' });
});

test('el sandbox no lleva el nombre de un CLIENTE: sin nombre visible, «Probar» dice el del negocio', () => {
  // Decía «Mauricio Bustos <onboarding@resend.dev>»: el remitente de todo workspace sin dominio, así que
  // la bandeja de «Probar» de OTRO negocio decía «De: Mauricio Bustos».
  assert.match(sinComentarios(leer('lib/resend.ts')), /const SANDBOX_FROM = 'onboarding@resend\.dev';/, 'el sandbox volvió a tener un nombre');
  assert.equal(esRemitenteSandbox('onboarding@resend.dev'), true);
  assert.equal(nombreDelRemitente('onboarding@resend.dev'), '');
  assert.deepEqual(remitenteVisible('onboarding@resend.dev', 'Codigo Inmobiliario'), { nombre: 'Codigo Inmobiliario', mail: 'onboarding@resend.dev' });
});

test('el sandbox se reconoce con la MISMA regla que lib/resend.ts', () => {
  assert.equal(esRemitenteSandbox('Mauricio Bustos <onboarding@resend.dev>'), true);
  assert.equal(esRemitenteSandbox('onboarding@resend.dev'), true);
  assert.equal(esRemitenteSandbox('MaKo <equipo@hola-mako.com>'), false);
  // lib/resend.ts no se puede importar acá (server-only): se compara la REGEX escrita en los dos.
  const resend = sinComentarios(leer('lib/resend.ts'));
  const mio = sinComentarios(leer('lib/email-remitente.ts'));
  assert.match(resend, /\/@resend\\\.dev>\?\\s\*\$\/i\.test\(await getEmailFrom\(\)\)/, 'cambió la regla del sandbox en lib/resend.ts');
  assert.match(mio, /const SANDBOX = \/@resend\\\.dev>\?\\s\*\$\/i;/, 'el módulo se separó de lib/resend.ts');
});

// ── El remitente de un paso: sólo del dominio del negocio ────────────────────────────────────

test('remitenteDelPaso: del mismo dominio sí; de otro dominio, del sandbox o ilegible, no', () => {
  const ws = 'Inmobiliaria <hola@valle.mx>';
  assert.equal(remitenteDelPaso('Ventas <ventas@valle.mx>', ws), 'Ventas <ventas@valle.mx>');
  assert.equal(remitenteDelPaso('ventas@VALLE.mx', ws), 'ventas@valle.mx', 'el dominio se compara sin mayúsculas');
  // ⚠️ El caso que importa: la cuenta de Resend es una para todos, así que otro dominio verificado ahí
  // saldría igual. Un paso de un cliente no puede mandar como MaKo ni como otro cliente.
  assert.equal(remitenteDelPaso('MaKo <equipo@hola-mako.com>', ws), null, 'un paso mandaría en nombre de MaKo');
  assert.equal(remitenteDelPaso('Leila <hola@leilafittipaldi.com>', ws), null, 'un paso mandaría en nombre de otro cliente');
  assert.equal(remitenteDelPaso('ventas@mail.valle.mx', ws), null, 'un subdominio no es el dominio');
  assert.equal(remitenteDelPaso('Ventas <ventas@valle.mx>', 'Mauricio Bustos <onboarding@resend.dev>'), null, 'con el sandbox no sale nada');
  assert.equal(remitenteDelPaso('onboarding@resend.dev', 'onboarding@resend.dev'), null);
  assert.equal(remitenteDelPaso('Ventas <ventas@valle.mx>', ''), null);
  assert.equal(remitenteDelPaso('Ventas <ventas@valle.mx>', null), null);
  assert.equal(remitenteDelPaso(null, ws), null);
  assert.equal(remitenteDelPaso(undefined, ws), null);
  assert.equal(remitenteDelPaso('Ventas <ventas@valle.mx>\nBcc: x@y.com', ws), null);
});

test('los vinculados: el del workspace primero, sin repetidos, sólo de su dominio; con el sandbox, ninguno', () => {
  assert.deepEqual(remitentesVinculados({ remitente: 'Inmobiliaria <hola@valle.mx>', sandbox: false }), ['Inmobiliaria <hola@valle.mx>']);
  assert.deepEqual(remitentesVinculados({
    remitente: 'Inmobiliaria <hola@valle.mx>', sandbox: false,
    remitentes: ['Ventas <ventas@valle.mx>', 'Inmobiliaria <HOLA@valle.mx>', 'MaKo <equipo@hola-mako.com>', 'basura', 'Ventas <ventas@valle.mx>'],
  }), ['Inmobiliaria <hola@valle.mx>', 'Ventas <ventas@valle.mx>']);
  assert.deepEqual(remitentesVinculados({ remitente: 'Mauricio Bustos <onboarding@resend.dev>', sandbox: true }), []);
  assert.deepEqual(remitentesVinculados({ remitente: 'Mauricio Bustos <onboarding@resend.dev>' }), [], 'el sandbox se reconoce aunque la ruta no lo diga');
  assert.deepEqual(remitentesVinculados(null), []);
  assert.deepEqual(remitentesVinculados({ remitente: '' }), []);
});

test('las opciones del De suman el del paso si todavía se puede usar; si no, no lo prometen', () => {
  const ws = 'Inmobiliaria <hola@valle.mx>';
  assert.deepEqual(opcionesDeRemitente([ws], 'Ventas <ventas@valle.mx>', ws), [ws, 'Ventas <ventas@valle.mx>']);
  assert.deepEqual(opcionesDeRemitente([ws], ws, ws), [ws], 'el del workspace no se repite');
  assert.deepEqual(opcionesDeRemitente([ws], 'Leila <hola@leilafittipaldi.com>', ws), [ws], 'uno de otro dominio no se ofrece');
  assert.deepEqual(opcionesDeRemitente([], 'x@valle.mx', 'Mauricio Bustos <onboarding@resend.dev>'), []);
});

test('remitenteAGuardar: el escritor que no lo manda lo conserva; null o vacío lo sacan', () => {
  assert.equal(remitenteAGuardar(undefined, 'Ventas <ventas@valle.mx>'), 'Ventas <ventas@valle.mx>', 'la quinta puerta: guardar desde /email lo borraba');
  assert.equal(remitenteAGuardar(null, 'Ventas <ventas@valle.mx>'), null);
  assert.equal(remitenteAGuardar('', 'Ventas <ventas@valle.mx>'), null);
  assert.equal(remitenteAGuardar('Otra <OTRA@valle.mx>', 'Ventas <ventas@valle.mx>'), 'Otra <otra@valle.mx>');
  assert.equal(remitenteAGuardar('basura', 'Ventas <ventas@valle.mx>'), null, 'lo ilegible no se guarda');
  assert.equal(remitenteAGuardar(undefined, undefined), null);
});

// ── Los dos lados: el motor y `setSecuenciaPasos` ────────────────────────────────────────────

const MOTOR = sinComentarios(leer('lib/nutricion.ts'));

test('el motor manda con el remitente del paso (si es del dominio) y firma con el negocio', () => {
  const envio = MOTOR.slice(MOTOR.indexOf("} else if (emailOn && paso.canal === 'email') {"), MOTOR.indexOf('await supabase.from(\'nutricion_envios\').insert({', MOTOR.indexOf("} else if (emailOn && paso.canal === 'email') {")));
  assert.ok(envio.length > 800 && envio.length < 5000, `el recorte de la rama de email mide ${envio.length}: está mirando otra cosa`);
  assert.match(envio, /const fromPaso = remitenteDelPaso\(paso\.remitente, remitente\);/);
  const llamada = envio.slice(envio.indexOf('const r = await sendEmail({'));
  assert.match(llamada, /^const r = await sendEmail\(\{\s*to: lead\.email,\s*\.\.\.\(fromPaso \? \{ from: fromPaso \} : \{\}\),/, 'el From del paso no llega a sendEmail');
  assert.match(llamada, /fromName: firmaDelPie\(negocio\),/, 'la firma del pie no es el negocio');
  // El `remitente` que compara es el del WORKSPACE (getEmailFrom), el mismo que decide el sandbox.
  // (Décima tanda, EMAIL 1: la tupla suma `remitenteDeMako` al final; la undécima la deja muerta y la ola 3 la saca:
  // por eso es opcional acá. Lo que sigue fijo es que `remitente` sea `getEmailFrom()`.)
  assert.match(MOTOR, /const \[waOn, emailOn, sandbox, remitente, lineasEvo(, remitenteDeMako)?\] = await Promise\.all\(\[\s*envioWhatsappHabilitado\(\),\s*envioEmailHabilitado\(\),\s*remitenteEsSandbox\(\),\s*getEmailFrom\(\),/);
  assert.doesNotMatch(MOTOR, /displayNameDe\(/, 'volvió la firma con el nombre visible del remitente');
});

test('setSecuenciaPasos guarda el remitente SÓLO en un email, y lo conserva si el escritor no lo manda', () => {
  assert.match(MOTOR, /remitentesPrevios\.set\(idDe\(p, i\), p\.remitente\)/, 'no se lee el remitente de lo ya guardado');
  const fn = MOTOR.slice(MOTOR.indexOf('const remitenteDelGuardado = '), MOTOR.indexOf('};', MOTOR.indexOf('const remitenteDelGuardado = ')));
  assert.match(fn, /canal === 'email' \? remitenteAGuardar\(p\.remitente, remitentesPrevios\.get\(idDe\(flujo, i\)\)\) : null/);
  const limpio = MOTOR.slice(MOTOR.indexOf('const limpio = pasos'), MOTOR.indexOf('const grafo = normalizar(limpio);'));
  assert.match(limpio, /\.\.\.remitenteDelGuardado\(p, flujo, i, comun\.canal\),/, 'el paso se reconstruye sin el remitente: se borraría en cada guardado');
});

// ── Undécima tanda: EL REMITENTE DEL NEGOCIO, POR UNA REGLA POSITIVA ─────────────────────────────
// Decisión 3 de la décima, literal de Martín: «Quitale a Mauricio que pueda mandar email con MaKo. Nadie
// debería poder.» Los casos son los MEDIDOS el 11/10/2026 (scripts/undecima-email-remitente.mts, simulacro):
// el ws1 con «MaKo <equipo@hola-mako.com>» y sin `resend_domain`; ws10 y ws11 con su propia cuenta de Resend;
// ws1 y ws4 con la key de la PLATAFORMA en su fila (la del ws4, una copia).

const NADA: HechosRemitente = { resendFrom: null, resendDominio: null, credFrom: null, keyPropia: false, plataforma: false };
const con = (h: Partial<HechosRemitente>): HechosRemitente => ({ ...NADA, ...h });

test('remitenteDelNegocio: los workspaces medidos, hoy y después del script', () => {
  // ws1 HOY: el de MaKo, sin dominio reclamado, con la key de la plataforma (keyPropia false).
  assert.deepEqual(remitenteDelNegocio(con({ resendFrom: 'MaKo <equipo@hola-mako.com>' })), { puede: false, motivo: 'de-mako' });
  // ws1 después de scripts/undecima-email-remitente.mts (`resend_from` = '').
  assert.deepEqual(remitenteDelNegocio(con({ resendFrom: '' })), { puede: false, motivo: 'sin-remitente' });
  assert.deepEqual(remitenteDelNegocio(NADA), { puede: false, motivo: 'sin-remitente' });
  // ws10: su cuenta, su remitente.
  assert.deepEqual(remitenteDelNegocio(con({ credFrom: 'leandro@contacto.leandrotejado.com', keyPropia: true })),
    { puede: true, from: 'leandro@contacto.leandrotejado.com', via: 'cuenta-propia' });
  // ws11: su cuenta, y además un `resend_domain` sin `resend_from` (no estorba).
  assert.deepEqual(remitenteDelNegocio(con({ resendDominio: 'leilafittipaldi.com', credFrom: 'hola@leilafittipaldi.com', keyPropia: true })),
    { puede: true, from: 'hola@leilafittipaldi.com', via: 'cuenta-propia' });
  // Estilo ws4: la key de la PLATAFORMA (copiada) con un FROM ajeno no es una cuenta propia.
  assert.deepEqual(remitenteDelNegocio(con({ credFrom: 'Ventas <ventas@valle.mx>', keyPropia: false })), { puede: false, motivo: 'sin-cuenta-propia' });
});

test('remitenteDelNegocio: vía DOMINIO, sólo el dominio que ESE workspace reclamó', () => {
  assert.deepEqual(remitenteDelNegocio(con({ resendFrom: 'Valle <Hola@Valle.MX>', resendDominio: 'valle.mx' })),
    { puede: true, from: 'Valle <hola@valle.mx>', via: 'dominio' }, 'sale saneado');
  assert.equal(remitenteDelNegocio(con({ resendFrom: 'Valle <hola@valle.mx>', resendDominio: 'VALLE.mx' })).puede, true, 'el dominio sin mayúsculas');
  assert.deepEqual(remitenteDelNegocio(con({ resendFrom: 'Valle <hola@valle.mx>', resendDominio: 'otro.mx' })), { puede: false, motivo: 'otro-dominio' });
  assert.deepEqual(remitenteDelNegocio(con({ resendFrom: 'Valle <hola@valle.mx>' })), { puede: false, motivo: 'otro-dominio' }, 'sin dominio reclamado');
  assert.deepEqual(remitenteDelNegocio(con({ resendFrom: 'a@mail.valle.mx', resendDominio: 'valle.mx' })), { puede: false, motivo: 'otro-dominio' }, 'un subdominio no es el dominio');
  assert.deepEqual(remitenteDelNegocio(con({ resendFrom: 'basura', resendDominio: 'valle.mx' })), { puede: false, motivo: 'sin-remitente' });
  assert.deepEqual(remitenteDelNegocio(con({ resendFrom: 'Ana <a@valle.mx>\r\nBcc: x@y.com', resendDominio: 'valle.mx' })), { puede: false, motivo: 'sin-remitente' }, 'inyección de encabezados');
});

test('remitenteDelNegocio: el de MaKo, sólo la plataforma y sólo si lo reclamó; el sandbox, nunca', () => {
  const mako = { resendFrom: 'MaKo <equipo@hola-mako.com>', resendDominio: 'hola-mako.com' };
  assert.deepEqual(remitenteDelNegocio(con({ ...mako, plataforma: true })), { puede: true, from: 'MaKo <equipo@hola-mako.com>', via: 'dominio' });
  assert.deepEqual(remitenteDelNegocio(con({ ...mako, plataforma: false })), { puede: false, motivo: 'de-mako' }, 'un cliente con el dominio de MaKo reclamado');
  assert.deepEqual(remitenteDelNegocio(con({ resendFrom: 'MaKo <equipo@hola-mako.com>', plataforma: true })), { puede: false, motivo: 'otro-dominio' }, 'la plataforma sin reclamarlo (hoy)');
  assert.deepEqual(remitenteDelNegocio(con({ resendFrom: 'x@send.hola-mako.com', resendDominio: 'send.hola-mako.com' })), { puede: false, motivo: 'de-mako' }, 'un subdominio de MaKo');
  assert.deepEqual(remitenteDelNegocio(con({ resendFrom: 'x@makodigital.app', resendDominio: 'makodigital.app' })), { puede: false, motivo: 'de-mako' });
  assert.deepEqual(remitenteDelNegocio(con({ resendFrom: 'onboarding@resend.dev', resendDominio: 'resend.dev' })), { puede: false, motivo: 'sandbox' });
  assert.deepEqual(remitenteDelNegocio(con({ credFrom: 'onboarding@resend.dev', keyPropia: true })), { puede: false, motivo: 'sandbox' });
  // Una credencial con el de MaKo, aun con key propia y aun en la plataforma: nunca.
  assert.deepEqual(remitenteDelNegocio(con({ credFrom: 'MaKo <equipo@hola-mako.com>', keyPropia: true })), { puede: false, motivo: 'de-mako' });
  assert.deepEqual(remitenteDelNegocio(con({ credFrom: 'MaKo <equipo@hola-mako.com>', keyPropia: true, plataforma: true })), { puede: false, motivo: 'de-mako' });
  // Un dominio parecido no es de MaKo.
  assert.equal(remitenteDelNegocio(con({ resendFrom: 'a@hola-makos.com', resendDominio: 'hola-makos.com' })).puede, true);
});

test('remitenteDelNegocio: primero el dominio; si no pasa, la cuenta propia; el motivo es el de la primera', () => {
  // El ws1 con el de MaKo, si un día carga su cuenta: sale por la suya.
  assert.deepEqual(remitenteDelNegocio(con({ resendFrom: 'MaKo <equipo@hola-mako.com>', credFrom: 'hola@valle.mx', keyPropia: true })),
    { puede: true, from: 'hola@valle.mx', via: 'cuenta-propia' });
  assert.equal((remitenteDelNegocio(con({ resendFrom: 'Valle <hola@valle.mx>', resendDominio: 'valle.mx', credFrom: 'otra@otra.mx', keyPropia: true })) as { via?: string }).via, 'dominio');
  assert.deepEqual(remitenteDelNegocio(con({ resendFrom: 'MaKo <equipo@hola-mako.com>', credFrom: 'hola@valle.mx', keyPropia: false })), { puede: false, motivo: 'de-mako' });
});

test('problemaDeRemitenteGuardado: el remitente de MaKo no se guarda como credencial, en ningún workspace', () => {
  assert.equal(problemaDeRemitenteGuardado('MaKo <equipo@hola-mako.com>'), NO_ES_TUYO);
  assert.equal(problemaDeRemitenteGuardado('ventas@send.hola-mako.com'), NO_ES_TUYO);
  assert.equal(problemaDeRemitenteGuardado('x@makodigital.app'), NO_ES_TUYO);
  assert.equal(problemaDeRemitenteGuardado('a@hola-mako.com, b@valle.mx'), NO_ES_TUYO, 'ilegible como remitente, pero con una dirección de MaKo adentro');
  assert.equal(problemaDeRemitenteGuardado('Valle <hola@valle.mx>'), null);
  assert.equal(problemaDeRemitenteGuardado('a@hola-makos.com'), null, 'un dominio parecido no');
  assert.equal(problemaDeRemitenteGuardado(''), null);
  assert.equal(problemaDeRemitenteGuardado(null), null);
});

test('los textos: cortos, en tú, y el del envío es el mismo que el del medio', () => {
  assert.equal(SIN_EMAIL_PROPIO, 'Conecta tu email');
  assert.equal(MOTIVO_MEDIO.email, SIN_EMAIL_PROPIO, '`medioDelError` reconoce el error de `sendEmail` por este texto');
  for (const t of [SIN_EMAIL_PROPIO, POR_QUE_SIN_EMAIL, NO_ES_TUYO]) {
    assert.ok(t.split(/\s+/).length <= 10, `«${t}» es largo`);
    assert.doesNotMatch(t, /\b(conectá|usá|poné|tenés|podés)\b/i, `«${t}» está en voseo`);
  }
});

// ── Roturas ──────────────────────────────────────────────────────────────────────────────────
// 11/10/2026, undécima tanda (arnés `romper.mjs` de wf-undecima/w1-email: una por vez, restaurada de memoria con
// md5 igual; corre este archivo + undecima-email-propio + decima-remitente-mako + resend-remitente, base 49/0):
//   R1. (a) sin exigir que el dominio sea el `resend_domain` del workspace → 47/2 (vía DOMINIO; el de MaKo)
//   R2. (b) sin exigir la key propia                                      → 47/2 (los medidos; primero el dominio)
//   R8. (a) sin exigir la plataforma para el dominio de MaKo              → 45/4 (tres acá y el corte de la décima)
// 09/10/2026, arnés romper-email.mjs del scratchpad: una rotura por vez sobre el archivo real,
// restaurada de MEMORIA, corriendo este archivo + editor-email-gmail + editor-rico-botones-extra
// (base: 26 pass / 0 fail). Las que tocan este archivo:
//   R1. remitenteDelPaso sin comparar el dominio           → 2 fallos (remitenteDelPaso; las opciones)
//   R2. los vinculados sin filtrar por dominio             → 1 (los vinculados)
//   R3. remitenteAGuardar sin conservar el previo          → 1 (la quinta puerta)
//   R4. el sandbox con otra regla que lib/resend.ts        → 2 (la regla; los vinculados)
//   R5. la vista firma con el nombre del remitente         → 3 (el pie del ws1 acá, y dos del editor)
//   R6. el motor sin el From del paso                      → 1 (el motor)
//   R7. setSecuenciaPasos sin el remitente                 → 1 (setSecuenciaPasos)
//   R14. el motor firma con el nombre del remitente        → 2 (el motor acá, y los dos lados del editor)
// 09/10/2026, cierre del punto 16 (arnés romper-email-2.mjs, misma forma; base 29 pass / 0 fail):
//   R15. los broadcasts vuelven a `displayNameDe(getEmailFrom())`   → 1 fallo (el barrido)
//   R16. la firma de los broadcasts es «MaKo» y no el negocio        → 1 (el barrido)
//   R17. la prueba de «Probar» sin `fromName`                        → 1 (el barrido)
//   R21. invitaciones deja de firmar con su remitente (permiso colgado) → 1 (el barrido)
//   R22. el sandbox vuelve a «Mauricio Bustos <onboarding@resend.dev>» → 1 (el sandbox sin nombre)
