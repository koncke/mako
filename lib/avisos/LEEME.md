# Avisos de licencia (29/10/2026)

Lo que MaKo toma de un repo de código abierto (el método de un experto, una regla, una lista) conserva el aviso de su licencia, aunque el texto se traduzca y se reescriba. Es el molde de `app/image-editor/_doory/LICENSE-DOORY` y `app/video-editor/_opencut/LICENSE-OPENCUT`, pero en **un solo lugar**: marketingskills lo usan cuatro tabs, y cuatro copias del mismo archivo se desfasan.

**La regla:**
- una copia **literal** por repo, `LICENSE-<REPO>`, bajada de `raw.githubusercontent.com/<dueño>/<repo>/main/LICENSE` (con un 404 se prueban `master`, `LICENSE.md` y `api.github.com/repos/<dueño>/<repo>/license` antes de concluir «sin licencia»; docs/hallazgos-infra.md);
- la cabecera de cada archivo que toma algo nombra el aviso (`lib/avisos/LICENSE-<REPO>`);
- un README que dice «MIT» no alcanza: sin LICENSE, no se copia.

`tests/avisos-licencias.test.ts` comprueba que cada archivo sea la licencia entera con su línea de copyright.

| Archivo | Repo | Copyright | Lo usa (docs/plantillas-reales/README.md, sección 5) |
|---|---|---|---|
| `LICENSE-MARKETINGSKILLS` | https://github.com/coreyhaines31/marketingskills | 2025 Corey Haines | Copywriter, Image, AI Avatar, Offer |
| `LICENSE-PROFOUND` | https://github.com/retieedra-profound/skills-marketing-library | 2026 Profound | Copywriter |
| `LICENSE-CLAUDE-YOUTUBE` | https://github.com/agricidaniel/claude-youtube | 2025 Daniel Agrici | Copywriter (y Video la edita) |
| `LICENSE-CRAIGHEWITT-SKILLS` | https://github.com/thecraighewitt/skills | 2026 Craig Hewitt | Video |
| `LICENSE-VIDEO-USE` | https://github.com/browser-use/video-use | 2026 Browser Use | Video |
| `LICENSE-CLAUDE-SHORTS` | https://github.com/AgriciDaniel/claude-shorts | 2026 Daniel Agrici | Video |
| `LICENSE-DIFFUSIONSTUDIO-LOTTIE` | https://github.com/diffusionstudio/lottie | 2026 Diffusion Studio Inc. | Video (más adelante) |
| `LICENSE-VIDEO-THUMBNAIL-SKILL` | https://github.com/aabrole/claude-video-thumbnail-skill | 2026 aabrole | Image |
| `LICENSE-SOCIAL-MEDIA-SKILLS` | https://github.com/charlie947/social-media-skills | 2026 Charlie Hills | Image |
| `LICENSE-INSTAGRAM-CAROUSEL-SKILL` | https://github.com/jeevanbavandla/instagram-carousel-skill | 2026 Jeevan Bavandla | Image |
| `LICENSE-MOTION-SKILLS` | https://github.com/motion-creative/skills | 2025 Motion | AI Avatar |
| `LICENSE-POLAR` | https://github.com/polarsource/polar | 2023 Polar Software Inc | Admin (`/admin`): el CÓDIGO del dashboard de Polar portado archivo por archivo (app/admin/_polar, app/admin/(polar)), commit 72aa1109 del 5/11/2026. **Es Apache-2.0**: va con `NOTICE-POLAR` (qué se tomó y que se modificó) |
| `LICENSE-MUI-ICONS` | https://github.com/mui/material-ui (paquete @mui/icons-material 7.3.11) | 2014 Call-Em-All | Admin: los trazos de los íconos de Material que usa Polar (app/admin/_polar/orbit/icons/material.tsx) |

Las once primeras son MIT y se bajaron el 29/10/2026 de la rama `main`; la de Polar (Apache-2.0) y la de los íconos de MUI (MIT), el 6/11/2026. La de Studio Admin se fue con su código el 6/11/2026: Admin dejó de usarlo. La de Diffusion Studio abre con el copyright y no con «MIT License»: así está en su repo.
