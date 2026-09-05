// =============================================================================
// POST /api/flow/puente — el único endpoint que habla con el navegador del cliente
// =============================================================================
// La extensión no tiene sesión de MaKo: se autentica con el TOKEN DEL PUENTE, que
// el cliente copió una vez de su pantalla. Por eso esta ruta está en `PUBLICOS`
// de lib/rutas-publicas.ts — se hace cargo de su propia auth y **no mira la
// cookie de sesión para nada**.
//
// Es UN solo endpoint y no dos (uno para pedir, otro para devolver) a propósito:
// la extensión hace polling cada pocos segundos, y con dos rutas cada ciclo son
// dos round-trips y dos oportunidades de que la mitad llegue y la otra no. Acá
// devuelve lo que terminó y pide lo que sigue en la misma llamada.
//
// ⚠️ EL BEARER DE GOOGLE NUNCA LLEGA ACÁ. Vive en la extensión, en la máquina del
// cliente. Lo que sube es el RESULTADO de la llamada que la extensión ya hizo.
// Si algún día alguien agrega un campo `bearer` a este contrato, está creando una
// custodia que hoy no existe y que no hace falta.

import { mediaIdDeReferencia, KEY_CARA_FLOW } from '@/lib/flow-clip-referencias';
import { getSetting, setSetting } from '@/lib/settings';
import { sanearDiagnostico, KEY_DIAGNOSTICO } from '@/lib/flow-diagnostico';
import {
  sanearPlantillas, soloDelProyecto, fundirPlantillas, faltantes, KEY_PLANTILLAS,
  type PlantillaEspejo,
  proyectoDePlantilla,  seGuardaLaRespuesta,
} from '@/lib/flow-plantillas';
import { runWithWorkspace, getTenantDb } from '@/lib/workspace';
import { NextResponse, type NextRequest } from 'next/server';
import {
  workspaceDeToken, marcarVisto, tomarTrabajos, resolver, fallar, estadoGuardado,
  type EstadoPuente,
} from '@/lib/flow-cola';
import {
  LIMITES, clasificarFalla, clasificarFallaDelNavegador, VARIANTES_MEDIA,
  KEY_VARIANTE_VIDEO, type MotivoFalla,
} from '@/lib/flow-protocolo';
import { EXTENSION_VERSION } from '@/lib/extension-version';
import { conPlantillaDeFabrica } from '@/lib/plantilla-fabrica';

export const dynamic = 'force-dynamic';

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const ESTADOS: EstadoPuente[] = ['sin_conectar', 'listo', 'sin_sesion', 'marcada'];
const MOTIVOS: MotivoFalla[] = ['contenido', 'cuota', 'modelo', 'medio_vencido', 'sesion_marcada', 'transitorio', 'sin_sesion', 'puente_dormido'];

