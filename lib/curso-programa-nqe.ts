// =============================================================================
// curso-programa-nqe — el programa de Mauricio como curso de «Negocio que Escala» (datos puros)
// =============================================================================
// Lo carga scripts/curso-cargar-programa.ts en `curso_clases` del ws1 y lo EJECUTA
// tests/curso-programa-nqe.test.ts. Sin 'server-only' a propósito: son datos y una función pura.
//
// ⚠️ ESTO ES LA SEMILLA, NO LA FUENTE DE VERDAD. Una vez cargado, el curso vive en la BASE y se
// edita desde la tab Curso (cabecera de supabase/migrations/0202_curso.sql). Cambiar algo acá
// NO cambia lo ya cargado: el cargador saltea toda clase cuyo `origen` ya existe, para no pisar
// lo que Mauricio editó a mano. Y si Mauricio BORRA una clase, volver a correr el cargador la
// vuelve a crear (no hay lápida): el cargador es para la carga inicial.
//
// DE DÓNDE SALE (relevo del 06/10/2026, con evidencia):
//  · Las 63 clases con video: la planilla de Mauricio «Arquitectura_Tutoriales_NqE» (su Drive,
//    creada el 15/09, tocada el 02/10), hoja Producción. TEXTUAL: título = «Video»,
//    descripción = «Objetivo» + «Contenido (bullets)», tarea = «Cierre: instrucción de llenado»
//    (su «Regla de cierre»: «Todo video termina en una instrucción de llenado… Las láminas de
//    apoyo van como texto bajo la clase»). Ninguno está grabado: todas van con video 'ninguno'.
//    ⚠️ Los totales de la planilla dicen 62 videos y 351 min: el 0.1 está pegado DEBAJO de la
//    fila de totales y sus fórmulas no lo cuentan. Son 63 y 356 min.
//  · Los 43 formularios: los campos de `lib/programa-campos.ts` en 07d07139^ (textuales de los
//    Cuestionarios Maestros, en tuteo). Cada campo conserva acá el código de su pregunta
//    original en `origen` (A5, D2, B7.4…) para poder auditar la cobertura; a la base va sin él.
//    ⚠️ NUNCA `graba`, `puntos` ni `atoro` del catálogo viejo: eran guiones de grabación para
//    Mauricio que nombraban a otros clientes reales.
//  · La logística (martes y jueves): hoja «Reglas de diseño», regla «Clases maestras». La
//    planilla dice que va «en texto de bienvenida, no en video». La «comunidad» que nombra esa
//    misma regla no está descrita en ningún lado: no se inventó.
//
// EL REPARTO EN LAS 9 ETAPAS (producto_entrega del ws1, producto 1, leído el 06/10):
//   F0 → bienvenida · F1+F2 → contexto · F9 → pas · F3+F4 → norte · F5 → criterio ·
//   F6 + el 7.2 «Umbrales y semáforo» → palancas · el resto de F7 → tablero · F8 → ritmo ·
//   F10+F11 → instalado. No sobra ni falta ningún video.
//
// ⚠️ EL PAS ESTÁ TERCERO Y LA PLANILLA LO PONE DESPUÉS DE RITMO, A PROPÓSITO («Contexto en dos
// pasadas»: el 9.1 se titula «Por qué el propósito va después del tablero» y su tarea es «Anota
// dónde en tu tablero se vería un propósito»). Se cargó en la etapa `pas` como está hoy la
// entrega. Si Mauricio confirma el orden de su planilla, se mueve la ETAPA en el editor de
// etapas (las clases cuelgan de la clave, viajan solas), no las clases.
//
// LA REGLA DE AVANCE (hoja «Reglas de diseño», regla «Secuencia», textual): «La instrucción de
// cierre de la última Demostración de cada fase es el criterio de desbloqueo de la siguiente».
// Por eso cada etapa tiene UNA obligatoria y es su última Demostración (lib/curso.ts,
// `etapaCompleta`). Los formularios NO son obligatorios: la etapa la cierra la Demostración.
//
// DÓNDE VA CADA FORMULARIO: inmediatamente después del video que llena el mismo bloque
// (`despuesDe`), no todos al final de la etapa. Al final quedarían DESPUÉS de la Demostración
// que cierra la etapa, y el paso automático se llevaría al cliente a la etapa siguiente antes
// de que los viera.
// =============================================================================

import type { Campo, TipoClase } from './curso';

/** El curso de Mauricio: workspace 1, producto «Negocio que Escala» (id 1). Medido el 06/10. */
export const CURSO_NQE = { workspaceId: 1, productoId: 1, producto: 'Negocio que Escala' } as const;

/** Las claves de las etapas de entrega del producto, en su orden (producto_entrega del ws1, 06/10). */
export const ETAPAS_NQE = ['bienvenida', 'contexto', 'pas', 'norte', 'criterio', 'palancas', 'tablero', 'ritmo', 'instalado'] as const;
export type EtapaNqe = (typeof ETAPAS_NQE)[number];

/** Una fila de `curso_clases` sin `workspace_id` ni `producto_id`: los pone el cargador. */
export type ClaseSemilla = {
  /** 'planilla:<#>' para un video, 'catalogo:<id viejo>' para un formulario. Es la clave de la idempotencia. */
  origen: string;
  etapa: EtapaNqe;
  orden: number;
  titulo: string;
  descripcion: string;
  tipo: TipoClase;
  minutos: number | null;
  video_tipo: 'ninguno';
  tarea: string;
  campos: Campo[];
  obligatoria: boolean;
};

// ── Los 63 videos de la planilla, textuales ───────────────────────────────────
// Generado desde la hoja Producción exportada a CSV (columnas #, Tipo, Min, Plantilla, Video,
// Objetivo, Contenido, Cierre). `plantilla` (P0-P11, «Tablero web») no tiene columna en
// curso_clases: queda acá como registro, y las 12 plantillas están todas «Pendiente».

type TipoPlanilla = 'C' | 'D' | 'Cl';
type Video = { n: string; tipo: TipoPlanilla; min: number; plantilla: string; titulo: string; objetivo: string; contenido: string; cierre: string };

