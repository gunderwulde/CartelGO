# PLAN.md - Cartel GO

Plan de trabajo derivado de [GDD.md](GDD.md) y [AGENTS.md](AGENTS.md). Marca `[x]` al completar cada tarea.

- **Repo:** https://github.com/gunderwulde/CartelGO.git
- **Publicación:** GitHub Pages → `https://gunderwulde.github.io/CartelGO/`
- **Estado actual:** carpeta local sin `git init` y sin código; solo documentación.

---

## Fase 0 - Repo y despliegue temprano (hacerlo primero)

Desplegar desde el día 1 evita sorpresas con rutas, HTTPS y service worker.

- [x] `git init`, rama `main`, añadir `origin` = repo de GitHub, primer commit con GDD/AGENTS/PLAN.
- [x] `.gitignore` (node_modules, dist, .env*, etc.) y `README.md` corto.
- [x] Scaffold Vite + React + TypeScript (`strict: true`, sin `any`).
- [x] Instalar dependencias del stack: `tailwindcss`, `lucide-react`, `zustand`, `maplibre-gl`, `h3-js`, `idb-keyval` (o `dexie`), `vite-plugin-pwa`.
- [x] **Configurar para GitHub Pages:**
  - `base: '/CartelGO/'` en `vite.config.ts`.
  - PWA manifest con `scope` y `start_url` = `/CartelGO/`.
  - Todas las rutas de assets relativas al `base` (nada de `/icon.png` absoluto).
  - Si se usa router: `HashRouter` (Pages no hace fallback SPA) o copiar `index.html` a `404.html`.
- [x] Workflow `.github/workflows/deploy.yml`: build + `actions/upload-pages-artifact` + `actions/deploy-pages` en cada push a `main`.
- [ ] En GitHub: *Settings → Pages → Source = GitHub Actions*.
- [ ] Verificar que la URL pública carga, es HTTPS (necesario para Geolocation) y es instalable como PWA.

**Hecho cuando:** una pantalla "Hola Cartel" se ve en la URL de Pages y se instala en móvil.

---

## Sprint 1 - Core técnico

- [x] Estructura de carpetas según AGENTS.md (`components/ map/ services/ store/ data/ types/`).
- [x] Tailwind con tema cartoon (bordes negros gruesos, sombras duras, paleta saturada).
- [x] MapLibre GL con estilo cartoon custom (OpenFreeMap + recoloreado en runtime).
  - **Decisión pendiente:** fuente de teselas vectoriales gratuita y sin API key (p. ej. OpenFreeMap) frente a MapTiler/Stadia (requieren key, que quedaría expuesta en el cliente). Recomendado: OpenFreeMap + estilo propio.
- [x] `geoService.ts`: wrapper de `watchPosition`, Haversine, manejo de permisos denegados / sin GPS.
- [x] Avatar del jugador moviéndose en el mapa.
- [x] **Anti-cheat:** velocidad > 25 km/h → bloquear interacciones y mostrar aviso "Modo Conducción".
- [x] Modo debug/simulación (mover el avatar con el dedo o teclado) para poder testear en escritorio sin caminar.
- [x] Iconos PWA (chincheta cartoon) (192/512, maskable) y splash.

## Sprint 1.5 - Actualización de la app instalada

- [x] `registerType: 'prompt'`: el usuario decide cuándo actualizar (no se pierde una sesión de calle por una recarga).
- [x] Aviso "¡Nueva versión!" con botones Actualizar / Más tarde (`UpdatePrompt.tsx`).
- [x] Comprobación de versión cada hora y al volver a abrir la app (`visibilitychange`).
- [x] Versión y fecha de build visibles en la pantalla de inicio.
- [x] El progreso se guarda en IndexedDB en cada cambio, así que recargar para actualizar no pierde nada (probado).
- Nota: subir `version` en package.json en cada release. En iOS la PWA instalada solo comprueba al abrirse.

---

## Sprint 2 - Mundo real (Overpass)

- [x] `osmService.ts`: consulta Overpass por hexágono H3 / radio 1.5 km con las etiquetas del GDD §3 (`industrial`, `pharmacy`, `park`, `bar`/`nightclub`, `police`, `laundry`/`car_wash`).
- [x] Parser OSM → POIs del juego (tipo, rol, posición; polígonos → centroide).
- [x] **Caché en IndexedDB ≥ 24 h** por hexágono; nunca consultar en cada tick de GPS.
- [x] Gestión de errores/rate-limit de Overpass (3 endpoints, timeout de 20 s, reintento con enfriamiento de 30 s).
- [x] Endurecimiento del servicio (v2): una consulta por celda con bbox pequeño, peticiones "con cobertura" (si un servidor tarda 3,5 s o falla se lanza el siguiente en paralelo), carga progresiva (caché → celda actual → vecinas), caché caducada como respaldo, reintento de celdas fallidas cada 60 s. Solo hay error si la celda del jugador no tiene ningún dato. Pendiente: probar en navegador real; los espejos públicos kumi/private.coffee van muy lentos, si sigue flaky montar un proxy propio.
- [x] Caché compartida en Supabase (tabla `poi_cells` + función `poi-cell`), con Overpass directo como respaldo. Código listo; falta crear el proyecto y desplegar: ver `supabase/README.md`.
- [x] Pintar marcadores (círculos de color) por tipo y radio de 50 m del radar; círculo de influencia de comisarías.

