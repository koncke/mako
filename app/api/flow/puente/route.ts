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

import { NextResponse, type NextRequest } from 'next/server';
import {
  workspaceDeToken, marcarVisto, tomarTrabajos, resolver, fallar, estadoGuardado,
  type EstadoPuente,
} from '@/lib/flow-cola';
import { LIMITES, clasificarFalla, clasificarFallaDelNavegador, type MotivoFalla } from '@/lib/flow-protocolo';

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
      await fallar(ws, id, delNavegador.motivo, delNavegador.error, delNavegador.reintentable);
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
      const crudo = `HTTP ${status} · ${str(r.error).slice(0, 200)}`;
      await fallar(ws, id, f.motivo, `${f.error}\n[crudo] ${crudo}`, f.reintentable);
      continue;
    }
    const motivo = MOTIVOS.includes(str(r.motivo) as MotivoFalla) ? (str(r.motivo) as MotivoFalla) : 'transitorio';
    await fallar(ws, id, motivo, str(r.error) || 'sin detalle', r.reintentable !== false);
  }

  // ── 2. El puente reporta que está vivo ────────────────────────────────────
  const estado = ESTADOS.includes(str(body.estado) as EstadoPuente) ? (str(body.estado) as EstadoPuente) : 'listo';
  await marcarVisto(ws, str(body.projectId), estado, str(body.detalle));

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
    // Sale de lo GUARDADO y no del auto-reporte: `estado` lo escribe la extensión,
    // que nunca dice `marcada`, así que esto era siempre false y el puente jamás
    // se enteraba de que había que parar.
    pausado: guardado === 'marcada',
  });
}