const PLANILLA: readonly Video[] = [
  // ── Fase 0 · Tu compromiso ──
  { n: '0.1', tipo: 'C', min: 5, plantilla: 'P0',
    titulo: 'Las reglas y la práctica de integridad',
    objetivo: 'Instalar el contrato de trabajo y la regla central del programa',
    contenido: 'Cómo se juega: video, plantilla, clase · La regla central: lo digo y es · Dónde se practica: en las sesiones, en las tareas, en los compromisos contigo mismo · Aquí no se practica una metodología, se practica integridad',
    cierre: 'Escribe con tus palabras tu regla de integridad para este programa y fírmala' },
  { n: '0.2', tipo: 'C', min: 5, plantilla: 'P0',
    titulo: 'La visión desde el futuro',
    objetivo: 'Cambiar el encuadre de meta a acceso a una realidad',
    contenido: 'No es meta, es acceso a una realidad que ya existe · Cómo te ves, cómo te sientes, qué cambió en tu empresa y en tu vida · Ya tienes acceso a esa nueva realidad: la pregunta es si la vas a habitar',
    cierre: 'Escribe tres líneas desde el día en que terminaste el programa' },
  { n: '0.3', tipo: 'D', min: 10, plantilla: 'P0',
    titulo: 'Escribir tu visión y tus disparadores',
    objetivo: 'Que escriba su visión y detecte sus motivadores más poderosos',
    contenido: 'Guía de preguntas en pantalla: qué ves, qué sientes, quién lo nota, qué impacto tiene en tu vida · Identificar los dos o tres motivadores que más inspiración y valor generan · Motivador de escape contra motivador de acceso · Video con silencios guiados de 20 a 30 segundos',
    cierre: 'Completa el bloque Visión y disparadores de tu página Mi compromiso' },
  { n: '0.4', tipo: 'C', min: 5, plantilla: 'P0',
    titulo: 'El pre-mortem',
    objetivo: 'Anticipar las causas reales de fracaso',
    contenido: 'Estás en el futuro y fracasaste en el programa · Por qué: las causas reales, no las cómodas · Por qué anticiparlas ahora vale más que resolverlas después',
    cierre: 'Lista cinco causas por las que habrías fracasado' },
  { n: '0.5', tipo: 'D', min: 7, plantilla: 'P0',
    titulo: 'Atender las causas antes de que ocurran',
    objetivo: 'Convertir cada causa en una medida concreta desde el inicio',
    contenido: 'De cada causa a una medida: agenda, personas, hábitos, permisos · Convertir la causa en regla personal · Qué pides a tu equipo o familia desde hoy',
    cierre: 'Completa el bloque Pre-mortem: causa, medida, desde cuándo' },
  { n: '0.6', tipo: 'D', min: 7, plantilla: 'P0',
    titulo: 'De la visión a las primeras MCIs',
    objetivo: 'Extraer de la visión el borrador de las dos MCIs',
    contenido: 'Releer la visión y extraer el resultado económico y el de transferencia que ya está escrito ahí · Redactar como borrador en pasar de X a Y para fecha · Es borrador: en la fase Norte se valida con dato base',
    cierre: 'Escribe el borrador de MCI 1 y MCI 2 al pie de tu página Mi compromiso' },
  { n: '0.7', tipo: 'Cl', min: 5, plantilla: 'P0',
    titulo: 'Los tres errores del arranque',
    objetivo: 'Prueba de calidad de la página Mi compromiso',
    contenido: 'Visión genérica que le serviría a cualquiera · Pre-mortem cosmético que culpa al tiempo · Compromiso sin regla que lo sostenga · Prueba: leer la página en voz alta y ver si te mueve',
    cierre: 'Revisa tu página contra los tres errores y reescribe lo que no pase la prueba' },
  // ── Fase 1 · Punto de partida ──
  { n: '1.1', tipo: 'C', min: 5, plantilla: 'P1',
    titulo: 'La empresa de un solo cerebro y la prueba de las dos semanas',
    objetivo: 'Nombrar el problema y producir el primer dato duro',
    contenido: 'Síntomas cotidianos: pregúntale al dueño, ¿puedo decidir esto? · Diagnóstico organizacional, no defecto de carácter · Pasa con 20 o con 200 personas · La pregunta: qué se degrada si te ausentas dos semanas',
    cierre: 'Lista por área qué se degrada si te ausentas dos semanas' },
  { n: '1.2', tipo: 'D', min: 7, plantilla: 'P1',
    titulo: 'Llenar el diagnóstico base: dos semanas y cinco números',
    objetivo: 'Tener base cuantitativa y cualitativa para el Norte',
    contenido: 'Cinco números mínimos · De dónde salen y quién los tiene · Qué hacer si el dato base no existe · Pasar la lista de dos semanas a la plantilla',
    cierre: 'Completa el bloque Punto de partida con tus cinco números y la lista' },
  { n: '1.3', tipo: 'C', min: 5, plantilla: 'P1',
    titulo: 'Dónde vive el criterio',
    objetivo: 'Convertir la queja en inventario',
    contenido: 'Registro de una semana de interrupciones · Decisión, excepción, aprobación, corrección · Frecuencia y quién debería tomarla',
    cierre: 'Abre el registro de interrupciones y llévalo siete días' },
  { n: '1.4', tipo: 'D', min: 7, plantilla: 'P1',
    titulo: 'Clasificar el registro de interrupciones',
    objetivo: 'Llenar las primeras columnas del bloque Criterio',
    contenido: 'Clasificar cada interrupción · Agrupar por frecuencia · Qué se atora y con qué frecuencia → decisión que hoy pasa por ti',
    cierre: 'Pasa tu registro al bloque Criterio que hoy vive en el director, columnas 1 y 2' },
  { n: '1.5', tipo: 'C', min: 5, plantilla: 'P1',
    titulo: 'El equipo real: talento contra competencia',
    objetivo: 'Distinguir quién puede recibir criterio',
    contenido: 'Quién tiene resultado y quién tiene potencia · Quién ya decide sin ti y en qué · A quién le falta contexto y a quién le falta capacidad',
    cierre: 'Llena la tabla de equipo: quién ya decide sin ti y en qué' },
  { n: '1.6', tipo: 'Cl', min: 5, plantilla: 'P1',
    titulo: 'Los tres errores del diagnóstico',
    objetivo: 'Prueba de calidad del punto de partida',
    contenido: 'Minimizar la dependencia · Culpar al equipo · Inventar el dato',
    cierre: 'Revisa tu bloque contra los tres errores y corrige antes de avanzar' },
  // ── Fase 2 · Contexto mínimo viable ──
  { n: '2.1', tipo: 'C', min: 5, plantilla: 'P2',
    titulo: 'Contexto y criterio: la capa anterior a todo',
    objetivo: 'Instalar la distinción central de la metodología',
    contenido: 'Decisión = criterio aplicado a circunstancias dentro de un contexto · Proceso no sustituye criterio · No puedes exigir criterio a quien no le diste contexto',
    cierre: 'Escribe en una línea qué decisión reciente salió mal por falta de contexto, no de proceso' },
  { n: '2.2', tipo: 'C', min: 5, plantilla: 'P2',
    titulo: 'Identidad, realidad estratégica, fronteras',
    objetivo: 'Presentar las tres dimensiones mínimas',
    contenido: 'Identidad: origen, hitos, qué defendemos, qué no somos · Realidad estratégica: cliente ideal, por qué nos eligen, dónde no jugamos · Fronteras: qué no se tolera y qué pasa al cruzarla',
    cierre: 'Anota tres frases sueltas por dimensión, sin pulir' },
  { n: '2.3', tipo: 'D', min: 7, plantilla: 'P2',
    titulo: 'Llenar los tres bloques con un caso',
    objetivo: 'Redactar versión uno de los tres bloques',
    contenido: 'Llenado en pantalla con el caso único · Cuánto texto es suficiente · Qué se deja para la fase 9',
    cierre: 'Redacta los tres bloques en la hoja en versión uno' },
  { n: '2.4', tipo: 'Cl', min: 5, plantilla: 'P2',
    titulo: 'Errores del contexto mínimo',
    objetivo: 'Prueba de calidad de las tres dimensiones',
    contenido: 'Identidad que solo tú puedes contar · Cliente ideal que es todos · Frontera sin consecuencia',
    cierre: 'Pídele a un gerente que lea el bloque de identidad y anota qué cambió al contarlo' },
  // ── Fase 3 · Visión a 3 años ──
  { n: '3.1', tipo: 'C', min: 5, plantilla: 'P3',
    titulo: 'Escribir desde el futuro',
    objetivo: 'Cambiar el modo de redacción de la visión',
    contenido: 'Se escribe en presente, desde allá · Números y descripción, las dos cosas · Máximo tres años',
    cierre: 'Escribe la fecha de la visión y los cinco números que tendrá la empresa ese día' },
  { n: '3.2', tipo: 'D', min: 7, plantilla: 'P3',
    titulo: 'Redactar la visión y sus decisiones de mayor impacto',
    objetivo: 'Llenar el bloque Visión completo',
    contenido: 'Descripción desde el futuro · Números · Qué cambios estructurales exige · Qué hay que dejar de hacer · Qué capacidad hay que construir',
    cierre: 'Completa el bloque Visión con descripción, números y tres decisiones estructurales' },
  { n: '3.3', tipo: 'Cl', min: 5, plantilla: 'P3',
    titulo: 'La visión que no construye empresa',
    objetivo: 'Prueba de calidad de la visión',
    contenido: 'Si se cumple solo porque seguiste cargando la operación, no construiste empresa · Visión de facturación sin visión de organización',
    cierre: 'Aplica la prueba y reescribe si no pasa' },
  // ── Fase 4 · Norte a 12 meses ──
  { n: '4.1', tipo: 'C', min: 5, plantilla: 'P4',
    titulo: 'Qué es un Norte y qué no',
    objetivo: 'Separar Norte de lista de metas',
    contenido: 'Enfocar no es enlistar · Una estrategia existe cuando cambia lo que alguien hace el lunes y lo que se mide el viernes',
    cierre: 'Tacha de tu lista de metas todo lo que no sea el resultado que más importa' },
  { n: '4.2', tipo: 'C', min: 5, plantilla: 'P4',
    titulo: 'De tu borrador a la MCI definitiva',
    objetivo: 'Validar las MCIs con dato base',
    contenido: 'MCI 1 resultado: pasar de X a Y para fecha · MCI 2 transferencia: sobre lo que el equipo empieza a hacer, nunca sobre lo que el director deja de hacer · Tus horas en operación son el lag que la comprueba · Cruzar borrador de fase 0 con números de fase 1',
    cierre: 'Escribe la versión definitiva de las dos MCIs' },
  { n: '4.3', tipo: 'C', min: 5, plantilla: 'P4',
    titulo: 'Un objetivo por área, delegado como resultado',
    objetivo: 'Bajar el Norte sin fragmentarlo',
    contenido: 'Cómo se deriva del MCI · Un objetivo por área medido con lag · Responsable con nombre',
    cierre: 'Escribe un objetivo por área con responsable y lag' },
  { n: '4.4', tipo: 'D', min: 7, plantilla: 'P4',
    titulo: 'Llenar el bloque Norte con un caso',
    objetivo: 'Ensamblar MCIs y objetivos en la hoja',
    contenido: 'Llenado en pantalla con el caso único · Redacción y dato base · Responsables',
    cierre: 'Pasa MCIs y objetivos al bloque Norte de la hoja' },
  { n: '4.5', tipo: 'Cl', min: 5, plantilla: 'P4',
    titulo: 'Se delegan resultados, no tareas',
    objetivo: 'Corregir la redacción más común',
    contenido: 'Tres objetivos mal escritos, antes y después · Qué hace delegable un objetivo · Prueba: el responsable lo explica sin ti',
    cierre: 'Cada responsable explica su objetivo sin ti; anota qué no entendieron' },
  // ── Fase 5 · Criterio ──
  { n: '5.1', tipo: 'C', min: 5, plantilla: 'P5',
    titulo: 'Por qué documentar procesos no bastó',
    objetivo: 'Desactivar la solución que ya intentó',
    contenido: 'El proceso dice qué hacer cuando el escenario fue previsto · El criterio, cuando la realidad deja de parecerse al manual · Proceso más criterio, nunca uno contra otro',
    cierre: 'Marca en tu inventario qué interrupciones ya tienen proceso y aun así llegan a ti' },
  { n: '5.2', tipo: 'C', min: 5, plantilla: 'P5',
    titulo: 'Las formas del criterio',
    objetivo: 'Dar repertorio para hacer explícito el criterio',
    contenido: 'Principios, preguntas, reglas, umbrales, políticas, derechos de decisión, protocolos de excepción, criterios de escalamiento · Cuándo sirve cada una',
    cierre: 'Asigna a cada interrupción qué forma de criterio la resolvería' },
  { n: '5.3', tipo: 'D', min: 7, plantilla: 'P5',
    titulo: 'Del cuello de botella a la regla',
    objetivo: 'Llenar las columnas 3 y 4 del bloque Criterio',
    contenido: 'Decisión que hoy pasa por ti → quién deberá tomarla → regla, umbral o pregunta que se transfiere · Hasta cuánto decide cada quién · Qué se consulta y qué se informa',
    cierre: 'Completa quién deberá decidir y qué regla o umbral se transfiere' },
  { n: '5.4', tipo: 'C', min: 5, plantilla: 'P5',
    titulo: 'La carta de expectativas: siete secciones',
    objetivo: 'Formalizar la transferencia con una persona',
    contenido: 'Las siete secciones · La crítica: lo que puedes decidir sin consultarme · Se conversa, no se entrega por correo',
    cierre: 'Elige la primera persona con quien harás la carta' },
  { n: '5.5', tipo: 'D', min: 7, plantilla: 'P5',
    titulo: 'Redactar una carta de expectativas',
    objetivo: 'Escribir la primera carta con un caso',
    contenido: 'Llenado en pantalla de las siete secciones · Lenguaje de fronteras y umbrales · Cómo se presenta en conversación',
    cierre: 'Redacta la carta y agenda la conversación para entregarla' },
  { n: '5.6', tipo: 'Cl', min: 5, plantilla: 'P5',
    titulo: 'El criterio que regresa',
    objetivo: 'Prevenir la recaída',
    contenido: 'Señales de que el criterio volvió a ti · Qué hacer cuando deciden distinto a como tú habrías decidido · El criterio no elimina el juicio, lo distribuye',
    cierre: 'Registra la primera decisión que tomaron sin ti y cómo reaccionaste' },
  // ── Fase 6 · Palancas ──
  { n: '6.1', tipo: 'C', min: 5, plantilla: 'P6',
    titulo: 'Revalidar objetivos del trimestre',
    objetivo: 'Cerrar el puente Norte a palancas',
    contenido: 'El objetivo es el puente, no un trámite · Qué del Norte aplica a este trimestre · Ajustar antes de bajar palancas',
    cierre: 'Confirma o ajusta los objetivos que aplican a este trimestre' },
  { n: '6.2', tipo: 'C', min: 5, plantilla: 'P6',
    titulo: 'Lag y lead, y el filtro de las cuatro preguntas',
    objetivo: 'Instalar la distinción operativa',
    contenido: 'El lag dice qué ocurrió · La palanca es lo que hacemos ahora para aumentar la probabilidad · Filtro: predice, bajo control del equipo, se observa esta semana, no requiere permiso del director',
    cierre: 'Lista todas las palancas candidatas por objetivo, sin filtrar' },
  { n: '6.3', tipo: 'D', min: 7, plantilla: 'P6',
    titulo: 'Filtrar y llenar la ficha de nueve campos',
    objetivo: 'Dejar las palancas definitivas con ficha',
    contenido: 'Aplicar el filtro en pantalla · Los nueve campos · Máximo tres por objetivo · Responsable único',
    cierre: 'Deja máximo tres palancas por objetivo con ficha completa' },
  { n: '6.4', tipo: 'D', min: 7, plantilla: 'P6',
    titulo: 'Cascada completa de un área',
    objetivo: 'Ver la cascada objetivo → palancas → responsable en un área',
    contenido: 'Llenado de un área completa con el caso único · Cómo se replica en las demás',
    cierre: 'Replica la cascada en tus áreas restantes' },
  { n: '6.5', tipo: 'Cl', min: 5, plantilla: 'P6',
    titulo: 'Veinte palancas no son palancas',
    objetivo: 'Corregir la dispersión',
    contenido: 'Por qué pocas y claras · Cómo se recorta de doce a tres · Palanca que nadie controla no es palanca',
    cierre: 'Recorta y anota qué palanca dependía de ti y a quién pasó' },
  // ── Fase 7 · Tablero ──
  { n: '7.1', tipo: 'C', min: 5, plantilla: 'P7',
    titulo: 'Para qué existe un tablero',
    objetivo: 'Quitar el encuadre de vigilancia',
    contenido: 'No existe para que el dueño controle al equipo, existe para que el equipo se vea a sí mismo · El tablero es evidencia del juego',
    cierre: 'Escribe quién entra al tablero además de ti' },
  { n: '7.2', tipo: 'C', min: 5, plantilla: 'P7',
    titulo: 'Umbrales y semáforo',
    objetivo: 'Fijar verde, amarillo y rojo',
    contenido: 'Cómo se pone el número sin histórico · Los pone el líder de área, no el director · Revisión a las cuatro semanas',
    cierre: 'Cada líder propone verde, amarillo y rojo de sus palancas' },
  { n: '7.3', tipo: 'C', min: 5, plantilla: 'P7',
    titulo: 'Definir la evidencia: qué cuenta y qué no',
    objetivo: 'Resolver el atasco más común',
    contenido: 'Foto, registro, folio, firma, captura · Quién la sube y cuándo · Evidencia que no se puede falsificar sin costo',
    cierre: 'Escribe la evidencia de cada palanca en una línea' },
  { n: '7.4', tipo: 'D', min: 7, plantilla: 'P7',
    titulo: 'Evidencia en casos difíciles y sin dato base',
    objetivo: 'Bajar la evidencia a palancas conductuales',
    contenido: 'Palancas cualitativas · Qué hacer cuando el dato base no existe · Llenado en pantalla',
    cierre: 'Corrige las evidencias que no pasan la prueba' },
  { n: '7.5', tipo: 'D', min: 7, plantilla: 'Tablero web',
    titulo: 'Navegar y registrar en el tablero sin miedo',
    objetivo: 'Que el cliente use el tablero web',
    contenido: 'Recorrido del tablero · Registrar en rojo no es confesar, es operar · Quién más entra además del dueño',
    cierre: 'Registra la primera semana completa, incluidos los rojos' },
  { n: '7.6', tipo: 'Cl', min: 5, plantilla: 'P7',
    titulo: 'El tablero que no cambió nada',
    objetivo: 'Prueba de calidad del tablero',
    contenido: 'Si nada cambió en piso, es un reporte · La operación debe ser evidencia del tablero · Tres señales de tablero muerto',
    cierre: 'Anota qué cambió en piso esta semana; si nada, revisa umbrales y evidencia' },
  // ── Fase 8 · Ritmo ──
  { n: '8.1', tipo: 'C', min: 5, plantilla: 'P8',
    titulo: 'Ritmo no es hacer juntas',
    objetivo: 'Encuadre del ritmo',
    contenido: 'Es diseñar conversaciones que transfieran responsabilidad · Solo hay junta semanal donde hay tablero',
    cierre: 'Lista las juntas que hoy existen y tacha las que no tienen tablero' },
  { n: '8.2', tipo: 'C', min: 5, plantilla: 'P8',
    titulo: 'Las ocho reglas del sistema de juntas',
    objetivo: 'Dar el marco de diseño',
    contenido: 'Recorrido de las ocho reglas · Cuál se rompe más seguido',
    cierre: 'Marca cuál regla rompes más seguido' },
  { n: '8.3', tipo: 'C', min: 5, plantilla: 'P8',
    titulo: 'Diaria de sincronización y semanal de rendición de cuentas',
    objetivo: 'Diseñar las dos juntas centrales',
    contenido: 'Diaria: sincroniza, no resuelve; de pie, orden fijo · Semanal: gestión de brechas; el director habla menos del 20% · Las dos preguntas: qué vas a hacer y cómo te ayudo',
    cierre: 'Define quién asiste a cada una y la duración' },
  { n: '8.4', tipo: 'C', min: 5, plantilla: 'P8',
    titulo: '1:1 y mensual de estrategia',
    objetivo: 'Completar la cadencia',
    contenido: 'Qué se ve en 1:1 y qué no · La mensual mira el Norte, no la semana',
    cierre: 'Agenda tus 1:1 con cada líder de área' },
  { n: '8.5', tipo: 'D', min: 7, plantilla: 'P8',
    titulo: 'Llenar el mapa de juntas y la ruta de consecuencias',
    objetivo: 'Llenar el bloque Ritmo',
    contenido: 'Junta, día, hora, quién, qué se revisa · Ruta de consecuencias paso a paso',
    cierre: 'Completa el bloque Ritmo' },
  { n: '8.6', tipo: 'C', min: 5, plantilla: 'P8',
    titulo: 'Consecuencias y conversaciones difíciles',
    objetivo: 'Cerrar el sistema',
    contenido: 'Ruta de consecuencias con quién la aplica · Cómo se prepara la conversación · Contexto sin consecuencias es discurso interno del fundador',
    cierre: 'Escribe la ruta de consecuencias con quién la aplica en cada paso' },
  { n: '8.7', tipo: 'Cl', min: 5, plantilla: 'P8',
    titulo: 'La semanal donde el director habla el 80%',
    objetivo: 'Prueba de calidad del ritmo',
    contenido: 'Señales de junta que persigue en vez de rendir cuentas · Rediseñar las preguntas',
    cierre: 'Cronometra tu próxima semanal; si hablas más del 20%, rediseña las preguntas' },
  // ── Fase 9 · Contexto profundo ──
  { n: '9.1', tipo: 'C', min: 5, plantilla: 'P9',
    titulo: 'Por qué el propósito va después del tablero',
    objetivo: 'Justificar el orden',
    contenido: 'Un PAS sin sistema es un lema · Ahora hay dónde verlo · Aquí se cierra la envolvente del contexto',
    cierre: 'Anota dónde en tu tablero se vería un propósito si lo tuvieras escrito' },
  { n: '9.2', tipo: 'C', min: 5, plantilla: 'P9',
    titulo: 'Origen y PAS',
    objetivo: 'Recuperar la materia prima del propósito',
    contenido: 'De dónde salió la empresa · Qué momento la definió · A quién le cambia la vida · Prueba del día normal',
    cierre: 'Escribe el momento que definió a la empresa y a quién le cambia la vida' },
  { n: '9.3', tipo: 'D', min: 7, plantilla: 'P9',
    titulo: 'Redactar PAS y narrativa',
    objetivo: 'Llenar el bloque Significado',
    contenido: 'Una sola versión escrita · Llenado en pantalla',
    cierre: 'Completa el bloque Significado' },
  { n: '9.4', tipo: 'C', min: 5, plantilla: 'P9',
    titulo: 'Promesas por stakeholder y valores en acción',
    objetivo: 'Presentar promesas y valores como decisiones',
    contenido: 'Promesa a colaboradores, clientes y accionistas, cada una con evidencia · Valor → comportamiento observable → qué esperamos → qué no toleramos',
    cierre: 'Lista promesas por stakeholder y tus valores' },
  { n: '9.5', tipo: 'D', min: 7, plantilla: 'P9',
    titulo: 'Llenar promesas con evidencia y valores en acción',
    objetivo: 'Llenar los bloques Promesas y Valores',
    contenido: 'Promesa sin evidencia observable es intención · Un valor que no cambia una decisión no está en acción',
    cierre: 'Completa los bloques Promesas y Valores en acción' },
  { n: '9.6', tipo: 'C', min: 5, plantilla: 'P9',
    titulo: 'Reproducción del contexto y comunicación al equipo',
    objetivo: 'Que el contexto viva sin el director',
    contenido: 'Selección y onboarding, historias, reconocimiento, consecuencias · Estrategia de comunicación: cuándo, quién, en qué orden · Si solo se transmite cuando estás presente, sigue en una cabeza',
    cierre: 'Escribe cómo entra el contexto en selección, onboarding, reconocimiento y consecuencias' },
  { n: '9.7', tipo: 'Cl', min: 5, plantilla: 'P9',
    titulo: 'El PAS que sigue siendo lema',
    objetivo: 'Prueba de calidad del contexto profundo',
    contenido: 'Prueba del día normal al PAS · Valor que no cambia decisiones · Promesa sin evidencia',
    cierre: 'Aplica la prueba del día normal a tu PAS y a cada valor; reescribe lo que no pase' },
  // ── Fase 10 · El trabajo del director (DOS™) ──
  { n: '10.1', tipo: 'C', min: 5, plantilla: 'P10',
    titulo: 'De operador a director general',
    objetivo: 'Encuadre de la transformación',
    contenido: 'No es liberar tiempo para trabajar menos, es recuperar capacidad para colocarla donde genera más valor · Qué hace un director general de tiempo completo',
    cierre: 'Lista el trabajo de director que hoy nadie hace de tiempo completo' },
  { n: '10.2', tipo: 'C', min: 5, plantilla: 'P10',
    titulo: 'Decisiones que te reservas',
    objetivo: 'Evitar la delegación indiscriminada',
    contenido: 'Qué no se delega nunca · Cómo se comunica esa reserva',
    cierre: 'Escribe la lista de decisiones reservadas y comunícala' },
  { n: '10.3', tipo: 'D', min: 7, plantilla: 'P10',
    titulo: 'Diseñar la agenda con bloques de dirección e indicadores',
    objetivo: 'Llenar el bloque Dirección',
    contenido: 'Bloques por tipo de trabajo · Dónde van cultura, visión, talento, alianzas · Tres indicadores: decisiones escaladas, horas en operación contra dirección, uso de horas recuperadas',
    cierre: 'Completa el bloque Dirección: agenda, decisiones reservadas, tres indicadores' },
  { n: '10.4', tipo: 'Cl', min: 5, plantilla: 'P10',
    titulo: 'El director que regresa a operar',
    objetivo: 'Prueba de calidad de la agenda',
    contenido: 'Señales de regreso a la operación · Qué lo provoca',
    cierre: 'Revisa cuatro semanas de agenda contra lo diseñado y anota dónde regresaste' },
  // ── Fase 11 · Una sola hoja ──
  { n: '11.1', tipo: 'C', min: 5, plantilla: 'P11',
    titulo: 'La página única: orden de bloques y qué se recorta',
    objetivo: 'Preparar el ensamble',
    contenido: 'Orden de los bloques en la A3 · Qué se recorta al pasar de plantilla a hoja · La hoja es de decisiones, no de texto',
    cierre: 'Imprime tus bloques por separado y marca qué sobra' },
  { n: '11.2', tipo: 'D', min: 7, plantilla: 'P11',
    titulo: 'Ensamblar la hoja A3 con un caso completo',
    objetivo: 'Ensamblar la página única',
    contenido: 'Ensamble en pantalla con el caso único · Qué queda fuera',
    cierre: 'Ensambla tu hoja en la plantilla A3' },
  { n: '11.3', tipo: 'Cl', min: 5, plantilla: 'P11',
    titulo: 'Las ocho pruebas de calidad y ponerla a operar',
    objetivo: 'Auditar y activar la hoja',
    contenido: 'Promesa con evidencia · Identidad contable sin ti · PAS visible en un día normal · Valor que cambia una decisión · A quién no le vendemos · Visión que no depende de ti · Escribir lo que el equipo ve · Contexto que se transmite sin ti · Presentación al equipo directivo, revisión trimestral y anual',
    cierre: 'Audita la hoja con las ocho pruebas, fírmala y agenda la presentación al equipo directivo' },
];

