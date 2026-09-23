// =============================================================================
// Backfill histórico de Calendly (Implementación v2, Fase 2-bis)
// =============================================================================
// Importa el historial de agendas de Calendly como leads, con su atribución
// UTM. Completa cohortes viejas (campaña de diciembre) y hace posible que el
// objetivo (Fase 14) cuente cierres reales.
//
// Uso (el flag --conditions=react-server neutraliza `server-only` fuera de Next):
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/backfill-calendly.ts --dry
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/backfill-calendly.ts
// Token: CALENDLY_API_TOKEN.
//
// ⚠️ YA NO CAE A `CALENDLY_WEBHOOK_SIGNING_KEY`, y el comentario que decía que era el mismo
// PAT dejó de ser cierto el 19/09/2026: al recrear la suscripción, la signing key pasó a
// ser 32 bytes aleatorios guardados en la tabla `credenciales`
// (scripts/arreglar-webhook-calendly.ts:89). Con el fallback puesto, faltar el PAT no daba
// un error claro: mandaba un hex al azar como Bearer y moría con un 401 en /users/me.
//
// Rango: por default desde --desde=YYYY-MM-DD (o 2025-12-01 si no se pasa).
//
// Reglas de no-destrucción (vía upsertLeadFromCalendly con soloCompletarVacios):
//   - Lead existente: solo completa campos VACÍOS. Nunca pisa datos cargados
//     ni campos manuales (asistencias, resolución, cobranza).
//   - utm_term con formato UUID = visitor_id del beacon: se guarda solo si el
//     lead no tiene uno (conecta retroactivamente lo que vio del VSL).
//   - Idempotente: correrlo dos veces no duplica ni cambia nada.
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(process.cwd(), '.env.local') });

import { upsertLeadFromCalendly, saveLeadRespuestas, normalizarTelefono, findLeadByContacto, setFechaJunta2 } from '../lib/leads';
import { isoToFechaTijuana, extractAnswer, extractRespuestaPorFrase, clasificarJunta } from '../lib/calendly';
import { runWithWorkspace, OWNER_WS, getTenantDb } from '../lib/workspace';
import { credWs } from '../lib/credenciales';

const API = 'https://api.calendly.com';
const PAUSA_MS = 300;
const DRY = process.argv.includes('--dry');
// Desde cuándo mirar. Sin el flag son diez meses de reservas: no es destructivo
// (soloCompletarVacios) pero escribe en leads históricos y hace ilegible el resumen —
// «Existentes (revisados)» dice cientos y el agujero que se vino a tapar se pierde ahí.
const desdeArg = process.argv.find((a) => a.startsWith('--desde='))?.slice(8);
const MIN_START_TIME = desdeArg ? `${desdeArg}T00:00:00Z` : '2025-12-01T00:00:00Z';

