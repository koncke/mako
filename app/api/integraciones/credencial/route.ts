// =============================================================================
// /api/integraciones/credencial — BYOK desde los modales de /integraciones
// =============================================================================
// Trae el "pegar + guardar + probar conexión" de /metodo a los modales del board
// de integraciones, para que el admin de un workspace configure SUS credenciales
// sin salir de la app. Opera SIEMPRE sobre el workspace del request
// (getWorkspaceActual) — nunca sobre un ws provisto por el cliente.
//
// GUARD (seguridad multi-tenant): permitido solo para el super-admin de agencia
// (getSesionAdmin) o el admin del propio workspace (getRolWsEfectivo === 'admin').
// closer/setter/sin sesión → 403. El ws objetivo es el actual; si es null solo el
// super-admin cae al dueño (OWNER_WS), el resto es 403 (fail-closed).
//
// GET  ?servicio=<key> → catálogo + estado por campo (configurado/origen/máscara).
// POST { action:'guardar', servicio, valores } → whitelist estricta por campos (sin los derivados).
// POST { action:'descubrir-pago', servicio, valores? } → Stripe / Mercado Pago (lib/cobros-conexion).
// POST { action:'borrar', env }                → elimina la fila cifrada.
// POST { action:'verificar', servicio, valores } → "Probar conexión".
// POST { action:'revelar', env }               → texto plano de UNA credencial.

import { NextResponse, type NextRequest } from 'next/server';
import { getSesionAdmin, getUsuarioActual } from '@/lib/auth';
import { auditarCredencial, credDelCliente, credWs, eliminarCredencial, esClaveDePasarela, estadoCampo, guardarCredencial, IdentificadorOcupadoError, KeyDePlataformaError, RemitenteNoPropioError } from '@/lib/credenciales';
import { CLAVE_PASARELA, desconectarPasarela, descubrirPasarela } from '@/lib/cobros-conexion';
import { esPasarela, NOMBRE_PASARELA } from '@/lib/cobros-tipos';
import { getRolWsEfectivo, getWorkspaceActual, OWNER_WS, wsSuperAdmin } from '@/lib/workspace';
import { verificarServicio } from '@/lib/metodo-verificar';
import { descubrirMeta, pixelesDeCuenta } from '@/lib/meta-descubrir';
import { conectarMetaDisponible, guardarConexionMeta } from '@/lib/meta-conexion';
import { arrancarHistoricoEnSegundoPlano } from '@/lib/onboarding-extract';
import { leerResultadoMeta } from '@/lib/meta-login';
import { descubrirGithub } from '@/lib/github-descubrir';
import { ayudaDeCampo, ENVS_METODO, servicioDeEnv, servicioMetodo } from '@/lib/metodo-catalogo';
import { normalizarCuentaMeta } from '@/lib/meta-cuenta-id';

export const dynamic = 'force-dynamic';

const msg = (e: unknown) => String(e instanceof Error ? e.message : e);

type Contexto = {
  ws: number;
  autor: string | null;
  /**
   * El workspace OBJETIVO es el de la plataforma (no «quien mira es admin»).
   *
   * ⚠️ Son dos preguntas distintas y confundirlas es el bug de la casa. El super
   * admin sigue siendo admin cuando entra al workspace de un cliente con `?ws=N`,
   * así que un permiso derivado de la SESIÓN autoriza a tocar la credencial de la
   * plataforma parado adentro del panel de un cliente — y `guardar` escribe con
   * `ctx.ws`, o sea en la fila de ese cliente.
   */
  esPlataforma: boolean;
};

/**
 * Resuelve el workspace objetivo y valida el permiso. El ws SIEMPRE sale del
 * request (getWorkspaceActual): jamás se acepta un ws del body/query. Devuelve
 * un error tipado en vez de lanzar, para que cada handler responda con status.
 */
