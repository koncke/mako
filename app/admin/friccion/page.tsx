// =============================================================================
// /admin/friccion — dónde el CRM te frena, para decidir en 2 minutos
// =============================================================================
// Primero fue un .md en /admin/docs y estuvo mal: ese navegador es para documentos
// de programación —párrafos largos, letra chica, 40 documentos en la lista— y el
// link ni siquiera abría el mío. Martín: «te pedí poca fricción y que se lea simple
// el html y mirá esto».
//
// La v2 arregló el texto y rompió la forma: tres CARDS grandes arriba (las que
// esperan su respuesta) y tres bloques de lista abajo, con un <ul> suelto en el
// medio. Martín, el 27/09: «No entiendo las 3 cards grandes con la diferencia de la
// lista de abajo… ¿Por qué no pusiste todo en una lista o todas en cards? ¿O las de
// abajo ya las aplicaste?».
//
// Las dos mitades de ese reporte importan, y la segunda más:
//
//  1. UNA CARD NO DICE «esto te toca a vos», DICE «esto es más importante». La
//     distinción que yo quería marcar —tu decisión contra mi propuesta— no se puede
//     pintar con el tamaño de la caja. Y la regla de la casa ya lo decía: un grupo de
//     cosas del mismo tipo es una lista, y dos piezas con el mismo esqueleto (título
//     + texto) son UNA pieza con dos configuraciones. Acá: todo es fila. Lo que
//     distingue a las tres suyas es que están primeras y que la fila termina en la
//     pregunta.
//
//  2. NO SE PODÍA SABER QUÉ ESTABA HECHO. Esa es la peor falla y no era de forma:
//     la pantalla no decía en ningún lado que NADA de esto está aplicado, así que la
//     pregunta «¿o las de abajo ya las aplicaste?» no tenía respuesta posible
//     mirándola. Ahora lo dice el `estado` del header, que es lo primero que se lee.
//     Verificado el 27/09: los 4 commits del CRM desde el relevamiento tocan
//     `page.tsx`, `CrmBoard` y `CrmToolbar` (el selector de oferta) y ninguno toca
//     `StageMoveDialog.tsx`, `stage-requirements.ts` ni la ficha, que es donde vive
//     casi toda esta lista.
//
// El detalle con archivo:línea vive en docs/friccion-crm.md — acá sería ruido,
// porque nadie va a abrir un archivo desde esta pantalla.

import { redirect } from 'next/navigation';
import type { CSSProperties } from 'react';
import { getSesionAdmin } from '@/lib/auth';
import { Pagina, PageHeader } from '@/app/_ui';

export const dynamic = 'force-dynamic';

const MONO = "'Geist Mono', monospace";

/**
 * Una fila de la lista, y es la MISMA en los cinco grupos.
 *
 * `costo` y `pregunta` son opcionales y no cambian la forma: agregan un renglón.
 * Ese es todo el mecanismo que antes eran dos lenguajes visuales distintos.
 */
type Fila = {
  que: string;
  ejemplo: string;
  /** Lo que cuesta atravesarlo. Sólo donde está medido. */
  costo?: string;
  /** Lo que necesito que conteste. Sólo en el primer grupo. */
  pregunta?: string;
};

const DECIDIS: Fila[] = [
  {
    que: 'Agendar una reunión',
    ejemplo: 'Arrastras a Carlos Mejía a Agenda R1 y no se mueve: primero un menú de 3 opciones, después un asistente de 3 pasos. Si eliges «ya está agendada», no te deja seguir hasta escribir por qué no usaste Calendly.',
    costo: '~10 clics por día',
    pregunta: '¿Ese texto obligatorio lo quieres como freno a propósito, sabiendo que nada lo lee?',
  },
  {
    que: 'Confirmar cada arrastre',
    ejemplo: 'Arrastras a Gerardo Avila a Ganado y se abre «Mover a Ganado a Gerardo Avila»: hay que apretar otra vez. Lo pediste el 06/08, y desde entonces el toast «Deshacer» dura 5 segundos y el movimiento queda en el historial.',
    costo: '5 clics por día',
    pregunta: '¿Vale también para algo que ya se deshace en 5 segundos y queda en el historial?',
  },
  {
    que: 'Corregir un teléfono',
    ejemplo: 'A Alejandro Prado le quedó el teléfono con caracteres raros. En la ficha el teléfono es un botón de COPIAR: hay que ir a otra pantalla, prender «Editar», guardar, confirmar los cambios en un modal, y al volver el tablero se recarga entero.',
    costo: '5 clics + 2 recargas, cada vez',
    pregunta: '¿La previsualización del cambio la quieres antes, o un «deshacer» después?',
  },
];

