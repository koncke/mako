// =============================================================================
// /configuraciones/plan — «Configuración del negocio» › Tu plan (15/10/2026)
// =============================================================================
// El plan de MaKo del negocio y el botón «Darme de baja», como todo SaaS (lo decidió Estrategia el 15/10, y
// /reembolsos y /terminos remiten acá). Sólo el admin: es lo que la plataforma le cobra al negocio. La suscripción se
// lee por `alta_ws` (lib/cobros.ts, `suscripcionDeMakoDe`); sin una, el plan se acordó a mano y se dice a quién escribir.

import { redirect } from 'next/navigation';
import { requireRolWs } from '@/lib/tab-access';
import { TITULO_NEGOCIO } from '@/lib/ajustes-secciones';
import { gruposDeAjustes } from '@/lib/ajustes-negocio';
import { getCapaActual, getWorkspaceActual, wsSuperAdmin } from '@/lib/workspace';
import { capaDef } from '@/lib/capas';
import { inicioDeLaPrueba, suscripcionDeMakoDe } from '@/lib/cobros';
import { diaDelCobro, esPruebaDePlan } from '@/lib/prueba-plan-reglas';
import { gratisHastaDe } from '@/lib/plan-a-mano';
import { lineaDelPrimerMes } from '@/lib/primer-mes-reglas';
import { esBajaPedida } from '@/lib/cobros-reglas';
import { formatoMonto } from '@/lib/pasarela-moneda';
import { EMAIL_MAKO } from '@/lib/app-url';
import { AjustesPagina, TituloAjustes } from '../../_ui/Ajustes';
import { PlanPanel, type SuscripcionVisible } from './PlanPanel';
import { planesMako } from '@/lib/compra-plan';
import { precioEn } from '@/lib/planes-mako';
import { PLAN_PRO, proPorLlamada } from '@/lib/subir-plan-reglas';
import { estadoDeRetencion, ofertaDeRetencion } from '@/lib/retencion-plan';
import { esClienteDeAgencia } from '@/lib/agencia';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PlanPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRolWs([], { nav: 'configuraciones' });
  const ws = await getWorkspaceActual();
  // La plataforma no tiene un plan de MaKo (el índice ya no ofrece la sección ahí): un link viejo vuelve al índice.
  if (ws == null || ws === (await wsSuperAdmin())) redirect('/configuraciones');
  const [capa, sus, oferta, retencion, gratisHasta] = await Promise.all([
    getCapaActual(),
    ws != null ? suscripcionDeMakoDe(ws).catch(() => null) : Promise.resolve(null),
    ofertaDeRetencion(ws).catch(() => null),
    // Lo que «Tu plan» dice de una oferta aceptada (segunda revisión, R10): «En pausa…», «Con 50%…».
    estadoDeRetencion(ws).catch(() => null),
    // Los 6 meses gratis (30/10/2026): la persona ve hasta cuándo los tiene, no «Acordado con MaKo».
    gratisHastaDe(ws).catch(() => null),
  ]);
  // LA PRUEBA GRATIS (25/10/2026): su suscripción todavía no se cobró. Se ve hasta cuándo va, se ofrece «Empezar mi plan
  // ya», y no la oferta de retención (no hay un mes pagado sobre el que hacerla). «Pasar a Pro» SÍ se ofrece desde el
  // 14/11/2026, como pedido y no como cobro inmediato: el porqué está 20 líneas abajo, en el `const pro`.
  const enPrueba = !!sus && esPruebaDePlan(sus) && sus.estado === 'pendiente';
  const hasta = enPrueba ? await inicioDeLaPrueba(sus!).catch(() => null) : null;
  // La pantalla no ve el cobro entero (ni el token, ni los ids del proveedor): sólo lo que dibuja.
  const suscripcion: SuscripcionVisible = sus
    ? {
      proveedor: sus.proveedor, monto: formatoMonto(sus.monto, sus.moneda), cancelada: sus.suscripcion_estado === 'cancelada', baja: esBajaPedida(sus.motivo) ? sus.motivo : null,
      prueba: enPrueba ? { hasta: hasta ? diaDelCobro(hasta) : 'el fin de la prueba' } : null,
      primerMes: lineaDelPrimerMes(sus, formatoMonto),
    }
    : null;
  const destacarEmpezar = enPrueba && (await searchParams)?.empezar === '1';
  // ⚠️ `!== false`, no por verdad (P15, 30/10/2026): `esClienteDeAgencia` contesta sí/no/**no sé** (`null` = no se pudo leer
  //    la cartera), y acá el «no sé» NO OFRECE. Si no sabemos si tiene dueño, no le pisamos el cliente a una agencia:
  //    ofrecer de menos por una falla de la base cuesta una venta, ofrecer de más le rompe el trato a la agencia.
  // ⚠️ Y SE PREGUNTA **ANTES** DE ARMAR LA FILA DE PRO (ronda 2, 14/11/2026): el cliente de una agencia no la ve, así que
  //    nada de lo que cuesta armarla se paga para quien nunca la va a ver. El orden de antes la armaba entera —leyendo los
  //    planes de la plataforma, y antes de esta ronda también las pasarelas, con su pedido saliente a Mercado Pago— y la
  //    anulaba 20 líneas después, en el `return`.
  const deAgencia = (await esClienteDeAgencia(ws)) !== false;
  // «Pasar a Pro»: a quien paga MaKo Essential por la pasarela (capa `completo`), con el precio de Pro en SU moneda.
  // Y TAMBIÉN EN LA PRUEBA, DESDE EL 14/11/2026: con AI Avatar, replicar el guion y el chat con los referentes cerrados en
  // Essential (`FUNCIONES_SOLO_PRO`, lib/topes-plan.ts), el «Pasa a Pro para usarlo» de esos candados trae acá a un negocio que
  // está en sus 7 días gratis del de 47 (los dos planes arrancan con prueba: `PLANES_CON_PRUEBA`, lib/planes-mako.ts), y acá NO
  // había NINGUNA fila para pasar a Pro: la única era «Empezar mi plan ya», que cobra los US$47 del Essential. Martín: «La idea es
  // que compren el de 97, no el de 47» — el camino tiene que terminar donde dice que termina.
  const pro = capa === 'completo' && !deAgencia ? (await planesMako().catch(() => [])).find((p) => p.id === PLAN_PRO && p.activo) ?? null : null;
  const precioPro = pro && sus ? precioEn(pro, sus.moneda) : null;
  // ⚠️ LA SUBIDA EN EL ACTO, NO EN PRUEBA: `subirAPro` (lib/subir-plan.ts) le cambia el precio a la suscripción de la pasarela, y
  //    con la prueba abierta eso no está resuelto — Stripe rechaza toda suscripción que no esté `active`, y una en prueba está
  //    `trialing` (`subirPlanStripe`, lib/pasarela-plan-api.ts: contestaría «no está al día o está en pausa», que no es verdad), y
  //    Stripe y Creem cobran la diferencia AHORA, en días que son gratis. Hasta que lib/subir-plan.ts sepa de pruebas, se PIDE.
  const subir = pro && sus && precioPro != null && !enPrueba ? { nombre: pro.nombre, monto: formatoMonto(precioPro, sus.moneda) } : null;
  // ── A DÓNDE SE PIDE: NI A /planes NI A UN mailto — EL PEDIDO SE ESCRIBE DESDE ACÁ (ronda 2, 14/11/2026) ──────────────
  // Sin la subida en línea (hoy, todos: la pasarela de MaKo no está conectada), Pro se PIDE (desde el 24/10, sin agenda:
  // Martín no usa Calendly). Es a donde llevan los carteles de tope (lib/subir-plan-reglas.ts). Esta fila tuvo DOS destinos
  // —la agenda de Calendly, que se fue el 24/10, y `/planes/<pro>`—, y el segundo está MEDIDO y es peor para quien ya tiene
  // cuenta (y en prueba la tiene SIEMPRE):
  //   · `/planes/<pro>` dibuja el formulario «Quiero» sólo mientras NINGUNA pasarela pueda cobrar; en cuanto una pueda, la
  //     misma página dibuja el CHECKOUT (`ofertaDelPlan(...).pasarelas`, app/planes/[plan]/page.tsx) y el POST corta con 409
  //     «Ese email ya tiene una cuenta de MaKo… Para tu plan, entra a «Tu plan» en tu cuenta» (`TEXTO_PRUEBA_USADA_CUENTA`,
  //     `puedeEmpezarPrueba`), que lo manda DE VUELTA ACÁ: un círculo. Y ese corte es lo único que lo frena: si escribe OTRO
  //     email, o si `listarUsuarios()` no se puede leer (deja pasar a propósito), `crearCobro` con `altaCapa` le abre una
  //     SEGUNDA suscripción y una SEGUNDA cuenta del mismo negocio — el #494 del 6/11/2026.
  //   · El `mailto:equipo@` NUNCA fue destino de esta fila: era la otra salida posible y se descartó sin escribirla —sale de
  //     la app, no queda escrito en ninguna parte y no existe para quien no tiene cliente de correo—.
  //   ⚠️ Y NUNCA con `?sinPrueba=1` para saltear ese 409: ese parámetro apaga el corte (`conPrueba` queda en false) y va
  //      DERECHO al cobro doble. El atajo que parece arreglar el círculo es el que abre la segunda suscripción.
  // POR ESO LA FILA YA NO ES UN LINK: la toca y `pedirProAction` (./actions.ts) deja el pedido escrito con el nombre y el email
  // de la sesión —`pedirPlanSinPasarela`, lo MISMO que escribe el formulario «Quiero» de /planes: el evento «Pedido de plan» en
  // el historial de su lead y el aviso al equipo en el momento—, sin salir de esta pantalla. Ni círculo, ni mailto, ni cobro.
  // ⚠️ Y ESTA PÁGINA NO LE PREGUNTA A LAS PASARELAS A DÓNDE MANDAR. No es algo que se haya ido: contra el historial del repo
  //    esta página NUNCA llamó a `ofertaDelPlan` —lo propuso una ronda anterior y nunca se commiteó, así que no hay nada que
  //    buscar en el log—. Queda escrito porque es el camino que no hay que volver a tomar: `ofertaDelPlan` se traga el error de
  //    lectura y devuelve `pasarelas: []`, idéntico a «no hay ninguna», así que esa medición caería SIEMPRE del lado de /planes
  //    (el círculo) y cualquier `.catch()` puesto para «fallar hacia el email» sería código muerto. Sin destino que adivinar no
  //    hace falta, y de paso no se paga el `leerCuentaMp` saliente en cada carga de esta pantalla.
  const porLlamada = pro && enPrueba
    ? { titulo: `Pasar a ${pro.nombre}`, detalle: `US$ ${pro.precioUsd} por mes. Pídelo y te lo cambiamos antes de que termine tu prueba.` }
    : pro && proPorLlamada({ capa, subidaEnLinea: subir != null })
      ? { titulo: `Pasar a ${pro.nombre}`, detalle: `US$ ${pro.precioUsd} por mes. Pídelo y te lo activamos.` }
      : null;
  return (
    <AjustesPagina lugar={TITULO_NEGOCIO} grupos={await gruposDeAjustes(undefined, 'plan')} activa="plan">
      {/* Sin bajada (25/10/2026, el molde nuevo de Settings: Martín, «textos previo a la configuración que están muy de sobra»). */}
      <TituloAjustes titulo="Tu plan" />
      <PlanPanel plan={capaDef(capa).nombre} suscripcion={suscripcion} gratisHasta={gratisHasta} emailMako={EMAIL_MAKO} oferta={enPrueba ? null : oferta} retencion={retencion}
        // El cliente de una AGENCIA (29/10/2026, Thiago: «yo no me meto con ese cliente»): su plan lo maneja su agencia. No ve
        // «Pasar a Pro» ni «Recomienda MaKo». Las dos filas ya son null para él (cuelgan de `pro`, que arriba lo mira): este
        // `deAgencia ? null :` es la red de seguridad, y es lo que lee tests/cliente-de-agencia-y-partners-2910.test.ts.
        subir={deAgencia ? null : subir} porLlamada={deAgencia ? null : porLlamada} clienteDeAgencia={deAgencia}
        destacarEmpezar={destacarEmpezar} />
    </AjustesPagina>
  );
}