async function resolverContexto(): Promise<Contexto | { error: string; status: number }> {
  const sesion = await getUsuarioActual();
  if (!sesion) return { error: 'solo admin', status: 403 };

  // super-admin de agencia (o legacy/dev/dueño) O admin del propio workspace.
  const esSuperAdmin = (await getSesionAdmin()) != null;
  const esAdminWs = (await getRolWsEfectivo()) === 'admin';
  if (!esSuperAdmin && !esAdminWs) return { error: 'solo admin', status: 403 };

  const wsActual = await getWorkspaceActual();
  // ws null = admin sin impersonar: solo el super-admin cae al dueño; el resto
  // (p.ej. un admin-cliente sin workspace resuelto) → 403 fail-closed.
  const wsPlataforma = await wsSuperAdmin().catch(() => -1);
  if (wsActual == null) {
    if (!esSuperAdmin) return { error: 'workspace no resuelto', status: 403 };
    // ⚠️ OWNER_WS (=1) es MAURICIO, un cliente — no la plataforma. Está escrito en
    // AGENTS.md y ya mordió acá: cayendo a OWNER_WS, `esPlataforma` tiene que dar
    // false, o el admin sin impersonar terminaría administrando el token del repo
    // desde el workspace de un cliente.
    return { ws: OWNER_WS, autor: autorDe(sesion), esPlataforma: OWNER_WS === wsPlataforma };
  }
  return { ws: wsActual, autor: autorDe(sesion), esPlataforma: wsActual === wsPlataforma };
}

// La sesión legacy trae el email de una cookie no firmada (editable) → no lo
// usamos como atribución; guardamos el sub en su lugar.
function autorDe(sesion: Awaited<ReturnType<typeof getUsuarioActual>>): string | null {
  if (!sesion) return null;
  return sesion.legacy ? sesion.sub : (sesion.email || sesion.sub);
}

/**
 * Guard EXTRA solo para 'revelar' (BYOK): ver una credencial en claro queda
 * reservado a quien es dueño de ESE workspace puntual. La agencia impersonando
 * el workspace de un cliente no, nunca — pero si el workspace objetivo ES el
 * propio (`sesion.ws`, fijo por su fila en `usuarios`, no se mueve con la
 * impersonación), sí puede, sea cliente o agencia: es su propia credencial.
 *
 * Por qué no alcanza el guard general: getRolWsEfectivo() devuelve 'admin' para
 * cualquiera con rol global 'admin' ANTES de mirar su rol_ws real
 * (lib/workspace.ts), y getWorkspaceActual() devuelve el ws impersonado. O sea
 * que "es admin de este workspace" da true para la agencia y no filtra nada.
 * El discriminante duro es la comparación `sesion.ws === ws`: como `sesion.ws`
 * viene de la fila real y la impersonación no la toca, un admin de agencia que
 * impersona el workspace de un cliente sigue teniendo `sesion.ws` distinto de
 * `ws` y queda afuera — pero si `ws` es su propio workspace (p.ej. la agencia
 * también tiene uno propio para sus datos), pasa. Las sesiones legacy/break-glass
 * (contraseña maestra, dev-login) tampoco pasan: no son de nadie en particular.
 *
 * Escribir SÍ sigue permitido a la agencia (configurar integraciones en el
 * onboarding es parte del laburo). Lo que se cierra es la LECTURA ajena.
 */
function puedeRevelar(sesion: NonNullable<Awaited<ReturnType<typeof getUsuarioActual>>>, ws: number): boolean {
  if (sesion.legacy) return false;
  if (sesion.ws == null || sesion.ws !== ws) return false;
  return (sesion.rolWs ?? 'admin') === 'admin';
}