const TIPO: Record<TipoPlanilla, TipoClase> = { C: 'concepto', D: 'demostracion', Cl: 'clinica' };

const ETAPA_DE_FASE: Record<number, EtapaNqe> = {
  0: 'bienvenida', 1: 'contexto', 2: 'contexto', 3: 'norte', 4: 'norte', 5: 'criterio',
  6: 'palancas', 7: 'tablero', 8: 'ritmo', 9: 'pas', 10: 'instalado', 11: 'instalado',
};
/**
 * Los videos que no van con su fase. El 7.2 «Umbrales y semáforo» es de la fase Tablero en la
 * planilla, pero la etapa de la entrega se llama «Palancas y umbrales» (inferencia del relevo:
 * ninguna fuente lo fija; la etapa Tablero queda con la evidencia y el tablero web).
 */
const ETAPA_DE_VIDEO: Partial<Record<string, EtapaNqe>> = { '7.2': 'palancas' };

const numeroDe = (n: string): [number, number] => {
  const [fase, video] = n.split('.').map(Number);
  return [fase, video];
};
const etapaDeVideo = (n: string): EtapaNqe => ETAPA_DE_VIDEO[n] ?? ETAPA_DE_FASE[numeroDe(n)[0]];

/** El objetivo y, debajo, un punto por renglón (en la planilla vienen separados por « · »). */
function descripcionDe(v: Video): string {
  const objetivo = v.objetivo.replace(/\.?$/, '.');
  const puntos = v.contenido.split(' · ').map((p) => p.trim()).filter(Boolean);
  return [objetivo, '', ...puntos.map((p) => `• ${p}`)].join('\n');
}

