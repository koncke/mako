// =============================================================================
// Cerebro de copywriting de MaKo — metodología curada + swipe de ejemplos
// =============================================================================
// Dos aportes que ELEVAN toda la redacción de MaKo (generador de nutrición,
// asesor de WhatsApp, redacción de plantillas — todo lo que lee area='mensajes'):
//
//  1) METODOLOGÍA CURADA (seedCopywritingMetodo): frameworks de copywriting y
//     psicología de venta destilados (AIDA/PAS/BAB, gatillos, asuntos, anatomía
//     de secuencias, CTA, qué NUNCA hacer). Es conocimiento del área 'mensajes'
//     sembrado en el WORKSPACE DEL DUEÑO (OWNER_WS) → el RAG lo sirve read-only a
//     TODOS los clientes (wsParaRag = [propio, dueño]). Se edita en /conocimiento.
//
//  2) SWIPE DE EJEMPLOS (addEjemplo/…): emails reales que le llegan al dueño y
//     carga como referencia. Van al área 'ejemplos' (NO 'mensajes', para no
//     contaminar la metodología del asesor) y el generador los usa como few-shot.
//
// Ambos se escriben en OWNER_WS con runWithWorkspace: un dueño-admin SIN
// impersonar tiene ws=null → getTenantDb estamparía workspace_id=-1 y el RAG
// (que lee OWNER_WS) nunca los vería. Guardado owner-only en la capa de API.

import 'server-only';

import { OWNER_WS, runWithWorkspace } from '@/lib/workspace';
import {
  createKnowledge, deleteKnowledge, listKnowledge, cursoExiste, searchKnowledge,
  AREA_EJEMPLOS, type KnowledgeEntry,
} from '@/lib/mako-knowledge';

export const CURSO_COPY = 'Copywriting & Psicología (MaKo)';
export const CURSO_SWIPE = 'Swipe — ejemplos reales';

// ── Metodología curada (frameworks públicos, en la voz instructiva de MaKo) ──
// No es copia de ninguna skill: son marcos de dominio público (AIDA, PAS, gatillos
// de Cialdini, etc.) redactados de cero, accionables y en español.
type MetodoEntry = { titulo: string; categoria: string; cuerpo: string };