/**
 * El servicio que este contexto TIENE DERECHO a resolver, o undefined.
 *
 * ⚠️⚠️ EL GUARD VA ACÁ, NO EN CADA HANDLER. `soloPlataforma` estaba declarado en el
 * catálogo (lib/metodo-catalogo.ts) y esta ruta NUNCA lo consultaba: los cuatro
 * caminos que resuelven un servicio —GET, `guardar`, `descubrir-github` y
 * `verificar`— llamaban al accessor CRUDO. Medido con curl y una sesión de cliente
 * sobre el ws13: `GET ?servicio=github` devolvía 200 con la ficha entera —el copy
 * interno de la agencia, el tutorial de 5 pasos y los nombres GITHUB_TOKEN /
 * GITHUB_REPO— y `guardar` le dejaba escribir esas claves en su propio workspace.
 *
 * `serviciosPara(esSuperAdmin)` existía en el catálogo justo para esto y NO LA
 * LLAMABA NADIE: era código muerto. La regla vivía únicamente en la capa que dibuja
 * la grilla, o sea protegía la PANTALLA y no la API.
 *
 * Y es por WORKSPACE, no por sesión: parado en `?ws=13`, ni el super admin puede
 * tocar la credencial de la plataforma — porque `guardar` escribe con `ctx.ws` y la
 * dejaría adentro de la fila de ese cliente, mientras `lib/github-commits.ts` la
 * lee de `wsSuperAdmin()` y nunca la encontraría.
 *
 * Cerrar tres de los cuatro caminos es dejar el cuarto abierto, que es el patrón
 * que AGENTS.md ya tiene escrito para el veto de Claude. Por eso: un solo resolvedor.
 */
/**
 * El guard, para las acciones que hablan de un ENV y no de un servicio.
 *
 * ⚠️⚠️ `revelar` y `borrar` eran el QUINTO y SEXTO camino, y se me pasaron. Ayer puse
 * `servicioDelContexto()` en los cuatro que resuelven un servicio (GET, guardar,
 * descubrir-github, verificar) y escribí que cerrar tres deja el cuarto abierto —
 * y dejé estos dos, que no toman `servicio` sino `env`, con su única validación
 * `ENVS_METODO.has(env)`.
 *
 * Y esa whitelist NO filtra plataforma: `ENVS_METODO` se arma con `!s.soloServidor`
 * (una bandera que hoy no usa ningún servicio), así que GITHUB_TOKEN está adentro.
 * Un admin de otro workspace no podía leer la fila del ws9 —`puedeRevelar` exige ser
 * dueño del workspace donde vive— pero la puerta estaba sin el cartel de los demás,
 * y `borrar` no tenía ni siquiera esa comprobación de rol.
 *
 * La lección que queda: **un guard se pone en el punto donde se resuelve el
 * PERMISO, no en cada handler**. Acá hay dos formas de nombrar lo mismo (por
 * servicio y por env) y hacen falta las dos.
 */
function envDelContexto(env: string, ctx: Contexto): boolean {
  if (!ENVS_METODO.has(env)) return false;
  const key = servicioDeEnv(env);
  return !!key && !!servicioDelContexto(key, ctx);
}

function servicioDelContexto(key: string, ctx: Contexto) {
  const s = servicioMetodo(key);
  if (!s) return undefined;
  // 404 y no 403: a quien no le corresponde, esta integración no existe. Un 403
  // confirma que existe, y eso ya es contarle algo de la plataforma.
  if (s.soloPlataforma && !ctx.esPlataforma) return undefined;
  return s;
}

