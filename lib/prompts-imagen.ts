// =============================================================================
// El prompt de imagen de cada formato — VALIDADO, textual, y en español
// =============================================================================
// Estos prompts NO los escribe un modelo: los escribió Martín probando contra
// Flow hasta que la imagen salió bien, y llegan acá tal cual. El de `Car Talks`
// es el que pasó por esa prueba.
//
// ── POR QUÉ SON TAN LARGOS, si la regla de la casa es lo simple ─────────────
// Porque no describen un lugar: describen CÓMO SE FOTOGRAFÍA ese lugar. Un
// prompt de composición corto («selfie en un auto») deja que el modelo elija la
// exposición, y ahí es donde se cae — devuelve un render con luz de estudio, o a
// la persona parada AFUERA del auto. Cada párrafo de acá abajo tapa un modo de
// falla que se vio de verdad en una imagen.
//
// ── Y POR QUÉ ES UNA TRANSFORMACIÓN Y NO UNA GENERACIÓN ────────────────────
// Fijate cómo arranca: «mantén a la persona totalmente inalterada… cambia
// únicamente la forma en que se fotografía la escena». Eso no le pide al modelo
// que invente a alguien parecido: le pide que RESPETE al de la foto y trabaje
// sobre la cámara. Es la diferencia entre pedir un retrato y pedir un revelado, y
// es lo que hace que la cara se parezca.
//
// ⚠️ NUNCA PASAN POR `mencionaCara()`. Ese guard prohíbe `rostro`, `cabello` y
// `sonrisa` para que el modelo de TEXTO no invente una persona cuando escribe la
// escena. Acá esas mismas palabras hacen lo contrario —fijan a la que ya está en
// la foto— así que este texto lo concatena el código al final, después del
// guard. Es la misma trampa que este repo ya tiene cosechada dos veces: el
// vocabulario de una instrucción y el de su guard son el mismo vocabulario.
//
// ⚠️ EN ESPAÑOL, por pedido de Martín. Los modelos de imagen de Google están
// entrenados sobre todo en inglés y «brazo estirado» pesa menos que «at arm's
// length», así que esto es una apuesta consciente. La forma de saldarla es
// generar la misma escena con la MISMA SEMILLA en los dos idiomas y mirar las dos
// imágenes — no discutirlo.

/**
 * El prompt completo de cada formato, por id de puesta.
 *
 * Ausente = ese formato todavía no tiene un prompt probado, y el pipeline cae al
 * camino anterior (la escena que escribe el modelo + el bloque del método). Se
 * prefiere eso a copiar el de otro formato: el de `Car Talks` habla de
 * ventanillas y de un salpicadero, y en una oficina eso no es un detalle de más,
 * es una instrucción falsa.
 */
export const PROMPT_IMAGEN: Record<string, string> = {
  'selfie-movimiento': [
    'Mantén a la persona totalmente inalterada: mismo rostro, mismos rasgos, misma piel, mismo cabello, mismas gafas, misma sonrisa, misma ropa.',
    '',
    'Cambia únicamente la forma en que se fotografía la escena para que parezca una foto real tomada con un teléfono dentro de un coche, mientras conduce, con una mano en el volante y otra que no se ve en camara, en el cambio.',
    '',
    'EXPOSICIÓN. La cámara mide la exposición basándose en su rostro. Su cara y torso permanecen claramente visibles y bien iluminados, con una exposición correcta y fácil de apreciar. Todo lo que no está orientado hacia una ventana aparece entre uno y dos pasos más oscuro que él: con menos luz, pero aún legible; nunca negro ni con los detalles perdidos en la sombra. El revestimiento del techo sobre él y los asientos traseros a su espalda están notablemente más oscuros que su rostro. La zona de los pies y las esquinas inferiores quedan en una sombra suave. No sumerjas el habitáculo en la oscuridad.',
    '',
    'DIRECCIÓN DE LA LUZ. La única luz proviene del parabrisas y de la ventanilla del conductor; no hay luz de relleno artificial. El lado del rostro orientado hacia la ventana está ligeramente más iluminado que el otro; es una diferencia suave y natural, sin dramatismo ni atmósfera sombría, y sin dejar la mitad de la cara a oscuras.',
    '',
    'VENTANILLAS. La vista exterior está claramente sobreexpuesta, tal como ocurre cuando un teléfono quema la luz diurna al medir la exposición para un interior con poca luz: imagen lavada, de bajo contraste y tonos pálidos, con reflejos y una ligera bruma sobre el cristal. La carretera sigue siendo reconocible, pero se ven suaves, muy luminosos y sin detalles definidos. No es un blanco puro ni una imagen nítida.',
    '',
    'ENFOQUE. Solo su rostro y su torso están nítidos. Los asientos traseros, el marco de la puerta, la parte superior del volante y todo lo que está fuera de las ventanillas quedan progresivamente desenfocados —de manera suave y natural—, tal como lo haría el objetivo de un teléfono a esta distancia.',
    '',
    'EL COCHE. Común y con señales de uso: ligeras marcas de polvo y huellas en los cristales y el salpicadero, tapicería algo desgastada y pequeñas marcas en los plásticos. No está impecable, ni nuevo, ni como recién salido del concesionario, pero tampoco sucio.',
    '',
    'Foto natural de iPhone, bajo contraste, tonos apagados, ligero grano, rango dinámico auténtico de smartphone. Sin HDR, sin aclarado de sombras, sin iluminación uniforme, sin luz de contorno, sin iluminación de estudio, sin fondo nítido y sin halos de luz.',
  ].join('\n'),
};

/** ¿Este formato tiene prompt probado? Lo usa la pantalla para decirlo. */
export function tienePromptPropio(puestaId: string): boolean {
  return typeof PROMPT_IMAGEN[puestaId] === 'string';
}
