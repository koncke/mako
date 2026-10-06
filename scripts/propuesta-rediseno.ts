// =============================================================================
// propuesta-rediseno — el borrador con lo que sale del documento de rediseño
// =============================================================================
// Sigue la skill .claude/skills/plan-tareas: NO inserta en plan_tareas. Crea UNA
// propuesta (plan_propuestas) con preguntas, y el Perro puntúa al aplicar.
//
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/propuesta-rediseno.ts
//   ... --apply  → la crea de verdad y devuelve el link
//
// Fuente: «MaKo · Contexto integral y especificación de rediseño», v1 del 4/8/2026.
// Los proyectos salen TODOS del catálogo cerrado (lib/plan-proyectos-catalogo).
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { runWithWorkspace } from '../lib/workspace';
import { getSupabaseServer } from '../lib/supabase';
import { crearPropuesta } from '../lib/plan-propuesta';
import { delCatalogo } from '../lib/plan-proyectos-catalogo';
import { APP_BASE_URL } from '../lib/app-url';

const APLICAR = process.argv.includes('--apply');

const DOC = 'el documento «MaKo · Contexto integral y especificación de rediseño» (v1, 4/8/2026)';

type T = { titulo: string; proyecto: string; detalle: string };

const TAREAS: T[] = [
  // ── El sistema global (Fase 1 del documento) ──────────────────────────────
  {
    titulo: 'Biblioteca de componentes: los primitives que hoy no existen',
    proyecto: 'Diseño de la app',
    detalle: `${DOC} mide la causa de la inconsistencia visual y no es estética: «El código repite estilos, botones y controles localmente. Las diferencias no son solo estéticas: nacen de la ausencia de primitives y patrones globales». Los números que cuenta del repo: 6.965 usos de style={{...}} contra 762 de className, 1.065 etiquetas <button> sueltas, 258 <input> y 89 <textarea>. Hay componentes compartidos (Dropdown, WizardShell, SeccionCard, ConfirmModal, UndoToast) pero «todavía no hay una biblioteca central de primitives que cubra botones, campos, selects, tabs, badges, estados, tablas, modales, drawers y charts con variantes coherentes».
Lo que hay que construir es esa biblioteca, con los estados de cada pieza: Button (primaria, secundaria, terciaria, destructiva y acción de MaKo × default/hover/focus/active/loading/disabled/éxito temporal), IconButton con tooltip y área táctil, Input/Textarea con label, ayuda, validación, error, prefijo, sufijo y contador, Select/Combobox con búsqueda para listas largas, Checkbox/Radio/Switch, DateRange, Badge/Tag/Status (que hoy se usan indistintamente y no deberían), Avatar, Tooltip/Popover, Progress/Spinner/Skeleton (cada uno comunica una cosa distinta) y Divider.
Está lista cuando una pantalla nueva se puede armar sin escribir un solo style inline nuevo, y cuando cambiar el radio de los botones es UN cambio y no ciento sesenta. Ojo con el orden: la conclusión del diagnóstico es que «el rediseño no debe comenzar corrigiendo pantallas aisladas», así que esto va ANTES de tocar tabs.`,
  },
  {
    titulo: 'Navegación por intención: Hoy · Operar · Analizar · Crear y automatizar · Administrar',
    proyecto: 'Diseño de la app',
    detalle: `El principio del documento es «La navegación debe pasar de module-first a priority-first». Hoy el sidebar es el inventario de módulos: «General, CRM, Dashboard, Experiments y Plan compiten visualmente al mismo nivel, aunque el dueño utiliza algunas áreas diariamente y otras de forma semanal o mensual».
La agrupación propuesta, textual: HOY (acción prioritaria, objetivos, alertas, seguimientos y progreso → General renovado, Objetivos, actividad del Guardián) · OPERAR (CRM, Chats, Plan) · ANALIZAR (Dashboard, Ads Analyst, Closing Analyst, Experiments/Second Brain) · CREAR Y AUTOMATIZAR (Content Machine, Chat Agent, Ads Writer, Builders, Competitor Spy, Tools) · ADMINISTRAR (Onboarding, Integraciones, Configuraciones, Perfil).
Con cuatro reglas duras: el estado activo tiene que entenderse sin depender del dorado; los grupos no pueden esconder funciones de uso diario en flyouts difíciles de descubrir; los badges representan una obligación concreta y no ruido; y las rutas administrativas no se mezclan visualmente con las del producto cuando el usuario está operando un negocio.
Está lista cuando alguien que entra por primera vez sabe dónde mirar para saber QUÉ HACER HOY sin recorrer el sidebar entero. Toca el layout raíz (hoy monta siempre el Sidebar dentro de NotificationsProvider) y nav.ts.`,
  },
  {
    titulo: 'Un solo significado por color: dorado = MaKo piensa, azul = vos actuás',
    proyecto: 'Diseño de la app',
    detalle: `El documento lo marca como un problema estructural: «El dorado compite con estados y acciones. Marca, IA, warning, activo y decoración pueden usar tonos similares». Y mide la divergencia real: el logo entregado usa #F2B01E plano, globals.css tiene --accent #C8870C y --accent-soft #F0C60A, y MakoIntro anima el wordmark en Georgia alternando dorado y oscuro — tres dorados distintos para la misma marca.
Las reglas semánticas que hay que dejar escritas y aplicadas: dorado = MaKo piensa, detecta o aporta inteligencia. Azul (#2F6FED) = el usuario puede actuar, seleccionar, navegar o confirmar algo no destructivo. Verde (#1E9E57) = resultado favorable o completado. Warning = ámbar anaranjado DISTINTO del dorado de marca (hoy son #A8770F/#E8B30B y se confunden). Rojo (#D0504A) = riesgo, error o destrucción. Y los colores de categoría nunca compiten con los estados semánticos.
También hay que unificar el dorado maestro en #F2B01E y sacar la animación permanente del wordmark de la interfaz operativa: «Reservar gradientes, destellos y barridos para momentos puntuales de activación o proceso de MaKo».
Está lista cuando un usuario ve algo dorado y sabe, sin pensarlo, que ahí intervino MaKo.`,
  },
  {
    titulo: 'Los estados que faltan en cada pantalla (vacío, sin resultados, error, offline, sin permiso)',
    proyecto: 'Diseño de la app',
    detalle: `Principio 13.6 del documento: «Diseñar éxito, error, carga, vacío, sin resultados, sin permiso, datos desactualizados, acción pendiente, ejecución y undo». Hoy la app resuelve algunos y otros no aparecen nunca.
El inventario que pide, con la diferencia entre cada uno: EmptyState (primera vez sin contenido: propósito, siguiente paso y educación mínima) ≠ NoResults (hay datos pero el filtro no encontró nada, y tiene que conservar la distinción) ≠ ErrorState (local o total, con explicación y recuperación). Más Offline/StaleData indicando la última actualización, PermissionState por rol o capa —que NO se puede confundir con «esto es una función avanzada»—, ConfirmationDialog para lo irreversible, Toast para lo breve (y que «no sustituye un registro de actividad cuando la acción es importante») y Undo para lo reversible.
Está lista cuando ninguna pantalla de la app puede quedar en blanco sin decir qué pasó y qué hacer. Es lo que más se nota en una demo: una tabla vacía sin explicación parece un error del producto.`,
  },
  {
    titulo: 'La gramática de MaKo: los nueve estados de la IA, iguales en toda la app',
    proyecto: 'Diseño de la app',
    detalle: `El diagnóstico: «La inteligencia de MaKo aparece fragmentada. Retro, Second Brain, Perro Guardián, Semáforo, Chat Agent, Pregúntale a MaKo y recomendaciones analíticas no comparten todavía una gramática única».
Los nueve estados y qué comunica cada uno, textual del documento: DETECTÓ (encontró una señal: indicador discreto, evidencia resumida y nivel de importancia) · ESTÁ ANALIZANDO (progreso real y fuente de datos, «no usar animación decorativa indefinida») · EXPLICA (insight con título directo y evidencia expandible) · RECOMIENDA (acción, impacto esperado, esfuerzo, responsable y relación con el objetivo) · SOLICITA APROBACIÓN (resumen del alcance y cambios previstos) · EJECUTA (estado persistente y elementos afectados) · COMPLETÓ (resultado, cambios y próximo control) · VIGILA (condición, frecuencia, última revisión y criterio de alerta) · NO PUEDE CONCLUIR (qué fuente falta y cómo resolverlo).
Van con las dos descripciones funcionales que el documento propone fijar, porque «los conceptos diferenciales requieren traducción»: «Second Brain · Analiza todo tu negocio, conecta las señales y encuentra qué mover» y «Perro Guardián · Vigila riesgos, compromisos y resultados para que nada importante se pierda».
Está lista cuando el mismo estado se ve y se llama igual en el Plan, en el Dashboard, en el CRM y en el chat.`,
  },
  {
    titulo: 'Bases mobile dentro del sistema global (una tarea por pantalla, sheets, 44 px)',
    proyecto: 'Diseño de la app',
    detalle: `El documento separa la Fase 3 (mobile completo) de la Fase 1, pero avisa que «los componentes globales no pueden diseñarse como elementos exclusivamente desktop». Hoy la evidencia del repo es contundente: 2 media queries en globals.css (una de reduced-motion y otra de max-width 820px para un modal puntual) y 8 apariciones de utilidades sm:/md:/lg:/xl: en 273 archivos TSX. No hay layout mobile alternativo.
Lo que tiene que contemplar CADA primitive desde el arranque: una sola columna, encabezados compactos, acciones contextuales, navegación reducida (tres a cinco destinos según rol), filtros en sheet en vez de barra, tablas transformables y objetivos táctiles cercanos a 44 px. Más la escala tipográfica mobile del documento: texto base 16 px (no 14), secundario 14-15, metadata 13.
Las funciones que el documento marca como las de más sentido en teléfono —y que por lo tanto hay que probar primero— son: prioridad y objetivos de Hoy, alertas del Perro, Plan y tareas, CRM y siguiente acción, WhatsApp/Email y handoff, y las aprobaciones de MaKo.
Ojo: la plataforma final (web responsive, PWA, React Native o nativa) está marcada como PENDIENTE en el documento. Esta tarea NO la decide; deja el sistema preparado para cualquiera de las cuatro.`,
  },
  {
    titulo: 'Selector de contexto: negocio, producto, oferta y funnel activos',
    proyecto: 'Diseño de la app',
    detalle: `El documento fija una regla que hoy la app no cumple: «el usuario nunca debería analizar datos o ejecutar una acción sin saber sobre qué contexto opera». Y detrás hay un modelo de negocio que ya se sabe que va a cambiar: un negocio con varios productos, un producto con varias ofertas, una oferta con varios funnels, y tipos de venta que no son el VSL con llamada (mensajes sin landing, suscripción, carrito directo, webinar).
Lo que pide: un lugar único donde se vea y se cambie el contexto activo (negocio · producto · oferta · funnel), separado de la navegación funcional, y que no todos los niveles necesiten mostrarse siempre.
El propio documento marca como PENDIENTE «el comportamiento exacto del selector, la herencia entre niveles, los permisos de agencias y el cambio rápido entre varios negocios», y aclara: «Este documento solo fija que la arquitectura visual no debe impedirlos». Así que el entregable mínimo de esta tarea es que el App Shell nuevo TENGA el lugar reservado y que las métricas y las acciones sepan leer de ahí — aunque hoy haya un solo negocio, un producto y un funnel.`,
  },
  // ── Tab por tab ───────────────────────────────────────────────────────────
  {
    titulo: 'Foco: la prioridad de la semana con su origen, su resultado esperado y su revisión',
    proyecto: 'Foco',
    detalle: `Es donde el documento dice que se juega la tesis del producto: «General es el lugar donde la promesa de MaKo debe hacerse evidente. No debería competir con Dashboard». Hoy «resume metas y métricas» y debería ser «una vista de acciones y objetivos diarios/semanales».
Los seis campos que tiene que tener cada prioridad, textual: la ACCIÓN concreta y limitada, vinculada a un objetivo · la RAZÓN (la señal o el cuello de botella que la justifica) · el RESULTADO ESPERADO (qué indicador debería cambiar y en qué dirección) · el RESPONSABLE (quién actúa o qué agente puede prepararlo) · el PROGRESO · y la SIGUIENTE REVISIÓN (cuándo MaKo evalúa si funcionó).
Los ejemplos que dio el dueño: «Grabar siete anuncios esta semana», «Contactar a un conjunto específico de leads», «Cambiar los copies de la landing», «Gastar una cantidad determinada en campañas con un objetivo definido».
Y un requisito que hoy no existe: mostrar DE DÓNDE salió la prioridad, porque puede venir de Objetivos, del Plan, de Experiments, de la Retro/Second Brain, del diagnóstico del negocio, del CRM o de Ads. Sin el origen, la pantalla es una orden sin fundamento.
El reparto con Dashboard queda así: Foco decide y ejecuta; Dashboard comprende y analiza.`,
  },
  {
    titulo: 'Dashboard: separar salud, tendencia, diagnóstico y recomendación',
    proyecto: 'Dashboard',
    detalle: `El documento marca dos problemas distintos. Uno de jerarquía: «Reducir la competencia entre tarjetas de KPI» y «Distinguir salud, tendencia, diagnóstico y recomendación» — hoy las cuatro cosas se pintan como tarjetas iguales, así que un número descriptivo y una recomendación accionable pesan lo mismo. Otro de alcance: las métricas están «centradas en VSL Funnel» y hay que adaptarlas al tipo de funnel, además de permitir profundizar por negocio, producto, oferta, funnel y período.
Y una tercera que es de percepción: «Evitar que Marketing y Comercial parezcan dos productos diferentes».
El componente que lo ordena, del inventario del documento: KPI (valor, etiqueta, comparación, tendencia, período y definición accesible), Trend (dirección, magnitud, comparación y SIGNIFICADO semántico), Comparison (antes/después, período anterior, objetivo o benchmark) y Funnel con etapas configurables — «no fijar una única estructura VSL».
Está lista cuando alguien mira el Dashboard y puede decir en voz alta, sin ayuda, cuál de los números es un síntoma y cuál es un diagnóstico.`,
  },
  {
    titulo: 'Experiments: convertir el informe de texto en una experiencia de diagnóstico',
    proyecto: 'Experiments',
    detalle: `Es de los dos módulos que el documento marca con prioridad de diseño MUY ALTA. El estado: «Backend funcional; UX débil… Se percibe como mucho texto; Retro y Conclusiones no están bien integradas».
Lo que pide construir, en orden: mostrar el CUELLO DE BOTELLA, la PRIORIDAD, la EVIDENCIA, la HIPÓTESIS, las TAREAS, la EJECUCIÓN y el RESULTADO — el ciclo completo de aprendizaje, no un informe. Clarificar de una vez la relación entre Retro, Experiments y Conclusiones (hoy son tres cosas que se pisan). Y permitir «comparar lo recomendado con lo que finalmente se ejecutó», que es la única forma de que la Retro deje de ser una promesa.
También le da a Second Brain un lugar distinto: «Debe ser una capa transversal, no un silo de informes», con «mayor protagonismo y una presentación más memorable que un informe largo de texto» — pero advierte de no convertirlo en «una pantalla puramente decorativa».
Cuidado con no romper lo que ya funciona: Experiments es la fuente de verdad de las conclusiones del negocio y el resto de la app sugiere experimentos pero nunca concluye. Esa regla se mantiene.`,
  },
  {
    titulo: 'Plan: el resultado esperado de cada tarea y qué mide Graphics de verdad',
    proyecto: 'Plan',
    detalle: `El documento pone al Plan entre «las más trabajadas visualmente» y pide conservar la dirección minimalista como referencia interna, así que acá NO se rediseña: se completan dos huecos concretos.
Uno: «Mostrar origen de cada tarea: objetivo, experimento, lead, campaña, Guardian o acción manual» y «Conectar tareas con resultado esperado y evidencia posterior». El origen ya se pinta en parte (el chip de fuente con el link al minuto de la reunión), pero el RESULTADO ESPERADO no existe en ningún lado: hoy una tarea se cierra y nadie sabe si movió algo. Es la pieza que le falta al loop de accountability.
Dos: «Revisar Graphics: eliminar métricas innecesarias y definir qué debe medirse realmente». Hoy la tab tiene gráficos que nadie mira; hay que decidir qué tres o cuatro números dicen si el plan está sano (por ejemplo: cuánto tarda una tarea de alta en cerrarse, cuántas se cierran sin evidencia, cuántas se vencen).
Va con la regla que ya tenemos: claridad antes que creatividad, y el concepto validado en palabras antes de dibujar nada.`,
  },
  {
    titulo: 'Ads Manager: tabla operativa de verdad + administrador de columnas',
    proyecto: 'Ads Manager',
    detalle: `La dirección del documento es «Mantener la familiaridad conceptual con Meta, no su saturación visual». Lo que falta, concreto: «Mejorar tabla, jerarquía, densidad, columnas y administración de columnas» y «Desarrollar detalles coherentes de campaña, ad set y anuncio».
El componente que el documento nombra por su nombre es ColumnManager —«Mostrar, ocultar y ordenar columnas, especialmente en Ads Manager»— junto con DataTable (columnas, selección, orden, filtros, acciones, densidad, overflow, sticky y estados completos), FilterBar (filtros activos, conteo, limpieza y persistencia) y Pagination/Virtual list, «sin asumir que todos los datos caben en una página».
Además pide dos cosas de negocio: conectar cada elemento con su oferta, funnel, creatividad, objetivo y análisis de MaKo; y «Diferenciar con claridad estado de entrega, resultado y recomendación» — hoy las tres cosas conviven en la misma columna y el usuario no sabe si algo está pausado, si anduvo mal o si MaKo sugiere cambiarlo.
Está lista cuando un media buyer que viene de Meta puede trabajar sin buscar dónde está cada cosa, y cuando elegir qué columnas ver es un gesto de dos clics.`,
  },
  {
    titulo: 'Closing Analyst: la conclusión antes que la evidencia',
    proyecto: 'Closing Analyst',
    detalle: `Prioridad de diseño MUY ALTA en el documento, con el diagnóstico: «Funcionalidad valiosa. Exceso de datos y texto; la jerarquía impide aprovechar conclusiones».
La regla que lo ordena es el principio 13.2: «Conclusión antes que evidencia. En análisis complejos se muestra primero el significado y la acción; los datos completos quedan disponibles para profundizar».
Lo que pide, punto por punto: priorizar la conclusión y la acción antes de los bloques de datos; agrupar factores de cierre, embudo, score y señales con una narrativa clara; permitir ver evidencia y llamadas relacionadas sin saturar la primera lectura; y conectar los insights con el CRM, con las tareas del closer y con el seguimiento.
La plantilla de pantalla que le corresponde en el sistema global es «Analyst»: conclusión, señales, evidencia, impacto, recomendación y profundidad — en ese orden.
Está lista cuando alguien abre una llamada analizada y en la primera pantalla, sin scrollear, sabe qué pasó y qué hacer.`,
  },
  {
    titulo: 'Ads Analyst: ordenar por impacto y separar señal, hipótesis y evidencia',
    proyecto: 'Ads Analyst',
    detalle: `El otro módulo con prioridad MUY ALTA: «Mismo problema de densidad, lectura y acción que Closing Analyst».
Lo que pide: ordenar patrones, riesgos, oportunidades y conclusiones POR IMPACTO (hoy salen en el orden en que los generó el modelo); diferenciar con claridad qué es una señal, qué es una hipótesis, qué es evidencia y qué es una recomendación; conectar el análisis con guiones, anuncios, campañas y tareas de producción; y «Evitar mosaicos de tarjetas de colores sin jerarquía», que es exactamente lo que se ve hoy.
Incluye la parte de Guiones, que el documento trata al lado: «Clarificar score, patrón, estado, rendimiento y relación con anuncios» y «Unificar detalle de guion con el lenguaje de Analyst» — hoy el guion y el análisis del anuncio hablan dos idiomas distintos sobre la misma pieza.
Comparte plantilla con Closing Analyst, así que conviene hacerlas cerca en el tiempo: la plantilla «Analyst» se diseña una vez y se aplica dos.`,
  },
  {
    titulo: 'Secuencias fuera de WhatsApp, adentro de Chat Agent',
    proyecto: 'Chat Agent',
    detalle: `El documento es explícito en los dos lados. En WhatsApp: «Eliminar Secuencias del módulo y trasladarlas a Chat Agent». En Chat Agent: «Requiere rediseño general y onboarding propio. Secuencias de WhatsApp deben vivir aquí».
El motivo de fondo es de identidad del módulo: «Chat Agent no es un bot de plantillas. El objetivo declarado es duplicar al experto para cualificar, agendar, reactivar, dar seguimiento y vender, con un protocolo de handoff que reduzca errores». Con las secuencias viviendo en la bandeja, el agente parece un enviador de mensajes.
Lo que queda de cada lado: WhatsApp se queda con la bandeja, la conversación, el contexto del lead y el estado de la ventana de 24 h, diferenciando canal oficial y no oficial «sin convertir el color del canal en estado semántico», y mostrando ownership, agente activo, handoff y siguiente acción. Chat Agent se queda con las secuencias, la cualificación, la agenda, la reactivación, el seguimiento, la venta y el handoff — más un onboarding propio con alcance, fuentes de conocimiento, tono, reglas y límites.
Y una cosa que hoy no se ve en ningún lado: «Mostrar cuándo opera, cuándo espera y cuándo entrega la conversación a una persona».`,
  },
  {
    titulo: 'Email a la par de WhatsApp: bandeja, envío y contexto compartido',
    proyecto: 'Email',
    detalle: `Es el módulo que el documento marca como «Muy incompleto», con la dirección: «Debe operar de forma comparable a WhatsApp, permitiendo enviar y gestionar emails desde MaKo». La prioridad que le asigna es «Posterior» — no es de las primeras, pero tiene que quedar anotado antes de que se resuelva mal.
Los tres requisitos: una lógica de inbox y envío comparable a WhatsApp pero adaptada al canal; compartir el contexto de lead, agente y seguimiento ENTRE canales (que una conversación por mail y una por WhatsApp con la misma persona no sean dos historias separadas); y «Evitar duplicar componentes y conceptos con estilos diferentes», que es lo que pasa hoy: la bandeja de WhatsApp y la de mail están escritas dos veces.
La plantilla del sistema global que les toca a las dos es la misma —«Chat / Inbox: lista, conversación, contexto, estado, handoff, composer y acciones»— así que la forma de no duplicar es hacer esa plantilla una vez.`,
  },
  {
    titulo: 'Onboarding: que cada paso diga qué construye y qué desbloquea',
    proyecto: 'Onboarding',
    detalle: `El diagnóstico del documento: «El onboarding informa pasos, pero no siempre propósito. Cada paso debe explicar qué construye, qué necesita, cuánto falta y qué desbloquea». Y el riesgo que hay que evitar: «Evitar que el usuario perciba una larga serie de formularios desconectados».
Los pasos que ya existen y a los que hay que ponerles ese encabezado: Matriz, Diagnóstico, El Archivero, Oferta, Lead Magnet, Persona, Personalidad, Avatares, Razones, Ángulos y Funnel.
Los cuatro requisitos: cada paso explica qué se construye, para qué sirve, qué datos necesita y qué habilita después; se muestra progreso global y local con tiempo estimado y validación; MaKo completa o sugiere cuando ya tiene contexto suficiente (que es la regla nuestra de minimizar la configuración manual); y el video tutorial entra «como apoyo, no como única explicación».
Va enganchado con la regla que ya tenemos de que toda tab tenga su propio onboarding (Conectar → Contexto → Ensayo): esto es la misma idea aplicada al wizard grande.`,
  },
  {
    titulo: 'Perfil, Integraciones y Configuraciones: separar lo personal, lo del negocio y lo del sistema',
    proyecto: 'Configuraciones y equipo',
    detalle: `Los tres módulos comparten diagnóstico en el documento: «Simplificar la navegación secundaria y reducir la sensación de fragmentación». Integraciones es «la más construida del grupo administrativo» y hay que conservarla como base, alineándola al sistema global; Perfil y Configuraciones «necesitan simplificación».
El corte que propone es el que hoy no existe: separar las PREFERENCIAS PERSONALES (perfil, notificaciones, cómo quiero ver la app), la CONFIGURACIÓN DEL NEGOCIO (funnel, método, equipo, onboarding) y la ADMINISTRACIÓN DEL SISTEMA (credenciales, modelos, límites). Hoy están mezcladas y por eso «Configuraciones» agrupa cosas que no tienen nada que ver entre sí.
Y una unificación concreta: «Unificar estados de conexión, credenciales, permisos, costo y salud» — hoy cada integración cuenta su estado a su manera.
Es de prioridad media en el documento, pero es barata comparada con el resto y saca ruido de encima antes del rediseño de las tabs grandes.`,
  },
  // ── Deuda técnica que el rediseño destapa ─────────────────────────────────
  {
    titulo: 'Partir los archivos de interfaz gigantes antes del rediseño',
    proyecto: 'Infraestructura y versionado',
    detalle: `El documento midió los archivos de UI más grandes del repo y la lista asusta: app/plan/PlanBoard.tsx 209 KB, app/plan/board/BoardShell.tsx 148 KB, app/ads-analyst/ScriptsBrowser.tsx 117 KB, app/ads-manager/CampanasBrowser.tsx 98 KB, app/whatsapp/WhatsAppApp.tsx 95 KB, app/ads-manager/NuevaCampanaModal.tsx 92 KB, app/integraciones/IntegracionesBoard.tsx 84 KB, app/chat-agent/OnboardingChatAgent.tsx 84 KB, app/closing/ClosingBrowser.tsx 73 KB, app/email/EmailApp.tsx 66 KB y app/crm/CrmBoard.tsx 65 KB.
No es una queja de estilo: son justamente las pantallas que el rediseño va a tocar, y con 6.965 estilos inline repartidos ahí adentro, aplicar el sistema global significa editar diez archivos de cien kilobytes cada uno. Partirlos primero hace que el rediseño sea un cambio de imports y no una cirugía.
El criterio: sacar a componentes propios las piezas que ya se repiten (filas de tabla, headers de página, modales) y dejar cada archivo por debajo de un tamaño en el que se pueda leer entero. Empezar por los dos del Plan, que son los más grandes y los que más se tocan.
Cuidado con el costo: cada push cuesta unos 9 centavos de build, así que esto se hace en tandas grandes, no archivo por archivo.`,
  },
  {
    titulo: 'Elegir los 3 a 5 indicadores del rediseño y medir la línea base ANTES de empezar',
    proyecto: 'Diseño de la app',
    detalle: `El documento cierra con una advertencia que conviene no saltear: «El dueño todavía no seleccionó los indicadores definitivos» y «Elegir entre tres y cinco indicadores, definir una línea base y establecer cómo se medirán antes de considerar cerrado el rediseño».
Los ocho candidatos que propone: menor tiempo para comprender la salud del negocio y la prioridad del día · menos clics y menos retrocesos para encontrar un lead o ejecutar la siguiente acción · mayor velocidad para responder, reasignar o hacer handoff en chats · menos errores o dudas al gestionar campañas y automatizaciones · mayor adopción de Experiments/Second Brain y de las acciones recomendadas · menor tiempo de capacitación para entender los conceptos propios de MaKo · mejor percepción de claridad, confianza y consistencia · mayor uso mobile en tareas diarias sin reducir el desktop para análisis profundo.
Lo importante es el ANTES: la línea base hay que medirla con la app actual, porque una vez rediseñada ya no se puede. Si son tres números y se miden a mano una sola vez, alcanza.
Está lista cuando hay tres a cinco indicadores elegidos, con su valor de hoy escrito y con cómo se van a volver a medir.`,
  },
];