// Estado de un servicio (catálogo + estado por campo) para el ws objetivo.
async function estadoServicio(servicioKey: string, ctx: Contexto) {
  const ws = ctx.ws;
  const s = servicioDelContexto(servicioKey, ctx);
  if (!s) return null;
  const campos = await Promise.all(s.campos.map(async (c) => {
    let est: Awaited<ReturnType<typeof estadoCampo>>;
    try { est = await estadoCampo(c.env, ws); }
    catch { est = { configurado: false, origen: null, mask: '', ilegible: false }; }
    return {
      env: c.env,
      label: c.label,
      placeholder: c.placeholder ?? null,
      secreto: !!c.secreto,
      opcional: !!c.opcional,
      // Opcional para «conectado» pero sin él algo no anda: la pantalla lo pinta «falta».
      sinEsto: c.sinEsto ?? null,
      nota: c.nota ?? null,
      host: !!c.host,
      // true → no se pide como campo: lo completa la app (ver CampoCredencial.auto).
      auto: !!c.auto,
      // true → ni «Prefiero cargarlos a mano» lo vuelve editable (ver CampoCredencial.derivado).
      derivado: !!c.derivado,
      // Nº de cuenta de una key que admite varias (1 = la de siempre). La UI pliega
      // las de la 2 en adelante: tres inputs de entrada convertían "pegá tu key" en
      // un formulario.
      slot: c.slot ?? 1,
      // Cómo se consigue ESTE campo. El modal ya no muestra un tutorial por
      // servicio: cada credencial se saca de un lado distinto.
      ayuda: ayudaDeCampo(c.env),
      ...est,
    };
  }));
  return {
    key: s.key,
    nombre: s.nombre,
    categoria: s.categoria,
    paraQue: s.paraQue,
    soloServidor: !!s.soloServidor,
    tutorial: s.tutorial,
    // Lo que el usuario tiene que pegar del OTRO lado (ver PasoExterno). Ya viene
    // con la URL real resuelta desde servicioMetodo().
    pasoExterno: s.pasoExterno ?? null,
    campos,
  };
}

export async function GET(req: NextRequest) {
  const ctx = await resolverContexto();
  if ('error' in ctx) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status });

  const servicioKey = req.nextUrl.searchParams.get('servicio') ?? '';
  try {
    const servicio = await estadoServicio(servicioKey, ctx);
    if (!servicio) return NextResponse.json({ ok: false, error: 'servicio inválido' }, { status: 400 });
    if (servicio.key !== 'meta') return NextResponse.json({ ok: true, servicio });
    // Meta: si se ofrece el botón, y cómo terminó el último intento. El resultado
    // viaja en una cookie de UN uso que escribe el callback, y no en la URL: así lo
    // lee el formulario donde sea que esté montado (/integraciones, el onboarding)
    // sin que cada pantalla tenga que pasarle un parámetro.
    const ultimoIntento = leerResultadoMeta(req.cookies.get('meta_resultado')?.value);
    const res = NextResponse.json({ ok: true, servicio, conectarMeta: await conectarMetaDisponible(), ultimoIntento });
    if (ultimoIntento) res.cookies.set({ name: 'meta_resultado', value: '', maxAge: 0, path: '/' });
    return res;
  } catch (e) {
    return NextResponse.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}

type Body = { action?: string; servicio?: string; valores?: Record<string, unknown>; env?: string; tipo?: string; id?: string };

