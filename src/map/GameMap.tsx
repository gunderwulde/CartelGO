import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";

maplibregl.setWorkerUrl(workerUrl);
import { usePlayerStore } from "../store/playerStore";
import { INTERACTION_RADIUS_M } from "../services/geoService";
import { useMapStore } from "../store/mapStore";
import { useBaseStore } from "../store/baseStore";
import { carPose } from "./carSim";
import {
  addPoiLayers,
  circlePolygon,
  POI_ICON_LAYER,
  poiActivities,
  setPois,
} from "./poiLayer";
import { MAP_STYLE_URL, applyCartoonStyle } from "./cartoonStyle";

const RADAR_SOURCE = "radar";
const PLAYER_SOURCE = "player";
const DEFAULT_CENTER: [number, number] = [-3.7038, 40.4168]; // Madrid, hasta tener GPS

/** El juego es de barrio: no tiene sentido alejarse más (ni ver fuera de la zona con POIs cargados) */
const MIN_ZOOM = 14;
const MAX_ZOOM = 19;
/** Cuánto se puede arrastrar el mapa lejos del jugador (grados: ~3 km) */
const PAN_LIMIT_DEG = 0.03;

interface Props {
  follow: boolean;
  /** Toque sobre el icono de un lugar */
  onPoiClick: (id: string) => void;
  /** El jugador arrastra el mapa: deja de seguirle */
  onUserMove: () => void;
  /** Toque en el mapa fuera de cualquier icono (cierra los paneles) */
  onMapClick: () => void;
}

