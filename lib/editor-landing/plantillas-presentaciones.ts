// =============================================================================
// editor-landing/plantillas-presentaciones — las presentaciones para arrancar (T3)
// =============================================================================
// Pedido de Martín (11/10/2026, tanda 2, punto 5): «Falta la funcionalidad de crear
// presentaciones, no solo landings... Diapositivas, tal cual como lo hace gamma.» Y el 6:
// «deberías hacer más templates de presentaciones». Decisión T3 de
// docs/diseno-editor-landing.md: ~12 plantillas propias (pitch, propuesta comercial, informe
// mensual, caso de éxito, onboarding de cliente, plan de marketing, webinar, clase de curso,
// roadmap, equipo, ventas, reporte de resultados).
//
// La MISMA forma que `PLANTILLAS` (plantillas.ts) —{ id, nombre, descripcion, categoria, tema,
// contenido() }— más el formato que la pantalla de crear tiene que mandar en `config`
// (`formato: 'presentacion'`, `proporcion`): una presentación creada sin eso nace como página.
//
// Cada diapositiva es UNA idea, con poco texto y un diseño optimizado cuando se puede (lo que
// pide T3 también a la IA: `REGLAS_DIAPOSITIVAS_*`, abajo). Las reglas del copy son las de
// plantillas.ts, por los mismos motivos:
//   · español NEUTRO (tú): el guard de voseo barre lib/;
//   · HUECOS ENTRE CORCHETES para todo lo que es del negocio («[Tu empresa]», «[00]%»): un
//     marcador se ve como lo que es, un dato de ejemplo se lee como un dato (AGENTS.md);
//   · ningún nombre de una persona o de un negocio real (lo frena
//     tests/editor-landing-presentaciones.test.ts);
//   · sin cifras, testimonios ni logos inventados; sin gráficos con números de mentira (una
//     tabla con marcadores dice lo mismo sin afirmar nada);
//   · las imágenes de acento quedan SIN CARGAR (el editor muestra el hueco para elegir).
// Todo pasa por la gramática de ia-bloques.ts (`bloquesATarjetas`): la misma validación que lo
// que escribe la IA, e ids nuevos en cada llamada.
// =============================================================================

import { nuevoId, docPagina, type LandingContenido, type Pagina } from './doc';
import { CONFIG_DEFAULT, type FormatoDoc, type Proporcion } from './api-tipos';
import { TEMAS } from './temas';
import {
  bloquesATarjetas, primerIcono,
  type TarjetaIA, type BloqueIA, type ItemOptimizadoIA,
} from './ia-bloques';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export const CATEGORIAS_PRESENTACION = ['Negocio', 'Ventas', 'Reportes', 'Clientes', 'Marketing', 'Formación', 'Equipo'] as const;
export type CategoriaPresentacion = (typeof CATEGORIAS_PRESENTACION)[number];

export type PlantillaPresentacion = {
  id: string;
  nombre: string;
  /** Una frase para la tarjeta de la pantalla de crear. */
  descripcion: string;
  categoria: CategoriaPresentacion;
  /** Id de TEMAS (lib/editor-landing/temas.ts). */
  tema: string;
  /** Lo que la pantalla de crear manda en `config` junto con el tema. */
  formato: Extract<FormatoDoc, 'presentacion'>;
  proporcion: Proporcion;
  /** El documento, con ids NUEVOS en cada llamada. */
  contenido: () => LandingContenido;
};

// ─────────────────────────────────────────────────────────────────────────────
// Lo que se le pega a la IA cuando el documento es una presentación (T3: «la IA genera
// diapositivas: menos texto, más diseños optimizados»). Viven acá y no en ia.ts porque ia.ts
// es server-only y ningún test lo puede importar; ia.ts las agrega a los slots que ya existen
// (`{{ajustes}}` y `{{texto}}`) sólo si `params.formato === 'presentacion'`.
// ─────────────────────────────────────────────────────────────────────────────

/** Para el ESQUEMA: qué es una diapositiva y cómo se arma una presentación. */
export const REGLAS_DIAPOSITIVAS_ESQUEMA = [
  'FORMATO: es una PRESENTACIÓN de diapositivas, no una landing. Cada sección del esquema es UNA diapositiva.',
  '- Una sola idea por diapositiva: si un tema no entra, se parte en dos diapositivas.',
  '- De 2 a 4 puntos cortos por diapositiva (una línea cada uno).',
  '- La primera es la portada (qué es y para quién); la última, el cierre con el próximo paso.',
  '- Sin formularios, sin preguntas frecuentes desplegables y sin llamados a comprar en cada diapositiva.',
].join('\n');

/** Para las SECCIONES: menos texto y más diseños optimizados, porque la diapositiva no crece. */
export const REGLAS_DIAPOSITIVAS_SECCIONES = [
  'Cada sección es una DIAPOSITIVA de tamaño fijo: lo que no entra se pierde al presentar.',
  'Una idea por diapositiva y poco texto: un título corto y, como mucho, unas 40 palabras fuera de los ítems.',
  'Prefiere los diseños optimizados (cajas, íconos con texto, etapas, línea de tiempo, números grandes, comparación) a los párrafos; de 3 a 5 ítems por diseño, cada ítem con un título de pocas palabras y una frase.',
  'Nada de formularios, desplegables, tablas largas ni más de un diseño optimizado por diapositiva.',
].join(' ');

