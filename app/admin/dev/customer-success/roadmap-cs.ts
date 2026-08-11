// =============================================================================
// Customer Success: el objetivo, y el camino para llegar
// =============================================================================
// Esta pantalla reemplaza al Roadmap genérico del área (el que sale del plan).
// NO convive con él: el dueño lo dijo sin vueltas —«No entiendo porque hay 2 tabs
// de roadmap»— y tenía razón, eran TRES listas parecidas apiladas (las PARTES de
// la bitácora, este panel y RoadmapDelPlan). Ahora hay una sola, y las tareas del
// plan se resuelven POR TÍTULO adentro de cada paso: el camino da el orden, el
// tablero da el estado. Ver `roadmapPropioDe` en ../paneles.tsx.
//
// LA SEPARACIÓN QUE FALTABA, y es la que hacía que no se entendiera:
//
//   · EL OBJETIVO es cómo va a FUNCIONAR el servicio cuando esté: el bucle de 5
//     pasos. No es trabajo, es el destino. No tiene estado ni orden de ejecución.
//   · EL CAMINO es lo que hay que CONSTRUIR para que ese bucle pueda correr, en
//     orden de dependencia real.
//
// Mezclarlos producía el absurdo que el dueño marcó: «si dentro de los 5 pasos
// está uno que el cliente se vea el curso, no puede estar como paso posterior el
// crear la plataforma». El paso 1 del bucle es el ÚLTIMO en poder correr, porque
// necesita la plataforma que la fase 3 construye. Por eso cada fase declara qué
// paso del bucle habilita (`habilita`) en vez de hacerse pasar por uno.
//
// El orden NO es el de los cuatro frentes del Sprint: es el de las dependencias.
// La matriz vinculada va primero porque es el esqueleto que usan el formulario,
// el prompt maestro y el tablero — construir cualquiera de los tres antes es
// construirlo sobre una suposición.
//
// De dónde sale: docs/sprint-servicio-mauricio.md (las 7 reuniones del 4/7 al 6/8)
// y public/vsl-assets/mako-cs.html para la sección «Después».
// =============================================================================

import type { Tono } from '@/app/_ui';

export type EstadoCS =
  | 'hecho'        // construido y enchufado
  | 'en-curso'     // se está trabajando ahora
  | 'bloqueado'    // no avanza hasta que pase otra cosa
  | 'proximo'      // decidido, sin arrancar
  | 'idea'         // está en la propuesta, no se decidió
  | 'descartado';  // se evaluó y se dejó afuera, con motivo

/** El tono sale de la paleta compartida (`TONO`), nunca de un `var(--…)` al lado. */
export const ESTADO_CS: Record<EstadoCS, { label: string; tono: Tono }> = {
  hecho: { label: 'Hecho', tono: 'good' },
  'en-curso': { label: 'En curso', tono: 'mako' },
  bloqueado: { label: 'Bloqueado', tono: 'bad' },
  proximo: { label: 'Próximo', tono: 'warn' },
  idea: { label: 'Sin decidir', tono: 'neutral' },
  descartado: { label: 'Descartado', tono: 'neutral' },
};

