# Relevo — «No puedes entrar: falta pagar el mes de …» (punta/agencia-aviso-pago, 14/11/2026, claude5 al 100 %)

Worktree `C:/dev/wt-agencia-aviso-pago` (node_modules enlazado con junction). Rama `punta/agencia-aviso-pago`, rebasada sobre
origin/main el 14/11 ~18:40.

## Hecho (subido)
- La ruta `/api/agencia/entrar` contesta 409 `pausa: 'falta-pagar'` sin cookie al cliente en pausa por la mensualidad de ESA agencia;
  la fila dice «Falta pagar» antes de tocar; al tocar «Inspeccionar», el aviso con «Pagar su mes» (baja a su entrada en la Mensualidad).
  Teléfono: «En pausa», sin plata (#94). Test `tests/agency-aviso-falta-pagar.test.ts` 4/4, probado rompiéndolo.
- Cosecha en docs/hallazgos-agencias.md, índice y AGENTS.md. Capturas a 1440 y 375 en la carpeta de notas del Cerebro
  (`agencia-aviso-pago-1411/`). Banco: `scripts/banco-agency/` (leer-prod.mts lee sin escribir; el JSON queda fuera del repo).

## Falta
1. ~~El plural de `textoDelAvisoDeEntradas`~~: HECHO (14/11), con su test en tests/agencia-mes.test.ts (45/0; sin el arreglo, 44/1).
2. El tsc acotado dio 99 dos veces (RAM): los tipos los chequea la punta en GitHub. Mirar su Action.
3. Pablo Chavez (18) también está en pausa por la mensualidad (medido 14/11): avisarlo si no se sabe.
