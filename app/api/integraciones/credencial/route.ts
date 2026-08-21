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
// POST { action:'guardar', servicio, valores } → whitelist estricta por campos.
// POST { action:'borrar', env }                → elimina la fila cifrada.
// POST { action:'verificar', servicio, valores } → "Probar conexión".
// POST { action:'revelar', env }               → texto plano de UNA credencial.

import { NextResponse, type NextRequest } from 'next/server';
import { getSesionAdmin, getUsuarioActual } from '@/lib/auth';
import { auditarCredencial, credWs, eliminarCredencial, estadoCampo, guardarCredencial, IdentificadorOcupadoError, KeyDePlataformaError } from '@/lib/credenciales';
import { getRolWsEfectivo, getWorkspaceActual, OWNER_WS } from '@/lib/workspace';
import { verificarServicio } from '@/lib/metodo-verificar';
import { descubrirMeta, pixelesDeCuenta } from '@/lib/meta-descubrir';
import { descubrirGithub } from '@/lib/github-descubrir';
import { ayudaDeCampo, ENVS_METODO, servicioMetodo } from '@/lib/metodo-catalogo';
import { normalizarProjectId } from '@/lib/clarity';
import { normalizarCuentaMeta } from '@/lib/meta-cuenta-id';

export const dynamic = 'force-dynamic';

const msg = (e: unknown) => String(e instanceof Error ? e.message : e);

type Contexto = { ws: number; autor: string | null };

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
  if (wsActual == null) {
    if (!esSuperAdmin) return { error: 'workspace no resuelto', status: 403 };
    return { ws: OWNER_WS, autor: autorDe(sesion) };
  }
  return { ws: wsActual, autor: autorDe(sesion) };
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