export default function GameMap({
  follow,
  onPoiClick,
  onUserMove,
  onMapClick,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const followRef = useRef(follow);
  followRef.current = follow;
  const clickRef = useRef(onPoiClick);
  clickRef.current = onPoiClick;
  const moveRef = useRef(onUserMove);
  moveRef.current = onUserMove;
  const mapClickRef = useRef(onMapClick);
  mapClickRef.current = onMapClick;

  useEffect(() => {
    if (!container.current) return;
    const map = new maplibregl.Map({
      container: container.current,
      style: MAP_STYLE_URL,
      center: DEFAULT_CENTER,
      zoom: 16,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      attributionControl: { compact: true },
    });
    let ready = false;
    let centered = false;

    const hqEl = document.createElement("div");
    hqEl.className = "hq-marker";
    hqEl.textContent = "🏠";
    const hqMarker = new maplibregl.Marker({ element: hqEl });
    const showHq = (hq: { lat: number; lng: number } | null): void => {
      if (hq) hqMarker.setLngLat([hq.lng, hq.lat]).addTo(map);
      else hqMarker.remove();
    };
    showHq(useBaseStore.getState().hq);
    const refreshPois = (): void => {
      if (ready)
        setPois(
          map,
          Object.values(useMapStore.getState().pois),
          poiActivities(useBaseStore.getState()),
        );
    };
    const markWorking = (s: ReturnType<typeof useBaseStore.getState>): void => {
      hqEl.classList.toggle(
        "working",
        s.job !== null || s.carriers.some((c) => c.trip !== null),
      );
    };
    markWorking(useBaseStore.getState());
    const unsubHq = useBaseStore.subscribe((s, prev) => {
      if (s.hq !== prev.hq) showHq(s.hq);
      if (s.job !== prev.job || s.carriers !== prev.carriers) markWorking(s);
      if (
        s.dealers !== prev.dealers ||
        s.suppliers !== prev.suppliers ||
        s.carriers !== prev.carriers
      )
        refreshPois();
    });

    // Coches de los transportistas en viaje (solo visual, se recalcula cada medio segundo)
    const cars = new Map<
      string,
      { marker: maplibregl.Marker; icon: HTMLSpanElement }
    >();
    const updateCars = (): void => {
      const { hq, carriers, suppliers } = useBaseStore.getState();
      const live = new Set<string>();
      for (const c of carriers) {
        const point = c.trip ? suppliers[c.trip.supplierId]?.poi : undefined;
        const pose = hq && point ? carPose(c, point, hq, Date.now()) : null;
        if (!pose) continue;
        live.add(c.id);
        let car = cars.get(c.id);
        if (!car) {
          const wrap = document.createElement("div");
          wrap.className = "car-marker";
          const icon = document.createElement("span");
          wrap.appendChild(icon);
          car = { marker: new maplibregl.Marker({ element: wrap }), icon };
          cars.set(c.id, car);
        }
        car.icon.textContent = pose.loaded ? "🚚" : "🚗";
        car.icon.style.transform = pose.east ? "scaleX(-1)" : "";
        car.marker.setLngLat([pose.lng, pose.lat]).addTo(map);
      }
      for (const [id, car] of cars) {
        if (!live.has(id)) {
          car.marker.remove();
          cars.delete(id);
        }
      }
    };
    const carTimer = window.setInterval(updateCars, 500);
    updateCars();

    let boundsAt: [number, number] | null = null;

    function update(lng: number, lat: number): void {
      // Límite de arrastre alrededor del jugador; solo se recoloca cuando se ha movido un trecho
      if (
        !boundsAt ||
        Math.abs(boundsAt[0] - lng) > PAN_LIMIT_DEG / 6 ||
        Math.abs(boundsAt[1] - lat) > PAN_LIMIT_DEG / 6
      ) {
        boundsAt = [lng, lat];
        map.setMaxBounds([
          [lng - PAN_LIMIT_DEG, lat - PAN_LIMIT_DEG],
          [lng + PAN_LIMIT_DEG, lat + PAN_LIMIT_DEG],
        ]);
      }
      if (ready) {
        (map.getSource(PLAYER_SOURCE) as maplibregl.GeoJSONSource).setData({
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates: [lng, lat] },
        });
        (map.getSource(RADAR_SOURCE) as maplibregl.GeoJSONSource).setData(
          circlePolygon(lng, lat, INTERACTION_RADIUS_M),
        );
      }
      if (!centered) {
        map.jumpTo({ center: [lng, lat], zoom: 17 });
        centered = true;
      } else if (followRef.current) {
        map.easeTo({ center: [lng, lat], duration: 600 });
      }
    }

    map.on("load", () => {
      applyCartoonStyle(map);
      map.addSource(RADAR_SOURCE, {
        type: "geojson",
        data: circlePolygon(0, 0, 1),
      });
      map.addLayer({
        id: "radar-fill",
        type: "fill",
        source: RADAR_SOURCE,
        paint: { "fill-color": "#facc15", "fill-opacity": 0.25 },
      });
      map.addLayer({
        id: "radar-line",
        type: "line",
        source: RADAR_SOURCE,
        paint: {
          "line-color": "#111111",
          "line-width": 3,
          "line-dasharray": [2, 1],
        },
      });
      addPoiLayers(map);
      // El indicador del jugador va en una capa, por debajo de los iconos de lugares
      map.addSource(PLAYER_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer(
        {
          id: "player-dot",
          type: "circle",
          source: PLAYER_SOURCE,
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              13,
              7,
              17,
              10,
              19,
              12,
            ],
            "circle-color": "#ef4444",
            "circle-stroke-width": 4,
            "circle-stroke-color": "#111111",
          },
        },
        "poi-activity",
      );
      map.on("dragstart", () => moveRef.current());
      map.on("click", (e) => {
        if (
          map.queryRenderedFeatures(e.point, { layers: [POI_ICON_LAYER] })
            .length === 0
        )
          mapClickRef.current();
      });
      map.on("click", POI_ICON_LAYER, (e) => {
        const id: unknown = e.features?.[0]?.properties?.id;
        if (typeof id === "string") clickRef.current(id);
      });
      map.on(
        "mouseenter",
        POI_ICON_LAYER,
        () => (map.getCanvas().style.cursor = "pointer"),
      );
      map.on(
        "mouseleave",
        POI_ICON_LAYER,
        () => (map.getCanvas().style.cursor = ""),
      );
      ready = true;
      refreshPois();
      const p = usePlayerStore.getState().position;
      if (p) update(p.lng, p.lat);
    });

    const unsub = usePlayerStore.subscribe((s, prev) => {
      if (s.position && s.position !== prev.position)
        update(s.position.lng, s.position.lat);
    });
    const unsubPois = useMapStore.subscribe((s, prev) => {
      if (s.focus && s.focus !== prev.focus)
        map.easeTo({
          center: [s.focus.lng, s.focus.lat],
          zoom: Math.max(map.getZoom(), 17),
          duration: 700,
        });
      if (s.pois !== prev.pois) refreshPois();
    });
    const initial = usePlayerStore.getState().position;
    if (initial) update(initial.lng, initial.lat);

    return () => {
      window.clearInterval(carTimer);
      for (const car of cars.values()) car.marker.remove();
      unsub();
      unsubPois();
      unsubHq();
      map.remove();
    };
  }, []);

  return (
    <div className="absolute inset-0">
      <div ref={container} className="h-full w-full" />
    </div>
  );
}
