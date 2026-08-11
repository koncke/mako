// =============================================================================
// El roadmap COMPLETO de Customer Success — el único de Dev escrito a mano
// =============================================================================
// Todos los demás Roadmap de /admin/dev salen del plan (ver ../roadmap.ts), y esa
// regla es buena: un roadmap escrito a mano se queda viejo el martes. Acá hay una
// excepción con motivo, y conviene que quede escrita para que nadie la copie sin
// pensarla:
//
//   · La MITAD de este programa todavía no es trabajo cargado. Los 12 módulos de la
//     propuesta que se le presentó a Mauricio (/vsl/mako-cs) son 52 features, y
//     meterlas al tablero hoy sería enterrar 460 tareas reales bajo 52 hipótesis.
//   · La otra mitad —lo de Mauricio— SÍ va al plan, y la sub-tab «Roadmap» de esta
//     misma área lo lee de ahí. Las dos vistas conviven a propósito: ésta es el
//     PROGRAMA, aquélla es el TRABAJO.
//
// Cuando una de estas líneas se convierta en tarea del tablero, se marca `enPlan`
// y deja de competir con ella: la fuente de verdad del avance sigue siendo el plan.
//
// De dónde sale cada cosa:
//   · Sección «Con Mauricio» → docs/sprint-servicio-mauricio.md, que a su vez sale
//     de las 7 reuniones del 4/7 al 6/8 (corrida wf_92bf7d0a-363) y del Google Doc
//     del Sprint. Las citas son textuales, con su fecha y su timestamp.
//   · Sección «La propuesta original» → public/vsl-assets/mako-cs.html, decodificado.
//     Los tags `listo` / `expande` son los que el propio documento le mostró a
//     Mauricio: no son un diagnóstico de hoy. Donde el código dice otra cosa, está
//     anotado — es la parte más útil de esta pantalla.
// =============================================================================

import type { Tono } from '@/app/_ui';

/** El estado de una línea del programa. */
export type EstadoCS =
  | 'hecho'        // está construido y enchufado
  | 'en-curso'     // se está trabajando ahora
  | 'bloqueado'    // no avanza hasta que pase otra cosa
  | 'proximo'      // decidido, sin arrancar
  | 'idea'         // está en la propuesta, no se decidió
  | 'descartado';  // se evaluó y se dejó afuera, con motivo

/** El tono sale de la paleta compartida (`TONO` en app/_ui/tokens.ts), nunca de un
 *  `var(--…)` escrito al lado: es lo único que impide que el ámbar de acá y el de un
 *  botón se separen. Misma lección que ya está escrita en el registro del semáforo. */
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
  /** El tag que el documento original le mostró a Mauricio. No es el estado de hoy. */
  tagOriginal?: 'listo' | 'expande';
  /** La trampa, la contradicción o la cita que explica el estado. */
  nota?: string;
  /** Número de la tarea en /plan, si ya vive ahí. */
  enPlan?: number;
};

export type BloqueCS = {
  id: string;
  /** El rótulo corto de la izquierda: «01», «Paso 2», «✦». */
  n: string;
  titulo: string;
  que: string;
  items: ItemCS[];
};

export type SeccionCS = {
  id: string;
  titulo: string;
  intro: string;
  bloques: BloqueCS[];
};

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 1 · Lo que hay que resolver con Mauricio
// ─────────────────────────────────────────────────────────────────────────────

