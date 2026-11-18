// El módulo `app` (área `producto`, RESERVADA: no entra al RAG de ningún negocio). Es el método de la casa para construir
// MaKo, destilado de las reglas VIGENTES de AGENTS.md el 18/11/2026.
//
// ⚠️ NO sale de lib/curso-producto.ts (el curso «Buenas prácticas para construir una App», que siembra
// scripts/seed-curso-producto.mjs): su primera lección enseña «Toda tab tiene onboarding: Conectar → Contexto → Ensayo», y
// esa regla se dio vuelta el 01/11/2026 («nada debe tener onboarding… limitas la experiencia del usuario»). Sembrar ese
// curso otra vez le enseñaría a MaKo lo contrario de lo que se decidió; acá va lo de hoy.
import type { FichaKnowledge } from './tipos';

export const FICHAS_APP: readonly FichaKnowledge[] = [
  {
    modulo: 'app', categoria: 'Diseño',
    titulo: 'Ninguna pantalla se diseña de cero: se copia una referencia entera',
    cuerpo: `Antes de escribir una línea de interfaz se elige UNA referencia (una app real, un demo, un repo con licencia que deja) y se ABRE: no se recuerda, se mira, con capturas.
- Una app competidora: se copia la estructura (jerarquía, qué entra en una fila, dónde viven las acciones destructivas); colores, tipografía e íconos son los de la casa.
- Una referencia de estilo que mandó el dueño: los valores SON el pedido. Tipografía, escala, paleta, radios, sombras y curvas se copian con sus números, leídos del navegador.
- Juntar pedazos de varias copias también es inventar, y ningún texto, aviso ni botón que la referencia no tenga.
- Si ninguna referencia calza, se frena y se avisa ANTES de construir.
La fuente se nombra en el commit y en el relevo. Lo que salió bien en el producto está copiado (CapCut, Canva, Looker, GitHub); lo dibujado «con buen criterio» se rechazó a la primera.`,
    de: ['AGENTS.md'],
  },
  {
    modulo: 'app', categoria: 'Diseño',
    titulo: 'Ningún wizard tapa una tab: la tab abre mostrando la tab',
    cuerpo: `Una tab abre siempre con su contenido, aunque esté vacía. Un onboarding que se pone EN LUGAR de la pantalla hasta que alguien aprieta «salir» limita la experiencia y se descarta.
Lo que ocupa su lugar:
- Una franja de UNA línea dentro del contenido, con una «×» que la cierra para siempre. Dice qué hace la pantalla, no cómo configurarla.
- MaKo pide lo que falta CUANDO hace falta, en su chat: si para leer algo hace falta conectar una cuenta, el botón va en el estado de error de esa lectura, con el motivo real al lado.
El estado de configuración sigue sirviéndole a MaKo, pero como DATO («tiene 0 competidores»), nunca como un paso pendiente que reclama.`,
    de: ['AGENTS.md'],
  },
  {
    modulo: 'app', categoria: 'Diseño',
    titulo: 'La pantalla dice qué pasó; el porqué va al código',
    cuerpo: `Cada superficie tiene un techo de texto: un toast de deshacer son 3 o 4 palabras, un rótulo de campo de 1 a 3, un estado vacío una frase, una cabecera el nombre y el número. El porqué de una decisión va al comentario del código, donde se busca y se versiona.
- Si el texto narra lo que la pantalla ya hace, se va.
- Un aviso arranca con lo que la persona puede hacer y para qué («Crea tu Token para comenzar a chatear»), nunca con el estado interno («Este dispositivo todavía no firma»).
- Un estado vacío es una afirmación: separa «no empezaste», «está apagado» y «no pude leer», cada uno con su próximo paso. Si no se midió, no se afirma.
- El nombre interno de una cosa (un id, un número de workspace) no va en pantalla.`,
    de: ['AGENTS.md'],
  },
  {
    modulo: 'app', categoria: 'Producto',
    titulo: 'Un canal propone y una persona confirma',
    cuerpo: `Lo que llega de afuera (un chat con IA, WhatsApp, una automatización, un formulario) deja una PROPUESTA y devuelve un link a una pantalla editable donde alguien la mira, la corrige y confirma. Recién ahí se escribe.
- Un dato exacto que pasa por un modelo deja de ser exacto: la confirmación es el único momento en que un humano lo ve antes de que valga.
- La pantalla de confirmación es editable: si sólo pregunta «¿confirmas?», obliga a aceptar el dato mal.
- Idempotencia en las dos puntas: una referencia al proponer y un compare-and-set al aplicar.
- Además del link, una BANDEJA: un aviso es un evento que se pierde; una bandeja es un estado.
Lo que cuesta plata se confirma en una pantalla, nunca con un «sí» suelto.`,
    de: ['AGENTS.md'],
  },
  {
    modulo: 'app', categoria: 'Inteligencia artificial',
    titulo: 'Una regla en un prompt no es una regla: lleva su chequeo en el código',
    cuerpo: `Toda regla que gobierna la salida de un modelo necesita dos capas: el texto en el prompt (para que acierte) y una validación determinista en el saneo (para cuando no acierte). Si la segunda no se puede escribir, la regla es un deseo y se dice así.
- Un id, un número o una URL que tienen que llegar intactos no los transporta el modelo: los pone el código.
- Un ejemplo entre comillas en un prompt es lo que el modelo va a decir: sólo si es verdad en todos los turnos que lo leen.
- Un filtro sobre lo que dice la IA nunca borra una oración verdadera: marca lo que no tiene respaldo.
- Cuando dos señales se contradicen, gana la más cara de producir (una lista de opciones concretas le gana a un token suelto).`,
    de: ['AGENTS.md'],
  },
  {
    modulo: 'app', categoria: 'Seguridad',
    titulo: 'Cada negocio ve sólo lo suyo, y el guard se escribe en positivo',
    cuerpo: `El negocio de un pedido sale siempre de la sesión firmada, nunca de un parámetro de la URL: un parámetro lo escribe cualquiera y leerlo directo abre los datos de otro.
- Un guard sobre algo destructivo dice «sólo ESTE», nunca «cualquiera menos aquél»: la condición negativa se queda vieja sola con cada cliente nuevo.
- Si no se sabe de qué negocio es algo, no se cae a un negocio por defecto: lo que escribe o gasta falla, y lo que sólo lee vuelve vacío.
- La página esconde por rol y la API no: el corte va adentro de cada ruta, antes de leer, de gastar o de escribir.
- Lo que se guarda en el navegador lleva el negocio en la clave: dos pestañas de dos clientes comparten el mismo almacenamiento.`,
    de: ['AGENTS.md'],
  },
  {
    modulo: 'app', categoria: 'Producto',
    titulo: 'Un error dice de quién fue y qué hacer',
    cuerpo: `Cuando algo falla, el mensaje clasifica la causa y da la acción: no hay un mensaje de error, hay uno por causa.
- Si es del usuario (su cuota, su clave, su configuración), se dice y se le da el link a la pantalla exacta donde se arregla.
- Si no es suyo, se dice con todas las letras, y si falló un tercero se lo nombra primero, sólo si está medido.
- Se miran todos los errores, no el último: el último suele ser el escalón vacío del final.
- Nunca se inventa un remedio («míralo arriba a la derecha») que no se vio.
- Todo aviso de error lleva «Reportar a Soporte», y todo «no pude» de MaKo abre un ticket solo.`,
    de: ['AGENTS.md'],
  },
  {
    modulo: 'app', categoria: 'Producto',
    titulo: 'Todo lo que hace la pantalla se puede hacer por la API',
    cuerpo: `Una capacidad nueva se DECLARA en el registro de la API de MaKo (qué es, parámetros, canales, cómo se confirma), no se escribe en una ruta suelta: de ahí salen las herramientas del chat, la referencia y lo que aprende la skill de cada cliente.
- Leer y cambiar: lo que la pantalla deja leer o editar, la API también.
- Lo que cuesta plata se confirma en pantalla y lo hace un admin.
- Una acción que crea algo devuelve su id; una que no cambia nada dice «ya estaba así».
- La API dice en qué paso está y qué hacer ahora: lo que falta se contesta guiando, no con un error seco.
Lo que existe en la pantalla sin API es un hueco abierto, no una decisión.`,
    de: ['AGENTS.md'],
  },
];