// Lo que esta carga deja obsoleto. Son duplicados exactos que entraron el 5/8 en el
// lote de WhatsApp: se conserva la tarjeta curada y se van las copias.
const ELIMINAR = [
  { id: 'tms1t3k1p6u8l8', titulo: 'Desarrollar Modo Simple y Modo Avanzado de interfaz', motivo: 'Es la misma que #159 «Modo Avanzado (y que SIMPLE sea el default)», que ya está en el tablero con el contexto completo. Entró duplicada en el lote del 5/8.' },
  { id: 'tms9yy0ks5pu7m', titulo: 'Desarrollar el Modo Simple en MaKo', motivo: 'Tercera copia de #159. El tablero tiene HOY cuatro tarjetas del mismo trabajo (#159, #203, #283, #304) con cuatro scores distintos.' },
  { id: 'tms95nvcg2d8qa', titulo: 'Implementar Modo Simple para restringir tabs en la app', motivo: 'Cuarta copia de #159: restringir tabs es parte del Modo Simple, no un trabajo aparte.' },
  { id: 'tms9yy0ks22ouf', titulo: 'Agregar videos tutoriales del fundador en cada paso del onboarding', motivo: 'Es la misma que #206 «Grabar e integrar mini tutoriales en video para Onboarding».' },
];

