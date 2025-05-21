// Sample event data with categories
const stores = [
    { name: 'Gallery One', lat: 45.6025, lng: -121.1922, event: 'Pop-up art show', time: '5–9 PM', category: 'shopping' },
    { name: 'Brew & Bites', lat: 45.6030, lng: -121.1930, event: 'Live acoustic set', time: '6–8 PM', category: 'food' },
    { name: 'Book Nook', lat: 45.6018, lng: -121.1915, event: 'Author readings', time: '5–7 PM', category: 'shopping' },
    { name: 'Vineyard Vibes', lat: 45.6020, lng: -121.1910, event: 'Wine Tasting', time: '5–8 PM', category: 'wine' },
    { name: 'Corner Cafe', lat: 45.6035, lng: -121.1925, event: 'Coffee & Pastries', time: '5–9 PM', category: 'food' },
    { name: 'Riverfront Grill', lat: 45.6027, lng: -121.1905, event: 'BBQ & Brews',            time: '6–9 PM', category: 'food' },
    { name: 'The Dalles Brewery', lat: 45.6032, lng: -121.1940, event: 'Tap Takeover',         time: '5–10 PM', category: 'wine' },
    { name: 'Craft Co‑Op',       lat: 45.6013, lng: -121.1920, event: 'Local Makers Market',   time: '5–8 PM',  category: 'shopping' },
    { name: 'Sunset Cellars',    lat: 45.6022, lng: -121.1902, event: 'Rosé Release Party',    time: '5–8 PM',  category: 'wine' },
    { name: 'Street Eats',       lat: 45.6038, lng: -121.1912, event: 'Food Truck Fiesta',     time: '5–9 PM',  category: 'food' }
];
const emojis = { shopping: '🛍️', food: '🍔', wine: '🍷' };
let storeMarkers = [];
let activeFilter = null;
let filterType = null;
let detailActive = false;  
let filterActive = false;    // put this under the other let declarations
const handle = document.getElementById('handle'); // Ensure this line exists in your script


// track which pin is “active”
/* ----------  pin highlighting  ---------- */
let selectedMarker = null;

function highlight(marker){
  /* remove old highlight */
  if (selectedMarker && selectedMarker._icon){
    selectedMarker._icon.querySelector('.pin')
                        .classList.remove('selected');
  }
  selectedMarker = marker;
  if (marker && marker._icon){
    marker._icon.querySelector('.pin')
                .classList.add('selected');
  }
}

/* ----------  clear everything  ---------- */
function clearHighlight() {
  console.log("clearHighlight called");
  if (selectedMarker && selectedMarker._icon){
    selectedMarker._icon.querySelector('.pin').classList.remove('selected');
    selectedMarker = null;
  }
  if (detailActive){                   
    console.log("hideDetail called");
    hideDetail();                      
  }
}


// Event Detial show hide.
const listBox   = document.getElementById('events');
const detailBox = document.getElementById('eventDetail');
const closeBtn  = document.getElementById('detailClose')  // we’ll add it below
const sheetHeader = document.getElementById('sheetHeader');

function showDetail(store){
detailActive = true; 

  sheetHeader.classList.add('hidden');   // 👈 hide “Nearby Events”
  filtersBar.classList.add('is-hidden'); // 🔹 hide filter pills
  /* populate markup */
  detailBox.innerHTML = `
    <div class="flex justify-between items-start mb-2">
      <h3>${store.event}</h3>
      <button id="detailClose" class="text-2xl font-bold text-gray-400">&times;</button>
    </div>
    <time>Open until ${store.time.split('–')[1]}</time>
    <p>${store.name}</p>
    <!-- placeholders for imgs … -->
    <div class="grid grid-cols-2 gap-4">
      <div class="bg-gray-200 rounded h-32"></div>
      <div class="bg-gray-200 rounded h-32"></div>
      <div class="bg-gray-200 rounded h-20"></div>
      <div class="bg-gray-200 rounded h-20"></div>
    </div>
  `;

  /* UI swap */
  listBox.classList.add('hidden');
  detailBox.classList.remove('hidden');

  /* expand sheet */
  currentTranslate = half;
  sheet.style.transition = 'transform .25s ease';
  sheet.style.transform = `translateY(${half}px)`;
  snapTo(currentTranslate); 

  /* hook close handler */
  detailBox.querySelector('#detailClose')
           .addEventListener('click', hideDetail, { once:true });
}

