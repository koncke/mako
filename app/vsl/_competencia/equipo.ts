// =============================================================================
// /vsl/equipo — Equipo, los roles y permisos de tu equipo de ventas, con la ESTRUCTURA y el DISEÑO de la página «Equipos» de Pipedrive
// =============================================================================
// REFERENCIA COPIADA ENTERA (el orden de secciones, el storytelling y el diseño):
//   https://www.pipedrive.com/es/features/teams  (leída el 16/11/2026 con el navegador del panel, a 1440 y a 390 px)
// El diseño copiado vive en ./disenos/equipo.tsx, con los valores medidos de la referencia en su cabecera.
// Su orden, que se respeta aquí: «EQUIPOS · El CRM para equipos de ventas», sus tres párrafos, el botón y su renglón chico, con la foto a
// la derecha → su franja de calificaciones → «Qué buscar en un CRM para el trabajo en equipo» (cinco renglones con su comienzo en negrita,
// la ilustración a la izquierda) → «Funciones clave…» (seis tarjetas con su ícono, de a tres) → cuatro filas alternadas («Obtén
// actualizaciones instantáneas del equipo», «Establecer las metas…», «Rastrea el rendimiento…», «Personaliza lo que los usuarios pueden ver
// y hacer») → «Más de 500 integraciones» → su caso de estudio → sus preguntas → sus testimonios → el cierre con su botón.
//
// POR QUÉ ÉSTA. Equipo no tenía ganadora en docs/competencia/landings-por-funcion.md. Es la landing de ESTA función en el CRM que más
// usan los equipos de venta chicos, en español, y cuenta lo mismo que hace Equipo en MaKo: cada persona con su acceso («conjuntos de
// permisos» y «visibilidad»), lo que rinde cada uno y las metas del equipo. Las otras que se leyeron: la de «Sales team management» de
// Pipedrive en inglés (habla del embudo, no del equipo) y la de Pipeline CRM (larga y para la construcción y la industria).
//
// Lo que se cambió de la referencia, y por qué:
//   · Su foto del hero (gente en una oficina) es la GRABACIÓN de Equipo de la portada (public/vsl-assets/sitio/equipo.webm): la sección
//     Equipo REAL (app/equipo/EquipoView.tsx) invitando a una closer. Sus ilustraciones son pantallas REALES de MaKo: Equipo, «Invitar al
//     equipo» y el rol de una persona (banco C:/dev/bancos-portada/banco-equipo-landing, fotos.mjs) y la hoja Closing (la de
//     /vsl/closing, con sus números de ejemplo). Nombres ficticios: los closers Ana, Diego y Sofía son los de la hoja Closing de ejemplo.
//     ⚠️ La fila del coaching de cada closer NO lleva la ficha de una llamada: lo que escribe el análisis tiene que ser un análisis real
//     (la regla de Martín del 12/11 y el 13/11/2026), y la foto que había era de una llamada inventada. Va el recuadro de «falta», el
//     mismo de /vsl/closing (./closing.ts, `FALTA_ANALISIS`).
//   · Su franja de calificaciones (G2, Capterra, Gartner) y sus testimonios («Utilizado por más de 100,000 empresas») no van: MaKo no
//     inventa notas ni clientes. Su caso de estudio es el caso de Mauricio, como en todas las landings.
//   · «Planea proyectos conjuntos» y «Protege tus datos» no son de MaKo: en su lugar, dos piezas de Equipo que sí existen (cada lead con su
//     setter y su closer, y MaKo en el teléfono).
//   · Sus «metas del equipo» son, en MaKo, la tasa de cierre de cada closer de la hoja Closing (MaKo no tiene metas por persona), y su
//     «rendimiento», el análisis de cada llamada. Las dos son de MaKo Pro (TABS_SOLO_PRO): el aviso sale del plan (AVISO_PRO_CLOSING).
//   · Su «Más de 500 integraciones» es el número de integraciones de MaKo, contado (integracionesVivas, en el diseño).
//   · Su «Prueba gratis» es el botón de MaKo (./cta.ts); su barra, la del sitio (BarraGlobal), y su pie, el del sitio (PieGlobal).
// Lo que NO se promete: metas por persona, un ranking de setters (la hoja Chat Analyst existe, pero no se mira acá), que el Plan reparta
// tareas por persona (el equipo ve el MISMO tablero; el responsable de una tarea es «mía, del cliente o de un tercero») y la lista de
// «Llamadas» de Calendar (todavía dice R1 y R2, que salieron de los funnels el 16/11/2026: no se muestra).
// EL EQUIPO ES DE PRO: Essential tiene un usuario (tú) y Pro, cinco (lib/topes-plan.ts, 'equipo.usuarios'). Los números salen de ahí.
// =============================================================================

import { TOPES } from '@/lib/topes-plan';
import { AVISO_PRO_CLOSING } from './closing';
import type { LandingCompetencia } from './tipos';