/** Para EDITAR una presentación: lo que cambie sigue siendo una diapositiva. */
export const REGLAS_DIAPOSITIVAS_EDITAR = 'Es una PRESENTACIÓN: cada sección es una diapositiva de tamaño fijo, con una sola idea y poco texto; lo que agregues o cambies tiene que entrar en la diapositiva (si no entra, pártelo en dos).';

// ─────────────────────────────────────────────────────────────────────────────
// Ayudas para escribir las plantillas (las mismas formas que plantillas.ts)
// ─────────────────────────────────────────────────────────────────────────────

const IDS_TEMA = new Set<string>(TEMAS.map((t) => t.id));
const temaDe = (...candidatos: string[]): string => candidatos.find((c) => IDS_TEMA.has(c)) ?? CONFIG_DEFAULT.tema;

// Íconos por sinónimos: queda el primero que exista en iconos.ts (si el set cambia un nombre,
// el ítem se queda sin ícono en vez de guardar uno que no existe; el test lo dice).
const I = {
  rayo: ['rayo', 'fuego'],
  objetivo: ['objetivo', 'brujula'],
  reloj: ['reloj', 'cronometro'],
  calendario: ['calendario-check', 'calendario'],
  check: ['check', 'sello'],
  escudo: ['escudo', 'candado'],
  estrella: ['estrella', 'estrella-llena'],
  grafico: ['grafico', 'reporte'],
  tendencia: ['tendencia', 'grafico'],
  usuarios: ['usuarios', 'comunidad'],
  usuario: ['usuario', 'usuario-circulo'],
  chat: ['chat-texto', 'chat'],
  video: ['videollamada', 'video'],
  libro: ['libro', 'graduacion'],
  cohete: ['cohete'],
  dinero: ['dinero', 'monedas'],
  herramienta: ['herramienta', 'engranaje'],
  trofeo: ['trofeo', 'medalla'],
  archivo: ['portapapeles', 'archivo'],
  idea: ['bombilla', 'cerebro'],
  correo: ['mail', 'enviar'],
  mundo: ['mundo', 'globo'],
  alerta: ['advertencia', 'precaucion'],
  megafono: ['megafono', 'notificacion'],
  corazon: ['corazon', 'mano-corazon'],
  acuerdo: ['apreton', 'mano-corazon'],
  ruta: ['ruta', 'mapa'],
  flujo: ['flujo', 'conexiones'],
  bandera: ['bandera', 'objetivo'],
  llave: ['llave', 'candado'],
  telefono: ['telefono', 'llamada'],
  pizarra: ['pizarra', 'libro'],
} as const;
type NombreIcono = keyof typeof I;

const it = (titulo: string, texto = '', icono?: NombreIcono, extra: Partial<ItemOptimizadoIA> = {}): ItemOptimizadoIA => {
  const x: ItemOptimizadoIA = { titulo, texto, ...extra };
  const ic = icono ? primerIcono(...I[icono]) : undefined;
  if (ic) x.icono = ic;
  return x;
};
/** Un número grande con marcador (nunca una cifra inventada). */
const num = (valor: string, titulo: string, texto = ''): ItemOptimizadoIA => ({ titulo, texto, valor });

const titulo = (texto: string): BloqueIA => ({ t: 'titulo', texto });
const h2 = (texto: string): BloqueIA => ({ t: 'h2', texto });
const p = (texto: string): BloqueIA => ({ t: 'p', texto });
const pg = (texto: string): BloqueIA => ({ t: 'p-grande', texto });
const ante = (texto: string): BloqueIA => ({ t: 'antetitulo', texto });
const opt = (variante: Extract<BloqueIA, { t: 'optimizado' }>['variante'], items: ItemOptimizadoIA[], columnas?: number): BloqueIA => ({ t: 'optimizado', variante, items, ...(columnas ? { columnas } : {}) });
const lista = (...items: string[]): BloqueIA => ({ t: 'lista', items });
const tareas = (...items: string[]): BloqueIA => ({ t: 'tareas', items });
const tabla = (filas: string[][]): BloqueIA => ({ t: 'tabla', filas, encabezado: true });
const cita = (texto: string, autor: string): BloqueIA => ({ t: 'cita', texto, autor });

// Lo que la conversión corrigió o tiró al armar una plantilla. Una plantilla bien escrita no
// tiene NINGUNO: el test lo exige (`armarPresentacion`).
let colector: string[] | undefined;

/** Arma una plantilla y devuelve también lo que la conversión tuvo que corregir (para el test). */
export function armarPresentacion(pl: Pick<PlantillaPresentacion, 'contenido'>): { contenido: LandingContenido; descartes: string[] } {
  const previo = colector;
  const descartes: string[] = [];
  colector = descartes;
  try {
    return { contenido: pl.contenido(), descartes };
  } finally {
    colector = previo;
  }
}

