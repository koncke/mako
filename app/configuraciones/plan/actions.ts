'use server';

// =============================================================================
// «Tu plan»: el botón «Darme de baja» del plan de MaKo (15/10/2026)
// =============================================================================
// Lo decidió Estrategia el 15/10: un botón PROPIO en MaKo (no el portal de Stripe), que cubre Stripe y Mercado Pago.
// Sólo el ADMIN de ESTE workspace (`adminDeWorkspaceActual`, que también deja pasar al super admin parado en él): el plan
// es lo que la plataforma le cobra al negocio. El cobro se busca por `alta_ws = ws` (`suscripcionDeMakoDe`, lib/cobros.ts):
// un negocio da de baja el suyo y nunca el de otro. Lo que corta plata no se reintenta acá: el segundo clic lo decide la
// persona (y pedirla dos veces devuelve el mismo código).

import { revalidatePath } from 'next/cache';
import { getUsuarioActual } from '@/lib/auth';
import { adminDeWorkspaceActual, estaImpersonando, getCapaActual, getWorkspace, runWithWorkspace } from '@/lib/workspace';
import { capaDef } from '@/lib/capas';
import { pedirPlanSinPasarela } from '@/lib/compra-plan';
import { PLAN_PRO } from '@/lib/subir-plan-reglas';
import { cambiarSettingSi, getSetting, setSetting } from '@/lib/settings';
import { estadoDePrueba } from '@/lib/prueba-uso';
import { EMAIL_MAKO, linkApp } from '@/lib/app-url';
import { darDeBajaMiPlan, type ResultadoBaja } from '@/lib/cobros';
import { avisarDePlataforma, mandarCodigoDeBaja } from '@/lib/invitaciones';
import { aplicarRetencion, type OpcionRetencion } from '@/lib/retencion-plan';
import { subirAPro, type ResultadoSubida } from '@/lib/subir-plan';
import { guardarDeudaAntesDeLaBaja } from '@/lib/plan-deuda';
import { empezarPlanAhora, type ResultadoEmpezar } from '@/lib/empezar-plan';

export async function darmeDeBajaAction(): Promise<ResultadoBaja> {
  const ws = await adminDeWorkspaceActual().catch(() => null);
  if (ws == null) return { ok: false, resumen: 'Sólo quien administra el negocio puede darlo de baja.' };
  const sesion = await getUsuarioActual();
  // En plena mora, la deuda queda guardada antes de la baja (la baja pisa el aviso de la renovación fallida).
  await guardarDeudaAntesDeLaBaja(ws).catch((e) => console.warn('[plan] deuda antes de la baja:', e instanceof Error ? e.message : String(e)));
  const r = await darDeBajaMiPlan(ws, sesion?.nombre || sesion?.email || 'el negocio');
  // El comprobante, al email de quien la pidió. Si no sale, la baja igual quedó hecha (el código está en pantalla).
  if (r.ok && sesion?.email) {
    const plan = capaDef(await getCapaActual()).nombre;
    const m = await mandarCodigoDeBaja({ to: sesion.email, codigo: r.codigo, plan, finAt: r.finAt });
    if (!m.enviado) console.error(`[plan] no salió el código de baja ${r.codigo}: ${m.error ?? 'sin detalle'}`);
  }
  revalidatePath('/configuraciones/plan');
  return r;
}

/** «Quedarme con el descuento» (23/10/2026): la oferta de retención antes de la baja (lib/retencion-plan.ts). Sólo el admin, una vez. */
export async function aceptarRetencionAction(opcion: OpcionRetencion = 'descuento'): Promise<{ ok: boolean; resumen: string }> {
  const ws = await adminDeWorkspaceActual().catch(() => null);
  if (ws == null) return { ok: false, resumen: 'Sólo quien administra el negocio puede cambiar su plan.' };
  const sesion = await getUsuarioActual();
  if (opcion !== 'descuento' && opcion !== 'pausa' && opcion !== 'bajar') return { ok: false, resumen: 'Opción inválida.' };
  const r = await aplicarRetencion(ws, sesion?.nombre || sesion?.email || 'el negocio', opcion);
  revalidatePath('/configuraciones/plan');
  return r;
}

