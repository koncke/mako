import type { FichaKnowledge } from './tipos';

// Video, imagen y avatares: criterio para que el negocio produzca SUS piezas. Destilado de los cursos de edición y de
// avatares y de lo que la casa aprendió generando imágenes y videos con IA. Paráfrasis propia, sin nombres de personas.
export const FICHAS_PIEZAS: readonly FichaKnowledge[] = [
  {
    modulo: 'piezas',
    titulo: 'Genera desde una referencia y una frase corta y humana',
    categoria: 'Generar con IA',
    cuerpo: `Qué es: toda pieza generada parte de una base real y el texto solo dice qué cambia.

Cuándo se usa: al crear o corregir una imagen o un video con IA.

La regla práctica:
- La base es una foto real de la persona o una imagen que ya aprobaste; nunca solo prompt.
- La foto define la cara; el texto describe la escena y la cámara. Si describes los rasgos con palabras, compiten con la foto y el modelo prefiere el texto: sale otra persona.
- Una sola referencia. Con varias, el modelo mezcla lo que quiere de cada una.
- Una frase corta, como la dirías a alguien: "Mantén la foto, pero que las tarjetas se vean así, más reales".
- Lo que no quieres, no lo nombres: lo escrito en negativo se cumple al revés.
- Di la cámara con precisión ("selfie con el brazo estirado" no es "visto desde el asiento de al lado").

El error típico: un párrafo técnico con seis condiciones. Cada frase de más es otra instrucción que se cumple literal y reconstruye otra imagen.`,
    de: ['AGENTS.md', 'avatares-que-se-parecen'],
  },
  {
    modulo: 'piezas',
    titulo: 'No generes encima de una generación: vuelve a la última versión aprobada',
    categoria: 'Generar con IA',
    cuerpo: `Qué es: cada edición con IA redibuja la imagen entera. Encadenar ediciones es fotocopiar una fotocopia.

La regla práctica:
- Guarda cada versión aprobada como punto de retorno.
- Un cambio nuevo se aplica sobre la última versión limpia, no sobre el resultado de tres correcciones seguidas.
- Dos o tres ediciones seguidas es el techo; pasado eso, vuelve a la base buena y pide el cambio acumulado de una vez.
- Una cosa al 100 % primero y después se suma la otra: termina el fondo solo, sin la persona, y entonces pide "pon a esta persona, con la misma foto y la misma pose, delante de este fondo". Así cada pieza se corrige sin romper la otra.
- Cada clip parte de la imagen original del avatar, aunque cambie el gesto o la posición. Si metes otra foto a mitad, avisa que puede haber diferencias sutiles de luz, pelo y facciones.
- Baja y sube siempre el original; un reescalado automático es otra pasada de IA que alisa la piel y borra textura.

El error típico: corregir "que se vea mejor" encima de lo ya desviado.`,
    de: ['AGENTS.md', 'avatares-que-se-parecen'],
  },
  {
    modulo: 'piezas',
    titulo: 'Revisa antes de entregar y cuenta las palabras',
    categoria: 'Control de calidad',
    cuerpo: `Qué es: con la misma base y la misma frase, dos corridas dan resultados distintos y el modelo no avisa cuando falla.

La regla práctica:
- Compara el resultado con la referencia, lado a lado, antes de mostrarlo: rostro, expresiones, pelo, ropa, luz y escala (una persona es más alta que un corcho de pared).
- Recorre la lista de todo el feedback que ya diste sobre esa pieza, punto por punto. Mirar el resultado solo hace repetir correcciones.
- Si salió mal, no apiles otra corrección: vuelve a la base y pide de nuevo.
- Continuidad entre clips: repasa cómo terminó el anterior (qué tiene en la mano, dónde está, ropa) y arma el siguiente desde ahí.
- La duración del clip sale del texto: unas tres palabras por segundo, más un poco de entrada y salida. Si el clip es más largo que la frase, el modelo repite sílabas y tartamudea; tolera como mucho un segundo y medio de sobra.
- Escucha y transcribe el clip: no basta con que se vea bien, hay que oír qué dice.
- Un video cuesta; una imagen casi no. Prueba con imágenes todas las veces que haga falta y pide un solo video, ya con la imagen aprobada.

El error típico: descubrir el defecto cuando lo ve el cliente.`,
    de: ['AGENTS.md', 'avatares-que-se-parecen'],
  },
  {
    modulo: 'piezas',
    titulo: 'El prompt re-renderiza lo que no nombra',
    categoria: 'Generar con IA',
    cuerpo: `Qué es: sobre una imagen ya aprobada, el modelo no conserva lo que no mencionas: reconstruye con sus valores por defecto.

La regla práctica:
- En cualquier cambio (fondo, ropa, luz) repite el tratamiento fotográfico completo aunque no lo cambies. Se cambia un eje, pero se declaran todos.
- Guarda ese bloque de tratamiento junto a la imagen para reutilizarlo.
- Nombra cada concepto una sola vez y con su límite en la misma frase: "un poco más claro y suave, pero legible, sin neblina". Cinco sinónimos no lo precisan: lo vuelven extremo.
- Un eje por corrección. Nunca toques en la misma pasada hueso, pelo, edad y expresión: eso es identidad.
- El realismo se decide en el prompt, no en el render: luz natural suave, poros en la piel, encuadre descentrado, grano ligero. Pedir flash duro por defecto da piel quemada que ningún filtro arregla.
- Si la imagen sale cinematográfica y buscas algo de celular, corrige la luz pedida, no apliques una capa encima.

El error típico: corregir en post lo que se pidió mal en el prompt.`,
    de: ['avatares-que-se-parecen', 'lib/curso-avatar.ts'],
  },
  {
    modulo: 'piezas',
    titulo: 'Revisa la foto y el audio antes de gastar créditos',
    categoria: 'Avatares',
    cuerpo: `Qué es: casi todas las quejas de "no se parece" vienen del material de entrada, no del modelo. Se detectan antes de generar.

Para la foto:
- Una sola cara, grande en el cuadro, buena luz, enfocada y real (no una imagen ya generada).
- Si la persona se parece más a sí misma al sonreír, la referencia es sonriendo y el prompt sostiene la sonrisa mientras habla. Pregunta: ¿en qué momento del video sí te pareces? Esa respuesta vale más que una lista de defectos.

Para la voz:
- Más de un minuto de una sola voz, sin música ni ruido, y no una conversación con otra persona.
- Para un anuncio, clona de material de anuncio: el registro actuado pesa más que la duración o la calidad. Audio hablado casual produce un clon que suena a conversación.
- Pregunta cuándo se grabó: la voz cansada produce un clon cansado.

Cómo pedirlo: con una foto buena y una mala al lado y el chequeo corriendo en vivo al subir.

El error típico: generar doce clips con material equivocado cuando pedir otra foto costaba un minuto.`,
    de: ['avatares-que-se-parecen', 'lib/curso-avatar.ts'],
  },
  {
    modulo: 'piezas',
    titulo: 'Edita para retener: contexto, línea de ojos, cortes y ritmo',
    categoria: 'Edición',
    cuerpo: `Qué es: la edición cuenta la historia y sostiene la atención hasta el final.

La regla práctica:
- Contexto al inicio: en los primeros segundos, un título que prometa qué vas a encontrar, sin gritos ni urgencia falsa.
- Línea de ojos siempre a la misma altura y sujeto centrado: los saltos de altura entre planos cansan.
- Zoom progresivo muy sutil durante el plano y alguno más fuerte puntual para dar contraste.
- Material de apoyo (b-roll) cuando lo dicho se entiende mejor visto.
- Los mejores cortes son los que no se notan. Corte normal para cambiar de escena; corte de salto dentro de la misma escena para dar sensación de tiempo; corte con audio adelantado o rezagado (el sonido de la escena siguiente entra antes, o el de la anterior se queda) para dar continuidad.
- Edita al ritmo de la música: marca los tiempos y cambia de plano cuando cae el golpe; las herramientas lo hacen de forma automática.
- Color corregido y, si te sirve, un mismo estilo para toda la serie.

El error típico: cortes al azar y planos sin un propósito narrativo.`,
    de: ['hackeando-la-edicion', 'edicion-de-video-en-capcut'],
  },
  {
    modulo: 'piezas',
    titulo: 'Sonido y subtítulos: el audio pesa más que la imagen',
    categoria: 'Edición',
    cuerpo: `Qué es: un video en 4K con mal audio se abandona antes que uno sencillo con buen sonido.

La regla práctica de audio:
- Voz clara y alta; limpia el ruido de fondo y el eco. Un micrófono de solapa vale más que una cámara mejor.
- Música sin voz de fondo, para no pisar tu propia voz.
- Diseño de sonido con intención: crecimiento antes de un mensaje, golpe para enfatizar, cambio de escena, campana o notificación para renovar la atención, clics y teclado para títulos. Varía los efectos; repetir uno aburre.
- Pausas dramáticas solo cuando enfatizan algo.

Subtítulos:
- Ponlos siempre que hablas: mucha gente mira sin sonido o en un lugar ruidoso.
- Acompañan, no protagonizan: pequeños, con buena tipografía, sin ocupar la pantalla; resalta solo palabras clave.
- Respeta la zona segura: nada importante pegado al borde ni sobre los botones de la aplicación.
- Antes de publicar, repasa el checklist: contexto, ojos alineados, subtítulos, música sin voz, efectos, voz limpia y sin ruido.

El error típico: invertir en imagen y descuidar el audio.`,
    de: ['hackeando-la-edicion', 'edicion-de-video-en-capcut'],
  },
];
