# AGENTS.md - Contexto y Reglas del Proyecto

## 1. Descripción del Proyecto
Videojuego híbrido **GPS + Idle Tycoon** desarrollado como **Progressive Web App (PWA)** con estética **cartoon/satírica**. El jugador gestiona un imperio de sustancias ficticias en el mundo real mediante geolocalización, combinando exploración física (comprar/vender en puntos de interés) con gestión pasiva desde su base.

## 2. Stack Tecnológico
- **Build Tool:** Vite (React + TypeScript).
- **PWA:** `vite-plugin-pwa` (Service Workers, soporte offline básico y manifest).
- **Mapas y Geolocalización:** MapLibre GL JS (con estilos vectoriales custom estilo cartoon) + Web Geolocation API (`navigator.geolocation.watchPosition`).
- **Datos Geoespaciales:** Overpass API (OpenStreetMap) para generar POIs dinámicos + `h3-js` (Uber H3) para cuadrículas hexagonales de territorio.
- **Estado y Persistencia:** Zustand (estado global) + `idb-keyval` o Dexie.js (IndexedDB para guardar progreso local offline-first).
- **Estilos UI:** Tailwind CSS + Lucide Icons (componentes tipo cómic/cartoon con bordes gruesos y sombras duras).
- **Backend (Fase 2 - Multijugador):** Supabase (PostgreSQL + PostGIS) para sincronización de territorios.

## 3. Reglas Críticas de Negocio y Seguridad
- **PRIVACIDAD DEL HQ (CRÍTICO):** Las coordenadas exactas del Cuartel General (HQ) del jugador NUNCA deben enviarse en claro ni mostrarse a otros usuarios en futuras fases PvP. Almacenar solo el hexágono H3 de nivel bajo (ej. resolución 7) para disputas territoriales o aplicar un *offset* aleatorio.
- **Anti-Cheat / Velocidad:** Si la velocidad calculada entre dos lecturas GPS supera los `25 km/h`, bloquear las interacciones de calle y mostrar advertencia de "Modo Conducción / No juegues al volante".
- **Tono Satírico / Legal:** Prohibido usar nombres de drogas reales. Usar nombres ficticios y humorísticos (ej. *Polvo Estelar*, *Caramelo Azul*, *Orégano Premium*, *Jarabe Cósmico*).
- **Caché de Overpass API:** Nunca hacer peticiones a Overpass en cada movimiento del GPS. Consultar por hexágono H3 o radio de 1.5 km y cachear los resultados en IndexedDB durante al menos 24 horas.

## 4. Arquitectura de Carpetas Sugerida
```text
src/
├── components/       # UI estilo cartoon (Modales, HUD, Botones)
├── map/              # Configuración de MapLibre, capas, marcadores y polígonos H3
├── services/
│   ├── geoService.ts # Wrapper de watchPosition, cálculo de distancias (Haversine) y anti-cheat
│   ├── osmService.ts # Consultas y parser de Overpass API -> POIs del juego
│   └── idleEngine.ts # Cálculo de producción offline (delta de tiempo)
├── store/            # Slices de Zustand (playerStore, inventoryStore, mapStore)
├── data/             # Catálogo estático de productos, mejoras, edificios y recetas
└── types/            # Interfaces de TypeScript
```

## 5. Convenciones de Código
- **Mobile-First:** Toda la interfaz debe diseñarse para uso con una sola mano (controles principales en el tercio inferior de la pantalla).
- **Cálculos Offline (Idle):** El progreso pasivo (laboratorios y camellos) no debe depender de `setInterval` activos únicamente; calcular siempre la producción acumulada comparando `Date.now()` contra `lastSyncTimestamp`.
- **Componentes:** Mantener componentes pequeños, tipado estricto en TypeScript (evitar `any`) y separar la lógica matemática/geoespacial de los componentes visuales.