/**
 * «Pasar a Pro» (23/10/2026): adonde llevan los carteles de tope. Sólo el admin. Stripe cobra la diferencia ahora y, si no
 * pasa, no cambia nada; Mercado Pago sube desde el próximo cobro, con Pro en el acto (lib/subir-plan.ts).
 */
/**
 * «Empezar mi plan ya» (25/10/2026): a donde lleva el botón de los topes de la PRUEBA GRATIS. Sólo el dueño (quien mira otro
 * negocio no le abre un cobro a su tarjeta). Devuelve el link del pago; la prueba se cancela cuando ese pago entra.
 */
export async function empezarPlanYaAction(): Promise<ResultadoEmpezar> {
  const ws = await adminDeWorkspaceActual().catch(() => null);
  if (ws == null) return { ok: false, resumen: 'Sólo quien administra el negocio puede empezar su plan.' };
  if (await estaImpersonando().catch(() => true)) return { ok: false, resumen: 'El plan lo empieza el dueño del negocio desde su cuenta.' };
  const sesion = await getUsuarioActual();
  return empezarPlanAhora(ws, sesion?.nombre || sesion?.email || 'el negocio');
}

export async function pasarAProAction(): Promise<ResultadoSubida> {
  const ws = await adminDeWorkspaceActual().catch(() => null);
  if (ws == null) return { ok: false, resumen: 'Sólo quien administra el negocio puede cambiar su plan.' };
  // Quien MIRA otro negocio (la agencia en su cliente, el super admin) no le cobra a la tarjeta del dueño (revisión adversarial).
  if (await estaImpersonando().catch(() => true)) return { ok: false, resumen: 'El plan lo cambia el dueño del negocio desde su cuenta.' };
  const sesion = await getUsuarioActual();
  const r = await subirAPro(ws, sesion?.nombre || sesion?.email || 'el negocio');
  revalidatePath('/configuraciones/plan');
  return r;
}

/** La marca del pedido de Pro, por negocio: el compare-and-set que el camino que COBRA ya tiene (`CLAVE_SUBIDA`, lib/subir-plan.ts). */
const CLAVE_PEDIDO_PRO = 'plan.pedido_pro';
/** Un pedido que quedó «pidiendo» más que esto (un corte a mitad de camino, un deploy) se puede volver a intentar. */
const PEDIDO_A_MEDIAS_MS = 5 * 60_000;
/**
 * Un pedido HECHO frena los de las 24 h siguientes: el F5 y la segunda pestaña, que es lo que mandaba otro evento y otro correo.
 * Pasado eso, nadie contestó y pedir de nuevo es legítimo (la misma forma de `subidaLibre`: un estado terminal no bloquea para
 * siempre). No es una política de producto: es el tope de los duplicados accidentales.
 */
const PEDIDO_VALE_MS = 24 * 60 * 60_000;
const TEXTO_YA_PEDIDO = 'Ya nos llegó tu pedido: te escribimos para pasarte a MaKo Pro.';

/** ¿Ya hay un pedido de Pro vivo para este negocio? (`'error'` no lo es: se puede volver a pedir). */
function pedidoProVivo(guardada: string | null, ahoraMs: number): boolean {
  if (!guardada) return false;
  try {
    const g = JSON.parse(guardada) as { estado?: string; at?: string };
    if (g.estado !== 'pedido' && g.estado !== 'pidiendo') return false;
    const at = Date.parse(String(g.at ?? ''));
    if (!Number.isFinite(at)) return false;
    return ahoraMs - at <= (g.estado === 'pedido' ? PEDIDO_VALE_MS : PEDIDO_A_MEDIAS_MS);
  } catch {
    return false;
  }
}