type ResultadoEntrante = {
  id: number;
  ok: boolean;
  /** El status HTTP que devolvió Google, cuando el pedido llegó a viajar. */
  status?: number;
  data?: unknown;
  motivo?: string;
  error?: string;
  reintentable?: boolean;
};

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'cuerpo inválido' }, { status: 400 });
  }

  // El token es la credencial. Se acepta por header (lo normal) o en el cuerpo,
  // para que la extensión pueda mandarlo sin pelear con CORS de headers custom.
  const token = str(req.headers.get('x-flow-token')) || str(body.token);
  const ws = await workspaceDeToken(token);
  // 404 y no 403: un 403 confirmaría que el token existe pero no alcanza, y eso
  // ya es contar algo. A quien no le corresponde, no existe.
  if (ws == null) {
    return NextResponse.json({ ok: false, error: 'no encontrado' }, { status: 404 });
  }

  // ── 1. Lo que el puente trae de vuelta ────────────────────────────────────
  const resultados = Array.isArray(body.resultados) ? (body.resultados as ResultadoEntrante[]) : [];
  for (const r of resultados.slice(0, 20)) {
    const id = Number(r?.id);
    if (!Number.isInteger(id) || id <= 0) continue;

    if (r.ok) {
      await resolver(ws, id, r.data ?? null);
      continue;
    }
    // Quién clasifica una falla: el SERVER, en tres pasos y en este orden. El
    // navegador nunca decide cuántas veces le pegamos a Google — su `catch` manda
    // «transitorio, reintentable» para todo lo que no reconoce, y eso ya costó 25
    // pedidos automáticos contra la página de bloqueo de Google.
    //
    //   1. ¿Es una falla del PUENTE? (la pestaña no responde, el captcha no vino)
    //   2. ¿Llegó a Google y volvió con un status de error? → clasificarFalla
    //   3. Recién ahí, la etiqueta del navegador, y solo si está en el enum.
    const delNavegador = clasificarFallaDelNavegador(str(r.error));
    if (delNavegador) {
      // ⚠️ El mensaje traducido NO puede reemplazar al original — la misma regla
      // que ya cumple la rama de al lado. El crudo de Chrome es la ÚNICA
      // evidencia que distingue un content script huérfano de una pestaña que el
      // navegador descartó, y sin él los dos se diagnostican igual.
      await fallar(
        ws, id, delNavegador.motivo,
        `${delNavegador.error}
[crudo] ${str(r.error).slice(0, 300)}`,
        delNavegador.reintentable,
      );
      continue;
    }

    // Si el pedido LLEGÓ a Google, lo clasifica el mismo módulo que clasifica el
    // camino server-side. Antes no pasaba por acá: el navegador no manda `motivo`
    // en esta rama, así que un 429 o la página de bloqueo caían en el
    // «transitorio» de más abajo y se reintentaban cinco veces. Es la misma regla
    // que ya está escrita para el resto del repo — el guard va en el choke point,
    // no en cada llamador.
    const status = Number(r.status);
    if (Number.isInteger(status) && status >= 400) {
      // El cuerpo va como venga: si Google contestó HTML en vez de JSON, el texto
      // crudo es justamente lo que delata el bloqueo.
      const f = clasificarFalla(status, r.data ?? str(r.error));
      // ⚠️ El mensaje traducido NO puede reemplazar al original. Traducir y tirar
      // el crudo deja al que investiga con la INTERPRETACIÓN de quien escribió el
      // clasificador y sin la evidencia — y si la interpretación es la equivocada,
      // no hay forma de saberlo. Ya costó dos vueltas hoy: el error decía «Google
      // bloqueó la sesión» sobre un caso donde la misma persona generaba videos a
      // mano sin problema.
      // 200 caracteres cortaban EXACTAMENTE donde empieza `details`, que es
      // donde vive el `reason` — el único campo que distingue «esta cuenta está
      // quemada» de «este token no servía». El comentario de arriba pedía guardar
      // la evidencia y el límite se la comía: una regla escrita que el código no
      // cumplía. 1.500 alcanza para el error entero de Google.
      const crudo = `HTTP ${status} · ${str(r.error).slice(0, 1500)}`;
      await fallar(ws, id, f.motivo, `${f.error}\n[crudo] ${crudo}`, f.reintentable);
      continue;
    }
    const motivo = MOTIVOS.includes(str(r.motivo) as MotivoFalla) ? (str(r.motivo) as MotivoFalla) : 'transitorio';
    await fallar(ws, id, motivo, str(r.error) || 'sin detalle', r.reintentable !== false);
  }

  // ── 2. El puente reporta que está vivo ────────────────────────────────────
  const estado = ESTADOS.includes(str(body.estado) as EstadoPuente) ? (str(body.estado) as EstadoPuente) : 'listo';
  const detalle = str(body.detalle);
  await marcarVisto(ws, str(body.projectId), estado, detalle, str(body.version), str(body.accionesCaptcha));

  // ── La cara se APRENDE, no se consulta ───────────────────────────────────
  //
  // Las plantillas que reporta el espejo viven en la MEMORIA de la pestaña de
  // Flow: recargarla las borra. Y de ahí salía el `mediaId` de la foto del
  // cliente, así que un F5 —o recargar la extensión, que obliga a uno— dejaba a
  // la tab sin poder generar hasta que la persona hiciera otro video a mano.
  //
  // Así que la primera vez que pasa por acá se GUARDA. Un dato que se descubre
  // una vez y no cambia no puede depender de que una pestaña siga abierta.
  //
  // No se pisa con vacío: un latido sin plantillas —el normal después de un F5—
  // no puede borrar lo que ya se sabía.
  if (detalle) {
    const cara = mediaIdDeReferencia(detalle);
    if (cara) await runWithWorkspace(ws, () => setSetting(KEY_CARA_FLOW, cara));
  }

  // ── Y LAS PLANTILLAS TAMBIÉN SE APRENDEN ─────────────────────────────────
  //
  // Lo de arriba guardaba UN dato aprendido de las plantillas. Esto guarda las
  // plantillas, que es de dónde salía ese dato y todo lo demás.
  //
  // El dueño lo preguntó así: «¿por qué me pides constantemente generar imágenes
  // o videos? ¿no te basta la data de todas las veces que lo hemos generado?».
  // No bastaba, y no era una limitación: la copia del pedido de Flow vivía sólo en
  // el navegador —la memoria de la pestaña, que muere con el F5, y
  // `chrome.storage.local`, que se va con el perfil—. De este lado no quedaba
  // nada, así que cada olvido del navegador volvía a pedirle que generara algo a
  // mano sobre algo que ya había hecho decenas de veces.
  //
  // ⚠️ Se FUNDE, no se pisa. Un latido puede traer menos clases que el anterior
  // (la pestaña se recargó recién), y pisar con eso sería borrar lo aprendido
  // justo cuando más falta hace. Y una plantilla SIN CUERPO nunca le gana a una
  // completa: esa cáscara no se distingue de una sana hasta que Google contesta
  // 400.
  // ⚠️ Y SOLO LAS DE ESTE PROYECTO DE FLOW.
  //
  // El respaldo de plantillas de la extensión vive bajo UNA clave global de
  // `chrome.storage.local`, sin token ni workspace adentro. Emparejar el mismo
  // navegador con otro cliente pisa el `token` y NO toca ese respaldo, así que
  // este latido puede traer plantillas aprendidas mientras el navegador estaba
  // emparejado con OTRO workspace — con el projectId de Flow de aquel cliente, el
  // cuerpo de su generación y el mediaId de su cara. Sin este filtro se
  // persistían acá, y en el latido siguiente bajaban al navegador real de este
  // cliente como «faltantes».
  //
  // El arreglo de raíz está en la extensión (la clave lleva el token desde la
  // 0.37.0). Éste es el lado que no depende de que el cliente actualice: el
  // `projectId` que el navegador está mirando viaja en ESTE mismo request.
  const { quedan: llegan, ajenas } = soloDelProyecto(
    sanearPlantillas(body.plantillas),
    str(body.projectId),
  );
  if (ajenas.length) {
    // Se REGISTRA, no se descarta en silencio: una política que rechaza sin dejar
    // rastro hace indistinguibles «no llegó» de «lo tiramos nosotros».
    console.warn(
      `[flow] ws ${ws}: ${ajenas.length} plantillas de otro proyecto de Flow, descartadas ` +
      `(${ajenas.map((p) => p.clase).join(', ')})`,
    );
  }
  let guardadas: PlantillaEspejo[] = [];
  if (llegan.length) {
    guardadas = await runWithWorkspace(ws, async () => {
      const previas = sanearPlantillas(JSON.parse((await getSetting(KEY_PLANTILLAS)) || '[]'));
      const fundidas = fundirPlantillas(previas, llegan);
      await setSetting(KEY_PLANTILLAS, JSON.stringify(fundidas));
      return fundidas;
    });
  } else {
    guardadas = await runWithWorkspace(ws, async () =>
      sanearPlantillas(JSON.parse((await getSetting(KEY_PLANTILLAS)) || '[]')));
  }

  // ── LO QUE FLOW YA RECIBIÓ ────────────────────────────────────────────────
  //
  // Se guarda para poder contestar UNA pregunta que hoy no tiene respuesta: de
  // dónde sale el ENLACE de un video. La consulta de estado dice que el clip está
  // hecho —con su tamaño en bytes— y no trae ninguna url; el candidato es lo que
  // la grilla del proyecto ya listó, y eso la página lo pidió por GET, así que el
  // espejo tiene la respuesta guardada sin gastar un pedido nuestro.
  //
  // Es diagnóstico acotado y con fecha: se pisa entero en cada latido y no se
  // acumula. No lleva credenciales —son respuestas, no pedidos— pero se topea
  // igual, porque lo que se guarda sin tope crece hasta que alguien lo descubre.
  if (body.respuestas && typeof body.respuestas === 'object') {
    const rec = body.respuestas as Record<string, unknown>;
    const out: Record<string, string> = {};
    let total = 0;
    for (const [k, v] of Object.entries(rec)) {
      if (typeof v !== 'string') continue;
      // ⚠️ SOLO LO QUE ESTE LADO RECONOCE. Es la mitad que protege contra una
      // extensión VIEJA, que es la que sigue instalada en los navegadores de la
      // gente: si el cliente anterior dejó su `__sonda` en el storage del
      // navegador —con su mediaId y sus urls firmadas— el latido del cliente
      // nuevo lo sube igual, y el filtro de allá no existe hasta que actualicen.
      //
      // La lista es la de las clases del protocolo más las dos de diagnóstico.
      // Lo que no está no se guarda: un campo que nadie sabe leer no puede ser
      // más que ruido, y a veces es el dato de otro.
      if (!seGuardaLaRespuesta(k)) continue;
      // ⚠️ Las claves de diagnostico propias llevan MAS presupuesto. Con 1400
      // parejos, la lista de fuentes del DOM llegaba cortada en la mitad de la
      // grilla y el dato que se fue a buscar —el <video> del reproductor— no
      // entraba nunca. Se pidio dos veces y las dos llego truncada.
      const tope = k.startsWith('__') ? 6000 : 1400;
      const t = v.slice(0, tope);
      if (total + t.length > 40_000) break;
      total += t.length;
      out[k.slice(0, 80)] = t;
    }
    if (Object.keys(out).length) {
      await runWithWorkspace(ws, () => setSetting('flow.respuestas', JSON.stringify(out)));
    }
  }

  // ── ¿HAY QUE SONDEAR? ─────────────────────────────────────────────────────
  // Sólo mientras no sepamos la respuesta. Es una pregunta que se contesta una vez
  // y no cambia, así que en cuanto haya resultado deja de pedirse para siempre.
  // ⚠️ Y EL LAZO SE CIERRA ACÁ, QUE ES LO QUE NO PASABA.
  //
  // `KEY_VARIANTE_VIDEO` no la escribía NADIE en todo el repo, así que
  // `yaSondeado` era falsy para siempre: la sonda se pedía en CADA latido, o sea
  // cada quince segundos, mientras hubiera un `estado_clips` en la cola. Cada
  // corrida son ocho `<video>` y tres `fetch` contra la sesión de Google del
  // cliente — por una pregunta que se contesta una vez y no cambia.
  //
  // No es sólo desperdicio: es tráfico automatizado contra la sesión de alguien,
  // repetido sin fin, y el 01/09/2026 una clienta se comió un
  // `PUBLIC_ERROR_UNUSUAL_ACTIVITY` de Google. No se puede afirmar que fue esto
  // —hay varias fuentes de tráfico—, pero es la única que corre para siempre por
  // un control muerto, y eso alcanza para apagarla.
  await cerrarSonda(ws);

  let sonda: { mediaId: string; variantes: string[] } | null = null;
  const yaSondeado = await runWithWorkspace(ws, () => getSetting(KEY_VARIANTE_VIDEO));
  if (!yaSondeado) {
    const db2 = await runWithWorkspace(ws, () => getTenantDb());
    const { data: ult } = await db2
      .from('flow_trabajos')
      .select('pedido')
      .eq('tipo', 'estado_clips')
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();
    const ped = (ult?.pedido && typeof ult.pedido === 'object' ? ult.pedido : {}) as Record<string, unknown>;
    const mediaId = str(ped.operacion);
    if (mediaId) sonda = { mediaId, variantes: [...VARIANTES_MEDIA] };
  }

  // ⚠️ Y SI NUNCA GENERÓ UNA IMAGEN, SE LE DA LA DE FÁBRICA.
  //
  // Sin esto, un cliente nuevo no puede generar hasta hacer una imagen a mano en
  // Flow con la pestaña abierta. Le costó la tarde a una clienta, y el dueño lo
  // cortó con la pregunta correcta: «¿por qué hacemos eso cada vez, si tú ya
  // sabes cómo es?». La FORMA del pedido es universal; lo único suyo es el
  // `projectId`, y ese viaja en este mismo latido.
  //
  // Sólo se suma si le FALTA: una plantilla medida describe lo que Google acepta
  // hoy en la cuenta de ESE cliente, y la de fábrica lo que aceptaba cuando se
  // copió. Pisar una medida con ésta sería cambiar un hecho por un recuerdo.
  //
  // Se GUARDA además de mandarse, con `cuando: 0`: guardarla es lo que hace que
  // `caraParcheable()` —que mira lo persistido— sepa que hay dónde poner la cara,
  // y el cero hace que el primer pedido real la desplace sola.
  // ⚠️ EL `projectId` TAMBIEN SE DERIVA DE LO QUE YA HAY GUARDADO.
  //
  // Las tres fabricas arrancan con `if (!ES_UUID.test(proj)) return null`, y el
  // navegador aprende el projectId de UN solo lugar: la url de las llamadas de
  // imagen (`/v1/projects/<id>/...`). Un cliente que todavia no hizo ninguna
  // llega con `projectId: ''`, no se le suma ninguna fabrica, y vuelve a salirle
  // «Abre Flow, genera UNO a mano» — o sea justo el paso manual que las fabricas
  // vienen a borrar, degradando EN SILENCIO: sin error y sin log.
  //
  // `proyectoDePlantilla` ya sabe sacarlo de la url o del `clientContext.projectId`
  // del cuerpo, y las plantillas de video lo traen ahi. Con una sola guardada ya
  // hay de donde. No inventa nada: si no hay ninguna, sigue vacio y las fabricas
  // se abstienen, que es lo correcto.
  const proyecto: string = str(body.projectId)
    || guardadas.map(proyectoDePlantilla).find((x) => !!x) || '';
  const conFabrica = conPlantillaDeFabrica(guardadas, proyecto);
  if (conFabrica.length !== guardadas.length) {
    await runWithWorkspace(ws, () => setSetting(KEY_PLANTILLAS, JSON.stringify(conFabrica)));
    guardadas = conFabrica;
  }

  // Lo que el navegador NO tiene y nosotros sí. Sólo eso vuelve: mandar las diez
  // en cada latido serían 150 KB cada quince segundos por nada.
  const clasesQueTiene = Array.isArray(body.clases) ? body.clases.map(String) : [];
  // Las operaciones que el navegador ya sabe. Una extension vieja no las manda y el
  // servidor degrada al comportamiento anterior, que es lo correcto: no saber cuales
  // tiene no autoriza a decidir por el.
  const opsQueTiene = Array.isArray(body.ops) ? body.ops.map(String) : [];

  // El diagnostico del navegador, saneado. Se guarda SIEMPRE que venga: es el dato
  // que hasta hoy no existia, y el unico que permite contestar por que un puente no
  // aprende sin pedirle una captura de pantalla a la persona.
  //
  // Si no viene —una extension vieja— NO se pisa lo anterior con vacio: no saber es
  // distinto de no tener, y un diagnostico vacio se leeria como un puente mudo.
  const diag = sanearDiagnostico(body.diagnostico);
  if (diag) {
    try {
      await runWithWorkspace(ws, () => setSetting(KEY_DIAGNOSTICO, JSON.stringify(diag)));
    } catch {
      // Un diagnostico que no se pudo guardar no puede tumbar el latido: seria
      // convertir una falta de informacion en una falta de servicio.
    }
  }
  const plantillasFaltantes = clasesQueTiene.length
    ? faltantes(guardadas, clasesQueTiene, opsQueTiene)
    : [];

  // ── 3. Y se lleva lo que sigue ────────────────────────────────────────────
  // `tomarTrabajos` devuelve vacío si la sesión está MARCADA: ahí hay que parar,
  // no seguir pidiendo. El puente lo ve por `pausado` y espacia el polling.
  const cuantos = Math.max(1, Math.min(Number(body.cuantos) || 1, LIMITES.concurrencia));
  // ⚠️ `tomarTrabajos` es el que sabe si el puente está MARCADO: lo lee de la base
  // y devuelve vacío. Preguntarle acá al `estado` que reportó la extensión sería
  // preguntarle al que no puede saberlo — la extensión solo dice `listo` o
  // `sin_sesion`, nunca `marcada`.
  const trabajos = estado === 'sin_sesion' ? [] : await tomarTrabajos(ws, cuantos);
  const guardado = await estadoGuardado(ws);

  return NextResponse.json({
    ok: true,
    trabajos,
    // El ritmo lo dicta el SERVER, no la extensión. Es lo que reemplaza al
    // simulador de actividad humana de FlowKit: si el pulso se mantiene en el de
    // una persona, no hay nada que disimular. Que el número viaje en cada
    // respuesta permite bajarlo sin que el cliente actualice la extensión.
    cooldownMs: LIMITES.cooldownMs,
    // ⚠️ QUE VARIANTE DE LA URL TRAE EL VIDEO. Se pregunta UNA vez y se guarda.
    //
    // `getMediaUrlRedirect?name=<id>` devuelve el POSTER de un video, no el video:
    // medido por el sintoma exacto que reporto el dueno —«me trajo un video, pero
    // es de 0 segundos»—, que es lo que hace un <video> cuando le das una imagen.
    // La variante correcta vive en un enum (`mediaUrlType`) que no esta
    // documentado en ningun lado que tengamos.
    //
    // Probar valores contra produccion de a uno, esperando un reporte entre cada
    // intento, es el bucle que costo esta noche. Asi que se manda la lista entera y
    // el NAVEGADOR contesta: un <video> suelto por candidato, y el que devuelve
    // `duration > 0` es el bueno. Es la unica fuente que no puede equivocarse.
    ...(sonda ? { sonda } : {}),
    // Las que le faltan al navegador. Con esto, un F5 —o un perfil nuevo, o
    // reinstalar la extensión— deja de costar «generá uno a mano».
    ...(plantillasFaltantes.length ? { plantillas: plantillasFaltantes } : {}),
    // Sale de lo GUARDADO y no del auto-reporte: `estado` lo escribe la extensión,
    // que nunca dice `marcada`, así que esto era siempre false y el puente jamás
    // se enteraba de que había que parar.
    pausado: guardado === 'marcada',
    // ⚠️ LA VERSIÓN QUE DEBERÍA ESTAR CORRIENDO.
    //
    // El latido ya decía la suya desde hace días; lo que faltaba era la vuelta.
    // Sin esto la extensión no tiene forma de saber que quedó vieja, y el único
    // que se entera es el que mira la pantalla — o sea, nadie, hasta que algo
    // falla por una razón que no se parece a «tu extensión es de hace tres
    // horas».
    //
    // Con esto, una instalación DESCOMPRIMIDA se reinicia sola y vuelve leyendo
    // los archivos nuevos. Es la diferencia entre que actualizar sea un trámite y
    // que no exista.
    versionEsperada: EXTENSION_VERSION,
  });
}

