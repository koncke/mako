// =============================================================================
// graficos-fuentes-extra — los conjuntos de datos de las tabs de Analysts, como plantillas del Dashboard
// =============================================================================
// Martín, 11/10/2026: «Implementa como TEMPLATE... todas las tabs de la sidebar en la sección de
// "analysts". Excepto las partes donde se ejecuta tareas». Cada conjunto declarado acá necesita su
// lector en lib/graficos-datos-extra.ts (`LECTORES_EXTRA`): el test de tests/graficos.test.ts cruza
// las dos listas.
// Puro y sin `server-only`.
//
// Lo que no entraba en el agregador (el cuadrante de retención, los patrones, el mapa de calor, el
// embudo y los factores del cierre, la matriz impacto × esfuerzo…) iba como BLOQUE hasta v5; desde v5
// (12/10/2026) son conjuntos y tipos del catálogo (lib/graficos-migrar-v5.ts convierte los bloques
// guardados) y el código de los bloques se borró el 13/10/2026.
//
// ⚠️ LAS RAZONES DE LA RETENCIÓN Y DEL SCROLL SE DIVIDEN POR LOS MEDIDOS, NUNCA POR LOS QUE
// ENTRARON (lib/vsl-retencion.ts y lib/landing-pulso.ts). Con el Pixel viejo «medidos» es chico y
// «el 0,2% llega a la oferta» sería mentira: lo que pasa es que no se mide. Con 0 medidos la razón
// da vacío, nunca 0%.
//
// ⚠️ IMPACTO Y ESFUERZO SON ATRIBUTOS, NO SUMAS (`sinTotal`): se leen por proyecto. Agrupados por
// otra cosa (estado, cuadrante) el agregador los sumaría y el número no significaría nada. Y un proyecto
// SIN evaluar no trae el atributo: el agregador lo devuelve null (no 0) y la dispersión lo saltea.
//
// ── LO QUE SUMÓ EL v5 (12/10/2026, contrato docs/relevo/dashboard-v5.md, tabla «Los DATOS») ──
// Los conjuntos NUEVOS se declaran acá (P2) y se leen en lib/graficos-datos-extra.ts: `revenue`, `cobranza`,
// `suscripciones`, `vsl_leads`, `cartera`, `conversaciones` y `ubicacion`. Y los de las tabs de Analysts
// que ya vivían acá suman lo suyo: `guiones` (retención al llamado), `retencion_vsl` (la curva por corte,
// que reemplaza al bloque `curva_vsl`), `ejecucion` (las tareas que huelen mal, la pirámide) y `proyectos`
// (colores del cuadrante). Lo que necesita el CATÁLOGO —ENTIDADES, DETALLE_REVENUE, los campos
// COMPARTIDOS, DIMENSIONES_PUBLICAS— es del modelo (P1, lib/graficos-catalogo.ts), no de acá.

import { TIEMPO, cat, dist, m, r, type Dimension, type Fuente, type Metrica } from './graficos-constructores';
import { CORTES_VSL, TRAMOS_CONTACTO, TRAMOS_VISTO } from './graficos-datos-puro';

const atributo = (id: string, nombre: string): Metrica => ({ ...m(id, nombre), sinTotal: true });
/** Lo que es mejor que BAJE (un costo, un atraso, la deuda): la barra y el color lo respetan. */
const menos = (x: Metrica): Metrica => ({ ...x, mejor: 'menos' });
/** Una razón que con menos de `minimo` casos en el denominador se muestra «X de Y» y no un porcentaje. */
const conMinimo = (x: Metrica, minimo: number): Metrica => (x.razon ? { ...x, razon: { ...x.razon, minimo } } : x);
/** El percentil `p` de los valores POR FILA de la métrica `de` (el agregador guarda la lista). */
const percentil = (id: string, nombre: string, de: string, p: number): Metrica => ({ id, nombre, formato: 'numero', percentil: { de, p } });
/** Una escala con orden FIJO (y sus vacíos en cero), con el color de cada valor si lo tiene. */
const escala = (d: Dimension, valores: readonly string[], colores?: Readonly<Record<string, string>>): Dimension =>
  ({ ...d, valores, ...(colores ? { colores } : {}) });

