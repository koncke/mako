'use client';

// =============================================================================
// ChecklistClientes — el onboarding de la tab Clientes, como lista arriba de la cartera
// =============================================================================
// Regla de la casa: toda tab tiene onboarding (.claude/skills/tab-onboarding), y #109 lo pidió para
// esta. NO tapa la tab: es una lista, molde de la tab Curso (./curso/ChecklistCurso.tsx, de donde
// sale el renglón), porque el ws1 entró con su cartera entera armada y un wizard encima se la
// escondería. Se dibuja mientras falte algún paso y se va sola cuando el último se cumple.
//
// Los tres pasos y por qué cada uno, en lib/tab-onboarding-catalogo.ts (`customer-success`); qué
// dato cierra cada uno, en ./onboarding-clientes.ts. Esta lista sólo dibuja y ofrece el camino.
//
// ⚠️ NINGÚN BOTÓN DE ACÁ ESCRIBE NADA POR SU CUENTA: «Ir al CRM» navega (el producto se crea allá,
// con su embudo), «Cargar un cliente» abre el mismo alta de siempre y «Abrir una» abre la ficha
// del primero — lo que cierra el ensayo es abrirla, por el camino de siempre.
//
// Copy de pantalla: español neutro de tú, y corto (AGENTS.md: el porqué va acá, no en la UI).

import { Section, Eyebrow, Button, ButtonLink } from '@/app/_ui';
import { Paso } from './curso/ChecklistCurso';
import type { OnboardingClientes } from './onboarding-clientes';

export function ChecklistClientes({ estado, onCargar, onAbrirFicha }: {
  estado: OnboardingClientes;
  /** Abre el alta de un cliente. */
  onCargar: () => void;
  /** Abre la ficha de algún cliente. `undefined` = no hay ninguno que abrir todavía. */
  onAbrirFicha?: () => void;
}) {
  return (
    <Section card>
      <div style={{ marginBottom: 4 }}><Eyebrow>Configura tu cartera</Eyebrow></div>

      <Paso hecho={estado.cs_servicio} titulo="Tu servicio"
        accion={!estado.cs_servicio ? <ButtonLink size="sm" variant="secondary" href="/crm">Ir al CRM</ButtonLink> : undefined}>
        {estado.cs_servicio ? 'Con sus etapas.' : 'Crea tu producto en el CRM.'}
      </Paso>

      <Paso hecho={estado.cs_clientes} titulo="Tus clientes"
        accion={!estado.cs_clientes ? <Button size="sm" variant="secondary" onClick={onCargar}>Cargar un cliente</Button> : undefined}>
        {estado.cs_clientes ? 'Listo.' : 'Carga uno o gana una venta en el CRM.'}
      </Paso>

      <Paso hecho={estado.cs_ficha} titulo="Ficha de un cliente"
        accion={!estado.cs_ficha && onAbrirFicha ? <Button size="sm" variant="primary" onClick={onAbrirFicha}>Abrir una</Button> : undefined}>
        {estado.cs_ficha ? 'Revisada.' : 'Abre la ficha de un cliente.'}
      </Paso>
    </Section>
  );
}