// ── La logística, como texto de bienvenida ────────────────────────────────────
// Regla «Clases maestras», textual: «Martes: clase maestra por fase en rotación fija de 12
// semanas (quien entra hoy sabe cuándo toca su fase; mientras, ve la grabación anterior).
// Jueves: clínica abierta, solo se revisa lo que ya está escrito en plantilla; primera
// pregunta: cuál causa del pre-mortem se está cumpliendo.» Acá sólo se pasó a segunda persona.
// ⚠️ No trae hora ni link de la clase: los pone Mauricio desde la tab Curso.

const LOGISTICA = {
  origen: 'planilla:logistica',
  titulo: 'Martes y jueves',
  descripcion: [
    'Martes: clase maestra por fase, en rotación fija de 12 semanas. Si entras hoy, ya sabes cuándo toca tu fase; mientras, ves la grabación anterior.',
    '',
    'Jueves: clínica abierta. Solo se revisa lo que ya está escrito en la plantilla; la primera pregunta es cuál causa del pre-mortem se está cumpliendo.',
  ].join('\n'),
};

// ── Los formularios: los campos del catálogo borrado ──────────────────────────
// Mapeo del relevo (qué clase vieja va a qué etapa). `despuesDe` = el video de la planilla que
// llena el mismo bloque. Los `label` son textuales de los Cuestionarios Maestros salvo los
// marcados con «era …»: ahí se cambió sólo una referencia que en el curso nuevo queda colgando
// (el «bloque B» o el «A5» del cuestionario viejo, que el cliente nunca ve). Ninguna pregunta es
// nueva. Los títulos son los del catálogo, salvo donde contradecían a sus propios campos.
//
// ⚠️ m0c2 «Estándar no es criterio» (el ejemplo de UNA decisión de la tabla D2) NO se cargó: el
// relevo no lo reparte, y en el programa nuevo su ejercicio ya lo hacen el 2.1 (una decisión que
// salió mal por falta de contexto) y la tabla D2 entera (m2c2, en criterio).
//
// ⚠️ Los formularios de palancas, evidencia y umbrales eran «uno por área» (porArea) y los
// umbrales los contestaba el LÍDER de área. curso_clases no tiene esa repetición: hoy es un
// formulario por cliente.

type CampoConOrigen = Campo & { origen: string };
type Formulario = { id: string; etapa: EtapaNqe; despuesDe: string; titulo: string; campos: CampoConOrigen[] };

