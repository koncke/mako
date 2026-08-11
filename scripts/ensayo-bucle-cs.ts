// =============================================================================
// ensayo-bucle-cs — el bucle de entrega entero, de punta a punta, verificado
// =============================================================================
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/ensayo-bucle-cs.ts
//     --url http://localhost:3000   → contra local (por defecto va a producción)
//     --dejar                       → NO borra el lead de ensayo al terminar
//
// Corre los cinco pasos como los va a vivir un cliente de Mauricio, y después de
// cada uno LEE LA BASE para confirmar que pasó de verdad. Un paso que "no rompe"
// no es un paso que funciona: lo que se chequea es el estado, no la ausencia de
// error.
//
//   1. Whop avisa que vio la clase   → firma real contra el webhook desplegado
//   2. el cliente entra por su link  → POST a /api/compartido/tarea
//   3. se hace la junta              → reescribe con una conversación de ejemplo
//   4. el cliente aprueba            → POST con accion=aprobar
//   5. y el que NO puede, no puede   → un link de solo-lectura recibe 404
//
// ⚠️ ESCRIBE EN LA BASE DE PRODUCCIÓN (el .env.local apunta ahí). Por eso todo
// cuelga de UN lead de ensayo que se crea al empezar y se borra al terminar, y
// por eso el borrado va en `finally`: un ensayo que falla a la mitad no puede
// dejar un cliente inventado en la cartera de Mauricio.
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import crypto from 'node:crypto';
import { getTenantDb, runWithWorkspace } from '../lib/workspace';
import { crearShare } from '../lib/shares';
import { credWs } from '../lib/credenciales';
import { getMapaLecciones } from '../lib/cs-avance';
import { getBloque } from '../lib/cs-respuestas';
import { reescribirBloque } from '../lib/cs-reescritura';
import { rotuloDe } from '../lib/programa-catalogo';
import { whopCompanyId } from '../lib/whop';
import { APP_BASE_URL } from '../lib/app-url';

const WS = 1;
const arg = (n: string) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const URL_BASE = arg('--url') ?? APP_BASE_URL;
const DEJAR = process.argv.includes('--dejar');

const EMAIL = 'ensayo-bucle-cs@mako.test';
const NOMBRE = 'ENSAYO — borrar si quedó';

let pasos = 0, fallos = 0;
const ok = (t: string, extra = '') => { pasos++; console.log(`  ✓ ${t}${extra ? `\n      ${extra}` : ''}`); };
const mal = (t: string, extra = '') => { pasos++; fallos++; console.log(`  ✖ ${t}${extra ? `\n      ${extra}` : ''}`); };
const chequear = (cond: boolean, t: string, extra = '') => (cond ? ok(t, extra) : mal(t, extra));

/** La conversación de la junta. Habla SOLO del bloque m0c1 a propósito: así el
 *  paso 3 prueba las dos cosas —que reescribe donde hay material, y que devuelve
 *  SIN_MATERIAL donde no lo hay—. */
const JUNTA = `RESUMEN DE LA REUNIÓN
Sesión de arranque con el cliente. Se discutió cuánto tiempo propio le va a costar el programa.
El cliente había dicho "unas 4 horas por semana". En la sesión se revisó su agenda real de las
últimas dos semanas y salió que hoy le dedica 2 horas y que las otras 2 se le van en operación
que no delegó. Quedó en bloquear los martes de 9 a 12 para esto, y en avisarle al equipo que en
ese bloque no está disponible. También aclaró por qué no se delega: el criterio para decidir qué
va primero está solo en su cabeza, y eso es justamente lo que el programa viene a sacar de ahí.

ACTION ITEMS QUE FATHOM YA DETECTÓ (con su dueño)
- [cliente] Bloquear martes 9 a 12 en el calendario
- [cliente] Avisarle al equipo del bloque no disponible`;

async function crearLeadDeEnsayo(): Promise<number> {
  const db = await getTenantDb();
  await db.from('leads').delete().eq('email', EMAIL); // por si quedó de una corrida anterior
  const { data, error } = await db.from('leads')
    .insert({ nombre: NOMBRE, email: EMAIL, estado_lead: 'ganado' })
    .select('id').single();
  if (error) throw new Error(`no se pudo crear el lead de ensayo: ${error.message}`);
  return (data as { id: number }).id;
}