const METODO: MetodoEntry[] = [
  {
    titulo: 'Fundamentos: claridad, beneficio y una sola idea',
    categoria: 'Fundamentos',
    cuerpo: `Reglas base de toda redacción de MaKo:
- Claridad antes que ingenio. Si hay que elegir entre sonar creativo y que se entienda, gana entenderse.
- Voz activa y frases cortas. El lector escanea; escribe para que capte la idea en 3 segundos.
- Beneficio antes que característica. No "tenemos X"; sino "con esto lográs Y". Traducí siempre feature → resultado para el lector.
- Habla en el idioma del cliente, no en jerga interna. Usa las palabras que usa él para nombrar su problema.
- Una sola idea y un solo objetivo por mensaje. Si el email/WhatsApp quiere hacer tres cosas, no logra ninguna.
- Especificidad y honestidad. Datos concretos > adjetivos vacíos. Nunca prometas lo que el negocio no puede cumplir.
- Escribe como le hablarías a UNA persona, por su nombre, no a "una lista".`,
  },
  {
    titulo: 'Estructuras que persuaden: AIDA, PAS, BAB',
    categoria: 'Estructura',
    cuerpo: `Elige una estructura según el momento del lead. No las mezcles dentro de un mismo mensaje corto:
- AIDA (Atención → Interés → Deseo → Acción): buena para presentar algo nuevo. Abre con un gancho, sube el interés con relevancia, enciende el deseo con el resultado, cierra con una acción clara.
- PAS (Problema → Agitación → Solución): la más potente para reactivar. Nombra el problema real, muestra qué pasa si sigue sin resolverse (sin dramatizar de más), y ofrece la salida. Ideal para "no agendó", "no-show", "reactivación".
- BAB (Antes → Después → Puente): "hoy estás así / imaginá estar así / el puente es esta llamada". Muy útil cuando el resultado es tangible.
Regla: la estructura es andamiaje, no se nota. El lector siente una conversación, no una fórmula.`,
  },
  {
    titulo: 'Asuntos y preheader (email): que se abra',
    categoria: 'Email',
    cuerpo: `El asunto tiene un solo trabajo: ganar la apertura. Sin apertura, el mejor cuerpo no existe.
- 4 a 8 palabras. Que entre completo en el celular.
- Elige UN ángulo: curiosidad ("Un caso que te va a sonar"), específico/beneficio ("Reagendemos en 30 seg"), o tensión/pregunta ("¿Lo dejamos aquí?").
- Escribilo en minúsculas o capitalización natural, como un humano. Evitá MAYÚSCULAS, signos de más ($$$, !!!), "GRATIS", "URGENTE" y clickbait vacío: bajan entregabilidad y confianza.
- El preheader (texto de vista previa) COMPLEMENTA, no repite el asunto: es la segunda línea que termina de convencer de abrir. Nunca lo dejes vacío (si no, se cuela el HTML).
- Prometé en el asunto solo lo que el cuerpo cumple. El clickbait quema la lista.`,
  },
  {
    titulo: 'Psicología de venta: gatillos aplicados con honestidad',
    categoria: 'Psicología',
    cuerpo: `Gatillos de decisión (Cialdini y afines). Usalos solo cuando son REALES; falsearlos destruye la confianza:
- Prueba social: casos, cantidad de clientes, resultados de gente parecida al lead. "Alguien en tu misma situación hoy logró…".
- Aversión a la pérdida: la gente teme perder más que lo que desea ganar. Enmarcá lo que se está perdiendo por no actuar, sin amenazar.
- Reciprocidad: dar valor primero (un tip, un caso, un diagnóstico) antes de pedir. El primer mensaje idealmente REGALA algo.
- Autoridad: muestra criterio y especificidad; el que sabe no necesita gritar.
- Compromiso y consistencia: recordá el paso que el lead YA dio ("dejaste tus datos", "estabas muy cerca de decidir") para que el siguiente sea coherente.
- Escasez y urgencia: solo si son verdaderas (cupos, fecha real). La urgencia inventada se nota y espanta.
Un mensaje suele apoyarse en UN gatillo dominante, no en todos a la vez.`,
  },
  {
    titulo: 'Anatomía de una secuencia de nutrición',
    categoria: 'Secuencias',
    cuerpo: `Una secuencia es una conversación en el tiempo, no mensajes sueltos:
- Un objetivo por mensaje (el "one job"): agendar, reagendar, cobrar, reactivar. Nunca dos.
- Valor primero, pedido después. Los primeros toques dan (caso, tip, empatía); el pedido crece de a poco.
- Cada toque cambia de ÁNGULO, no repite el anterior con otras palabras: recordatorio → prueba social → salida digna.
- Cadencia con aire: pronto el primero (horas), después días. Nunca dos mensajes al mismo lead el mismo día.
- Cada mensaje: una sola CTA y siempre una salida digna ("si no es el momento, avisame y no te escribo más").
- Adaptá el rol al cohorte: "no agendó" busca la llamada; "no-show" quita fricción para reagendar; "no paga" resuelve la objeción de pago; "reactivación" reabre sin culpa.
- El tono sube en calidez cuanto más frío está el lead, y baja en presión.`,
  },
  {
    titulo: 'CTA y cierre: una acción, sin presión',
    categoria: 'CTA',
    cuerpo: `El cierre define si el mensaje convierte:
- Una sola CTA por mensaje. Dos opciones = ninguna acción.
- Verbo claro + baja fricción: "Agenda aquí" / "Responde este mail y lo vemos". Que el próximo paso cueste 10 segundos.
- Reducí el riesgo percibido: "llamada corta", "sin compromiso", "en el horario que mejor te venga".
- Salida digna SIEMPRE: dale permiso de decir que no. Paradójicamente sube la respuesta y protege la relación.
- Cierra como humano, no como sistema: nada de "Saludos cordiales, el equipo". Firma personal, cercana.
- Los placeholders de acción ([tu link de agenda], [tu link de pago]) NO se inventan: se dejan tal cual para que el sistema los complete.`,
  },
  {
    titulo: 'Qué MaKo NUNCA hace al escribir',
    categoria: 'Guardarraíles',
    cuerpo: `Lista de prohibiciones (si un borrador cae en esto, se reescribe):
- "Solo te escribo para dar seguimiento", "¿sigues interesado?", "paso a saludar": mendigan atención y no aportan. Prohibidos.
- Presionar, culpar o fingir urgencia. Nada de "última oportunidad" si no es verdad.
- Muros de texto. En WhatsApp, 2-4 líneas; en email, párrafos cortos y aire.
- Prometer resultados que el negocio no garantiza, inventar casos, precios, plazos o datos.
- Jerga de marketing y palabras spam ("GRATIS", "GANÁ DINERO", exceso de emojis/signos).
- Sonar a bot o a plantilla genérica: si el mensaje sirve igual para cualquier negocio, está mal.
- Copiar el mensaje anterior de la secuencia: cada toque aporta algo nuevo o no se manda.`,
  },
];

