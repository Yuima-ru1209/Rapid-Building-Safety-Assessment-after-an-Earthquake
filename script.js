const map = L.map('map').setView([35.6812, 139.7671], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

let latestPolygon = null;

const drawBtn = document.getElementById('draw-mode-btn');
const colorPicker = document.getElementById('color-picker');
const colorButtons = document.querySelectorAll('#color-picker .colors button');

const saveLocalBtn = document.getElementById('save-localstorage-btn');
const saveJsonBtn = document.getElementById('save-json-btn');
const loadJsonBtn = document.getElementById('load-json-btn');
const loadJsonInput = document.getElementById('load-json-input');

const drawControl = new L.Control.Draw({
  draw: {
    polygon: true,
    polyline: false,
    rectangle: false,
    circle: false,
    marker: false,
    circlemarker: false
  },
  edit: { featureGroup: drawnItems }
});

drawBtn.onclick = () => {
  map.addControl(drawControl);
  drawBtn.disabled = true;
};

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
  showColorPicker(color => {
    applyPolygonColor(layer, color);
    layer.customColor = color;
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
  showColorPicker(color => {
    applyPolygonColor(layer, color);
    layer.customColor = color;
  });
});

function applyPolygonColor(layer, color) {
  layer.setStyle({ color, fillColor: color, fillOpacity: 0.4 });
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

function collectMapData() {
  const data = { areas: [] };
  drawnItems.eachLayer(layer => {
    const name = layer.feature?.properties?.name || '未命名';
    const color = layer.customColor || '#666';
    const coords = layer.getLatLngs()[0].map(ll => [ll.lat, ll.lng]);
    data.areas.push({ name, color, coords });
  });
  return data;
}

saveLocalBtn.onclick = () => {
  const data = collectMapData();
  localStorage.setItem("mapData", JSON.stringify(data));
  alert("エリアを localStorage に保存しました！");
};

saveJsonBtn.onclick = () => {
  const data = collectMapData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mapdata.json';
  a.click();
  URL.revokeObjectURL(url);
};

loadJsonBtn.onclick = () => {
  loadJsonInput.click();
};

loadJsonInput.addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (event) {
    try {
      const data = JSON.parse(event.target.result);
      if (!Array.isArray(data.areas)) {
        alert("不正なファイル形式です（'areas' が見つかりません）");
        return;
      }

      // 保存
      localStorage.setItem("mapData", JSON.stringify(data));
      alert("エリアを localStorage に保存しました");

      // 表示
      drawnItems.clearLayers();
      data.areas.forEach(area => {
        const polygon = L.polygon(area.coords, {
          color: area.color || '#3388ff',
          fillColor: area.color || '#3388ff',
          fillOpacity: 0.4
        }).addTo(drawnItems);
        polygon.feature = { properties: { name: area.name } };
        polygon.customColor = area.color;
        polygon.bindTooltip(area.name, {
          permanent: true,
          direction: 'center',
          className: 'area-label'
        }).openTooltip();
      });

    } catch (err) {
      alert("ファイルの読み込みに失敗しました。");
    }
  };
  reader.readAsText(file);
});