const FORMULARIOS: readonly Formulario[] = [
  // ── bienvenida ──
  { id: 'm0c1', etapa: 'bienvenida', despuesDe: '0.1', titulo: 'Qué vas a tener al final',
    campos: [
      { id: 'frase-de-cierre', tipo: 'texto', origen: 'J1', label: '¿Qué esperas de este trabajo para considerarlo un éxito? Con qué frase te gustaría cerrar dentro de seis meses.', obligatorio: true },
      // era «…conseguir los números del bloque B.» (el bloque B del Cuestionario de Norte = venta y resultado).
      { id: 'horas-que-apartas', tipo: 'linea', origen: 'Cómo contestarlo · Cuánto', label: '¿Cuántas horas tuyas vas a apartar para contestar esto, y en qué días?', ayuda: 'Entre cuatro y seis horas repartidas en varios días. La parte que más tarda es conseguir los números de venta y resultado.', obligatorio: true },
      // era «Los bloques B, C, F y H se reparten…» (B números, C competencia, F equipo, H datos que faltan).
      { id: 'quien-consigue-los-datos', tipo: 'texto', origen: 'Cómo contestarlo · Quién', label: 'Los números, la competencia, el equipo y los datos que faltan se reparten con quien tenga el dato. ¿Con quién?', ayuda: 'Se vale delegar la recolección, no la reflexión.', obligatorio: true },
    ] },
  // era «Cómo funciona cada bloque»: así se llamaba el VIDEO viejo (la mecánica del bucle). Sus
  // campos son J2-J4 del Cuestionario de Norte; el título sale del primero.
  { id: 'm0c3', etapa: 'bienvenida', despuesDe: '0.4', titulo: 'Lo que no quieres que pase',
    campos: [
      { id: 'que-no-quieres-que-pase', tipo: 'texto', origen: 'J2', label: '¿Qué no quieres que pase durante el proceso?', obligatorio: true },
      { id: 'que-te-preocupa', tipo: 'texto', origen: 'J3', label: '¿Qué te preocupa? Sin filtro.', obligatorio: true },
      { id: 'quien-mas-tiene-que-estar-de-acuerdo', tipo: 'texto', origen: 'J4', label: '¿Quién más en tu empresa tiene que estar de acuerdo con esto para que funcione?', obligatorio: true },
    ] },
  // ── contexto ──
  { id: 'm2c1', etapa: 'contexto', despuesDe: '1.1', titulo: 'Si desapareces dos semanas',
    campos: [
      { id: 'que-se-degrada-primero', tipo: 'texto', origen: 'D1', label: 'Si desapareces dos semanas sin teléfono, ¿qué se degrada primero? Sé específico.', obligatorio: true },
    ] },
  { id: 'm1c1', etapa: 'contexto', despuesDe: '1.2', titulo: 'La unidad que se repite',
    campos: [
      { id: 'empresa-marca-giro', tipo: 'linea', origen: 'A1', label: 'Nombre de la empresa, marca comercial y giro en una sola línea.', obligatorio: true },
      { id: 'unidad-que-se-repite', tipo: 'eleccion', origen: 'A2', label: '¿Qué cosa se repite muchas veces en tu negocio y determina el resultado? Elige una:', opciones: ['Un punto de operación. Tiendas, sucursales, rutas, plantas, consultorios, unidades de servicio. El mismo estándar se ejecuta muchas veces al día.', 'Una oportunidad comercial. Prospectos y deals que avanzan por etapas hasta cerrar. El resultado depende de cuántos entran y qué porcentaje avanza.', 'Un proyecto o una obra. Trabajos con inicio, fin, presupuesto y fecha comprometida.'], obligatorio: true },
      { id: 'cuantas-unidades', tipo: 'numero', origen: 'A3', label: '¿Cuántas de esas unidades tienes hoy?', ayuda: 'Si son puntos de operación, cuántos. Si son oportunidades, cuántas abiertas en promedio al mes. Si son proyectos, cuántos simultáneos.', obligatorio: true },
      { id: 'conviven-dos-arquetipos', tipo: 'texto', origen: 'A4', label: '¿Conviven dos de las tres anteriores en tu negocio? Si sí, ¿qué línea se comporta como cada una?', ayuda: 'Es común y no es un problema, pero cambia cómo se mide cada línea.' },
    ] },
  { id: 'm1c2', etapa: 'contexto', despuesDe: '1.2', titulo: 'Tus áreas y quién responde',
    campos: [
      { id: 'areas-y-responsables', tipo: 'tabla', origen: 'A5', label: 'Lista las áreas o funciones que existen hoy, aunque una persona cubra varias. Al lado, quién responde por cada una.', columnas: ['Área o función', 'Quién responde'], obligatorio: true },
      { id: 'quien-rinde-cuentas', tipo: 'texto', origen: 'F3', label: '¿Quién rinde cuentas hoy de cada área? Nombre y apellido. Si hay áreas sin dueño claro, dilo.', obligatorio: true },
    ] },
  { id: 'm1c3', etapa: 'contexto', despuesDe: '1.2', titulo: 'Venta y resultado de 24 meses',
    campos: [
      { id: 'venta-y-resultado-24-meses', tipo: 'tabla', origen: 'B2', label: 'Venta y resultado de los últimos veinticuatro meses, mes a mes o al menos trimestre a trimestre.', ayuda: 'Si el resultado neto no lo tienes, pon el bruto y dilo.', columnas: ['Mes o trimestre', 'Venta', 'Resultado'], filasMin: 8, obligatorio: true },
      { id: 'por-linea-de-negocio', tipo: 'tabla', origen: 'B3', label: 'Por cada línea de negocio, producto o servicio principal: cuánto vendió, qué margen deja y qué porcentaje de la venta total representa.', columnas: ['Línea de negocio, producto o servicio', 'Cuánto vendió', 'Qué margen deja', '% de la venta total'], obligatorio: true },
      { id: 'resultado-por-unidad', tipo: 'tabla', origen: 'B4', label: 'Resultado por unidad. Si son muchas, agrúpalas en tres bloques: las buenas, las medias y las que pierden. Cuántas hay en cada bloque y cuál es el rango.', columnas: ['Bloque', 'Cuántas hay', 'Rango'], filasFijas: ['Las buenas', 'Las medias', 'Las que pierden'], obligatorio: true },
      { id: 'fuente-de-cada-cifra', tipo: 'tabla', origen: 'B11', label: 'Por cada cifra que diste arriba: ¿de dónde sale y quién la calcula? Marca cuáles son dato duro y cuáles son estimación.', columnas: ['Cifra', 'De dónde sale', 'Quién la calcula', '¿Dato duro o estimación?'], obligatorio: true },
    ] },
  // era «Qué te hace perder plata»: «plata» es rioplatense y lo lee un cliente mexicano.
  { id: 'm1c4', etapa: 'contexto', despuesDe: '1.2', titulo: 'Qué te hace perder dinero',
    campos: [
      { id: 'tres-costos-que-mas-pesan', tipo: 'tabla', origen: 'B7', label: 'Los tres costos que más pesan, con su porcentaje sobre la venta.', columnas: ['Costo', '% sobre la venta'], filasMin: 3, obligatorio: true },
      { id: 'punto-de-equilibrio', tipo: 'texto', origen: 'B8', label: '¿Cuál es el punto de equilibrio? ¿Es igual para todas las unidades o cambia por tamaño?', obligatorio: true },
      { id: 'que-las-hace-perder', tipo: 'checks', origen: 'B5', label: 'De las que no llegan al punto de equilibrio, ¿qué las hace perder?', opciones: ['Ubicación', 'Renta', 'Nómina', 'Tamaño', 'Competencia', 'Precio', 'Otra'], obligatorio: true },
      { id: 'venden-bien-y-no-son-rentables', tipo: 'texto', origen: 'B6', label: '¿Hay unidades que venden bien y aun así no son rentables? ¿Cuáles y por qué?', obligatorio: true },
    ] },
  { id: 'm1c5', etapa: 'contexto', despuesDe: '1.2', titulo: 'Tu paradoja en una frase',
    campos: [
      { id: 'cifra-que-no-cuadra', tipo: 'texto', origen: 'B1', label: '¿Qué cifra que ustedes manejan no cuadra? Contra el tamaño del mercado, contra el margen que reportan, contra el punto de equilibrio, o simplemente contra su intuición.', obligatorio: true },
      { id: 'que-cambio-en-doce-meses', tipo: 'texto', origen: 'B9', label: '¿Qué cambió en los últimos doce meses? Separa lo interno, precios, personal, estructura, de lo externo, competencia, regulación, mercado.', obligatorio: true },
      { id: 'la-paradoja', tipo: 'linea', origen: 'B10', label: 'Ahora escribe la paradoja en una frase, usando dos números que se contradicen.', ayuda: 'Ejemplos de la forma: «crecimos X y ganamos menos», «vendemos más que nunca y estoy más atrapado que nunca», «abrimos N unidades y el resultado por unidad bajó».', obligatorio: true },
    ] },
  { id: 'm1c6', etapa: 'contexto', despuesDe: '1.2', titulo: 'Lo que no sabes todavía',
    campos: [
      // era «…para medir lo del bloque G.» (el bloque G del Cuestionario de Norte = el Norte: MCIs y objetivos).
      { id: 'datos-que-no-existen', tipo: 'tabla', origen: 'H1', label: 'Datos que no existen o que nadie calcula hoy y que harían falta para medir tu Norte. Por cada uno: quién debería generarlo y para cuándo.', columnas: ['Dato que falta', 'Quién debería generarlo', 'Para cuándo'], obligatorio: true },
    ] },
  { id: 'm3c1', etapa: 'contexto', despuesDe: '1.5', titulo: 'Quién hace qué de verdad',
    campos: [
      { id: 'personas-clave', tipo: 'tabla', origen: 'F1', label: 'Por cada persona clave, llena esta tabla.', ayuda: 'Sé honesto, este documento no se comparte con ellos.', columnas: ['Nombre', 'Rol formal', 'Qué hace realmente', 'Qué le sobra y qué le falta', 'Decisión: desarrollar, mover, sustituir, mantener'], obligatorio: true },
      { id: 'clasificacion-abcd', tipo: 'texto', origen: 'F2', label: 'Clasifica a cada uno en una de estas cuatro categorías:', ayuda: 'A. Alto desempeño y alto compromiso con el proyecto. B. Comprometido pero todavía sin la habilidad. Es la mejor inversión. C. Muy bueno en lo que hace pero no comprometido con el proyecto. D. Ni desempeño ni compromiso.', obligatorio: true },
      { id: 'reportes-directos', tipo: 'numero', origen: 'F5', label: '¿Cuántas personas te reportan directo?' },
      { id: 'con-quienes-te-reunes', tipo: 'texto', origen: 'F5', label: '¿Con quiénes te reúnes y con qué frecuencia hoy?' },
    ] },
  { id: 'm3c2', etapa: 'contexto', despuesDe: '1.5', titulo: 'Qué puestos faltan',
    campos: [
      { id: 'puestos-que-faltan', tipo: 'tabla', origen: 'F4', label: '¿Qué puestos faltan? Por cada uno: qué haría, a quién reportaría, y si crees que se puede promover desde dentro o hay que contratar afuera.', columnas: ['Puesto que falta', 'Qué haría', 'A quién reportaría', '¿Se puede promover desde dentro o hay que contratar afuera?'], obligatorio: true },
    ] },
  { id: 'm1c7', etapa: 'contexto', despuesDe: '2.2', titulo: 'Quién te compite de verdad',
    campos: [
      { id: 'quien-te-compite', tipo: 'tabla', origen: 'C1', label: '¿Quién te compite de verdad, en qué frente pega cada uno y en qué unidades o líneas se siente?', columnas: ['Competidor', 'En qué frente pega', 'En qué unidades o líneas se siente'], obligatorio: true },
      { id: 'perdida-medible-o-percepcion', tipo: 'texto', origen: 'C2', label: '¿Has perdido venta de forma medible o es percepción? Si es medible, cuánto y desde cuándo.', obligatorio: true },
      { id: 'por-que-te-prefieren', tipo: 'texto', origen: 'C3', label: '¿Qué hace que un cliente te prefiera? ¿Qué te dicen los clientes cuando los escuchas?', obligatorio: true },
      { id: 'el-que-salio-mejor', tipo: 'texto', origen: 'C4', label: '¿Hay una unidad, un vendedor o un proyecto que salió notablemente mejor que el resto? ¿Sabes por qué?', ayuda: 'Esa es la escuela del sistema.', obligatorio: true },
      { id: 'lo-que-si-funciono', tipo: 'texto', origen: 'C5', label: '¿Qué han hecho que sí funcionó y quieren conservar?', obligatorio: true },
    ] },
  // ── pas ──
  { id: 'm5c1', etapa: 'pas', despuesDe: '9.2', titulo: 'El origen',
    campos: [
      { id: 'por-que-seguirian', tipo: 'texto', origen: 'I1', label: 'Si el dinero ya estuviera resuelto, ¿por qué seguirían con esto?' },
      { id: 'que-construyeron-aqui', tipo: 'texto', origen: 'I2', label: '¿Qué construyeron aquí que antes no existía en su zona o en su industria?' },
    ] },
  { id: 'm5c2', etapa: 'pas', despuesDe: '9.2', titulo: 'El PAS y la narrativa',
    campos: [
      { id: 'orgullo-que-el-grande-no-puede', tipo: 'texto', origen: 'I3', label: '¿De qué se sienten orgullosos que un competidor grande no podría hacer, ni con todo su dinero?' },
      { id: 'solucion-que-solo-este-equipo-da', tipo: 'texto', origen: 'I14', label: '¿Cuál es la solución que solo este equipo puede dar?' },
    ] },
  { id: 'm5c3', etapa: 'pas', despuesDe: '9.4', titulo: 'La promesa a los colaboradores',
    campos: [
      { id: 'en-que-se-convierte-quien-trabaja-aqui', tipo: 'texto', origen: 'I7', label: '¿En qué se convierte una persona que trabaja aquí? ¿Qué se lleva aunque un día se vaya?' },
    ] },
  { id: 'm5c4', etapa: 'pas', despuesDe: '9.4', titulo: 'La promesa a los clientes',
    campos: [
      { id: 'que-le-resuelve-al-cliente', tipo: 'texto', origen: 'I4', label: 'Cuando un cliente los elige en vez del competidor, ¿qué le resuelve más allá de la compra o del servicio?' },
      { id: 'cliente-que-enorgullece', tipo: 'texto', origen: 'I5', label: 'Descríbeme un cliente real que te enorgullece atender. Con nombre.' },
      { id: 'que-perderia-ese-cliente', tipo: 'texto', origen: 'I6', label: 'Si ustedes no existieran, ¿qué perdería ese cliente?' },
    ] },
  { id: 'm5c5', etapa: 'pas', despuesDe: '9.4', titulo: 'La promesa a los accionistas',
    campos: [
      { id: 'que-les-devuelve-el-negocio', tipo: 'texto', origen: 'I8', label: 'Más allá de la utilidad, ¿qué les devuelve este negocio a ustedes como socios o como familia?' },
    ] },
  { id: 'm5c6', etapa: 'pas', despuesDe: '9.4', titulo: 'Los valores en acción',
    campos: [
      { id: 'lo-que-no-aceptarian-nunca', tipo: 'texto', origen: 'I9', label: '¿Qué no aceptarían nunca, aunque les costara ventas o aunque les pagaran por ello?' },
      { id: 'conducta-que-exigen-y-reconocen', tipo: 'texto', origen: 'I10', label: '¿Qué conducta exigen y reconocen todos los días?' },
      { id: 'al-estilo-de-la-casa', tipo: 'texto', origen: 'I11', label: 'Cuando alguien hace las cosas bien hechas al estilo de la casa, ¿qué hace exactamente que otro no haría?' },
    ] },
  // ⚠️ Los dos últimos campos dicen «NUEVO» en su origen: no salen de los Cuestionarios sino de
  // la reescritura del módulo 5 con el feedback del 12/08. Se cargan porque el relevo los
  // incluye y porque son el «Plan de comunicación» de la plantilla P9 de la planilla.
  { id: 'm5c7', etapa: 'pas', despuesDe: '9.6', titulo: 'Cómo se lo cuentas al equipo',
    campos: [
      { id: 'te-las-creerian', tipo: 'texto', origen: 'I15', label: 'Lee tus respuestas en voz alta imaginando a tu equipo enfrente. ¿Te las creerían? ¿Qué parte no?' },
      { id: 'sigue-siendo-verdad-si-crecen', tipo: 'texto', origen: 'I16', label: '¿Todo lo que escribiste sigue siendo verdad si mañana abren otra plaza, otra línea u otro formato?' },
      { id: 'quien-lo-dice-y-en-que-foro', tipo: 'texto', origen: 'NUEVO (sin pregunta en ninguno de los dos cuestionarios)', label: '¿Quién lo dice, en qué foro y con qué ritual?' },
      { id: 'como-se-ancla-en-la-junta-semanal', tipo: 'texto', origen: 'NUEVO (sin pregunta en ninguno de los dos cuestionarios)', label: '¿Cómo se ancla en la junta semanal?' },
    ] },
  // ── norte ──
  { id: 'm4c1', etapa: 'norte', despuesDe: '4.2', titulo: 'La MCI 1, el resultado',
    campos: [
      { id: 'problema-numero-uno', tipo: 'linea', origen: 'G1', label: '¿Cuál es hoy el problema número uno del negocio, en una frase?' },
      { id: 'una-sola-cosa-en-90-dias', tipo: 'linea', origen: 'G2', label: 'Si pudieras arreglar una sola cosa en noventa días, ¿cuál sería?' },
      { id: 'numero-del-ano', tipo: 'linea', origen: 'G3 · B0.1', label: 'El número del año. Completa: "pasar de ___ a ___ para el ___".', ayuda: 'Puede ser margen, utilidad, ingreso originado por el sistema, tiendas sobre punto de equilibrio, lo que corresponda a tu negocio.', obligatorio: true },
      { id: 'base-y-quien-la-calcula', tipo: 'linea', origen: 'G3', label: 'Anota de dónde sale la base y quién la calcula.', obligatorio: true },
      { id: 'historico-respalda-el-numero', tipo: 'texto', origen: 'G4', label: '¿El histórico respalda ese número? ¿Lo lograste alguna vez o lo logró alguien comparable?', ayuda: 'Si no, bájalo. Una meta que el equipo cree imposible normaliza el rojo.' },
    ] },
  { id: 'm4c2', etapa: 'norte', despuesDe: '4.2', titulo: 'La MCI 2, el criterio',
    campos: [
      { id: 'que-tiene-que-ser-cierto-del-equipo', tipo: 'texto', origen: 'G5', label: '¿Qué tiene que ser cierto de tu equipo para que ese número se sostenga el año siguiente sin ti?', obligatorio: true },
      { id: 'mci-2-redaccion', tipo: 'linea', origen: 'G5 · B0.2', label: 'Escríbelo como "pasar de un equipo que ___ a un equipo que ___ para el ___".', obligatorio: true },
      { id: 'verificacion-de-las-dos-mcis', tipo: 'checks', origen: 'B0.3', label: 'Verificación. Marca cada una:', opciones: ['¿La MCI 2 está redactada sobre lo que el equipo se adueña, y no sobre lo que el dueño deja de hacer? Un equipo no puede ganar "el director trabaja menos".', '¿La MCI 1 tiene base real, con fuente y con responsable del dato?', '¿Son dos y no tres? Si hay tres, colapsa las que sirven al mismo propósito.', '¿El equipo cree que son alcanzables? Si no, se baja la cifra sin bajar la exigencia.', '¿Si se logra la 1 sin la 2, se cae al año siguiente? Si la respuesta es no, la 2 está mal planteada.'] },
    ] },
  { id: 'm4c3', etapa: 'norte', despuesDe: '4.3', titulo: 'El objetivo de cada área',
    campos: [
      // era «Por cada área que listaste en A5…» (A5 = la tabla de áreas de m1c2, en la etapa Contexto).
      { id: 'objetivo-por-area', tipo: 'tabla', origen: 'G6', label: 'Por cada área que ya listaste, llena esta tabla:', ayuda: 'La última columna importa. Si el área no lo calcula hoy, no se puede exigir la semana que entra.', columnas: ['Área', 'Qué sostiene para que el negocio gane', 'Su número', 'Base real hoy', 'Fuente', 'Quién rinde cuentas', '¿El área ya lo calcula hoy?'], obligatorio: true },
      { id: 'area-que-tumba-el-frente', tipo: 'texto', origen: 'G7', label: '¿Qué área, aunque no venda, puede hacer que el resultado del frente se caiga?', ayuda: 'Esas también necesitan número propio.' },
    ] },
  // ── criterio ──
  { id: 'm2c2', etapa: 'criterio', despuesDe: '5.3', titulo: 'Las decisiones que te suben',
    campos: [
      { id: 'decisiones-que-te-suben', tipo: 'tabla', origen: 'D2', label: 'Llena esta tabla con las decisiones que te suben cada semana y que alguien más debería estar tomando. Mínimo ocho renglones.', ayuda: 'Las últimas tres columnas son el criterio. Si solo puedes llenar la tercera, esa decisión tiene estándar pero no tiene criterio, y por eso sigue subiendo a ti.', columnas: ['Decisión que se repite', 'Hoy la toma', 'Qué resultado se espera', 'Cómo se logra', 'Qué hacer cuando no se logra'], filasMin: 8, obligatorio: true },
      { id: 'donde-se-detiene-tu-equipo', tipo: 'tabla', origen: 'D3', label: 'Esta se la haces a tu equipo, no la contestes tú. Pregúntale a cada responsable de área: «en tu camino a tu número, ¿en qué punto te detienes porque no sabes qué decidir, o decides y luego te corrigen?». Anota las respuestas textuales.', columnas: ['Responsable de área', 'Respuesta textual'], obligatorio: true },
    ] },
  { id: 'm9c1', etapa: 'criterio', despuesDe: '5.4', titulo: 'Qué puede decidir sin consultarte',
    campos: [
      { id: 'gasto', tipo: 'numero', origen: 'B7.4', label: 'Hasta cuánto de gasto', ayuda: 'Si esta sección queda vacía, nada de lo anterior va a funcionar, porque el líder seguirá escalando.', obligatorio: true },
      { id: 'tipo-de-decision', tipo: 'texto', origen: 'B7.4', label: 'Qué tipo de decisión', obligatorio: true },
      { id: 'situaciones', tipo: 'texto', origen: 'B7.4', label: 'En qué situaciones', obligatorio: true },
    ] },
  { id: 'm9c2', etapa: 'criterio', despuesDe: '5.4', titulo: 'Qué sí te tiene que escalar',
    campos: [
      { id: 'lo-que-si-me-tienes-que-escalar', tipo: 'texto', origen: 'B7.5', label: 'Lo que sí me tienes que escalar', ayuda: 'Corto y específico. Todo lo que no esté aquí no se escala.', obligatorio: true },
    ] },
  { id: 'm9c3', etapa: 'criterio', despuesDe: '5.4', titulo: 'Qué vas a poner de tu lado',
    campos: [
      { id: 'lo-que-yo-te-voy-a-dar', tipo: 'texto', origen: 'B7.6', label: 'Lo que yo te voy a dar', ayuda: 'Presupuesto, gente, capacitación, decisiones que dependen del dueño, con fecha. El accountability es de dos lados.', obligatorio: true },
    ] },
  { id: 'm9c4', etapa: 'criterio', despuesDe: '5.4', titulo: 'Qué pasa cuando no se logra',
    campos: [
      { id: 'como-se-ve-perder', tipo: 'texto', origen: 'B7.7', label: 'Cómo se ve perder, y qué pasa entonces', ayuda: 'Qué hacemos cuando el número no se logra dos semanas seguidas. Se define antes, en frío, no en la junta donde ya pasó.', obligatorio: true },
    ] },
  { id: 'm2c5', etapa: 'criterio', despuesDe: '5.6', titulo: 'Cuánto estás dispuesto a que baje',
    campos: [
      { id: 'actividades-de-la-cartera-5', tipo: 'tabla', origen: 'E6', label: 'Por cada actividad recurrente de la cartera 5, contesta tres cosas:', columnas: ['Actividad', '¿Solo la puedes hacer tú, o solo la estás haciendo tú?', 'Si la hiciera otro, ¿qué es lo peor que puede pasar y lo puedes vivir?', '¿Qué le falta a esa persona: información, autoridad, habilidad o criterio?'], obligatorio: true },
      { id: 'cuanto-estas-dispuesto-a-resistir', tipo: 'linea', origen: 'E7', label: 'Si soltar una actividad hace que el resultado baje temporalmente, ¿lo aceptas? Pon el número que estás dispuesto a resistir y por cuánto tiempo.', ayuda: 'Si no lo defines ahora, a la tercera semana todo regresa a como estaba.', obligatorio: true },
    ] },
  // ── palancas ──
  { id: 'm6c1', etapa: 'palancas', despuesDe: '6.1', titulo: 'Para qué existe esta área',
    campos: [
      { id: 'area-y-responsable', tipo: 'linea', origen: '1.1', label: 'Nombre del área y de quien rinde cuentas por ella.', ayuda: 'Un nombre, no un puesto compartido.', obligatorio: true },
      { id: 'mci-a-la-que-sirve', tipo: 'checks', origen: '1.2', label: '¿A cuál de las dos MCIs sirve esta área?', ayuda: 'Puede ser a una o a las dos.', opciones: ['MCI 1', 'MCI 2'], obligatorio: true },
      { id: 'como-sirve-a-la-mci', tipo: 'linea', origen: '1.2', label: 'Explica cómo en una línea.', obligatorio: true },
      { id: 'numero-que-moveria', tipo: 'texto', origen: '1.3', label: 'Si esta área hiciera todo perfecto durante un trimestre, ¿qué número de la MCI se movería y aproximadamente cuánto?', ayuda: 'Si no sabes contestar esto, el área todavía no tiene claro para qué existe dentro del plan.', obligatorio: true },
      { id: 'que-se-cae-si-falla', tipo: 'texto', origen: '1.4', label: 'Si esta área falla, ¿qué se cae en el frente que sí vende?', ayuda: 'Esta pregunta es la que justifica que las áreas habilitadoras tengan tablero propio.', obligatorio: true },
    ] },
  { id: 'm6c2', etapa: 'palancas', despuesDe: '6.1', titulo: 'Qué te está pidiendo el frente',
    campos: [
      { id: 'pedido-del-frente', tipo: 'texto', origen: '1.5', label: '¿Qué te está pidiendo hoy el frente a esta área y no está recibiendo?', ayuda: 'Pregúntaselo al gerente operativo o al responsable comercial, no al área misma.', obligatorio: true },
    ] },
  { id: 'm6c5', etapa: 'palancas', despuesDe: '6.1', titulo: 'El número del área, con su base y su fuente',
    campos: [
      { id: 'que-sostiene-el-area', tipo: 'linea', origen: '2.1', label: '¿Qué sostiene esta área para que el negocio gane? En una línea, con verbo.', obligatorio: true },
      { id: 'cual-es-su-numero', tipo: 'linea', origen: '2.2', label: '¿Cuál es su número? El indicador consecuencia que dirá si lo sostuvo o no.', obligatorio: true },
      { id: 'base-real-hoy', tipo: 'tabla', origen: '2.3', label: '¿Cuál es la base real hoy? Con cifra, periodo y fuente.', columnas: ['Cifra', 'Periodo', 'Fuente'], obligatorio: true },
      { id: 'meta-y-para-cuando', tipo: 'texto', origen: '2.4', label: '¿Cuál es la meta y para cuándo?', ayuda: 'Si no hay base confiable, escribe la meta como hipótesis y anota quién consigue el dato y para qué fecha.', obligatorio: true },
      { id: 'frecuencia-de-cierre', tipo: 'eleccion', origen: '2.5', label: '¿Con qué frecuencia se puede cerrar este número?', opciones: ['Diaria', 'Semanal', 'Mensual'], obligatorio: true },
      { id: 'ya-lo-calcula-el-area', tipo: 'texto', origen: '2.6', label: '¿El área ya calcula este número hoy en su operación normal, o habría que inventar un reporte nuevo? Si hay que inventarlo, quién lo va a calcular y con qué herramienta.', ayuda: 'El tablero recibe cifras que el área ya cierra. No se construyen reportes nuevos dentro del tablero ni se convierte en sistema contable.', obligatorio: true },
      { id: 'a-que-mci-se-conecta', tipo: 'texto', origen: '2.7', label: '¿A qué MCI se conecta y por qué vía?', obligatorio: true },
    ] },
  { id: 'm6c3', etapa: 'palancas', despuesDe: '6.2', titulo: 'Elegir las palancas',
    campos: [
      { id: 'enunciado-de-la-palanca', tipo: 'linea', origen: '3.1', label: 'Enuncia la palanca con verbo y objeto.', ayuda: 'No una categoría, una conducta o un estándar concreto.', obligatorio: true },
      { id: 'filtro-de-cuatro', tipo: 'tabla', origen: '3.2', label: 'Filtro de cuatro. Si falla una sola, la palanca no entra', columnas: ['Pregunta', 'Sí / No'], filasFijas: ['¿Predice el resultado? Si se hace bien un mes, ¿el LAG se mueve?', '¿Lo controla el equipo? Prueba de la coartada: ¿puede culpar a un externo?', '¿Se puede medir al menos semanal?', '¿Es hoy un cuello de botella real, o ya lo hacen bien?'], obligatorio: true },
      { id: 'estandar-que-ya-opera', tipo: 'texto', origen: '3.3', label: 'Si la cuarta salió "ya lo hacen bien", la palanca no es palanca, es un estándar que ya opera. Anótalo como estándar y sácalo del tablero.' },
      { id: 'palanca-repetida-en-otra-area', tipo: 'texto', origen: '3.4', label: '¿Esta palanca ya aparece en otra área con otro nombre?', ayuda: 'Si sí, se queda en una sola, con el responsable que realmente la puede mover.', obligatorio: true },
    ] },
  { id: 'm6c4', etapa: 'palancas', despuesDe: '6.3', titulo: 'La ficha de nueve campos',
    campos: [
      { id: 'ficha-de-palanca', tipo: 'tabla', origen: 'BLOQUE 4', label: 'Ficha de palanca', ayuda: 'Nueve campos. Una palanca sin los nueve no se programa: entra al tablero marcada como pendiente de definición.', columnas: ['Campo', 'Respuesta'], filasFijas: ['Nombre de la palanca, verbo y objeto', 'Cómo se mide: numerador y denominador explícitos', 'Frecuencia: diaria, por turno, semanal', 'Hora de corte, a qué hora vence', 'Unidad de medición: por punto, por persona, por proyecto, por turno', 'Umbral verde', 'Umbral amarillo', 'Umbral rojo', 'Responsable que rinde cuentas, un nombre', 'Catálogo o formato que hace falta para que funcione'], obligatorio: true },
    ] },
  { id: 'm8c1', etapa: 'palancas', despuesDe: '7.2', titulo: 'Los umbrales de cada objetivo',
    campos: [
      { id: 'nivel-ya-logrado', tipo: 'linea', origen: '5.1', label: '¿Qué nivel ya lograste alguna vez?' },
      { id: 'nivel-exigente-alcanzable', tipo: 'linea', origen: '5.2', label: '¿Qué nivel te parece exigente pero alcanzable con lo que tienes hoy, sin gente nueva y sin presupuesto nuevo?' },
      { id: 'que-tendria-que-pasar-para-caerse', tipo: 'texto', origen: '5.3', label: '¿Qué tendría que pasar para que esto se caiga?' },
      { id: 'incumplimiento-inadmisible', tipo: 'texto', origen: '5.4', label: '¿Hay algún caso donde el incumplimiento sea inadmisible, por seguridad, legal o pérdida de cliente?' },
    ] },
  // ── tablero ──
  { id: 'm7c1', etapa: 'tablero', despuesDe: '7.3', titulo: 'Qué prueba que se hizo',
    campos: [
      { id: 'que-prueba-que-se-hizo', tipo: 'eleccion', origen: '6.1', label: '¿Qué prueba que se hizo?', opciones: ['Foto', 'Checklist', 'Formulario', 'Lectura', 'Registro en sistema', 'Entregable'], obligatorio: true },
      { id: 'de-donde-sale-el-dato-duro', tipo: 'eleccion', origen: '6.6', label: '¿De dónde sale el dato duro?', opciones: ['Punto de venta', 'CRM', 'Cierre contable', 'Nómina', 'Captura manual'], obligatorio: true },
    ] },
  { id: 'm7c2', etapa: 'tablero', despuesDe: '7.3', titulo: 'Si es foto, de qué exactamente',
    campos: [
      { id: 'si-es-foto', tipo: 'texto', origen: '6.2', label: 'Si es foto: ¿de qué exactamente, desde qué ángulo, y qué la hace aprobada o rechazada?', obligatorio: true },
    ] },
  { id: 'm7c3', etapa: 'tablero', despuesDe: '7.3', titulo: 'Quién sube y quién valida',
    campos: [
      { id: 'capturas-por-dia', tipo: 'texto', origen: '6.3', label: '¿Cuántas capturas por día y en qué momentos?', obligatorio: true },
      { id: 'quien-sube-y-quien-valida', tipo: 'linea', origen: '6.4', label: '¿Quién sube y quién valida?', ayuda: 'Pueden ser la misma persona solo si el dato viene de un sistema.', obligatorio: true },
      { id: 'conservacion-de-la-evidencia', tipo: 'linea', origen: '6.5', label: '¿Cuánto tiempo se conserva la evidencia?', ayuda: 'Sugerido: cuatro semanas, con el semáforo ya guardado.', obligatorio: true },
      { id: 'cuanto-tarda-en-subirlo', tipo: 'linea', origen: '6.7', label: '¿Cuánto tiempo le toma a la persona subir esto?', ayuda: 'Si pasa de dos minutos, hay que simplificarlo o no lo va a hacer.', obligatorio: true },
    ] },
  // ── ritmo ──
  // ⚠️ Los tres de ritmo son la junta SEMANAL (B8.1-B8.4 del Cuestionario de Objetivos). El
  // catálogo viejo los había rotulado «diaria» / «semanal» / «uno a uno» al reestructurar el
  // módulo sin tocar sus campos: el título decía una junta y las preguntas, otra.
  // era «Diseñando la junta diaria».
  { id: 'm10c1', etapa: 'ritmo', despuesDe: '8.3', titulo: 'La junta semanal de tu área',
    campos: [
      { id: 'dia-y-hora', tipo: 'linea', origen: 'B8.1', label: '¿Qué día y a qué hora es la junta semanal de esta área?', ayuda: 'Fija, no movible.', obligatorio: true },
      { id: 'quien-asiste', tipo: 'texto', origen: 'B8.2', label: '¿Quién asiste?', ayuda: 'Solo quienes rinden cuentas de estos números.', obligatorio: true },
      { id: 'cuanto-dura', tipo: 'numero', origen: 'B8.3', label: '¿Cuánto dura?', ayuda: 'Entre veinte y cuarenta minutos por área. Si dura más, se está resolviendo operación en lugar de rendir cuentas.' },
    ] },
  { id: 'm10c2', etapa: 'ritmo', despuesDe: '8.3', titulo: 'Diseñando la junta semanal',
    campos: [
      { id: 'guion-cuatro-pasos', tipo: 'checks', origen: 'B8 · Guion', label: 'Guion de la junta, cuatro pasos', opciones: ['Rendir cuentas del compromiso de la semana pasada. Se cumplió o no se cumplió. No hay explicaciones aquí.', 'Revisar el marcador. Solo los rojos y los amarillos. Los verdes se mencionan en una línea.', 'Despejar obstáculos. Aquí es donde el líder pide y el dueño da criterio, no soluciones.', 'Comprometer una acción para la semana que entra. Una, concreta, con fecha.'] },
    ] },
  // era «Diseñando la junta uno a uno»: su único campo es el 20% del dueño EN LA SEMANAL.
  { id: 'm10c3', etapa: 'ritmo', despuesDe: '8.7', titulo: 'Cuánto hablas en la semanal',
    campos: [
      { id: 'dueno-menos-del-veinte', tipo: 'texto', origen: 'B8.4', label: '¿El dueño está hablando menos del veinte por ciento del tiempo?', ayuda: 'Es la única métrica de la junta que importa. Si habla más, la junta está reforzando la dependencia en vez de disolverla.', obligatorio: true },
    ] },
  // ── instalado ──
  { id: 'm2c4', etapa: 'instalado', despuesDe: '10.1', titulo: 'Lo que no está pasando',
    campos: [
      { id: 'lo-que-no-esta-pasando', tipo: 'texto', origen: 'E2', label: '¿Qué no está pasando en tu negocio porque tú no tuviste tiempo de hacerlo? La alianza que no cerraste, la línea que no lanzaste, la conversación que no tuviste, el mercado que no exploraste.', ayuda: 'Esta es la pregunta más importante del bloque.', obligatorio: true },
      { id: 'descripcion-de-tu-puesto', tipo: 'texto', origen: 'E3', label: 'Si el negocio corriera solo tres meses, ¿en qué usarías ese tiempo? Escríbelo como si fuera la descripción de tu puesto.', obligatorio: true },
    ] },
  { id: 'm2c3', etapa: 'instalado', despuesDe: '10.4', titulo: 'Tu agenda real',
    campos: [
      { id: 'que-te-quita-mas-tiempo', tipo: 'texto', origen: 'E1', label: '¿Qué te quita más tiempo hoy? Con nombre de actividad, no en categorías.', obligatorio: true },
      { id: 'agenda-real-dos-semanas', tipo: 'tabla', origen: 'E4', label: 'Registra dos semanas de tu agenda real, no la ideal, y clasifica cada bloque en una de estas cinco carteras:', columnas: ['Cartera', 'Qué incluye', 'Horas semana 1', 'Horas semana 2'], filasFijas: ['1 · Dirección', '2 · Crecimiento', '3 · Innovación', '4 · Gente y cultura', '5 · Operación'], obligatorio: true },
      { id: 'porcentaje-carteras-1-a-4', tipo: 'linea', origen: 'E5', label: '¿Qué porcentaje de tu tiempo está hoy en las carteras 1 a 4? ¿Qué porcentaje quieres tener y para cuándo?', obligatorio: true },
    ] },
  // era «Las dos primeras semanas» (el video viejo: el tablero recibiendo captura real). Su campo
  // es la «Auditoría de vinculación» del Cuestionario de Objetivos, y se titula así.
  // ⚠️ Su ayuda dice «Se corren antes de programar nada» y el relevo la reparte en la ÚLTIMA
  // etapa, cuando el tablero ya corre. Se respetó el reparto; encaja mejor al cerrar palancas.
  { id: 'm11c2', etapa: 'instalado', despuesDe: '11.3', titulo: 'Auditoría de vinculación',
    campos: [
      { id: 'auditoria-de-vinculacion', tipo: 'checks', origen: 'Auditoría de vinculación', label: 'Seis verificaciones sobre la matriz completa', ayuda: 'Se corren antes de programar nada.', opciones: ['Área sin ningún objetivo vinculado a una MCI.', 'MCI sin ninguna área que la sirva.', 'Objetivo con más de tres palancas.', 'Palanca repetida en dos áreas con distinto nombre.', 'Responsable que no tiene autoridad para mover lo que se le está midiendo.', 'Área habilitadora crítica sin objetivo propio.'] },
    ] },
];

