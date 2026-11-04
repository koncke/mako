#!/usr/bin/env node
// =============================================================================
// spy-caricaturas-pendientes.mjs — qué caricaturas de Competitors Spy le tocan al Runner (4/11/2026)
// =============================================================================
// Martín, 4/11: «cada vez que se genere un nuevo competidor, hacer una especie de levantar un ticket para generar esa
// imagen y ya con eso se pone la imagen ahí». La hace el Runner con Canva en la PC; en la nube no hay Canva.
//
// Uso:  node --env-file=<clon>/.env.local --import tsx scripts/spy-caricaturas-pendientes.mjs
//
// Imprime UN JSON:
//   { "pendientes": [{ "ws": 9, "id": 17, "foto": "https://…/spy-miniaturas/spy/avatar/den_borgg.jpg" }, …],
//     "rendidas":   [{ "ws": 11, "id": 13, "foto": "https://…", "fallos": 3, "motivo": "…" }, …],
//     "masVieja":   "2026-11-04T12:00:00.000Z" }      ← desde cuándo espera la pendiente más vieja (null si no hay)
//
// ⚠️ SÓLO ws, id y la URL de la foto (nuestra, en el Storage, pública). Sin nombre, sin bio, sin ningún texto traído de
// afuera: esto lo lee un chat con permisos. Una persona que miran varios negocios sale UNA vez. «rendidas» son las que
// fallaron 3 veces: ya no se intentan, y quedan a la vista del super admin. Sólo lee: no escribe nada.
//
// LA RECETA (medida por el Cerebro el 4/11/2026 con Den Borg, ~30 s cada una):
//   upload-asset-from-url (la foto) → generate-image con imageReferences y SQUARE_1_1 → get-generate-image-job hasta
//   SUCCESS → get-assets con el media id. El conector entrega una vista de 200 × 200 (el original mide 1264): eso es
//   lo que se guarda, y alcanza.
// EL PROMPT: el aprobado (docs/hallazgos-ops-center.md, «El prompt aprobado de las caricaturas»), pero «the man» NO va
//   fijo: el Runner completa mirando la foto el género, el pelo, la barba, los anteojos, la piel, el gesto, la prenda
//   lisa y el color de fondo. Este script no da rasgos: sólo la foto.
// SIN CANVA (el Runner corre en una cuenta de Claude que no lo tiene conectado): no se genera ni se anota un fallo. La
//   pendiente espera en la cola sin error y sin cartel en la pantalla; lo que se ve es «masVieja», que crece.
// =============================================================================
import { listarCola } from '../lib/spy-caricatura-cola.ts';
import { depsDeLaBase } from './spy-caricatura-base.mjs';

const cola = await listarCola(depsDeLaBase());
console.log(JSON.stringify(cola, null, 2));