/**
 * «PASAR A PRO» CUANDO NO SE PUEDE SUBIR EN EL ACTO: el PEDIDO, escrito (ronda 2, 14/11/2026; medido y completado en la 3).
 *
 * Es la otra mitad de `pasarAProAction`: ésa COBRA (le cambia el precio a la suscripción de la pasarela), ésta PIDE. Mientras
 * `subirAPro` no sepa de pruebas —Stripe rechaza una suscripción que no esté `active`, y una en prueba está `trialing`— Pro en
 * prueba es un pedido y nunca un clic, y la fila de «Tu plan» (app/configuraciones/plan/page.tsx) termina acá.
 *
 * ⚠️ POR QUÉ UNA ACCIÓN Y NO UN LINK. La fila tuvo DOS destinos: la agenda de Calendly (hasta el 24/10/2026, Martín: «No voy a
 *    usar Calendly») y `/planes/<pro>`. El segundo está medido y es peor para quien ya tiene cuenta (en prueba la tiene
 *    siempre): dibuja el CHECKOUT en cuanto una pasarela pueda cobrar, y el POST corta con 409 `TEXTO_PRUEBA_USADA_CUENTA`
 *    («entra a «Tu plan» en tu cuenta»), que lo devuelve a la pantalla de la que salió: un círculo; y si ese corte no se puede
 *    hacer (`puedeEmpezarPrueba` deja pasar cuando no lee `listarUsuarios()`), le abre una SEGUNDA suscripción del mismo
 *    negocio (el #494 del 6/11/2026). Un `mailto:` NUNCA fue destino de esta fila: era la otra salida posible y se descartó
 *    —sale de la app, no queda escrito y no existe para quien no tiene cliente de correo—. `pedirPlanSinPasarela` es lo que YA
 *    escribe el formulario «Quiero» de /planes: el evento «Pedido de plan» en el historial de su lead y el aviso al equipo.
 * ⚠️ PIDE, NO COBRA: acá no se crea ningún cobro, no se toca la suscripción y no se toca la tarjeta.
 * ⚠️ QUIEN YA TIENE CUENTA NO ENTRA A «Quieren entrar» (medido, tests/prueba-topes.test.ts): `registrarPedido`
 *    (lib/pedidos-ingreso.ts) contesta `false` para un email que ya tiene usuario. Eso es lo que evita que el pedido de un
 *    negocio que ya existe se lea como un alta y le abran una segunda cuenta. Y es, además, por qué acá hace falta un rastro
 *    PROPIO: para quien pide desde «Tu plan» —que siempre tiene cuenta— esa bandeja inserta 0 filas a propósito, y los dos
 *    rastros que quedan adentro de `pedirPlanSinPasarela` son best-effort (el evento con `catch(() => {})`, y el correo cuyo
 *    `{ enviado: false }` nadie lee). Con los dos en silencio, la acción devolvía `ok: true` y la persona leía «Listo» sin que
 *    hubiera llegado nada a ninguna parte (medido en la ronda 3, 15/11/2026).
 */
