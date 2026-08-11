// =============================================================================
// Customer Success: el objetivo, el camino, y lo que viene después
// =============================================================================
// Este es EL Roadmap del área: reemplaza al genérico en vez de sumarse (ver
// `roadmapPropioDe` en ../paneles.tsx). Un área tiene UN roadmap.
//
// TRES SEPARACIONES, y cada una salió de un reclamo del dueño:
//
//  1. OBJETIVO vs CAMINO. El objetivo es cómo va a FUNCIONAR el servicio (el bucle
//     de 5 pasos); el camino es lo que hay que CONSTRUIR para que pueda correr.
//     Mezclados producen el absurdo que él marcó: el paso 1 es «el cliente ve el
//     video» y aparecía antes que la fase que construye la plataforma donde vive
//     ese video. **El paso 1 del bucle es el ÚLTIMO en poder correr.** Por eso los
//     pasos declaran qué fase los habilita en vez de hacerse pasar por una.
//
//  2. AHORA vs DESPUÉS. Lo urgente de Mauricio y la propuesta original de 12
//     módulos son dos horizontes distintos. El segundo NO se resume: se guarda
//     entero —los números, las 4 fases, lo que MaKo no reemplaza, las 52
//     features— porque es material que se va a volver a usar cuando se abra el
//     gatillo. «Eliminaste mucha información valiosa» fue el reclamo.
//
//  3. LO QUE SE VE vs LO QUE SE ABRE. Sin abrir, un bloque muestra su título y UNA
//     línea. Todo lo demás va adentro de un `Plegable`. La regla es la misma que
//     ya está escrita arriba de `Titular` en pricing/Piezas.tsx, y viene del mismo
//     reclamo: «No pongas infinito scroll, para eso existen los desplegables».
//
// EL ORDEN DEL CAMINO no es el de los cuatro frentes del Sprint: es el de las
// dependencias. La matriz vinculada va primero porque el formulario, el prompt
// maestro y el tablero preguntan o pintan LO MISMO.
//
// Fuentes: docs/sprint-servicio-mauricio.md (las 7 reuniones del 4/7 al 6/8) y
// public/vsl-assets/mako-cs.html para «Después».
// =============================================================================

import type { Tono } from '@/app/_ui';

export type EstadoCS = 'hecho' | 'en-curso' | 'bloqueado' | 'proximo' | 'idea' | 'descartado';

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
  /** UNA línea. Si no entra en una línea, es dos items. */
  que: string;
  estado: EstadoCS;
  quien?: 'Martín' | 'Mauricio' | 'Los dos';
  /** El TÍTULO EXACTO de la tarea en /plan. Se resuelve contra el tablero; si no
   *  matchea no se inventa número (uno aproximado manda a la tarjeta de otra). */
  plan?: string;
  /** La única advertencia que cambia una decisión. Corta. No es una nota al pie. */
  ojo?: string;
  /** El tag que el documento original le mostró a Mauricio. No es el estado de hoy. */
  tag?: 'listo' | 'expande';
};

// ─────────────────────────────────────────────────────────────────────────────
// EL OBJETIVO
// ─────────────────────────────────────────────────────────────────────────────