/** Cuántas personas entran a MaKo en cada plan (lib/topes-plan.ts): Essential = sólo tú; Pro = tu equipo. */
export const PERSONAS_ESSENTIAL = TOPES.completo['equipo.usuarios'] ?? 1;
export const PERSONAS_PRO = TOPES.agencia['equipo.usuarios'];
/** El renglón del plan, debajo del botón (donde Pipedrive dice «Gratis, fácil de configurar…»). Sale del tope, no se escribe. */
export const RENGLON_PLAN = PERSONAS_PRO == null
  ? 'Con MaKo Pro, todo tu equipo, cada uno con su acceso.'
  : `Con MaKo Pro, hasta ${PERSONAS_PRO} personas de tu equipo, cada una con su acceso. Con MaKo Essential, solo tú.`;

/** El aviso de una fila que vende INVITAR a tu equipo (la de Equipo en la portada, app/vsl/_sitio/datos.ts): mientras MaKo Essential sea
 *  de una sola persona, invitar a alguien es de Pro, y dice hasta cuántas. Sale del tope, no se escribe. */
export const AVISO_EQUIPO = PERSONAS_ESSENTIAL > 1 ? ''
  : PERSONAS_PRO == null ? ' Con MaKo Pro, todo tu equipo.' : ` Con MaKo Pro, hasta ${PERSONAS_PRO} personas.`;

/** Qué ve cada rol: la línea de la página real (app/equipo/page.tsx, la del modal «Invitar al equipo»): el test la busca ahí. */
export const QUE_VE_CADA_ROL: readonly { rol: string; ve: string }[] = [
  { rol: 'Closer', ve: 'CRM, WhatsApp y la hoja Closing del Dashboard' },
  { rol: 'Setter', ve: 'CRM, WhatsApp, Email, Automations y la hoja Chat Analyst del Dashboard' },
  { rol: 'Admin', ve: 'todo tu negocio' },
];

const I = {
  // Los íconos de Tabler (MIT), como los demás de las landings: «users», «mail-forward», «shield-lock», «user-check», «calendar-user»,
  // «layout-kanban» y «device-mobile».
  equipo: ['M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0', 'M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2', 'M16 3.13a4 4 0 0 1 0 7.75', 'M21 21v-2a4 4 0 0 0 -3 -3.85'],
  correo: ['M12 18h-7a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v7.5', 'M3 6l9 6l9 -6', 'M15 18h6', 'M18 15l3 3l-3 3'],
  rol: ['M12 21a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3a12 12 0 0 0 8.5 3a12 12 0 0 1 -.5 9.5', 'M15 19a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v1a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z', 'M16 17v-1a2 2 0 1 1 4 0v1'],
  lead: ['M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0', 'M6 21v-2a4 4 0 0 1 4 -4h4', 'M15 19l2 2l4 -4'],
  llamadas: ['M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v6', 'M16 3v4', 'M8 3v4', 'M4 11h16', 'M17 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', 'M14 22a3 3 0 0 1 6 0', 'M4 11v8a2 2 0 0 0 2 2h4'],
  plan: ['M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z', 'M8 8v6', 'M12 8v3', 'M16 8v8'],
  telefono: ['M6 5a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2v-14z', 'M11 4h2', 'M12 17v.01'],
};

