/**
 * EL HORARIO CON QUE NACE UN CRON «RECURRENTE», en los dos editores del CRON de la casa: el de una
 * automatización (app/automations/EditorDisparadores.tsx) y el de un mensaje de MaKo
 * (app/agencia/FlujoAviso.tsx, `SeccionCron`). Todos los días a las 9: el caso que más se pidió y el que no
 * necesita ningún campo más.
 *
 * ⚠️ ACÁ VIVÍAN `SelectorDisparo` («Por tiempo / Por una acción», dos botones chicos con su ←),
 * `EditorCron` («Cada [n] [unidad] / A las [h]:[m]», en inputs de 62 px) y `useModoDisparo`, y se fueron
 * el 10/10/2026 (restos de versiones anteriores): la sexta tanda (CRON 1, 2 y 9) los reemplazó por los
 * botones gigantes y el Recurrente de Google Calendar (`EditorRecurrente`, que trabaja sobre el mismo
 * `CronAviso`), y el mensaje de MaKo era el último que los montaba. Queda la constante porque la importa
 * EditorDisparadores; su lugar es lib/cron-aviso.ts (pendiente: mudar el import de ése).
 */

import type { CronAviso } from '@/lib/cron-aviso';

/** Lo que se escribe al elegir «Recurrente» sin nada guardado: todos los días a las 9. */
export const CRON_DEFAULT: CronAviso = { unidad: 'dia', cada: 1, hora: 9, minuto: 0 };
