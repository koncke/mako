// =============================================================================
// carruseles/tipos — los carruseles de MaKo por TIPO: su estructura, lámina por lámina, y un ejemplo aparte
// =============================================================================
// Martín, 4/11/2026: una biblioteca de MaKo «por tipo (lista, historia, antes y después, tutorial, opinión…), con diseño
// original». Y su regla, del 29/10: la plantilla muestra la ESTRUCTURA (lo que va en cada lámina, como guía), y el EJEMPLO
// lleno se ve aparte («Ver ejemplo»), para que nadie publique el ejemplo creyendo que es lo suyo.
//
// Cada tipo es un esqueleto de láminas con ROL (portada, punto, paso, mito, antes, después, resumen, cierre…) y una guía de
// qué va en cada una. De acá salen las dos cosas que ve la persona, para que no se separen:
//   · el documento del editor (./documento.ts): una página por lámina, con la guía escrita donde va el texto;
//   · la miniatura de la tarjeta y «Ver ejemplo» (app/image-editor/carruseles/MiniaturaCarrusel.tsx), dibujadas desde ESE
//     documento: lo que se ve es lo que se va a crear.
//
// Los tipos son los formatos del catálogo de Spy (lib/spy-detalle.ts, `FORMATOS`) que tienen sentido como carrusel: así
// «Hacer el mío» (./referencia.ts) pasa del formato de una publicación de otro a la estructura de MaKo sin una tabla aparte.
// Los ejemplos son de negocios FICTICIOS (el elenco de docs/plantillas-reales/README.md): nunca un cliente ni una persona
// real (tests/_reales.ts).
//
// Puro (sin `server-only`): lo leen la acción que crea, la API de MaKo, la pantalla y los tests.
// =============================================================================

import type { Formato } from '../spy-detalle';
import type { IdTipoCarrusel } from './opciones';

/** Lo que hace una lámina en el carrusel. El estilo dibuja distinto la portada, el cierre y las de adentro. */
export type RolLamina = 'portada' | 'contexto' | 'punto' | 'paso' | 'mito' | 'antes' | 'despues' | 'giro' | 'prueba' | 'resumen' | 'pregunta' | 'cierre';

/** Una lámina: su rol, un rótulo corto (el nombre de la página en el editor) y lo que va, como guía o como ejemplo. */
export type Lamina = { rol: RolLamina; rotulo: string; titulo: string; cuerpo: string };

/** Los colores y las letras de un tipo. Las letras están todas en app/image-editor/mako/fuentes.ts (si no, caen a la del sistema). */
export type EstiloCarrusel = {
  fondo: string; tinta: string; suave: string; acento: string;
  /** El fondo de la última lámina (la de la acción): claro y distinto, como pide el cierre de un carrusel. */
  fondoCierre: string; tintaCierre: string;
  titular: { familia: string; respaldo: 'serif' | 'sans-serif'; peso: number };
  texto: { familia: string; respaldo: 'serif' | 'sans-serif'; peso: number };
};

export type TipoCarrusel = {
  id: IdTipoCarrusel;
  nombre: string;
  /** Cuándo usarlo, en una línea (la tarjeta lo lleva como `title`). */
  cuando: string;
  laminas: { min: number; max: number; def: number };
  /** Los formatos de Spy que son este tipo («Hacer el mío» elige el tipo por el formato de la referencia). */
  formatos: readonly Formato[];
  estilo: EstiloCarrusel;
  /** La estructura con `n` láminas, como GUÍA (lo que se escribe en cada una). */
  estructura: (n: number) => Lamina[];
  /** El ejemplo lleno de un negocio ficticio: lo que muestra «Ver ejemplo». */
  ejemplo: { negocio: string; usuario: string; laminas: Lamina[] };
};

// Los ids viven en ./opciones.ts (sin dependencias): los ofrece también la API de MaKo.
export { IDS_TIPO_CARRUSEL, esTipoCarrusel, type IdTipoCarrusel } from './opciones';