const PREGUNTAS = [
  {
    pregunta: '¿Quién va a ejecutar el rediseño global (Fase 1)?',
    tipo: 'opcion',
    opciones: ['El diseñador que escribió el documento entrega pantallas', 'Lo hacemos acá, directo en el código', 'Todavía no está decidido'],
  },
  {
    pregunta: '¿Hay una fecha comprometida para mostrar el rediseño?',
    tipo: 'opcion',
    opciones: ['Sí, hay una demo o reunión con fecha', 'Tiene que estar antes de abrir la beta a clientes nuevos', 'No hay fecha, es trabajo de fondo'],
  },
  {
    pregunta: 'El documento dice que la prioridad para la beta es pulir los módulos que ya existen y recién después incorporar Content Machine. ¿Sigue siendo así?',
    tipo: 'opcion',
    opciones: ['Sí, primero pulir lo que hay', 'No, Content Machine primero porque es el diferencial', 'Content Machine en paralelo, con menos gente'],
  },
  {
    pregunta: 'Mobile: ¿ya está decidida la plataforma?',
    tipo: 'opcion',
    opciones: ['La misma web, responsive', 'PWA', 'React Native o Expo', 'Todavía no está decidido'],
  },
  {
    pregunta: '¿Cuántos negocios están usando MaKo hoy en producción, además del tuyo?',
    tipo: 'opcion',
    opciones: ['Solo Mauricio', 'Entre 2 y 3', 'Entre 4 y 10', 'Más de 10'],
  },
  {
    pregunta: 'La navegación nueva obliga a tocar todas las tabs. ¿Se puede romper la navegación actual unos días mientras se arma?',
    tipo: 'comparacion',
    opciones: ['Sí, todavía se puede romper y arreglar sobre la marcha', 'No, tiene que convivir con la actual hasta estar terminada'],
  },
  {
    pregunta: '¿Algo de esto ya está comprometido con alguien de afuera (un cliente, una demo, un video)?',
    tipo: 'multi',
    opciones: ['El rediseño visual', 'La versión mobile', 'Content Machine', 'Nada de esto está comprometido'],
  },
  {
    pregunta: 'De tu semana de trabajo, ¿cuánto se puede ir al rediseño frente a features nuevas? (1 = nada, es todo features; 5 = es lo único que se hace)',
    tipo: 'escala',
    opciones: [],
  },
];

