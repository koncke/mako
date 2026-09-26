// =============================================================================
// /admin/friccion — dónde el CRM te frena, para decidir en 2 minutos
// =============================================================================
// Esto primero lo metí como un .md en /admin/docs y estuvo mal: ese navegador es
// para documentos de programación —párrafos largos, letra chica, 40 documentos en
// la lista— y el link ni siquiera abría el mío, caía en AGENTS.md. Martín: «te pedí
// poca fricción y que se lea simple el html y mirá esto».
//
// Así que esta pantalla NO es un documento: es una lista de decisiones. Una línea
// por freno, lo que cuesta a la derecha, y arriba las tres que necesitan su
// respuesta. El detalle con archivo:línea vive en docs/friccion-crm.md — acá sería
// ruido, porque él no va a abrir un archivo desde esta pantalla.

import { redirect } from 'next/navigation';
import type { CSSProperties } from 'react';
import { getSesionAdmin } from '@/lib/auth';
import { Pagina, PageHeader } from '@/app/_ui';

export const dynamic = 'force-dynamic';

const MONO = "'Geist Mono', monospace";

/** Las tres que no puedo decidir yo: salen de reglas que pidió él. */
const DECISIONES = [
  {
    que: 'Agendar una reunión',
    detalle: 'Menú de 3 opciones y asistente de 3 pasos para mover un lead una columna. Y si la agendaste por fuera, te obliga a escribir por qué.',
    costo: '~10 clics',
    unidad: 'por día',
    pregunta: '¿Ese texto obligatorio lo quieres como freno a propósito, sabiendo que nada lo lee?',
  },
  {
    que: 'Confirmar cada arrastre',
    detalle: 'Mueves una card y hay que confirmar. Lo pediste el 06/08.',
    costo: '5 clics',
    unidad: 'por día',
    pregunta: '¿Vale también para algo que ya se deshace en 5 segundos y queda en el historial?',
  },
  {
    que: 'Corregir un teléfono',
    detalle: 'La ficha no deja editar nada: otra pantalla, prender «Editar», guardar, confirmar en un modal. Al volver pierdes el scroll.',
    costo: '5 clics + 2 recargas',
    unidad: 'cada vez',
    pregunta: '¿La previsualización del cambio la quieres antes, o un «deshacer» después?',
  },
];

/** Bugs y esperas: no protegen nada, no necesito permiso. */
const SIN_PERMISO = [
  'El «Revisando qué datos faltan…» que tapa el asistente y no se puede cerrar',
  'La pantalla «✓ Datos actualizados», que solo repite lo que acabás de hacer',
  'Escape cierra la ficha entera y se lleva lo que estabas escribiendo',
  'El número rojo que late para siempre, y el punto rojo repetido 3 veces en la ficha',
];

type Item = { que: string; dato: string };
const SACAR: Item[] = [
  { que: 'Dos pantallas cuya única acción posible es «no lo tengo»', dato: '9 de cada 10 Ganados' },
  { que: 'Un pendiente imposible de resolver: respuestas de Calendly (R2)', dato: '20 de 31 leads' },
  { que: 'La pestaña «Deal Details» que solo avisa que está vacía', dato: '1.124 de 1.138 leads' },
  { que: 'Siete de las ocho pestañas de la ficha, en inglés', dato: 'siempre' },
  { que: 'La pestaña «Notas»', dato: '4 notas en toda la base' },
  { que: 'El cartel que explica qué es una «ventana informativa»', dato: 'jerga nuestra' },
  { que: '«Este dato entrena las campañas de Meta (CAPI)…»', dato: '26 leads hoy' },
  { que: 'El rojo de Pendientes: el mismo color que «Perdido» y que los errores', dato: 'siempre' },
  { que: 'Errores crudos que no se pueden cerrar ni resolver', dato: 'cuando algo falla' },
];