function hideDetail(){
  // Remove highlight from selected pin when detail closes
  if (selectedMarker && selectedMarker._icon) {
    selectedMarker._icon.querySelector('.pin').classList.remove('selected');
    selectedMarker = null;  // Optionally clear the selected marker reference
  }

  detailActive = false;
  sheetHeader.classList.remove('hidden');
  if (!filterActive) filtersBar.classList.remove('is-hidden');

  detailBox.classList.add('hidden');
  listBox.classList.remove('hidden');

  currentTranslate = half;
  sheet.style.transition = 'transform .25s ease';
  sheet.style.transform  = `translateY(${half}px)`;
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

const sheet = document.getElementById('sheet');
const scrollArea = document.getElementById('sheetScroll'); // scrollable list inside the sheet

// emoji (or icon-class) per category
const pinGlyph = { shopping:'📚', food:'🍔', wine:'🍷', default:'📍' };

/* build a Leaflet <divIcon>  */
function makePin(category, dim = false){
  const glyph = pinGlyph[category] || pinGlyph.default;
  const html  = `
    <div class="pin ${dim ? 'dim' : ''}">
        <div class="pin-inner">
      <svg width="38" height="48" viewBox="0 0 38 48" fill="none" xmlns="http://www.w3.org/2000/svg">
<circle cx="18.5263" cy="18.5263" r="18.5263" fill="#40407A"/>
<path d="M20.0514 46.093C19.251 47.0768 17.7489 47.0768 16.9485 46.093L5.07655 31.5L31.9233 31.5L20.0514 46.093Z" fill="#40407A"/>
<circle cx="18.5261" cy="18.5263" r="15.6316" fill="white"/>
</svg>
      <span class="pin-icon">${glyph}</span>
      </div>
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

    // Marker creation block
   const marker = L.marker(ll, { icon }).addTo(map);
   marker.on('click', e => {
        L.DomEvent.stopPropagation(e);   // so map-click doesn’t clear highlight
        highlight(marker);
        showDetail(s);
    });
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
        const marker = storeMarkers[i]; if(marker){ highlight(marker); showDetail(s); map.panTo([s.lat, s.lng]); }
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
map.on('click', clearHighlight);     // 🆕  blank-map tap = deselect + hide card
map.on('locationfound', onLocationFound);
map.on('locationerror', onLocationError);
map.locate({ setView:false, maxZoom:16 });

// Hook filter buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
    applyFilter(btn.dataset.type, btn.dataset.value);
    });
});

/* ---------- bottom-sheet drag (pointer events) ---------- */
const sheetHeight = sheet.getBoundingClientRect().height;
const collapsed   = sheetHeight - 96;      // 96 px peeking
const half        = sheetHeight / 2;
const expanded    = 0;

let currentTranslate = half;
sheet.style.transform = `translateY(${currentTranslate}px)`;

/* lock list scroll until sheet is fully open */
scrollArea.style.overflowY = 'hidden';
scrollArea.style.touchAction = 'none';

/* helpers */
const getY = e => (e.touches ? e.touches[0].clientY : e.clientY);
let startY = 0, draggingSheet = false;
// let pointerYAtScrollTopZero = null; // Stores pointer Y when scroll hits top during a downward swipe
let dragEffectiveStartY = 0;     // Add this
let dragInitialSheetY = 0;       // Add this
let sheetWasExpandedAndAtScrollTopOnPointerDown = false;
const SCROLL_TOP_BUFFER = 25; // Or any other value you prefer
let touchStartedOnEffectiveHandle = false; // Renamed flag
const EFFECTIVE_HANDLE_HEIGHT = 40; // Draggable area from the top of the sheet in pixels


function snaps() {
  return filterActive ? [half, expanded]     // when a filter is active
                      : [collapsed, half, expanded];
}
function snapTo(val) {
  currentTranslate = val;
  sheet.style.transition = 'transform .3s ease';
  sheet.style.transform = `translateY(${val}px)`;
  const isContentScrollable = scrollArea.scrollHeight > scrollArea.clientHeight;

  if (val === expanded && isContentScrollable) {
    scrollArea.style.overflowY = 'auto';
    scrollArea.style.touchAction = 'pan-y'; // READY for native content scroll
  } else {
    scrollArea.style.overflowY = 'hidden';
    scrollArea.style.touchAction = 'none';  // Sheet drag or no scroll
  }
}



function onPointerDown(e) {
  if (e.target.closest('#filters')) return; // Ignore taps on filter pills

  startY = getY(e); // getY(e) returns e.clientY
  draggingSheet = false;
  touchStartedOnEffectiveHandle = false; // Reset the flag at the start of every touch

  if (currentTranslate === expanded) { // Only apply this logic if the sheet is fully expanded
    const sheetRect = sheet.getBoundingClientRect();
    // Check if the pointerdown Y-coordinate is within the top EFFECTIVE_HANDLE_HEIGHT of the sheet
    if (startY >= sheetRect.top && startY <= sheetRect.top + EFFECTIVE_HANDLE_HEIGHT) {
      touchStartedOnEffectiveHandle = true;
    }
  }
  // If the sheet is not expanded (i.e., collapsed or half),
  // touchStartedOnEffectiveHandle remains false. The onPointerMove logic for these states
  // allows dragging from anywhere on the sheet, so this flag isn't needed for them.
}

// From your app.js
// Ensure EFFECTIVE_HANDLE_HEIGHT, expanded, currentTranslate, startY,
// draggingSheet, dragEffectiveStartY, dragInitialSheetY,
// touchStartedOnEffectiveHandle, sheet, scrollArea, and getY are defined in the accessible scope.

function onPointerMove(e) {
  const currentPointerY = getY(e);
  const overallDy = currentPointerY - startY;

  if (!draggingSheet) { // If we haven't already decided this gesture is a sheet drag
    let decisionToDragSheet = false;
    // Default drag baselines; these are used if a drag is initiated.
    let currentSegmentDragEffectiveStartY = startY;
    let currentSegmentDragInitialSheetY = currentTranslate;

    const sheetIsExpanded = (currentTranslate === expanded);

    if (sheetIsExpanded) {
      // --- Scenario A: Sheet is EXPANDED ---
      if (touchStartedOnEffectiveHandle) {
        // Gesture started on the "effective handle" (top 50px).
        // This gesture is reserved for sheet dragging. Prevent browser defaults IMMEDIATELY.
        e.preventDefault();
        scrollArea.style.touchAction = 'none';
        scrollArea.style.overflowY = 'hidden'; // Prevent native scroll/overscroll effects

        if (Math.abs(overallDy) > 6) { // Threshold for significant movement to actually drag
          decisionToDragSheet = true;
          // drag baselines (currentSegmentDragEffectiveStartY, currentSegmentDragInitialSheetY)
          // are already correctly set to startY and currentTranslate (which is 'expanded').
        }
        // If movement is minor (<=6px), decisionToDragSheet remains false, sheet doesn't move.
        // Browser default actions have already been prevented.
      } else {
        // Gesture started on content area (below effective handle) when sheet is expanded.
        // This is purely for content scrolling.
        return; // EXIT EARLY to allow native content scroll (relies on snapTo setting pan-y)
      }
    } else {
      // --- Scenario B: Sheet is COLLAPSED or HALF ---
      // Any significant swipe anywhere on the sheet will drag it.
      if (Math.abs(overallDy) > 6) {
        decisionToDragSheet = true;
        // drag baselines are startY and currentTranslate.
        // For these states, snapTo should have already set touchAction='none' and overflowY='hidden'.
        // We can re-affirm and prevent default to be absolutely sure.
        e.preventDefault();
        if(scrollArea.style.touchAction !== 'none') scrollArea.style.touchAction = 'none';
        if(scrollArea.style.overflowY !== 'hidden') scrollArea.style.overflowY = 'hidden';
      }
    }

    // If a decision was made to drag the sheet in any scenario:
    if (decisionToDragSheet) {
      draggingSheet = true;
      dragEffectiveStartY = currentSegmentDragEffectiveStartY;
      dragInitialSheetY = currentSegmentDragInitialSheetY;

      sheet.setPointerCapture(e.pointerId);
      // Styles (overflowY, touchAction) for scrollArea are set in the specific condition blocks above.
      // e.preventDefault() was also called in those blocks.
    }
    // If no decision to drag AND we haven't returned (e.g., minor move on effective handle when expanded,
    // or minor move on collapsed/half sheet):
    // We do nothing this frame and wait for more movement.
    // For the "expanded effective handle" case, default browser actions are already prevented.
  }

  // If actively dragging the sheet:
  if (draggingSheet) {
    e.preventDefault(); // This is the main preventDefault for active dragging.
    const dyForSheetMovement = currentPointerY - dragEffectiveStartY;
    let nextSheetY = dragInitialSheetY + dyForSheetMovement;

    nextSheetY = Math.max(expanded, Math.min(nextSheetY, collapsed));
    sheet.style.transition = '';
    sheet.style.transform = `translateY(${nextSheetY}px)`;
  }
}

function onPointerUp(e) {
  if (draggingSheet) {
    const currentPointerY = getY(e);
    const dyForSheetMovement = currentPointerY - dragEffectiveStartY;
    const attempted = dragInitialSheetY + dyForSheetMovement;

    const nearest = snaps().reduce(
      (p, c) => Math.abs(c - attempted) < Math.abs(p - attempted) ? c : p
    );
    snapTo(nearest);
    draggingSheet = false;
  } else {
    // If no drag occurred, ensure snapTo correctly sets styles,
    // especially if touchAction/overflowY were changed but no drag happened.
    snapTo(currentTranslate);
  }
  touchStartedOnEffectiveHandle = false; // Reset the new flag
}

sheet.addEventListener('pointerdown', onPointerDown);
sheet.addEventListener('pointermove', onPointerMove);
sheet.addEventListener('pointerup',   onPointerUp);