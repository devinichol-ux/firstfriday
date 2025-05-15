  // Sample event data with categories
const stores = [
    { name: 'Gallery One', lat: 45.6025, lng: -121.1922, event: 'Pop-up art show', time: '5–9 PM', category: 'shopping' },
    { name: 'Brew & Bites', lat: 45.6030, lng: -121.1930, event: 'Live acoustic set', time: '6–8 PM', category: 'food' },
    { name: 'Book Nook', lat: 45.6018, lng: -121.1915, event: 'Author readings', time: '5–7 PM', category: 'shopping' },
    { name: 'Vineyard Vibes', lat: 45.6020, lng: -121.1910, event: 'Wine Tasting', time: '5–8 PM', category: 'wine' },
    { name: 'Corner Cafe', lat: 45.6035, lng: -121.1925, event: 'Coffee & Pastries', time: '5–9 PM', category: 'food' }
];
const emojis = { shopping: '🛍️', food: '🍔', wine: '🍷' };
let storeMarkers = [];
let activeFilter = null;
let filterType = null;

// track which pin is “active”
let selectedMarker = null;     

function highlight(marker){
  // 1. clear previous
  if (selectedMarker && selectedMarker._icon){
    selectedMarker._icon.querySelector('.pin')
                        .classList.remove('selected');
  }

  // 2. set new
  selectedMarker = marker;
  if (marker && marker._icon){
    marker._icon.querySelector('.pin')
                .classList.add('selected');
  }
}

// Clear highlihgt when clicked away
function clearHighlight(){
  if (selectedMarker && selectedMarker._icon){
    selectedMarker._icon.querySelector('.pin')
                        .classList.remove('selected');
    selectedMarker = null;
  }
}

/* bounds that encloses every event */
const eventsBounds  = L.latLngBounds(stores.map(s => [s.lat, s.lng]));
const eventsCenter  = eventsBounds.getCenter();   // handy later

function fitToStores(list) {
    if (!list.length) return;

    const bounds = L.latLngBounds(list.map(s => [s.lat, s.lng]));

    /* how much of the screen does the sheet cover? */
    const sheetTop    = sheet.getBoundingClientRect().top;        // px from viewport-top
    const sheetHeight = window.innerHeight - sheetTop;            // px hidden behind sheet
    const extraPad    = sheetHeight + 40;                         // +40 px breathing room

    map.fitBounds(bounds, {
    paddingTopLeft:     [0, 40],        // a little space above
    paddingBottomRight: [0, extraPad]   // big space below ⇒ markers sit higher
    });
}

// Initialize map
const map = L.map('map', { zoomControl:false });

L.tileLayer(
'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
{
    attribution:
    '&copy; <a href="https://carto.com/attributions">CARTO</a> © OpenStreetMap',
    subdomains: 'abcd',   // Carto serves tiles from a, b, c, d.*
    maxZoom: 19,
    tileSize: 256
}
).addTo(map);

// ⬇ Give the map a proper center & zoom before adding anything
map.fitBounds(eventsBounds.pad(0.05));   // 5 % padding; tweak to taste

// Clear any highlighted pins
map.on('click', clearHighlight);

// Filter Visibility
const filtersBar = document.getElementById('filters');

// emoji (or icon-class) per category
const pinGlyph = { shopping:'📚', food:'🍔', wine:'🍷', default:'📍' };

/* build a Leaflet <divIcon>  */
function makePin(category, dim = false){
  const glyph = pinGlyph[category] || pinGlyph.default;
  const html  = `
    <div class="pin ${dim ? 'dim' : ''}">
      <svg width="38" height="48" viewBox="0 0 38 48" fill="none" xmlns="http://www.w3.org/2000/svg">
<circle cx="18.5263" cy="18.5263" r="18.5263" fill="#40407A"/>
<path d="M20.0514 46.093C19.251 47.0768 17.7489 47.0768 16.9485 46.093L5.07655 31.5L31.9233 31.5L20.0514 46.093Z" fill="#40407A"/>
<circle cx="18.5261" cy="18.5263" r="15.6316" fill="white"/>
</svg>
      <span class="pin-icon">${glyph}</span>
    </div>`;
  return L.divIcon({
    html,
    className:'',            // we style purely via the html above
    iconSize:[40,40],
    iconAnchor:[20,40],      // point of the pin
    popupAnchor:[0,-40]
  });
}

// Plot markers
function plotMarkers(latlng, list) {
    storeMarkers.forEach(m => m.remove());
    storeMarkers = [];
    if (lastLocation) {   // ← only show the “user” circle after GeoLocation fires
    L.circleMarker(latlng, {
        radius:6, color:'#2563EB', fill:'#2563EB', fillOpacity:1
    }).addTo(map);
    }

    //map.setView(latlng,15);
    list.forEach((s, i) => {
    const ll = L.latLng(s.lat, s.lng);
    const dist = (latlng.distanceTo(ll)/1000).toFixed(2);
    // grey-out pins that don’t match an active *category* filter
    const dim = activeFilter && filterType === 'category' && s.category !== activeFilter;
    const icon = makePin(s.category, dim);
    const marker = L.marker(ll, {icon}).addTo(map)
        .bindPopup(`<strong>${s.name}</strong><br>${s.event} (${s.time})<br>${dist} km walk`);
    storeMarkers.push(marker);
    // highlight when user taps the pin *or* its list-card
    marker.on('click', e => {
  L.DomEvent.stopPropagation(e);          // ← keep map from clearing us
  highlight(marker);
});
    });
}

