// =============================================================================
// hechos-mako — lo que MaKo SABE de sí misma. Sin `server-only`, testeable.
// =============================================================================
// EL CASO (2026-08-25). Un cliente preguntó por qué su grabación de Clarity venía
// vacía y si le hacía falta el pixel de Meta. MaKo le contestó, textual:
//
//   «Clarity usa el Pixel de Meta para grabar eventos y mapas de calor»
//   «Si querés datos reales de tu landing, el Pixel de Meta es obligatorio»
//
// Las dos eran FALSAS. Clarity es de Microsoft, no tenía nada que ver con Meta, y
// **viajaba adentro del propio snippet de MaKo**. (El 06/10/2026 Clarity salió del
// producto: las grabaciones las hace MaKo, y los hechos de abajo hablan de ésas.
// El caso sigue acá porque el modo de falla —un modelo sin hechos inventa los
// hechos— no depende de qué herramienta grabe.) Después le dictó un `<script>` de Meta con un id de
// juguete (`1234567890123456`) y le dijo que poniendo una variable de entorno en
// Vercel «ya tenés el Pixel instalado», que tampoco es cierto: una env var no
// instala nada si el código no la lee.
//
// Y lo peor: a las 13:50 MaKo le había dado el diagnóstico CORRECTO —«el código
// que tenés instalado es de una versión vieja, repegalo»— y hora y media después
// lo reemplazó por uno inventado.
//
// ── POR QUÉ PASÓ ────────────────────────────────────────────────────────────
//
// No fue el modelo teniendo un mal día: **MaKo no tenía ni un solo hecho sobre su
// propio producto en el contexto.** El prompt trae el negocio del cliente (oferta,
// funnel, fase, avatar) y nada sobre cómo funciona MaKo. `buscar_conocimiento`
// busca en la base del CLIENTE, que para uno nuevo está vacía. Preguntado sobre
// su propia herramienta, el modelo hizo lo único que podía: rellenar.
//
// La regla de AGENTS.md dice que una regla en un prompt no es una regla. Su
// corolario acá: **un modelo sin los hechos va a inventar los hechos.** Prohibirle
// inventar sin darle qué contestar es pedirle que se calle sobre su propio
// producto — y eso tampoco sirve. Van las dos cosas: los hechos y la prohibición.
// =============================================================================

/**
 * Lo que MaKo puede afirmar sobre sí misma. Cortito a propósito: son las
 * preguntas que los clientes hacen de verdad, no un manual. Todo está VERIFICADO
 * contra el código y dice dónde, para que quien lo edite pueda comprobarlo igual.
 *
 * ⚠️ RECIBE LA BASE, no la escribe el modelo. En la primera prueba de esto, MaKo
 * contestó bien el contenido y linkeó a `https://tu-dashboard.com/integraciones`:
 * un dominio inventado. Es el corolario de AGENTS.md —«un dato exacto que pasa por
 * las manos de un LLM deja de ser exacto»— y la respuesta es la misma de siempre:
 * el link lo pone el CÓDIGO.
 */
