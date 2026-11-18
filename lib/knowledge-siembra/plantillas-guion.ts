import type { FichaKnowledge } from './tipos';

// 18/11/2026: plantillas de guion (pedido 3.2 del 30/10). Describen la FORMA del guion, no a quien la enseña.
// Los ejemplos usan un negocio ficticio de servicios: una consultoría de finanzas para clínicas dentales.
export const PLANTILLAS_GUION: readonly FichaKnowledge[] = [
  {
    modulo: 'organico',
    titulo: 'Guion de autoridad con un caso de cliente',
    categoria: 'Plantilla de guion',
    cuerpo: `Para qué sirve: mostrar que tu método funciona contando un caso real, con permiso del cliente y sin inventar datos.
Estructura (45 a 60 segundos):
- Gancho (0-4 s): el resultado o el problema del caso. Ejemplo: «Esta clínica tenía agenda llena y aun así no le quedaba dinero».
- Situación (4-15 s): quién era y qué intentaba. «Tres sillones, buena reputación, cobros desordenados».
- Giro (15-40 s): lo que se cambió, en dos o tres pasos concretos. «Separaron los cobros por tratamiento, fijaron un día de revisión semanal y ajustaron precios».
- Cierre (40-55 s): qué aprendió la persona y una invitación suave. «Si te pasa algo parecido, comenta "claridad" y te envío la lista de revisión».
Error típico: contar solo el resultado sin el proceso, o usar un caso que no existió. Si no tienes uno, cuenta un caso propio y dilo así.`,
    de: ['sell-your-knowledge', 'masteryhaus', 'arcadia'],
  },
  {
    modulo: 'organico',
    titulo: 'Guion de corrección de un mito del sector',
    categoria: 'Plantilla de guion',
    cuerpo: `Para qué sirve: ganar atención diciendo algo contrario a lo que tu público cree, y ganar confianza explicando por qué.
Estructura (30 a 45 segundos):
- Gancho (0-3 s): la creencia común, dicha con tono firme. «Subir los precios hace que pierdas pacientes».
- Contra (3-12 s): por qué esa creencia no se sostiene, con una razón simple. «Lo que los aleja no es el precio, es no entender qué reciben».
- Evidencia (12-30 s): un ejemplo o un dato que puedas respaldar, y una forma mejor de hacerlo. «Explica el tratamiento en tres frases antes de dar el precio».
- Cierre (30-40 s): una pregunta que invite a opinar. «¿Cuál de estas creencias te han dicho a ti?».
Error típico: provocar sin sustento. La opinión fuerte funciona cuando la defiendes con una razón verificable.`,
    de: ['metodo-contenido-irresistible', 'hackeando-el-algoritmo', 'inteligencia-viral-2026'],
  },
  {
    modulo: 'organico',
    titulo: 'Guion de paso a paso para guardar',
    categoria: 'Plantilla de guion',
    cuerpo: `Para qué sirve: que el video se guarde y se comparta porque la persona piensa usarlo después. Funciona para temas de método.
Estructura (30 a 50 segundos):
- Gancho (0-3 s): el resultado y la cantidad de pasos. «Tres pasos para saber si tu clínica gana dinero cada mes».
- Pasos (3-40 s): uno por bloque de unos 10 segundos, con la acción primero y un ejemplo breve. «Uno, suma lo cobrado. Dos, resta lo que pagaste. Tres, divide entre los tratamientos».
- Cierre (40-50 s): resume en una frase y propone guardar. «Guárdalo para tu próxima revisión».
Detalles: pon cada paso en pantalla como texto corto y mantén un cambio de plano por paso.
Error típico: meter más de cinco pasos o explicarlos todos con teoría. Menos pasos, más claros.`,
    de: ['metodo-contenido-irresistible', 'mateo-maffia-byf', 'tiktok-100k-jordi-segues'],
  },
  {
    modulo: 'organico',
    titulo: 'Guion de historia personal con una enseñanza',
    categoria: 'Plantilla de guion',
    cuerpo: `Para qué sirve: crear cercanía y que se te recuerde por lo que sentiste y aprendiste, no solo por lo que sabes.
Estructura (40 a 60 segundos):
- Gancho (0-4 s): el momento difícil o curioso, en primera persona. «El día que casi cierro mi consultorio».
- Conflicto (4-25 s): qué pasó y qué sentías, con un detalle concreto. «Tenía deudas y no entendía mis propios números».
- Cambio (25-45 s): qué decidiste y qué descubriste. «Empecé a registrar cada ingreso y supe cuál servicio dejaba dinero».
- Enseñanza (45-55 s): la idea que la persona se lleva, conectada con su situación. «Lo que no mides no se arregla. ¿Qué número no estás mirando?».
Error típico: contar la historia sin enseñanza, o exagerarla. Cuenta lo que pasó y deja que el detalle haga el trabajo.`,
    de: ['inteligencia-viral-2026', 'instituto-de-marca-personal', 'master-marca-personal-5-0'],
  },
];