// Estado de un servicio (catálogo + estado por campo) para el ws objetivo.
async function estadoServicio(servicioKey: string, ws: number) {
  const s = servicioMetodo(servicioKey);
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
      nota: c.nota ?? null,
      host: !!c.host,
      // true → no se pide como campo: lo completa la app (ver CampoCredencial.auto).
      auto: !!c.auto,
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
    const servicio = await estadoServicio(servicioKey, ctx.ws);
    if (!servicio) return NextResponse.json({ ok: false, error: 'servicio inválido' }, { status: 400 });
    return NextResponse.json({ ok: true, servicio });
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
      const servicio = servicioMetodo(body.servicio ?? '');
      if (!servicio || servicio.soloServidor) {
        return NextResponse.json({ ok: false, error: 'servicio inválido' }, { status: 400 });
      }
      const valores = body.valores && typeof body.valores === 'object' ? body.valores : {};
      const envsDelServicio = new Set(servicio.campos.map((c) => c.env));
      let guardadas = 0;
      for (const [env, valor] of Object.entries(valores)) {
        if (!envsDelServicio.has(env)) continue; // whitelist estricta: ignora envs ajenas
        let v = typeof valor === 'string' ? valor.trim() : '';
        if (!v) continue; // input vacío nunca pisa una guardada
        // ⚠️ El id de Clarity se guarda NORMALIZADO. La verificación acepta que
        // pegues la dirección entera del panel —que es donde todo el mundo lo
        // tiene a mano— pero lo que se guarda tiene que ser el id pelado: es lo
        // que va en el <script> de la página del cliente y en el link del lead.
        // Verificar una cosa y guardar otra es cómo se llega a una credencial que
        // pasó la prueba y no funciona.
        if (env === 'CLARITY_PROJECT_ID') {
          const pid = normalizarProjectId(v);
          if (!pid) continue;
          v = pid;
        }
        // ⚠️ Y la cuenta de Meta, por EXACTAMENTE el mismo motivo — el comentario
        // de acá arriba describía este bug dos años antes de que pasara, sobre la
        // otra credencial. Business Manager le muestra al cliente `1357728489…` y
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
          throw e;
        }
        await auditarCredencial(ctx.ws, env, 'guardar', ctx.autor);
        guardadas++;
      }
      const estado = await estadoServicio(servicio.key, ctx.ws);
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
      const guardado = (await credWs('GITHUB_TOKEN')) ?? '';
      const pegado = typeof body.valores?.GITHUB_TOKEN === 'string' ? body.valores.GITHUB_TOKEN.trim() : '';
      const usar = pegado || guardado;
      if (!usar || usar.startsWith('PENDING')) {
        return NextResponse.json({ ok: false, error: 'Pegá primero el token de GitHub.' }, { status: 400 });
      }
      const d = await descubrirGithub(usar);
      if (!d.ok) return NextResponse.json({ ok: false, error: d.error }, { status: 422 });
      // Uno solo = no hay nada que preguntar: se guarda y listo.
      if (d.repo) await guardarCredencial(ctx.ws, 'GITHUB_REPO', d.repo, 'github', ctx.autor);
      return NextResponse.json({ ok: true, repo: d.repo ?? '', opciones: d.opciones, mensaje: d.mensaje });
    }

    if (body.action === 'descubrir') {
      const token = (await credWs('META_ACCESS_TOKEN')) ?? '';
      const pegado = typeof body.valores?.META_ACCESS_TOKEN === 'string' ? body.valores.META_ACCESS_TOKEN.trim() : '';
      const usar = pegado || token;
      if (!usar || usar.startsWith('PENDING')) {
        return NextResponse.json({ ok: false, error: 'Pegá primero tu access token de Meta.' }, { status: 400 });
      }
      const d = await descubrirMeta(usar);
      if (!d.ok) return NextResponse.json({ ok: false, error: d.error }, { status: 422 });

      // Se guarda SOLO lo inequívoco (una sola opción). Con varias, decide el dueño.
      const aGuardar: Record<string, string> = {};
      if (d.cuentas.length === 1) aGuardar.META_AD_ACCOUNT_ID = d.cuentas[0].id;
      if (d.paginas.length === 1) {
        aGuardar.META_PAGE_ID = d.paginas[0].id;
        if (d.paginas[0].token) aGuardar.META_PAGE_ACCESS_TOKEN = d.paginas[0].token;
      }
      if (d.pixeles.length === 1) aGuardar.META_PIXEL_ID = d.pixeles[0].id;

      // Campo por campo: que un identificador ya reclamado por otro workspace
      // (META_PAGE_ID rutea leads) no tumbe TODO el descubrimiento.
      const guardadas: string[] = [];
      const conflictos: string[] = [];
      for (const [env, valor] of Object.entries(aGuardar)) {
        try {
          await guardarCredencial(ctx.ws, env, valor, 'meta', ctx.autor);
          await auditarCredencial(ctx.ws, env, 'guardar', ctx.autor);
          guardadas.push(env);
        } catch (e) {
          if (e instanceof IdentificadorOcupadoError) {
            await auditarCredencial(ctx.ws, env, 'guardar', ctx.autor, { permitido: false, motivo: 'identificador ya reclamado por otro workspace' });
            conflictos.push(e.message);
            continue;
          }
          throw e;
        }
      }

      const estado = await estadoServicio('meta', ctx.ws);
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

    // El cliente eligió entre varias opciones: guardar ESA. El token de la página
    // no viaja al browser — se vuelve a pedir a Meta acá y se guarda junto al id.
    if (body.action === 'elegir') {
      const token = (await credWs('META_ACCESS_TOKEN')) ?? '';
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

      const estado = await estadoServicio('meta', ctx.ws);
      return NextResponse.json({
        ok: true,
        servicio: estado,
        opciones: { cuentas: [], paginas: [], pixeles: pixeles.length > 1 ? pixeles : [] },
        avisos: conflicto ? [conflicto] : [],
      });
    }

    if (body.action === 'borrar') {
      const env = body.env ?? '';
      if (!ENVS_METODO.has(env)) return NextResponse.json({ ok: false, error: 'clave inválida' }, { status: 400 });
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
      if (!ENVS_METODO.has(env)) return NextResponse.json({ ok: false, error: 'clave inválida' }, { status: 400 });
      // getUsuarioActual está cacheada por request: volver a pedirla no cuesta.
      const sesion = await getUsuarioActual();
      if (!sesion || !puedeRevelar(sesion, ctx.ws)) {
        // El intento RECHAZADO también se audita: es la señal más interesante.
        await auditarCredencial(ctx.ws, env, 'revelar', ctx.autor, { permitido: false, motivo: 'no es admin de este workspace' });
        return NextResponse.json({ ok: false, error: 'Solo el admin de este espacio puede ver una credencial.' }, { status: 403 });
      }
      const valor = await credWs(env, ctx.ws);
      if (!valor) return NextResponse.json({ ok: false, error: 'sin credencial guardada' }, { status: 404 });
      await auditarCredencial(ctx.ws, env, 'revelar', ctx.autor);
      return NextResponse.json({ ok: true, valor }, { headers: { 'Cache-Control': 'no-store' } });
    }

    if (body.action === 'verificar') {
      const servicio = servicioMetodo(body.servicio ?? '');
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
