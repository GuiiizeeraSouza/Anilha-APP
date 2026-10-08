import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import { useEffect, useRef, useState } from 'react';

import {
  FOLLOW_ZOOM,
  ROUTE_COLOR,
  START_COLOR,
  TILE_ATTRIBUTION,
  TILE_SUBDOMAINS,
  TILE_URL,
  type RouteMapProps,
  allPointsOf,
  firstPointOf,
  lastPointOf,
} from './route-map-config';
import { MapFrame } from './route-map-frame';

// Versão web/PWA: Leaflet direto no DOM.
export function RouteMap({
  route,
  position = null,
  fit = false,
  height = 240,
  emptyLabel = 'Aguardando sinal do GPS…',
  emptyLoading = true,
}: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<{ line: L.Polyline; start: L.CircleMarker; current: L.CircleMarker } | null>(null);
  const followingRef = useRef(true);
  const [following, setFollowing] = useState(true);

  const hasFix = (lastPointOf(route) ?? position) !== null;

  // Cria o mapa uma vez.
  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: true }).setView([0, 0], 2);
    L.tileLayer(TILE_URL, { subdomains: TILE_SUBDOMAINS, attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map);
    map.attributionControl.setPrefix(false);

    layersRef.current = {
      line: L.polyline([], { color: ROUTE_COLOR, weight: 5, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }).addTo(map),
      start: L.circleMarker([0, 0], { radius: 6, color: '#121212', weight: 2, fillColor: START_COLOR, fillOpacity: 1, opacity: 0 }).addTo(map),
      current: L.circleMarker([0, 0], { radius: 8, color: '#FFFFFF', weight: 3, fillColor: ROUTE_COLOR, fillOpacity: 1, opacity: 0 }).addTo(map),
    };

    // Arrastar o mapa desliga o "seguir"; o botão Centralizar religa.
    if (!fit) {
      map.on('dragstart', () => {
        followingRef.current = false;
        setFollowing(false);
      });
    }

    mapRef.current = map;
    // O container do react-native-web só tem tamanho final depois do layout.
    const resize = setTimeout(() => map.invalidateSize(), 0);
    return () => {
      clearTimeout(resize);
      map.remove();
      mapRef.current = null;
      layersRef.current = null;
    };
  }, [fit]);

  // Atualiza o trajeto a cada ponto novo.
  useEffect(() => {
    const map = mapRef.current;
    const layers = layersRef.current;
    if (!map || !layers) return;
    const first = firstPointOf(route);
    const current = lastPointOf(route) ?? position;
    layers.line.setLatLngs(route);
    if (first) layers.start.setLatLng(first).setStyle({ opacity: 1, fillOpacity: 1 });
    if (current) {
      layers.current.setLatLng(current).setStyle({ opacity: 1, fillOpacity: 1 });
      layers.current.bringToFront();
    }
    if (fit) {
      const points = allPointsOf(route);
      if (points.length === 0) return;
      // Dentro de um modal o container só ganha o tamanho final depois do
      // layout/animação — enquadrar antes disso calcula o zoom errado.
      const timer = setTimeout(() => {
        map.invalidateSize();
        map.fitBounds(L.latLngBounds(points), { padding: [24, 24], maxZoom: 17 });
      }, 80);
      return () => clearTimeout(timer);
    }
    if (current && followingRef.current) {
      map.setView(current, map.getZoom() < FOLLOW_ZOOM - 2 ? FOLLOW_ZOOM : map.getZoom(), { animate: true });
    }
  }, [route, position, fit]);

  function recenter() {
    followingRef.current = true;
    setFollowing(true);
    const current = lastPointOf(route) ?? position;
    if (current && mapRef.current) mapRef.current.setView(current, FOLLOW_ZOOM, { animate: true });
  }

  return (
    <MapFrame
      height={height}
      hasFix={hasFix}
      emptyLabel={emptyLabel}
      emptyLoading={emptyLoading}
      following={following}
      onRecenter={recenter}
    >
      <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#1a1a1a' }} />
    </MapFrame>
  );
}
