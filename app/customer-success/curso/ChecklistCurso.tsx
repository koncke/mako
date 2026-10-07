'use client';

// =============================================================================
// ChecklistCurso — el onboarding de la tab Curso, como lista arriba de las clases
// =============================================================================
// Regla de la casa: toda tab tiene onboarding (.claude/skills/tab-onboarding). Éste NO tapa la
// tab: es una lista, molde Reels/Landing Generator, porque el curso se arma USÁNDOLO — y porque
// el ws1 entró con 107 clases ya cargadas: un wizard encima de eso le escondería su propio curso.
//
// Los cuatro pasos y por qué cada uno, en lib/tab-onboarding-catalogo.ts (`cs-curso`); qué dato
// cierra cada uno, en ./onboarding-curso.ts. Esta lista sólo dibuja y ofrece el camino.
//
// ⚠️ «TU PROGRAMA» Y «TUS VIDEOS» CUENTAN EL PRODUCTO ELEGIDO, como la cabecera de la tab: con dos
// productos, contar el workspace le decía «107 clases» a uno que tiene 0 (`checklistCurso`).
//
// ⚠️ NINGÚN BOTÓN DE ACÁ MANDA NADA. «Tu primer alumno» lleva a Avance, donde una persona elige
// a quién invitar: la invitación es un email real por Resend y no depende del interruptor de
// WhatsApp del workspace (docs/hallazgos-customer-success.md).
//
// Copy de pantalla: español neutro de tú, y corto (AGENTS.md: el porqué va acá, no en la UI).

import type { ReactNode } from 'react';
import { Section, Eyebrow, Button, ButtonLink, Tag } from '@/app/_ui';
import { Icon } from '@/app/_components/icons';

/**
 * Lo que la página sabe del onboarding (los pasos ya anotados, del WORKSPACE). `null` = no se
 * dibuja. Decide si la lista aparece; lo que la lista cuenta sale de las clases del producto.
 */
export type OnboardingCurso = {
  programa: boolean;
  vista: boolean;
  invitar: boolean;
  /** A cuántos clientes se invitó (para decirlo cuando el paso está hecho). */
  invitados: number;
};

export function ChecklistCurso({ clases, conVideo, vista, invitar, hrefVista, onAgregarClase, onIrAAvance }: {
  /** Clases del PRODUCTO ELEGIDO, y cuántas con un video que el portal dibuja. */
  clases: number;
  conVideo: number;
  vista: boolean;
  /**
   * Si el paso está hecho y a cuántos. `n` en 0 con `hecho` = lo dice lo anotado y el conteo no
   * se pudo leer: se dice «hecho» sin inventar un número.
   */
  invitar: { hecho: boolean; n: number };
  /** La vista previa del alumno del producto elegido. `null` = no hay qué ver todavía. */
  hrefVista: string | null;
  onAgregarClase?: () => void;
  onIrAAvance: () => void;
}) {
  const programa = clases > 0;
  const videos = conVideo > 0;
  return (
    <Section card>
      <div style={{ marginBottom: 4 }}><Eyebrow>Configura tu curso</Eyebrow></div>

      <Paso hecho={programa} titulo="Tu programa"
        accion={!programa && onAgregarClase ? <Button size="sm" variant="secondary" onClick={onAgregarClase}>Agregar clase</Button> : undefined}>
        {programa ? `${clases} ${clases === 1 ? 'clase' : 'clases'}.` : 'Agrega la primera clase.'}
      </Paso>

      <Paso hecho={videos} titulo="Tus videos" opcional>
        {videos ? `${conVideo} con video.` : 'Pega un link o sube el video.'}
      </Paso>

      <Paso hecho={vista} titulo="Vista del alumno"
        accion={!vista && hrefVista ? <ButtonLink size="sm" variant="primary" href={hrefVista}>Ver como alumno</ButtonLink> : undefined}>
        {vista ? 'Revisada.' : 'Mira lo que verá tu cliente.'}
      </Paso>

      <Paso hecho={invitar.hecho} titulo="Tu primer alumno" opcional
        accion={!invitar.hecho ? <Button size="sm" variant="tertiary" onClick={onIrAAvance}>Ir a Avance</Button> : undefined}>
        {!invitar.hecho ? 'Invítalo desde Avance.' : invitar.n > 0 ? `${invitar.n} ${invitar.n === 1 ? 'invitado' : 'invitados'}.` : 'Invitado.'}
      </Paso>
    </Section>
  );
}

/** Un renglón de la lista de un onboarding. Lo reusa la de la tab Clientes (../ChecklistClientes):
 *  dos listas hermanas con dos dibujos se separan en el primer retoque. */
export function Paso({ hecho, titulo, opcional, accion, children }: {
  hecho: boolean; titulo: string; opcional?: boolean; accion?: ReactNode; children: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
      <span aria-hidden style={{
        flex: 'none', width: 22, height: 22, borderRadius: 999, display: 'grid', placeItems: 'center',
        background: hecho ? 'var(--good-bg)' : 'var(--surface-2)',
        color: hecho ? 'var(--good)' : 'var(--faint)',
        border: hecho ? 'none' : '1px solid var(--border-strong)',
      }}>
        <Icon name={hecho ? 'check' : 'dot'} size={13} />
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--ink)' }}>
          {titulo}
          {opcional && <Tag>Opcional</Tag>}
        </div>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', marginTop: 2 }}>{children}</div>
      </div>
      {accion}
    </div>
  );
}