/**
 * Da la sonda por terminada cuando ya contestó, o cuando dejó de tener sentido.
 *
 * ⚠️ LA GUARDA DE UN SOLO INTENTO TIENE QUE CONTAR LOS INTENTOS QUE SIRVIERON, y
 * también los que NO. Si sólo se cerrara al encontrar una variante buena, un
 * cliente donde ninguna funciona la seguiría corriendo para siempre — que es
 * exactamente el caso peor, porque es el que más tráfico genera y el que menos
 * puede aprender.
 *
 * Por eso hay dos salidas: una respuesta útil (se guarda la variante) o
 * `INTENTOS_SONDA` corridas sin ninguna (se guarda `'ninguna'`). Las dos escriben
 * `KEY_VARIANTE_VIDEO`, que es lo que apaga el pedido.
 */
const INTENTOS_SONDA = 12;
const KEY_SONDA_INTENTOS = 'flow.sonda.intentos';

async function cerrarSonda(ws: number): Promise<void> {
  try {
    const ya = await runWithWorkspace(ws, () => getSetting(KEY_VARIANTE_VIDEO));
    if (ya) return;

    // ¿Contestó? El resultado viaja con las respuestas, bajo `__sonda`.
    const crudo = await runWithWorkspace(ws, () => getSetting('flow.respuestas'));
    let variante = '';
    try {
      const resp = JSON.parse(crudo || '{}') as Record<string, unknown>;
      const s = JSON.parse(String(resp.__sonda || '{}')) as { r?: unknown };
      // `r` es el mapa variante → resultado. Se busca la primera que haya
      // devuelto un video de verdad: un `bytes` que no sea de un póster.
      const r = (s.r && typeof s.r === 'object' ? s.r : {}) as Record<string, { estado?: unknown; bytes?: unknown; tipo?: unknown }>;
      for (const v of VARIANTES_MEDIA) {
        const x = r[v || '(sin variante)'] ?? r[v];
        if (!x || typeof x !== 'object') continue;
        const tipo = String(x.tipo ?? '');
        const bytes = Number(x.bytes ?? 0);
        // ⚠️ EL TIPO MANDA SOBRE EL TAMAÑO. Un póster de un video largo pesa más
        // que un clip corto, así que decidir por bytes elegiría la imagen. Lo que
        // separa las dos es el `content-type`.
        if (tipo.startsWith('video/') && bytes > 0) { variante = v; break; }
      }
    } catch { /* sin respuesta legible: cuenta como intento */ }

    if (variante !== '') {
      await runWithWorkspace(ws, () => setSetting(KEY_VARIANTE_VIDEO, variante));
      return;
    }

    const n = Number(await runWithWorkspace(ws, () => getSetting(KEY_SONDA_INTENTOS))) || 0;
    if (n + 1 >= INTENTOS_SONDA) {
      // `'ninguna'` y no un vacío: un string vacío se lee como «todavía no» y la
      // volvería a encender. Lo que se guarda es la RESPUESTA, y la respuesta es
      // que ninguna variante sirvió en este navegador.
      await runWithWorkspace(ws, () => setSetting(KEY_VARIANTE_VIDEO, 'ninguna'));
      return;
    }
    await runWithWorkspace(ws, () => setSetting(KEY_SONDA_INTENTOS, String(n + 1)));
  } catch (e) {
    // Cerrar una sonda nunca puede romper un latido: el latido es lo que hace
    // andar al cliente y esto es instrumentación.
    console.error('[puente] no se pudo cerrar la sonda:', e instanceof Error ? e.message : e);
  }
}