## Sprint 3 - Loop de calle

- [x] `data/`: catálogo de precursores, productos (Hierba Risona, Cristal Azul, Polvo Estelar → nombres ficticios, ver AGENTS §3), precios. Sin laboratorio aún, el jugador empieza con 10 Hierba Risona para poder probar la venta.
- [x] Stores Zustand: `playerStore`, `inventoryStore`, `mapStore`.
- [x] Inventario con capacidad de mochila.
- [x] Interacción a < 50 m: comprar precursores (industrial/farmacia, con límite diario) y vender (parque, bares con x2 de 20:00 a 04:00).
- [x] Medidor de Heat por cercanía a comisarías; al 100 % se pierde la mercancía.
- [x] Persistencia del progreso en IndexedDB (offline-first, `zustand/persist` + `idb-keyval`).
- [x] Tests unitarios (vitest) de precios, compra/venta, límite diario de farmacia y Heat: `npm test`.
- [ ] **Decisión pendiente:** en la redada solo se pierde la mercancía (GDD §3); el GDD §4 dice que también se pierde el Dinero Sucio. Ahora mismo solo se pierde la mercancía.

## Sprint 4 - Base e Idle

- [x] Colocación del HQ (movible gratis cada 7 días). **Privacidad:** guardar coordenadas solo en local; para cualquier envío futuro usar H3 res. 7 u offset aleatorio.
- [x] `idleEngine.ts`: producción por delta `Date.now()` vs `lastSyncTimestamp` (no depender de `setInterval`).
- [x] Laboratorio: precursores → mercancía, con niveles de velocidad/pureza.
- [x] Camellos asignados a POIs descubiertos → ingresos pasivos.
- [x] Negocios tapadera (lavandería/autolavado): blanqueo Dinero Sucio → Dinero Limpio.
- [x] Mejoras de HQ, almacén y mochila con Dinero Limpio; sistema de Reputación (XP) y desbloqueo de Tiers.
- [x] Tests unitarios del `idleEngine` (21 tests en total con precios y Heat).
- [ ] **Decisiones de balance a revisar en el Sprint 5:** costes de mejoras, ritmo de camellos (1 ud/30 s, cobran 80 %), blanqueo (5 $/10 s por negocio, se queda 80 %), tope offline de 8 h, 350 $ limpios iniciales (revisado en el Sprint 5, pendiente de pruebas reales).

## Sprint 5 - Pulido

- [x] Efectos de sonido cartoon (sintetizados con WebAudio, sin ficheros) y botón de silencio.
- [x] Notificaciones locales de "Lote terminado" cuando la app sigue viva en segundo plano, y resumen "Mientras no estabas" al volver. Sin servidor push no hay avisos con la app cerrada (limitación de iOS/PWA).
- [x] Primer balanceo: 350 $ limpios iniciales (alcanza para 1 negocio + 1 camello). Pendiente afinar con pruebas reales de calle.
- [x] Onboarding (permiso de GPS, aviso de seguridad al caminar, tono satírico).
- [x] Rendimiento: MapLibre en carga diferida (pantalla inicial 1,3 MB → 477 kB) y filtro de lecturas GPS repetidas. Falta medir batería en un móvil real.
- [x] Aviso de que todo es ficticio en el onboarding. Pendiente si se publica en tiendas: revisión legal y nombre definitivo.

---

## Fase 2 (fuera del MVP) - Multijugador

- [ ] Supabase (PostgreSQL + PostGIS), auth.
- [ ] Hexágonos H3 res. 8, puntos de influencia por venta, dominio +15 %.
- [ ] Respetar la regla de privacidad del HQ (solo H3 res. 7).
- [ ] Validación server-side de ventas (el cliente es manipulable).

---

## Riesgos y decisiones abiertas

| Tema | Riesgo / decisión |
| :--- | :--- |
| Teselas del mapa | Necesitan fuente gratuita sin key; respetar licencias y atribución de OSM. |
| Overpass | Endpoint público con límites; caché agresiva obligatoria. |
| GitHub Pages | Solo estático, base path `/CartelGO/`, sin fallback SPA. |
| GPS en iOS PWA | Pide permiso con frecuencia y no hay segundo plano: el juego solo funciona con la app abierta. |
| Título | "Cartel GO" es provisional; el nombre puede chocar con *Pokémon GO* en tiendas; decidir antes de lanzar fuera de Pages. |
| Seguridad física | Aviso claro de no jugar caminando por zonas peligrosas ni conduciendo. |

## Siguiente paso inmediato

Ejecutar **Fase 0** completa (repo + Vite + deploy a Pages).
