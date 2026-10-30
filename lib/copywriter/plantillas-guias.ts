// =============================================================================
// copywriter/plantillas-guias — qué va en cada sección y para qué suele ser cada plantilla (DATOS PUROS)
// =============================================================================
// Martín (29/10/2026): «al crear un template ya te crea un guion de ejemplo; eso es confuso porque el usuario piensa que
// es el guion que MaKo le creó para su negocio. Poné la estructura, la misma, y en algún lado un botón de "ver ejemplo"».
// La página nace con el ESQUELETO (las secciones del ejemplo, vacías) y, debajo de cada título, una línea en itálica con
// lo que va ahí (`GUIAS`). El ejemplo se ve aparte («Ver ejemplo», app/copywriter/editor/EditorGuion.tsx).
// `OBJETIVOS` son los botones de la primera pregunta de MaKo («¿Para qué es este guion?», ./iniciativa.ts).
// ⚠️ Español neutro con «tú» (tests/puente-panel-copy.test.ts barre lib/) y texto corto: una línea por sección.
// =============================================================================

/** Lo que va en cada sección, por plantilla y por etiqueta. */
export const GUIAS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'guion-anuncio': {
    GANCHO: 'Los primeros 3 segundos: lo que se ve, lo que se dice y el texto en pantalla. Nombra el problema.',
    PROBLEMA: 'Cómo vive el problema tu cliente, con sus palabras.',
    AGITACION: 'Lo que le cuesta no resolverlo: tiempo, dinero u oportunidades.',
    SOLUCION: 'Tu forma de resolverlo y por qué funciona. Una prueba, si la tienes.',
    CTA: 'Una sola acción: qué tiene que hacer y qué pasa después.',
    'TEXTO DEL ANUNCIO': 'El texto principal, el título y el botón del anuncio de Meta.',
  },
  testimonio: {
    GANCHO: 'El resultado o la frustración del cliente, en una frase y en los primeros 4 segundos.',
    HISTORIA: 'Cómo estaba antes, qué cambió (una sola razón) y el después con un número que se pueda comprobar.',
    CTA: 'Lo que tiene que hacer quien lo ve.',
  },
  'copy-anuncio': {
    'TEXTO PRINCIPAL': 'Tres versiones con ángulos distintos. El gancho, en los primeros 125 caracteres.',
    TITULO: 'Un título corto por versión, de unos 40 caracteres.',
    BOTON: 'El botón de Meta que va con la acción.',
    LINK: 'A dónde lleva el anuncio.',
  },
  'banco-ganchos': {
    GANCHOS: 'Diez aperturas distintas para el mismo anuncio: lo que se ve, lo que se dice y el texto en pantalla.',
    CUERPO: 'Lo que sigue después de cualquier gancho: el mismo para los diez.',
    CTA: 'Una sola acción para quien termina de ver.',
  },
  reel: {
    GANCHO: 'Una frase de 5 a 9 palabras con el tema adelante, el título en pantalla y lo que se ve.',
    HISTORIA: 'Escena por escena: lo que se dice y cómo se graba.',
    MORALEJA: 'La enseñanza, en una frase.',
    CTA: 'Qué hacer al terminar: comentar una palabra, escribir o seguir la cuenta.',
    CAPTION: 'El texto debajo del reel.',
  },
  stories: {
    GANCHO: 'La primera story: una curiosidad que se resuelve al final del día.',
    CONTEXTO: 'Frame por frame: el formato de cada story, su texto y cómo se arma.',
    MORALEJA: 'La conclusión del día, en una frase.',
    CTA: 'Responder con una palabra clave para seguir por mensaje.',
  },
  carrusel: {
    SLIDES: 'Una idea por diapositiva: la portada engancha y la última pide la acción.',
    CTA: 'Qué escribir o hacer, con la palabra clave si la usas.',
    CAPTION: 'El texto debajo del carrusel.',
  },
  email: {
    ASUNTO: 'Claro, de 40 a 60 caracteres: que den ganas de abrirlo.',
    'VISTA PREVIA': 'La línea que se ve al lado del asunto.',
    CUERPO: 'Una escena, lo que falta, qué incluye, el precio, la garantía y una P. D. con una acción fácil.',
    BOTON: 'Una sola acción.',
  },
  'secuencia-nutricion': {
    'EMAIL 1': 'Día 0: entrega lo que descargó y pide una acción para hoy.',
    'EMAIL 2': 'Día 2: una idea que cambia lo que cree.',
    'EMAIL 3': 'Día 4: tu historia, tu peor momento y lo que cambiaste.',
    'EMAIL 4': 'Día 7: el caso de un cliente, con su resultado.',
    'EMAIL 5': 'Día 10: la oferta y la objeción que más escuchas.',
  },
  'vsl-respuesta-directa': {
    LEAD: 'A quién le habla el video, qué se lleva si lo mira y quién no debería seguir mirando.',
    PROBLEMA: 'Lo que ve en su negocio todos los días, contado como lo vive.',
    HISTORIA: 'Cómo lo aprendiste tú: el momento en que entendiste el problema de verdad.',
    MECANISMO: 'Tu método, con su nombre y paso por paso.',
    PRUEBA: 'Casos con números, con el permiso de cada cliente.',
    OFERTA: 'Qué incluye, cómo se trabaja y para cuántos.',
    OBJECIONES: 'Las tres dudas que más escuchas, con su respuesta.',
    CTA: 'Una sola acción, y qué pasa después.',
  },
  'vsl-clase-educativa': {
    LEAD: 'La bienvenida y las tres claves que se va a llevar.',
    PROMESA: 'Lo que se lleva aunque nunca te compre.',
    'QUIEN SOY': 'Por qué tú: tu peor momento y tu resultado de hoy, en pocas frases.',
    'CLAVE UNO': 'La primera idea completa, con un ejercicio en vivo.',
    'CLAVE DOS': 'La creencia que se rompe y el paso del medio.',
    'CLAVE TRES': 'La que más mueve los números: se entiende sola y se aplica mejor acompañada.',
    TRANSICION: 'El paso de enseñar a ofrecer, dicho en voz alta.',
    OFERTA: 'Qué es, para quién sí y para quién no, la inversión y el bono por inscribirse en la clase.',
    CTA: 'Dónde está el enlace y qué pasa al inscribirse.',
  },
  youtube: {
    GANCHO: 'Los primeros 30 segundos: lo que promete la miniatura, qué se lleva y qué pierde si no lo sabe.',
    INTRO: 'Quién eres, en una frase, y de dónde salen los datos del video.',
    'BLOQUE UNO': 'Una idea completa: abre con una interrupción y cierra con un resumen y un puente.',
    'CTA MEDIO': 'Un recurso gratis ligado al tema, en 15 segundos.',
    'BLOQUE DOS': 'La primera línea vuelve a enganchar; después, una idea, un resumen y un puente.',
    'BLOQUE TRES': 'La idea más teórica, con un ejemplo en pantalla.',
    REGANCHO: 'Lo que ya vio, en una frase, y lo mejor que falta.',
    'BLOQUE FINAL': 'La recompensa que prometió la miniatura, entera.',
    CIERRE: 'Una sola acción y el video que sigue. Sin despedida larga.',
  },
};