// Emails de PRUEBA que Mauricio borró a propósito en sesiones anteriores
// (su coach Martin, él mismo probando, y agendas de prueba). No re-importar.
const EXCLUIR_EMAILS = new Set([
  'martinkoncke@gmail.com',
  'bustoseguia@gmail.com',
  'leandrotejadogonzalvez@gmail.com',
  'tejadomartin@gmail.com',
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

function token(): string {
  const t = process.env.CALENDLY_API_TOKEN;
  if (!t) throw new Error('Falta CALENDLY_API_TOKEN en .env.local (la signing key del webhook YA NO sirve: desde el 19/09 es una clave aleatoria, no un PAT)');
  return t;
}

async function calendlyGet<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Calendly ${res.status} en ${url}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

type ScheduledEvent = {
  uri: string;
  name?: string;
  /** La URI del event type: es el candidato MÁS fuerte de `clasificarJunta` (el nombre lo puede editar cualquiera). */
  event_type?: string;
  start_time: string;
  status: string;
};

type Invitee = {
  email?: string;
  name?: string;
  created_at?: string;
  questions_and_answers?: Array<{ question?: string; answer?: string }>;
  tracking?: {
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    utm_content?: string | null;
    utm_term?: string | null;
  };
};

async function main() {
  console.log(`▶ Backfill Calendly${DRY ? ' (DRY RUN — no escribe)' : ''}`);
  console.log(`  Eventos desde: ${MIN_START_TIME}\n`);

  // a) Organización
  const me = await calendlyGet<{ resource: { current_organization: string } }>(
    `${API}/users/me`,
  );
  const org = me.resource.current_organization;
  console.log(`  Organización: ${org}\n`);

  // ⚠️ LA MISMA CONFIG Y LA MISMA FUNCIÓN QUE EL WEBHOOK. Acá había un regex propio
  // (`/r2|reunión 2|junta 2|seguimiento/`) que era una SEGUNDA copia del predicado: dos
  // copias del mismo criterio divergen, y ésta divergía ya el día que se escribió — el
  // event type de la R2 se llama «Calificación para Programa Directivo - Reunión 2», que
  // ese regex acierta de casualidad por «reunión 2», y una R2 renombrada se habría
  // importado como si fuera una primera reunión.
  const cfgJuntas = {
    j1: await credWs('CALENDLY_EVENT_TYPE_J1', OWNER_WS),
    j2: await credWs('CALENDLY_EVENT_TYPE_J2', OWNER_WS),
  };
  console.log(`  R1: ${cfgJuntas.j1 ?? '— (sin configurar)'}`);
  console.log(`  R2: ${cfgJuntas.j2 ?? '— (sin configurar)'}\n`);

  // b) Listar scheduled_events paginando
  const eventos: ScheduledEvent[] = [];
  let pageUrl: string | null =
    `${API}/scheduled_events?organization=${encodeURIComponent(org)}` +
    `&status=active&min_start_time=${encodeURIComponent(MIN_START_TIME)}&count=100`;

  while (pageUrl) {
    const page: {
      collection: ScheduledEvent[];
      pagination: { next_page?: string | null };
    } = await calendlyGet(pageUrl);
    eventos.push(...page.collection);
    pageUrl = page.pagination.next_page ?? null;
    await sleep(PAUSA_MS);
  }
  console.log(`  Eventos encontrados: ${eventos.length}\n`);

  // c) Por cada evento, traer invitees y cargar
  let creados = 0;
  let completados = 0;
  let saltados = 0;
  const errores: string[] = [];

  for (const ev of eventos) {
    const uuid = ev.uri.split('/').pop();
    try {
      const inviteesResp = await calendlyGet<{ collection: Invitee[] }>(
        `${ev.uri}/invitees`,
      );
      for (const inv of inviteesResp.collection) {
        const email = inv.email?.trim();
        if (!email || !email.includes('@')) {
          saltados++;
          continue;
        }
        // Excluir leads de prueba que se borraron a propósito
        if (EXCLUIR_EMAILS.has(email.toLowerCase())) {
          saltados++;
          continue;
        }
        const nombre = (inv.name ?? email.split('@')[0]).trim();

        const empresa = extractAnswer(inv.questions_and_answers, [
          'empresa', 'company', 'organiz',
        ]);
        const telefono = extractAnswer(inv.questions_and_answers, [
          'tel', 'phone', 'celular', 'móvil', 'movil',
        ]);
        // ⚠️ LAS MISMAS FRASES QUE EL WEBHOOK, Y POR LA MISMA RAZÓN. Acá había
        // `extractAnswer` con keywords sueltas, que es lo que el webhook ABANDONÓ: devuelve
        // la PRIMERA pregunta que contenga la palabra, y «equipo» matchea «…multiplicar los
        // resultados de tu equipo» (la de inversión) antes que «¿Cuántos colaboradores
        // tienes?». En un lead que ya existe el daño lo tapa `soloCompletarVacios`; en uno
        // NUEVO el insert escribe la respuesta cruzada sin ninguna condición — y el agujero
        // del 11/09 incluye por lo menos una persona que no existe en el CRM.
        // Las frases son copia literal de app/api/webhooks/calendly/route.ts:251-268.
        const qa = inv.questions_and_answers;
        const respuesta_objetivo = extractRespuestaPorFrase(qa, [
          'qué quieres lograr', 'que quieres lograr', 'qué querés lograr', 'que queres lograr',
        ]);
        const respuesta_inversion = extractRespuestaPorFrase(qa, [
          'posibilidad de invertir', 'invertir para superar',
        ]);
        const respuesta_colaboradores = extractRespuestaPorFrase(qa, [
          'cuántos colaboradores', 'cuantos colaboradores', 'colaboradores tienes actualmente', 'colaboradores tienes',
        ]);
        const respuesta_facturacion = extractRespuestaPorFrase(qa, [
          '20 millones', '$20', 'es tu caso',
        ]);
        const respuesta_decisor = extractRespuestaPorFrase(qa, [
          'participar en la decisión', 'participar en la decision', 'alguien más', 'alguien mas',
        ]);
        const respuesta_cuando_empezar = extractRespuestaPorFrase(qa, [
          'cuándo quieres empezar', 'cuando quieres empezar', 'cuándo querés empezar', 'cuando queres empezar',
        ]);

        const tk = inv.tracking;
        const utmTerm = tk?.utm_term?.trim() || null;
        // utm_term con formato UUID = visitor_id del beacon del VSL
        const visitor_id = utmTerm && UUID_RE.test(utmTerm) ? utmTerm : null;

        const fechaAgenda = inv.created_at
          ? isoToFechaTijuana(inv.created_at)
          : isoToFechaTijuana(ev.start_time);
        const fechaJ1 = isoToFechaTijuana(ev.start_time);

        // ── Una R2 NUNCA crea un lead, y NUNCA escribe la fecha de la R1 ──────────
        // El webhook ya lo hace así desde la Fase 10 («NUNCA crear desde una J2»,
        // app/api/webhooks/calendly/route.ts:185). Este script trataba toda reserva como
        // una primera reunión: una R2 cuyo invitee no matchea ningún lead creaba un lead
        // NUEVO con la fecha de la R2 metida en `fecha_junta_1` y `junta_1_at`. O sea una
        // persona que figura agendada a una primera reunión que nunca existió, con el No
        // Show de `crm-auto-plan` contando desde esa fecha y la cohorte del reporte
        // apuntando al mes equivocado.
        if (clasificarJunta(ev, cfgJuntas) === 'j2') {
          const lead = await findLeadByContacto(email, telefono);
          if (!lead) {
            saltados++;
            console.log(`  [R2 sin lead] ${nombre} <${email}> R2=${fechaJ1} — no se crea nada (el webhook tampoco)`);
            continue;
          }
          // No destructivo, igual que `soloCompletarVacios`: si ya tiene R2 cargada, se
          // respeta. Puede ser una reprogramación que alguien corrigió a mano.
          const faltantes = [!lead.fecha_junta_2 && 'fecha_junta_2', !lead.junta_2_at && 'junta_2_at'].filter(Boolean);
          const falta = faltantes.length > 0;
          if (DRY) {
            console.log(`  [dry] ${(falta ? `COMPLETA(${faltantes.join(',')})` : 'NADA').padEnd(46)} ${nombre} <${email}> R2=${fechaJ1} (lead #${lead.id})`);
            if (falta) completados++; else saltados++;
            continue;
          }
          if (falta) {
            await setFechaJunta2(lead.id, lead.fecha_junta_2 ?? fechaJ1, lead.junta_2_at ?? ev.start_time);
            completados++;
          } else {
            saltados++;
          }
          // Las respuestas del form de la R2 van con su propia etiqueta: el set de columnas
          // de `leads` es el de la R1 y pisarlo con las de la R2 sería contestar otra cosa.
          if (inv.questions_and_answers?.length) {
            await saveLeadRespuestas(lead.id, 'R2', inv.questions_and_answers, fechaJ1);
          }
          continue;
        }

        if (DRY) {
          // ⚠️ EL DRY HACE EL MISMO LOOKUP QUE LA ESCRITURA. Antes imprimía lo que había
          // devuelto Calendly y seguía de largo, sin tocar la base: o sea contestaba «qué
          // trae Calendly», no «qué le va a pasar al CRM», que es la única pregunta que
          // importa antes de correrlo. Es la regla de AGENTS.md: un preview que no pasa por
          // el camino de escritura ESTIMA, no valida.
          //
          // Las dos consultas son copia literal de las de `upsertLeadFromCalendly`
          // (lib/leads.ts:1166-1183): teléfono normalizado primero, email después.
          type LeadMinimo = { id: number; nombre: string; fecha_junta_1: string | null; junta_1_at: string | null; respuesta_inversion: string | null };
          const db = await getTenantDb();
          const telNorm = normalizarTelefono(telefono);
          const COLS = 'id, nombre, fecha_junta_1, junta_1_at, respuesta_inversion';
          let existente: LeadMinimo | null = null;
          if (telNorm) {
            const { data } = await db.from('leads').select(COLS).eq('telefono_normalizado', telNorm).maybeSingle();
            existente = (data as unknown as LeadMinimo | null) ?? null;
          }
          if (!existente) {
            const { data } = await db.from('leads').select(COLS).eq('email', email.trim().toLowerCase()).maybeSingle();
            existente = (data as unknown as LeadMinimo | null) ?? null;
          }
          const faltantes = existente
            ? [!existente.fecha_junta_1 && 'fecha_junta_1', !existente.junta_1_at && 'junta_1_at', !existente.respuesta_inversion && 'respuesta_inversion'].filter(Boolean)
            : [];
          const veredicto = !existente ? 'CREA' : faltantes.length ? `COMPLETA(${faltantes.join(',')})` : 'NADA';
          console.log(`  [dry] ${veredicto.padEnd(46)} ${nombre} <${email}> J1=${fechaJ1} utm=${tk?.utm_campaign ?? '—'} vsl=${visitor_id ? 'sí' : 'no'}`);
          if (veredicto === 'CREA') creados++; else if (veredicto.startsWith('COMPLETA')) completados++; else saltados++;
          continue;
        }

        const { created, lead } = await upsertLeadFromCalendly(
          {
            email,
            nombre,
            fecha_agenda: fechaAgenda,
            fecha_junta_1: fechaJ1,
            empresa,
            telefono,
            utm_source: tk?.utm_source ?? null,
            utm_medium: tk?.utm_medium ?? null,
            utm_campaign: tk?.utm_campaign ?? null,
            utm_content: tk?.utm_content ?? null,
            respuesta_facturacion,
            respuesta_colaboradores,
            respuesta_objetivo,
            respuesta_cuando_empezar,
            respuesta_inversion,
            respuesta_decisor,
            // La hora EXACTA, no sólo el día: es lo que mira el «ya pasó» de crm-auto
            // (lib/crm-auto-plan.ts:85) y lo que el webhook manda con ese mismo comentario.
            // Sin esto, los leads recuperados quedan con el No Show calculado a ciegas.
            junta_1_at: ev.start_time,
            visitor_id,
          },
          {
            soloCompletarVacios: true,
            // Backdatea created_at al momento real en que agendó
            fechaCreacion: inv.created_at ?? ev.start_time,
          },
        );
        // Guardar las respuestas EXACTAS del formulario de Calendly (preguntas
        // tal cual) en lead_respuestas — así la ficha no cae al fallback canónico.
        // Idempotente por (lead, reunión, evento).
        if (inv.questions_and_answers?.length) {
          // Acá ya es R1: la rama de la R2 salió por `continue` mucho antes.
          const reunion = 'R1';
          // ⚠️ `fechaJ1`, NO `ev.start_time`. El dedup de saveLeadRespuestas es un `.eq`
          // exacto sobre `evento_inicio`, y el webhook le pasa el DÍA («2026-09-21»), no el
          // ISO completo. Con formatos distintos no matchea y la misma reunión queda con
          // dos filas de respuestas.
          await saveLeadRespuestas(lead.id, reunion, inv.questions_and_answers, fechaJ1);
        }
        if (created) {
          creados++;
          console.log(`  + ${nombre} <${email}> J1=${fechaJ1}`);
        } else {
          completados++;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errores.push(`evento ${uuid}: ${msg}`);
      console.error(`  ERROR ${uuid}: ${msg}`);
    }
    await sleep(PAUSA_MS);
  }

  console.log('\n──────── RESUMEN ────────');
  console.log(`Eventos leídos       : ${eventos.length}`);
  console.log(`Leads ${DRY ? 'que se crearían' : 'creados        '}: ${creados}`);
  console.log(`${DRY ? 'Que se completarían  ' : 'Existentes (revisados)'}: ${completados}`);
  console.log(`${DRY ? 'Sin cambios / saltados' : 'Invitees saltados    '}: ${saltados}`);
  console.log(`Errores              : ${errores.length}`);
  for (const e of errores) console.log(`  - ${e}`);
  process.exit(errores.length > 0 ? 1 : 0);
}

// Sin request (script) no hay cookies: fijamos el workspace del dueño para que
// getTenantDb() escriba en el workspace correcto sin llamar a cookies().
runWithWorkspace(OWNER_WS, () => main()).catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
