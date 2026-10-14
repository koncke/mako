'use client';

// =============================================================================
// La acción del día — la zona derecha de la cabecera
// =============================================================================
// ⚠️ REHECHO DOS VECES Y CONVIENE LEER LAS DOS RAZONES.
//
// 07/09/2026 — la primera versión tenía, arriba del titular, un rótulo `AHORA` en
// monospace y una pastilla «sale de: X»; y abajo, una grilla de tres columnas con
// rótulos en monospace (DEBERÍA MOVER · QUIÉN · SE REVISA). Tres vetos duros de la
// casa en el mismo bloque: la cejilla arriba de un título («a BAN, not a default:
// no brief earns it back»), el monospace como disfraz de «técnico», y el filete de
// color de 4 px. Salieron los tres y no vuelven.
//
// 08/09/2026 — este bloque VIVE ADENTRO DE LA CABECERA OSCURA, y eso cambia dos
// cosas que no son cosméticas:
//
//   1. LA PALETA SE DA VUELTA. Sobre `--sidebar` los grises del tema claro miden
//      2,09:1 (`--dim`) y 3,61:1 (`--faint`): ilegible y al borde. Acá adentro va
//      `--on-sidebar` para lo que se lee y `--sidebar-text` para lo secundario, que
//      además son los dos únicos que NO se dan vuelta cuando cambia el tema. Un solo
//      `--dim` heredado deja texto invisible y no se nota hasta que alguien prueba
//      el otro tema.
//   2. EL TAMAÑO BAJA DE 40 px A 26. No es una degradación: al lado del número del
//      objetivo, 40 px eran dos títulos peleando y la pantalla dejaba de tener un
//      orden de lectura. Lo que pierde en tamaño lo gana en posición y contraste —
//      está sobre la única isla oscura de la app y se lleva el único botón azul
//      lleno de la pantalla, así que sigue siendo inequívocamente LA acción.
//
// Los SEIS CAMPOS de la tarea #523 siguen enteros —son contrato del dueño— pero
// visible queda sólo la RAZÓN, que es la mitad que sostiene la orden. Los otros
// cuatro se abren. Cumplir el contrato no puede significar convertir la pantalla de
// entrada en un formulario.
//
// El orden del copy sale de `clarify.md`: hecho esencial → acción → contexto. Por
// eso arriba está QUÉ HACER y no de dónde salió.
// =============================================================================

import { useState } from 'react';
import { LinkIntegracion } from '@/app/_components/ConectarIntegracion';
import type { Foco } from '@/lib/focus';
import { ORIGEN_LABEL } from '@/lib/focus';

/**
 * El nivel se lee en un punto, no en un filete de 4 px ni en un fondo de color. Es
 * la cualidad «calmada» del documento de rediseño: no convertir cada señal en una
 * alarma. Los tres pasan el piso de 3:1 sobre `--sidebar` como elemento gráfico.
 */
const COLOR: Record<Foco['nivel'], string> = {
  rojo: 'var(--bad)',
  ambar: 'var(--warn-fill)',
  neutro: 'var(--good)',
};

export function Ahora({ foco }: { foco: Foco }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div>
      <h2 style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        fontWeight: 600,
        fontSize: 'clamp(20px, 2.2vw, 26px)',
        letterSpacing: '-0.02em', lineHeight: 1.25,
        margin: '0 0 10px', color: 'var(--on-sidebar)',
      }}>
        <span aria-hidden style={{
          flex: 'none', width: 10, height: 10, borderRadius: '50%',
          background: COLOR[foco.nivel], marginTop: '0.5em',
        }} />
        <span>{foco.accion}</span>
      </h2>

      {/* La razón, y nada más. Sin `maxWidth` propio: la columna ya está acotada por
          la grilla de la cabecera, y un tope adentro de una caja más angosta es el
          hueco muerto que la regla del max-width viene a evitar. */}
      <p style={{
        fontSize: 'var(--fs-md)', color: 'var(--sidebar-text)', lineHeight: 1.5,
        margin: '0 0 20px', paddingLeft: 22,
      }}>
        {foco.razon}
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', paddingLeft: 22 }}>
        {/* Si la acción nombra una integración (`/integraciones?abrir=…`), abre su modal acá: nunca se sale de la tab. */}
        <LinkIntegracion href={foco.href} style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '12px 20px', borderRadius: 'var(--r-md)', minHeight: 'var(--touch)',
          background: 'var(--primary)', color: 'var(--on-primary)',
          fontSize: 'var(--fs-card)', fontWeight: 600, textDecoration: 'none',
        }}>
          {foco.hrefLabel} →
        </LinkIntegracion>

        <button type="button" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto}
          style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: 'var(--fs-sm)', color: 'var(--sidebar-text)', cursor: 'pointer' }}>
          {abierto ? 'Ocultar el detalle' : 'Por qué esta y no otra'}
        </button>
      </div>

      {abierto && (
        // Los cuatro campos restantes del contrato. En prosa y un renglón por campo:
        // lo que hacía que esto se leyera como un formulario era la grilla de tres
        // columnas con rótulos en versalitas, no los datos.
        <dl style={{
          margin: '18px 0 0 22px', padding: '14px 0 0',
          borderTop: '1px solid var(--sidebar-line)',
          display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '9px 16px',
          fontSize: 'var(--fs-sm)', lineHeight: 1.5,
        }}>
          <dt style={{ color: 'var(--sidebar-text)' }}>Sale de</dt>
          <dd style={{ margin: 0, color: 'var(--on-sidebar)' }}>{ORIGEN_LABEL[foco.origen]}</dd>

          <dt style={{ color: 'var(--sidebar-text)' }}>Debería mover</dt>
          <dd style={{ margin: 0, color: 'var(--on-sidebar)' }}>{foco.resultadoEsperado}</dd>

          <dt style={{ color: 'var(--sidebar-text)' }}>Quién</dt>
          <dd style={{ margin: 0, color: 'var(--on-sidebar)' }}>{foco.responsable}</dd>

          {foco.progreso && (<>
            <dt style={{ color: 'var(--sidebar-text)' }}>Progreso</dt>
            <dd style={{ margin: 0, color: 'var(--on-sidebar)' }}>{foco.progreso}</dd>
          </>)}

          <dt style={{ color: 'var(--sidebar-text)' }}>Se revisa</dt>
          <dd style={{ margin: 0, color: 'var(--on-sidebar)' }}>{foco.siguienteRevision}</dd>
        </dl>
      )}
    </div>
  );
}