const HAGO: Fila[] = [
  { que: 'El «Revisando qué datos faltan…» que tapa el asistente',
    ejemplo: 'No avanza, no vuelve y no se puede cerrar. Hay que recargar la página.' },
  { que: 'La pantalla «✓ Datos actualizados» al terminar',
    ejemplo: 'Una pantalla más para decir lo que acabas de hacer. Sale al completar datos; arrastrando un lead de etapa no aparece.' },
  { que: 'Escape cierra la ficha entera',
    ejemplo: 'Aprietas Escape dentro de un cartel y se cierra la ficha, con lo que estabas escribiendo.' },
  { que: 'El rojo de Pendientes, y el mismo aviso 3 veces',
    ejemplo: 'El contador late en rojo sin parar, y dentro de la ficha el aviso aparece repetido.' },
];

const SACAR: Fila[] = [
  { que: 'Dos pantallas cuya única acción posible es «no lo tengo»',
    ejemplo: 'Cerraste a Jesús Cendejas: el asistente pide documento fiscal y comprobante. No los tienes → dos toques a «No lo tengo». Pasa en 9 de cada 10 Ganados.' },
  { que: 'Un pendiente que no se puede resolver nunca',
    ejemplo: 'Gerardo Avila tuvo R2 y no llenó el formulario de Calendly: arrastra «faltan respuestas R2» para siempre. Le pasa a 20 de tus 31 leads con R2.' },
  { que: 'Una pestaña entera que solo dice que está vacía',
    ejemplo: 'Abres a Reemberto Fontes → «Deal Details» solo avisa que se habilita al pasar a Facturando. Es así en 1.124 de 1.138 leads.' },
  { que: 'Siete de las ocho pestañas de la ficha, en inglés',
    ejemplo: 'Overview · Tracking · Meetings · Chat · Insights · Deal Details · Change History. La única en español es «Notas».' },
  { que: 'La pestaña «Notas»',
    ejemplo: '4 notas en toda la base, de todos los clientes, en toda la historia. Ese seguimiento lo escribes en WhatsApp.' },
  { que: 'Un cartel que explica jerga nuestra',
    ejemplo: 'Tres frases arriba de la ficha explicando qué es una «ventana informativa». Y el texto ni siquiera es igual en el pop-up que en la ficha.' },
  { que: 'Una amenaza en el subtítulo de una pregunta',
    ejemplo: '«Este dato entrena las campañas de Meta (CAPI) y es la última vez que te lo podemos preguntar». Hoy la verían 26 leads.' },
  { que: 'Pendientes pintado del color de los errores',
    ejemplo: 'Borde rojo, contador rojo y botón «Solucionar» rojo lleno: el mismo rojo que «Perdido». La lista informa, el marco grita.' },
  { que: 'Errores que no se pueden cerrar ni resolver',
    ejemplo: '«No se pudo leer Supabase: <mensaje técnico>» en una barra que no se cierra. Y si falla el chat del lead, no hay botón de reintentar.' },
];