/** El campo como lo guarda curso_clases (la forma de `Campo` en lib/curso.ts): sin `origen`. */
const sinOrigen = (c: CampoConOrigen): Campo =>
  Object.fromEntries(Object.entries(c).filter(([k]) => k !== 'origen')) as Campo;

const porNumero = (a: Video, b: Video): number => {
  const [fa, va] = numeroDe(a.n);
  const [fb, vb] = numeroDe(b.n);
  return fa - fb || va - vb;
};

/** Cada cuánto va el `orden`: con hueco, para que Mauricio pueda meter una clase en el medio. */
const PASO_ORDEN = 10;

/**
 * El curso entero, en el orden de cada etapa: la logística arriba de bienvenida, y en cada
 * etapa sus videos por fase y número, con cada formulario detrás del video de su bloque.
 * Tira si una etapa queda sin Demostración (no tendría con qué cerrarse) o si un formulario
 * apunta a un video que no está en su etapa (se perdería en silencio).
 */
export function programaNqe(): ClaseSemilla[] {
  const porEtapa = new Map<EtapaNqe, Video[]>(ETAPAS_NQE.map((e) => [e, []]));
  for (const v of [...PLANILLA].sort(porNumero)) porEtapa.get(etapaDeVideo(v.n))!.push(v);

  const out: ClaseSemilla[] = [];
  for (const etapa of ETAPAS_NQE) {
    const videos = porEtapa.get(etapa)!;
    const cierre = [...videos].reverse().find((v) => v.tipo === 'D');
    if (!cierre) throw new Error(`La etapa ${etapa} no tiene Demostración: no tendría con qué cerrarse.`);

    let orden = 0;
    const sumar = (c: Omit<ClaseSemilla, 'etapa' | 'orden' | 'video_tipo'>) => {
      orden += PASO_ORDEN;
      out.push({ ...c, etapa, orden, video_tipo: 'ninguno' });
    };

    if (etapa === 'bienvenida') {
      sumar({ origen: LOGISTICA.origen, titulo: LOGISTICA.titulo, descripcion: LOGISTICA.descripcion, tipo: 'clase', minutos: null, tarea: '', campos: [], obligatoria: false });
    }
    for (const v of videos) {
      sumar({
        origen: `planilla:${v.n}`, titulo: v.titulo, descripcion: descripcionDe(v), tipo: TIPO[v.tipo],
        minutos: v.min, tarea: v.cierre, campos: [], obligatoria: v === cierre,
      });
      for (const f of FORMULARIOS) {
        if (f.etapa !== etapa || f.despuesDe !== v.n) continue;
        sumar({
          origen: `catalogo:${f.id}`, titulo: f.titulo, descripcion: '', tipo: 'formulario',
          minutos: null, tarea: '', campos: f.campos.map(sinOrigen), obligatoria: false,
        });
      }
    }
  }

  const cargados = new Set(out.map((c) => c.origen));
  const perdidos = FORMULARIOS.filter((f) => !cargados.has(`catalogo:${f.id}`)).map((f) => `${f.id} → ${f.etapa}/${f.despuesDe}`);
  if (perdidos.length) throw new Error(`Formularios anclados a un video que no está en su etapa: ${perdidos.join(', ')}`);
  return out;
}
