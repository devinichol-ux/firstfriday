// Top-level constants and state variables
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
const emojis = { shopping: '🛍️', food: '🍔', wine: '🍷' }; // Retained

// DOM Elements
const sheet = document.getElementById('sheet');
const scrollArea = document.getElementById('sheetScroll');
const handle = document.getElementById('handle'); // Visual handle element
const filtersBar = document.getElementById('filters');
const listBox = document.getElementById('events');
const detailBox = document.getElementById('eventDetail');
const sheetHeader = document.getElementById('sheetHeader');
const mapElement = document.getElementById('map');

// Leaflet and Map State
let map;
let storeMarkers = [];
let selectedMarker = null;
let lastLocation = null;
const eventsBounds = L.latLngBounds(stores.map(s => [s.lat, s.lng]));
const eventsCenter = eventsBounds.getCenter();

// Sheet State
let currentTranslate;
let draggingSheet = false;
let startY = 0;
let dragEffectiveStartY = 0;
let dragInitialSheetY = 0;
let touchStartedOnEffectiveHandle = false;
let ignoreCurrentGestureForSheet = false; // NEW: Flag to ignore gestures starting on filters

const EFFECTIVE_HANDLE_HEIGHT = 100; // As per your file
const DRAG_THRESHOLD = 6;

// Filter State
let activeFilter = null;
let filterType = null;
let filterActive = false;

// Detail View State
let detailActive = false;

// Sheet Snap Points
let sheetHeight, collapsed, half, expanded;

// --- UTILITY FUNCTIONS ---
const getY = e => (e.touches ? e.touches[0].clientY : e.clientY);

// --- INITIALIZATION ---
function initializeApp() {
    map = L.map(mapElement, { zoomControl: false });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a> © OpenStreetMap',
        subdomains: 'abcd', maxZoom: 19
    }).addTo(map);
    map.fitBounds(eventsBounds.pad(0.05));
    map.on('click', clearHighlight);
    map.on('locationfound', onLocationFound);
    map.on('locationerror', onLocationError);
    map.locate({ setView: false, maxZoom: 16 });

    sheetHeight = sheet.getBoundingClientRect().height;
    collapsed = sheetHeight - 96;
    half = sheetHeight / 2;
    expanded = 0;

    currentTranslate = half;
    snapTo(currentTranslate); // Initial position and styles

    updateListAndMap();

    sheet.addEventListener('pointerdown', onPointerDown);
    sheet.addEventListener('pointermove', onPointerMove);
    sheet.addEventListener('pointerup', onPointerUp);
    sheet.addEventListener('pointercancel', onPointerUp); // Handle cancel like up

    document.getElementById('clearFilter').addEventListener('click', clearActiveFilter);
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            applyFilter(btn.dataset.type, btn.dataset.value);
        });
    });
}

// --- MAP AND LIST ---
function highlight(marker) {
    if (selectedMarker && selectedMarker._icon) {
        selectedMarker._icon.querySelector('.pin').classList.remove('selected');
    }
    selectedMarker = marker;
    if (marker && marker._icon) {
        marker._icon.querySelector('.pin').classList.add('selected');
    }
}

function clearHighlight() {
    if (selectedMarker && selectedMarker._icon) {
        selectedMarker._icon.querySelector('.pin').classList.remove('selected');
        selectedMarker = null;
    }
    if (detailActive) {
        hideDetail();
    }
}

