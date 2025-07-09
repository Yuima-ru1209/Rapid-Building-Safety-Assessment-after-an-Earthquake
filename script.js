const map = L.map('map').setView([35.6812, 139.7671], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

const drawnItems = new L.FeatureGroup();
const pinLayerGroup = new L.LayerGroup();
map.addLayer(drawnItems);
map.addLayer(pinLayerGroup);

let currentMode = 'pin';
let isDrawing = false;
let latestPolygon = null;

const drawBtn = document.getElementById('draw-mode-btn');
const pinBtn = document.getElementById('pin-mode-btn');
const colorPicker = document.getElementById('color-picker');
const colorButtons = document.querySelectorAll('#color-picker .colors button');
const saveBtn = document.getElementById('save-btn');

const drawControl = new L.Control.Draw({
  draw: {
    polygon: true,
    polyline: false,
    rectangle: false,
    circle: false,
    marker: false,
    circlemarker: false
  },
  edit: {
    featureGroup: drawnItems
  }
});

drawBtn.onclick = () => {
  currentMode = 'draw';
  isDrawing = false;
  map.addControl(drawControl);
  drawBtn.disabled = true;
  pinBtn.disabled = false;
};

pinBtn.onclick = () => {
  currentMode = 'pin';
  isDrawing = false;
  map.removeControl(drawControl);
  drawBtn.disabled = false;
  pinBtn.disabled = true;
};

pinBtn.disabled = true;

map.on(L.Draw.Event.DRAWSTART, () => isDrawing = true);
map.on(L.Draw.Event.DRAWSTOP, () => isDrawing = false);

map.on(L.Draw.Event.CREATED, function (event) {
  const layer = event.layer;
  latestPolygon = layer;

  const name = prompt('このエリアに名前をつけてください：', '新しいエリア');
  if (name) {
    layer.feature = { properties: { name: name } };
    layer.bindTooltip(name, {
      permanent: true,
      direction: 'center',
      className: 'area-label'
    }).openTooltip();
  }

  drawnItems.addLayer(layer);

  showColorPicker((color) => {
    applyPolygonColor(layer, color);
    layer.customColor = color;
  });
});

map.on('click', function (e) {
  if (currentMode !== 'pin' || isDrawing) return;

  const latlng = e.latlng;
  const point = turf.point([latlng.lng, latlng.lat]);
  let insideArea = null;

  drawnItems.eachLayer(function (layer) {
    const coords = layer.getLatLngs()[0].map(ll => [ll.lng, ll.lat]);
    const polygon = turf.polygon([[...coords, coords[0]]]);
    if (turf.booleanPointInPolygon(point, polygon)) {
      insideArea = layer;
    }
  });

  const marker = L.marker(latlng).addTo(pinLayerGroup);

  let popupContent = insideArea
    ? 'このピンはエリア内です。'
    : 'このピンはどのエリアにも属していません。';

  popupContent += `<br><button class="delete-pin-btn">🗑 削除</button>`;
  marker.bindPopup(popupContent).openPopup();

  marker.on('popupopen', function () {
    const btn = document.querySelector('.delete-pin-btn');
    if (btn) {
      btn.onclick = () => {
        pinLayerGroup.removeLayer(marker);
      };
    }
  });
});

drawnItems.on('click', function (e) {
  const layer = e.layer;
  latestPolygon = layer;

  const currentName = layer.feature?.properties?.name || '';
  const newName = prompt('このエリアの名前を変更します：', currentName);
  if (newName) {
    layer.feature.properties.name = newName;
    layer.unbindTooltip();
    layer.bindTooltip(newName, {
      permanent: true,
      direction: 'center',
      className: 'area-label'
    }).openTooltip();
  }

  showColorPicker((color) => {
    applyPolygonColor(layer, color);
    layer.customColor = color;
  });
});

function applyPolygonColor(layer, color) {
  layer.setStyle({
    color: color,
    fillColor: color,
    fillOpacity: 0.4
  });
}

function showColorPicker(callback) {
  colorPicker.classList.remove('hidden');

  const onColorSelect = (e) => {
    const color = e.target.dataset.color;
    if (color && latestPolygon) {
      callback(color);
      colorPicker.classList.add('hidden');
      colorButtons.forEach(btn => btn.removeEventListener('click', onColorSelect));
    }
  };

  colorButtons.forEach(btn => btn.addEventListener('click', onColorSelect));
}

// 保存ボタン処理（ダウンロード用・クライアント側）
saveBtn.onclick = () => {
  const data = {
    areas: [],
    pins: []
  };

  drawnItems.eachLayer(layer => {
    const name = layer.feature?.properties?.name || '未命名';
    const color = layer.customColor || '#666';
    const coords = layer.getLatLngs()[0].map(ll => [ll.lat, ll.lng]);
    data.areas.push({ name, color, coords });
  });

  pinLayerGroup.eachLayer(marker => {
    const latlng = marker.getLatLng();
    data.pins.push({
      lat: latlng.lat,
      lng: latlng.lng
    });
  });

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'mapdata.json';
  a.click();

  URL.revokeObjectURL(url);
};