async function borrarLeadDeEnsayo(leadId: number): Promise<void> {
  const db = await getTenantDb();
  await db.from('cs_respuestas').delete().eq('lead_id', leadId);
  await db.from('leads').delete().eq('id', leadId);
}

async function postTarea(token: string, body: Record<string, unknown>) {
  const r = await fetch(`${URL_BASE}/api/compartido/tarea`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token, ...body }),
  });
  return { status: r.status, cuerpo: await r.text() };
}

async function main() {
  console.log(`\n╔═ ENSAYO DEL BUCLE DE ENTREGA ═══════════════════════════════`);
  console.log(`║  contra: ${URL_BASE}`);
  console.log(`╚═════════════════════════════════════════════════════════════\n`);

  const leadId = await crearLeadDeEnsayo();
  console.log(`Cliente de ensayo creado: #${leadId}\n`);

  try {
    // ── 1. Whop avisa que el cliente completó la clase ──────────────────────
    console.log('1. Whop avisa que vio la clase');
    const mapa = await getMapaLecciones();
    const par = Object.entries(mapa).find(([, clase]) => clase === 'm0c1');
    if (!par) { mal('hay mapa lección→clase', 'corré scripts/cargar-programa-whop.ts --aplicar'); return; }
    const [leccionId] = par;

    const secreto = await credWs('WHOP_WEBHOOK_SECRET', WS);
    const biz = await whopCompanyId(WS);
    if (!secreto || !biz.ok) { mal('Whop configurado', 'falta la key o el secreto del webhook'); return; }

    const payload = JSON.stringify({
      event: 'course_lesson_interaction.completed',
      data: { company_id: biz.data, course_lesson_id: leccionId, user: { email: EMAIL } },
    });
    const id = `msg_${crypto.randomBytes(6).toString('hex')}`;
    const ts = Math.floor(Date.now() / 1000);
    // La clave es el string ENTERO del secreto: Whop manda `ws_`+hex, no base64.
    const clave = Buffer.from(Buffer.from(secreto, 'utf8').toString('base64'), 'base64');
    const firma = crypto.createHmac('sha256', clave).update(`${id}.${ts}.${payload}`).digest('base64');

    const rw = await fetch(`${URL_BASE}/api/webhooks/whop`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'webhook-id': id, 'webhook-timestamp': String(ts), 'webhook-signature': `v1,${firma}`,
      },
      body: payload,
    });
    const cuerpoW = await rw.text();
    chequear(rw.status === 200 && cuerpoW.includes('m0c1'), 'el webhook aceptó la firma y atribuyó la clase', cuerpoW.slice(0, 120));

    let b = await getBloque(leadId, 'm0c1');
    chequear(Boolean(b?.visto_at), 'quedó marcado que VIO la clase');
    chequear(b?.estado === 'pendiente', 'pero NO como contestada: mirar el video no es hacer la tarea', `estado=${b?.estado}`);

    // ── 2. El cliente entra por su link y contesta ──────────────────────────
    console.log('\n2. El cliente entra por su link y contesta');
    const { token } = await crearShare({
      ws: WS, recurso: 'tarea-cs', alcance: 'item', recursoId: String(leadId),
      modo: 'link', permiso: 'editar', etiqueta: `ENSAYO — ${NOMBRE}`,
    });
    const suyo = 'Unas 4 horas por semana mías. No lo puedo delegar porque el criterio para priorizar está solo en mi cabeza.';
    const r2 = await postTarea(token, { claseId: 'm0c1', texto: suyo });
    chequear(r2.status === 200, 'el POST del cliente entró', `HTTP ${r2.status} ${r2.cuerpo.slice(0, 80)}`);

    b = await getBloque(leadId, 'm0c1');
    chequear(b?.estado === 'contestada', 'el bloque quedó contestado', `estado=${b?.estado}`);
    chequear(b?.respuesta === suyo, 'se guardó EXACTAMENTE lo que escribió');

    // ── 3. Se hace la junta y MaKo reescribe ────────────────────────────────
    console.log('\n3. Se hace la junta y MaKo reescribe (llama al modelo de verdad)');
    const r3 = await reescribirBloque({
      leadId, claseId: 'm0c1', conversacion: JUNTA, fuenteReunion: 'ensayo:local',
    });
    chequear(r3.ok, 'MaKo reescribió el bloque', r3.ok ? '' : `motivo=${r3.motivo}`);

    b = await getBloque(leadId, 'm0c1');
    chequear(b?.estado === 'revisada_ia', 'el bloque quedó esperando el ok del cliente', `estado=${b?.estado}`);
    chequear(b?.respuesta === suyo, '⭐ NO pisó lo que había escrito el cliente');
    chequear(Boolean(b?.respuesta_ia && b.respuesta_ia !== suyo), 'la propuesta está y es distinta de la original');
    if (b?.respuesta_ia) console.log(`\n      ── lo que propone MaKo ──\n      ${b.respuesta_ia.replace(/\n/g, '\n      ').slice(0, 500)}\n`);

    // El bloque del que la junta NO habló tiene que quedarse quieto.
    //
    // ⚠️ Y tiene que llegar al MODELO para probar algo. La primera versión de
    // este chequeo pasaba con `sin-respuesta`: el bloque estaba vacío, así que
    // cortaba antes de preguntarle a nadie. Verde por el motivo equivocado, que
    // es la peor clase de verde. Por eso primero se contesta, y recién ahí se
    // pide la reescritura: lo que se exige es `sin-material`, o sea que el
    // modelo miró la conversación y dijo que no habla de esto.
    await postTarea(token, { claseId: 'm7c1', texto: 'La foto del mostrador al abrir y al cerrar.' });
    const r3b = await reescribirBloque({ leadId, claseId: 'm7c1', conversacion: JUNTA });
    chequear(!r3b.ok && r3b.motivo === 'sin-material',
      `⭐ el bloque «${rotuloDe('m7c1')}», del que la junta no habló, NO se inventó`,
      r3b.ok ? 'REESCRIBIÓ ALGO QUE NADIE DIJO' : `motivo=${r3b.motivo} (tiene que ser sin-material: si dice sin-respuesta, ni llegó al modelo)`);

    const b7 = await getBloque(leadId, 'm7c1');
    chequear(b7?.estado === 'contestada' && !b7?.respuesta_ia,
      'y quedó como estaba: sin propuesta encima', `estado=${b7?.estado}`);

    // ── 4. El cliente aprueba ───────────────────────────────────────────────
    console.log('\n4. El cliente aprueba');
    const aprobado = b?.respuesta_ia ?? suyo;
    const r4 = await postTarea(token, { claseId: 'm0c1', texto: aprobado, accion: 'aprobar' });
    chequear(r4.status === 200, 'la aprobación entró', `HTTP ${r4.status}`);

    b = await getBloque(leadId, 'm0c1');
    chequear(b?.estado === 'aprobada', 'el bloque quedó cerrado', `estado=${b?.estado}`);
    chequear(b?.respuesta === aprobado, 'la respuesta final es la que el cliente aprobó');

    // ── 5. Y el que no puede, no puede ──────────────────────────────────────
    console.log('\n5. Y el que no tiene permiso, no escribe');
    const soloVer = await crearShare({
      ws: WS, recurso: 'tarea-cs', alcance: 'item', recursoId: String(leadId),
      modo: 'link', etiqueta: `ENSAYO solo-ver — ${NOMBRE}`,
    });
    const r5 = await postTarea(soloVer.token, { claseId: 'm0c1', texto: 'no debería entrar' });
    chequear(r5.status === 404, 'un link de SOLO LECTURA no escribe', `HTTP ${r5.status}`);

    const r5b = await postTarea(token, { claseId: 'm99c9', texto: 'x' });
    chequear(r5b.status === 404, 'una clase que no está en el programa no se guarda', `HTTP ${r5b.status}`);
  } finally {
    if (DEJAR) {
      console.log(`\n⚠️ --dejar: el lead #${leadId} y sus filas QUEDAN. Borralos a mano.`);
    } else {
      await borrarLeadDeEnsayo(leadId);
      const db = await getTenantDb();
      await db.from('shares').update({ revocado_at: new Date().toISOString() })
        .eq('recurso_id', String(leadId)).eq('recurso', 'tarea-cs');
      console.log('\nLimpieza: lead de ensayo, sus respuestas y sus links, borrados.');
    }
    console.log(`\n${fallos === 0 ? '✓ TODO EN VERDE' : `✖ ${fallos} DE ${pasos} FALLARON`}  (${pasos} chequeos)\n`);
    if (fallos) process.exitCode = 1;
  }
}

runWithWorkspace(WS, main).catch((e) => { console.error(e); process.exit(1); });