function makePin(category, dim = false) {
    const pinGlyph = { shopping: '🛍️', food: '🍔', wine: '🍷', default: '📍' };
    const glyph = pinGlyph[category] || pinGlyph.default;
    const html = `
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
    return L.divIcon({ html, className: '', iconSize: [40, 40], iconAnchor: [20, 40]});
}

function plotMarkers(currentMapLatLng, listToPlot) {
    storeMarkers.forEach(m => m.remove());
    storeMarkers = [];
    if (lastLocation) {
        L.circleMarker(lastLocation, { radius: 6, color: '#2563EB', fill: '#2563EB', fillOpacity: 1 }).addTo(map);
    }
    listToPlot.forEach(s => {
        const ll = L.latLng(s.lat, s.lng);
        const dim = activeFilter && filterType === 'category' && s.category !== activeFilter;
        const icon = makePin(s.category, dim);
        const marker = L.marker(ll, { icon }).addTo(map);
        marker.on('click', e => {
            L.DomEvent.stopPropagation(e);
            highlight(marker);
            showDetail(s);
            map.panTo([s.lat, s.lng]);
        });
        storeMarkers.push(marker);
    });
}

function renderList(currentMapLatLng, listToRender) {
    listBox.innerHTML = '';
    if (listToRender.length === 0 && filterType === 'distance' && activeFilter !== null) {
        const emptyMsg = document.createElement('p');
        emptyMsg.textContent = "No events near you right now, come on downtown!";
        emptyMsg.className = 'text-center text-gray-500 py-10 px-4';
        listBox.appendChild(emptyMsg);
    } else if (listToRender.length === 0 && activeFilter !== null) {
        const emptyMsg = document.createElement('p');
        emptyMsg.textContent = "No events match your current filter.";
        emptyMsg.className = 'text-center text-gray-500 py-10 px-4';
        listBox.appendChild(emptyMsg);
    } else {
        listToRender.forEach(s => {
            const ll = L.latLng(s.lat, s.lng);
            const mins = Math.round(ll.distanceTo(currentMapLatLng) / 80);
            const card = document.createElement('div');
            card.className = 'event-card flex justify-between items-start cursor-pointer';
            card.innerHTML = `
                <div>
                    <div class="event-card-title">${s.event}</div>
                    <div class="event-card-description">${s.name}</div>
                </div>
                <div class="event-card-distance">${mins}m walk</div>`;
            card.addEventListener('click', () => {
                const marker = storeMarkers.find(m => m.getLatLng().equals(ll));
                if (marker) {
                    highlight(marker);
                    showDetail(s);
                    map.panTo([s.lat, s.lng]);
                }
            });
            listBox.appendChild(card);
        });
    }
}

function fitToStores(listToFit) {
    if (!listToFit || listToFit.length === 0) {
        map.fitBounds(eventsBounds.pad(0.05));
        return;
    }
    const bounds = L.latLngBounds(listToFit.map(s => [s.lat, s.lng]));
    const sheetRect = sheet.getBoundingClientRect(); // Get current rect
    const sheetTopVal = sheetRect.top;
    const sheetVisibleHeight = window.innerHeight - sheetTopVal;
    const extraPad = sheetVisibleHeight + 40;
    map.fitBounds(bounds, { paddingTopLeft: [0, 40], paddingBottomRight: [0, extraPad] });
}

// --- DETAIL VIEW ---
function showDetail(store) {
    detailActive = true;
    sheetHeader.classList.add('hidden');
    filtersBar.classList.add('is-hidden');
    detailBox.innerHTML = `
      <div class="flex justify-between items-start mb-2">
        <h3>${store.event}</h3>
        <button id="detailCloseBtn" class="text-2xl font-bold text-gray-400">&times;</button>
      </div>
      <time>Open until ${store.time.split('–')[1].trim()}</time>
      <p>${store.name}</p>
      <div class="grid grid-cols-2 gap-4 mt-4">
        <div class="bg-gray-200 rounded h-32"></div><div class="bg-gray-200 rounded h-32"></div>
        <div class="bg-gray-200 rounded h-20"></div><div class="bg-gray-200 rounded h-20"></div>
      </div>`;
    listBox.classList.add('hidden');
    detailBox.classList.remove('hidden');
    snapTo(half); // Snap to half and update styles (currentTranslate will be updated by snapTo)
    detailBox.querySelector('#detailCloseBtn').addEventListener('click', hideDetail, { once: true });
}

function hideDetail() {
    if (selectedMarker && selectedMarker._icon) {
        selectedMarker._icon.querySelector('.pin').classList.remove('selected');
        selectedMarker = null;
    }
    detailActive = false;
    sheetHeader.classList.remove('hidden');
    if (!filterActive) filtersBar.classList.remove('is-hidden');
    detailBox.classList.add('hidden');
    listBox.classList.remove('hidden');
    snapTo(half); // Snap to half and update styles
}

// --- FILTERS ---
function applyFilter(type, value) {
    filterType = type;
    activeFilter = value;
    filterActive = true;

    const titleEL = document.getElementById('sheetTitle');
    const clearBtn = document.getElementById('clearFilter');
    if (type === 'category') {
        titleEL.textContent = value.charAt(0).toUpperCase() + value.slice(1);
    } else if (type === 'distance') {
        titleEL.textContent = `Within ${value}m Walk`;
    }
    clearBtn.style.display = 'block';
    filtersBar.classList.add('is-hidden');

    let targetTranslateState = currentTranslate;
    if (currentTranslate === collapsed) {
        targetTranslateState = half;
    }
    snapTo(targetTranslateState); // CRITICAL: Update sheet state and styles
    updateListAndMap();
}

function clearActiveFilter() {
    activeFilter = null;
    filterType = null;
    filterActive = false;
    document.getElementById('sheetTitle').textContent = 'Nearby Events';
    document.getElementById('clearFilter').style.display = 'none';
    filtersBar.classList.remove('is-hidden');
    // Call snapTo to ensure styles are correct for current position, especially if sheet was at 'expanded'
    snapTo(currentTranslate);
    updateListAndMap();
}

function updateListAndMap() {
    const currentMapLatLng = lastLocation || eventsCenter;
    let filteredList = stores;
    if (activeFilter) {
        if (filterType === 'category') {
            filteredList = stores.filter(s => s.category === activeFilter);
        } else if (filterType === 'distance') {
            filteredList = stores.filter(s => {
                const d = currentMapLatLng.distanceTo(L.latLng(s.lat, s.lng)) / 80;
                return d <= parseInt(activeFilter);
            });
        }
    }
    plotMarkers(currentMapLatLng, filteredList);
    renderList(currentMapLatLng, filteredList);
    fitToStores(activeFilter ? filteredList : stores);
}

// --- LOCATION ---
function onLocationFound(e) {
    lastLocation = e.latlng;
    updateListAndMap();
}
function onLocationError() {
    console.warn("Location access denied or error. Using default center.");
    lastLocation = eventsCenter;
    updateListAndMap();
}

// --- SHEET DRAG LOGIC ---
function snaps() {
    return filterActive ? [half, expanded] : [collapsed, half, expanded];
}

function snapTo(val) {
    currentTranslate = val; // Update global state
    sheet.style.transition = 'transform .3s ease';
    sheet.style.transform = `translateY(${val}px)`;

    const isContentScrollable = scrollArea.scrollHeight > scrollArea.clientHeight;
    if (val === expanded && isContentScrollable) {
        scrollArea.style.overflowY = 'auto';
        scrollArea.style.touchAction = 'pan-y'; // Enable native scroll for content
    } else {
        scrollArea.style.overflowY = 'hidden';
        scrollArea.style.touchAction = 'none';  // JS handles drag, or no scroll
    }
}

function onPointerDown(e) {
    ignoreCurrentGestureForSheet = false; // Reset for new gesture
    if (e.target.closest('#filters')) {
        ignoreCurrentGestureForSheet = true; // Mark this gesture to be ignored by sheet handlers
        return; // IMPORTANT: Allow default browser behavior for filters (pan-x)
    }

    startY = getY(e);
    draggingSheet = false; // Will be set to true in onPointerMove if criteria met
    touchStartedOnEffectiveHandle = false;

    if (currentTranslate === expanded) {
        const sheetRect = sheet.getBoundingClientRect();
        if (startY >= sheetRect.top && startY <= sheetRect.top + EFFECTIVE_HANDLE_HEIGHT) {
            touchStartedOnEffectiveHandle = true;
            // Aggressively take control if touch starts on effective handle when expanded
            // to prevent browser scroll/overscroll interference (the "glitch")
            e.preventDefault();
            scrollArea.style.touchAction = 'none';
            scrollArea.style.overflowY = 'hidden';
        }
    }
    // For collapsed/half, or expanded but touch not on effective handle,
    // no immediate style changes or preventDefault here. onPointerMove will decide.
}

function onPointerMove(e) {
    if (ignoreCurrentGestureForSheet) return; // If gesture started on filters, do nothing for sheet

    const currentPointerY = getY(e);
    const overallDy = currentPointerY - startY;

    if (!draggingSheet) { // If we haven't already committed to dragging the sheet
        let decisionToDragSheet = false;
        // Default drag baselines. These will be used if a drag is initiated.
        let currentSegmentDragEffectiveStartY = startY;
        let currentSegmentDragInitialSheetY = currentTranslate;

        const sheetIsExpanded = (currentTranslate === expanded);

        if (sheetIsExpanded) {
            if (touchStartedOnEffectiveHandle) {
                // Gesture started on effective handle. Styles/preventDefault already set in onPointerDown.
                // Just need to check if movement is enough to start visual drag.
                if (Math.abs(overallDy) > DRAG_THRESHOLD) {
                    decisionToDragSheet = true;
                }
            } else {
                // Touch started on content area when expanded. Allow native scroll.
                // snapTo(expanded) should have set touchAction='pan-y', overflowY='auto'.
                return; // EXIT EARLY
            }
        } else { // Sheet is Collapsed or Half
            if (Math.abs(overallDy) > DRAG_THRESHOLD) {
                decisionToDragSheet = true;
                // For collapsed/half drags, ensure styles prevent content scroll interference
                e.preventDefault(); // Prevent default for this drag
                if(scrollArea.style.touchAction !== 'none') scrollArea.style.touchAction = 'none';
                if(scrollArea.style.overflowY !== 'hidden') scrollArea.style.overflowY = 'hidden';
            }
        }

        if (decisionToDragSheet) {
            draggingSheet = true;
            dragEffectiveStartY = currentSegmentDragEffectiveStartY;
            dragInitialSheetY = currentSegmentDragInitialSheetY;
            sheet.setPointerCapture(e.pointerId); // Capture pointer events to the sheet

            // Ensure styles are set for dragging (might be redundant if set earlier but safe)
            scrollArea.style.touchAction = 'none';
            scrollArea.style.overflowY = 'hidden';
            // e.preventDefault() was called in the branches that set decisionToDragSheet = true
        }
        // If no decision to drag and not returned, it's a minor movement.
        // If it was on effective handle (expanded), defaults were already prevented in onPointerDown.
        // For other minor movements, default browser behavior is not prevented yet.
    }

    if (draggingSheet) {
        e.preventDefault(); // Main preventDefault during active dragging
        const dyForSheetMovement = currentPointerY - dragEffectiveStartY;
        let nextSheetY = dragInitialSheetY + dyForSheetMovement;
        nextSheetY = Math.max(expanded, Math.min(nextSheetY, collapsed));
        sheet.style.transition = ''; // No animation during drag
        sheet.style.transform = `translateY(${nextSheetY}px)`;
    }
}

function onPointerUp(e) {
    if (ignoreCurrentGestureForSheet) {
        ignoreCurrentGestureForSheet = false; // Reset flag
        return; // Do nothing for sheet if gesture was ignored
    }

    if (sheet.hasPointerCapture(e.pointerId)) {
        sheet.releasePointerCapture(e.pointerId);
    }

    if (draggingSheet) {
        const currentPointerY = getY(e);
        const dyForSheetMovement = currentPointerY - dragEffectiveStartY;
        const attempted = dragInitialSheetY + dyForSheetMovement;
        const nearest = snaps().reduce(
            (p, c) => Math.abs(c - attempted) < Math.abs(p - attempted) ? c : p
        );
        snapTo(nearest); // This will also set appropriate scrollArea styles
        draggingSheet = false;
    } else {
        // If no drag occurred, BUT styles might have been changed in onPointerDown
        // (e.g., for an aborted effective handle touch where currentTranslate === expanded).
        // Call snapTo to ensure scrollArea styles are reset correctly.
        if (currentTranslate === expanded && touchStartedOnEffectiveHandle) {
             snapTo(expanded); // Restore pan-y/auto if touch was on handle but no drag
        }
        // For other cases where no drag happened and styles weren't preemptively changed,
        // current styles from the last snapTo should still be valid.
        // Consider if a general snapTo(currentTranslate) is always needed here if not dragging.
        // For now, only explicitly resetting for the effective handle scenario.
    }
    touchStartedOnEffectiveHandle = false; // Reset this flag
}

// --- STARTUP ---
initializeApp();