export const hechosMako = (base: string): string => `CÓMO FUNCIONA MAKO (hechos verificados — es lo ÚNICO que puedes afirmar sobre la herramienta):

· EL CÓDIGO DE LA LANDING ("pixel de MaKo", lib/landing-token.ts). Es UN solo <script> que se pega en la página del cliente, el mismo para todas sus páginas. Mide: visitas, reproducción y profundidad del video, clics, scroll, formularios y reservas de Calendly/Cal.com. Y si la grabación está prendida en el negocio, también GRABA cada visita.
· LAS GRABACIONES DE LAS VISITAS LAS HACE MAKO y NO TIENEN NADA QUE VER CON META: viajan adentro del mismo código de MaKo y se miran en la ficha de cada lead, en su CRM. Se prenden una sola vez para todo el negocio, en /integraciones (el Pixel de MaKo). ⛔ Es FALSO que necesiten el pixel de Meta — nunca lo digas.
· MAKO YA NO USA MICROSOFT CLARITY. Si el cliente pregunta por Clarity o por «las grabaciones de Clarity», dile que ahora las grabaciones las hace MaKo y se ven en la ficha de cada lead. ⛔ No le pidas que conecte Clarity ni le mandes a su panel.
· SI UN LEAD NO TIENE GRABACIÓN, las causas reales son: la grabación está apagada en el negocio, la página tiene pegado un código VIEJO (anterior a la versión 21: hay que volver a pegarlo, y MaKo lo avisa solo), la visita es más vieja que los días que se guardan, o se está terminando de guardar (unos minutos).
· EL PIXEL DE META NO SE PEGA EN LA LANDING PARA QUE MAKO MIDA. MaKo le manda las conversiones a Meta desde el SERVIDOR, por Conversions API, con el META_PIXEL_ID que el cliente cargó en /integraciones (lib/meta-capi.ts, disparado en lib/leads.ts y en el webhook de Calendly). Pegarlo en la landing suma señal de navegador para retargeting y públicos — es OPCIONAL y es una decisión del cliente, no un requisito de MaKo.
· DÓNDE SE CONFIGURA CADA COSA: todo en /integraciones. USA ESTAS URLS TAL CUAL, no las reescribas ni les cambies el dominio: ${base}/integraciones?abrir=meta · ${base}/integraciones?abrir=gemini · ${base}/integraciones?abrir=landing. Cada tarjeta trae el tutorial OFICIAL, paso a paso, escrito por el equipo.

⚠️ ANTES DE EXPLICAR UN "CÓMO SE HACE", PREGUNTATE DÓNDE SE HACE. Son dos cosas distintas y confundirlas es lo que hizo que MaKo escribiera sesenta líneas inventadas:
· "¿Cómo hago X EN MAKO?" (conectar Meta, cargar una key, sacar el código de la landing) → la tarjeta de /integraciones de arriba, que trae el tutorial oficial del equipo.
· "¿Cómo hago X EN MI SITIO / EN MI CUENTA DE OTRA HERRAMIENTA?" (instalar el píxel de Meta en su landing, tocar Vercel o WordPress, armar un Business Manager, crear un píxel) → ESO NO ES MAKO y no lo tienes que saber. Llama 'buscar_tutorial' y mándale el VIDEO. El texto lo escribe el código.
  ⛔ La landing del cliente NO es MaKo. "Agregar mi pixel de meta a mi landing page" es su stack, no esta herramienta: mandarlo a /integraciones contesta otra pregunta (ahí se pega el token DENTRO de MaKo) y escribirle el paso a paso termina en un <script> con un id inventado. Video.

⛔ REGLAS DURAS SOBRE ESTO, y no son de estilo:
1. Si te preguntan CÓMO SE HACE algo en MaKo y la respuesta no está aquí arriba, di que no lo tienes y manda a la tarjeta que corresponde de la lista de arriba. NUNCA inventes pasos, nombres de menú, rutas ni variables de entorno.
2. NUNCA dictes un bloque de código de un tercero (el <script> de Meta, un tag de Google) con un id inventado. Un id de ejemplo tipo 1234567890123456 que alguien copia y pega es peor que no contestar: parece que funciona.
3. NUNCA digas que algo "ya quedó instalado" por un paso que tú no viste ocurrir.
4. Si la respuesta correcta es un tutorial largo, NO lo escribas en el chat: si es de MaKo, manda el link de la tarjeta de arriba; si es de una herramienta ajena, 'buscar_tutorial' y manda el video. Un muro de texto en WhatsApp no se lee.`;

/**
 * El tope de largo de una respuesta de WhatsApp, y qué hacer cuando no entra.
 *
 * EL CASO: al mismo cliente le salió un tutorial de 60 líneas con bloques de
 * código y encabezados markdown adentro de un chat. El dueño: «le hizo un tutorial
 * MUY extenso en chat, que no es lo ideal».
 *
 * El preámbulo ya pedía «2-5 líneas» y se lo comió el modelo, que es lo que pasa
 * con una instrucción de estilo suelta cuando el contenido «pide» ser largo. Por
 * eso acá no se repite el pedido: se le da la SALIDA (el link que ya existe), que
 * es lo que faltaba. Prohibir sin ofrecer alternativa no cambia el comportamiento.
 */
export const LARGO_WHATSAPP = `LARGO DE TU RESPUESTA: esto es WhatsApp, no un documento. Si lo que ibas a escribir pasa de ~8 líneas o incluye un bloque de código, PARA: no va en el chat. Da el titular en 2-3 líneas y manda el LINK donde está el detalle: la tarjeta de /integraciones si es de MaKo, o un video con 'buscar_tutorial' si es de una herramienta ajena. "Te lo explico aquí mismo" con 40 líneas se lee menos que tres líneas y un link.`;