export const OBJETIVO = {
  frase: 'Que el cliente haga el trabajo y Mauricio solo ponga el criterio.',
  detalle:
    'Hoy cada cliente le cuesta madrugadas: él llena el Excel, él redacta el documento, él codea el tablero. Dar vuelta quién trabaja es lo que baja el programa de 4-5 meses a 3 y le deja atender más clientes sin sumar horas.',
  cita: '«si yo puedo tener una plataforma donde ponga más a trabajar al cliente y me quite tareas… eso va a poder aumentar mi capacidad instalada» — Mauricio, 29/7',
  /** Los 5 pasos del 31/7 [03:46:44]. Es el DESTINO: no llevan estado. */
  pasos: [
    { n: 1, titulo: 'Ve el video del bloque', que: 'Antes de la reunión, por su cuenta. Mauricio deja de explicar la metodología en vivo, cliente por cliente.', habilita: 'fase 3' },
    { n: 2, titulo: 'Hace la tarea, y recién ahí agenda', que: 'La llamada se gana. «Si no se terminó la tarea está en su cancha el problema».', habilita: 'fase 4' },
    { n: 3, titulo: 'En la llamada revisan y perfeccionan', que: 'Deja de ser extracción de datos y pasa a ser criterio. Lo único que él no delega.', habilita: 'ya funciona' },
    { n: 4, titulo: 'La IA reescribe con el Fathom', que: 'Mata el «peinado» manual que hoy hace él después de cada junta.', habilita: 'fase 5' },
    { n: 5, titulo: 'El cliente pule y aprueba', que: 'La propiedad queda de su lado, y tiene claridad antes de que exista el tablero.', habilita: 'fase 4' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// EL CAMINO
// ─────────────────────────────────────────────────────────────────────────────

export type FaseCS = {
  n: string;
  titulo: string;
  /** Una línea, se lee con la fase CERRADA. Es lo que contesta «¿por qué acá?». */
  desbloquea: string;
  necesita?: string;
  paralelo?: boolean;
  /** Arranca abierta. Solo las que hay que mirar hoy. */
  abierta?: boolean;
  items: ItemCS[];
};

export const FASES: FaseCS[] = [
  {
    n: '0', titulo: 'Destrabar lo que frena', abierta: true,
    desbloquea: 'Todo lo demás. Nada de esto es código, y por eso se posterga solo.',
    items: [
      { titulo: 'Los 5 entregables de Mauricio', que: 'Timing, esfuerzo, llamadas por bloque, qué hace a mano y qué le cuesta entender al cliente.', estado: 'bloqueado', quien: 'Mauricio',
        ojo: 'Sin esto no se puede estructurar el programa (fase 3). Prometidos el 6/8 «te lo envío hoy mismo», sin confirmación. El quinto ES la lista de videos a grabar.' },
      { titulo: 'Reencuadrar el sprint', que: 'Mandarle el bucle por escrito y cambiar el frente 04 por algo entregable.', estado: 'proximo', quien: 'Martín', plan: 'Reencuadrar el sprint con Mauricio: los 5 pasos y el frente 04',
        ojo: 'El 6/8 ninguno de los dos se acordaba de la lista de cinco.' },
      { titulo: 'Consumo de IA bajo control', que: 'Plan propio de US$200 y auto-límite sobre su Cloud, con el gasto visible.', estado: 'proximo', quien: 'Martín', plan: 'Auto-límite del consumo de IA sobre la cuenta de Claude de Mauricio',
        ojo: 'Ya le costó tres días de trabajo con un cliente suyo, y bloqueó justo el frente 01. Acordado el 6/8 y sin ejecutar.' },
      { titulo: 'La cuota del 10 de agosto', que: 'El 6/8 quedó impaga, con problema de caja declarado.', estado: 'proximo', quien: 'Martín' },
    ],
  },
  {
    n: '1', titulo: 'La matriz vinculada', abierta: true,
    desbloquea: 'El formulario, el prompt maestro y el tablero: los tres preguntan o pintan lo mismo.',
    items: [
      { titulo: 'El tipo y el validador de las 6 auditorías', que: 'Las 14 columnas del Cuestionario Maestro, y las 6 verificaciones que rechazan una matriz mal armada.', estado: 'proximo', quien: 'Martín', plan: 'La matriz vinculada y su validador: el esquema del tablero de un cliente',
        ojo: 'Mauricio ya lo entregó escrito: su cuestionario termina en esa tabla y trae su propia capa de verificación.' },
      { titulo: '¿La ficha de palanca tiene 9 campos o 10?', que: 'El texto dice nueve, la tabla del Bloque 4 lista diez, y la que él dictó tiene siete.', estado: 'proximo', quien: 'Los dos',
        ojo: 'Es una pregunta de cinco minutos. Modelar antes de cerrarla es modelar una suposición.' },
    ],
  },
  {
    n: '2', titulo: 'Que el tablero salga solo',
    desbloquea: 'Su mayor sangría de tiempo: seis tableros en cola, codeados de madrugada.',
    necesita: 'La matriz (fase 1). No necesita la plataforma.',
    items: [
      { titulo: 'El prompt maestro, editable desde /contexto', que: 'Que LLENE y después emita: proponga evidencia y umbrales, y devuelva la tabla de huecos.', estado: 'proximo', quien: 'Martín', plan: 'El prompt maestro que arma el tablero de un cliente',
        ojo: 'Su cuello NO es codear. Sus documentos dicen que el bloqueo #1 es definir la EVIDENCIA (tres semanas paradas con Patricia) y el #2 el umbral.' },
      { titulo: 'La skill de Claude Code que lo emite', que: 'Toma la matriz validada y escribe el código, generada desde el repo con --check en el pre-push.', estado: 'proximo', quien: 'Martín', plan: 'La skill de Claude Code que emite el tablero del cliente',
        ojo: 'MaKo no emite código en runtime en ningún lado: el generador va afuera.' },
      { titulo: 'Probarlo contra un tablero que él ya hizo', que: 'Esquer o Baja Teriyaki. Si no lo reproduce, no sirve.', estado: 'proximo', quien: 'Los dos' },
    ],
  },
  {
    n: '3', titulo: 'Que la plataforma exista · Whop',
    desbloquea: 'El paso 1 del bucle: que el cliente vea el video antes de la reunión.',
    necesita: 'Los 5 entregables (fase 0), para saber qué bloques hay y qué videos grabar.',
    items: [
      { titulo: 'Conectar Whop por API', que: 'Alta de la integración con credenciales por workspace. No se desarrolla: se conecta.', estado: 'en-curso', quien: 'Martín', plan: 'Conectar Whop por API para la plataforma de contenido',
        ojo: 'Elegida el 11/8 por ser la gratuita con API. Cierra el compromiso más viejo del sprint.' },
      { titulo: 'Montar el programa y dar de alta a los clientes', que: 'La estructura por bloques con su video, y los clientes activos adentro.', estado: 'bloqueado', quien: 'Los dos', plan: 'Montar el programa de Mauricio en Whop, por bloques',
        ojo: 'Restricciones suyas: nada de Notion, y «son empresarios que todos tienen TDAH… no creas que le sabe la computadora».' },
      { titulo: 'Grabar los videos', que: 'Salen del quinto entregable: lo que el cliente no entiende es el video que falta.', estado: 'bloqueado', quien: 'Mauricio',
        ojo: 'Esto es lo que toma tiempo del frente 02. El software es un día; los otros 59 son él grabando.' },
      { titulo: 'Sacar el `const WS = 1` de /api/compartir', que: 'Hoy compartir material está clavado al workspace 1.', estado: 'proximo', quien: 'Martín', plan: 'Sacar el `const WS = 1` de la ruta que comparte material' },
    ],
  },
  {
    n: '4', titulo: 'Que el cliente haga la tarea',
    desbloquea: 'Los pasos 2 y 5 del bucle, que son los que le sacan el trabajo de encima.',
    necesita: 'La matriz (fase 1) para saber qué preguntar, y la plataforma (fase 3) para que viva ahí.',
    items: [
      { titulo: 'El formulario del bloque, y la aprobación', que: 'Completa antes de la llamada; después pule y aprueba lo que la IA reescribió.', estado: 'proximo', quien: 'Martín', plan: 'El formulario del bucle: que el cliente haga la tarea antes de la llamada',
        ojo: 'La forma la propuso él: «un formulario mediante IA, que razone qué pregunta personalizada le tiene que hacer». Y su límite: «no quiero automatizar algo que todavía no está estandarizado».' },
      { titulo: 'La llamada se agenda cuando la tarea está lista', que: 'Calendly se abre recién ahí. Es lo que mata la reunión de calendario fijo.', estado: 'proximo', quien: 'Martín' },
    ],
  },
  {
    n: '5', titulo: 'Que la IA cierre el bucle',
    desbloquea: 'El paso 4: las respuestas se reescriben solas después de cada junta.',
    necesita: 'El formulario (fase 4): sin respuestas cargadas no hay nada que reescribir.',
    items: [
      { titulo: 'El Fathom de la reunión reescribe las respuestas', que: 'Lo que hoy hace a mano: «lo redacto yo como hipótesis y en la junta lo vamos peinando».', estado: 'proximo', quien: 'Martín', plan: 'Configurar Fathom e IA para actualizar formularios post-reunión' },
      { titulo: 'El camino cuando no hay grabación', que: 'Que el sistema lo diga y ofrezca completar a mano, en vez de quedarse callado.', estado: 'proximo', quien: 'Martín',
        ojo: 'Ya falló dos veces: el 16/7 Artemisa no entró a las juntas de todo un día, y el 31/7 «no jaló la IA, no hubo de Esquer». Sin esto el bucle se corta entero.' },
    ],
  },
  {
    n: '6', titulo: 'Que no se caiga nada', paralelo: true,
    desbloquea: 'Que deje de sostener el seguimiento en la cabeza y en un Excel.',
    items: [
      { titulo: 'Aviso de compromiso vencido', que: 'Un barrido de deadline vencido, agrupado por cliente.', estado: 'proximo', quien: 'Martín', plan: 'Implementar notificaciones proactivas de MaKo por WhatsApp sobre tareas pendientes',
        ojo: 'Lo más barato del encargo y lo primero que él ve. Hoy tiene CERO líneas, y es la misma consulta que ya corre, al revés.' },
      { titulo: 'La vista de cartera', que: 'Una fila por cliente: último contacto, compromisos abiertos, vencidos y próximo hito.', estado: 'proximo', quien: 'Martín', plan: 'Vista de cartera + alertas de baja al dueño',
        ojo: 'Más cerca de lo que parece: sus seis clientes YA son proyectos de su tablero y sus reuniones YA caen en el cliente correcto.' },
      { titulo: 'Etapa del encargo y próximo hito', que: 'Lo único que no se deriva de nada y necesita tabla propia.', estado: 'proximo', quien: 'Martín', plan: 'Etapa del encargo, próximo hito y estado por cliente',
        ojo: 'No puede llamarse `FASES`: ya hay TRES en el repo que compilan sin conflicto. Sugerido `ETAPAS_ENCARGO`.' },
      { titulo: 'El semáforo que da el guión, no el link', que: 'Que cada alerta traiga qué hacer según el motivo.', estado: 'proximo', quien: 'Martín', plan: 'Semáforo que razona alertas, no que solo linkea',
        ojo: 'Su pedido más fuerte — «¿qué me va a dar el valor de que la herramienta sea mi brújula? Porque obligas a la gente». Sirve a todos los workspaces.' },
    ],
  },
  {
    n: '7', titulo: 'Que se cierre y vuelva a vender',
    desbloquea: 'Lo que les ofrece a los contratos que vencen en octubre y noviembre.',
    necesita: 'Clientes que hayan terminado. Hoy no hay ninguno.',
    items: [
      { titulo: 'Protocolo de graduación y salida', que: 'Qué se entrega, cómo se cierra y cuándo. Es su fase 4, hoy sin definir.', estado: 'proximo', quien: 'Los dos', plan: 'Protocolo de graduación y salida de un cliente',
        ojo: 'Es un documento, no software.' },
      { titulo: 'La oferta de renovación de oct/nov', que: 'Lo que reemplaza al frente 04, y lo único de esta fase con reloj.', estado: 'proximo', quien: 'Los dos',
        ojo: '«En octubre y noviembre van a empezar a vencerse ya. ¿Qué les voy a ofrecer? No está claro» (8/7). Ya está como prioridad del Perro en su board.' },
      { titulo: 'Pipeline de casos de éxito', que: 'De «logró la promesa» a testimonio publicado, por estados.', estado: 'idea', quien: 'Martín', plan: 'Pipeline de casos de éxito: del resultado al testimonio publicado',
        ojo: 'No hay materia prima: «No tengo ningún cliente que todavía ha llegado a las juntas» (29/7).' },
    ],
  },
  {
    n: '⚠', titulo: 'La deuda con él', paralelo: true,
    desbloquea: 'Nada técnico: es lo que sostiene la relación. Cada hora que no sale de acá le da la razón a «es nice, es cool, es wow, pero no es el core».',
    items: [
      { titulo: 'Vista móvil', que: 'Intentó usar MaKo desde el teléfono en vivo el 6/8 y no pudo.', estado: 'proximo', quien: 'Martín', plan: 'Bases mobile dentro del sistema global (una tarea por pantalla, sheets, 44 px)' },
      { titulo: 'Agendar la Junta 2 sin salir de la llamada', que: 'Terminó cargándola a mano porque «no me acuerdo dónde».', estado: 'proximo', quien: 'Martín', plan: 'Agendar la Junta 2 sin salir de la llamada' },
      { titulo: 'El aviso importante se pierde en el ruido', que: 'MaKo le avisó de una reunión y quedó sepultado. Le costó media reunión.', estado: 'proximo', quien: 'Martín', plan: 'Optimizar notificaciones de MaKo por WhatsApp para Mauricio' },
      { titulo: 'El mapa marca cero en CDMX', que: 'No falta el dato: el Estado de México se queda con el valor de CDMX.', estado: 'proximo', quien: 'Martín', plan: 'El mapa de México pinta el estado equivocado, no un cero' },
      { titulo: 'El acuerdo de propiedad del código', que: 'Le dedicó 25 minutos el 6/8 y quedó cerrado de palabra, sin registro.', estado: 'proximo', quien: 'Martín', plan: 'Dejar escrito el acuerdo de propiedad del código de MaKo' },
      { titulo: 'Los otros bugs que reportó', que: '«Pregúntale a MaKo» roto · histórico que mezcla meses · audio de WhatsApp sin transcribir · filtro de fecha en costos.', estado: 'proximo', quien: 'Martín' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// DESPUÉS — la propuesta original, completa
// ─────────────────────────────────────────────────────────────────────────────

export const DESPUES = {
  resumen: 'US$9.000 rechazados el 8/7 — por timing, no por precio. Aplazado con gatillo.',

  porQue: {
    cita: '«el macro customer success va a tener un montón de valor y 9 mil dólares van a ser una ganga… Perfecto, pero es el timing.»',
    gatillo: '«Si yo tengo eso para 15 y podemos empezar a tener testimonios de 5, a lo mejor ya estamos listos para escalar. Incluso hasta me vas a querer cobrar más.»',
    objeciones: [
      'Pago doble: «que yo esté pagando doble por algo que ya teníamos un acuerdo».',
      'Con 14 clientes no lo necesito: «mi lógica me dice que no».',
      '«Yo nunca planteé contratar un Customer Success, eso tú lo trajiste a la mesa.»',
      'MaKo te desenfoca a VOS: «es nice, es cool, es wow, pero no es el core».',
      'Validar antes de escalar: «diseñada para catorce, quince almas, no para cincuenta».',
      'Abrumación: «Y me abruma que me muestres todo eso».',
    ],
    frase: '«en lugar de que tú me lleves a tu modelo de escalamiento supersónico, wow, high class, yo te quiero traer a mi humilde producto mínimo viable.»',
  },

  numeros: {
    precio: 'US$9.000', forma: '6 cuotas de US$1.500', nota: 'Pago único, no un sueldo que se repite.',
    empleado: [
      '~US$18-21K al año, todos los años y subiendo con la inflación.',
      '4 a 7 semanas para conseguirlo, y el cruce servicio + sistemas + criterio es escaso.',
      'Rota, se va, hay que reentrenar y volver a buscar.',
      'Lo gestionás vos: KPIs, seguimiento, reemplazos.',
      'Y aun así, alguien tiene que construirle los tableros.',
    ],
    mako: [
      'Un pago único, no un sueldo que se repite cada año.',
      'Buena parte ya está construida: se configura, no se manda a hacer.',
      'No renuncia, no se enferma, no se olvida de nadie.',
      'Funciona igual para cada cliente que sumes, sin costo fijo nuevo.',
      'Viene con el método adentro: asesoría de CS productizada.',
    ],
    tresAnios: [
      { que: 'Empleado', a1: '~$19K', a2: '~$20K', a3: '~$21K', total: '~$60K' },
      { que: 'MaKo CS', a1: '$9K', a2: '$0', a3: '$0', total: '$9K' },
    ],
  },

  /** Las 4 fases del carril de Customer Success del documento. Nunca se desglosaron
   *  en features: son títulos, y eso mismo es el dato. */
  fasesOriginales: [
    'Fase 1 · Encender lo que ya existe',
    'Fase 2 · Arranque, resultados y retención',
    'Fase 3 · El loop de crecimiento',
    'Fase 4 · Los grandes',
  ],

  noReemplaza: {
    seLleva: ['Seguimiento, alertas y recordatorios.', 'Transcripción, notas y bitácora.', 'Datos, tokens y permisos del equipo.', 'Perseguir compromisos y ordenar la cartera.'],
    quedaTuyo: ['Tu servicio y tu criterio.', 'Metas y estrategia de cada cliente.', 'La relación con el empresario.', 'La transformación que solo vos provocás.'],
  },

  reglas: [
    { t: 'No se construye a medida', q: 'Es un módulo de MaKo, como VSL Funnel. La app no se adapta a vos: tu forma de trabajar entra en la app. Eso lo vuelve estándar y repetible.' },
    { t: 'La mentoría es sagrada', q: 'Dos acuerdos separados, con alcance y fecha de fin propios. Si hay crunch, flexiona el build — nunca la mentoría.' },
    { t: 'El ejecutor vence', q: 'Cada módulo que entra a la app deja de hacerse a mano. El mentor queda.' },
  ],

  modulos: [
    { n: '01', titulo: 'Tu cartera', que: 'Cada cliente y su estado, en una pantalla.', items: [
      { titulo: 'Cartera de clientes', que: 'Todos tus clientes activos y su avance, del que necesita atención al que va bien.', estado: 'proximo' as EstadoCS, tag: 'listo' as const, ojo: 'El tag mentía: no existe ninguna vista de cartera. Está en la fase 6.' },
    ] },
    { n: '02', titulo: 'Onboarding', que: 'El pago se vuelve cliente listo, sin mover un dedo.', items: [
      { titulo: 'Traspaso de venta a servicio', que: 'El que paga entra solo al circuito: datos, accesos y bienvenida.', estado: 'idea' as EstadoCS, ojo: 'El pipeline muere en `ganado`: no hay etapa posterior.' },
      { titulo: 'Firma de contrato', que: 'Sale, se firma y se archiva sin que persigas a nadie. Te avisa si falta.', estado: 'descartado' as EstadoCS, ojo: 'Es para volumen, no para 7 clientes.' },
      { titulo: 'Formulario de arranque', que: 'Se completa una vez y MaKo arma la ficha, la carpeta y el perfil.', estado: 'proximo' as EstadoCS, ojo: 'Se recicla como el formulario de la fase 4.' },
      { titulo: 'Tracker de onboarding', que: 'En qué paso del arranque está cada cliente nuevo. Ves quién se trabó.', estado: 'idea' as EstadoCS },
      { titulo: 'Asignación de consultor', que: 'MaKo lee el formulario y sugiere el consultor que mejor calza.', estado: 'descartado' as EstadoCS, ojo: 'Mauricio es el único consultor.' },
      { titulo: 'Filtro de pago', que: 'Nadie accede sin haber pagado: MaKo cruza el pago antes de abrir la puerta.', estado: 'idea' as EstadoCS, ojo: 'Whop ya lo resuelve.' },
    ] },
    { n: '03', titulo: 'El día a día', que: 'El trabajo recurrente, sin que se caiga nada. El módulo con más piezas ya construidas.', items: [
      { titulo: 'Preparación de sesión', que: 'Diez minutos antes, el resumen del cliente y el objetivo del día.', estado: 'idea' as EstadoCS, tag: 'listo' as const },
      { titulo: 'Bitácora automática', que: 'Grabás la sesión y se convierte en notas ordenadas dentro de la ficha.', estado: 'hecho' as EstadoCS, tag: 'listo' as const, ojo: 'Es el pipeline de Fathom, que ya corre. Y es el paso 4 del bucle.' },
      { titulo: 'Las dos canchas', que: 'Qué te toca a vos y qué al cliente, con responsable y fecha.', estado: 'hecho' as EstadoCS, tag: 'listo' as const },
      { titulo: 'Seguimiento que no falla', que: 'Si alguien no responde o no subió evidencia, MaKo lo detecta y avisa.', estado: 'proximo' as EstadoCS, tag: 'listo' as const, ojo: 'El tag mentía en la mitad: la alerta de VENCIDO no existe. Está en la fase 6.' },
      { titulo: 'Fases configurables', que: 'Cada cliente avanza por las fases que definís. Si se traba, salta la alerta.', estado: 'proximo' as EstadoCS, tag: 'listo' as const, ojo: 'Existen, pero son constantes de código: no se configuran por workspace.' },
    ] },
    { n: '04', titulo: 'Resultados', que: 'Que el cliente logre lo prometido, medido. Enciende todo lo que sigue.', items: [
      { titulo: 'Plan de acción', que: 'El roadmap de cada cliente, con hitos y fechas, que armás una vez.', estado: 'proximo' as EstadoCS, ojo: 'Es la salida del bucle: la matriz vinculada.' },
      { titulo: 'Tracker de resultado', que: 'La promesa medida: de dónde salió, dónde está y cuánto le falta.', estado: 'idea' as EstadoCS },
      { titulo: 'KPIs del cliente', que: 'Tareas cumplidas, sesiones entregadas, cuellos de botella. El progreso real.', estado: 'idea' as EstadoCS },
      { titulo: 'Quick wins', que: 'Las primeras victorias marcadas, para usarlas temprano.', estado: 'idea' as EstadoCS },
      { titulo: 'Promesa cumplida', que: 'Al llegar a la meta dispara lo que sigue: caso de éxito, referido, ascenso.', estado: 'idea' as EstadoCS, ojo: 'Es el detector de la fase 7. Depende de la matriz.' },
    ] },
    { n: '05', titulo: 'Growth Loop', que: 'La entrega vuelve a vender. MaKo ya capta y vende; acá cierra el círculo.', items: [
      { titulo: 'Pipeline de casos de éxito', que: 'De «logró la promesa» a testimonio publicado, por estados.', estado: 'idea' as EstadoCS, ojo: 'Ya está en la fase 7.' },
      { titulo: 'Guía de entrevista', que: 'Las preguntas listas y la grabación capturada sola.', estado: 'proximo' as EstadoCS },
      { titulo: 'Banco de testimonios', que: 'Los elogios de tus sesiones, ordenados y etiquetados para marketing.', estado: 'idea' as EstadoCS, tag: 'expande' as const },
      { titulo: 'Motor de referidos', que: 'Cuando un cliente está feliz, avisa que es momento de pedir — con el guión.', estado: 'idea' as EstadoCS },
      { titulo: 'Tracking de referidos', que: 'Link propio por cliente: quién trajo a quién y cuánto le corresponde.', estado: 'idea' as EstadoCS },
      { titulo: 'Ascenso y renovación', que: 'Al terminar el ciclo, levanta la oferta del siguiente nivel.', estado: 'proximo' as EstadoCS, ojo: 'Es lo que tiene reloj: octubre/noviembre. Está en la fase 7.' },
    ] },
    { n: '06', titulo: 'Retención y recupero', que: 'Hoy detectás el riesgo. Acá también actuás sobre él.', items: [
      { titulo: 'Satisfacción y riesgo', que: 'Qué tan conforme está cada cliente, y quién está por irse.', estado: 'idea' as EstadoCS, tag: 'listo' as const, ojo: 'El tag mentía: no hay NPS ni encuesta en el código.' },
      { titulo: 'Alarmas de churn', que: 'Comportamiento, KPIs e impagos disparan la alerta antes de tiempo.', estado: 'idea' as EstadoCS, tag: 'expande' as const },
      { titulo: 'Guiones de recuperación', que: 'Cuando un cliente se pone en rojo, el guión correcto según el motivo.', estado: 'proximo' as EstadoCS, ojo: 'Ya está en la fase 6: es la bajada del doer y sirve a todos los workspaces.' },
      { titulo: 'Pausas y cancelaciones', que: 'Entender el porqué, proponer pausa, recordar la garantía.', estado: 'idea' as EstadoCS },
      { titulo: 'Gestión de cobros', que: 'Planes que se renegocian, impagos que se persiguen y la próxima fecha a la vista.', estado: 'idea' as EstadoCS, ojo: 'Parte ya existe: `getCuotasPendientes`.' },
      { titulo: 'Escudo de disputas', que: 'Si llama al banco, MaKo arma la evidencia para responder en horas.', estado: 'descartado' as EstadoCS },
      { titulo: 'Blindaje legal', que: 'Difamación y piratería: los reclamos y guiones a mano.', estado: 'descartado' as EstadoCS },
    ] },
    { n: '07', titulo: 'Métricas', que: 'El tablero de mando de la entrega. El módulo más lejos de existir: hoy es todo aire.', items: [
      { titulo: 'NPS', que: 'Calculado solo, con la tendencia: quién promociona y quién te abandona.', estado: 'descartado' as EstadoCS, ojo: 'Con ~7 clientes activos un NPS no significa nada.' },
      { titulo: 'Customer Effort Score', que: 'Qué tan fácil le resulta a tu cliente trabajar con vos.', estado: 'descartado' as EstadoCS },
      { titulo: 'Churn Rate', que: 'Tu tasa de bajas mes a mes, contra el estándar de la industria.', estado: 'descartado' as EstadoCS },
      { titulo: 'Feedback multipunto', que: 'Satisfacción en cada instancia: arranque, módulos, 1:1, grupales, pago.', estado: 'idea' as EstadoCS, tag: 'expande' as const, ojo: 'Lo único rescatable: hoy tiene 4 respuestas de una encuesta anónima.' },
      { titulo: 'Ecuación de servicio', que: 'Satisfacción y casos arriba, costo y tiempo abajo. La salud en un número.', estado: 'descartado' as EstadoCS },
    ] },
    { n: '08', titulo: 'Grupales y cohortes', que: 'La entrega de a muchos. Sube de prioridad: el grupal es su camino declarado a los US$50K.', items: [
      { titulo: 'Curso y comunidad', que: 'El avance del curso y la comunidad, dentro de la ficha de cada cliente.', estado: 'en-curso' as EstadoCS, tag: 'listo' as const, ojo: 'Es la fase 3. Whop.' },
      { titulo: 'Sesiones grupales', que: 'Llamadas con formulario de preguntas y hoja de Q&A, registradas por cliente.', estado: 'idea' as EstadoCS, ojo: 'El grupal requiere sí o sí tener los cursos grabados antes.' },
      { titulo: 'Grabaciones con marcas de tiempo', que: 'Sube al área de miembros con cada pregunta marcada en su minuto.', estado: 'idea' as EstadoCS },
      { titulo: 'Gestión de camadas', que: 'Tus clientes por cohorte: ves avanzar a toda la tanda junta.', estado: 'idea' as EstadoCS },
      { titulo: 'Control de sala', que: 'A las grupales solo entra quien está activo e invitado.', estado: 'idea' as EstadoCS, ojo: 'Whop lo resuelve.' },
    ] },
    { n: '09', titulo: 'Comunidad', que: 'Que no se enfríen, sin que dependa de estar encima de cada uno.', items: [
      { titulo: 'Gamificación', que: 'Niveles, reconocimientos y logros: los que la rompen se vuelven ejemplo.', estado: 'descartado' as EstadoCS },
      { titulo: 'Check-ins automáticos', que: 'MaKo le pregunta a cada cliente cómo va, sin que muevas un dedo.', estado: 'idea' as EstadoCS },
      { titulo: 'Grupos de accountability', que: 'MaKo arma grupos entre clientes para que se empujen entre ellos.', estado: 'idea' as EstadoCS },
      { titulo: 'Momentos wow', que: 'Detalles que el cliente no espera, programados solos.', estado: 'descartado' as EstadoCS },
    ] },
    { n: '10', titulo: 'Operación y equipo', que: 'La trastienda: que el equipo siga tu forma de trabajar, no la suya.', items: [
      { titulo: 'Biblioteca de procesos (SOPs)', que: 'Tu forma de entregar, documentada una vez y viva adentro de MaKo.', estado: 'proximo' as EstadoCS, ojo: 'Es el entregable «servicio escrito» del sprint.' },
      { titulo: 'Roles y ruteo', que: 'Cada evento cae en el equipo correcto, con su tarea y su fecha.', estado: 'idea' as EstadoCS, tag: 'expande' as const },
      { titulo: 'Notificaciones a tus canales', que: 'Nuevo cliente, disputa, NPS bajo: se empuja a Slack o WhatsApp al instante.', estado: 'proximo' as EstadoCS, ojo: 'El motor ya existe; el problema real es de jerarquía, no de volumen.' },
    ] },
    { n: '11', titulo: 'El cerebro', que: 'De todos los datos, qué hacer.', items: [
      { titulo: 'Preguntale a MaKo', que: 'Preguntás por cualquier cliente y responde con su historial completo.', estado: 'proximo' as EstadoCS, tag: 'listo' as const, ojo: 'Él reportó el 31/7 que NO funciona.' },
      { titulo: 'Semáforo del negocio', que: '«No te muestra el problema, te dice cuál atacar primero».', estado: 'proximo' as EstadoCS, tag: 'listo' as const, ojo: 'La ironía más útil del documento: se vendió como hecho lo que después reclamó como faltante. Está en la fase 6.' },
    ] },
    { n: '✦', titulo: 'Generador de tableros', que: 'La tarjeta con el badge «El más potente», y a la vez el módulo más flaco: 3 features, ninguna construida.', items: [
      { titulo: 'Plantillas seleccionables', que: 'Listas para configurar, sin partir de cero.', estado: 'proximo' as EstadoCS, ojo: 'El documento lo planteaba como plantillas + formulario. Lo acordado después es un prompt maestro como skill: fase 2.' },
      { titulo: 'Se configura en un formulario', que: 'No se programa: se completa y queda armado.', estado: 'proximo' as EstadoCS },
      { titulo: 'Honesto', que: '«Conectar los datos de cada empresa sigue siendo puesta a punto».', estado: 'hecho' as EstadoCS, ojo: 'Sigue siendo cierto, y es la parte que nadie mira: el dato base no existe en ninguno de sus clientes.' },
    ] },
  ],
};

/** Los títulos que este camino reclama del tablero. Derivado, nunca escrito al lado. */
export const TITULOS_EN_PLAN: string[] =
  FASES.flatMap((f) => f.items.map((i) => i.plan).filter((t): t is string => !!t));

export function conteoCamino(): Record<EstadoCS, number> {
  const out = { hecho: 0, 'en-curso': 0, bloqueado: 0, proximo: 0, idea: 0, descartado: 0 } as Record<EstadoCS, number>;
  for (const f of FASES) for (const i of f.items) out[i.estado]++;
  return out;
}

export const TOTAL_FEATURES_DESPUES = DESPUES.modulos.reduce((n, m) => n + m.items.length, 0);