/** Para qué suele ser cada plantilla: los botones de «¿Para qué es este guion?» (la persona también puede escribirlo). */
export const OBJETIVOS: Readonly<Record<string, readonly string[]>> = {
  'guion-anuncio': ['Agendar llamadas', 'Llenar una clase', 'Vender directo'],
  testimonio: ['Agendar llamadas', 'Dar confianza', 'Vender directo'],
  'copy-anuncio': ['Agendar llamadas', 'Registros a una clase', 'Vender directo'],
  'banco-ganchos': ['Agendar llamadas', 'Mensajes por WhatsApp', 'Registros a una clase'],
  reel: ['Mensajes con una palabra', 'Seguidores nuevos', 'Agendar llamadas'],
  stories: ['Mensajes directos', 'Vender un cupo', 'Calentar a mi audiencia'],
  carrusel: ['Guardados y mensajes', 'Seguidores nuevos', 'Mensajes directos'],
  email: ['Cerrar inscripciones', 'Agendar llamadas', 'Vender un producto'],
  'secuencia-nutricion': ['Agendar llamadas', 'Vender un programa', 'Llevar a una clase'],
  'vsl-respuesta-directa': ['Agendar llamadas', 'Vender directo'],
  'vsl-clase-educativa': ['Vender en la clase', 'Agendar llamadas'],
  youtube: ['Traer clientes', 'Crecer el canal', 'Llevar a un recurso gratis'],
};