const RESUMEN = 'Del documento de rediseño (v1, 4/8): sistema global, navegación por intención y los requisitos tab por tab. No cargué el CRM desacoplado del funnel (ya está en #15, #33 y #40) ni la escala tipográfica (#284, #213).';

async function main() {
  console.log(APLICAR ? '=== CREANDO LA PROPUESTA ===\n' : '=== SIMULACIÓN (sin --apply no escribe) ===\n');
  // Guarda: ningún proyecto fuera del catálogo cerrado.
  const fuera = [...new Set(TAREAS.map((t) => t.proyecto))].filter((p) => !delCatalogo(p));
  if (fuera.length) throw new Error(`proyectos FUERA del catálogo: ${fuera.join(', ')}`);

  console.log(`${TAREAS.length} tareas · ${PREGUNTAS.length} preguntas · ${ELIMINAR.length} a eliminar`);
  const porProy = new Map<string, number>();
  for (const t of TAREAS) porProy.set(t.proyecto, (porProy.get(t.proyecto) ?? 0) + 1);
  for (const [p, n] of [...porProy].sort((a, b) => b[1] - a[1])) console.log(`  ${delCatalogo(p)?.emoji ?? '📁'} ${p.padEnd(30)} ${n}`);
  const corto = TAREAS.filter((t) => t.detalle.length < 500);
  if (corto.length) console.log(`\n⚠ ${corto.length} con detalle corto: ${corto.map((t) => t.titulo.slice(0, 30)).join(' · ')}`);
  console.log(`\ndetalle: ${Math.min(...TAREAS.map((t) => t.detalle.length))}–${Math.max(...TAREAS.map((t) => t.detalle.length))} caracteres`);

  if (!APLICAR) { console.log('\n(simulación — nada se escribió)'); return; }

  const svc = getSupabaseServer();
  const { data: wss } = await svc.from('workspaces').select('id, nombre, capa').eq('capa', 'superadmin');
  const ws = (wss ?? [])[0] as { id: number; nombre: string } | undefined;
  if (!ws) throw new Error('no encontré el workspace con capa=superadmin');

  const id = await runWithWorkspace(ws.id, () => crearPropuesta({
    tareas: TAREAS.map((t) => ({ titulo: t.titulo, proyecto: t.proyecto, detalle: t.detalle })),
    // `preguntas: PREGUNTAS` ya no viaja: el alta dejó de preguntar (05/10/2026).
    eliminar: ELIMINAR,
    resumen: RESUMEN,
    origen: 'claude-code',
    fuenteTitulo: 'MaKo · Contexto integral y especificación de rediseño (v1, 4/8/2026)',
    ws: ws.id,
  }));
  console.log(`\n✓ propuesta ${id}`);
  console.log(`\n${APP_BASE_URL}/plan/revisar/${id}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
