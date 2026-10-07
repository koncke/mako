// =============================================================================
// POST /api/track/optin — el formulario de una landing entra al CRM
// =============================================================================
// El caso: una clienta tiene una landing con un formulario de opt-in y después
// contacta a esa gente por WhatsApp. Los registros no llegaban al CRM porque las
// únicas entradas cableadas eran el formulario instantáneo de Meta y una agenda
// de Calendly — las de un funnel de VSL con llamadas, que no es su negocio.
//
// AUTH: el mismo `landing_token` del beacon (`/api/track/vsl`), en el body. No es
// un secreto —viaja en el HTML de una página pública, como cualquier pixel— y no
// autoriza a leer nada: solo IDENTIFICA el workspace. El ruteo es fail-closed
// (`wsPorIdentificadorEstricto`): sin mapeo no se toca un dato.
//
// ⚠️ NO CREA EL LEAD: DEJA UNA PROPUESTA. Es la regla del producto —un canal
// PROPONE, una persona confirma— y acá cubre justo el riesgo de un endpoint
// abierto: un formulario con un campo raro, un bot o un doble submit se
// convierten en algo para revisar, nunca en un lead corrupto adentro del CRM.
//
// ⚠️ Y NO INGESTA SI EL NEGOCIO NO LO DECLARÓ. La puerta es `entradas` del
// funnel del workspace (`funnels.data.entradas`, que se configura en
// /funnel): si ese cliente no declaró que sus leads entran por una landing, el
// opt-in se ACEPTA y se ignora. Así el mismo snippet se le puede dar a todos sin
// que a nadie se le empiecen a llenar el CRM de contactos que no esperaba — la
// política la decide el server, y el código pegado en la página no decide nada.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { emitirDelCatalogo } from '@/lib/avisos';
import { linkApp, APP_BASE_URL } from '@/lib/app-url';
import { crearPropuesta } from '@/lib/propuestas';
import { LANDING_SERVICIO } from '@/lib/landing-token';
import { wsPorIdentificadorEstricto } from '@/lib/webhook-routing';
import { anotarFalloDeRuteo } from '@/lib/webhook-fallo-ruteo';
import { conReintentoTransitorio } from '@/lib/webhook-ruteo-huella';
import { createLead, duplicadosDeLead } from '@/lib/leads';
import { conAtribucion, hayAtribucion } from '@/lib/atribucion-url';
import { getFunnelDefault, idDelFunnelDefault } from '@/lib/funnels';
import { agregarAProducto } from '@/lib/lead-funnel';
import { casaParaEscribir, casaReal } from '@/lib/lead-funnel-reglas';
import { AUTOR_SISTEMA } from '@/lib/etapa-historial';
import { normalizarUrl } from '@/lib/landing-paginas';
import { funnelsDeLanding } from '@/lib/landing-funnel';
import { funnelDeCampana } from '@/lib/campana-funnel';
import { textoDuplicado } from '@/lib/leads-duplicados';
import { wsEnContexto, getTenantDb, runWithWorkspace } from '@/lib/workspace';
import { integracionConectada } from '@/lib/credenciales';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// El snippet corre en el dominio del cliente (Lovable, Framer, WordPress…), así
// que el navegador exige CORS. Mismo criterio que el beacon: abierto, porque el
// token ya identifica y la ruta no devuelve nada de nadie.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
} as const;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

const txt = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s.slice(0, 300) : null;
};

/**
 * Una URL no es un campo de formulario, y el tope de 300 le comía la atribución.
 *
 * ⚠️ MEDIDO EL 27/09/2026. Meta arma la URL de destino con el `fbclid` PRIMERO
 * (150-250 caracteres) y los `utm_*` DESPUÉS, así que `utm_content=` —donde viaja el
 * id del anuncio— arranca alrededor del carácter 298 y su valor de 18 dígitos queda
 * entero afuera del corte. Simulado sobre las 822 visitas de un cliente que traen
 * `utm_content`: **427 lo perdían completo (52%)**, y a nivel lead 8 de 18.
 *
 * Lo delataba que el MISMO dato estuviera entero en `landing_visits`: ese camino
 * guarda la URL con tope 500. Una URL mutilada por una ruta y completa por la otra.
 *
 * Y hay un caso peor que perderlo: cuando el corte cae ADENTRO del número, el ad_id
 * truncado se guarda y el deep-link manda al anuncio EQUIVOCADO, con la confianza de
 * un dato bueno. Un null dice «no sé»; eso dice otra cosa.
 */
