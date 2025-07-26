function toggleSection(id) {
  const el = document.getElementById(id);
  el.style.display = (el.style.display === 'none') ? 'block' : 'none';
}

document.getElementById('close-info-panel').onclick = () => {
  document.getElementById('info-panel').classList.add('hidden');
};

const firebaseConfig = {
  apiKey: "AIzaSyAZ9VaCkHzzmYQOXu8pAAZrzGSFlaW00RM",
  authDomain: "building-survey-support.firebaseapp.com",
  projectId: "building-survey-support",
  storageBucket: "building-survey-support.appspot.com",
  messagingSenderId: "949437812769",
  appId: "1:949437812769:web:example"
};
firebase.initializeApp(firebaseConfig);

let map;
let areaPolygons = [];
const markerMap = {};
const markerMeta = {};
let zoomScale = 1;

document.getElementById('zoom-in').onclick = () => {
  zoomScale += 0.2;
  document.getElementById('info-image').style.transform = `scale(${zoomScale})`;
  document.getElementById('judge-image').style.transform = `scale(${zoomScale})`;
};
document.getElementById('zoom-out').onclick = () => {
  zoomScale = Math.max(0.4, zoomScale - 0.2);
  document.getElementById('info-image').style.transform = `scale(${zoomScale})`;
  document.getElementById('judge-image').style.transform = `scale(${zoomScale})`;
};

firebase.auth().signInWithEmailAndPassword("demo01@example.com", "demo20240607")
  .then(() => {
    initializeMap();
    loadEditorMapData();
    loadSurveyData();
  });

function initializeMap() {
  map = L.map('map').setView([35.05, 136.68], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);
}

function loadEditorMapData() {
  const mapData = localStorage.getItem("mapData");
  if (!mapData) return;
  const json = JSON.parse(mapData);
  const toggleList = document.getElementById("area-toggle-list");
  json.areas.forEach(area => {
    const polygon = L.polygon(area.coords, {
      color: area.color || '#3388ff',
      fillOpacity: 0.3
    }).addTo(map);
    polygon.bindPopup(`<strong>${area.name}</strong>`);
    const turfCoords = area.coords.map(([lat, lng]) => [lng, lat]);
    areaPolygons.push({
      name: area.name,
      polygon: turf.polygon([turfCoords.concat([turfCoords[0]])]),
      stats: { total: 0, 赤: 0, 黄: 0, 緑: 0, 未設定: 0 },
      leafletPolygon: polygon
    });

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = true;
    cb.onchange = () => {
      polygon.setStyle({ opacity: cb.checked ? 1 : 0, fillOpacity: cb.checked ? 0.3 : 0 });
    };
    const label = document.createElement('label');
    label.className = 'area-toggle';
    label.appendChild(cb);
    label.append(` ${area.name}`);
    const searchBtn = document.createElement('button');
    searchBtn.className = 'search-button';
    searchBtn.textContent = '🔍';
    searchBtn.onclick = () => {
      const stats = areaPolygons.find(a => a.name === area.name).stats;
      alert(`📊 ${area.name} の件数\n危険（赤）: ${stats.赤}\n要注意（黄）: ${stats.黄}\n調査済み（緑）: ${stats.緑}\n未設定: ${stats['未設定']}\n合計: ${stats.total}`);
    };
    label.appendChild(searchBtn);
    toggleList.appendChild(label);
  });
}