export const LANDING_EQUIPO: LandingCompetencia = {
  slug: 'equipo',
  nombre: 'Equipo · tu equipo de ventas',
  icono: I.equipo,
  referencia: { nombre: 'Pipedrive · Equipos', url: 'https://www.pipedrive.com/es/features/teams', leida: '16/11/2026' },
  bloques: [
    {
      tipo: 'hero',
      etiqueta: 'Equipo',
      // «El CRM para equipos de ventas»: con su largo (dos renglones a 1440).
      titulo: 'El CRM para tu equipo de setters y closers',
      // Sus tres párrafos: la bajada es el primero y `puntos`, los otros dos.
      bajada: 'Invitas a cada persona con su correo y le das su rol. El setter, el closer y el admin entran con su cuenta de Google, cada uno a lo suyo.',
      puntos: [
        'Cada lead lleva su setter y su closer, y cada uno entra a Calendar a ver sus llamadas.',
        `MaKo analiza cada llamada de venta y te muestra la tasa de cierre de cada closer.${AVISO_PRO_CLOSING}`,
      ],
      visual: { tipo: 'detalle', slug: 'equipo' },
    },
    {
      // «Qué buscar en un CRM para el trabajo en equipo»: su párrafo y sus cinco renglones (el comienzo en negrita es `titulo`).
      tipo: 'tarjetas',
      titulo: 'Qué necesita tu equipo de ventas',
      bajada: 'Para que cada uno venda sin pisarse con el otro, tu CRM tiene que darte esto:',
      items: [
        { titulo: 'Un rol para cada uno.', texto: 'El setter, el closer y el admin ven solo lo de su trabajo.' },
        { titulo: 'Cada lead con su dueño.', texto: 'El setter y el closer de cada lead quedan en su ficha del CRM.' },
        { titulo: 'Las llamadas de cada uno.', texto: 'Cada closer y cada setter entra a Calendar a ver las suyas.' },
        { titulo: 'Quién cierra más.', texto: `La tasa de cierre de cada closer, sin armar una planilla.${AVISO_PRO_CLOSING}` },
        { titulo: 'Altas y bajas en un minuto.', texto: 'Invitas con un correo, y suspendes o quitas a alguien desde su fila.' },
      ],
    },
    {
      // «Funciones clave del CRM para el trabajo en equipo»: seis tarjetas con su ícono, de a tres, sobre su franja lila.
      tipo: 'tarjetas',
      titulo: 'Funciones clave de MaKo para tu equipo',
      columnas: 3,
      fondo: true,
      items: [
        { icono: I.correo, titulo: 'Invita por correo', texto: 'MaKo le manda el acceso y entra con su cuenta de Google. Si el correo no sale, te deja el link para pasárselo.' },
        { icono: I.rol, titulo: 'Un rol por persona', texto: 'Setter, Closer o Admin: cada rol abre solo las pantallas de su trabajo, y se lo cambias cuando quieras.' },
        { icono: I.lead, titulo: 'Cada lead, con su setter y su closer', texto: 'Los asignas en la ficha del lead, al moverlo de etapa o a muchos leads a la vez.' },
        { icono: I.llamadas, titulo: 'Las llamadas de cada uno', texto: 'Closers y setters entran a Calendar a sus llamadas de venta, y tú ves las de cada persona.' },
        { icono: I.plan, titulo: 'El Plan, compartido', texto: 'Tu equipo entra al mismo Plan: las tareas de tu negocio, en un solo tablero.' },
        { icono: I.telefono, titulo: 'MaKo en el teléfono', texto: 'Cada uno instala MaKo con un solo link, y desde la computadora, con un QR.' },
      ],
    },
    {
      // Sus cuatro filas alternadas, cada una con su título y sus párrafos (`texto` y `puntos`). El título del bloque no se ve, como
      // en la suya (cada fila es su propia sección).
      tipo: 'filas',
      titulo: 'Cómo trabaja tu equipo en MaKo',
      slug: 'equipo',
      items: [
        {
          // «Obtén actualizaciones instantáneas del equipo».
          titulo: 'Todo tu equipo, a la vista',
          texto: 'En Equipo ves a cada persona con su rol, cuándo entró por última vez y si ya aceptó la invitación.',
          puntos: ['Si alguien deja de trabajar contigo, lo suspendes o lo quitas del equipo, y pierde el acceso a MaKo.'],
        },
        {
          // «Establecer las metas para el equipo».
          titulo: 'La tasa de cierre de cada closer',
          texto: `La hoja Closing del Dashboard junta las llamadas de todo tu equipo: tu tasa de cierre y la de cada closer, de la más alta a la más baja.${AVISO_PRO_CLOSING}`,
          puntos: ['Ves quién cierra más y a quién le conviene un repaso, sin pedirle a nadie un reporte.'],
        },
        {
          // «Rastrea el rendimiento del equipo».
          titulo: 'Lo que hace bien y lo que corrige cada closer',
          texto: `MaKo puntúa cada llamada de venta con el método SPIN y le deja a tu closer sus fortalezas, lo que tiene que mejorar y de 3 a 5 recomendaciones para la próxima.${AVISO_PRO_CLOSING}`,
          puntos: ['Cada nota trae la frase de la llamada y su minuto: sabes qué pasó sin escucharla entera.'],
        },
        {
          // «Personaliza lo que los usuarios pueden ver y hacer».
          titulo: 'Cada rol ve solo lo suyo',
          texto: QUE_VE_CADA_ROL.map((r, i) => `${i === 0 ? 'El' : 'el'} <strong>${r.rol}</strong> ve ${r.ve}`).join('; ') + '.',
          puntos: ['Le cambias el rol a alguien desde su fila, y lo que ve cambia con él. Si entra a una pantalla que no es de su rol, MaKo no se la abre.'],
        },
      ],
    },
    // «Más de 500 integraciones»: el número de MaKo lo cuenta el diseño (integracionesVivas).
    { tipo: 'logos', titulo: 'Tus apps, conectadas', items: [] },
    // Su caso de estudio («Cómo Pipedrive ayudó a 360 Payments…»): el caso de Mauricio.
    { tipo: 'caso' },
    // Las de la portada (las pone el registro y LandingCompetencia).
    // (Su título dice «…sobre el CRM para el trabajo en equipo»; aquí van las de la portada, que no son del equipo: el título no lo promete.)
    { tipo: 'preguntas', titulo: 'Preguntas frecuentes', items: [] },
  ],
  metaTitle: 'Equipo en MaKo: tu equipo de setters y closers, cada uno con su rol',
  metaDesc: `Invita a tu equipo por correo, dale a cada uno su rol (Setter, Closer o Admin) y mira la tasa de cierre de cada closer. ${RENGLON_PLAN}`,
};