export type ItemCS = {
  titulo: string;
  que: string;
  estado: EstadoCS;
  /** Quién lo hace. Sin esto, la mitad del camino parece trabajo de Martín y no lo es. */
  quien?: 'Martín' | 'Mauricio' | 'Los dos';
  /** El TÍTULO EXACTO de la tarea en /plan. La pantalla lo resuelve contra el tablero
   *  y muestra su número y su avance. Si no matchea, no inventa: no muestra nada. */
  plan?: string;
  /** El tag que el documento original le mostró a Mauricio. No es el estado de hoy. */
  tagOriginal?: 'listo' | 'expande';
  nota?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// EL OBJETIVO — cómo va a funcionar el servicio. No es trabajo.
// ─────────────────────────────────────────────────────────────────────────────

export const OBJETIVO = {
  titulo: 'Que el servicio de Mauricio corra como un bucle',
  que:
    'Hoy cada cliente le cuesta madrugadas: él llena el Excel, él redacta el documento, él codea el tablero. El objetivo es dar vuelta quién hace el trabajo — que el cliente lo haga y Mauricio solo aporte criterio. El efecto que él mismo puso en números: que el programa baje de 4-5 meses a 3, y que pueda atender más clientes sin sumar horas.',
  cita:
    '«si yo puedo tener una plataforma donde ponga más a trabajar al cliente y me quite tareas, pero que sea más asertivo, eso va a poder aumentar mi capacidad instalada para poder generar los 20 mil» — Mauricio, 29/7 [01:56:38]',
  /** Los 5 pasos, definidos el 31/7 [03:46:44]. El destino, no la lista de tareas. */
  pasos: [
    { n: 1, titulo: 'El cliente ve el video del bloque', que: 'Antes de la reunión, por su cuenta. Mauricio deja de explicar la metodología en vivo, cliente por cliente, cada vez.', necesita: 'Necesita la plataforma · fase 3' },
    { n: 2, titulo: 'Hace la tarea, y recién ahí se agenda la llamada', que: '«obligatorio que tu cliente se termine la tarea para avanzar en el proceso, si no se terminó la tarea está en su cancha el problema». La llamada se gana, no se regala.', necesita: 'Necesita el formulario · fase 4' },
    { n: 3, titulo: 'En la llamada revisan y perfeccionan', que: 'La llamada deja de ser extracción de datos y pasa a ser criterio. Es lo único que Mauricio dijo que no delega.', necesita: 'Ya funciona así' },
    { n: 4, titulo: 'La IA reescribe con el Fathom de esa reunión', que: 'Mata el «peinado» manual que hoy hace él después de cada junta.', necesita: 'Necesita el enganche con Fathom · fase 5' },
    { n: 5, titulo: 'El cliente entra, pule y aprueba', que: 'La propiedad queda del lado del cliente. Y el efecto que Mauricio más valora: el empresario tiene claridad ANTES de que exista el tablero.', necesita: 'Necesita el formulario · fase 4' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// EL CAMINO — lo que hay que construir, en orden de dependencia
// ─────────────────────────────────────────────────────────────────────────────

export type FaseCS = {
  n: string;
  titulo: string;
  /** Qué queda desbloqueado cuando esta fase cierra. Es el porqué del orden. */
  desbloquea: string;
  /** Qué tiene que estar antes. Vacío = se puede arrancar hoy. */
  necesita?: string;
  /** Puede correr sin esperar a las anteriores. */
  paralelo?: boolean;
  items: ItemCS[];
};

export const FASES: FaseCS[] = [
  {
    n: '0',
    titulo: 'Destrabar lo que frena todo',
    desbloquea: 'Todo lo demás. Nada de esto es código, y por eso se posterga solo.',
    items: [
      {
        titulo: 'Recibir los 5 entregables de Mauricio',
        que: 'Timing por bloque · esfuerzo del cliente · cuántas llamadas por bloque · qué hace él a mano hoy · qué le cuesta más entender al cliente.',
        estado: 'bloqueado', quien: 'Mauricio',
        nota: 'Prometidos el 6/8 [01:09:37] «Ya los tengo, ya te lo envío hoy mismo», sin confirmación de recepción. Sin esto no se puede estructurar el programa (fase 3). El quinto ES la lista de videos a grabar.',
      },
      {
        titulo: 'Reencuadrar el sprint y renegociar el frente 04',
        que: 'Mandarle por escrito el bucle y los 5 entregables, y cambiar los 5 casos de éxito por algo que sí se pueda entregar.',
        estado: 'proximo', quien: 'Martín', plan: 'Reencuadrar el sprint con Mauricio: los 5 pasos y el frente 04',
        nota: 'El 6/8 ninguno de los dos se acordaba de la lista de cinco. Y el frente 04 no tiene materia prima: ningún cliente llegó a la etapa que produce el caso.',
      },
      {
        titulo: 'Poner el consumo de IA bajo control',
        que: 'Plan propio de US$200 y auto-límite sobre el Cloud de Mauricio, con el consumo visible para él.',
        estado: 'proximo', quien: 'Martín', plan: 'Auto-límite del consumo de IA sobre la cuenta de Claude de Mauricio',
        nota: '⚠️ Ya le costó tres días de trabajo con un cliente suyo, y bloqueó justamente el frente 01. El acuerdo está cerrado desde el 6/8 y sin ejecutar.',
      },
      {
        titulo: 'Verificar la cuota del 10 de agosto',
        que: 'La segunda cuota del sprint. El 6/8 quedó impaga, con promesa de pago ese día y problema de caja declarado.',
        estado: 'proximo', quien: 'Martín',
      },
    ],
  },
  {
    n: '1',
    titulo: 'La matriz vinculada: el esqueleto',
    desbloquea: 'El formulario (fase 4), el prompt maestro (fase 2) y el tablero. Los tres preguntan o pintan LO MISMO.',
    items: [
      {
        titulo: 'El tipo de la matriz y el validador de las 6 auditorías',
        que: 'Las 14 columnas del Cuestionario Maestro (MCI → Objetivo LAG → Área → Palanca → cómo se mide → verde/amarillo/rojo → evidencia → corte) y las 6 verificaciones que las rechazan.',
        estado: 'proximo', quien: 'Martín', plan: 'La matriz vinculada y su validador: el esquema del tablero de un cliente',
        nota: 'Mauricio ya lo entregó escrito: su cuestionario termina en esa tabla y trae su propia capa de verificación. Va sin `server-only` para que un test lo importe.',
      },
      {
        titulo: 'Cerrar cuántos campos tiene la ficha de palanca',
        que: 'El texto del cuestionario dice nueve, la tabla del Bloque 4 lista diez, y la que él dictó el 31/7 tiene siete.',
        estado: 'proximo', quien: 'Los dos',
        nota: 'Modelar antes de cerrarlo es modelar una suposición. Es una pregunta de cinco minutos.',
      },
    ],
  },
  {
    n: '2',
    titulo: 'Que el tablero salga solo',
    desbloquea: 'Su mayor sangría de tiempo: tiene seis tableros en cola y los codea de madrugada.',
    necesita: 'La matriz (fase 1). No necesita la plataforma.',
    items: [
      {
        titulo: 'El prompt maestro, editable desde /contexto',
        que: 'Que llene y después emita: proponer evidencia y umbrales a partir de lo que ya funcionó en sus otros clientes, y devolver la tabla de huecos con responsable y fecha.',
        estado: 'proximo', quien: 'Martín', plan: 'El prompt maestro que arma el tablero de un cliente',
        nota: '⚠️ El reencuadre que decide si sirve: su cuello NO es codear. Sus propios documentos dicen que el bloqueo #1 del programa es DEFINIR LA EVIDENCIA (tres semanas paradas con Patricia) y el #2 poner el umbral. Un prompt que toma un cuestionario ya lleno resuelve el último tramo.',
      },
      {
        titulo: 'La skill de Claude Code que emite el tablero',
        que: 'Toma la matriz validada y escribe el código. Generada DESDE el código, con `--check` en el pre-push.',
        estado: 'proximo', quien: 'Martín', plan: 'La skill de Claude Code que emite el tablero del cliente',
        nota: 'MaKo no emite código en runtime en ningún lado. El riel de skill generada ya existe (lib/agente-skill.ts:56).',
      },
      {
        titulo: 'Probarlo contra un tablero que él YA hizo',
        que: 'Esquer o Baja Teriyaki. Si no reproduce lo que construyó a mano, no sirve.',
        estado: 'proximo', quien: 'Los dos',
      },
    ],
  },
  {
    n: '3',
    titulo: 'Que la plataforma exista · Whop',
    desbloquea: 'El PASO 1 del bucle: que el cliente vea el video antes de la reunión.',
    necesita: 'Los 5 entregables (fase 0) para saber qué bloques hay y qué videos grabar.',
    items: [
      {
        titulo: 'Conectar Whop por API',
        que: 'Alta de la integración con credenciales por workspace. No se desarrolla la plataforma: se conecta.',
        estado: 'en-curso', quien: 'Martín', plan: 'Conectar Whop por API para la plataforma de contenido',
        nota: 'Elegida el 11/8 por ser la gratuita con API. Cierra el compromiso más viejo del sprint: la comparativa se prometió el 8/7.',
      },
      {
        titulo: 'Montar el programa por bloques y dar de alta a los clientes',
        que: 'La estructura del programa con el video de cada bloque, y los clientes activos adentro.',
        estado: 'bloqueado', quien: 'Los dos', plan: 'Montar el programa de Mauricio en Whop, por bloques',
        nota: 'Restricciones dichas por él: nada de Notion, y «son empresarios que todos tienen TDAH… la mayoría no creas que le sabe la computadora».',
      },
      {
        titulo: 'Grabar los videos de los bloques que más cuestan',
        que: 'Salen del quinto entregable: los puntos que el cliente no entiende son exactamente los videos que hacen falta.',
        estado: 'bloqueado', quien: 'Mauricio',
        nota: 'Esto es lo que de verdad toma tiempo del frente 02. El software es un día; los otros 59 son él grabando.',
      },
      {
        titulo: 'Sacar el `const WS = 1` de la ruta que comparte material',
        que: 'Hoy compartir un curso está clavado al workspace 1: ningún otro cliente puede compartir el suyo.',
        estado: 'proximo', quien: 'Martín', plan: 'Sacar el `const WS = 1` de la ruta que comparte material',
      },
    ],
  },
  {
    n: '4',
    titulo: 'Que el cliente haga la tarea',
    desbloquea: 'Los PASOS 2 y 5 del bucle, que son los que le sacan el trabajo de encima.',
    necesita: 'La matriz (fase 1) para saber qué preguntar, y la plataforma (fase 3) para que viva ahí.',
    items: [
      {
        titulo: 'El formulario del bloque, y la aprobación del cliente',
        que: 'El cliente completa la tarea antes de la llamada, y después vuelve a pulir y aprobar lo que la IA reescribió.',
        estado: 'proximo', quien: 'Martín', plan: 'El formulario del bucle: que el cliente haga la tarea antes de la llamada',
        nota: 'La forma la propuso él: «un formulario mediante inteligencia artificial, que la IA razone qué pregunta personalizada le tiene que hacer». Y su restricción: «no quiero automatizar algo que todavía no está estandarizado».',
      },
      {
        titulo: 'La llamada se agenda cuando la tarea está terminada',
        que: 'Calendly se abre recién ahí. Es lo que mata la reunión de calendario fijo.',
        estado: 'proximo', quien: 'Martín',
      },
    ],
  },
  {
    n: '5',
    titulo: 'Que la IA cierre el bucle',
    desbloquea: 'El PASO 4: las respuestas del cliente se reescriben solas después de cada junta.',
    necesita: 'El formulario (fase 4): sin respuestas cargadas no hay nada que reescribir.',
    items: [
      {
        titulo: 'El Fathom de la reunión reescribe las respuestas',
        que: 'Lo que hoy hace Mauricio a mano: «Siempre lo redacto yo como una hipótesis y luego en la junta lo vamos peinando».',
        estado: 'proximo', quien: 'Martín', plan: 'Configurar Fathom e IA para actualizar formularios post-reunión',
      },
      {
        titulo: 'El camino cuando no hay grabación',
        que: 'Que el sistema lo diga y ofrezca completar a mano, en vez de quedarse callado.',
        estado: 'proximo', quien: 'Martín',
        nota: '⚠️ Ya falló dos veces documentadas: el 16/7 Artemisa no entró a las juntas de todo un día, y el 31/7 «no jaló la IA, no hubo de Esquer». Sin este camino, el bucle se corta entero cada vez.',
      },
    ],
  },
  {
    n: '6',
    titulo: 'Que no se caiga nada',
    desbloquea: 'Que Mauricio deje de sostener el seguimiento en la cabeza y en un Excel.',
    paralelo: true,
    items: [
      {
        titulo: 'Aviso de compromiso vencido',
        que: 'Un barrido de `deadline < hoy` agrupado por cliente. Es la misma consulta que ya corre, al revés.',
        estado: 'proximo', quien: 'Martín', plan: 'Implementar notificaciones proactivas de MaKo por WhatsApp sobre tareas pendientes',
        nota: '⭐ Lo más barato de todo el encargo y lo primero que él ve. Hoy tiene CERO líneas: `grep -rn "deadline" app/api/cron/` no devuelve nada.',
      },
      {
        titulo: 'La vista de cartera',
        que: 'Una fila por cliente con último contacto, compromisos abiertos, vencidos y próximo hito. Sin depender del puntaje de riesgo.',
        estado: 'proximo', quien: 'Martín', plan: 'Vista de cartera + alertas de baja al dueño',
        nota: 'Está más cerca de lo que parece: sus seis clientes YA son proyectos de su tablero y sus reuniones YA caen en el cliente correcto.',
      },
      {
        titulo: 'Etapa del encargo, próximo hito y estado',
        que: 'Lo único que no se deriva de nada y necesita tabla propia.',
        estado: 'proximo', quien: 'Martín', plan: 'Etapa del encargo, próximo hito y estado por cliente',
        nota: '⚠️ No puede llamarse `FASES`: ya hay TRES en el repo que compilan sin conflicto. Sugerido `ETAPAS_ENCARGO`.',
      },
      {
        titulo: 'El semáforo que da el guión, no el link',
        que: 'Que cada alerta traiga qué hacer según el motivo, en vez de mandarte a la pantalla donde el problema se ve.',
        estado: 'proximo', quien: 'Martín', plan: 'Semáforo que razona alertas, no que solo linkea',
        nota: '⭐ Es su pedido más fuerte —«¿qué me va a dar el valor de que la herramienta sea mi brújula? Porque obligas a la gente»— y sirve a TODOS los workspaces. La propuesta original ya lo vendía como hecho.',
      },
    ],
  },
  {
    n: '7',
    titulo: 'Que se cierre y vuelva a vender',
    desbloquea: 'Lo que Mauricio les ofrece a los contratos que vencen en octubre y noviembre.',
    necesita: 'Que haya clientes que hayan terminado. Hoy no hay ninguno.',
    items: [
      {
        titulo: 'Protocolo de graduación y salida',
        que: 'Qué se entrega, cómo se cierra y cuándo. Es la fase 4 de su programa, que hoy no está definida.',
        estado: 'proximo', quien: 'Los dos', plan: 'Protocolo de graduación y salida de un cliente',
        nota: 'Es un documento, no software.',
      },
      {
        titulo: 'La oferta de renovación de octubre/noviembre',
        que: 'Lo que reemplaza al frente 04. Es lo único de esta fase que tiene reloj.',
        estado: 'proximo', quien: 'Los dos',
        nota: '8/7 [01:20:25]: «en octubre y noviembre van a empezar a vencerse ya. Entonces, ¿qué les voy a ofrecer? No está claro». Ya está como prioridad del Perro en su board.',
      },
      {
        titulo: 'Pipeline de casos de éxito',
        que: 'De «logró la promesa» a testimonio publicado, por estados.',
        estado: 'idea', quien: 'Martín', plan: 'Pipeline de casos de éxito: del resultado al testimonio publicado',
        nota: '⚠️ No hay materia prima: 29/7 «No tengo ningún cliente que todavía ha llegado a las juntas o a la implementación de los tableros».',
      },
    ],
  },
  {
    n: '⚠',
    titulo: 'La deuda con él',
    desbloquea: 'Nada técnico. Es lo que sostiene la relación — y cada hora que no sale de acá le da la razón a su objeción del 8/7: «es nice, es cool, es wow, pero no es el core».',
    paralelo: true,
    items: [
      { titulo: 'Vista móvil', que: 'Intentó usar MaKo desde el teléfono en vivo el 6/8 y no pudo. «La mayoría andamos en el tema del celular o la tablet».', estado: 'proximo', quien: 'Martín', plan: 'Bases mobile dentro del sistema global (una tarea por pantalla, sheets, 44 px)' },
      { titulo: 'Agendar la Junta 2 sin salir de la llamada', que: 'Terminó cargándola a mano en su calendario porque «no me acuerdo dónde».', estado: 'proximo', quien: 'Martín', plan: 'Agendar la Junta 2 sin salir de la llamada' },
      { titulo: 'El aviso importante se pierde entre el ruido', que: 'MaKo le avisó de una reunión y el mensaje quedó sepultado. Le costó media reunión.', estado: 'proximo', quien: 'Martín', plan: 'Optimizar notificaciones de MaKo por WhatsApp para Mauricio' },
      { titulo: 'El mapa marca cero en Ciudad de México', que: 'No falta el dato: el `startsWith` bidireccional hace que el Estado de México se quede con el valor de CDMX.', estado: 'proximo', quien: 'Martín', plan: 'El mapa de México pinta el estado equivocado, no un cero' },
      { titulo: 'Dejar escrito el acuerdo de propiedad del código', que: 'Le dedicó 25 minutos el 6/8 y quedó cerrado de palabra, sin registro.', estado: 'proximo', quien: 'Martín', plan: 'Dejar escrito el acuerdo de propiedad del código de MaKo' },
      { titulo: 'Los otros bugs abiertos', que: '«Pregúntale a MaKo» no funciona · histórico que mezcla meses · crear proyecto por WhatsApp · audio de WhatsApp sin transcribir · la IA que archiva en el proyecto equivocado · filtro de fecha en costos.', estado: 'proximo', quien: 'Martín' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// DESPUÉS — la propuesta original, para cuando se abra el gatillo
// ─────────────────────────────────────────────────────────────────────────────

export const DESPUES = {
  intro:
    'Los 12 módulos y 52 features que se le presentaron el 8/7 por US$9.000 y que rechazó ese mismo día — no por precio sino por timing. No está muerto: lo aplazó con un gatillo explícito, «Si yo tengo eso para 15 y podemos empezar a tener testimonios de 5, a lo mejor ya estamos listos para escalar. Incluso hasta me vas a querer cobrar más». Los tags `listo` y `expande` son los que el documento le mostró: de las 10 marcadas `listo`, cuatro no lo estaban.',
  bloques: [
    { n: '01', titulo: 'Tu cartera', que: 'El hub: cada cliente y su estado en una pantalla.', items: [
      { titulo: 'Cartera de clientes', que: 'Ordenados del que necesita atención al que va bien.', estado: 'proximo' as EstadoCS, tagOriginal: 'listo' as const, nota: '⚠️ El tag mentía: no existe ninguna vista de cartera. Está en la fase 6.' },
    ] },
    { n: '02', titulo: 'Onboarding', que: 'El pago se vuelve cliente listo, sin mover un dedo.', items: [
      { titulo: 'Traspaso de venta a servicio', que: 'El que paga entra solo al circuito de entrega.', estado: 'idea' as EstadoCS, nota: 'El pipeline muere en `ganado`: no hay etapa posterior.' },
      { titulo: 'Firma de contrato', que: 'Sale, se firma y se archiva sin perseguir a nadie.', estado: 'descartado' as EstadoCS, nota: 'Es para volumen, no para 7 clientes.' },
      { titulo: 'Formulario de arranque', que: 'Se completa una vez y MaKo arma ficha, carpeta y perfil.', estado: 'proximo' as EstadoCS, nota: 'Se recicla como el formulario de la fase 4.' },
      { titulo: 'Tracker de onboarding', que: 'En qué paso del arranque está cada cliente nuevo.', estado: 'idea' as EstadoCS },
      { titulo: 'Asignación de consultor', que: 'MaKo sugiere el consultor que mejor calza.', estado: 'descartado' as EstadoCS, nota: 'Mauricio es el único consultor.' },
      { titulo: 'Filtro de pago', que: 'Nadie accede sin haber pagado.', estado: 'idea' as EstadoCS, nota: 'Whop ya lo resuelve.' },
    ] },
    { n: '03', titulo: 'El día a día', que: 'El trabajo recurrente, sin que se caiga nada. El módulo con más piezas ya construidas.', items: [
      { titulo: 'Preparación de sesión', que: 'Diez minutos antes, el resumen del cliente y el objetivo del día.', estado: 'idea' as EstadoCS, tagOriginal: 'listo' as const },
      { titulo: 'Bitácora automática', que: 'La sesión grabada se vuelve notas ordenadas en la ficha.', estado: 'hecho' as EstadoCS, tagOriginal: 'listo' as const, nota: 'Es el pipeline de Fathom, que ya corre. Y es el paso 4 del bucle.' },
      { titulo: 'Las dos canchas', que: 'Qué te toca a vos y qué al cliente, con responsable y fecha.', estado: 'hecho' as EstadoCS, tagOriginal: 'listo' as const },
      { titulo: 'Seguimiento que no falla', que: 'Si alguien no responde o no subió evidencia, MaKo avisa.', estado: 'proximo' as EstadoCS, tagOriginal: 'listo' as const, nota: '⚠️ El tag mentía en la mitad: la alerta de VENCIDO no existe. Está en la fase 6.' },
      { titulo: 'Fases configurables', que: 'Cada cliente avanza por las fases que vos definís.', estado: 'proximo' as EstadoCS, tagOriginal: 'listo' as const, nota: '⚠️ Las fases existen pero son CONSTANTES de código: no se configuran por workspace.' },
    ] },
    { n: '04', titulo: 'Resultados', que: 'Que el cliente logre lo prometido, medido.', items: [
      { titulo: 'Plan de acción', que: 'El roadmap de cada cliente, con hitos y fechas.', estado: 'proximo' as EstadoCS, nota: 'Es la salida del bucle: la matriz vinculada.' },
      { titulo: 'Tracker de resultado', que: 'La promesa medida: de dónde salió, dónde está, cuánto falta.', estado: 'idea' as EstadoCS },
      { titulo: 'KPIs del cliente', que: 'Tareas cumplidas, sesiones entregadas, cuellos de botella.', estado: 'idea' as EstadoCS },
      { titulo: 'Quick wins', que: 'Las primeras victorias, marcadas para usarlas temprano.', estado: 'idea' as EstadoCS },
      { titulo: 'Promesa cumplida', que: 'Cuando llega a su meta, dispara caso de éxito, referido o ascenso.', estado: 'idea' as EstadoCS, nota: 'Es el detector de la fase 7. Depende de la matriz.' },
    ] },
    { n: '05', titulo: 'Growth Loop', que: 'La entrega vuelve a vender.', items: [
      { titulo: 'Pipeline de casos de éxito', que: 'De «logró la promesa» a testimonio publicado, por estados.', estado: 'idea' as EstadoCS, nota: 'Ya está en la fase 7.' },
      { titulo: 'Guía de entrevista', que: 'Las preguntas listas y la grabación capturada sola.', estado: 'proximo' as EstadoCS },
      { titulo: 'Banco de testimonios', que: 'Los elogios de las sesiones, ordenados y etiquetados.', estado: 'idea' as EstadoCS, tagOriginal: 'expande' as const },
      { titulo: 'Motor de referidos', que: 'Avisa cuándo pedir referidos, con el guión listo.', estado: 'idea' as EstadoCS },
      { titulo: 'Tracking de referidos', que: 'Link propio por cliente: quién trajo a quién.', estado: 'idea' as EstadoCS },
      { titulo: 'Ascenso y renovación', que: 'Al terminar el ciclo, levanta la oferta del siguiente nivel.', estado: 'proximo' as EstadoCS, nota: 'Es lo que tiene reloj: octubre/noviembre. Está en la fase 7.' },
    ] },
    { n: '06', titulo: 'Retención y recupero', que: 'Hoy detectás el riesgo. Acá también actuás.', items: [
      { titulo: 'Satisfacción y riesgo', que: 'Qué tan conforme está cada cliente y quién está por irse.', estado: 'idea' as EstadoCS, tagOriginal: 'listo' as const, nota: '⚠️ El tag mentía: no hay NPS ni encuesta en el código.' },
      { titulo: 'Alarmas de churn', que: 'Comportamiento, KPIs e impagos disparan la alerta.', estado: 'idea' as EstadoCS, tagOriginal: 'expande' as const },
      { titulo: 'Guiones de recuperación', que: 'El guión correcto según el motivo del rojo.', estado: 'proximo' as EstadoCS, nota: '⭐ Ya está en la fase 6: es la bajada del doer y sirve a todos los workspaces.' },
      { titulo: 'Pausas y cancelaciones', que: 'Entender el porqué, proponer pausa, recordar la garantía.', estado: 'idea' as EstadoCS },
      { titulo: 'Gestión de cobros', que: 'Impagos que se persiguen solos y la próxima fecha a la vista.', estado: 'idea' as EstadoCS, nota: 'Parte ya existe: `getCuotasPendientes`.' },
      { titulo: 'Escudo de disputas', que: 'La evidencia armada si un cliente llama al banco.', estado: 'descartado' as EstadoCS },
      { titulo: 'Blindaje legal', que: 'Difamación y piratería: reclamos y guiones a mano.', estado: 'descartado' as EstadoCS },
    ] },
    { n: '07', titulo: 'Métricas', que: 'El tablero de mando de la entrega. Es el módulo más lejos de existir.', items: [
      { titulo: 'NPS', que: 'Calculado solo, con su tendencia.', estado: 'descartado' as EstadoCS, nota: 'Con ~7 clientes activos un NPS no significa nada.' },
      { titulo: 'Customer Effort Score', que: 'Qué tan fácil le resulta trabajar con vos.', estado: 'descartado' as EstadoCS },
      { titulo: 'Churn Rate', que: 'La tasa de bajas mes a mes.', estado: 'descartado' as EstadoCS },
      { titulo: 'Feedback multipunto', que: 'Satisfacción en cada instancia, no una encuesta.', estado: 'idea' as EstadoCS, tagOriginal: 'expande' as const, nota: 'Lo único rescatable: hoy tiene 4 respuestas de una encuesta anónima.' },
      { titulo: 'Ecuación de servicio', que: 'La salud de la entrega en un número.', estado: 'descartado' as EstadoCS },
    ] },
    { n: '08', titulo: 'Grupales y cohortes', que: 'Sube de prioridad: el grupal es su camino declarado a los US$50K.', items: [
      { titulo: 'Curso y comunidad', que: 'El avance del curso dentro de la ficha de cada cliente.', estado: 'en-curso' as EstadoCS, tagOriginal: 'listo' as const, nota: 'Es la fase 3. Whop.' },
      { titulo: 'Sesiones grupales', que: 'Llamadas con formulario de preguntas y hoja de Q&A.', estado: 'idea' as EstadoCS, nota: 'El grupal requiere sí o sí tener los cursos grabados antes.' },
      { titulo: 'Grabaciones con marcas de tiempo', que: 'Cada pregunta marcada en su minuto.', estado: 'idea' as EstadoCS },
      { titulo: 'Gestión de camadas', que: 'Los clientes por cohorte, no solo de a uno.', estado: 'idea' as EstadoCS },
      { titulo: 'Control de sala', que: 'Solo entra quien está activo e invitado.', estado: 'idea' as EstadoCS, nota: 'Whop lo resuelve.' },
    ] },
    { n: '09', titulo: 'Comunidad', que: 'Que no se enfríen, sin estar encima de cada uno.', items: [
      { titulo: 'Gamificación', que: 'Niveles, reconocimientos y logros.', estado: 'descartado' as EstadoCS },
      { titulo: 'Check-ins automáticos', que: 'MaKo le pregunta a cada cliente cómo va.', estado: 'idea' as EstadoCS },
      { titulo: 'Grupos de accountability', que: 'Grupos entre clientes para que se empujen.', estado: 'idea' as EstadoCS },
      { titulo: 'Momentos wow', que: 'Detalles que el cliente no espera, programados solos.', estado: 'descartado' as EstadoCS },
    ] },
    { n: '10', titulo: 'Operación y equipo', que: 'Que el equipo siga tu forma de trabajar.', items: [
      { titulo: 'Biblioteca de procesos (SOPs)', que: 'Tu forma de entregar, documentada una vez.', estado: 'proximo' as EstadoCS, nota: 'Es el entregable «servicio escrito» del sprint.' },
      { titulo: 'Roles y ruteo', que: 'Cada evento cae en el equipo correcto.', estado: 'idea' as EstadoCS, tagOriginal: 'expande' as const },
      { titulo: 'Notificaciones a tus canales', que: 'Nuevo cliente, disputa, NPS bajo, al instante.', estado: 'proximo' as EstadoCS, nota: 'El motor ya existe; el problema real es de jerarquía, no de volumen.' },
    ] },
    { n: '11', titulo: 'El cerebro', que: 'De todos los datos, qué hacer.', items: [
      { titulo: 'Preguntale a MaKo', que: 'Le preguntás por cualquier cliente y responde con su historial.', estado: 'proximo' as EstadoCS, tagOriginal: 'listo' as const, nota: '⚠️ Él reportó el 31/7 que NO funciona.' },
      { titulo: 'Semáforo del negocio', que: '«No te muestra el problema, te dice cuál atacar primero».', estado: 'proximo' as EstadoCS, tagOriginal: 'listo' as const, nota: '⭐ La ironía más útil del documento: se vendió como hecho el comportamiento que después reclamó como faltante. Está en la fase 6.' },
    ] },
    { n: '✦', titulo: 'Generador de tableros', que: 'La tarjeta con el badge «El más potente», y a la vez el módulo más flaco: 3 features, ninguna construida.', items: [
      { titulo: 'Plantillas seleccionables', que: 'Listas para configurar, sin partir de cero.', estado: 'proximo' as EstadoCS, nota: 'El documento lo planteaba como plantillas + formulario. Lo acordado después es otra cosa: un prompt maestro como skill. Está en la fase 2.' },
      { titulo: 'Se configura en un formulario', que: 'No se programa: se completa.', estado: 'proximo' as EstadoCS },
      { titulo: 'Honesto', que: '«Conectar los datos de cada empresa sigue siendo puesta a punto».', estado: 'hecho' as EstadoCS, nota: 'La advertencia sigue siendo cierta, y es la parte que nadie mira: el dato base no existe en ninguno de sus clientes.' },
    ] },
  ],
};

/** Los títulos de tarea que este camino reclama del tablero. Sale de los datos, nunca
 *  de una lista escrita al lado: una segunda lista se queda vieja sola. */
export const TITULOS_EN_PLAN: string[] =
  FASES.flatMap((f) => f.items.map((i) => i.plan).filter((t): t is string => !!t));

/** El conteo por estado del CAMINO (no de la propuesta). Derivado. */
export function conteoCamino(): Record<EstadoCS, number> {
  const out = { hecho: 0, 'en-curso': 0, bloqueado: 0, proximo: 0, idea: 0, descartado: 0 } as Record<EstadoCS, number>;
  for (const f of FASES) for (const i of f.items) out[i.estado]++;
  return out;
}
