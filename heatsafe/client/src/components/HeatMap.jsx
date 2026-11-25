import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { riskColor } from '../utils/risk';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function coloredIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function MapClickPicker({ onPick, enabled }) {
  useMapEvents({
    click(e) {
      if (enabled) onPick?.({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export default function HeatMap({
  sites = [],
  areas = [],
  center = [20.5937, 78.9629],
  zoom = 5,
  heightClass = 'map-wrap',
  onPickLocation,
  pickMode = false,
}) {
  const hasMarkers =
    sites.some((s) => s.latitude != null && s.longitude != null) ||
    areas.some((a) => a.latitude != null && a.longitude != null);

  if (!hasMarkers && sites.length === 0 && areas.length === 0) {
    return (
      <div className={`${heightClass} card card-soft d-flex align-items-center justify-content-center p-3`}>
        <p className="text-muted mb-0 text-center">
          No map data yet. Add sites or assessments with latitude and longitude.
        </p>
      </div>
    );
  }

  const first = sites.find((s) => s.latitude != null) || areas.find((a) => a.latitude != null);
  const mapCenter = first ? [first.latitude, first.longitude] : center;
  const mapZoom = first ? 14 : zoom;

  return (
    <div className={heightClass}>
      <MapContainer center={mapCenter} zoom={mapZoom} scrollWheelZoom style={{ height: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickPicker enabled={pickMode} onPick={onPickLocation} />
        {sites.map((s) =>
          s.latitude != null && s.longitude != null ? (
            <Marker key={`site-${s._id}`} position={[s.latitude, s.longitude]}>
              <Popup>
                <strong>{s.name}</strong>
                <br />
                {s.type}
                {s.isDemo && <div className="small text-muted">Demonstration data</div>}
              </Popup>
            </Marker>
          ) : null
        )}
        {areas.map((a) =>
          a.latitude != null && a.longitude != null ? (
            <Marker
              key={`area-${a._id}`}
              position={[a.latitude, a.longitude]}
              icon={coloredIcon(riskColor(a.riskLevel))}
            >
              <Popup>
                <strong>{a.areaName}</strong>
                <br />
                Score: {a.riskScore} — {a.riskLevel}
              </Popup>
            </Marker>
          ) : null
        )}
      </MapContainer>
      {pickMode && (
        <p className="small text-muted mt-2 mb-0">Click the map to set coordinates for the form.</p>
      )}
    </div>
  );
}