function loadSurveyData() {
  const db = firebase.firestore();
  const structureTypes = ['RC', 'SteelFramed', 'Wooden'];
  const buildingContainer = document.getElementById('building-items');
  const allMarkers = [];

  structureTypes.forEach(type => {
    db.collection('emergency_risk_assessment')
      .doc('guest_group').collection(type)
      .get().then(snaps => {
        snaps.forEach(doc => {
          const d = doc.data();
          const lat = d.building_latitude;
          const lng = d.building_longitude;
          const name = d.building_no || doc.id;
          const result = d.final_result || '未設定';
          if (typeof lat !== 'number' || typeof lng !== 'number') return;
          const point = turf.point([lng, lat]);
          const matched = [];
          const resultKey = ['赤', '黄', '緑'].find(k => result.includes(k)) || '未設定';

          areaPolygons.forEach(area => {
            if (turf.booleanPointInPolygon(point, area.polygon)) {
              matched.push(area.name);
              area.stats[resultKey]++;
              area.stats.total++;
            }
          });
          if (matched.length === 0) matched.push('（エリア外）');

          const color = getColorByResult(result);
          const id = `${type}_${doc.id}`;
          const marker = L.marker([lat, lng], { icon: getColorIcon(color) }).addTo(map);
          marker.bindPopup(`<strong>整理番号: ${name}</strong><br><b>調査結果:</b> <span style="color:${color}">${convertResultText(result)}</span><br><b>エリア:</b> ${matched.join('、')}`);
          markerMap[id] = marker;
          markerMeta[id] = { colorCode: getColorCode(result) };
          allMarkers.push(marker);

          marker.on('click', () => {
            document.getElementById('info-panel').classList.remove('hidden');
            document.getElementById('info-name').textContent = name;
            document.getElementById('info-result').textContent = convertResultText(result);
            document.getElementById('info-area').textContent = matched.join('、');
            zoomScale = 1;
            document.getElementById('info-image').style.transform = 'scale(1)';
            document.getElementById('judge-image').style.transform = 'scale(1)';

            // 全ての建物で sample.jpg を表示
            let surveyImgPath = "image/sample.jpg";
            document.getElementById('info-image').src = surveyImgPath;
            document.getElementById('info-image').style.display = "block";

            // 判定画像（赤・黄・緑）
            let judgeImg = "";
            if (result.includes("赤")) judgeImg = "image/red.jpg";
            else if (result.includes("黄")) judgeImg = "image/yellow.jpg";
            else if (result.includes("緑")) judgeImg = "image/green.jpg";
            else judgeImg = "";
            document.getElementById('judge-image').src = judgeImg;
            document.getElementById('judge-image').style.display = "none";

            document.getElementById('tab-survey').classList.add('tab-active');
            document.getElementById('tab-judge').classList.remove('tab-active');
          });

          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.checked = true;
          cb.dataset.id = id;
          cb.onchange = (e) => {
            const tid = e.target.dataset.id;
            if (e.target.checked) {
              markerMap[tid].addTo(map);
            } else {
              map.removeLayer(markerMap[tid]);
            }
          };
          const label = document.createElement('label');
          label.appendChild(cb);
          label.append(` ${name}`);
          buildingContainer.appendChild(label);
        });

        document.querySelectorAll('.result-filter').forEach(filter => {
          filter.addEventListener('change', () => {
            const visibleColors = Array.from(document.querySelectorAll('.result-filter:checked')).map(el => el.dataset.color);
            Object.entries(markerMap).forEach(([id, marker]) => {
              const color = markerMeta[id].colorCode;
              if (visibleColors.includes(color)) {
                marker.addTo(map);
              } else {
                map.removeLayer(marker);
              }
            });
          });
        });

        if (allMarkers.length > 0) {
          const group = L.featureGroup(allMarkers);
          map.fitBounds(group.getBounds().pad(0.2));
        }
      });
  });
}

document.getElementById('tab-survey').onclick = function() {
  this.classList.add('tab-active');
  document.getElementById('tab-judge').classList.remove('tab-active');
  document.getElementById('info-image').style.display = "block";
  document.getElementById('judge-image').style.display = "none";
};
document.getElementById('tab-judge').onclick = function() {
  this.classList.add('tab-active');
  document.getElementById('tab-survey').classList.remove('tab-active');
  document.getElementById('info-image').style.display = "none";
  document.getElementById('judge-image').style.display = "block";
};

function getColorByResult(result) {
  if (result.includes('緑')) return '#2ecc71';
  if (result.includes('黄')) return '#f1c40f';
  if (result.includes('赤')) return '#e74c3c';
  return '#888';
}
function getColorCode(result) {
  if (result.includes('赤')) return 'red';
  if (result.includes('黄')) return 'yellow';
  if (result.includes('緑')) return 'green';
  return 'gray';
}
function convertResultText(result) {
  if (result.includes('赤')) return '危険（赤）';
  if (result.includes('黄')) return '要注意（黄）';
  if (result.includes('緑')) return '調査済み（緑）';
  return '未設定';
}
function getColorIcon(color) {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color:${color}"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });
}
