// El alta manda el mail de acceso. Lo que estos tests cuidan NO es que el mail salga
// —eso lo decide Resend— sino las dos cosas que ya fallaron sin que nada avisara: que
// los TRES puntos de alta llamen al mismo lugar, y que la pantalla no afirme que se
// avisó cuando no se avisó.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { avisoInvitacion } from '../lib/invitacion-aviso';

const leer = (p: string) => readFileSync(resolve(import.meta.dirname, p), 'utf8');

test('los TRES puntos de alta mandan el mail', () => {
  // Es la regla de la casa —una cosa, un lugar— y acá tiene una consecuencia concreta:
  // con el mail escrito adentro de uno solo, los otros dos nacen mudos y nadie se entera
  // hasta que un cliente pregunta por qué su vendedor no puede entrar. Ya pasó: la acción
  // de /api/equipo se llamaba literalmente 'invitar' y no invitaba a nadie.
  for (const ruta of [
    // Cliente nuevo: el alta vive en lib/alta-cliente.ts desde el 11/10/2026 (la llaman el panel y
    // el pago de un plan de MaKo), así que el mail se busca ahí y la ruta tiene que llamarla.
    '../lib/alta-cliente.ts',
    '../app/api/admin/usuarios/route.ts',    // usuario suelto de /admin
    '../app/api/equipo/route.ts',            // el equipo que suma el propio cliente
  ]) {
    assert.ok(/invitarPorEmail\(/.test(leer(ruta)), `${ruta} da de alta a alguien sin avisarle`);
  }
  // Y el panel no puede volver a tener un alta propia que se salte la compartida (sin mail, o sin
  // el rollback). Roto a propósito el 11/10/2026 (la ruta sin darDeAltaCliente): 11 pass / 1 fail;
  // restaurado: 12 pass / 0 fail.
  assert.ok(/darDeAltaCliente\(/.test(leer('../app/api/admin/workspaces/route.ts')), 'el panel da de alta clientes por fuera de lib/alta-cliente.ts');
});

test('el mail NO promete una contraseña: en MaKo se entra solo con Google', () => {
  // La tabla `usuarios` no tiene columna de password, y el login por contraseña se
  // eliminó a propósito: abría una sesión de admin salteando la tabla, y la cookie que
  // dejaba era el mismo secreto que firma las sesiones. Un mail que diga «elegí tu
  // contraseña» manda a la persona a una pantalla que no existe.
  const inv = leer('../lib/invitaciones.ts');
  assert.ok(!/contrase.a\s*[:.]|elige tu|eleg. tu/i.test(inv.split('export async function')[1] ?? ''),
    'el cuerpo del mail habla de una contraseña que no existe');
  // Y sí dice con qué dirección entrar: es el modo de falla más probable, porque quien
  // da el alta tipea el email a mano y entrar con otra cuenta de Google da un
  // «no autorizada» que no se puede accionar si no sabés cuál era la buena.
  assert.ok(/exactamente esta direcci.n/i.test(inv), 'el mail dejó de decir con qué email entrar');
});

test('el preflight del sandbox corta ANTES de mandar', () => {
  // Con el remitente sin configurar, Resend acepta el envío contra @resend.dev y
  // responde OK: el sistema informa «mail enviado» y no llega nada. Un éxito falso es
  // peor que un error porque nadie lo audita.
  const inv = leer('../lib/invitaciones.ts');
  const iSandbox = inv.indexOf('resend\\.dev');
  const iEnvio = inv.indexOf('await sendEmail(');
  assert.ok(iSandbox > 0 && iEnvio > 0, 'faltan el preflight o el envío');
  assert.ok(iSandbox < iEnvio, 'el chequeo del remitente quedó DESPUÉS del envío');
});

test('el remitente es de la PLATAFORMA, no de un workspace', () => {
  // `OWNER_WS` vale 1 y el 1 es Mauricio, un CLIENTE. Mandar desde ahí hace que el mail
  // de acceso de MaKo lo firme la configuración de un inquilino: el día que cambie su
  // `resend_from`, todos los clientes nuevos reciben su acceso firmado por otro negocio.
  // No rompe nada visible —sale un mail válido— y por eso nadie lo miraría.
  //
  // Se busca el IMPORT y la LLAMADA, no la cadena suelta: el comentario del archivo
  // nombra a OWNER_WS justamente para explicar por qué no se usa, y un test que falla
  // por su propia búsqueda enseña a ignorar los tests.
  const inv = leer('../lib/invitaciones.ts');
  assert.ok(!/^import[^\n]*\bOWNER_WS\b/m.test(inv), 'el envío volvió al workspace de un cliente');
  assert.ok(/runWithWorkspace\(await wsSuperAdmin\(\)/.test(inv), 'el envío dejó de correr en el workspace de la plataforma');
  // Y el `from` va explícito: sin él, sendEmail resuelve el del workspace en curso.
  assert.ok(/from: REMITENTE_MAKO/.test(inv), 'el remitente volvió a salir del workspace');
});

test('la dirección de MaKo es UNA: firma, responde y recibe la ayuda', () => {
  // Las tres tienen que ser la misma o el mail no sirve: uno que viene de una dirección,
  // se responde a otra y en el cuerpo manda a una tercera es un mail al que nadie
  // contesta. La única forma de que no diverjan es que salgan de la misma constante —
  // dos constantes «que hoy coinciden» es exactamente cómo empieza una divergencia.
  const inv = leer('../lib/invitaciones.ts');
  // La dirección vive en lib/app-url.ts —al lado de la URL base, que contesta la misma
  // pregunta: por dónde nos encuentra alguien de afuera— y no se redeclara acá.
  assert.ok(/import \{ APP_BASE_URL, EMAIL_MAKO, REMITENTE_MAKO \} from '\.\/app-url'/.test(inv), 'la dirección dejó de salir de la fuente única');
  assert.ok(!/^const (EMAIL_MAKO|REMITENTE_MAKO) =/m.test(inv), 'volvió a haber una segunda declaración de la dirección o del remitente');
  // El remitente se mudó a lib/app-url.ts el 11/09/2026: la alarma de la voz caída
  // (lib/canal-vigilante.ts) firma igual, y dos constantes «que hoy coinciden» es cómo
  // empieza una divergencia.
  assert.ok(/export const REMITENTE_MAKO = `MaKo <\$\{EMAIL_MAKO\}>`/.test(leer('../lib/app-url.ts')), 'el remitente dejó de derivar de la dirección');
  assert.ok(/replyTo: EMAIL_MAKO/.test(inv), 'responder ya no vuelve a MaKo');
  assert.ok(/escríbenos a \$\{EMAIL_MAKO\}/.test(inv), 'el contacto de ayuda dejó de ser el de MaKo');
  // Y NO vuelve a ser el de quien dio de alta: lo que falla acá es entrar, y eso lo
  // arregla MaKo. Mandarlo al admin del cliente le pone a él la mesa de ayuda del
  // producto, y encima no lo puede resolver.
  assert.ok(!/invitadoPor/.test(inv), 'el contacto de ayuda volvió a ser quien dio el alta');
});

test('una MAKO_EMAIL mal escrita revienta al arrancar, no en el primer alta', async () => {
  // El contrato «la dirección va PELADA» vivía SOLO en un comentario, y eso ya se pagó:
  // con `MAKO_EMAIL='MaKo <equipo@…>'` el remitente quedaba `MaKo <MaKo <equipo@…>>` y el
  // cuerpo le pedía a la persona que le escribiera a `MaKo <equipo@…>`. Y el preflight de
  // sandbox ancla con `$` contra la dirección pelada, así que un
  // `MAKO_EMAIL='MaKo <onboarding@resend.dev>'` PASABA el control: el que terminaba
  // protegiendo era Resend rechazando el `from` — el proveedor en vez del control.
  //
  // Se prueba el COMPORTAMIENTO (importando el módulo con el env puesto), no la presencia
  // de la regex en el fuente: un test que mira el código no sabe si la regex anda.
  const original = process.env.MAKO_EMAIL;
  let n = 0;
  const cargar = async (v: string | undefined) => {
    if (v === undefined) delete process.env.MAKO_EMAIL; else process.env.MAKO_EMAIL = v;
    // La query string fuerza una instancia nueva: los módulos ESM se cachean.
    return import(`../lib/app-url.ts?caso=${n++}`);
  };
  try {
    for (const malo of ['MaKo <equipo@hola-mako.com>', '<equipo@hola-mako.com>', 'equipo@hola-mako.com, otro@x.com', 'equipo arroba hola-mako.com', 'MaKo <onboarding@resend.dev>']) {
      await assert.rejects(() => cargar(malo), /pelada/, `no rechazó ${JSON.stringify(malo)}`);
    }
    const buena = await cargar('soporte@otro-dominio.com');
    assert.equal(buena.EMAIL_MAKO, 'soporte@otro-dominio.com', 'no respetó un override válido');
    const porDefecto = await cargar(undefined);
    assert.equal(porDefecto.EMAIL_MAKO, 'equipo@hola-mako.com', 'cambió el default');
  } finally {
    if (original === undefined) delete process.env.MAKO_EMAIL; else process.env.MAKO_EMAIL = original;
  }
});

test('un admin de AGENCIA no recibe la línea del dueño de un negocio', () => {
  // `rol_ws: null` significa «no tiene rol DENTRO de un negocio» — o sea, admin de la
  // agencia. Escrito como `[rolWs ?? 'admin']` le mandaba «vas a poder cargar tu negocio»
  // a alguien que no tiene negocio propio: es la regla de «cada pregunta, su campo», con
  // dos hechos distintos colapsados en un `??`.
  const inv = leer('../lib/invitaciones.ts');
  assert.ok(!/QUE_VAS_A_HACER\[u\.rolWs \?\? 'admin'\]/.test(inv), 'null volvió a ser sinónimo de admin de cliente');
  assert.ok(/QUE_VAS_A_HACER\[u\.rolWs \?\? AGENCIA\]/.test(inv), 'el caso del admin de agencia dejó de tener nombre propio');
  assert.ok(/\[AGENCIA\]: '[^']+'/.test(inv), 'el admin de agencia no tiene su propia línea');
});

test('a nadie se le manda un mail sin decirle de qué negocio le hablan', () => {
  // Un closer recibe un mail de una marca que no conoció nunca (MaKo) sobre una cuenta
  // que no pidió. Sin el nombre del negocio, lo más razonable que puede hacer es tratarlo
  // como spam — y el alta queda «hecha» con la persona afuera igual que antes.
  for (const ruta of [
    '../lib/alta-cliente.ts', // el alta de un cliente vive ahí desde el 11/10/2026 (la ruta ya no invita)
    '../app/api/admin/usuarios/route.ts',
    '../app/api/equipo/route.ts',
  ]) {
    const src = leer(ruta);
    // Cada llamada a invitarPorEmail tiene que traer `workspace:` adentro.
    for (const [, args] of src.matchAll(/invitarPorEmail\(\{([\s\S]*?)\}\)/g)) {
      assert.ok(/workspace:/.test(args), `${ruta}: una invitación sale sin el nombre del negocio`);
    }
  }
});

test('la fecha se estampa solo si el mail SALIÓ', () => {
  // La columna contesta «¿ya se le avisó?». Marcarla en el intento la convierte en
  // «¿lo intentamos?», y el botón de reenviar quedaría diciendo que ya se mandó algo
  // que nunca llegó.
  const inv = leer('../lib/invitaciones.ts');
  const iFalla = inv.indexOf('if (!r.ok) return');
  const iEstampa = inv.indexOf('invitacion_enviada_at');
  assert.ok(iFalla > 0 && iEstampa > iFalla, 'la fecha se estampa antes de saber si el mail salió');
});

test('cuando el mail no sale, la pantalla lo DICE y da el link', () => {
  // El alta está hecha: lo único que falta es un mensaje, y quien mira la pantalla lo
  // puede mandar en 10 segundos si le damos el link. Es la mitad que faltaba: el aviso
  // que solo va a los logs no frena nada.
  const a = avisoInvitacion({ enviado: false, error: 'remitente de prueba', enlace: 'https://x/inicio' }, 'ana@cliente.com');
  assert.equal(a.tono, 'warn');
  assert.ok(a.texto.includes('NO salió'), 'no dice que el mail no salió');
  assert.ok(a.texto.includes('ana@cliente.com'), 'no dice a quién hay que avisarle');
  assert.ok(a.texto.includes('https://x/inicio'), 'no da el link para pasarlo a mano');
});

test('cuando sale, no queda nada por hacer y se dice a qué dirección', () => {
  const a = avisoInvitacion({ enviado: true, enlace: 'https://x/inicio' }, 'Ana@Cliente.com ');
  assert.equal(a.tono, 'ok');
  assert.ok(a.texto.includes('Ana@Cliente.com'), 'no dice a qué email se mandó');
});

test('sin email no es una falla: es un alta sin dueño todavía', () => {
  // Un cliente se puede crear sin admin y eso es legítimo. Pintarlo en ámbar entrenaría
  // a ignorar el ámbar, que es lo que hace inútil al ámbar de verdad.
  assert.equal(avisoInvitacion(null, '').tono, 'ok');
  assert.equal(avisoInvitacion(null, '   ').tono, 'ok');
});