export const FUENTES_EXTRA: readonly Fuente[] = [
  // ── Ads Analyst ───────────────────────────────────────────────────────────────────────
  {
    // La pauta de Meta de cada anuncio ANALIZADO, día por día, con lo que dijo el análisis del
    // guion (ángulo, gancho, avatar) y el veredicto de la tab calculado sobre la ventana elegida.
    id: 'guiones', nombre: 'Guiones de anuncios', area: 'Marketing',
    descripcion: 'Cada anuncio analizado con su pauta: hook rate, retención, agendas y veredicto.',
    fechas: [{ id: 'fecha', nombre: 'Fecha' }],
    dimensiones: [
      ...TIEMPO, cat('guion', 'Guion'), cat('angulo', 'Ángulo'), cat('gancho', 'Tipo de gancho'), cat('formato', 'Formato'),
      cat('avatar', 'Avatar'), cat('tipo', 'Video o imagen'), cat('campana', 'Campaña'), cat('conjunto', 'Conjunto'),
      cat('veredicto', 'Veredicto'), cat('confianza', 'Confianza'), cat('resultado', 'Resultado'),
    ],
    metricas: [
      m('gasto', 'Gasto', 'usd'), m('impresiones', 'Impresiones'), m('plays_3s', 'Reproducciones de 3 s'), m('thruplays', 'ThruPlays'),
      m('p25', 'Vieron el 25%'), m('p50', 'Vieron el 50%'), m('p75', 'Vieron el 75%'), m('p100', 'Vieron todo'),
      m('clics', 'Clics'), m('leads', 'Leads'), m('agendas', 'Agendas'), m('cierres', 'Cierres'), dist('guiones', 'Guiones'),
      // La gente que llegó al llamado a la acción (el último bloque del guion), día por día, para que la
      // retención al CTA del cuadrante de Ads Analyst se pueda sumar (`llegaronAlCta`, lib/graficos-datos-puro.ts).
      m('llegaron_cta', 'Llegaron al llamado'),
      r('hook_rate', 'Hook rate', 'pct', 'plays_3s', 'impresiones', 100),
      r('retencion_final', 'Retención al final', 'pct', 'p100', 'plays_3s', 100),
      r('ret_cta', 'Retención al llamado', 'pct', 'llegaron_cta', 'plays_3s', 100),
      r('thruplay_rate', 'ThruPlay rate', 'pct', 'thruplays', 'plays_3s', 100),
      r('ctr', 'CTR', 'pct', 'clics', 'impresiones', 100),
      menos(r('cpa', 'Costo por agenda', 'usd', 'gasto', 'agendas')),
      r('agendas_1k', 'Agendas por US$1.000', 'numero', 'agendas', 'gasto', 1000),
      menos(r('costo_cierre', 'Costo por cierre', 'usd', 'gasto', 'cierres')),
    ],
  },
  // ── Landing Analyst ───────────────────────────────────────────────────────────────────
  {
    id: 'clics', nombre: 'Clics en la landing', area: 'Marketing',
    descripcion: 'Qué botón tocan en tus páginas: el destino, el texto y cuánta gente distinta.',
    fechas: [{ id: 'fecha', nombre: 'Fecha' }],
    dimensiones: [...TIEMPO, cat('pagina', 'Página'), cat('destino', 'Destino'), cat('texto', 'Texto del botón'), cat('dispositivo', 'Dispositivo')],
    metricas: [m('clics', 'Clics'), dist('personas', 'Personas')],
  },
  {
    // Una fila por persona y página: hasta dónde bajó (el máximo), contado una sola vez.
    id: 'scroll', nombre: 'Hasta dónde bajan', area: 'Marketing',
    descripcion: 'Cuánta gente llega al 25, 50, 75 y 100% de cada página.',
    fechas: [{ id: 'fecha', nombre: 'Fecha' }],
    dimensiones: [...TIEMPO, cat('pagina', 'Página')],
    metricas: [
      m('medidos', 'Personas medidas'), m('llegaron_25', 'Llegaron al 25%'), m('llegaron_50', 'Llegaron al 50%'),
      m('llegaron_75', 'Llegaron al 75%'), m('llegaron_100', 'Llegaron al final'),
      r('pct_25', 'Llegan al 25%', 'pct', 'llegaron_25', 'medidos', 100), r('pct_50', 'Llegan a la mitad', 'pct', 'llegaron_50', 'medidos', 100),
      r('pct_75', 'Llegan al 75%', 'pct', 'llegaron_75', 'medidos', 100), r('pct_100', 'Llegan al final', 'pct', 'llegaron_100', 'medidos', 100),
    ],
  },
  {
    // Los toques con su punto (Pixel v20+): botones y lo que no es un botón. Lo mismo que el mapa de calor.
    id: 'toques', nombre: 'Toques en la página', area: 'Marketing',
    descripcion: 'Lo más tocado de cada página: botones, imágenes y textos, en celular o computadora.',
    fechas: [{ id: 'fecha', nombre: 'Fecha' }],
    dimensiones: [...TIEMPO, cat('pagina', 'Página'), cat('lugar', 'Qué tocaron'), cat('tipo', 'Botón o no'), cat('dispositivo', 'Dispositivo')],
    metricas: [m('toques', 'Toques'), dist('personas', 'Personas')],
  },
  {
    // Una fila por persona y video: su avance máximo (con la duración de Panda cuando el
    // evento sólo trae segundos). Sólo eventos DEL VIDEO: un clic o un scroll no es mirarlo.
    id: 'retencion_vsl', nombre: 'Cuánto ven el video', area: 'Marketing',
    descripcion: 'De los que le dieron play a tu video, cuántos llegan al 25, 50, 75% y al final.',
    fechas: [{ id: 'fecha', nombre: 'Fecha' }],
    // `corte` es la CURVA (lo que era el bloque `curva_vsl`): 5, 10 … 100, en su orden y sin recorte. Con
    // esa dimensión el lector devuelve una fila por persona y corte (`siguen` = los que llegaron a ese
    // corte ÷ los medidos); con cualquier otra, una fila por persona.
    dimensiones: [...TIEMPO, cat('video', 'Video'), cat('pagina', 'Página'), escala({ ...cat('corte', 'Corte del video (%)'), ordenEtiqueta: true }, CORTES_VSL)],
    metricas: [
      m('arrancaron', 'Le dieron play'), m('medidos', 'Con avance medido'), m('pasaron_25', 'Pasaron el 25%'),
      m('pasaron_50', 'Pasaron la mitad'), m('pasaron_75', 'Pasaron el 75%'), m('llegaron_final', 'Llegaron al final'),
      r('tasa_25', 'Pasan el 25%', 'pct', 'pasaron_25', 'medidos', 100), r('tasa_50', 'Pasan la mitad', 'pct', 'pasaron_50', 'medidos', 100),
      r('tasa_75', 'Pasan el 75%', 'pct', 'pasaron_75', 'medidos', 100), r('tasa_final', 'Llegan al final', 'pct', 'llegaron_final', 'medidos', 100),
      // Las bases de la curva: sólo existen en las filas por corte, así que fuera de esa dimensión `siguen`
      // da vacío (nunca un 0% inventado).
      m('pasaron_corte', 'Llegaron a este corte'), m('medidos_corte', 'Medidos en la curva'),
      r('siguen', 'Siguen viendo', 'pct', 'pasaron_corte', 'medidos_corte', 100),
    ],
  },
  {
    // El diagnóstico que MaKo guardó de cada página (landing_analyses). Es una FOTO: se
    // recalcula al volver a analizar, no sola. Analizar es una tarea y no vive acá.
    id: 'landing_analisis', nombre: 'Diagnósticos de landing', area: 'Marketing',
    descripcion: 'El puntaje y los hallazgos que MaKo le encontró a cada página.',
    fechas: [{ id: 'actual', nombre: 'Todas (hoy)', sinRango: true }, { id: 'analizada', nombre: 'Analizada' }],
    dimensiones: [...TIEMPO, cat('pagina', 'Página'), cat('veredicto', 'Veredicto'), cat('tono', 'Cómo salió'), cat('estado', 'Estado')],
    metricas: [
      m('paginas', 'Páginas'), m('puntos', 'Puntos'), m('con_puntaje', 'Con puntaje'),
      r('puntaje', 'Puntaje promedio', 'numero', 'puntos', 'con_puntaje'),
      m('hallazgos', 'Hallazgos'), m('hallazgos_altos', 'Hallazgos graves'),
    ],
  },
  // ── Closing Analyst ───────────────────────────────────────────────────────────────────
  {
    // Las MISMAS llamadas que mira la tab: de venta y ya analizadas (el conjunto `llamadas`
    // cuenta todas, internas y de prueba incluidas). El puntaje, como la tab: sólo las que
    // tienen transcript y puntaje (no se promedian ceros falsos). `llamada` es cada una, con
    // su id: lo que lista el detalle de un número (y abre su ficha). Trae nombres de personas.
    id: 'llamadas_venta', nombre: 'Llamadas de venta', area: 'CRM y ventas',
    descripcion: 'Las llamadas de venta analizadas: puntaje, R1 y R2, ganadas y perdidas.',
    fechas: [{ id: 'fecha', nombre: 'Llamada' }],
    dimensiones: [...TIEMPO, cat('closer', 'Closer'), cat('reunion', 'Reunión'), cat('tono', 'Resultado'), cat('llamada', 'Llamada')],
    metricas: [
      m('llamadas', 'Llamadas'), m('minutos', 'Minutos'), r('duracion', 'Duración promedio (min)', 'numero', 'minutos', 'llamadas'),
      m('puntos', 'Puntos'), m('con_puntaje', 'Con puntaje'), r('puntaje', 'Puntaje promedio', 'numero', 'puntos', 'con_puntaje'),
      m('ganadas', 'Ganadas'), m('perdidas', 'Perdidas'), m('r1', 'R1 (diagnóstico)'), m('r2', 'R2 (cierre)'), m('ganadas_r2', 'R2 ganadas'),
      r('tasa_cierre', 'Tasa de cierre', 'pct', 'ganadas_r2', 'r2', 100),
    ],
  },
  {
    // Una fila por llamada y dimensión del análisis (Situación, Problema… CTA).
    id: 'llamadas_dimensiones', nombre: 'Llamadas por dimensión', area: 'CRM y ventas',
    descripcion: 'El puntaje de cada dimensión de venta (SPIN y ejecución), por closer y resultado.',
    fechas: [{ id: 'fecha', nombre: 'Llamada' }],
    // `llamada` (v5): cada una, con su recording_id en `r.llamada`: el detalle de una barra lista las llamadas
    // de esa dimensión y cada una abre su ficha. Trae nombres de personas (fuera de DIMENSIONES_PUBLICAS).
    dimensiones: [
      ...TIEMPO, cat('dimension', 'Dimensión'), cat('grupo', 'Grupo'),
      escala(cat('tono', 'Resultado'), ['Ganada', 'En proceso', 'Perdida'], { Ganada: 'var(--good)', 'En proceso': 'var(--warn)', Perdida: 'var(--bad)' }),
      cat('closer', 'Closer'), cat('reunion', 'Reunión'), cat('llamada', 'Llamada'),
    ],
    metricas: [m('puntos', 'Puntos'), m('con_puntaje', 'Con puntaje'), r('puntaje', 'Puntaje promedio', 'numero', 'puntos', 'con_puntaje')],
  },
  // ── Productivity Analyst ──────────────────────────────────────────────────────────────
  {
    // Una fila por proyecto del tablero que le toca a quien mira (el del dueño o el del
    // cliente, lib/tablero-actual.ts). Las tareas se cuentan como la tab: sin las que se
    // repiten, y en TODOS sus proyectos.
    id: 'proyectos', nombre: 'Proyectos del Plan', area: 'Plan',
    descripcion: 'Cada proyecto del tablero: su avance, si está completo, impacto y esfuerzo.',
    fechas: [{ id: 'actual', nombre: 'Todos (hoy)', sinRango: true }],
    // Los colores del cuadrante son los de la matriz de la tab (los de `COLOR_CUADRANTE` del bloque de
    // Productividad, que se borró con los bloques el 13/10/2026).
    dimensiones: [
      cat('proyecto', 'Proyecto'), cat('estado', 'Estado'), cat('con_deadline', 'Con deadline'),
      escala(cat('cuadrante', 'Cuadrante'), ['Quick win', 'Apuesta grande', 'De relleno', 'Trampa', 'Sin evaluar'],
        { 'Quick win': 'var(--good)', 'Apuesta grande': 'var(--primary)', 'De relleno': 'var(--faint)', Trampa: 'var(--bad)', 'Sin evaluar': 'var(--dim)' }),
    ],
    metricas: [
      m('proyectos', 'Proyectos'), m('completos', 'Completados'), m('tareas', 'Tareas'), m('hechas', 'Hechas'),
      m('pct_suma', 'Puntos de avance'), r('avance_proyectos', 'Avance promedio', 'pct', 'pct_suma', 'proyectos'),
      atributo('impacto', 'Impacto'), atributo('esfuerzo', 'Esfuerzo'),
    ],
  },
  {
    // Las tareas que EMPIEZAN Y TERMINAN (sin las recurrentes), con lo que la tab deduce del
    // historial: el ciclo, si se cerró a tiempo y si está estancada.
    id: 'ejecucion', nombre: 'Ejecución del Plan', area: 'Plan',
    descripcion: 'Las tareas que empiezan y terminan: en curso, a tiempo, ciclo y estancadas.',
    fechas: [{ id: 'actual', nombre: 'Todas (hoy)', sinRango: true }],
    // `tarea` es el título (con su id en `r.tarea`): lo que lista «Lo que huele mal». ⚠️ Puede nombrar
    // personas: queda FUERA de DIMENSIONES_PUBLICAS (lib/graficos-analisis.ts). La prioridad es la escala del
    // tablero, en su orden y con sus colores (la pirámide de la tab, `COLOR_PRIO`).
    dimensiones: [
      escala(cat('prioridad', 'Prioridad'), ['Alta', 'Media', 'Baja', 'A futuro'],
        { Alta: 'var(--bad)', Media: 'var(--warn)', Baja: 'var(--good)', 'A futuro': 'var(--faint)' }),
      cat('estado', 'Estado'), cat('con_deadline', 'Con deadline'),
      cat('tarea', 'Tarea'), escala(cat('estancada', 'Estancada'), ['Sí', 'No']), escala(cat('deadline_corrido', 'Deadline corrido'), ['Sí', 'No']),
    ],
    metricas: [
      m('tareas', 'Tareas'), m('activas', 'Activas'), m('hechas', 'Hechas'), m('en_curso', 'En curso'),
      m('sin_deadline', 'Activas sin deadline'), m('alta_sin_deadline', 'Alta sin deadline'), m('estancadas', 'Estancadas'),
      m('progreso', 'Puntos de avance'), r('avance', 'Avance promedio', 'pct', 'progreso', 'tareas'),
      m('cerradas_con_deadline', 'Cerradas con deadline'), m('a_tiempo', 'A tiempo'), m('tarde', 'Tarde'), m('dias_tarde', 'Días de atraso'),
      r('cumplimiento', 'Cumplimiento', 'pct', 'a_tiempo', 'cerradas_con_deadline', 100), menos(r('atraso_prom', 'Atraso promedio (días)', 'numero', 'dias_tarde', 'tarde')),
      m('dias_ciclo', 'Días de ciclo'), m('con_ciclo', 'Con ciclo'), r('ciclo', 'Cycle time (días)', 'numero', 'dias_ciclo', 'con_ciclo'),
      // «Lo que huele mal» y la pirámide: los días sin que nadie la toque (de las activas), cuántas veces se
      // corrió su deadline, y cuántas activas son Alta (el aviso de la tab: más del 18% está inflado).
      atributo('dias_quieta', 'Días sin tocar'), m('movidas_deadline', 'Veces que se corrió el deadline'),
      m('activas_alta', 'Activas en Alta'), menos(r('pct_alta', 'Activas en Alta (%)', 'pct', 'activas_alta', 'activas', 100)),
    ],
  },
  // ── CRM y ventas: lo que eran los bloques de Comercial (contrato v5) ──────────────────────
  {
    // Lo vendido (por fecha de cierre), lo cobrado (por fecha de pago) y lo PENDIENTE (las cuotas sin pagar,
    // por su vencimiento) en una sola lectura: la barra de proporción y las KPI del viejo bloque Revenue salen
    // de acá. La fecha mira hacia ADELANTE (`futuro`): con «Este mes completo» lo pendiente llega a fin de mes.
    id: 'revenue', nombre: 'Revenue', area: 'CRM y ventas',
    descripcion: 'Lo vendido, lo cobrado y lo que falta cobrar, cada uno por su fecha.',
    fechas: [{ id: 'fecha', nombre: 'Fecha', futuro: true }],
    dimensiones: [...TIEMPO],
    metricas: [m('vendido', 'Vendido', 'usd'), m('cobrado', 'Cobrado', 'usd'), m('pendiente', 'Pendiente', 'usd'), m('cierres', 'Cierres'), m('cuotas_cobradas', 'Cuotas cobradas'), m('cuotas_pendientes', 'Cuotas pendientes')],
  },
  {
    // Una fila por CLIENTE con algo pendiente, con las MISMAS funciones que «A quién cobrar» de la API de MaKo
    // (getOutstandingDetalle + armarCobranza): la pantalla y WhatsApp no pueden contar distinto. `cliente` es
    // una PERSONA (fuera de DIMENSIONES_PUBLICAS). Con «Todo» es el pipeline entero (cuotas sin fecha incluidas).
    id: 'cobranza', nombre: 'Clientes por cobrar', area: 'CRM y ventas',
    descripcion: 'Cada cliente con algo pendiente: su próxima cuota, cuánto debe y cuándo vence.',
    fechas: [{ id: 'vencimiento', nombre: 'Vencimiento', futuro: true }],
    dimensiones: [
      cat('cliente', 'Cliente'),
      escala(cat('urgencia', 'Urgencia'), ['Vencida', 'Vence pronto', 'Más adelante', 'Sin fecha'], { Vencida: 'var(--bad)', 'Vence pronto': 'var(--warn)' }),
      cat('proxima', 'Próxima cuota'),
    ],
    metricas: [
      m('vendido', 'Vendido', 'usd'), m('cobrado_total', 'Cobrado en total', 'usd'), menos(m('pendiente', 'Pendiente', 'usd')),
      m('proxima_monto', 'Monto de la próxima cuota', 'usd'), atributo('dias', 'Días al vencimiento'), dist('clientes', 'Clientes'),
    ],
  },
  {
    // El MRR, con la regla de `getMrrActivo` (lib/queries.ts), la misma de la API de MaKo: ganado, venta
    // de suscripción, y activa mientras dure su plazo (o indefinida); más las suscripciones activas de la pasarela
    // de un lead que no es de suscripción.
    id: 'suscripciones', nombre: 'Suscripciones', area: 'CRM y ventas',
    descripcion: 'El ingreso mensual de las suscripciones activas (MRR).',
    fechas: [{ id: 'actual', nombre: 'Hoy', sinRango: true }],
    dimensiones: [],
    metricas: [m('mrr', 'MRR', 'usd'), m('activas', 'Suscripciones activas')],
  },
  // ── Marketing: el VSL por lead y de dónde vienen las visitas ─────────────────────────────
  {
    // Cada lead que pasó por la página (con `visitor_id`): cuánto vio del video —su MEJOR avance, de toda
    // su historia— y si agendó y cerró. «¿Los que más ven, más compran?».
    id: 'vsl_leads', nombre: 'Leads y el video', area: 'Marketing',
    descripcion: 'Cada lead que pasó por tu página: cuánto vio del video, si agendó y si cerró.',
    fechas: [{ id: 'alta', nombre: 'Entró' }, { id: 'actual', nombre: 'Todos (hoy)', sinRango: true }],
    dimensiones: [...TIEMPO, escala(cat('tramo_visto', 'Cuánto vio del video'), TRAMOS_VISTO)],
    metricas: [
      m('leads', 'Leads'), m('agendas', 'Agendaron'), m('cierres', 'Cerraron'),
      r('tasa_agenda', 'Tasa de agenda', 'pct', 'agendas', 'leads', 100), r('tasa_cierre', 'Tasa de cierre', 'pct', 'cierres', 'leads', 100),
    ],
  },
  {
    // Cada visita con DÓNDE estaba quien la hizo (los headers de Vercel; NUNCA la IP, decisión de Martín del
    // 12/10/2026). La región va como código ISO 3166-2 completo («MX-BCN»), y cada fila lleva sus coordenadas
    // redondeadas (`geo`): el mapa dibuja las ciudades como burbujas. Sin las pruebas ni la vista previa.
    id: 'ubicacion', nombre: 'De dónde te visitan', area: 'Marketing',
    descripcion: 'Las visitas a tus páginas por país, región y ciudad.',
    fechas: [{ id: 'fecha', nombre: 'Fecha' }],
    dimensiones: [...TIEMPO, cat('pais', 'País'), cat('region', 'Región'), cat('ciudad', 'Ciudad'), cat('pagina', 'Página')],
    metricas: [m('visitas', 'Visitas'), dist('visitantes', 'Visitantes')],
  },
  // ── Customer Success ─────────────────────────────────────────────────────────────────
  {
    // La cartera de MaKo (`cartera()`, lib/cs-cartera.ts, la que lee la API de Customer Success): una fila
    // por cliente ganado con su señal, su estado y lo que debe. `cliente` es una PERSONA.
    id: 'cartera', nombre: 'Cartera de clientes', area: 'Customer Success',
    descripcion: 'Cada cliente que compró: cómo va, si necesita atención, qué debe y hace cuánto no hablan.',
    fechas: [{ id: 'actual', nombre: 'Hoy', sinRango: true }],
    dimensiones: [
      cat('cliente', 'Cliente'), cat('producto', 'Producto'),
      escala(cat('estado', 'Estado'), ['Activo', 'Pausado', 'Graduado', 'Baja']),
      escala(cat('senal', 'Señal'), ['Atención', 'Bien', 'Sin datos'], { 'Atención': 'var(--bad)', Bien: 'var(--good)', 'Sin datos': 'var(--faint)' }),
      cat('motivo', 'Motivo'), escala(cat('tramo_contacto', 'Último contacto'), TRAMOS_CONTACTO),
    ],
    metricas: [
      m('clientes', 'Clientes'), menos(m('atencion', 'Necesitan atención')), menos(m('cuotas_vencidas', 'Cuotas vencidas')),
      menos(m('deuda_vencida_usd', 'Deuda vencida', 'usd')), m('sesiones', 'Sesiones'),
    ],
  },
  // ── Comunicación ─────────────────────────────────────────────────────────────────────
  {
    // Las conversaciones 1-a-1 de WhatsApp como TURNOS: cada vez que alguien escribe (el primer mensaje de
    // su racha) y si le respondieron, y en cuánto. Nunca se lee el texto de un mensaje. Con la fecha «Hoy»,
    // una fila por chat con lead: si espera respuesta hace más de 24 h.
    id: 'conversaciones', nombre: 'Conversaciones de WhatsApp', area: 'Comunicación',
    descripcion: 'Cada vez que alguien te escribe: si le respondieron y en cuánto tiempo.',
    fechas: [{ id: 'fecha', nombre: 'Mensaje' }, { id: 'actual', nombre: 'Hoy', sinRango: true }],
    dimensiones: [...TIEMPO, cat('linea', 'Línea'), cat('setter', 'Setter'), cat('etapa', 'Etapa'), escala(cat('con_lead', 'Es lead'), ['Sí', 'No'])],
    metricas: [
      m('turnos', 'Mensajes recibidos'), m('respondidos', 'Respondidos'), m('rapidos_15', 'Respondidos en 15 min'), m('rapidos_60', 'Respondidos en 1 hora'),
      r('pct_respondidos', 'Respondidos (%)', 'pct', 'respondidos', 'turnos', 100),
      r('pct_rapidos', 'Respondidos en menos de 15 min (%)', 'pct', 'rapidos_15', 'turnos', 100),
      // Un promedio de tiempos de respuesta mentiría (ws1: mediana 3 min y p90 71 h): mediana y p90.
      atributo('minutos_respuesta', 'Minutos hasta la respuesta'),
      menos(percentil('mediana_respuesta', 'Mediana de respuesta (min)', 'minutos_respuesta', 50)),
      menos(percentil('p90_respuesta', 'Respuesta más lenta, p90 (min)', 'minutos_respuesta', 90)),
      menos(m('sin_responder', 'Esperando respuesta')), dist('chats', 'Chats'),
    ],
  },
];
