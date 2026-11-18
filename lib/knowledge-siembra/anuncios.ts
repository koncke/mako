import type { FichaKnowledge } from './tipos';

// Método de anuncios pagos (Meta) para servicios de ticket alto. Paráfrasis propia destilada de las fichas de asesores y de los
// documentos de conocimiento del repo; sin nombres de personas ni cifras de ingresos. Las cifras son puntos de partida, no leyes.
export const FICHAS_ANUNCIOS: readonly FichaKnowledge[] = [
  {
    modulo: 'anuncios',
    titulo: 'Oferta, público y mensaje: las tres variables de toda venta',
    categoria: 'Base del anuncio',
    cuerpo: `Qué es: toda venta por anuncio depende de tres piezas que trabajan juntas: la oferta (qué se vende y por qué vale lo que cuesta, no una promoción), el público (a quién) y el mensaje (cómo se dice: texto, imagen o video). Si una falla, las otras no la compensan: buen público con mal anuncio no compra, y buen anuncio a la gente equivocada tampoco.
Cuándo se usa: antes de abrir el administrador de anuncios y cada vez que las ventas se frenan.
Antes de escribir un solo anuncio, reúne siete cosas del negocio:
- Quién es el cliente (datos básicos).
- El problema que vive hoy.
- La solución y sus beneficios.
- Por qué esta oferta y no otra (diferenciales).
- Pruebas reales: casos y testimonios verdaderos.
- Las objeciones frecuentes y cómo se contestan.
- La garantía, que pesa más mientras más alto es el precio.
Cuanto más falte de esa lista, menos probable que alguien compre. Si el problema está en la oferta, ningún anuncio lo arregla: se ajusta primero la oferta.
El error típico: empezar por el presupuesto o por el formato del video sin saber a quién se le habla ni qué se le promete.`,
    de: ['vender-por-fb-e-ig-ads', 'lib/asesores/ficha-felipe-vergara.ts'],
  },
  {
    modulo: 'anuncios',
    titulo: 'Niveles de conciencia: a quién le habla cada anuncio',
    categoria: 'Mensaje',
    cuerpo: `Qué es: no todas las personas saben lo mismo. Hay cinco niveles: no sabe que tiene el problema; lo sabe pero no conoce soluciones; conoce soluciones pero no tu servicio; te conoce y te compara; ya decidió.
Cuándo se usa: al escribir cada anuncio, y cuando los resultados se agotan rápido.
La regla práctica: a cada nivel se le habla de otra cosa.
- No sabe del problema: nómbralo con una situación reconocible (perfil, lista, historia).
- Conoce el problema: empatía y casos reales de alguien que pasó por lo mismo.
- Busca solución: comparaciones, mitos y realidad, beneficios.
- Te conoce: diferenciales, tres razones, demostración, respuesta a objeciones.
- Listo para decidir: oferta clara, garantía y el siguiente paso.
Con público amplio, quien no sabe del problema es lo más escalable y lo más difícil. Con presupuesto chico, empieza por problema, solución y producto.
El error típico: escribir todos los anuncios al nivel de producto y decisión. Ese pedazo del mercado se agota en semanas y se le echa la culpa a la plataforma. Si los anuncios mueren rápido, sube el mensaje un nivel.
En frío el texto educa; en retargeting contesta objeciones.`,
    de: ['vender-por-fb-e-ig-ads', 'lib/asesores/ficha-felipe-vergara.ts', 'lib/media-buyer/copiloto-metodo-anuncios.ts'],
  },
  {
    modulo: 'anuncios',
    titulo: 'Presupuesto desde el objetivo y el costo máximo por resultado',
    categoria: 'Presupuesto',
    cuerpo: `Qué es: el presupuesto no se elige por intuición: sale de lo que el negocio quiere vender y de lo que acepta pagar por un cliente nuevo.
Cuándo se usa: antes de lanzar y cada vez que se revisa la cuenta.
La cuenta, con los números del negocio:
- Ventas de más que quieres ÷ ticket promedio = ventas necesarias.
- Tomas el porcentaje del precio que aceptas pagar por un cliente nuevo: eso da la inversión y el retorno que necesitas.
- De ahí sale el costo máximo por resultado (por conversación, por llamada, por compra) o el retorno mínimo. Ese número decide si una campaña va bien.
En servicios con llamada, manda el costo por llamada calificada, no por lead: abaratar el lead suele traer a los peores. Como punto de partida, un practicante de 2026 habla de US$100 a 300 por agenda, más con ciclos largos; es criterio, no promedio.
Para que un conjunto aprenda necesita cerca de 50 eventos en 7 días: presupuesto semanal ≈ 50 × costo del evento. Si no alcanza, optimiza a un evento anterior (conversación, formulario) o junta conjuntos.
Tope de gasto en publicidad: lo sano, 10 a 15% de los ingresos; 20% como máximo.
El error típico: tomar los números de una prueba chica como si fueran los de escala; al escalar suelen subir.`,
    de: ['vender-por-fb-e-ig-ads', 'metolodogia-jads', 'docs/conocimiento/anuncios-high-ticket.md', 'lib/media-buyer/copiloto-metodo-anuncios.ts'],
  },
  {
    modulo: 'anuncios',
    titulo: 'Estructura de campaña: probar por un lado, escalar por otro',
    categoria: 'Estructura',
    cuerpo: `Qué es: el mapa de la cuenta antes de publicar. Menos piezas rinden más, porque cada conjunto necesita sus propios eventos para aprender.
Cuándo se usa: al armar una cuenta nueva y al ordenar una desordenada.
- Campañas tipo: una de prueba de creativos por tandas, una de escala con lo que ganó, una de retargeting y, si hay una fecha, una promocional aparte.
- Para probar, presupuesto por conjunto (así cada uno alcanza parecido y la comparación es justa). Para escalar ganadores y para retargeting, presupuesto de campaña, que reparte solo.
- Consolida: cuatro conjuntos de públicos parecidos piden unos 200 eventos para salir del aprendizaje; juntos en uno, unos 50.
- Públicos: uno directo (intereses del rubro), uno indirecto y uno abierto, donde el mensaje hace la segmentación.
- Por conjunto de prueba: de 3 a 6 anuncios y al menos dos creativos y dos textos cruzados, uno corto y otro largo.
- Ubicaciones automáticas, con el formato adaptado: 1:1 o 4:5 en el feed, 9:16 en historias y reels.
- Reparto orientativo: unos 70% a conquistar público nuevo y el resto a retargeting.
- Pon nombres claros a campañas y conjuntos, o la historia de la cuenta no se puede leer.
El error típico: mezclar prueba y escala en la misma campaña y cambiar varias cosas a la vez.`,
    de: ['metolodogia-jads', 'lib/media-buyer/copiloto-metodo-anuncios.ts'],
  },
  {
    modulo: 'anuncios',
    titulo: 'Conceptos nuevos e iteraciones: variedad real de creativos',
    categoria: 'Creativos',
    cuerpo: `Qué es: un concepto nace de algo real que le pasa a la persona y ordena varios anuncios. Iterar es cambiar una sola variable de un ganador (el gancho, el texto en pantalla, el ritmo). La misma imagen con otro titular no es diversidad.
Cuándo se usa: al planear cada tanda de creativos.
Para diversificar, cambia el ángulo, el deseo, el nivel de conciencia, el avatar (su problema y contexto, no solo la cara) o el formato.
- Sin ganador: muchos conceptos distintos, sin iterar todavía.
- Con un ganador: casi todo el esfuerzo a exprimirlo con formatos y ganchos nuevos, y una parte a uno o dos conceptos distintos.
- En el techo: avatares y microsegmentos nuevos.
Punto de partida: cada tanda con cerca de 60% de iteraciones y 40% de conceptos nuevos; que la mayoría no funcione es parte del método, porque gana una minoría.
Cada prueba nace de una hipótesis: qué falla, qué variable cambias y qué esperas que mejore. Con datos bien medidos, un ganador se lee en 3 o 4 días.
El error típico: diez anuncios casi iguales; para la plataforma son una sola señal.`,
    de: ['vender-por-fb-e-ig-ads', 'metolodogia-jads', 'lib/media-buyer/copiloto-metodo-anuncios.ts'],
  },
  {
    modulo: 'anuncios',
    titulo: 'El gancho y el mensaje que filtra a la gente correcta',
    categoria: 'Creativos',
    cuerpo: `Qué es: con público amplio, el anuncio es la segmentación. Lo que dice y muestra decide a quién se le entrega, y en servicios caros decide también quién escribe.
Cuándo se usa: al escribir el texto, el guion y el titular de cada pieza.
- Primeros segundos: qué es, para quién y qué problema resuelve. Un video abstracto que no dice qué se vende pierde a todos.
- Titular corto sobre el video o la imagen con el problema que resuelves, y una línea que lo respalde.
- Texto con tres movimientos: capta la atención, toca un dolor concreto del cliente y cierra con un llamado claro.
- Nombra el perfil o la condición de quien sí te sirve. Más fricción y claridad traen menos gente y mejor gente.
- Tres tipos de contenido: valor (resuelve un problema del nicho), entretenimiento y venta directa. Enseñar algo útil primero trae clientes que valen más.
- Reutiliza como anuncio el mejor contenido orgánico.
- Ofrece pruebas reales: casos con su contexto, nunca testimonios inventados.
Nunca inventes escasez, plazos falsos ni promesas de resultados o de ingresos.
El error típico: esperar que un solo anuncio directo venda algo caro a quien no te conoce; primero se educa y se retoma con retargeting.`,
    de: ['metolodogia-jads', 'vender-por-fb-e-ig-ads', 'docs/conocimiento/anuncios-high-ticket.md'],
  },
  {
    modulo: 'anuncios',
    titulo: 'Cuándo tocar una campaña y cuándo cortarla',
    categoria: 'Optimización',
    cuerpo: `Qué es: un semáforo para decidir con datos. Rojo: no llega al costo máximo por resultado. Amarillo: aprendiendo o cerca. Verde: rentable.
Cuándo se usa: en cada revisión de la cuenta.
- Mira a diario que las campañas corran, pero optimiza cada 5 a 7 días. Revisar cada media hora y apagar el primer día es el error más caro.
- No toques nada antes de que termine el aprendizaje. Lo reinician: cambiar la segmentación, editar o sumar anuncios, cambiar el evento o la puja, pausar 7 días o más y los cambios grandes de presupuesto.
- Cortar un creativo: cuando gastó al menos lo que costaría un resultado y no lo dio. Con poco gasto, un día sin resultados no dice nada. Un conjunto: cuando cuesta varias veces lo que cuestan los demás.
- Rojo con impresiones y sin resultados: revisa en este orden la oferta, el destino (página o chat), la campaña, el conjunto y el anuncio.
- Por síntoma: CTR bajo y clics caros, el creativo no conecta; muchos clics y pocas vistas de página, la página tarda; visitas sin registros, página confusa o sin confianza; sin entrega, público muy chico o tope de puja.
Punto de partida: CTR de enlace de 2% o más y frecuencia en prospección por debajo de 3.`,
    de: ['vender-por-fb-e-ig-ads', 'metolodogia-jads', 'docs/conocimiento/anuncios-high-ticket.md', 'lib/media-buyer/copiloto-metodo-anuncios.ts'],
  },
  {
    modulo: 'anuncios',
    titulo: 'Escalar sin romper el aprendizaje y detectar la fatiga',
    categoria: 'Escalamiento',
    cuerpo: `Qué es: invertir más en lo que ya funciona, sin perder el costo por resultado.
Cuándo se usa: con el costo estable. En servicios con llamada, además, cuando el equipo tiene agenda libre; con el calendario casi lleno el seguimiento se cae.
- Vertical: subir presupuesto a lo rentable. Las fuentes no coinciden en cuánto; empieza con 20 a 25% por vez y confirma con el costo marginal (lo que costaron las ventas que sumó el último aumento, no el promedio). Duplicar de golpe encarece cada resultado.
- Horizontal: duplicar una campaña ganadora cambiando una sola cosa (público, creativo, texto o título) y sumar creativos y públicos nuevos. Ninguna campaña dura para siempre.
- Fatiga: suben el costo por clic y la frecuencia, y no llegan compradores nuevos. En prospección, una frecuencia cerca de 3 a 5 pide creativos nuevos o menos presupuesto. Antes de apagar un público ganador, renueva el creativo.
- Techo: cada mensaje alcanza a una cantidad finita de gente. Si cada dólar nuevo rinde peor, no sigas empujando: busca otro mensaje.
- Deja campañas de reemplazo listas antes de que la ganadora se canse.
El error típico: mover el presupuesto de una campaña a otra, o apagar todo por una señal de fatiga.`,
    de: ['metolodogia-jads', 'vender-por-fb-e-ig-ads', 'docs/conocimiento/anuncios-high-ticket.md'],
  },
  {
    modulo: 'anuncios',
    titulo: 'Medir bien antes de optimizar: píxel, conversiones y cuenta',
    categoria: 'Medición',
    cuerpo: `Qué es: la plataforma optimiza hacia los eventos que recibe. Sin datos limpios, ninguna estructura ni creativo compensa.
Cuándo se usa: antes de lanzar y antes de escalar.
- Instala el píxel y la API de conversiones juntos, con las coincidencias avanzadas activas y el recorrido completo (ver contenido, agregar al carrito o agendar, iniciar pago, comprar o contactar).
- Como punto de partida, apunta a una calidad de coincidencia de 8 o más.
- El negocio es dueño de todo lo suyo: administrador comercial, cuenta publicitaria con pago, página, Instagram y píxel. Una agencia entra con permisos, no como dueña.
- En servicios con llamada, opta por el evento más profundo que junte volumen, y si no alcanza, uno anterior.
- Si el píxel falla, queda el mensaje: que la conversación y el CRM registren de dónde vino cada lead.
El error típico: juzgar una campaña por clics o por lo que reporta la plataforma, sin cruzarlo con las ventas reales del CRM.`,
    de: ['lib/media-buyer/copiloto-metodo-anuncios.ts', 'docs/conocimiento/meta-ads-gestion.md'],
  },
];