const CAMBIAR: Fila[] = [
  { que: 'Entrar al CRM: pantalla vieja, sin aviso de que está cargando',
    ejemplo: 'Haces clic y no pasa nada —ni esqueleto ni spinner— hasta que el servidor lee tus 1.142 leads. Y vuelve a pasar después de cada cambio.' },
  { que: 'El tablero abre con todo',
    ejemplo: 'Se dibujan 1.142 tarjetas: las 26 de Activo quedan entre 1.089 de nutrición y 23 descartadas. Apagar una banda es un clic DESPUÉS de dibujarla, y no se recuerda.' },
  { que: 'El asistente pregunta si quieres que busque solo',
    ejemplo: '«¿Buscamos los datos automáticamente?» — MaKo ya engancha Fathom solo en cada carga del CRM. La mitad de lo que ofrece ya pasó.' },
  { que: '«Ignorar» un aviso pide confirmación',
    ejemplo: 'Sacas un aviso de encima y hay una pantalla más, sobre algo que el propio texto dice que es reversible. Lo usas: 21 leads ignorados.' },
  { que: 'Cada fila del worklist es un párrafo',
    ejemplo: '«La Reunión 1 del 12/09 ya pasó y todavía no se marcó cómo salió · pendiente: Setter asignado · Empresa · Link de Fathom (R1)».' },
  { que: 'El cartel del costo de IA tapa la tarjeta de MaKo',
    ejemplo: 'Los dos viven abajo a la derecha: el cartel negro con los dólares se pone encima justo cuando aparece una confirmación nueva.' },
  { que: 'Pop-up con sonido de WhatsApp encima del tablero',
    ejemplo: 'Mientras miras el CRM salta una tarjeta con foto y «Te envió un mensaje», y suena. Se apaga, pero en otra pantalla.' },
  { que: 'Cargar un lead a mano te saca del tablero',
    ejemplo: '«+ Nuevo lead» navega a otra página; al volver perdiste el filtro, la búsqueda y el scroll, y se releen los 1.142 leads.' },
  { que: 'Un Excel se rechaza',
    ejemplo: 'Arrastras un .xlsx y dice «guárdala como CSV». Un PDF escaneado sí lo lee. Y las listas llegan en Excel.' },
  { que: 'Exportar pregunta de más y espera de más',
    ejemplo: 'Eliges una receta ya armada y todavía pregunta en qué formato; el botón de descargar queda gris hasta que termina de contar 1.142 leads.' },
];

const DEJAR: Fila[] = [
  { que: 'Las dos preguntas de Meta al mover un lead',
    ejemplo: '«¿Asistió a la R1?» y «¿Era calificado?». Son los únicos dos datos del CRM que le llegan a Meta, y ya son opcionales: el botón mueve igual.' },
  { que: 'El motivo de la pérdida, escrito a mano',
    ejemplo: 'La categoría sola («Precio») no sirve después; el detalle es lo que se lee en el historial. Es el único dato que no se puede deducir de ningún lado.' },
  { que: 'La fecha límite de «Nutrición - Manual»',
    ejemplo: 'El plazo ES la etapa: cuando vence, el lead vuelve al worklist. Sin fecha queda invisible para siempre.' },
  { que: 'La confirmación antes de generar Insights',
    ejemplo: 'Gasta plata de IA y son dos llamadas encadenadas: si cierras la ficha a mitad, se pierde el resultado y se pagó igual.' },
  { que: 'El comprobante al marcar una cuota pagada',
    ejemplo: 'Da la fecha y hora REALES del cobro; sin él queda la fecha de cuando alguien se acordó de marcarlo. Ya se puede saltear con «Ingresar manual».' },
  { que: 'La pantalla final del reagendado',
    ejemplo: 'Dice si Google movió el evento y avisó al invitado — algo que no se sabía al confirmar, porque el CRM guarda primero y Google contesta hasta 28 s después.' },
];

/**
 * Los cinco grupos, y el orden es el de lo que necesito de él: primero contestar,
 * después mirar tres propuestas. Cada título es un VERBO que dice qué pasa con esas
 * filas — antes eran cuatro rótulos de categorías distintas («Sacar», «Me lo llevo»)
 * y no se podía saber cuáles esperaban algo suyo.
 *
 * El punto de color dice a qué grupo pertenece la fila, NO qué tan grave es. Por eso
 * los dos primeros no entran en la escala rojo/ámbar/verde: no son severidades, son
 * quién decide.
 */