const MAURICIO: SeccionCS = {
  id: 'mauricio',
  titulo: 'Con Mauricio, ahora',
  intro:
    'El Sprint de Servicio se cerró VERBALMENTE el 8/7 —«Cerramos ahora ya, 500 dólares extra por los próximos dos meses»— y el 10/7 es la fecha del primer pago, no de la firma. El «10 de septiembre» del documento no se dijo nunca en ninguna reunión: el disparador que él puso es de resultado, no de calendario («sistema andando para ~15 y cinco casos de éxito»). En cinco semanas no hubo ni una revisión de sprint.',
  bloques: [
    {
      id: 'bucle',
      n: 'El bucle',
      titulo: 'Los 5 pasos',
      que:
        'Definidos el 31/7 [03:46:44]. Es el único activo metodológico que salió de estas ocho semanas, y unifica tres de los cuatro frentes: el 01, el 02 y el 03 son piezas del MISMO bucle. Reencuadrar el sprint como «montar el bucle para UN cliente» da el criterio de terminado que hoy no existe.',
      items: [
        {
          titulo: 'Paso 1 · El cliente ve el video del bloque antes de la reunión',
          que: 'Mata el explicar la metodología en vivo, cliente por cliente, cada vez.',
          estado: 'bloqueado',
          nota: 'Depende de la plataforma (frente 02) y de que él grabe. El 16/7 [01:28:04]: «lo que te está haciendo falta son los tutoriales… tú le intentas enviar lo que sea al cliente y te dice "no lo entiendo". Entonces, al final, por eso es que decides terminar haciéndolo tú».',
        },
        {
          titulo: 'Paso 2 · Hace la tarea ANTES, y la llamada se agenda cuando la termina',
          que: 'Textual: «obligatorio que tu cliente se termine la tarea para avanzar en el proceso, si no se terminó la tarea está en su cancha el problema».',
          estado: 'proximo',
          nota: 'Ataca su cuello de botella declarado el 29/7 [01:55:37]: «invertirle mucho tiempo en estar con los clientes para que ellos me den y yo llenar el formato de Excel». Y mata la reunión de calendario fijo: la llamada se gana.',
        },
        {
          titulo: 'Paso 3 · En la llamada revisan la tarea y la perfeccionan',
          que: 'La llamada deja de ser extracción de datos y pasa a ser criterio.',
          estado: 'hecho',
          nota: 'Es lo único que él dijo que NO delega (31/7 [03:22:56] «No voy a dejar de tener las sesiones»). Ya lo hace así: no hay nada que construir.',
        },
        {
          titulo: 'Paso 4 · La IA lee el Fathom y reescribe las respuestas del cliente',
          que: 'Mata el «peinado» manual que hoy hace él a mano después de cada junta.',
          estado: 'proximo',
          nota: '⚠️ Dependencia dura: sin Fathom no hay paso 4, y Fathom ya falló dos veces documentadas (16/7 [00:01:15] Artemisa no entró a las juntas de todo un día; 31/7 [03:50:09] «no jaló la IA, no hubo de Esquer»). El paso necesita un camino cuando la grabación no está.',
        },
        {
          titulo: 'Paso 5 · El cliente entra, pule lo que hizo la IA y aprueba',
          que: 'La propiedad. Y el efecto que él más valora: que el empresario tenga claridad ANTES de que exista el tablero.',
          estado: 'proximo',
          nota: '31/7 [03:33:35]: «antes de generar el tablero, si lo hacemos bien el proceso… los empresarios empiezan a tener una claridad que no tenían… ya andan ching y ching con esa persona para que haga la tarea».',
        },
      ],
    },
    {
      id: 'frente-01',
      n: '01',
      titulo: 'Prompt maestro de tableros',
      que: 'Su mayor sangría de tiempo. Acordado el 8/7 [01:18:59]: «un prompt maestro que sea mucho más robusto… y que sea un skill». Hecho por Martín: nada. Hecho por Mauricio, solo: bastante.',
      items: [
        {
          titulo: 'El esquema de la matriz vinculada, como módulo puro',
          que: 'Las 14 columnas del Cuestionario Maestro (MCI → Objetivo LAG → Área → Palanca → cómo se mide → verde/amarillo/rojo → evidencia → corte) en un `lib/tablero-matriz.ts` sin `server-only`, para que un test lo importe.',
          estado: 'proximo',
        },
        {
          titulo: 'El validador determinista de las 6 auditorías',
          que: 'Área sin objetivo vinculado · MCI sin área que la sirva · objetivo con más de 3 palancas · palanca repetida con otro nombre · responsable sin autoridad · habilitadora crítica sin objetivo. Más los traslapes de umbral.',
          estado: 'proximo',
          nota: 'Su cuestionario ya trae su propia capa de validación: es exactamente lo que AGENTS.md exige («una regla en un prompt no es una regla»). Las cinco primeras se escriben en código sin ambigüedad.',
        },
        {
          titulo: 'El prompt maestro, editable en /contexto',
          que: 'En `lib/prompt-registry.ts`, para que se edite sin push (cada push cuesta ~US$0,09) y con historial.',
          estado: 'proximo',
        },
        {
          titulo: 'La skill de Claude Code que emite el tablero',
          que: 'MaKo no emite código en runtime en ningún lado (verificado por grep). El generador va afuera, generado DESDE el código con `--check` en el pre-push, como `lib/agente-skill.ts`.',
          estado: 'proximo',
        },
        {
          titulo: 'Que llene, no solo que emita',
          que: 'Proponer evidencia y umbrales a partir de lo que ya funcionó en los otros clientes, y devolver la tabla de huecos con responsable y fecha.',
          estado: 'proximo',
          nota: '⚠️ El reencuadre que cambia el frente. Sus propios documentos dicen que el bloqueo #1 del programa es DEFINIR LA EVIDENCIA (tres semanas paradas con Patricia) y el #2 poner el umbral. Un generador que toma un cuestionario ya lleno resuelve el ÚLTIMO tramo.',
        },
        {
          titulo: 'Probarlo contra un tablero que él YA hizo',
          que: 'Esquer o Baja Teriyaki. Si no reproduce lo que construyó a mano, no sirve.',
          estado: 'proximo',
        },
      ],
    },
    {
      id: 'frente-02',
      n: '02',
      titulo: 'Plataforma de contenido · Whop',
      que: 'El único frente en movimiento, y está bloqueado. La comparativa de 3-4 opciones se prometió el 8/7 [01:16:16] y nunca se entregó.',
      items: [
        {
          titulo: 'Whop: elegida',
          que: 'Es la alternativa gratuita que tiene API. Decisión de Martín, 11/8.',
          estado: 'en-curso',
          nota: 'Cierra el compromiso más viejo del sprint. Circle y Thinkific se nombraron el 4/7 y el 8/7 y no volvieron a aparecer: la plataforma llevaba cinco semanas sin elegir.',
        },
        {
          titulo: 'Conectar Whop por API a MaKo',
          que: 'No se desarrolla la plataforma: se conecta. Alcance acotado por Martín el 6/8 [01:11:00]: «no vamos a desarrollarlo dentro de Maco… lo que sí voy a hacer es la conexión de API».',
          estado: 'proximo',
          nota: 'Regla RE-IMPUESTA por Mauricio el 6/8 [01:10:44]: «estamos claros que no queremos desarrollar… queremos pagar un service, un software as a service que ya está ahí, que se adecúa más o menos». Ese «más o menos» es la licencia para no optimizar.',
        },
        {
          titulo: 'Montar el programa por bloques y dar de alta a los clientes',
          que: 'La estructura por fases del programa, con los videos de cada bloque.',
          estado: 'bloqueado',
          nota: 'Espera los 5 entregables de Mauricio, prometidos el 6/8 [01:09:37] «Ya los tengo, ya te lo envío hoy mismo». Sin confirmación de recepción.',
        },
        {
          titulo: 'Sacar el `const WS = 1` de /api/compartir',
          que: 'Hoy la ruta que comparte material está clavada al workspace 1, con `RECURSOS = [curso, branding]`. Sin eso no sirve para el material de otro workspace.',
          estado: 'proximo',
          nota: 'app/api/compartir/route.ts:25. Un día de plomería; el resto del frente es él grabando.',
        },
        {
          titulo: 'Restricciones de diseño, dichas por él',
          que: 'Nada de Notion (16/7 [01:42:12]: «La de Notion, porque ellos no lo van a hacer ahí jamás»). Y 31/7 [03:05:26]: «son empresarios que todos tienen TDAH… la mayoría no creas que le sabe la computadora».',
          estado: 'hecho',
        },
      ],
    },
    {
      id: 'frente-03',
      n: '03',
      titulo: 'Seguimiento de sus clientes',
      que: 'Está más cerca de lo que nadie cree. El documento dice «un tablero simple —no MaKo—», pero del 16/7 en adelante es MAURICIO quien pide que viva adentro de MaKo. Gana lo posterior.',
      items: [
        {
          titulo: 'Sus clientes ya son proyectos de su tablero',
          que: 'Seis, con el prefijo canónico: Grupo Esquer · Baja Teriyaki · Vértice Industrial · Aspro · TEXX · Macario Romero (HMO). Los mismos del Análisis de fases que mandó.',
          estado: 'hecho',
          nota: 'lib/todo-proyectos-catalogo.ts → PREFIJO_CLIENTE · scripts/reordenar-boards-clientes.ts:52-59.',
        },
        {
          titulo: 'Sus reuniones ya caen en el cliente correcto',
          que: '`resolverClienteDeReunion` resuelve por tres caminos con nivel de confianza y devuelve `null` en vez de inventar.',
          estado: 'hecho',
          nota: 'lib/reunion-cliente.ts:88-115. El barrido de agosto movió 37 tareas (commit 2742a8e) respetando las 12 que él había reasignado a mano.',
        },
        {
          titulo: 'Cron de compromisos vencidos',
          que: 'Lo único del sprint con CERO líneas escritas, y el más barato: `tareas-verificar` ya recorre workspaces y ya emite un aviso agrupado por día. Es la misma consulta al revés.',
          estado: 'proximo',
          nota: '`grep -rn "deadline" app/api/cron/` → cero. Molde: app/api/cron/tareas-verificar/route.ts:48-73 y tracking-vigilante/route.ts:82.',
        },
        {
          titulo: 'Vista de cartera: una fila por cliente',
          que: 'Último contacto, compromisos abiertos, vencidos, próximo hito y semáforo. Derivada de lo que ya hay, no un modelo nuevo.',
          estado: 'proximo',
          nota: 'Molde ya auditado: app/admin/agente/page.tsx:49-66.',
        },
        {
          titulo: 'Lo que no se deriva: etapa del encargo, próximo hito, estado manual',
          que: 'Una tabla chica colgada del proyecto que ya existe. No una entidad nueva.',
          estado: 'proximo',
          nota: '⚠️ El nombre no puede ser `FASES`: ya hay TRES en el repo que compilan sin conflicto (lib/fase-diagnostico.ts:80, lib/mako-fases.ts:12, app/admin/dev/pricing/modelo.ts). Sugerido: `ETAPAS_ENCARGO`.',
        },
        {
          titulo: 'El semáforo de palancas: que MaKo lo obligue a ÉL',
          que: 'Su pedido más fuerte de las 7 reuniones, y no es «ver mis clientes»: es su propia metodología —palanca con dueño, umbral y evidencia— aplicada a él mismo.',
          estado: 'proximo',
          nota: '31/7 [02:09:00]: «si Mauricio Bustos no subió con evidencia los siete videos a la semana, no va a ocurrir». Y [02:12:04]: «¿qué me va a dar el valor de que la herramienta sea mi brújula? Porque obligas a la gente». Sirve a TODOS los workspaces: es la bajada concreta del doer.',
        },
      ],
    },
    {
      id: 'frente-04',
      n: '04',
      titulo: 'Graduación y casos de éxito',
      que: 'No hay materia prima, y hay que renegociarlo ahora — no el 10/9.',
      items: [
        {
          titulo: '⚠️ Ningún cliente llegó todavía a la etapa que produce el caso',
          que: '29/7 [00:24:28]: «No tengo ningún cliente que todavía ha llegado a las juntas o a la implementación de los tableros con las juntas, no tengo ninguno todavía».',
          estado: 'bloqueado',
          nota: '31/7 [00:07:00]: «no tengo nada de casos de éxito documentados, ni mostrados en landing, ni nada» → «Sí, eso tenemos que hacerlo» → no se volvió a tocar en las 4 horas restantes.',
        },
        {
          titulo: 'Cambiarlo por la oferta de renovación de octubre/noviembre',
          que: 'Es lo que sí tiene reloj. 8/7 [01:20:25]: «en octubre y noviembre van a empezar a vencerse ya. Entonces, ¿qué les voy a ofrecer? No está claro».',
          estado: 'proximo',
          nota: 'Ya está como prioridad del Perro en su board (6/8 [01:15:00]). Es la salida recomendada.',
        },
        {
          titulo: 'Protocolo de outboarding escrito',
          que: 'La fase 4 del programa, que hoy no está definida: qué se entrega, cómo se cierra, cuándo.',
          estado: 'proximo',
          nota: 'Documento, no software. «Graduación» aparece una sola vez en todo el repo y es dentro del texto de una clase del curso (app/conocimientos/curso.ts:6590).',
        },
        {
          titulo: 'El detector de «promesa cumplida»',
          que: 'Lo único que el software puede aportar acá: detectar quién está listo. Depende de que exista la matriz del frente 01.',
          estado: 'idea',
        },
      ],
    },
    {
      id: 'deuda',
      n: '⚠',
      titulo: 'Compromisos vencidos y bugs que él reportó',
      que: 'Lo que está prometido y no entregado. Cada hora que no sale de acá le da la razón a su objeción del 8/7: «es nice, es cool, es wow, pero no es el core».',
      items: [
        {
          titulo: 'El roadmap del sprint',
          que: 'Prometido para el MISMO 8/7 [01:28:52]: «yo hoy te mando un roadmap de las reuniones que vamos a tener que tener… qué priorizamos primero». No existe.',
          estado: 'en-curso',
          nota: 'Esta pantalla es eso.',
        },
        {
          titulo: 'Poner el consumo de IA bajo control',
          que: 'Acuerdo ya cerrado el 6/8 [00:07:15] y sin ejecutar: plan propio de US$200 y auto-límite de un porcentaje del Cloud de Mauricio.',
          estado: 'proximo',
          nota: '⚠️ El riesgo de relación más grande. 6/8 [00:04:02]: «tuve como tres días sin poder trabajar y tuve que pedir disculpas a mi cliente». Desarrollar MaKo sobre su cuenta se comió los créditos con los que él arma los tableros: el frente 01 se bloqueó a sí mismo.',
        },
        {
          titulo: 'Agendar la sesión del flujo de audios a leads viejos',
          que: 'El 6/8 él lo puso como lo más urgente: «está la fábrica de los carros y hay muchos carros, pero ninguno anda». Se propuso la reunión y se cortó la llamada antes de agendarla.',
          estado: 'proximo',
        },
        {
          titulo: 'Vista móvil rota',
          que: '6/8 [00:51:17]: «la mayoría andamos en el tema del celular o la tablet». Intentó usar MaKo desde el teléfono en vivo y no pudo.',
          estado: 'proximo',
        },
        {
          titulo: 'Fricción para agendar la Junta 2 desde adentro de la llamada',
          que: '6/8 [00:49:00]: «yo estoy con el cliente en la junta y meterme a Maco para hacer eso me genera una fricción… yo necesito apartar rápido el espacio». Terminó cargándola a mano en su calendario.',
          estado: 'proximo',
        },
        {
          titulo: 'El mapa marca cero en Ciudad de México',
          que: 'Reportado el 8/7 [01:42:50]. No es un dato faltante: el `startsWith` bidireccional de `valueFor()` hace que el Estado de México se quede con el valor de CDMX.',
          estado: 'proximo',
          nota: 'app/marketing/ad-charts.tsx:514-519. El detalle, en docs/hallazgos-ads.md.',
        },
        {
          titulo: 'Otros bugs abiertos que él reportó',
          que: '«Pregúntale a MaKo» no funciona · histórico que mezcla meses · crear proyecto por WhatsApp · audio de WhatsApp que no se transcribe · la IA que mete tareas en el proyecto equivocado · filtro de fecha en costos de IA · el saldo de Claude que hay que actualizar a mano.',
          estado: 'proximo',
        },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN 2 · La propuesta original (/vsl/mako-cs)
// ─────────────────────────────────────────────────────────────────────────────

const PROPUESTA: SeccionCS = {
  id: 'propuesta',
  titulo: 'La propuesta original',
  intro:
    'Los 12 módulos y 52 features que se le presentaron a Mauricio el 8/7 por US$9.000 en 6 cuotas, y que rechazó ese mismo día — no por precio sino por timing: «9 mil dólares van a ser una ganga… pero es el timing». No está muerto: lo aplazó con gatillo («Si yo tengo eso para 15 y podemos empezar a tener testimonios de 5, a lo mejor ya estamos listos para escalar. Incluso hasta me vas a querer cobrar más»). Los tags `listo` y `expande` son los que el documento le mostró: donde el código de hoy dice otra cosa, está anotado.',
  bloques: [
    {
      id: 'm01', n: '01', titulo: 'Tu cartera',
      que: 'El hub: cada cliente y su estado, en una sola pantalla.',
      items: [
        { titulo: 'Cartera de clientes', que: 'Todos tus clientes activos y su avance, ordenados del que necesita atención al que va bien.', estado: 'proximo', tagOriginal: 'listo', nota: '⚠️ El tag mentía: no existe ninguna vista de cartera. Es el frente 03.' },
      ],
    },
    {
      id: 'm02', n: '02', titulo: 'Onboarding',
      que: 'El pago se vuelve cliente listo, sin mover un dedo.',
      items: [
        { titulo: 'Traspaso de venta a servicio', que: 'El cliente que paga entra solo al circuito de entrega: datos, accesos y bienvenida.', estado: 'idea', nota: 'El pipeline muere en `ganado` (lib/pipeline.ts:46-59): no hay etapa posterior.' },
        { titulo: 'Firma de contrato', que: 'El contrato sale, se firma y se archiva sin que persigas a nadie.', estado: 'descartado', nota: 'Sirve a un negocio de coaching de alto volumen, no a 7 clientes.' },
        { titulo: 'Formulario de arranque', que: 'El cliente completa un formulario una vez y MaKo le arma la ficha, la carpeta y el perfil.', estado: 'proximo', nota: 'Se recicla como el paso 2 del bucle.' },
        { titulo: 'Tracker de onboarding', que: 'Cada cliente nuevo y en qué paso del arranque está.', estado: 'idea' },
        { titulo: 'Asignación de consultor', que: 'MaKo lee las respuestas del formulario y te sugiere el consultor que mejor le calza.', estado: 'descartado', nota: 'Mauricio es el único consultor.' },
        { titulo: 'Filtro de pago', que: 'Nadie accede sin haber pagado. MaKo cruza el pago antes de abrir la puerta.', estado: 'idea', nota: 'Whop ya lo resuelve.' },
      ],
    },
    {
      id: 'm03', n: '03', titulo: 'El día a día',
      que: 'El trabajo recurrente con cada cliente, sin que se caiga nada. Es el módulo con más piezas ya construidas.',
      items: [
        { titulo: 'Preparación de sesión', que: 'Diez minutos antes, MaKo te arma el resumen del cliente y el objetivo del día.', estado: 'idea', tagOriginal: 'listo' },
        { titulo: 'Bitácora automática', que: 'Grabás la sesión y MaKo la convierte en notas ordenadas dentro de la ficha del cliente.', estado: 'hecho', tagOriginal: 'listo', nota: 'Es el pipeline de reuniones de Fathom, que ya corre. Y es el paso 4 del bucle.' },
        { titulo: 'Las dos canchas', que: 'Qué te toca a vos y qué al cliente, con responsable y fecha.', estado: 'hecho', tagOriginal: 'listo' },
        { titulo: 'Seguimiento que no falla', que: 'Si alguien no responde o no subió su evidencia, MaKo lo detecta y te avisa solo.', estado: 'proximo', tagOriginal: 'listo', nota: '⚠️ El tag mentía en la mitad: la alerta de compromiso VENCIDO no existe (cero líneas).' },
        { titulo: 'Fases configurables', que: 'Cada cliente avanza por las fases que vos definís. Si se traba de más, salta la alerta.', estado: 'proximo', tagOriginal: 'listo', nota: '⚠️ Las fases existen pero son CONSTANTES de código (lib/fase-diagnostico.ts): no se configuran por workspace.' },
      ],
    },
    {
      id: 'm04', n: '04', titulo: 'Resultados',
      que: 'Que el cliente logre lo prometido, medido. Es lo que enciende todo lo que sigue.',
      items: [
        { titulo: 'Plan de acción', que: 'El roadmap de cada cliente, con hitos y fechas, que armás una vez y él va cumpliendo.', estado: 'proximo', nota: 'Es la salida del paso 5 del bucle: la matriz vinculada.' },
        { titulo: 'Tracker de resultado', que: 'La promesa que le hiciste, medida: de dónde salió, dónde está y cuánto le falta.', estado: 'idea' },
        { titulo: 'KPIs del cliente', que: 'Tareas asignadas y cumplidas, sesiones entregadas, cuellos de botella.', estado: 'idea' },
        { titulo: 'Quick wins', que: 'MaKo marca las primeras victorias de cada cliente para que las uses temprano.', estado: 'idea' },
        { titulo: 'Promesa cumplida', que: 'Cuando un cliente llega a su meta, MaKo lo detecta y dispara lo que sigue: caso de éxito, referido, ascenso.', estado: 'idea', nota: 'Es el detector del frente 04. Depende de la matriz.' },
      ],
    },
    {
      id: 'm05', n: '05', titulo: 'Growth Loop',
      que: 'La entrega vuelve a vender. MaKo ya capta y vende; acá cierra el círculo.',
      items: [
        { titulo: 'Pipeline de casos de éxito', que: 'De «logró la promesa» a testimonio publicado, por estados. Nada se pierde entre el resultado y el video.', estado: 'proximo', nota: 'Sirve a TODOS los workspaces: hoy MaKo tiene el vocabulario de creativos (`caso-exito`, `testimonio` en lib/ads-analyst.ts:54) sin nada que lo alimente.' },
        { titulo: 'Guía de entrevista', que: 'La entrevista de caso de éxito con las preguntas listas y la grabación capturada sola.', estado: 'proximo' },
        { titulo: 'Banco de testimonios', que: 'Los elogios de tus sesiones, ordenados y etiquetados, listos para marketing.', estado: 'idea', tagOriginal: 'expande' },
        { titulo: 'Motor de referidos', que: 'Cuando un cliente está feliz, MaKo te avisa que es momento de pedirle referidos, con el guión listo.', estado: 'idea' },
        { titulo: 'Tracking de referidos', que: 'Link propio por cliente. MaKo sabe quién trajo a quién y cuánto le corresponde.', estado: 'idea' },
        { titulo: 'Ascenso y renovación', que: 'Cuando un cliente termina su ciclo, MaKo levanta la oferta del siguiente nivel.', estado: 'proximo', nota: 'Es lo que tiene reloj: octubre/noviembre.' },
      ],
    },
    {
      id: 'm06', n: '06', titulo: 'Retención y recupero',
      que: 'Hoy detectás el riesgo. Acá también actuás sobre él.',
      items: [
        { titulo: 'Satisfacción y riesgo', que: 'Medís qué tan conforme está cada cliente y MaKo te marca a los que están por irse.', estado: 'idea', tagOriginal: 'listo', nota: '⚠️ El tag mentía: no hay NPS ni encuesta en el código (`grep -i "\\bnps\\b" lib/` → cero).', enPlan: 108 },
        { titulo: 'Alarmas de churn', que: 'Más allá de la encuesta: comportamiento, KPIs e impagos disparan la alerta antes de tiempo.', estado: 'idea', tagOriginal: 'expande', enPlan: 109 },
        { titulo: 'Guiones de recuperación', que: 'Cuando un cliente se pone en rojo, MaKo no solo lo marca: te da el guión correcto según el motivo.', estado: 'proximo', nota: '⭐ Es la definición operativa de DOER, y aplica idéntico al lead en rojo de cualquier workspace. Es el arreglo del semáforo de /general.' },
        { titulo: 'Pausas y cancelaciones', que: 'Un flujo para cuando alguien se quiere ir: entender el porqué, proponer pausa, recordar la garantía.', estado: 'idea' },
        { titulo: 'Gestión de cobros', que: 'Planes que se renegocian, impagos que se persiguen solos y la próxima fecha de cobro siempre a la vista.', estado: 'idea', nota: 'Parte ya existe: `getCuotasPendientes` en lib/pagos.ts:487-539.' },
        { titulo: 'Escudo de disputas', que: 'Si un cliente llama al banco, MaKo te arma la evidencia para responder en horas.', estado: 'descartado' },
        { titulo: 'Blindaje legal', que: 'Difamación y piratería: los reclamos y guiones a mano cuando los necesitás.', estado: 'descartado' },
      ],
    },
    {
      id: 'm07', n: '07', titulo: 'Métricas',
      que: 'El tablero de mando de tu entrega. Es el módulo más lejos de existir: todo es aire hoy.',
      items: [
        { titulo: 'NPS', que: 'MaKo calcula tu NPS solo y te muestra la tendencia.', estado: 'descartado', nota: 'Con 7 clientes activos un NPS no significa nada.' },
        { titulo: 'Customer Effort Score', que: 'Qué tan fácil le resulta a tu cliente trabajar con vos, medido en cada interacción.', estado: 'descartado' },
        { titulo: 'Churn Rate', que: 'Tu tasa de bajas mes a mes, contra el estándar de la industria.', estado: 'descartado' },
        { titulo: 'Feedback multipunto', que: 'Medís satisfacción en cada instancia: arranque, módulos, 1:1, grupales, pago.', estado: 'idea', tagOriginal: 'expande', nota: 'Lo único rescatable del módulo: hoy tiene 4 respuestas de una encuesta anónima (31/7 [00:06:46]).' },
        { titulo: 'Ecuación de servicio', que: 'Satisfacción y casos de éxito arriba, costo y tiempo de entrega abajo.', estado: 'descartado' },
      ],
    },
    {
      id: 'm08', n: '08', titulo: 'Grupales y cohortes',
      que: 'La entrega de a muchos. Sube de prioridad: el modelo grupal es su camino declarado a los US$50K.',
      items: [
        { titulo: 'Curso y comunidad', que: 'El avance del curso y la comunidad, dentro de la ficha de cada cliente.', estado: 'en-curso', tagOriginal: 'listo', nota: 'Es el frente 02. Whop.' },
        { titulo: 'Sesiones grupales', que: 'Las llamadas grupales con formulario de preguntas y hoja de Q&A. Cada pregunta queda registrada por cliente.', estado: 'idea', nota: '6/8: el grupal requiere sí o sí tener los cursos grabados antes.' },
        { titulo: 'Grabaciones con marcas de tiempo', que: 'La grabación sube al área de miembros con cada pregunta marcada en su minuto.', estado: 'idea' },
        { titulo: 'Gestión de camadas', que: 'Tus clientes por cohorte, no solo de a uno.', estado: 'idea' },
        { titulo: 'Control de sala', que: 'A las grupales solo entra quien está activo e invitado.', estado: 'idea', nota: 'Whop lo resuelve.' },
      ],
    },
    {
      id: 'm09', n: '09', titulo: 'Comunidad',
      que: 'Que no se enfríen, sin estar encima de cada uno.',
      items: [
        { titulo: 'Gamificación', que: 'Niveles, reconocimientos y logros para tus clientes verdes.', estado: 'descartado' },
        { titulo: 'Check-ins automáticos', que: 'MaKo le pregunta a cada cliente cómo va, sin que muevas un dedo.', estado: 'idea' },
        { titulo: 'Grupos de accountability', que: 'MaKo arma grupos entre clientes para que se empujen entre ellos.', estado: 'idea' },
        { titulo: 'Momentos wow', que: 'Detalles que el cliente no espera, programados solos.', estado: 'descartado' },
      ],
    },
    {
      id: 'm10', n: '10', titulo: 'Operación y equipo',
      que: 'Lo que hace que el equipo siga tu forma de trabajar, no la suya.',
      items: [
        { titulo: 'Biblioteca de procesos (SOPs)', que: 'Tu forma de entregar, documentada una vez, viva adentro de MaKo.', estado: 'proximo', nota: 'Es el entregable «servicio escrito» del sprint.' },
        { titulo: 'Roles y ruteo', que: 'Cada evento cae en el equipo correcto: consultor, CS o CEO, con su tarea y su fecha.', estado: 'idea', tagOriginal: 'expande' },
        { titulo: 'Notificaciones a tus canales', que: 'Nuevo cliente, disputa, NPS bajo: MaKo lo empuja a Slack o WhatsApp al instante.', estado: 'proximo', nota: 'El motor ya existe (`emitirAviso`), y el 6/8 apareció el problema real: el aviso llegó pero se perdió entre el ruido y le costó media reunión.' },
      ],
    },
    {
      id: 'm11', n: '11', titulo: 'El cerebro',
      que: 'De todos los datos, qué hacer.',
      items: [
        { titulo: 'Preguntale a MaKo', que: 'Le preguntás por cualquier cliente y responde con su historial completo.', estado: 'proximo', tagOriginal: 'listo', nota: '⚠️ Él reportó el 31/7 [01:43:10] que NO funciona.' },
        { titulo: 'Semáforo del negocio', que: 'Verde en estándar, amarillo atención, rojo intervení. «No te muestra el problema, te dice cuál atacar primero».', estado: 'proximo', tagOriginal: 'listo', nota: '⭐ La ironía más útil del documento: se vendió como HECHO el comportamiento que después se reclamó como faltante. Hoy son reglas hardcodeadas inline (app/general/page.tsx:107-195) y cada alerta termina en un `<Link>`. Analiza y linkea; no ejecuta.' },
      ],
    },
    {
      id: 'generador', n: '✦', titulo: 'Generador de tableros',
      que: 'La tarjeta destacada del documento, con el badge «El más potente» — y a la vez el módulo más flaco: 3 features, ninguna construida, y una de las tres es una advertencia.',
      items: [
        { titulo: 'Plantillas seleccionables', que: 'Listas para configurar, sin partir de cero.', estado: 'proximo', nota: 'El documento lo planteaba como plantillas + formulario. Lo que se acordó después con Mauricio es otra cosa: un prompt maestro como skill. Ver el frente 01.' },
        { titulo: 'Se configura en un formulario', que: 'No se programa: se completa y queda armado.', estado: 'proximo' },
        { titulo: 'Honesto', que: '«Conectar los datos de cada empresa sigue siendo puesta a punto — pero una fracción del esfuerzo de hoy».', estado: 'hecho', nota: 'La advertencia sigue siendo cierta, y es la parte del frente 01 que nadie mira: el dato base no existe en ninguno de sus clientes.' },
      ],
    },
  ],
};

export const SECCIONES_CS: SeccionCS[] = [MAURICIO, PROPUESTA];

/** El conteo por estado, para el resumen de arriba. Derivado, nunca escrito a mano. */
export function conteoCS(seccion: SeccionCS): Record<EstadoCS, number> {
  const out = { hecho: 0, 'en-curso': 0, bloqueado: 0, proximo: 0, idea: 0, descartado: 0 } as Record<EstadoCS, number>;
  for (const b of seccion.bloques) for (const i of b.items) out[i.estado]++;
  return out;
}
