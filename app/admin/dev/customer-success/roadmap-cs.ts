// =============================================================================
// Customer Success — el roadmap de implementación
// =============================================================================
// Es EL Roadmap del área: reemplaza al genérico en vez de sumarse (ver
// `roadmapPropioDe` en ../paneles.tsx). Un área tiene UN roadmap.
//
// QUÉ VA ACÁ Y QUÉ NO. Solo pasos de implementación: qué hay que hacer, en qué
// orden, y concretamente en qué archivo o tabla. Nada de citas de reuniones,
// objeciones de venta, precios ni comparativas — eso es material del encargo y
// vive en docs/sprint-servicio-mauricio.md, que es donde se lee. El pedido fue
// literal: «Ahora SOLO queremos tener claridad en el roadmap de implementación,
// TODA TODA la paja eliminala».
//
// EL ORDEN ES EL ORDEN. La numeración es continua y corre a través de los
// grupos: el paso 01 es lo primero que hay que hacer. No es el orden de los
// cuatro frentes del Sprint sino el de las dependencias — la matriz vinculada va
// antes que el formulario, el prompt maestro y el tablero porque los tres
// preguntan o pintan lo mismo.
//
// ⚠️ La trampa que ya costó una corrección: el objetivo es un bucle de 5 pasos, y
// su paso 1 —«el cliente ve el video»— es el ÚLTIMO en poder correr, porque
// necesita la plataforma. Los pasos del bucle NO son pasos del roadmap: por eso
// acá no aparecen como tales, y cada grupo dice qué habilita.
//
// LO POSTERIOR NO SE RESUME: se convierte en pasos. Los 12 módulos de la
// propuesta original (/vsl/mako-cs) están abajo, en `DESPUES`, con el mismo
// formato — menos los que ya se descartaron con motivo, que no son roadmap.
// =============================================================================

/** Cuatro estados. Los tres primeros son los de la casa (`Parte` en
 *  ../_registro/tipos.ts); `bloqueada` se suma porque es la única información
 *  que cambia qué se puede hacer hoy, y sin ella «en cola» miente. */
export type EstadoPaso = 'hecha' | 'sigue' | 'bloqueada' | 'cola';

export type Paso = {
  titulo: string;
  /** QUÉ hay que hacer, concreto: archivo, tabla, ruta. Una línea.
   *  Acepta `**negrita**` y `` `código` `` — lo pinta `texto()` del registro. */
  que: string;
  estado: EstadoPaso;
  /** Solo cuando NO lo hace Martín. Sin marca = lo hace él. */
  quien?: 'Mauricio' | 'Los dos';
  /** El título EXACTO de la tarea en /plan. Si no matchea, no se muestra número. */
  plan?: string;
};

export type Grupo = {
  titulo: string;
  /** Qué queda desbloqueado. Una línea, es el porqué del orden. */
  desbloquea: string;
  pasos: Paso[];
};

// ─────────────────────────────────────────────────────────────────────────────
// EL SPRINT — lo urgente con Mauricio
// ─────────────────────────────────────────────────────────────────────────────

export const OBJETIVO = 'Que el cliente haga el trabajo y Mauricio solo ponga el criterio: ve el video del bloque, completa la tarea, la discuten, la IA la reescribe con el Fathom y él la aprueba.';