const CAMBIAR: Item[] = [
  { que: 'Entrar al CRM: pantalla vieja hasta que terminan tres olas de consultas', dato: 'cada entrada' },
  { que: 'El tablero abre con 1.138 tarjetas; las que trabajas son ~34', dato: 'siempre' },
  { que: 'El asistente pregunta si quieres que busque solo — ya busca solo', dato: 'cada «Solucionar»' },
  { que: '«Ignorar» un aviso pide confirmación de 3 renglones, siendo reversible', dato: '21 leads ignorados' },
  { que: 'Cada fila del worklist es un párrafo', dato: 'siempre' },
  { que: 'El cartel del costo de IA tapa la tarjeta de MaKo', dato: 'todo el día' },
  { que: 'Pop-up con sonido de WhatsApp encima del tablero', dato: 'cada mensaje' },
  { que: '«+ Nuevo lead» se lleva la pantalla; al volver pierdes filtro y scroll', dato: 'cada alta' },
  { que: 'Un Excel se rechaza y te manda a convertirlo a CSV', dato: 'cada lista' },
  { que: 'Exportar: el botón gris mientras cuenta, y el formato se pregunta siempre', dato: 'cada exportación' },
];

const MANTENER: Item[] = [
  { que: 'Las dos preguntas de Meta al mover', dato: 'lo único que le llega a Meta' },
  { que: 'El motivo de la pérdida, escrito a mano', dato: 'solo lo tienes tú' },
  { que: 'La fecha límite de «Nutrición - Manual»', dato: 'el plazo ES la etapa' },
  { que: 'La confirmación antes de generar Insights', dato: 'gasta plata de IA' },
  { que: 'El comprobante al marcar una cuota', dato: 'da la fecha real del cobro' },
  { que: 'La pantalla final del reagendado', dato: 'dice si Google movió el evento' },
];

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 22px' };
const rotulo: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--dim)' };

function Bloque({ titulo, punto, items }: { titulo: string; punto: string; items: Item[] }) {
  return (
    <section style={{ ...card, padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '15px 22px', borderBottom: '1px solid var(--border)' }}>
        <span aria-hidden style={{ width: 9, height: 9, borderRadius: 999, background: punto }} />
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{titulo}</span>
        <span style={{ ...rotulo, marginLeft: 'auto' }}>{items.length}</span>
      </div>
      {items.map((i) => (
        <div key={i.que} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 18, padding: '12px 22px', borderTop: '1px solid var(--border)' }}>
          <span style={{ fontSize: 14.5, color: 'var(--ink)', lineHeight: 1.45 }}>{i.que}</span>
          <span style={{ flex: 'none', fontSize: 12.5, color: 'var(--faint)', whiteSpace: 'nowrap' }}>{i.dato}</span>
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

  return (
    <Pagina>
      <PageHeader
        titulo="Fricción del CRM"
        proposito="Dónde te frena, ordenado por lo que más molesta. Decide las tres de arriba y el resto lo hago."
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
        <section>
          <div style={{ ...rotulo, marginBottom: 12 }}>Necesito que decidas</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
            {DECISIONES.map((d) => (
              <div key={d.que} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{d.que}</div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--bad)', letterSpacing: '-.02em' }}>{d.costo}</div>
                  <div style={{ ...rotulo, fontSize: 10.5 }}>{d.unidad}</div>
                </div>
                <p style={{ margin: 0, fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.5 }}>{d.detalle}</p>
                <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink)', fontWeight: 600, lineHeight: 1.5 }}>{d.pregunta}</p>
              </div>
            ))}
          </div>
        </section>

        <section style={{ ...card, background: 'var(--surface-2)' }}>
          <div style={{ ...rotulo, marginBottom: 10 }}>Me lo llevo sin preguntarte · bugs y esperas</div>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 7 }}>
            {SIN_PERMISO.map((t) => <li key={t} style={{ fontSize: 14.5, color: 'var(--ink)', lineHeight: 1.45 }}>{t}</li>)}
          </ul>
        </section>

        <Bloque titulo="Sacar — no protegen nada" punto="var(--bad)" items={SACAR} />
        <Bloque titulo="Cambiar de forma — avisar en vez de frenar" punto="var(--warn)" items={CAMBIAR} />
        <Bloque titulo="Mantener — evita un dato falso" punto="var(--good)" items={MANTENER} />

        <p style={{ margin: 0, fontSize: 13, color: 'var(--faint)', lineHeight: 1.6 }}>
          Relevado el 25/09 sobre el código, con los números de la base. El detalle de cada uno, con archivo y línea,
          está en <code style={{ fontFamily: MONO, fontSize: 12 }}>docs/friccion-crm.md</code>.
        </p>
      </div>
    </Pagina>
  );
}
