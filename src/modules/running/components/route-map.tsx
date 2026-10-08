import { useEffect, useRef, useState } from 'react';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import {
  FOLLOW_ZOOM,
  ROUTE_COLOR,
  START_COLOR,
  TILE_ATTRIBUTION,
  TILE_SUBDOMAINS,
  TILE_URL,
  type RouteMapProps,
  lastPointOf,
} from './route-map-config';
import { MapFrame } from './route-map-frame';

const LEAFLET_VERSION = '1.9.4';

// iOS/Android: o mesmo Leaflet da versão web, rodando numa WebView — evita
// depender de chave do Google Maps e mantém um único jeito de desenhar o mapa.
// O app manda o trajeto via injectJavaScript; a página avisa quando o usuário
// arrasta o mapa (para desligar o "seguir").
const HTML = `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css" />
<style>html, body, #map { margin: 0; height: 100%; background: #1a1a1a; }</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js"></script>
<script>
  var map = L.map('map', { zoomControl: false }).setView([0, 0], 2);
  L.tileLayer(${JSON.stringify(TILE_URL)}, {
    subdomains: ${JSON.stringify(TILE_SUBDOMAINS)},
    attribution: ${JSON.stringify(TILE_ATTRIBUTION)},
    maxZoom: 19
  }).addTo(map);
  map.attributionControl.setPrefix(false);
  var line = L.polyline([], { color: ${JSON.stringify(ROUTE_COLOR)}, weight: 5, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }).addTo(map);
  var start = L.circleMarker([0, 0], { radius: 6, color: '#121212', weight: 2, fillColor: ${JSON.stringify(START_COLOR)}, fillOpacity: 0, opacity: 0 }).addTo(map);
  var current = L.circleMarker([0, 0], { radius: 8, color: '#FFFFFF', weight: 3, fillColor: ${JSON.stringify(ROUTE_COLOR)}, fillOpacity: 0, opacity: 0 }).addTo(map);
  var following = true;

  map.on('dragstart', function () {
    following = false;
    window.ReactNativeWebView.postMessage('unfollow');
  });

  function firstPoint(route) {
    for (var i = 0; i < route.length; i++) if (route[i].length) return route[i][0];
    return null;
  }
  function lastPoint(route) {
    for (var i = route.length - 1; i >= 0; i--) if (route[i].length) return route[i][route[i].length - 1];
    return null;
  }

  window.updateRoute = function (route, position, fit) {
    line.setLatLngs(route);
    var first = firstPoint(route);
    var last = lastPoint(route) || position;
    if (first) start.setLatLng(first).setStyle({ opacity: 1, fillOpacity: 1 });
    if (last) {
      current.setLatLng(last).setStyle({ opacity: 1, fillOpacity: 1 });
      current.bringToFront();
    }
    if (fit) {
      var points = [].concat.apply([], route);
      if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [24, 24], maxZoom: 17 });
    } else if (last && following) {
      map.setView(last, map.getZoom() < ${FOLLOW_ZOOM - 2} ? ${FOLLOW_ZOOM} : map.getZoom());
    }
  };

  window.recenter = function (route, position) {
    following = true;
    var last = lastPoint(route) || position;
    if (last) map.setView(last, ${FOLLOW_ZOOM});
  };

  window.ReactNativeWebView.postMessage('ready');
</script>
</body>
</html>`;

export function RouteMap({
  route,
  position = null,
  fit = false,
  height = 240,
  emptyLabel = 'Aguardando sinal do GPS…',
  emptyLoading = true,
}: RouteMapProps) {
  const webViewRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [following, setFollowing] = useState(true);

  // Manda o trajeto para a página sempre que ele muda (e quando ela termina de carregar).
  useEffect(() => {
    if (!ready) return;
    webViewRef.current?.injectJavaScript(
      `window.updateRoute(${JSON.stringify(route)}, ${JSON.stringify(position)}, ${fit}); true;`,
    );
  }, [ready, route, position, fit]);

  function handleMessage(event: WebViewMessageEvent) {
    if (event.nativeEvent.data === 'ready') setReady(true);
    if (event.nativeEvent.data === 'unfollow' && !fit) setFollowing(false);
  }

  function recenter() {
    setFollowing(true);
    webViewRef.current?.injectJavaScript(
      `window.recenter(${JSON.stringify(route)}, ${JSON.stringify(position)}); true;`,
    );
  }

  return (
    <MapFrame
      height={height}
      hasFix={(lastPointOf(route) ?? position) !== null}
      emptyLabel={emptyLabel}
      emptyLoading={emptyLoading}
      following={following}
      onRecenter={recenter}
    >
      <WebView
        ref={webViewRef}
        source={{ html: HTML }}
        originWhitelist={['*']}
        onMessage={handleMessage}
        scrollEnabled={false}
        style={{ backgroundColor: '#1a1a1a' }}
      />
    </MapFrame>
  );
}
