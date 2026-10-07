'use client';

// =============================================================================
// vista-previa — el portal del alumno dibujado para el EQUIPO, sin un alumno detrás
// =============================================================================
// La tab Curso tiene su ensayo (el onboarding de la tab, `curso_vista`): ver el curso como lo ve
// el cliente. Abrir el portal de un cliente de verdad para eso le CREA su fila de
// `curso_accesos` y le cuenta un ingreso (docs/relevo/customer-success.md, trampa 5), así que la
// vista previa (app/customer-success/curso/vista/page.tsx) dibuja el MISMO PortalAlumno sin
// lead y sin token, y este contexto les avisa a sus piezas que no escriban nada:
//
//   · Reproductor: no manda el progreso del video (ni el `fetch` ni el `sendBeacon`).
//   · TareaAlumno: no manda la tarea; contesta en local, para que se pueda probar el formulario
//     —«Enviar» valida igual y dice qué falta— sin que nada viaje.
//
// ⚠️ EL DEFAULT ES `false`, y sólo la vista previa lo prende. Las dos puertas de un alumno real
// (/compartido/curso/<token> y /mi-curso) no lo pasan: tests/curso-onboarding.test.ts lo fija.

import { createContext, useContext } from 'react';

export const VistaPreviaCtx = createContext(false);

/** ¿Este portal es la vista previa del equipo? Entonces no se escribe nada. */
export const useVistaPrevia = (): boolean => useContext(VistaPreviaCtx);