export async function POST(req: NextRequest) {
  const ctx = await resolverContexto();
  if ('error' in ctx) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: 'body inválido' }, { status: 400 });
  }

  try {
    if (body.action === 'guardar') {
      const servicio = servicioDelContexto(body.servicio ?? '', ctx);
      if (!servicio || servicio.soloServidor) {
        return NextResponse.json({ ok: false, error: 'servicio inválido' }, { status: 400 });
      }
      const valores = body.valores && typeof body.valores === 'object' ? body.valores : {};
      // ⚠️ Los DERIVADOS no entran por aquí (lib/metodo-catalogo.ts → `derivado`): el id de la
      // cuenta de Stripe o de Mercado Pago lo escribe SÓLO el descubrimiento, a partir de la clave.
      // Aceptarlo tipeado dejaba que un POST a mano reclamara el acct_ de otro negocio — y con eso
      // le bloqueaba la conexión o se quedaba con sus avisos de pago.
      const envsDelServicio = new Set(servicio.campos.filter((c) => !c.derivado).map((c) => c.env));
      let guardadas = 0;
      for (const [env, valor] of Object.entries(valores)) {
        if (!envsDelServicio.has(env)) continue; // whitelist estricta: ignora envs ajenas y derivadas
        let v = typeof valor === 'string' ? valor.trim() : '';
        if (!v) continue; // input vacío nunca pisa una guardada
        // ⚠️ La cuenta de Meta se guarda NORMALIZADA. La regla es general:
        // verificar una cosa y guardar otra es cómo se llega a una credencial que
        // pasó la prueba y no funciona. (Hasta el 06/10/2026 la misma regla
        // protegía el id de Clarity, que se fue del producto, y su comentario
        // describía este bug antes de que pasara.)
        // Business Manager le muestra al cliente `1357728489…` y
        // la Graph API solo entiende `act_1357728489…`; el ping de verificación
        // normalizaba y el guardado no, así que la prueba daba verde sobre un
        // valor que nunca se almacenó. Un cliente estuvo desde el 19/8 con la
        // cuenta ilegible por esto. Ver lib/meta-cuenta-id.ts.
        if (env === 'META_AD_ACCOUNT_ID') v = normalizarCuentaMeta(v);
        // Sin excepciones para el dueño: guardar SIEMPRE escribe en la base, y la
        // base manda (lib/credenciales.ts). Todo se configura desde la app.
        try {
          await guardarCredencial(ctx.ws, env, v, servicio.key, ctx.autor);
        } catch (e) {
          // Reclamar el identificador de otro workspace no es un error del
          // sistema: es un intento de secuestro de webhooks. Se rechaza con su
          // motivo y queda auditado.
          if (e instanceof IdentificadorOcupadoError) {
            await auditarCredencial(ctx.ws, env, 'guardar', ctx.autor, { permitido: false, motivo: 'identificador ya reclamado por otro workspace' });
            return NextResponse.json({ ok: false, error: e.message }, { status: 409 });
          }
          // La key de PLATAFORMA pegada como BYOK: rechazada en el choke point
          // (lib/credenciales.ts). Mismo trato que el identificador ocupado:
          // se audita el intento y se contesta con el motivo.
          if (e instanceof KeyDePlataformaError) {
            await auditarCredencial(ctx.ws, env, 'guardar', ctx.autor, { permitido: false, motivo: 'pegó la key de plataforma como BYOK' });
            return NextResponse.json({ ok: false, error: e.message }, { status: 409 });
          }
          // El remitente de MaKo como `RESEND_FROM` (undécima tanda: «Nadie debería poder»). Mismo trato:
          // se audita el intento y se contesta con el motivo.
          if (e instanceof RemitenteNoPropioError) {
            await auditarCredencial(ctx.ws, env, 'guardar', ctx.autor, { permitido: false, motivo: 'remitente de un dominio de MaKo' });
            return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
          }
          throw e;
        }
        await auditarCredencial(ctx.ws, env, 'guardar', ctx.autor);
        guardadas++;
      }
      // Los campos de Meta guardados a mano también conectan Meta: arranca el histórico (una vez, en segundo plano).
      if (servicio.key === 'meta' && guardadas > 0) await arrancarHistoricoEnSegundoPlano(ctx.ws);
      const estado = await estadoServicio(servicio.key, ctx);
      return NextResponse.json({ ok: true, guardadas, servicio: estado });
    }

    // Meta: con el token pegado, completar SOLO el resto de los campos. Antes le
    // pedíamos al cliente seis credenciales de seis pantallas distintas de Business
    // Manager (una de ellas le hacía abrir el Explorador de la API Graph a mano);
    // cinco salen de cuatro GET con el token que ya pegó. Lo único que no se puede
    // adivinar es CUÁL elegir si tiene varias: eso vuelve como `opciones`.
    // GitHub: el token fine-grained se emite CONTRA repos concretos, así que GitHub ya
    // sabe cuáles son. Pedirle al dueño que escriba «usuario/repo» a mano era pedirle que
    // adivine un dato que la API devuelve — y lo tuvo que adivinar.
    if (body.action === 'descubrir-github') {
      // ⚠️ GITHUB ES DE LA PLATAFORMA: esta accion no existe fuera de su workspace.
      // Sin este guard, un admin de workspace cliente podia pedirla — y peor: el
      // `credWs('GITHUB_TOKEN')` de abajo iba SIN workspace, asi que caia en
      // `wsDefault() = getWorkspaceActual() ?? OWNER_WS` y, para una sesion parada en
      // OWNER_WS (=1, que es Mauricio, un CLIENTE), `lib/credenciales.ts` remata con
      // `if (w === OWNER_WS && esValorReal(process.env[clave])) return process.env[clave]`.
      // O sea que le habria prestado el token del repo de la AGENCIA para listarle
      // los repos privados, y encima guardado GITHUB_REPO en la fila del cliente.
      // Hoy `process.env.GITHUB_TOKEN` no esta cargado en produccion (verificado), asi
      // que estaba latente y no vivo — pero el camino estaba abierto.
      if (!ctx.esPlataforma) return NextResponse.json({ ok: false, error: 'servicio inválido' }, { status: 404 });
      // Y el workspace va EXPLICITO: el token del repo vive en el de la plataforma y
      // en ningun otro, que es de donde lo lee `lib/github-commits.ts`.
      const guardado = (await credWs('GITHUB_TOKEN', await wsSuperAdmin())) ?? '';
      const pegado = typeof body.valores?.GITHUB_TOKEN === 'string' ? body.valores.GITHUB_TOKEN.trim() : '';
      const usar = pegado || guardado;
      if (!usar || usar.startsWith('PENDING')) {
        return NextResponse.json({ ok: false, error: 'Pega primero el token de GitHub.' }, { status: 400 });
      }
      const d = await descubrirGithub(usar);
      if (!d.ok) return NextResponse.json({ ok: false, error: d.error }, { status: 422 });
      // Uno solo = no hay nada que preguntar: se guarda y listo.
      // Se guarda donde se LEE. Con `ctx.ws` esto podia dejar el repo de la agencia
      // adentro de un workspace de cliente y encima invisible para quien lo consume.
      if (d.repo) await guardarCredencial(await wsSuperAdmin(), 'GITHUB_REPO', d.repo, 'github', ctx.autor);
      return NextResponse.json({ ok: true, repo: d.repo ?? '', opciones: d.opciones, mensaje: d.mensaje });
    }

    if (body.action === 'descubrir') {
      // `ctx.ws` explícito: credWs de un argumento cae a la sesión, y este token
      // tiene que ser el del workspace que se está configurando.
      const token = (await credWs('META_ACCESS_TOKEN', ctx.ws)) ?? '';
      const pegado = typeof body.valores?.META_ACCESS_TOKEN === 'string' ? body.valores.META_ACCESS_TOKEN.trim() : '';
      const usar = pegado || token;
      if (!usar || usar.startsWith('PENDING')) {
        return NextResponse.json({ ok: false, error: 'Pega primero tu access token de Meta.' }, { status: 400 });
      }
      // Lo que se guarda (y la regla de los dos tokens) vive en lib/meta-conexion:
      // es lo mismo que guarda el botón «Conectar con Meta», y con dos copias la
      // segunda se queda vieja.
      const r = await guardarConexionMeta(ctx.ws, usar, ctx.autor, { guardarToken: false });
      if ('error' in r) return NextResponse.json({ ok: false, error: r.error }, { status: 422 });
      const { d, guardadas, conflictos } = r;

      const estado = await estadoServicio('meta', ctx);
      return NextResponse.json({
        ok: true,
        servicio: estado,
        guardadas,
        titular: d.titular,
        faltanScopes: d.faltanScopes,
        permanente: d.permanente,
        // Solo vuelven como "elegí" las que tienen MÁS de una opción.
        opciones: {
          cuentas: d.cuentas.length > 1 ? d.cuentas : [],
          paginas: d.paginas.length > 1 ? d.paginas.map((p) => ({ id: p.id, nombre: p.nombre })) : [],
          pixeles: d.pixeles.length > 1 ? d.pixeles : [],
        },
        avisos: [...d.avisos, ...conflictos],
      });
    }

    // La pasarela de pagos (Stripe y Mercado Pago): con la clave pegada —o la guardada, para volver
    // a conectar—, MaKo lee la cuenta, reclama su id, guarda la clave y, en Stripe, registra el
    // aviso de pagos. Lo que se guarda vive en lib/cobros-conexion.ts, como el de Meta en
    // lib/meta-conexion.ts. Si el proveedor no acepta la clave, no se guarda NADA: por eso el
    // formulario manda la clave AQUÍ y no por 'verificar' + 'guardar', que con los derivados vacíos
    // la guardaba sin probar.
    if (body.action === 'descubrir-pago') {
      const pasarela = servicioDelContexto(body.servicio ?? '', ctx)?.key;
      if (!esPasarela(pasarela)) return NextResponse.json({ ok: false, error: 'servicio inválido' }, { status: 400 });
      const env = CLAVE_PASARELA[pasarela];
      const crudo = body.valores?.[env];
      const pegado = typeof crudo === 'string' ? crudo.trim() : '';
      // credDelCliente y NUNCA credWs: para el ws1 (Mauricio, un cliente) credWs cae a process.env,
      // y volver a conectar podría registrar el aviso con una clave que no es la suya.
      const usar = pegado || (await credDelCliente(env, ctx.ws)) || '';
      if (!usar) {
        return NextResponse.json({ ok: false, error: `Pega primero tu clave de ${NOMBRE_PASARELA[pasarela]}.`, nadaGuardado: true }, { status: 400 });
      }
      const r = await descubrirPasarela(pasarela, ctx.ws, usar, ctx.autor, { guardarClave: !!pegado });
      if (!r.ok) return NextResponse.json({ ok: false, error: r.error, nadaGuardado: r.nadaGuardado }, { status: r.status });
      return NextResponse.json({
        ok: true,
        completa: r.completa,
        mensaje: r.mensaje,
        guardadas: r.guardadas,
        facts: r.facts,
        servicio: await estadoServicio(pasarela, ctx),
      });
    }

    // El cliente eligió entre varias opciones: guardar ESA. El token de la página
    // no viaja al browser — se vuelve a pedir a Meta acá y se guarda junto al id.
    if (body.action === 'elegir') {
      const token = (await credWs('META_ACCESS_TOKEN', ctx.ws)) ?? '';
      if (!token || token.startsWith('PENDING')) return NextResponse.json({ ok: false, error: 'Falta el access token de Meta.' }, { status: 400 });
      const tipo = body.tipo ?? '';
      const id = typeof body.id === 'string' ? body.id.trim() : '';
      if (!id) return NextResponse.json({ ok: false, error: 'falta el id elegido' }, { status: 400 });

      const guardar = async (env: string, valor: string) => {
        try {
          await guardarCredencial(ctx.ws, env, valor, 'meta', ctx.autor);
          await auditarCredencial(ctx.ws, env, 'guardar', ctx.autor);
          return null;
        } catch (e) {
          if (e instanceof IdentificadorOcupadoError) {
            await auditarCredencial(ctx.ws, env, 'guardar', ctx.autor, { permitido: false, motivo: 'identificador ya reclamado por otro workspace' });
            return e.message;
          }
          throw e;
        }
      };

      let conflicto: string | null = null;
      let pixeles: Array<{ id: string; nombre: string }> = [];
      if (tipo === 'cuenta') {
        conflicto = await guardar('META_AD_ACCOUNT_ID', normalizarCuentaMeta(id));
        // Los píxeles cuelgan de la cuenta: recién ahora se pueden listar.
        pixeles = await pixelesDeCuenta(token, id);
        if (pixeles.length === 1) await guardar('META_PIXEL_ID', pixeles[0].id);
      } else if (tipo === 'pagina') {
        const d = await descubrirMeta(token);
        const pag = d.ok ? d.paginas.find((p) => p.id === id) : undefined;
        conflicto = await guardar('META_PAGE_ID', id);
        if (pag?.token) await guardar('META_PAGE_ACCESS_TOKEN', pag.token);
      } else if (tipo === 'pixel') {
        conflicto = await guardar('META_PIXEL_ID', id);
      } else {
        return NextResponse.json({ ok: false, error: 'tipo inválido' }, { status: 400 });
      }
      // Elegir la cuenta o la página es lo que destraba las métricas y los leads del histórico.
      if (!conflicto) await arrancarHistoricoEnSegundoPlano(ctx.ws);

      const estado = await estadoServicio('meta', ctx);
      return NextResponse.json({
        ok: true,
        servicio: estado,
        opciones: { cuentas: [], paginas: [], pixeles: pixeles.length > 1 ? pixeles : [] },
        avisos: conflicto ? [conflicto] : [],
      });
    }

    if (body.action === 'borrar') {
      const env = body.env ?? '';
      // 400 y no 404 como en el resolvedor por servicio: acá el cliente pregunta por
      // una CLAVE, y «esa clave no existe para vos» no confirma nada de la plataforma.
      if (!envDelContexto(env, ctx)) return NextResponse.json({ ok: false, error: 'clave inválida' }, { status: 400 });
      // La clave de una PASARELA desconecta del todo: los derivados, su ruteo y el aviso en la cuenta de Stripe
      // (lib/cobros-conexion.ts). Borrarla sola dejaba la cuenta reclamada sin forma de soltarla.
      const pasarela = (Object.keys(CLAVE_PASARELA) as Array<keyof typeof CLAVE_PASARELA>).find((k) => CLAVE_PASARELA[k] === env);
      if (pasarela) {
        const r = await desconectarPasarela(ctx.ws, pasarela, ctx.autor);
        return NextResponse.json({ ok: true, aviso: r.aviso });
      }
      await eliminarCredencial(ctx.ws, env);
      await auditarCredencial(ctx.ws, env, 'borrar', ctx.autor);
      return NextResponse.json({ ok: true });
    }

    // Revelar UNA credencial (el "ojito"). Va en su propia action a propósito:
    // el GET del estado manda solo la máscara, así el texto plano nunca viaja
    // por el solo hecho de abrir el modal — hay que pedirlo, y queda registrado.
    // credWs scopea al ws del contexto: nunca se lee la credencial de otro.
    if (body.action === 'revelar') {
      const env = body.env ?? '';
      // 400 y no 404 como en el resolvedor por servicio: acá el cliente pregunta por
      // una CLAVE, y «esa clave no existe para vos» no confirma nada de la plataforma.
      if (!envDelContexto(env, ctx)) return NextResponse.json({ ok: false, error: 'clave inválida' }, { status: 400 });
      // getUsuarioActual está cacheada por request: volver a pedirla no cuesta.
      const sesion = await getUsuarioActual();
      if (!sesion || !puedeRevelar(sesion, ctx.ws)) {
        // El intento RECHAZADO también se audita: es la señal más interesante.
        await auditarCredencial(ctx.ws, env, 'revelar', ctx.autor, { permitido: false, motivo: 'no es admin de este workspace' });
        return NextResponse.json({ ok: false, error: 'Solo el admin de este espacio puede ver una credencial.' }, { status: 403 });
      }
      // Una clave de pasarela, sólo la del negocio: `credWs` cae a process.env para el ws1, y el «ojito» mostraría
      // una clave que no es suya como si lo fuera.
      const valor = esClaveDePasarela(env) ? await credDelCliente(env, ctx.ws) : await credWs(env, ctx.ws);
      if (!valor) return NextResponse.json({ ok: false, error: 'sin credencial guardada' }, { status: 404 });
      await auditarCredencial(ctx.ws, env, 'revelar', ctx.autor);
      return NextResponse.json({ ok: true, valor }, { headers: { 'Cache-Control': 'no-store' } });
    }

    if (body.action === 'verificar') {
      const servicio = servicioDelContexto(body.servicio ?? '', ctx);
      if (!servicio) return NextResponse.json({ ok: false, error: 'servicio inválido' }, { status: 400 });
      const valores = body.valores && typeof body.valores === 'object' ? body.valores : {};
      const resultado = await verificarServicio(servicio.key, valores);
      return NextResponse.json(resultado);
    }

    return NextResponse.json({ ok: false, error: 'action inválida' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