/** Una presentación es UNA página (Gamma no tiene presentaciones multipágina). */
function presentacion(diapos: TarjetaIA[]): LandingContenido {
  const pagina: Pagina = { id: nuevoId('p'), titulo: 'Inicio', ruta: '', doc: docPagina(bloquesATarjetas(diapos, { descartes: colector })) };
  return { v: 1, paginas: [pagina] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Las 12 presentaciones
// ─────────────────────────────────────────────────────────────────────────────

const pitch = (): LandingContenido => presentacion([
  { diseno: 'derecha', bloques: [ante('[Nombre de tu empresa]'), titulo('[Lo que haces] para [a quién]'), pg('[Tu propuesta en una línea: el resultado que consigue tu cliente.]')], notas: 'Presenta la empresa en una frase. El resto de la presentación la demuestra.' },
  { bloques: [h2('El problema'), opt('iconos-texto', [it('[Primer dolor]', '[A quién le pasa y cuánto le cuesta]', 'alerta'), it('[Segundo dolor]', '[Qué intenta hoy y por qué no alcanza]', 'reloj'), it('[Tercer dolor]', '[Qué pierde si sigue igual]', 'dinero')])], notas: 'Un problema que el público reconozca. Si puedes, una cifra real del mercado.' },
  { diseno: 'izquierda', bloques: [h2('La solución'), pg('[Qué hace tu producto o servicio, en una frase.]'), lista('[Beneficio principal]', '[Segundo beneficio]', '[Lo que te distingue]')], notas: 'Muestra el producto. Mejor una imagen o una demo que un párrafo.' },
  { bloques: [h2('Cómo funciona'), opt('etapas-horizontales', [it('[Paso 1]', '[Qué hace el cliente]'), it('[Paso 2]', '[Qué haces tú]'), it('[Paso 3]', '[El resultado]')])], notas: 'Tres pasos alcanzan. Si hacen falta más, el proceso es demasiado complejo para un pitch.' },
  { bloques: [h2('El mercado'), opt('numeros-grandes', [num('[00]', '[Tamaño del mercado]', '[Fuente del dato]'), num('[00]', '[Clientes posibles]', '[Cómo lo calculaste]'), num('[00]%', '[Crecimiento anual]', '[Fuente del dato]')])], notas: 'Sólo datos con fuente. Si no la tienes, saca la diapositiva.' },
  { bloques: [h2('Modelo de negocio'), opt('cajas-iconos', [it('Cómo cobras', '[Suscripción, por proyecto, por unidad…]', 'dinero'), it('Precio', '[Tu precio y qué incluye]', 'objetivo'), it('Quién paga', '[El comprador y por qué decide]', 'usuario')])] },
  { bloques: [h2('Tracción'), opt('tiempo-horizontal', [it('[Fecha]', '[Primer hito]'), it('[Fecha]', '[Segundo hito]'), it('[Fecha]', '[Dónde estás hoy]')])], notas: 'Lo que ya pasó, con fechas. Clientes, ventas o usuarios reales.' },
  { bloques: [h2('El equipo'), opt('nombre-rol', [it('[Nombre]', '[Rol · experiencia clave]'), it('[Nombre]', '[Rol · experiencia clave]'), it('[Nombre]', '[Rol · experiencia clave]')])] },
  { fondo: 'acento', bloques: [h2('Lo que buscamos'), pg('[Monto, socio o acuerdo que pides] para [lo que vas a lograr con eso].'), p('[Tu nombre] · [tu correo] · [tu teléfono]')], notas: 'Cierra con un pedido concreto y deja tu contacto en pantalla.' },
]);

const propuestaComercial = (): LandingContenido => presentacion([
  { diseno: 'derecha', bloques: [ante('Propuesta para [nombre del cliente]'), titulo('[El resultado que van a conseguir juntos]'), p('[Tu empresa] · [Fecha]')], notas: 'La portada nombra al cliente y el resultado, no tu servicio.' },
  { bloques: [h2('Lo que entendimos'), opt('cajas-delineadas', [it('Situación actual', '[Cómo está hoy el cliente]'), it('El reto', '[Lo que le impide avanzar]'), it('Lo que espera', '[Cómo se ve el éxito para él]')])], notas: 'Repite con sus palabras lo que te contó. Si asiente, ya ganaste la mitad.' },
  { bloques: [h2('Objetivos'), opt('iconos-texto', [it('[Objetivo 1]', '[Cómo lo vamos a medir]', 'objetivo'), it('[Objetivo 2]', '[Cómo lo vamos a medir]', 'tendencia'), it('[Objetivo 3]', '[Cómo lo vamos a medir]', 'check')])] },
  { bloques: [h2('La propuesta'), opt('cajas-numeros', [it('[Entregable 1]', '[Qué incluye]'), it('[Entregable 2]', '[Qué incluye]'), it('[Entregable 3]', '[Qué incluye]')])], notas: 'Lo que entregas, no las horas. Cada entregable responde a un objetivo.' },
  { bloques: [h2('Cronograma'), opt('tiempo-horizontal', [it('Semana [1]', '[Arranque y diagnóstico]'), it('Semana [2-4]', '[Implementación]'), it('Semana [5]', '[Entrega y ajustes]')])] },
  { bloques: [h2('Inversión'), opt('lado-a-lado', [it('[Opción esencial]', '[Precio] · [Qué incluye]'), it('[Opción completa]', '[Precio] · [Qué incluye]', undefined, { destacado: true })])], notas: 'Dos opciones como mucho. Marca la que recomiendas.' },
  { bloques: [h2('Por qué nosotros'), opt('vinetas-iconos', [it('[Experiencia relevante]', '[Un dato verificable]', 'trofeo'), it('[Cómo trabajamos]', '[Lo que hace distinto el proceso]', 'herramienta'), it('[Garantía o compromiso]', '[Qué pasa si no se cumple]', 'escudo')])] },
  { fondo: 'acento', bloques: [h2('Próximos pasos'), opt('vinetas-numeradas', [it('Confirmas la opción elegida'), it('Firmamos el acuerdo'), it('Agendamos el arranque')])], notas: 'Termina con una fecha concreta para la decisión.' },
]);

const informeMensual = (): LandingContenido => presentacion([
  { diseno: 'derecha', bloques: [ante('Informe mensual'), titulo('[Mes y año]'), p('[Área o proyecto] · [Quién presenta]')] },
  { bloques: [h2('El mes en tres números'), opt('numeros-grandes', [num('[00]', '[Métrica principal]', '[Contra el mes anterior]'), num('[00]', '[Segunda métrica]', '[Contra el objetivo]'), num('[00]%', '[Tercera métrica]', '[Qué significa]')])], notas: 'Si sólo ven esta diapositiva, tienen que entender cómo fue el mes.' },
  { bloques: [h2('Métricas del mes'), tabla([['Métrica', 'Mes anterior', 'Este mes', 'Objetivo'], ['[Métrica 1]', '[00]', '[00]', '[00]'], ['[Métrica 2]', '[00]', '[00]', '[00]'], ['[Métrica 3]', '[00]', '[00]', '[00]']])] },
  { bloques: [h2('Lo que funcionó y lo que no'), opt('pros-contras', [it('Funcionó', '[Qué salió bien y por qué]'), it('No funcionó', '[Qué salió mal y por qué]')])], notas: 'Con la causa de cada cosa. Sin causa es una lista de deseos.' },
  { bloques: [h2('Aprendizajes'), opt('cajas-iconos', [it('[Aprendizaje 1]', '[Qué vamos a hacer distinto]', 'idea'), it('[Aprendizaje 2]', '[Qué vamos a hacer distinto]', 'idea'), it('[Aprendizaje 3]', '[Qué vamos a hacer distinto]', 'idea')])] },
  { bloques: [h2('Prioridades del próximo mes'), opt('vinetas-numeradas', [it('[Prioridad 1]', '[Responsable · fecha]'), it('[Prioridad 2]', '[Responsable · fecha]'), it('[Prioridad 3]', '[Responsable · fecha]')])] },
  { fondo: 'acento', bloques: [h2('Lo que necesitamos'), opt('vinetas-iconos', [it('[Decisión o recurso]', '[Para qué y para cuándo]', 'bandera'), it('[Bloqueo a destrabar]', '[Quién lo puede destrabar]', 'llave')])], notas: 'Cierra con lo que pides al equipo o a la dirección.' },
]);

const casoExito = (): LandingContenido => presentacion([
  { diseno: 'fondo', superposicion: 'oscura', bloques: [ante('Caso de éxito'), titulo('Cómo [nombre del cliente] logró [resultado]'), p('[Industria] · [País o ciudad]')], notas: 'Pide permiso al cliente antes de usar su nombre y sus números.' },
  { bloques: [h2('El cliente'), opt('cajas-iconos', [it('Quién es', '[Qué hace y a quién atiende]', 'usuarios'), it('Tamaño', '[Equipo, sucursales o volumen]', 'grafico'), it('Antes de trabajar juntos', '[Cómo resolvía el problema]', 'reloj')])] },
  { bloques: [h2('El reto'), pg('[El problema que tenía, en una frase.]'), lista('[Lo que le costaba]', '[Lo que ya había probado]')], notas: 'El público tiene que reconocerse en este reto.' },
  { bloques: [h2('La solución'), opt('etapas-horizontales', [it('[Etapa 1]', '[Qué hicimos]'), it('[Etapa 2]', '[Qué hicimos]'), it('[Etapa 3]', '[Qué hicimos]')])] },
  { bloques: [h2('Los resultados'), opt('numeros-grandes', [num('[00]%', '[Resultado 1]', '[En cuánto tiempo]'), num('[00]', '[Resultado 2]', '[Contra el punto de partida]'), num('[00]x', '[Resultado 3]', '[Cómo se midió]')])], notas: 'Sólo resultados medidos, con el período y la fuente.' },
  { bloques: [h2('En sus palabras'), cita('[Lo que dijo el cliente sobre el resultado, con sus palabras.]', '[Nombre del cliente] · [Cargo]')] },
  { fondo: 'acento', bloques: [h2('¿Quieres un resultado así?'), pg('[El próximo paso para quien está viendo esto.]'), p('[Tu correo] · [tu sitio]')] },
]);

const onboardingCliente = (): LandingContenido => presentacion([
  { diseno: 'derecha', bloques: [ante('Bienvenida'), titulo('Empezamos a trabajar juntos'), p('[Nombre del cliente] · [Tu empresa]')], notas: 'Agradece la confianza y presenta qué vas a contar en esta reunión.' },
  { bloques: [h2('Lo que vamos a lograr'), opt('iconos-texto', [it('[Objetivo 1]', '[Para cuándo]', 'objetivo'), it('[Objetivo 2]', '[Para cuándo]', 'tendencia'), it('[Objetivo 3]', '[Para cuándo]', 'trofeo')])] },
  { bloques: [h2('Cómo trabajamos'), opt('etapas-horizontales', [it('Diagnóstico', '[Qué revisamos primero]'), it('Plan', '[Qué te proponemos]'), it('Ejecución', '[Cómo avanzamos]'), it('Revisión', '[Cada cuánto medimos]')])] },
  { bloques: [h2('Calendario'), opt('tiempo-horizontal', [it('Semana 1', '[Accesos y diagnóstico]'), it('Semana 2', '[Plan aprobado]'), it('Mes 1', '[Primeros resultados]'), it('Mes 3', '[Revisión completa]')])] },
  { bloques: [h2('Quién es quién'), opt('nombre-rol', [it('[Nombre]', '[Rol · de qué se encarga]'), it('[Nombre]', '[Rol · de qué se encarga]'), it('[Nombre]', '[Rol · de qué se encarga]')])], notas: 'Que el cliente sepa a quién escribirle para cada cosa.' },
  { bloques: [h2('Lo que necesitamos de ti'), tareas('[Acceso o dato 1]', '[Acceso o dato 2]', '[Reunión o aprobación]')], notas: 'Con fecha. Sin esto, el calendario no se cumple.' },
  { bloques: [h2('Cómo nos comunicamos'), opt('cajas-iconos', [it('Día a día', '[Canal: WhatsApp, correo…]', 'chat'), it('Reuniones', '[Frecuencia y duración]', 'video'), it('Reportes', '[Cada cuánto y qué incluyen]', 'archivo')])] },
  { fondo: 'acento', bloques: [h2('Próximos pasos'), opt('vinetas-numeradas', [it('[Primer paso]', '[Fecha]'), it('[Segundo paso]', '[Fecha]'), it('[Tercer paso]', '[Fecha]')])] },
]);

const planMarketing = (): LandingContenido => presentacion([
  { diseno: 'derecha', bloques: [ante('Plan de marketing'), titulo('[Objetivo principal] en [período]'), p('[Tu empresa] · [Fecha]')] },
  { bloques: [h2('A quién le hablamos'), opt('cajas-delineadas', [it('Quién es', '[Edad, ocupación, lugar]'), it('Qué quiere', '[El resultado que busca]'), it('Qué lo frena', '[Su objeción principal]')])], notas: 'Un cliente ideal concreto. Si son varios, una diapositiva por cada uno.' },
  { bloques: [h2('Dónde estamos hoy'), opt('embudo', [it('Alcance', '[00] personas'), it('Interesados', '[00] contactos'), it('Conversaciones', '[00] reuniones'), it('Clientes', '[00] ventas')])], notas: 'El embudo actual con números reales. El plan ataca el paso más flojo.' },
  { bloques: [h2('La estrategia'), opt('cajas-solidas', [it('[Pilar 1]', '[Qué hacemos y por qué]'), it('[Pilar 2]', '[Qué hacemos y por qué]'), it('[Pilar 3]', '[Qué hacemos y por qué]')])] },
  { bloques: [h2('Canales'), opt('iconos-texto', [it('[Canal 1]', '[Qué publicamos y cada cuánto]', 'megafono'), it('[Canal 2]', '[Qué publicamos y cada cuánto]', 'mundo'), it('[Canal 3]', '[Qué publicamos y cada cuánto]', 'correo')])] },
  { bloques: [h2('Calendario'), opt('tiempo-horizontal', [it('[Mes 1]', '[Acciones]'), it('[Mes 2]', '[Acciones]'), it('[Mes 3]', '[Acciones]')])] },
  { bloques: [h2('Presupuesto'), tabla([['Canal', 'Inversión', 'Objetivo'], ['[Canal 1]', '[$00]', '[Resultado esperado]'], ['[Canal 2]', '[$00]', '[Resultado esperado]'], ['Total', '[$00]', '']])] },
  { fondo: 'acento', bloques: [h2('Cómo lo vamos a medir'), opt('numeros-grandes', [num('[00]', '[Contactos por mes]'), num('[$00]', '[Costo por contacto]'), num('[00]%', '[Tasa de cierre]')])] },
]);

const webinar = (): LandingContenido => presentacion([
  { diseno: 'fondo', superposicion: 'oscura', bloques: [{ t: 'etiqueta', texto: 'Clase en vivo' }, titulo('[Tema de la clase]'), pg('[La promesa en una línea: lo que vas a poder hacer al terminar.]')] },
  { diseno: 'izquierda', bloques: [ante('Quién te habla'), h2('[Tu nombre]'), p('[Tu experiencia en dos líneas: qué haces y por qué te dedicas a esto.]')] },
  { bloques: [h2('Lo que vas a aprender hoy'), opt('vinetas-iconos', [it('[Aprendizaje 1]', '', 'check'), it('[Aprendizaje 2]', '', 'check'), it('[Aprendizaje 3]', '', 'check')])], notas: 'Promete tres cosas y cúmplelas en orden.' },
  { bloques: [h2('El problema'), pg('[Por qué a la mayoría no le funciona hoy, en una frase.]')], notas: 'Una diapositiva casi vacía obliga a mirarte a ti.' },
  { bloques: [h2('El método'), opt('etapas-horizontales', [it('[Paso 1]', '[Qué haces]'), it('[Paso 2]', '[Qué haces]'), it('[Paso 3]', '[Qué haces]')])] },
  { bloques: [h2('Errores comunes'), opt('cajas-numeros', [it('[Error 1]', '[Qué hacer en su lugar]'), it('[Error 2]', '[Qué hacer en su lugar]'), it('[Error 3]', '[Qué hacer en su lugar]')])] },
  { bloques: [h2('Un ejemplo'), opt('versus', [it('Antes', '[Cómo estaba]'), it('Después', '[Cómo quedó]')])], notas: 'Un caso real, con permiso. Si no lo tienes, un ejemplo armado en vivo.' },
  { fondo: 'acento', bloques: [h2('El siguiente paso'), pg('[Tu oferta o invitación: qué es, para quién y cómo se accede.]'), p('[Enlace o forma de contacto]')] },
  { bloques: [h2('Preguntas'), p('[Tu correo] · [tus redes]')] },
]);

const claseCurso = (): LandingContenido => presentacion([
  { diseno: 'derecha', bloques: [ante('Módulo [0] · Clase [0]'), titulo('[Título de la clase]'), p('[Nombre del curso]')] },
  { bloques: [h2('Al terminar esta clase vas a poder'), opt('vinetas-iconos', [it('[Objetivo 1]', '', 'check'), it('[Objetivo 2]', '', 'check'), it('[Objetivo 3]', '', 'check')])] },
  { bloques: [h2('Conceptos clave'), opt('cajas-iconos', [it('[Concepto 1]', '[Definición en una frase]', 'idea'), it('[Concepto 2]', '[Definición en una frase]', 'libro'), it('[Concepto 3]', '[Definición en una frase]', 'pizarra')])] },
  { bloques: [h2('Paso a paso'), opt('flechas-verticales', [it('[Paso 1]', '[Qué se hace]'), it('[Paso 2]', '[Qué se hace]'), it('[Paso 3]', '[Qué se hace]'), it('[Paso 4]', '[Qué se hace]')])] },
  { diseno: 'izquierda', bloques: [h2('Un ejemplo'), p('[Un caso concreto donde se aplica lo de la clase.]'), lista('[Qué se hizo]', '[Qué resultado dio]')] },
  { bloques: [h2('Lo que conviene y lo que no'), opt('pros-contras', [it('Conviene', '[Buena práctica]'), it('Evita', '[Error frecuente]')])] },
  { bloques: [h2('Ejercicio'), tareas('[Tarea 1]', '[Tarea 2]', '[Tarea 3]')], notas: 'Que el alumno lo haga antes de la próxima clase.' },
  { fondo: 'acento', bloques: [h2('En resumen'), opt('vinetas-numeradas', [it('[Idea 1]'), it('[Idea 2]'), it('[Idea 3]')])] },
]);

const roadmap = (): LandingContenido => presentacion([
  { diseno: 'derecha', bloques: [ante('Roadmap'), titulo('[Producto]: lo que viene en [período]'), p('[Equipo] · [Fecha]')] },
  { bloques: [h2('La visión'), pg('[Hacia dónde va el producto, en una frase.]')] },
  { bloques: [h2('Dónde estamos'), opt('cajas-delineadas', [it('Lo que ya funciona', '[Logros recientes]'), it('Lo que duele', '[Problemas que reportan los usuarios]'), it('Lo que aprendimos', '[Qué cambió nuestras prioridades]')])] },
  { bloques: [h2('Prioridades'), opt('piramide', [it('[Prioridad 1]', '[Por qué primero]'), it('[Prioridad 2]', '[Por qué después]'), it('[Prioridad 3]', '[Por qué al final]')])], notas: 'Arriba lo más importante. Cada prioridad con su porqué.' },
  { bloques: [h2('Por trimestre'), opt('tiempo-horizontal', [it('[Trimestre 1]', '[Qué sale]'), it('[Trimestre 2]', '[Qué sale]'), it('[Trimestre 3]', '[Qué sale]'), it('[Trimestre 4]', '[Qué sale]')])] },
  { bloques: [h2('Lo que no vamos a hacer'), opt('vinetas-iconos', [it('[Idea descartada 1]', '[Por qué no ahora]', 'alerta'), it('[Idea descartada 2]', '[Por qué no ahora]', 'alerta')])], notas: 'Decir que no también es parte del plan.' },
  { bloques: [h2('Riesgos'), opt('cajas-iconos', [it('[Riesgo 1]', '[Cómo lo mitigamos]', 'escudo'), it('[Riesgo 2]', '[Cómo lo mitigamos]', 'escudo')])] },
  { fondo: 'acento', bloques: [h2('Cómo sabremos que funcionó'), opt('numeros-grandes', [num('[00]', '[Métrica 1]'), num('[00]%', '[Métrica 2]'), num('[00]', '[Métrica 3]')])] },
]);

const equipo = (): LandingContenido => presentacion([
  { diseno: 'fondo', superposicion: 'oscura', bloques: [ante('[Nombre de tu empresa]'), titulo('Conoce al equipo')] },
  { bloques: [h2('Nuestra misión'), pg('[Para qué existimos, en una frase.]')] },
  { bloques: [h2('Lo que nos importa'), opt('iconos-grandes', [it('[Valor 1]', '[Qué significa en la práctica]', 'corazon'), it('[Valor 2]', '[Qué significa en la práctica]', 'acuerdo'), it('[Valor 3]', '[Qué significa en la práctica]', 'estrella')])] },
  { bloques: [h2('Quiénes somos'), opt('nombre-rol', [it('[Nombre]', '[Rol]'), it('[Nombre]', '[Rol]'), it('[Nombre]', '[Rol]'), it('[Nombre]', '[Rol]')])], notas: 'Si son muchos, por áreas: una diapositiva por área.' },
  { bloques: [h2('Cómo trabajamos'), opt('ciclo', [it('Planear', '[Cómo decidimos]'), it('Hacer', '[Cómo ejecutamos]'), it('Medir', '[Qué miramos]'), it('Ajustar', '[Cómo mejoramos]')])] },
  { bloques: [h2('Nuestras áreas'), opt('cajas-solidas', [it('[Área 1]', '[De qué se encarga]'), it('[Área 2]', '[De qué se encarga]'), it('[Área 3]', '[De qué se encarga]')])] },
  { fondo: 'acento', bloques: [h2('Hablemos'), pg('[Cómo contactar al equipo o sumarse a él.]'), p('[Tu correo] · [tu sitio]')] },
]);

const ventas = (): LandingContenido => presentacion([
  { diseno: 'derecha', bloques: [ante('[Tu empresa]'), titulo('[El resultado que vendes] sin [lo que más le cuesta a tu cliente]'), p('[Nombre del cliente] · [Fecha]')] },
  { bloques: [h2('¿Te pasa esto?'), opt('vinetas-iconos', [it('[Dolor 1]', '', 'alerta'), it('[Dolor 2]', '', 'alerta'), it('[Dolor 3]', '', 'alerta')])], notas: 'Pregunta cuál le pasa más. Escucha antes de seguir.' },
  { bloques: [h2('Lo que cuesta no resolverlo'), opt('numeros-grandes', [num('[00]', '[Horas perdidas por mes]'), num('[$00]', '[Dinero que se escapa]'), num('[00]', '[Oportunidades perdidas]')])], notas: 'Sus números, no los tuyos. Calcúlalos con él.' },
  { diseno: 'izquierda', bloques: [h2('La solución'), pg('[Qué hace tu producto o servicio, en una frase.]')] },
  { bloques: [h2('Cómo funciona'), opt('etapas-horizontales', [it('[Paso 1]', '[Qué pasa]'), it('[Paso 2]', '[Qué pasa]'), it('[Paso 3]', '[Qué pasa]')])] },
  { bloques: [h2('Lo que ganas'), opt('iconos-texto', [it('[Beneficio 1]', '[En qué se nota]', 'tendencia'), it('[Beneficio 2]', '[En qué se nota]', 'reloj'), it('[Beneficio 3]', '[En qué se nota]', 'escudo')])] },
  { bloques: [h2('Quienes ya lo usan'), opt('citas', [it('[Nombre del cliente] · [Cargo o negocio]', '«[Lo que dijo sobre el resultado, con sus palabras]»'), it('[Nombre del cliente] · [Cargo o negocio]', '«[Lo que dijo sobre el resultado, con sus palabras]»')])], notas: 'Testimonios reales y con permiso. Si no los tienes, saca la diapositiva.' },
  { bloques: [h2('Planes'), opt('cajas-alternadas', [it('[Plan básico]', '[Precio] · [Qué incluye]'), it('[Plan recomendado]', '[Precio] · [Qué incluye]', undefined, { destacado: true }), it('[Plan completo]', '[Precio] · [Qué incluye]')])] },
  { fondo: 'acento', bloques: [h2('El siguiente paso'), pg('[Qué tiene que hacer para empezar y para cuándo.]')] },
]);

const reporteResultados = (): LandingContenido => presentacion([
  { diseno: 'derecha', bloques: [ante('Reporte de resultados'), titulo('[Período]'), p('[Área o cliente] · [Quién presenta]')] },
  { bloques: [h2('El resultado principal'), opt('metrica-destacada', [num('[00]%', '[Lo que se logró]', '[Contra el objetivo]'), num('[00]', '[Métrica de apoyo]'), num('[00]', '[Métrica de apoyo]')])], notas: 'Empieza por el número que más importa al que escucha.' },
  { bloques: [h2('Objetivos y resultados'), tabla([['Objetivo', 'Meta', 'Resultado', 'Estado'], ['[Objetivo 1]', '[00]', '[00]', '[Cumplido]'], ['[Objetivo 2]', '[00]', '[00]', '[En curso]'], ['[Objetivo 3]', '[00]', '[00]', '[Pendiente]']])] },
  { bloques: [h2('Qué lo explica'), opt('iconos-izquierda', [it('[Causa 1]', '[Qué pasó y cómo lo sabemos]', 'idea'), it('[Causa 2]', '[Qué pasó y cómo lo sabemos]', 'flujo'), it('[Causa 3]', '[Qué pasó y cómo lo sabemos]', 'ruta')])] },
  { bloques: [h2('Antes y después'), opt('versus', [it('[Período anterior]', '[Cómo estaba]'), it('[Este período]', '[Cómo quedó]')])] },
  { bloques: [h2('Lecciones'), opt('cajas-numeros', [it('[Lección 1]', '[Qué cambiamos]'), it('[Lección 2]', '[Qué cambiamos]'), it('[Lección 3]', '[Qué cambiamos]')])] },
  { fondo: 'acento', bloques: [h2('Próximos pasos'), opt('vinetas-numeradas', [it('[Acción 1]', '[Responsable · fecha]'), it('[Acción 2]', '[Responsable · fecha]'), it('[Acción 3]', '[Responsable · fecha]')])] },
]);

const PRES = { formato: 'presentacion', proporcion: '16:9' } as const;

export const PLANTILLAS_PRESENTACION: readonly PlantillaPresentacion[] = [
  { id: 'pres-pitch', nombre: 'Pitch de negocio', descripcion: 'Problema, solución, mercado y lo que buscas.', categoria: 'Negocio', tema: temaDe('founder', 'eclipse', 'pewter'), ...PRES, contenido: pitch },
  { id: 'pres-propuesta', nombre: 'Propuesta comercial', descripcion: 'Objetivos, alcance, cronograma e inversión.', categoria: 'Ventas', tema: temaDe('sapphire', 'pewter'), ...PRES, contenido: propuestaComercial },
  { id: 'pres-informe-mensual', nombre: 'Informe mensual', descripcion: 'Números del mes, aprendizajes y prioridades.', categoria: 'Reportes', tema: temaDe('cirrus', 'pewter'), ...PRES, contenido: informeMensual },
  { id: 'pres-caso-exito', nombre: 'Caso de éxito', descripcion: 'El reto, la solución y los resultados de un cliente.', categoria: 'Clientes', tema: temaDe('canyon', 'torch', 'pewter'), ...PRES, contenido: casoExito },
  { id: 'pres-onboarding', nombre: 'Onboarding de cliente', descripcion: 'Objetivos, calendario y cómo trabajamos.', categoria: 'Clientes', tema: temaDe('mint', 'cirrus', 'pewter'), ...PRES, contenido: onboardingCliente },
  { id: 'pres-plan-marketing', nombre: 'Plan de marketing', descripcion: 'Público, estrategia, canales y presupuesto.', categoria: 'Marketing', tema: temaDe('ultraviolet', 'prism', 'pewter'), ...PRES, contenido: planMarketing },
  { id: 'pres-webinar', nombre: 'Webinar o clase en vivo', descripcion: 'Del problema al método y al siguiente paso.', categoria: 'Formación', tema: temaDe('nightsky', 'eclipse', 'pewter'), ...PRES, contenido: webinar },
  { id: 'pres-clase', nombre: 'Clase de un curso', descripcion: 'Objetivos, conceptos, paso a paso y ejercicio.', categoria: 'Formación', tema: temaDe('botanical', 'terrain', 'pewter'), ...PRES, contenido: claseCurso },
  { id: 'pres-roadmap', nombre: 'Roadmap de producto', descripcion: 'Visión, prioridades y lo que sale cada trimestre.', categoria: 'Negocio', tema: temaDe('syntax', 'circuit', 'pewter'), ...PRES, contenido: roadmap },
  { id: 'pres-equipo', nombre: 'Presentación del equipo', descripcion: 'Misión, valores, quiénes somos y cómo trabajamos.', categoria: 'Equipo', tema: temaDe('peach', 'flamingo', 'pewter'), ...PRES, contenido: equipo },
  { id: 'pres-ventas', nombre: 'Presentación de ventas', descripcion: 'Dolor, solución, beneficios y planes.', categoria: 'Ventas', tema: temaDe('torch', 'canyon', 'pewter'), ...PRES, contenido: ventas },
  { id: 'pres-resultados', nombre: 'Reporte de resultados', descripcion: 'Objetivos contra resultados y próximos pasos.', categoria: 'Reportes', tema: temaDe('anvil', 'espresso', 'pewter'), ...PRES, contenido: reporteResultados },
];

export function plantillaPresentacionPorId(id: string): PlantillaPresentacion | undefined {
  return PLANTILLAS_PRESENTACION.find((x) => x.id === id);
}