// ── Metodología: sembrar / estado ────────────────────────────────────────────

/** ¿Ya está sembrada la metodología curada en OWNER_WS? */
export async function metodoSembrado(): Promise<boolean> {
  return runWithWorkspace(OWNER_WS, () => cursoExiste(CURSO_COPY));
}

/**
 * Siembra la metodología curada en el workspace del DUEÑO (idempotente: si el
 * curso ya existe, no hace nada). Devuelve cuántas entradas creó. Debe llamarse
 * detrás de un guard owner-only (escribe conocimiento compartido a todos).
 */
export async function seedCopywritingMetodo(): Promise<number> {
  return runWithWorkspace(OWNER_WS, async () => {
    if (await cursoExiste(CURSO_COPY)) return 0;
    let creadas = 0;
    for (const m of METODO) {
      try {
        await createKnowledge({
          titulo: m.titulo, categoria: m.categoria, cuerpo: m.cuerpo,
          curso: CURSO_COPY, autor: 'MaKo', area: 'mensajes', fuente: 'mako', activo: true,
        });
        creadas += 1;
      } catch (e) {
        console.error(`[copywriting-metodo] seed "${m.titulo}" falló: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return creadas;
  });
}

// ── Swipe de ejemplos (area='ejemplos', en OWNER_WS) ─────────────────────────

export type EjemploSwipe = { id: number; titulo: string; fuente: string | null; cuerpo: string; created_at: string };
export type NuevoEjemplo = { asunto?: string; cuerpo: string; nota?: string; fuente?: string };

function aEjemplo(k: KnowledgeEntry): EjemploSwipe {
  return { id: k.id, titulo: k.titulo, fuente: k.categoria, cuerpo: k.cuerpo, created_at: k.created_at };
}

/**
 * Guarda un email/ejemplo real como referencia (few-shot) para el generador.
 * En OWNER_WS → sirve de referencia a la redacción de MaKo de todos los clientes.
 */
export async function addEjemplo(input: NuevoEjemplo): Promise<EjemploSwipe | null> {
  const cuerpo = (input.cuerpo ?? '').trim();
  if (!cuerpo) throw new Error('El ejemplo no puede estar vacío.');
  const asunto = (input.asunto ?? '').trim();
  const nota = (input.nota ?? '').trim();
  const bloque = [
    asunto ? `Asunto: ${asunto}` : '',
    `Mensaje:\n${cuerpo}`,
    nota ? `Por qué funciona: ${nota}` : '',
  ].filter(Boolean).join('\n\n');
  return runWithWorkspace(OWNER_WS, async () => {
    const k = await createKnowledge({
      titulo: asunto || cuerpo.slice(0, 60),
      categoria: (input.fuente ?? '').trim() || null,
      cuerpo: bloque,
      curso: CURSO_SWIPE, autor: 'swipe', area: AREA_EJEMPLOS, fuente: 'ejemplo', activo: true,
    });
    return k ? aEjemplo(k) : null;
  });
}

export async function listEjemplos(): Promise<EjemploSwipe[]> {
  return runWithWorkspace(OWNER_WS, async () => {
    const todo = await listKnowledge();
    return todo.filter((k) => k.area === AREA_EJEMPLOS).map(aEjemplo);
  });
}

export async function deleteEjemplo(id: number): Promise<void> {
  return runWithWorkspace(OWNER_WS, async () => {
    // Confirmá que es un ejemplo (no otra entrada de conocimiento) antes de borrar.
    const todo = await listKnowledge();
    if (!todo.some((k) => k.id === id && k.area === AREA_EJEMPLOS)) return;
    await deleteKnowledge(id);
  });
}

/**
 * Ejemplos más relevantes a un contexto (few-shot para el generador). Corre en el
 * workspace del que genera → el RAG trae los del dueño (swipe compartido) + los
 * propios. Devuelve texto formateado listo para inyectar, o ''.
 */
export async function ejemplosRelevantes(contexto: string, k = 3): Promise<string> {
  const hits = await searchKnowledge(contexto, k, { area: AREA_EJEMPLOS }).catch(() => []);
  if (!hits.length) return '';
  return hits.map((h, i) => `Ejemplo ${i + 1}${h.categoria ? ` (${h.categoria})` : ''}:\n${h.cuerpo}`).join('\n\n— — —\n\n');
}