export async function pedirProAction(): Promise<{ ok: boolean; resumen: string }> {
  const ws = await adminDeWorkspaceActual().catch(() => null);
  if (ws == null) return { ok: false, resumen: 'Sólo quien administra el negocio puede pedir el cambio de plan.' };
  // Quien MIRA otro negocio (el super admin, la agencia en su cliente) no pide por él: el pedido se escribiría con SU nombre y
  // SU email —los de la sesión, los únicos que no se pueden falsificar desde el navegador— y el equipo le cambiaría el plan al
  // que no lo pidió.
  if (await estaImpersonando().catch(() => true)) return { ok: false, resumen: 'El plan lo pide el dueño del negocio desde su cuenta.' };
  // Sólo desde Essential, la misma condición con la que la pantalla ofrece la fila (y la primera que corta `decidirSubida` en el
  // camino que cobra): una acción es una puerta POST abierta a cualquiera con sesión, y sin esto un acuerdo a mano de 297 o un
  // Pro pueden dejar un «quiere MaKo Pro» en su propia ficha.
  if ((await getCapaActual().catch(() => null)) !== 'completo') return { ok: false, resumen: 'Tu plan no se cambia desde aquí. Escríbenos.' };
  // ⚠️ Y ACÁ **NO** SE PREGUNTA `esClienteDeAgencia` (ronda 2, 14/11/2026), aunque la pantalla sí: la lista de quienes la llaman
  //    está CERRADA en tests/agency-dos-duenos.test.ts y un uso nuevo es una decisión de producto (de qué lado cae su «no sé»:
  //    bloquea o no ofrece). Lo que queda abierto es chico y no mueve plata: el cliente de una agencia NO ve esta fila, y si
  //    POSTea la acción a mano deja un pedido en su ficha que el equipo lee antes de tocar nada. Si se quiere cerrar, se suma
  //    este archivo a esa lista con su porqué.
  const sesion = await getUsuarioActual().catch(() => null);
  const email = (sesion?.email ?? '').trim();
  // Una sesión sin email (la de `dev`, lib/auth.ts): no hay lead al que atar el pedido ni a quién contestarle.
  if (!email) return { ok: false, resumen: `Tu cuenta no tiene un email. Escríbenos a ${EMAIL_MAKO} y te lo cambiamos.` };
  const quien = (sesion?.nombre ?? '').trim() || email;

  // ── UN PEDIDO POR NEGOCIO, DEL LADO DEL SERVIDOR (ronda 3, 15/11/2026) ───────────────────────────────────────────────────────────────
  // La pantalla apaga la fila con `proPedido`, que es estado del CLIENTE: un F5 o una segunda pestaña volvían a escribir otro
  // evento en su ficha y a mandar otro correo al equipo. El reclamo es el mismo que el del camino que cobra (`CLAVE_SUBIDA`).
  // ⚠️ TRES RESPUESTAS, NO DOS: `cambiarSettingSi` devuelve false sólo cuando OTRO tiene la marca (ahí «ya está pedido» es
  //    verdad), y TIRA cuando no pudo escribir. Con un `.catch(() => false)` ese error se leería como «ya lo pediste» y
  //    volveríamos a decirle que llegó algo que no llegó, que es justo el defecto que esta ronda vino a cerrar: sin poder
  //    marcar, se sigue sin marca (un duplicado es más barato que un pedido perdido).
  const ahora = Date.now();
  const marcaPrevia = await runWithWorkspace(ws, () => getSetting(CLAVE_PEDIDO_PRO)).catch(() => null);
  if (pedidoProVivo(marcaPrevia, ahora)) return { ok: true, resumen: TEXTO_YA_PEDIDO };
  const marca = (estado: 'pidiendo' | 'pedido' | 'error') => JSON.stringify({ estado, at: new Date(ahora).toISOString(), por: email });
  const gano = await runWithWorkspace(ws, () => cambiarSettingSi(CLAVE_PEDIDO_PRO, marcaPrevia, marca('pidiendo')))
    .catch((e) => { console.warn('[plan] no pude marcar el pedido de Pro:', e instanceof Error ? e.message : String(e)); return null; });
  if (gano === false) return { ok: true, resumen: TEXTO_YA_PEDIDO };

  // EL NEGOCIO, QUE ESTA ACCIÓN TIENE EN LA MANO: sin esto el equipo recibe «Sol Díaz quiere MaKo Pro» y no sabe a QUÉ cuenta
  // cambiarle el plan ni que es alguien en prueba (medido en la ronda 3). `estadoDePrueba` no tira; `getWorkspace` sí.
  const [negocio, prueba] = await Promise.all([
    getWorkspace(ws).catch(() => null),
    estadoDePrueba(ws).catch(() => null),
  ]);
  const nombreNegocio = (negocio?.nombre ?? '').trim() || `negocio ${ws}`;
  const enPrueba = prueba?.enPrueba === true;
  const comoEsta = enPrueba
    ? `en la prueba gratis${prueba?.plan ? ` de ${prueba.plan}` : ''}${prueba?.dias != null ? `, quedan ${prueba.dias} día(s)` : ''}`
    : 'MaKo Essential, ya cobrado';
  const r = await pedirPlanSinPasarela({
    plan: PLAN_PRO, nombre: quien, email,
    // `quiero`: el pedido, no el checkout. El resto es del carrito público y acá no existe: ni pasarela, ni código de referido
    // (este negocio ya entró), ni el diagnóstico de la puerta del Accelerator, ni el anual (`periodo: 'mensual'`).
    // ⚠️ `origen.landing` ES EL ÚNICO CAMPO DEL PEDIDO QUE LLEGA AL TEXTO que el equipo lee (`pedirPlanSinPasarela` lo escribe
    //    como « desde la landing «…»» en el evento del lead y en el correo). No es una landing y el renglón lo dice mal: lo que
    //    se gana es que el rastro del CRM nombre la cuenta, que es lo que falta para poder actuar. El arreglo de verdad es un
    //    campo propio en `pedirPlanSinPasarela` —otra área, docs/hallazgos-planes-y-cobro.md—.
    quiero: true, pasarela: null, origen: { landing: `tu-plan-negocio-${ws}` }, ref: null, whatsapp: null, diagnostico: null,
    periodo: 'mensual', sinPrueba: false, codigoEscrito: null, codigoEscritoMal: false,
  }).catch((e) => {
    console.error('[plan] no pude dejar el pedido de Pro:', e instanceof Error ? e.message : String(e));
    return { ok: false as const, status: 503, error: '' };
  });
  // EL AVISO QUE EL EQUIPO PUEDE USAR, Y EL ÚNICO RASTRO QUE ESTA ACCIÓN PUEDE CONFIRMAR: nombra el negocio, dice si está en
  // prueba y lleva a la pantalla donde se le cambia el plan. `avisarDePlataforma` nunca tira y devuelve si salió: eso es lo que
  // decide si se le dice «Listo» (ronda 3, 15/11/2026). El correo de `pedirPlanSinPasarela` sigue saliendo y es el genérico de /planes: dos
  // correos por un pedido es el costo de no poder tocar esa función desde acá, y está cosechado.
  const avisado = r.ok
    ? await avisarDePlataforma({
      to: EMAIL_MAKO, tag: 'plan-pedido-pro',
      asunto: `${nombreNegocio} pide MaKo Pro${enPrueba ? ' (en prueba)' : ''}`,
      preheader: `Pedido desde «Tu plan» de ${nombreNegocio}.`,
      cuerpo: [`${quien} (${email}) pide pasar a MaKo Pro.`, '',
        `Negocio: ${nombreNegocio} (negocio ${ws}).`,
        `Cómo está hoy: ${comoEsta}.`,
        '', 'Donde se le cambia el plan:', linkApp(`/admin/customers/${ws}`, null)].join('\n'),
    })
    : { enviado: false as const };
  // La marca queda en su estado final SÓLO si la ganamos: `'pedido'` frena el F5, `'error'` deja volver a intentar.
  if (gano === true) {
    await runWithWorkspace(ws, () => setSetting(CLAVE_PEDIDO_PRO, marca(r.ok && avisado.enviado ? 'pedido' : 'error')))
      .catch((e) => console.warn('[plan] no pude cerrar la marca del pedido de Pro:', e instanceof Error ? e.message : String(e)));
  }
  // Como las otras tres acciones del archivo: lo que la pantalla dibuja se vuelve a leer sin que la persona recargue.
  revalidatePath('/configuraciones/plan');
  // ⚠️ FALLA PARA ADENTRO, NUNCA PARA EL CHECKOUT: si el pedido no se pudo escribir se lo decimos acá, con el email del equipo,
  //    y NO se lo manda a /planes a «probar por la otra puerta» —esa puerta es el círculo y, con la base caída, la segunda
  //    suscripción—. Y «Listo» SÓLO con un rastro confirmado: si el pedido entró pero el aviso no salió, lo dice en vez de
  //    prometer que alguien lo vio (lo que quedó en silencio no lo ve nadie).
  if (!r.ok) return { ok: false, resumen: r.error || `No pudimos registrar tu pedido. Prueba otra vez, o escríbenos a ${EMAIL_MAKO}.` };
  if (!avisado.enviado) return { ok: false, resumen: `Tu pedido quedó anotado, pero no pudimos avisarle al equipo. Escríbenos a ${EMAIL_MAKO} y te lo pasamos a MaKo Pro.` };
  return { ok: true, resumen: 'Listo: nos llegó tu pedido y te escribimos para pasarte a MaKo Pro.' };
}