const L = (rol: RolLamina, rotulo: string, titulo: string, cuerpo = ''): Lamina => ({ rol, rotulo, titulo, cuerpo });
const POR_ROL_PORTADA = 'Portada';
const POR_ROL_CIERRE = 'Cierre';

/** Repite la lámina del medio hasta completar `n` (con la portada y las del final fijas). Nunca menos de `fijas + 1`. */
function conMedio(n: number, antes: Lamina[], medio: (i: number) => Lamina, despues: Lamina[]): Lamina[] {
  const cuantas = Math.max(1, n - antes.length - despues.length);
  return [...antes, ...Array.from({ length: cuantas }, (_, i) => medio(i + 1)), ...despues];
}

const CIERRE_GUIA = L('cierre', POR_ROL_CIERRE, 'Tu llamada a la acción', 'Una sola acción: escribirte una palabra por mensaje, guardarlo o compartirlo con alguien.');

export const TIPOS_CARRUSEL: readonly TipoCarrusel[] = [
  {
    id: 'lista', nombre: 'Lista o tips', cuando: 'Quieres que lo guarden: varios consejos, errores o herramientas de tu tema.',
    laminas: { min: 4, max: 10, def: 7 }, formatos: ['lista'],
    estilo: { fondo: '#FAFAF7', tinta: '#111111', suave: '#4B5563', acento: '#F25F4C', fondoCierre: '#FFFFFF', tintaCierre: '#111111', titular: { familia: 'DM Serif Display', respaldo: 'serif', peso: 400 }, texto: { familia: 'Inter', respaldo: 'sans-serif', peso: 400 } },
    estructura: (n) => conMedio(n,
      [L('portada', POR_ROL_PORTADA, 'Tu gancho con un número', 'Cuántos son y qué gana quien los lee. Ej.: «5 errores que…».')],
      (i) => L('punto', `Punto ${i}`, `${i}. Tu punto número ${i}`, 'Una idea por lámina, en una o dos líneas. Qué hacer en su lugar.'),
      [L('resumen', 'Resumen', 'En resumen', 'Los puntos en una línea cada uno, para quien llegó directo aquí.'), CIERRE_GUIA]),
    ejemplo: { negocio: 'Cierre Consultivo', usuario: 'cierreconsultivo', laminas: [
      L('portada', POR_ROL_PORTADA, '3 frases que matan tu venta por WhatsApp', 'Y qué escribir en su lugar.'),
      L('contexto', 'Contexto', 'La mayoría de las ventas se pierden en el chat', 'Antes de la llamada.'),
      L('punto', 'Punto 1', '1. «¿Te mando la info?»', 'Mejor: «¿Qué te llevó a escribirme hoy?».'),
      L('punto', 'Punto 2', '2. «Es una inversión»', 'Mejor: primero su problema, después el precio.'),
      L('punto', 'Punto 3', '3. «Cualquier duda me dices»', 'Mejor: «¿Martes o jueves para hablarlo 20 minutos?».'),
      L('resumen', 'Resumen', 'En resumen', 'Pregunta antes de mandar. Problema antes que precio. Fecha antes de despedirte.'),
      L('cierre', POR_ROL_CIERRE, '¿Quieres mis 6 preguntas de cada llamada?', 'Escríbeme GUIA por mensaje y te las mando.'),
    ] },
  },
  {
    id: 'tutorial', nombre: 'Paso a paso', cuando: 'Enseñas a hacer algo concreto en pocos pasos y quieres que lo guarden.',
    laminas: { min: 5, max: 10, def: 7 }, formatos: ['tutorial'],
    estilo: { fondo: '#0F3D3E', tinta: '#F4E9D8', suave: '#C9D6CF', acento: '#F2B01E', fondoCierre: '#F4E9D8', tintaCierre: '#0F3D3E', titular: { familia: 'Archivo Black', respaldo: 'sans-serif', peso: 400 }, texto: { familia: 'Inter', respaldo: 'sans-serif', peso: 400 } },
    estructura: (n) => conMedio(n,
      [L('portada', POR_ROL_PORTADA, 'Cómo lograr [el resultado]', 'El resultado que va a tener y en cuánto tiempo.'),
        L('contexto', 'Antes de empezar', 'Lo que necesitas', 'Lo que hace falta tener a mano (o «nada»).')],
      (i) => L('paso', `Paso ${i}`, `Paso ${i}: el verbo de lo que se hace`, 'Una acción por lámina, con un detalle que se pueda copiar.'),
      [L('prueba', 'Resultado', 'Lo que vas a tener', 'Cómo se ve cuando sale bien.'), CIERRE_GUIA]),
    ejemplo: { negocio: 'Consulta Rentable', usuario: 'consultarentable', laminas: [
      L('portada', POR_ROL_PORTADA, 'Tu primera valoración de 20 minutos', 'En 4 pasos, hoy mismo.'),
      L('contexto', 'Antes de empezar', 'Lo que necesitas', 'Tu agenda y un mensaje fijado en tu perfil.'),
      L('paso', 'Paso 1', 'Paso 1: define a quién es', 'Pacientes nuevos que todavía no te conocen.'),
      L('paso', 'Paso 2', 'Paso 2: arma 3 preguntas', 'Qué le pasa, desde cuándo y qué ya probó.'),
      L('paso', 'Paso 3', 'Paso 3: ofrécela por mensaje', '«¿Te parece una valoración de 20 minutos esta semana?»'),
      L('prueba', 'Resultado', 'Lo que vas a tener', 'Una conversación antes de la consulta, no una cotización.'),
      L('cierre', POR_ROL_CIERRE, '¿Te paso mis 3 preguntas?', 'Escríbeme VALORACION y te las mando.'),
    ] },
  },
  {
    id: 'historia', nombre: 'Historia', cuando: 'Tienes algo que te pasó (o a un cliente) y una lección que deja.',
    laminas: { min: 6, max: 9, def: 7 }, formatos: ['storytime', 'pov', 'detras'],
    estilo: { fondo: '#F7F1E8', tinta: '#1F1A17', suave: '#5B4F45', acento: '#A4502F', fondoCierre: '#1F1A17', tintaCierre: '#F7F1E8', titular: { familia: 'Fraunces', respaldo: 'serif', peso: 700 }, texto: { familia: 'Inter', respaldo: 'sans-serif', peso: 400 } },
    estructura: (n) => conMedio(n,
      [L('portada', POR_ROL_PORTADA, 'El momento que lo cambió todo', 'Una frase que deje con ganas de saber qué pasó.'),
        L('antes', 'Antes', 'Cómo era antes', 'Dónde estabas: concreto, con un detalle que se vea.')],
      (i) => L('giro', i === 1 ? 'El problema' : 'Lo que pasó', i === 1 ? 'El problema' : 'Lo que pasó después', 'Un hecho por lámina, en orden.'),
      [L('despues', 'Después', 'Cómo es ahora', 'El cambio, con algo que se pueda medir si lo tienes.'),
        L('resumen', 'La lección', 'La lección', 'Lo que se lleva quien lee, en una frase.'), CIERRE_GUIA]),
    ejemplo: { negocio: 'Voz de Líder', usuario: 'vozdelider', laminas: [
      L('portada', POR_ROL_PORTADA, 'La reunión en la que nadie me escuchó', 'Y lo que cambié después.'),
      L('antes', 'Antes', 'Hablaba rápido y explicaba todo', 'Pensaba que más datos convencían más.'),
      L('giro', 'El problema', 'Me cortaron a los 2 minutos', 'Nadie recordaba mi propuesta al día siguiente.'),
      L('giro', 'Lo que pasó', 'Probé empezar por la pregunta', '«¿Qué pasaría si esto sale mal?»'),
      L('despues', 'Después', 'Ahora me piden que siga', 'La misma idea, en la mitad del tiempo.'),
      L('resumen', 'La lección', 'Primero la pregunta, después el dato', ''),
      L('cierre', POR_ROL_CIERRE, '¿Te pasó algo parecido?', 'Cuéntamelo en los comentarios.'),
    ] },
  },
  {
    id: 'antes-despues', nombre: 'Antes y después', cuando: 'Puedes mostrar un cambio: cómo estaba y cómo quedó.',
    laminas: { min: 5, max: 8, def: 6 }, formatos: ['antes-despues', 'testimonio'],
    estilo: { fondo: '#FFFFFF', tinta: '#1F2937', suave: '#6B7280', acento: '#2563EB', fondoCierre: '#2563EB', tintaCierre: '#FFFFFF', titular: { familia: 'Archivo Black', respaldo: 'sans-serif', peso: 400 }, texto: { familia: 'Space Grotesk', respaldo: 'sans-serif', peso: 500 } },
    estructura: (n) => conMedio(n,
      [L('portada', POR_ROL_PORTADA, 'De [antes] a [después]', 'El cambio en una línea, con el número si lo tienes.'),
        L('antes', 'Antes', 'Antes', 'Cómo estaba: el problema que se veía.')],
      (i) => L('punto', `Cambio ${i}`, `Qué cambió (${i})`, 'Una cosa que se hizo distinto.'),
      [L('despues', 'Después', 'Después', 'Cómo quedó.'), CIERRE_GUIA]),
    ejemplo: { negocio: 'Pulso Dental', usuario: 'pulsodental', laminas: [
      L('portada', POR_ROL_PORTADA, 'De 6 a 23 valoraciones al mes', 'Con la misma inversión en anuncios.'),
      L('antes', 'Antes', 'Antes', 'Respondían los mensajes 3 horas después.'),
      L('punto', 'Cambio 1', 'Responder en menos de 5 minutos', 'Quien escribe a una clínica le escribe a tres.'),
      L('punto', 'Cambio 2', '5 preguntas antes de la cita', 'Tratamiento, urgencia, zona, presupuesto y horario.'),
      L('despues', 'Después', 'Después', '23 valoraciones y 9 tratamientos cerrados en el mes 3.'),
      L('cierre', POR_ROL_CIERRE, '¿Tienes una clínica?', 'Escríbenos AUDITORIA y revisamos tus últimos 20 mensajes.'),
    ] },
  },
  {
    id: 'mito', nombre: 'Mito vs. realidad', cuando: 'Tus clientes creen algo que les impide comprar y puedes responderlo.',
    laminas: { min: 4, max: 9, def: 7 }, formatos: ['mito'],
    estilo: { fondo: '#0F172A', tinta: '#FFFFFF', suave: '#CBD5E1', acento: '#22C55E', fondoCierre: '#FFFFFF', tintaCierre: '#0F172A', titular: { familia: 'Archivo Black', respaldo: 'sans-serif', peso: 400 }, texto: { familia: 'Inter', respaldo: 'sans-serif', peso: 400 } },
    estructura: (n) => conMedio(n,
      [L('portada', POR_ROL_PORTADA, 'N mitos que te frenan', 'A quién le habla y qué le cuestan esos mitos.')],
      (i) => L('mito', `Mito ${i}`, `MITO: lo que se cree (${i})`, 'REALIDAD: lo que pasa de verdad, con un dato tuyo si lo tienes.'),
      [L('resumen', 'Lo que sí', 'Lo que sí funciona', 'En una o dos líneas.'), CIERRE_GUIA]),
    ejemplo: { negocio: 'Consulta Rentable', usuario: 'consultarentable', laminas: [
      L('portada', POR_ROL_PORTADA, '4 mitos que te hacen cobrar de menos', 'Tu consulta no se llena con más recetas.'),
      L('mito', 'Mito 1', 'MITO: si cobro menos, lleno la agenda', 'REALIDAD: la agenda se llena con un paso entre el mensaje y la consulta.'),
      L('mito', 'Mito 2', 'MITO: necesito más seguidores', 'REALIDAD: necesitas más conversaciones, no más seguidores.'),
      L('mito', 'Mito 3', 'MITO: por Instagram no se agenda', 'REALIDAD: se agenda por mensaje, con una valoración corta.'),
      L('mito', 'Mito 4', 'MITO: hay que publicar todos los días', 'REALIDAD: alcanza con 3 horas por semana bien usadas.'),
      L('resumen', 'Lo que sí', 'Lo que sí llena la consulta', 'Una oferta clara y seguimiento por mensaje.'),
      L('cierre', POR_ROL_CIERRE, '¿Cuál de estos te frenó a ti?', 'Respóndeme con el número.'),
    ] },
  },
  {
    id: 'opinion', nombre: 'Opinión', cuando: 'Tienes una postura distinta a la de tu rubro y quieres abrir conversación.',
    laminas: { min: 5, max: 8, def: 6 }, formatos: ['opinion', 'frase', 'tendencia', 'reaccion'],
    estilo: { fondo: '#F25C54', tinta: '#FFF4E6', suave: '#FFE1D6', acento: '#1D1D1D', fondoCierre: '#1D1D1D', tintaCierre: '#FFF4E6', titular: { familia: 'Archivo Black', respaldo: 'sans-serif', peso: 400 }, texto: { familia: 'Inter', respaldo: 'sans-serif', peso: 500 } },
    estructura: (n) => conMedio(n,
      [L('portada', POR_ROL_PORTADA, 'Tu afirmación, sin rodeos', 'Una frase con la que alguien de tu rubro no estaría de acuerdo.'),
        L('contexto', 'Lo que se cree', 'Lo que todos dicen', 'La idea de siempre, dicha con respeto.')],
      (i) => L('prueba', i === 1 ? 'Por qué no' : `Razón ${i}`, i === 1 ? 'Por qué no estoy de acuerdo' : `Razón ${i}`, 'Un argumento por lámina, con un ejemplo.'),
      [L('resumen', 'Mi postura', 'Lo que hago yo', 'Tu alternativa, concreta.'), L('cierre', POR_ROL_CIERRE, 'Una pregunta para abrir conversación', '¿Y tú qué piensas? Que lo contesten en los comentarios.')]),
    ejemplo: { negocio: 'Torre Alameda', usuario: 'torrealameda', laminas: [
      L('portada', POR_ROL_PORTADA, 'Comprar en preventa no es para todos', 'Y está bien decirlo.'),
      L('contexto', 'Lo que se cree', 'Lo que todos dicen', '«Comprar antes siempre es más barato.»'),
      L('prueba', 'Por qué no', 'Por qué no estoy de acuerdo', 'Si necesitas mudarte este año, la espera también cuesta.'),
      L('prueba', 'Razón 2', 'Lo que conviene mirar', 'La fecha de entrega y lo que pagas mientras tanto.'),
      L('resumen', 'Mi postura', 'Lo que hacemos nosotros', 'Te decimos si te conviene esperar, aunque no compres.'),
      L('cierre', POR_ROL_CIERRE, '¿Comprarías en preventa?', 'Cuéntanos en los comentarios.'),
    ] },
  },
  {
    id: 'caso', nombre: 'Caso con números', cuando: 'Tienes un cliente con permiso para mostrar su resultado.',
    laminas: { min: 5, max: 9, def: 7 }, formatos: ['caso-de-exito', 'resena'],
    estilo: { fondo: '#1D3557', tinta: '#F1FAEE', suave: '#C9D7E3', acento: '#F2B01E', fondoCierre: '#F1FAEE', tintaCierre: '#1D3557', titular: { familia: 'Archivo Black', respaldo: 'sans-serif', peso: 400 }, texto: { familia: 'Space Grotesk', respaldo: 'sans-serif', peso: 500 } },
    estructura: (n) => conMedio(n,
      [L('portada', POR_ROL_PORTADA, '[Número antes] → [número después]', 'Qué se midió, de quién (con permiso) y en cuánto tiempo.'),
        L('contexto', 'Punto de partida', 'El punto de partida', 'Cómo estaba, con sus números.')],
      (i) => L('paso', `Cambio ${i}`, `Cambio ${i}`, 'Qué se hizo distinto y por qué.'),
      [L('despues', 'Resultado', 'El resultado', 'El número final y algo más que cambió.'), CIERRE_GUIA]),
    ejemplo: { negocio: 'Pulso Dental', usuario: 'pulsodental', laminas: [
      L('portada', POR_ROL_PORTADA, '6 → 23 valoraciones al mes', 'Una clínica dental, en 3 meses.'),
      L('contexto', 'Punto de partida', 'El punto de partida', '80 a 100 mensajes al mes y 6 valoraciones.'),
      L('paso', 'Cambio 1', 'Cambio 1: responder en 5 minutos', 'Gana la clínica que contesta primero.'),
      L('paso', 'Cambio 2', 'Cambio 2: 5 preguntas de filtro', 'Antes de ofrecer la cita.'),
      L('paso', 'Cambio 3', 'Cambio 3: el precio antes de agendar', 'Un rango dicho en el chat evita la cita que no llega.'),
      L('despues', 'Resultado', 'El resultado', '23 valoraciones y 9 tratamientos cerrados.'),
      L('cierre', POR_ROL_CIERRE, '¿Tienes una clínica?', 'Escríbenos AUDITORIA.'),
    ] },
  },
  {
    id: 'preguntas', nombre: 'Preguntas y respuestas', cuando: 'Te preguntan siempre lo mismo antes de comprar.',
    laminas: { min: 4, max: 9, def: 6 }, formatos: ['preguntas', 'entrevista'],
    estilo: { fondo: '#264653', tinta: '#E9F5DB', suave: '#B7D3C2', acento: '#E9C46A', fondoCierre: '#E9F5DB', tintaCierre: '#264653', titular: { familia: 'Montserrat', respaldo: 'sans-serif', peso: 800 }, texto: { familia: 'Inter', respaldo: 'sans-serif', peso: 400 } },
    estructura: (n) => conMedio(n,
      [L('portada', POR_ROL_PORTADA, 'Lo que te preguntan antes de comprar', 'Respondido en una lámina cada una.')],
      (i) => L('pregunta', `Pregunta ${i}`, `¿La pregunta número ${i}?`, 'La respuesta corta, sin vueltas.'),
      [CIERRE_GUIA]),
    ejemplo: { negocio: 'Voz de Líder', usuario: 'vozdelider', laminas: [
      L('portada', POR_ROL_PORTADA, 'Lo que me preguntan antes de entrar', 'Respondido sin vueltas.'),
      L('pregunta', 'Pregunta 1', '¿Cuánto dura?', '6 semanas, una sesión por semana.'),
      L('pregunta', 'Pregunta 2', '¿Es en vivo?', 'Sí: grupos de 12 personas.'),
      L('pregunta', 'Pregunta 3', '¿Y si me pierdo una?', 'Queda grabada y la ves cuando puedas.'),
      L('pregunta', 'Pregunta 4', '¿Sirve si nunca hablé en público?', 'Sí: la primera sesión es justo eso.'),
      L('cierre', POR_ROL_CIERRE, '¿Otra pregunta?', 'Escríbeme LIDER y te respondo.'),
    ] },
  },
];

export const tipoCarrusel = (id: string): TipoCarrusel | null => TIPOS_CARRUSEL.find((t) => t.id === id) ?? null;

/** Las láminas que pide, dentro del rango del tipo (lo que no es un número, el default). */
export function laminasDelTipo(t: TipoCarrusel, pedido?: unknown): number {
  const n = typeof pedido === 'number' && Number.isFinite(pedido) ? Math.round(pedido) : t.laminas.def;
  return Math.min(t.laminas.max, Math.max(t.laminas.min, n));
}

/** El tipo de MaKo para el formato que Spy le leyó a una publicación; sin formato o sin uno que encaje, null (se pregunta). */
export function tipoDeFormato(f: Formato | '' | null | undefined): IdTipoCarrusel | null {
  if (!f || f === 'otro') return null;
  return TIPOS_CARRUSEL.find((t) => t.formatos.includes(f))?.id ?? null;
}