// Render list
function renderList(latlng, list) {
    const container = document.getElementById('events');
    container.innerHTML = '';
    list.forEach((s, i) => {
    const ll = L.latLng(s.lat, s.lng);
    const mins = Math.round(ll.distanceTo(latlng)/80);
    const card = document.createElement('div');
    card.className = 'event-card flex justify-between items-start cursor-pointer';
    card.innerHTML = `
        <div>
        <div class=\"event-card-title\">${s.event}</div>
        <div class=\"event-card-description\">${s.name}</div>
        </div>
        <div class=\"event-card-distance\">${mins}m walk</div>
    `;
    card.addEventListener('click', () => {
        const marker = storeMarkers[i]; if(marker){ highlight(marker); marker.openPopup(); map.panTo([s.lat, s.lng]); }
    });
    container.appendChild(card);
    });
}

// Apply filter and update UI
function applyFilter(type, value) {
    filterType = type;
    activeFilter = value;
    const titleEL = document.getElementById('sheetTitle');
    const clearBtn = document.getElementById('clearFilter');
    if(type === 'category') {
    titleEL.textContent = value.charAt(0).toUpperCase() + value.slice(1);
    } else if(type === 'distance') {
    titleEL.textContent = `Within ${value}m Walk`;
    }
    clearBtn.style.display = 'block';
    // Hide filter pills
    filtersBar.classList.add('is-hidden');
    filterActive = true;

    // if user was collapsed, pop to half so results are visible
    if (currentTranslate > half) {
    currentTranslate = half;
    sheet.style.transition = 'transform .25s ease';
    sheet.style.transform  = `translateY(${half}px)`;
    }

    updateListAndMap();
}

// Clear filter
document.getElementById('clearFilter').addEventListener('click', () => {
    activeFilter = null; filterType = null;
    document.getElementById('sheetTitle').textContent = 'Nearby Events';
    document.getElementById('clearFilter').style.display = 'none';
    // Show Filter Bar
    filtersBar.classList.remove('is-hidden');
    filterActive = false; 
    updateListAndMap();
});

// Update list & map with (filtered) events
function updateListAndMap() {
    // Use last known user location or fallback
    const latlng = lastLocation || eventsCenter;
    let filtered = stores;
    if(activeFilter) {
    if(filterType === 'category') {
        filtered = stores.filter(s => s.category === activeFilter);
    } else if(filterType === 'distance') {
        filtered = stores.filter(s => {
        const d = latlng.distanceTo(L.latLng(s.lat, s.lng))/80;
        return d <= parseInt(activeFilter);
        });
    }
    }
    plotMarkers(latlng, filtered);
    renderList(latlng, filtered);
    // ⬇ Center/zoom after rendering
    fitToStores(activeFilter ? filtered : stores);
}

// Store last location for filters
let lastLocation = null;
function onLocationFound(e) {
    lastLocation = e.latlng;
    updateListAndMap();
}
function onLocationError() {
    lastLocation = L.latLng(45.6025, -121.1922);
    updateListAndMap();
}
map.on('locationfound', onLocationFound);
map.on('locationerror', onLocationError);
map.locate({ setView:false, maxZoom:16 });

// Hook filter buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
    applyFilter(btn.dataset.type, btn.dataset.value);
    });
});

// Drag logic (touch & mouse)
const sheet = document.getElementById('sheet');
let startY = 0;                    // pointer Y at drag-start
let currentTranslate;              // ← declare, don’t assign yet


const sheetHeight = sheet.getBoundingClientRect().height;
// defining snap points
const collapsed = sheetHeight - 96;
const half = sheetHeight/2;
const expanded = 0;

/* snap-point helper – only HERE */
let filterActive = false;
function snaps () {
    return filterActive ? [half, expanded]
                        : [collapsed, half, expanded];
}

/* START STATE */
currentTranslate = half;                 // ⬅ default position
sheet.style.transform = `translateY(${half}px)`;

function getY(e){ return e.touches? e.touches[0].clientY : e.clientY; }
function onDragStart(e) {
    if (e.target.closest('#filters')) return; // 👈 touches on pills → ignore
    const y = getY(e);
    const rect = sheet.getBoundingClientRect();
    if(y - rect.top > 80) return;
    startY = y;
    document.body.classList.add('dragging');
    sheet.style.transition = '';
    window.addEventListener('mousemove', onDrag);
    window.addEventListener('touchmove', onDrag, { passive:false });
    window.addEventListener('mouseup', onDrop);
    window.addEventListener('touchend', onDrop);
}
function onDrag(e) {
    e.preventDefault();
    const y = getY(e);
    let next = currentTranslate + (y - startY);
    next = Math.max(expanded, Math.min(next, collapsed));
    sheet.style.transform = `translateY(${next}px)`;
}
function onDrop(e) {
    const y = e.changedTouches? e.changedTouches[0].clientY : e.clientY;
    const attempted = currentTranslate + (y - startY);
    /* use snaps() helper to pick nearest legal snap point */
    const nearest = snaps().reduce(
        (p,c) => Math.abs(c - attempted) < Math.abs(p - attempted) ? c : p
    );
    currentTranslate = nearest;

    sheet.style.transition = 'transform 0.3s ease-in-out';
    sheet.style.transform = `translateY(${nearest}px)`;
    document.body.classList.remove('dragging');
    window.removeEventListener('mousemove', onDrag);
    window.removeEventListener('touchmove', onDrag);
    window.removeEventListener('mouseup', onDrop);
    window.removeEventListener('touchend', onDrop);
}
sheet.addEventListener('mousedown', onDragStart);
sheet.addEventListener('touchstart', onDragStart, { passive:false });