export const GRUPOS: Grupo[] = [
  {
    titulo: 'Destrabar',
    desbloquea: 'Todo lo demás. Nada es código, y por eso se posterga solo.',
    pasos: [
      { titulo: 'Recibir los 5 entregables de Mauricio', quien: 'Mauricio', estado: 'bloqueada',
        que: 'Timing por bloque, esfuerzo del cliente, llamadas por bloque, qué hace a mano y qué le cuesta entender. **Sin esto no se puede estructurar el programa.**' },
      { titulo: 'Mandarle el bucle por escrito y renegociar el frente 04', estado: 'sigue', plan: 'Reencuadrar el sprint con Mauricio: los 5 pasos y el frente 04',
        que: 'Los 5 pasos y los 5 entregables en un documento, y cambiar los «5 casos de éxito» por la oferta de renovación de oct/nov.' },
      { titulo: 'Contratar plan propio de Claude y auto-limitarse', estado: 'cola', plan: 'Auto-límite del consumo de IA sobre la cuenta de Claude de Mauricio',
        que: 'Plan de US$200 propio + tope de porcentaje sobre el Cloud de Mauricio, con el gasto visible en `/integraciones`.' },
      { titulo: 'Verificar la cuota del 10 de agosto', estado: 'cola',
        que: 'La segunda del sprint. El 6/8 quedó impaga.' },
    ],
  },
  {
    titulo: 'La matriz vinculada',
    desbloquea: 'El formulario, el prompt maestro y el tablero: los tres preguntan o pintan lo mismo.',
    pasos: [
      { titulo: 'Cerrar cuántos campos tiene la ficha de palanca', quien: 'Los dos', estado: 'cola',
        que: 'El cuestionario dice nueve, su tabla lista diez y la que dictó tiene siete. Una pregunta, cinco minutos.' },
      { titulo: 'Escribir `lib/tablero-matriz.ts`', estado: 'cola', plan: 'La matriz vinculada y su validador: el esquema del tablero de un cliente',
        que: 'El tipo de las 14 columnas (MCI → LAG → área → palanca → umbrales → evidencia → corte). **Sin `server-only`**, molde `lib/landing-spec.ts`.' },
      { titulo: 'Validador `validarMatriz()` con las 6 auditorías', estado: 'cola',
        que: 'Área sin objetivo · MCI sin área · objetivo con +3 palancas · palanca repetida · responsable sin autoridad · habilitadora sin objetivo. Más traslape de umbrales. Con test propio.' },
    ],
  },
  {
    titulo: 'Que el tablero salga solo',
    desbloquea: 'Su mayor sangría: seis tableros en cola, codeados de madrugada.',
    pasos: [
      { titulo: 'Registrar el prompt maestro en `lib/prompt-registry.ts`', estado: 'cola', plan: 'El prompt maestro que arma el tablero de un cliente',
        que: 'Editable desde `/contexto` con historial. Que **llene** —proponga evidencia y umbrales desde los otros clientes— y devuelva la tabla de huecos.' },
      { titulo: 'Generar la skill de Claude Code que emite el tablero', estado: 'cola', plan: 'La skill de Claude Code que emite el tablero del cliente',
        que: 'Toma la matriz validada y escribe el código. Generada desde el repo, con `--check` en el pre-push (molde `lib/agente-skill.ts`).' },
      { titulo: 'Correrla contra un tablero ya hecho', quien: 'Los dos', estado: 'cola',
        que: 'Esquer o Baja Teriyaki. Si no lo reproduce, no sirve.' },
    ],
  },
  {
    titulo: 'Que la plataforma exista · Whop',
    desbloquea: 'Que el cliente vea el video del bloque antes de la reunión.',
    pasos: [
      { titulo: 'Crear `lib/whop.ts` y registrar la integración', estado: 'sigue', plan: 'Conectar Whop por API para la plataforma de contenido',
        que: 'Cliente de la API con credencial por workspace, dado de alta en **los dos catálogos** (`lib/integraciones.ts` y `lib/metodo-catalogo.ts`). No se desarrolla la plataforma: se conecta.' },
      { titulo: 'Traer el avance del cliente desde Whop', estado: 'cola',
        que: 'Cron que lee qué bloque completó cada uno y lo deja legible desde MaKo.' },
      { titulo: 'Sacar el `const WS = 1` de `/api/compartir`', estado: 'cola', plan: 'Sacar el `const WS = 1` de la ruta que comparte material',
        que: 'Que `curso` sea un recurso por workspace apoyado en `mako_knowledge`, que ya es tenant-scoped.' },
      { titulo: 'Montar el programa por bloques y dar de alta a los clientes', quien: 'Los dos', estado: 'bloqueada',
        que: 'La estructura del programa en Whop con el video de cada bloque. Espera los 5 entregables.', plan: 'Montar el programa de Mauricio en Whop, por bloques' },
      { titulo: 'Grabar los videos de los bloques que más cuestan', quien: 'Mauricio', estado: 'bloqueada',
        que: 'Salen del quinto entregable. Es lo que de verdad toma tiempo de este grupo.' },
    ],
  },
  {
    titulo: 'Que el cliente haga la tarea',
    desbloquea: 'Que complete antes de la llamada y apruebe después: es lo que le saca el trabajo de encima.',
    pasos: [
      { titulo: 'Formulario del bloque, generado por IA', estado: 'cola', plan: 'El formulario del bucle: que el cliente haga la tarea antes de la llamada',
        que: 'Las preguntas salen de la matriz y se personalizan por cliente. Guarda una fila por bloque, no un jsonb en `app_settings` (last-write-wins sin CAS).' },
      { titulo: 'Pantalla de revisión y aprobación del cliente', estado: 'cola',
        que: 'Ve lo que reescribió la IA, lo pule y lo aprueba. Es el cierre del bucle.' },
      { titulo: 'Abrir Calendly recién cuando la tarea está completa', estado: 'cola',
        que: 'La llamada se gana. Mata la reunión de calendario fijo.' },
    ],
  },
  {
    titulo: 'Que la IA cierre el bucle',
    desbloquea: 'Que las respuestas se reescriban solas después de cada junta.',
    pasos: [
      { titulo: 'El Fathom de la reunión reescribe las respuestas', estado: 'cola', plan: 'Configurar Fathom e IA para actualizar formularios post-reunión',
        que: 'Engancha en el pipeline de reuniones que ya corre, y amplía las respuestas del bloque con lo que se habló.' },
      { titulo: 'Camino cuando no hay grabación', estado: 'cola',
        que: 'Que lo diga y ofrezca completar a mano. **Ya falló dos veces**: sin esto el bucle se corta entero.' },
    ],
  },
  {
    titulo: 'Que no se caiga nada',
    desbloquea: 'Que deje de sostener el seguimiento en la cabeza y en un Excel. No espera a nadie.',
    pasos: [
      { titulo: 'Cron de compromisos vencidos', estado: 'cola', plan: 'Implementar notificaciones proactivas de MaKo por WhatsApp sobre tareas pendientes',
        que: 'Barre `deadline` vencido agrupado por cliente y emite un aviso por día. Molde: `app/api/cron/tareas-verificar/route.ts`, que ya recorre workspaces. **Hoy tiene cero líneas.**' },
      { titulo: 'Tabla de seguimiento por cliente', estado: 'cola', plan: 'Etapa del encargo, próximo hito y estado por cliente',
        que: 'Etapa del encargo (0-4), próximo hito con fecha y estado manual, colgada del proyecto que ya existe. A `TENANT_TABLES` **y** a `TABLAS_RESET`. No llamarla `FASES`: ya hay tres.' },
      { titulo: 'Vista de cartera', estado: 'cola', plan: 'Vista de cartera + alertas de baja al dueño',
        que: 'Una fila por cliente: último contacto, compromisos abiertos, vencidos y próximo hito. Molde `app/admin/agente/page.tsx`.' },
      { titulo: 'Que el semáforo dé el guión, no el link', estado: 'cola', plan: 'Semáforo que razona alertas, no que solo linkea',
        que: 'Cada alerta de `app/general/page.tsx` pasa a ser una capacidad con acción (`lib/mako-capacidades.ts`) en vez de un `<Link>`.' },
    ],
  },
  {
    titulo: 'Que se cierre y vuelva a vender',
    desbloquea: 'Lo que les ofrece a los contratos que vencen en octubre y noviembre.',
    pasos: [
      { titulo: 'Escribir el protocolo de graduación', quien: 'Los dos', estado: 'cola', plan: 'Protocolo de graduación y salida de un cliente',
        que: 'Qué se entrega, cómo se cierra y cuándo. Es un documento, no software.' },
      { titulo: 'Definir la oferta de renovación de oct/nov', quien: 'Los dos', estado: 'cola',
        que: 'Lo único de este grupo con reloj. Ya está como prioridad del Perro en su board.' },
      { titulo: 'Pipeline de casos de éxito', estado: 'cola', plan: 'Pipeline de casos de éxito: del resultado al testimonio publicado',
        que: 'Tabla chica por estados: resultado → entrevista → editado → publicado. **Sin materia prima todavía**: ningún cliente llegó.' },
    ],
  },
  {
    titulo: 'La deuda con él',
    desbloquea: 'Nada técnico: es lo que sostiene la relación. No espera a nadie.',
    pasos: [
      { titulo: 'Vista móvil', estado: 'cola', plan: 'Bases mobile dentro del sistema global (una tarea por pantalla, sheets, 44 px)',
        que: 'Intentó usar MaKo desde el teléfono en vivo y no pudo.' },
      { titulo: 'Agendar la Junta 2 sin salir de la llamada', estado: 'cola', plan: 'Agendar la Junta 2 sin salir de la llamada',
        que: 'Camino corto desde la ficha del lead a reservar el horario, usable desde el celular.' },
      { titulo: 'Jerarquía en los avisos de WhatsApp', estado: 'cola', plan: 'Optimizar notificaciones de MaKo por WhatsApp para Mauricio',
        que: 'Que el accionable se distinga del informativo. El problema no es volumen: un aviso correcto quedó sepultado y le costó media reunión.' },
      { titulo: 'Arreglar el mapa de México', estado: 'cola', plan: 'El mapa de México pinta el estado equivocado, no un cero',
        que: 'Diccionario Meta→GeoJSON en `app/marketing/ad-charts.tsx` y devolver `null` en vez de `0`. Hoy el Estado de México se queda con el valor de CDMX.' },
      { titulo: 'Escribir el acuerdo de propiedad del código', estado: 'cola', plan: 'Dejar escrito el acuerdo de propiedad del código de MaKo',
        que: 'Quedó cerrado de palabra el 6/8 y sin registro.' },
      { titulo: 'Los otros bugs que reportó', estado: 'cola',
        que: '«Pregúntale a MaKo» roto · histórico que mezcla meses · audio de WhatsApp sin transcribir · filtro de fecha en costos de IA.' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// DESPUÉS DEL SPRINT — los 12 módulos de la propuesta, como pasos
// ─────────────────────────────────────────────────────────────────────────────
// Solo lo que sigue siendo trabajo. Lo que ya se descartó con motivo (NPS, CES,
// churn rate, gamificación, momentos wow, escudo de disputas, blindaje legal,
// firma de contrato, asignación de consultor) NO está: un roadmap con pasos que
// nadie va a hacer no es un roadmap. Y lo que se adelantó al sprint tampoco se
// repite acá.

export const DESPUES: Grupo[] = [
  {
    titulo: 'Arranque del cliente',
    desbloquea: 'Que el pago se vuelva cliente listo sin intervención.',
    pasos: [
      { titulo: 'Etapa posterior a `ganado` en el pipeline', estado: 'cola',
        que: 'Hoy `lib/pipeline.ts` termina en `ganado`: no hay dónde vive un cliente en entrega.' },
      { titulo: 'Traspaso automático de venta a servicio', estado: 'cola',
        que: 'El que paga entra solo al circuito: datos, accesos y bienvenida.' },
      { titulo: 'Tracker de arranque', estado: 'cola',
        que: 'En qué paso del onboarding está cada cliente nuevo, para ver quién se trabó antes de empezar.' },
    ],
  },
  {
    titulo: 'La sesión de cada semana',
    desbloquea: 'Que el trabajo recurrente no dependa de la memoria de Mauricio.',
    pasos: [
      { titulo: 'Preparación de sesión', estado: 'cola',
        que: 'Diez minutos antes, el resumen del cliente y el objetivo del día.' },
      { titulo: 'Fases del programa configurables por workspace', estado: 'cola',
        que: 'Hoy son constantes de código (`lib/fase-diagnostico.ts`): cada consultor tiene las suyas.' },
    ],
  },
  {
    titulo: 'Medir el resultado del cliente',
    desbloquea: 'La detección de «promesa cumplida», que enciende el growth loop.',
    pasos: [
      { titulo: 'Tracker de la promesa', estado: 'cola',
        que: 'La promesa que le hizo, medida: de dónde salió, dónde está y cuánto falta. Se apoya en la matriz.' },
      { titulo: 'KPIs del cliente', estado: 'cola',
        que: 'Tareas asignadas y cumplidas, sesiones entregadas, cuellos de botella.' },
      { titulo: 'Quick wins', estado: 'cola',
        que: 'Marcar las primeras victorias para usarlas temprano.' },
      { titulo: 'Detector de promesa cumplida', estado: 'cola',
        que: 'Cuando llega a la meta, dispara caso de éxito, referido o ascenso.' },
    ],
  },
  {
    titulo: 'Que la entrega vuelva a vender',
    desbloquea: 'Que cada cliente feliz alimente el funnel.',
    pasos: [
      { titulo: 'Guía de entrevista de caso de éxito', estado: 'cola',
        que: 'Las preguntas listas y la grabación capturada sola.' },
      { titulo: 'Banco de testimonios', estado: 'cola',
        que: 'Los elogios de las sesiones, etiquetados y listos para marketing. Amplía lo que ya lee el pipeline de reuniones.' },
      { titulo: 'Motor de referidos', estado: 'cola',
        que: 'Avisa cuándo pedirlos, con el guión.' },
      { titulo: 'Tracking de referidos', estado: 'cola',
        que: 'Link propio por cliente: quién trajo a quién.' },
    ],
  },
  {
    titulo: 'Retener y recuperar',
    desbloquea: 'Anticipar una baja en vez de enterarse cuando ya pasó.',
    pasos: [
      { titulo: 'Analizar las llamadas de entrega', estado: 'cola', plan: 'Analizar las llamadas de entrega en vez de tirarlas',
        que: 'Hoy el triage las guarda con `status: descartada` y `summary: null`. Los datos ya existen, solo se tiran.' },
      { titulo: 'Termómetro de baja por cliente', estado: 'cola', plan: 'Termómetro de baja por cliente',
        que: 'Puntaje de riesgo que combina el ánimo de la última llamada con la cuota impaga y las señales del CRM.' },
      { titulo: 'Encuesta de satisfacción por instancia', estado: 'cola',
        que: 'Arranque, módulos, 1:1, grupales, pago. Hoy hay 4 respuestas de una encuesta anónima y nada en el código.' },
      { titulo: 'Flujo de pausa y cancelación', estado: 'cola',
        que: 'Entender el porqué, proponer pausa, recordar la garantía.' },
      { titulo: 'Gestión de cobros del cliente', estado: 'cola',
        que: 'Impagos que se persiguen solos y la próxima fecha a la vista. Parte existe: `getCuotasPendientes`.' },
    ],
  },
  {
    titulo: 'La entrega de a muchos',
    desbloquea: 'El modelo grupal, que es su camino declarado a los US$50K.',
    pasos: [
      { titulo: 'Gestión de camadas', estado: 'cola',
        que: 'Los clientes por cohorte, no solo de a uno.' },
      { titulo: 'Sesiones grupales con Q&A', estado: 'cola',
        que: 'Formulario de preguntas antes, hoja de Q&A después, cada pregunta registrada por cliente.' },
      { titulo: 'Grabaciones con marcas de tiempo', estado: 'cola',
        que: 'La grabación sube con cada pregunta marcada en su minuto.' },
      { titulo: 'Check-ins automáticos', estado: 'cola',
        que: 'MaKo le pregunta a cada cliente cómo va, sin intervención.' },
      { titulo: 'Grupos de accountability', estado: 'cola',
        que: 'Armar grupos entre clientes para que se empujen entre ellos.' },
    ],
  },
  {
    titulo: 'Operación y equipo',
    desbloquea: 'Que el servicio deje de depender de que Mauricio esté.',
    pasos: [
      { titulo: 'Biblioteca de procesos (SOPs)', estado: 'cola',
        que: 'Su forma de entregar, documentada una vez y viva adentro de MaKo. Es el entregable «servicio escrito».' },
      { titulo: 'Roles y ruteo de eventos', estado: 'cola',
        que: 'Cada evento cae en el equipo correcto, con su tarea y su fecha.' },
      { titulo: 'Arreglar «Pregúntale a MaKo»', estado: 'cola',
        que: 'Lo reportó roto el 31/7. Es la puerta a todo lo de arriba: preguntar por un cliente y que responda con su historial.' },
    ],
  },
];

/** Los títulos que el roadmap reclama del tablero. Derivado de los datos. */
export const TITULOS_EN_PLAN: string[] =
  [...GRUPOS, ...DESPUES].flatMap((g) => g.pasos.map((p) => p.plan).filter((t): t is string => !!t));

export const TOTAL_SPRINT = GRUPOS.reduce((n, g) => n + g.pasos.length, 0);
export const TOTAL_DESPUES = DESPUES.reduce((n, g) => n + g.pasos.length, 0);

/** Cuántos pasos hay en cada estado, para el resumen del encabezado. */
export function conteo(grupos: Grupo[]): Record<EstadoPaso, number> {
  const out: Record<EstadoPaso, number> = { hecha: 0, sigue: 0, bloqueada: 0, cola: 0 };
  for (const g of grupos) for (const p of g.pasos) out[p.estado]++;
  return out;
}