const urlTxt = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s.slice(0, 2000) : null;
};

const ok = (extra: Record<string, unknown>) => NextResponse.json({ ok: true, ...extra }, { headers: CORS });

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* sin cuerpo */ }

  const token = txt(body.token) ?? txt(body.landing_token);
  if (!token) return NextResponse.json({ ok: false, error: 'falta el token de la landing' }, { status: 400, headers: CORS });

  // ⚠️ «NO PUDE LEER» NO ES «TOKEN DESCONOCIDO» (07/10/2026). Con `wsPorIdentificador`, que no
  // lee el `error` de supabase-js, la base caída daba null y el contacto de un visitante caía en
  // «token desconocido» → 200 y perdido, con un log que culpaba a la configuración. Y nadie lo
  // reintenta: el snippet lo manda UNA vez, con `keepalive` y sin mirar la respuesta (ver
  // `mandarOptin` en lib/landing-token.ts). Por eso la lectura se reintenta ACÁ, adentro del
  // pedido (un corte de la base suele durar segundos), y si igual no se puede, queda anotada en
  // `webhooks.fallos_ruteo` —sin datos de la persona: el token y el motivo— y va 503.
  let ws: number | null;
  try {
    ws = await conReintentoTransitorio(() => wsPorIdentificadorEstricto(LANDING_SERVICIO, token));
  } catch (err) {
    const { transitorio, mensaje } = await anotarFalloDeRuteo('landing', err, token);
    console.error(`[track:optin] no pude leer de quién es el token (la base no contestó): el opt-in se perdió — ${mensaje}`);
    return NextResponse.json({ ok: false, error: 'ruteo', reintentar: transitorio }, { status: 503, headers: CORS });
  }
  // Fail-closed: un token que no mapea a nada no cae al dueño ni a ningún lado.
  if (ws == null) {
    console.warn(`[track:optin] token sin workspace — ignorado`);
    return ok({ ignorado: 'token desconocido' });
  }

  // La puerta del negocio. 200 y no 403: la página de un cliente que todavía no
  // declaró la landing como entrada no tiene por qué mostrar un error a SU
  // visitante — el formulario suyo tiene que seguir funcionando igual.
  // `getFunnelDefault()` es el MISMO lector que usa /funnel: la puerta se lee de
  // donde el cliente la configura, no de una copia. DEFAULT: la puerta es del
  // NEGOCIO — el lead todavía no existe cuando esto se evalúa.
  const entradas = await runWithWorkspace(ws, () => getFunnelDefault())
    .then((f) => f.entradas as string[])
    .catch(() => [] as string[]);
  // ⚠️⚠️ CONECTAR UNA AGENDA ES DECLARAR LA ENTRADA. No hace falta pedirlo dos veces.
  //
  // El caso, del 24/08/2026, y el dueño lo dijo con todas las letras: «¿cómo que
  // falta activar la landing? ¿qué sentido tiene?». Ninguno. Un cliente conectó
  // Cal.com —pegó el webhook, inventó el secret, cargó el tipo de evento—, alguien
  // reservó, y la pantalla le contestó que el contacto no entraba porque le faltaba
  // marcar una casilla llamada «landing» en OTRA pantalla. Encima el nombre miente:
  // esa reserva no vino de su landing, vino de su AGENDA.
  //
  // La puerta del funnel existe porque el Pixel se le da a TODOS por defecto: sin
  // ella, a cualquiera que lo pegue se le empieza a llenar el CRM de contactos que
  // no pidió. Ese razonamiento NO aplica a una integración que el negocio conectó a
  // propósito: conectarla ES el acto de declararla. Pedir además la casilla es
  // burocracia que solo existe por cómo está partido el código.
  const deAgendaConectada = txt(body.origen_captura) === 'agenda'
    && await runWithWorkspace(ws, async () =>
      (await integracionConectada('calcom')) || (await integracionConectada('calendly')));

  // ⚠️⚠️ Y PEGAR EL PIXEL TAMBIEN ES DECLARAR LA ENTRADA. Lo decidio MARTIN el
  // 04/10/2026, textual: «cargar el pixel en una landing ya deberia contar».
  //
  // Es el MISMO razonamiento del parrafo de arriba, que hasta hoy solo valia para
  // las agendas: la casilla del funnel existia porque el Pixel se le entrega a
  // TODOS por defecto, asi que cualquiera que lo pegara podia empezar a llenar un
  // CRM que nadie pidio. Eso deja de ser cierto cuando el acto de pegarlo es
  // deliberado — y lo es: el codigo se copia de /integraciones, de una pagina que
  // la persona eligio, y despues hay que publicar el sitio. Pedir ademas una
  // casilla en otra pantalla es la burocracia que el dueno ya rechazo una vez.
  //
  // DE QUE DA FE: la PAGINA. El snippet manda `pagina: location.href` en cada
  // opt-in desde la v2, asi que una URL valida es la prueba de que esto salio de
  // una pagina web real con el codigo adentro. Lo que NO la trae es un POST pelado
  // con el token copiado del HTML —un bot, un curl, un formulario escrito a mano—
  // y de eso no se puede afirmar que el negocio pego nada: cae a la rama de abajo,
  // que descarta DEJANDO RASTRO.
  const paginaOptin = normalizarUrl(urlTxt(body.pagina) ?? '');
  const delPixelEnUnaPagina = paginaOptin != null;

  if (!entradas.includes('landing') && !deAgendaConectada && !delPixelEnUnaPagina) {
    // ⚠️⚠️ DESCARTAR EN SILENCIO ES PERDER UN LEAD SIN QUE NADIE SE ENTERE.
    //
    // Esta rama devolvía `ok:true` y se iba: ni una fila, ni un log, ni un
    // contador. El 24/08/2026 un cliente se agendó en su propia landing durante
    // una prueba EN VIVO, y la pantalla le contestó «no aplica» mientras el
    // lead se caía por acá. No había forma de saberlo — ni mirando la base, ni
    // mirando los logs, ni corriendo la prueba otra vez.
    //
    // ⚠️ QUE CAE ACA DESDE EL 04/10/2026. Ya no es «no marco la casilla»: pegar
    // el Pixel declara la entrada (ver arriba), asi que lo unico que sigue
    // descartandose es un opt-in que NO viene de una pagina —sin `pagina`, o con
    // algo que no es una URL— y que tampoco es de una agenda conectada. O sea un
    // POST con el token suelto, que es exactamente lo que el token no autoriza.
    //
    // La huella se queda igual, y por el mismo motivo por el que se escribio: sin
    // ella «no llego» y «lo tiramos nosotros» se ven identicos, y el que
    // investiga llega a la conclusion equivocada las tres veces.
    //   · un evento, que el probador ya sabe leer y filtrar por marcador;
    //   · un log, para poder contarlos sin abrir la base.
    //
    // ⚠️ SIN NOMBRE, MAIL NI TELÉFONO. Lo que se guarda es que PASÓ, no quién:
    // una tabla de eventos no es lugar para datos de una persona que el negocio
    // decidió no ingestar, y el motivo del bloqueo no necesita saber quién era.
    try {
      await runWithWorkspace(ws, async () => {
        const db = await getTenantDb();
        await db.from('vsl_events').insert({
          visitor_id: txt(body.visitor_id) ?? 'desconocido',
          event: 'optin_bloqueado',
          tipo_evento: 'optin_bloqueado',
          // De donde decia venir, para poder contar los bloqueos por tipo. Un
          // opt-in sin pagina es el caso nuevo y se nombra: `sin_pagina`.
          detalle: txt(body.origen_captura) === 'agenda' ? 'agenda' : 'sin_pagina',
          prueba: txt(body.prueba),
          landing_url: txt(body.pagina),
        });
      });
    } catch (e) {
      // Nunca romper la página del cliente por no poder anotar el bloqueo.
      console.error(`[track:optin] no se pudo anotar el bloqueo: ${e instanceof Error ? e.message : e}`);
    }
    console.warn(`[track:optin] ws ${ws}: opt-in BLOQUEADO — no vino de ninguna página y el negocio no declaró esta entrada`);
    return ok({ ignorado: 'este opt-in no vino de una página con el Pixel instalado' });
  }

  const nombre = txt(body.nombre) ?? txt(body.name) ?? txt(body.nombre_completo);
  const email = (txt(body.email) ?? txt(body.correo))?.toLowerCase() ?? null;
  const telefono = txt(body.telefono) ?? txt(body.phone) ?? txt(body.whatsapp) ?? txt(body.celular);

  // Sin forma de contacto no hay nada que trabajar: el lead nace muerto y el
  // dueño no puede hacer nada con esa tarjeta. Se rechaza acá y no en la
  // revisión, para no llenarle la bandeja de propuestas inservibles.
  if (!email && !telefono) {
    return NextResponse.json(
      { ok: false, error: 'hace falta al menos email o teléfono' },
      { status: 400, headers: CORS },
    );
  }

  // Idempotencia por `ref`. Un formulario dispara dos veces con mala conexión y
  // un submit se reintenta; sin esto quedan dos tarjetas de la misma persona y
  // quien revisa confirma un duplicado creyendo que son dos.
  // ⚠️ LA LLAVE SE NORMALIZA. Era el teléfono CRUDO del input, así que la MISMA
  // persona escribiendo «998 136 1529» y «9981361529» creaba dos propuestas —
  // justo lo que la idempotencia venía a evitar. Se queda con los dígitos y con
  // los últimos 10: el mismo número con y sin código de país es el mismo número.
  const clave = email ?? (telefono ? telefono.replace(/\D/g, '').slice(-10) : null);
  const ref = txt(body.ref) ?? `landing:${clave}`;

  // ═══════════════════════════════════════════════════════════════════════════
  // ENTRA SOLO, salvo que parezca un duplicado.
  // ═══════════════════════════════════════════════════════════════════════════
  // El pedido: «no tiene sentido que le hagamos Revisar 1 por 1 a los leads que
  // entran desde la landing, eso se debería cargar solo siempre». Tiene razón —
  // una automatización que exige confirmar cada caso no automatiza nada, y la
  // prueba está en que ocho leads reales se quedaron sin ver esperando ese click.
  //
  // ⚠️ Y la regla de la casa —«un canal propone, una persona confirma»— NO se
  // rompe: se acota a donde sirve. El riesgo que esa regla cubre es un dato que
  // llega mal y ensucia el CRM. Un formulario que la propia persona completó es
  // el dato MÁS confiable que hay, mucho más que uno transcripto por un modelo.
  // Lo que sí necesita ojo humano es el CHOQUE: dos contactos que parecen el
  // mismo. Ahí la máquina no puede decidir sin perder información — fundir es
  // irreversible y duplicar ensucia — así que ahí, y solo ahí, queda la propuesta.
  // ⚠️ DE DÓNDE VINO. El snippet no manda los UTM (los manda desde la v15) y la ruta
  // los leía igual de `body.utm_*`: cuatro campos que nunca llegaban, y por eso los
  // 21 leads de Código Inmobiliario están los 21 sin origen. Se rellenan con lo que
  // diga la URL de aterrizaje, que YA viaja en `pagina` desde la v1 — así el origen
  // vuelve para todos los clientes ya instalados, hoy, sin que nadie repegue el
  // código. Lo que el body manda gana; esto sólo llena huecos.
  //
  // Va ANTES del `if` porque lo usan los DOS caminos: el alta directa y la propuesta.
  const atrib = conAtribucion(body as Record<string, string | null>, urlTxt(body.pagina));

  // ⚠️ LO QUE LA PERSONA ESCRIBIÓ, y que hasta hoy se tiraba. El snippet manda en
  // `respuestas` los campos del formulario que NO son nombre/email/teléfono/empresa
  // — que en una inmobiliaria son justo los que importan: zona, presupuesto, si
  // busca comprar o rentar. El pedido era textual: «un único WhatsApp con nombre,
  // teléfono y RESUMEN de lo completado en el formulario».
  //
  // Se sanea acá y no se confía en el largo: el cuerpo lo escribe una página ajena.
  // Tope de 6 campos y 120 caracteres cada uno — un WhatsApp no es un volcado, y un
  // formulario con 40 campos no puede convertir el aviso en algo que nadie lee.
  const resumenForm = (() => {
    const r = body.respuestas;
    if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
    const filas = Object.entries(r as Record<string, unknown>)
      .map(([k, v]) => [String(k).trim().slice(0, 40), String(v ?? '').trim().slice(0, 120)] as const)
      .filter(([k, v]) => k && v)
      .slice(0, 6);
    return filas.length ? filas.map(([k, v]) => `• ${k}: ${v}`).join('\n') : null;
  })();

  // ⚠️ A QUE CRM ENTRA. Pedido de MARTIN el 04/10/2026, textual: «el pixel
  // deberiamos poder ASIGNAR a un PRODUCTO. Con la implementacion que hicimos,
  // para que lleguen los leads a ese CRM y no a otro».
  //
  // Hasta hoy esta ruta no pasaba `funnel_id` en ningun lado —cero coincidencias
  // en el archivo— asi que TODO lead de landing nacia en el embudo del negocio
  // (`funnel_id = null`), que es donde lo busca `listLeadsDeFunnel(null)`. Con dos
  // productos, los leads de la landing del segundo aparecian en el tablero del
  // primero.
  //
  // La asignacion cuelga de la PAGINA (`landing.config`, por URL normalizada) y
  // no del TOKEN: el token es UNO por workspace y determinista —un HMAC de
  // `landing:<ws>`, un solo setting `landing_token`— asi que no hay un segundo
  // token que asignar, y colgarlo de ahi seria decir «todas mis landings venden
  // lo mismo». La pagina si distingue, y esa tabla ya existe POR PAGINA desde que
  // `clarityProjectId` necesito lo mismo (lib/landing-config.ts).
  const funnelesDeLaLanding = await funnelsDeLanding(ws, paginaOptin);
  // ── Y LA CAMPAÑA, que MANDA cuando está asignada (05/10/2026) ──────────────
  // Pedido de Martín: «si asigno a un producto una campaña que va a Landing 1… eso
  // debe medirse en el detalle del lead». O sea que el mapeo es campaña → producto, y
  // la landing es por donde pasó (y lo que aporta las métricas). Si la campaña NO está
  // asignada, decide la landing exactamente como antes: para un workspace sin campañas
  // asignadas —todos, el día que esto sale— no cambia nada.
  //
  // ⚠️ Se compara el `utm_campaign` contra los ids asignados, y es una comparación
  // EXACTA, no un parecido: medido el 05/10/2026, el `utm_campaign` de los leads de
  // landing ES el id de la campaña (35 de 35 en un cliente, 72 de 119 en otro; el resto
  // trae un nombre, y un nombre no matchea nunca — cae a la landing, que es lo seguro).
  // `esIdMeta` adentro de `funnelDeCampana` descarta lo que no sea un id antes de leer
  // nada.
  //
  // ⚠️ Envuelto en `runWithWorkspace`: esta ruta no tiene sesión, y `funnelDeCampana`
  // lee el workspace del CONTEXTO (ver su cabecera).
  // Y el ANUNCIO (`utm_content`), del que sale el CONJUNTO: sin él, asignar un conjunto
  // enrutaba el formulario de Meta y no la landing de esa misma campaña.
  const porCampana = await runWithWorkspace(ws, () => funnelDeCampana({ campaignId: atrib.utm_campaign, adId: atrib.utm_content }))
    .catch(() => ({ asignada: false as const }));
  // ⚠️ LA CAMPAÑA ASIGNADA ES **UNA**, la landing puede ser VARIAS. Asignar una
  // campaña a un producto es decir a qué producto van sus leads, no a cuáles: el
  // mapeo es campaña → producto y tiene un solo destino. Así que cuando manda la
  // campaña, la lista es de uno — y la landing con tres productos no la amplía.
  const funnelesDelLead: Array<number | null> = porCampana.asignada ? [porCampana.funnelId] : funnelesDeLaLanding;

  const dup = await runWithWorkspace(ws, () => duplicadosDeLead({ nombre, email, telefono })).catch(() => []);

  if (!dup.length) {
    try {
      // El id REAL del producto del negocio. Hace falta para las dos traducciones
      // del modelo de varios productos (mig 0207): en `leads.funnel_id` ese producto
      // se escribe NULL y en `lead_funnel` va con su id. Una lectura que falla no
      // tumba el alta: con `null`, la casa se escribe tal cual llegó (para el negocio
      // ya llega en null) y lo único que se pierde es poder AGREGAR el producto del
      // negocio como extra, que queda registrado abajo.
      const defaultId = await runWithWorkspace(ws, () => idDelFunnelDefault()).catch(() => null);
      // El PRIMERO es la CASA del lead: es el que lleva el aviso, el que da el id de
      // la respuesta y el único cuyo fallo cae a propuesta. `funnelesDelLead` nunca
      // viene vacío (ver `funnelsDeLanding`), así que el `?? null` es para el
      // compilador y no un caso real — y si lo fuera, `null` es el embudo del
      // negocio, o sea entrar igual.
      //
      // ⚠️ Se escribe con `casaParaEscribir`, SIEMPRE: el tablero del negocio pide
      // sus leads con `.is('funnel_id', null)`, así que un lead nacido con el ID del
      // default no aparece en NINGÚN tablero. `funnelsDeLanding` ya lo devuelve en
      // null; esto lo garantiza en el punto de escritura, que es donde vale.
      const funnelDelLead = casaParaEscribir(funnelesDelLead[0] ?? null, defaultId);
      const lead = await runWithWorkspace(ws, () => createLead({
        nombre: nombre ?? email ?? telefono ?? 'Sin nombre',
        email, telefono,
        empresa: txt(body.empresa) ?? txt(body.company),
        origen_lead: 'landing',
        // El identificador de la visita anónima. Es LO QUE ATA todo lo que esa
        // persona hizo antes —la visita, el video, los clicks— con el lead que
        // acaba de nacer. Sin esto el tracking se mide y no se puede leer.
        visitor_id: txt(body.visitor_id),
        utm_source: atrib.utm_source,
        utm_medium: atrib.utm_medium,
        utm_campaign: atrib.utm_campaign,
        utm_content: atrib.utm_content,
        // ⚠️ VA EN LOS DOS CAMINOS (el alta directa y la propuesta). Un campo nuevo que
        // se agrega en uno solo se apaga solo: el guardado siguiente es un upsert de la
        // fila armada desde acá, así que lo que este objeto no traiga sale como null.
        fbclid: atrib.fbclid,
        // El CRM al que entra. `null` NO es «sin producto»: es el embudo DEL
        // NEGOCIO, que es donde caen hoy los 1.530 leads de la base. Una landing
        // sin producto asignado sigue cayendo exactamente ahi.
        funnel_id: funnelDelLead,
      }));

      // ⚠️ UNA PERSONA, UNA FICHA: cada producto extra se AGREGA, no se clona.
      // Hasta el 06/10/2026 acá había un `createLead` por producto extra con
      // `permitirDuplicado: true`, o sea N fichas de la misma persona — y eso la
      // partía en N: Calendly y Meta actualizan sólo la más vieja, la nutrición le
      // escribía N veces, las métricas la contaban doble y el CAPI mandaba un
      // QualifiedLead por ficha. Con la mig 0207 un lead vive en VARIOS productos: la
      // casa es `leads.funnel_id` y cada otro es una fila de `lead_funnel` en la etapa
      // de entrada de ESE tablero (`agregarAProducto`, lib/lead-funnel.ts).
      //
      // ⚠️ Por eso la regla de AGENTS.md «Un alta que pasa a crear N filas choca con
      // su propio chequeo de duplicados» YA NO APLICA ACÁ: hay UN alta, que pasa por
      // el chequeo de siempre, y ningún `permitirDuplicado`. Lo que sí sigue de esa
      // regla es la otra mitad: CADA PRODUCTO EXTRA ES BEST-EFFORT, con su propio
      // try. Si falla uno, la persona YA está en el CRM, y caer a propuesta crearía
      // un borrador de alguien que ya entró. Se registra CUÁL falló y se sigue.
      //
      // ⚠️ El producto del negocio, cuando NO es la casa, va en `lead_funnel` con su
      // ID REAL: `funnelsDeLanding` lo devuelve como `null` (que es como se escribe
      // en la casa) y `casaReal` lo traduce. Sin ese id no hay a qué agregarlo.
      //
      // Agregar escribe SÓLO la fila y una línea de historial (decisión v1): no
      // inscribe en nutrición, no toca la etiqueta de WhatsApp ni el CAPI. Todo eso
      // sigue a la casa, que es justo lo que corta el «N veces» de arriba. El autor
      // va explícito: esta ruta no tiene sesión, y la landing de MaKo vive en el
      // mismo dominio — con la cookie de un admin probándola, el historial diría que
      // lo agregó él.
      //
      // `tambien` junta IDS DE PRODUCTO (ya no de fichas): los que se agregaron de
      // verdad. Si ya estaba (`agregado: false`), no cuenta para el aviso.
      const tambien: number[] = [];
      for (const f of funnelesDelLead.slice(1)) {
        const real = casaReal(f, defaultId);
        try {
          if (real == null) throw new Error('no se pudo leer el id del producto del negocio');
          const r = await runWithWorkspace(ws, () => agregarAProducto(lead.id, real, { autor: AUTOR_SISTEMA }));
          if (r.agregado) tambien.push(real);
        } catch (e) {
          console.error(`[track:optin] ws=${ws} lead=${lead.id} no pudo entrar al producto ${f ?? 'del negocio'}:`, e instanceof Error ? e.message : e);
        }
      }
      await runWithWorkspace(ws, () =>
        emitirDelCatalogo('lead-de-landing', {
          ws,
          // ⚠️ UN SOLO WHATSAPP, CON LO QUE LA PERSONA ESCRIBIÓ. Antes decía nombre,
          // teléfono y el link — y nada de lo que completó, porque el snippet sólo
          // capturaba nombre/email/teléfono/empresa y tiraba el resto del formulario.
          // El inmobiliario recibía «Fulano dejó sus datos» y tenía que entrar a la
          // ficha para saber qué le interesaba, que es el viaje que el aviso venía a
          // ahorrar.
          //
          // El resumen se arma con lo que HAYA: si el snippet es viejo y no lo manda,
          // el aviso queda exactamente como estaba. Nada se rompe por una versión.
          texto: [
            `*${nombre ?? email ?? telefono}* dejó sus datos en tu landing`,
            telefono ? `📱 ${telefono}` : null,
            email ? `✉️ ${email}` : null,
            resumenForm,
            hayAtribucion(atrib) ? `📢 ${[atrib.utm_campaign, atrib.utm_content].filter(Boolean).join(' · ') || atrib.utm_source}` : null,
            // Con varios productos se DICE, y corto: el link lleva a la ficha (que es
            // UNA) y sin esta línea quien lo abre no tiene cómo saber que esa persona
            // ya está también en los tableros de otros productos. Cuenta sólo los que
            // se agregaron de verdad, más la casa.
            tambien.length ? `🗂️ Entró a ${tambien.length + 1} productos` : null,
            `👉 ${linkApp(`/crm/${lead.id}`, wsEnContexto())}`,
          ].filter(Boolean).join('\n'),
        }),
      ).catch((e) => console.error('[track:optin] el lead entró pero el aviso falló:', e instanceof Error ? e.message : e));
      console.log(`[track:optin] ws=${ws} lead=${lead.id} creado directo${tambien.length ? ` (+ agregado a los productos ${tambien.join(',')})` : ''}`);
      // `productos` son ids de PRODUCTO, no de fichas: la persona es UNA (`lead`).
      return ok({ lead: lead.id, creado: true, ...(tambien.length ? { productos: tambien } : {}) });
    } catch (e) {
      // ⚠️ Si el alta falla, NO se pierde la persona: cae a propuesta, que es
      // exactamente para lo que existe. Un error del CRM no puede convertirse en
      // un lead que no llegó nunca.
      console.error('[track:optin] alta directa falló, queda como propuesta:', e instanceof Error ? e.message : e);
    }
  }

  // ⚠️ EL CAMINO DEL DUPLICADO TODAVIA NO LLEVA EL PRODUCTO, y no se escribe el
  // campo para disimularlo: `datos.leads[]` lo aplica
  // `importarLeadsRevisadosAction` a traves de `FilaImport`, que NO declara
  // `funnel_id` (grep: cero coincidencias de «funnel» en app/crm/leads-importar.ts),
  // asi que un campo puesto aca no lo leeria nadie. Un dato que solo existe en su
  // declaracion es peor que su ausencia: se lee como que ya funciona.
  //
  // Mientras tanto el duplicado cae en el embudo del negocio, que es donde cae
  // hoy — y ahi lo decide una PERSONA que esta mirando el CRM, agregandolo a su
  // producto desde el desplegable de la ficha (`agregarAProductoAction`, que suma
  // el producto sin sacarlo del negocio). Lo que falta para cerrarlo es un `funnel_id`
  // en `FilaImport` (app/crm/leads-importar.ts) y pasarlo al `createLead` del
  // importador (app/crm/actions.ts).
  const { id, nueva } = await crearPropuesta({
    ws,
    tipo: 'lead',
    origen: 'landing',
    ref,
    resumen: `${nombre ?? email ?? telefono} — dejó sus datos en tu página`,
    datos: {
      leads: [{
        nombre: nombre ?? email ?? telefono,
        email,
        telefono,
        empresa: txt(body.empresa) ?? txt(body.company),
        utm_source: atrib.utm_source,
        utm_medium: atrib.utm_medium,
        utm_campaign: atrib.utm_campaign,
        utm_content: atrib.utm_content,
        // ⚠️ VA EN LOS DOS CAMINOS (el alta directa y la propuesta). Un campo nuevo que
        // se agrega en uno solo se apaga solo: el guardado siguiente es un upsert de la
        // fila armada desde acá, así que lo que este objeto no traiga sale como null.
        fbclid: atrib.fbclid,
        // De dónde salió, textual. Es lo que después distingue «llenó el
        // formulario de la landing» de «lo cargó alguien a mano».
        origen: 'landing',
        visitor_id: txt(body.visitor_id),
        pagina: txt(body.pagina) ?? txt(body.url) ?? req.headers.get('referer'),
      }],
      // Marcador de la sesión de prueba, si vino. Va en `datos` y no en una
      // columna propia: `propuestas` es una tabla genérica de todos los canales, y
      // una columna que solo usa uno la vuelve la tabla de ese canal.
      prueba: txt(body.prueba),
    },
  });

  // ⚠️ EL AVISO NO ES UN EXTRA: es lo que hace que la propuesta EXISTA para
  // alguien. La pantalla de revisión es /crm/revisar/<id> —por id, sin lista—, y
  // un formulario de landing no tiene canal de vuelta: quien lo completa ve la
  // página de gracias del cliente y el dueño no se entera de nada. Sin esto, la
  // propuesta queda en 'pendiente' para siempre. Medido el 14/08/2026 en el ws11:
  // OCHO leads reales, con nombre y teléfono, que nadie vio nunca.
  //
  // Solo si es NUEVA: un reintento del mismo formulario no puede volver a sonar.
  //
  // Y el LINK LO ARMA EL CÓDIGO, nunca el modelo. Por eso se pasa `texto` (que es
  // determinista) y no `contexto`: un id de 16 caracteres al azar transportado por
  // un LLM ya falló en este repo de las dos formas, y la silenciosa —un link que
  // resuelve a una propuesta REAL pero equivocada— es la peor.
  if (nueva) {
    const quien = nombre ?? email ?? telefono;
    const contacto = [telefono && `tel ${telefono}`, email].filter(Boolean).join(' · ');
    await runWithWorkspace(ws, () =>
      emitirDelCatalogo('lead-de-landing', {
        ws,
        // Se dice POR QUÉ quedó esperando. «Confirmalo» a secas, sobre algo que
        // el resto de las veces entra solo, se lee como que el sistema falló.
        texto: `*${quien}* dejó sus datos en tu landing${contacto ? ` — ${contacto}` : ''}. ${textoDuplicado(dup) || 'Necesito que lo mires'} Por eso NO lo cargué solo: fundir dos contactos no se puede deshacer. Decides tú aquí 👉 ${linkApp(`/crm/revisar/${id}`, wsEnContexto())}`,
        // Sin dedup por tiempo: cada persona que deja sus datos es un aviso
        // propio. Agrupar dos leads distintos en uno es perder el segundo.
      }),
    ).catch((e) => {
      // Un aviso caído NO puede tumbar la ingesta: el lead ya está guardado y eso
      // es el hecho. Lo que se pierde es la notificación, no la persona.
      console.error('[track:optin] el lead se guardó pero el aviso falló:', e instanceof Error ? e.message : e);
    });
  }

  console.log(`[track:optin] ws=${ws} propuesta=${id} ${nueva ? 'nueva' : 'ya existía'}`);
  return ok({ propuesta: id, nueva });
}