const GRUPOS: Array<{ titulo: string; punto: string; filas: Fila[] }> = [
  { titulo: 'Espera tu respuesta', punto: 'var(--primary)', filas: DECIDIS },
  { titulo: 'Lo hago sin preguntarte', punto: 'var(--dim)', filas: HAGO },
  { titulo: 'Propongo sacarlo — no protege nada', punto: 'var(--bad)', filas: SACAR },
  { titulo: 'Propongo cambiarle la forma — avisar en vez de frenar', punto: 'var(--warn)', filas: CAMBIAR },
  { titulo: 'Propongo dejarlo — evita un dato falso', punto: 'var(--good)', filas: DEJAR },
];

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 };
const rotulo: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--dim)' };

function Grupo({ titulo, punto, filas }: { titulo: string; punto: string; filas: Fila[] }) {
  return (
    <section style={{ ...card, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '15px 22px', borderBottom: '1px solid var(--border)' }}>
        <span aria-hidden style={{ width: 9, height: 9, borderRadius: 999, background: punto, flex: 'none' }} />
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{titulo}</span>
        <span style={{ ...rotulo, marginLeft: 'auto', flex: 'none' }}>{filas.length}</span>
      </div>
      {filas.map((f) => (
        <div key={f.que} style={{ padding: '13px 22px', borderTop: '1px solid var(--border)' }}>
          {/* El costo va en su propia columna y NO crece: el texto es el que cede.
              Antes era un número rojo de 22px, que es la escala que tenía cuando esto
              era una card — al volverse una fila nadie se la bajó. */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, alignItems: 'baseline' }}>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4 }}>{f.que}</div>
            {f.costo && (
              <div style={{ flex: 'none', fontSize: 12.5, fontWeight: 600, color: 'var(--bad)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {f.costo}
              </div>
            )}
          </div>
          {/* El ejemplo con nombres de SU base es lo que hace entendible la línea de
              arriba sin un párrafo: «no se entiende» fue el feedback de la v1. */}
          <div style={{ marginTop: 3, fontSize: 13, color: 'var(--dim)', lineHeight: 1.5 }}>{f.ejemplo}</div>
          {f.pregunta && (
            <div style={{ marginTop: 7, fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.5 }}>{f.pregunta}</div>
          )}
        </div>
      ))}
    </section>
  );
}

export default async function FriccionPage() {
  // Mismo guard que el resto de /admin: es una lista sobre nuestro propio producto,
  // ningún cliente la tiene que ver.
  const admin = await getSesionAdmin();
  if (!admin) redirect('/inicio');

  const total = GRUPOS.reduce((n, g) => n + g.filas.length, 0);

  return (
    <Pagina>
      <PageHeader
        titulo="Fricción del CRM"
        proposito="Dónde te frena, ordenado por lo que más molesta. Contesta las tres primeras y el resto lo hago."
        // Lo primero que se lee, porque es lo que la versión anterior no contestaba.
        estado={
          <span style={{ fontSize: 13, color: 'var(--ink)' }}>
            <b style={{ fontWeight: 700 }}>Nada de esto está aplicado.</b>{' '}
            <span style={{ color: 'var(--dim)' }}>Los {total} siguen en el CRM tal cual.</span>
          </span>
        }
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {GRUPOS.map((g) => <Grupo key={g.titulo} {...g} />)}

        <p style={{ margin: 0, fontSize: 13, color: 'var(--faint)', lineHeight: 1.6 }}>
          Relevado el 25/09 sobre el código, con los números de la base. Verificado el 27/09 contra los cuatro commits
          del CRM posteriores: ninguno toca lo de esta lista. El detalle de cada uno, con archivo y línea, está en{' '}
          <code style={{ fontFamily: MONO, fontSize: 12 }}>docs/friccion-crm.md</code>.
        </p>
      </div>
    </Pagina>
  );
}
