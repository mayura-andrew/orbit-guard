// static/main.js - Enhanced with WorldPop API, USGS Seismic, Earthquake & NASA NEO Integration
    // ===== VALIDATION FUNCTIONS =====
    const validationRules = {
    diameter: {
        min: 0.001,
        max: 1000,
        message: "Please enter a diameter between 0.001 km and 1000 km."
    },
    velocity: {
        min: 11,
        max: 72,
        message: "Velocity must be between 11 and 72 km/s."
    },
    angle: {
        min: 0,
        max: 90,
        message: "Angle must be between 0 and 90 degrees."
    },
    popDensity: {
        min: 0,
        max: 100000,
        message: "Enter a population density between 0 and 100,000 people per km²."
    },
    composition: {
        validValues: [1000, 1500, 3000, 8000],
        message: "Please select a valid asteroid material."
    }
    };

    function validateInput(inputId, value) {
    const errorEl = document.getElementById(inputId + "Error");
    const rule = validationRules[inputId];
    
    if (!rule || !errorEl) return true;
    
    let isValid = true;
    let errorMessage = "";
    
    if (inputId === "composition") {
        const numValue = parseFloat(value);
        if (!rule.validValues.includes(numValue)) {
        isValid = false;
        errorMessage = rule.message;
        }
    } else {
        const numValue = parseFloat(value);
        if (isNaN(numValue) || numValue < rule.min || numValue > rule.max) {
        isValid = false;
        errorMessage = rule.message;
        }
    }
    
    if (!isValid) {
        errorEl.textContent = errorMessage;
        errorEl.classList.add("active");
    } else {
        errorEl.textContent = "";
        errorEl.classList.remove("active");
    }
    
    return isValid;
    }

    function validateAllInputs() {
    const diameter = document.getElementById("diameter").value;
    const velocity = document.getElementById("velocity").value;
    const angle = document.getElementById("angle").value;
    const popDensity = document.getElementById("popDensity").value;
    const composition = document.getElementById("composition").value;
    
    const isDiameterValid = validateInput("diameter", diameter);
    const isVelocityValid = validateInput("velocity", velocity);
    const isAngleValid = validateInput("angle", angle);
    const isPopDensityValid = validateInput("popDensity", popDensity);
    const isCompositionValid = validateInput("composition", composition);
    
    return isDiameterValid && isVelocityValid && isAngleValid && isPopDensityValid && isCompositionValid;
    }
    // ===== NASA NEO API Configuration =====
    const NASA_API_KEY = 'VCiJZ8rLYXP1dfTf6ImhFAIT51uGnP8dE1pIUhg9';
    const NASA_NEO_FEED_URL = `https://api.nasa.gov/neo/rest/v1/feed?api_key=${NASA_API_KEY}`;
    const NASA_NEO_DETAIL_URL = `https://api.nasa.gov/neo/rest/v1/neo/`;

    // ===== Global State for Selected NEO =====
    let selectedNEO = null;
    let orbitScene = null;
    let orbitCamera = null;
    let orbitRenderer = null;
    let orbitAnimationId = null;

    // ===== Mapbox Token =====
    if (typeof MAPBOX_TOKEN === "undefined" || !MAPBOX_TOKEN || MAPBOX_TOKEN === "YOUR_MAPBOX_ACCESS_TOKEN") {
    console.warn("MAPBOX_TOKEN is not set. Replace it in index.html or Flask env variable.");
    }
    mapboxgl.accessToken =
    MAPBOX_TOKEN ||
    "pk.eyJ1IjoicGVzaGFsYSIsImEiOiJjbWdiNWRldXkwdXhhMmpzNzlzeTFwa3k1In0.baq6CRqbJ6w9-ywkqDkWMA";

    // ===== Initialize Globe =====
    const map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/satellite-v9",
    center: [0, 20],
    zoom: 1.5,
    projection: "globe",
    antialias: true,
    });
    map.on("style.load", () => map.setFog({}));

    // ===== State =====
    let impactLat = null;
    let impactLon = null;
    let meteorMarker = null;
    let currentPulseAnimation = null;
    let seismicData = null;
    let fetchedPopDensity = null;

    // ===== Sliders UI with Validation =====
    function setupSlider(id, postfix) {
    const el = document.getElementById(id);
    const lbl = document.getElementById(id + "Value");
    if (!el || !lbl) return;

    const update = () => {
        let v = el.value;
        validateInput(id, v);
        
        if (postfix === "pop") {
        v = parseInt(v).toLocaleString() + " /km²";
        } else if (postfix) {
        v = v + postfix;
        }
        lbl.textContent = v;
        lbl.style.transform = "scale(1.05)";
        setTimeout(() => (lbl.style.transform = "scale(1)"), 150);
    };
    el.addEventListener("input", update);
    update();
    }

    setupSlider("diameter", " km");
    setupSlider("velocity", " km/s");
    setupSlider("angle", "°");
    setupSlider("popDensity", "pop");

    // ===== Enhanced Composition Selector with Animation =====
    const compositionSelect = document.getElementById("composition");
    const compositionLabel = document.getElementById("compositionValue");

    if (compositionSelect && compositionLabel) {
    compositionSelect.addEventListener("change", () => {
        const value = compositionSelect.value;
        validateInput("composition", value);
        
        const selectedOption = compositionSelect.options[compositionSelect.selectedIndex];
        const text = selectedOption.textContent.split("(")[0].trim();
        
        // Add glow animation
        compositionSelect.classList.add("value-changed");
        setTimeout(() => compositionSelect.classList.remove("value-changed"), 600);
        
        // Update label with animation
        compositionLabel.textContent = text;
        compositionLabel.style.color = "#00ff88";
        compositionLabel.style.transform = "scale(1.15)";
        setTimeout(() => {
        compositionLabel.style.color = "#00d4ff";
        compositionLabel.style.transform = "scale(1)";
        }, 300);
    });
    
    // Initialize
    const initialText = compositionSelect.options[compositionSelect.selectedIndex].textContent.split("(")[0].trim();
    compositionLabel.textContent = initialText;
    }

    // ===== WorldPop Population Density API =====
    async function fetchPopulationDensity(lat, lon) {
    const url = `https://worldpop.arcgis.com/arcgis/rest/services/WorldPop_Population_Density_100m/ImageServer/identify?geometry=${lon},${lat}&geometryType=esriGeometryPoint&returnGeometry=false&f=pjson`;
    
    try {
        console.log(`Fetching population density for: ${lat}, ${lon}`);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`WorldPop API error: ${response.status}`);
        
        const data = await response.json();
        console.log("WorldPop API response:", data);
        
        if (data.value !== undefined && data.value !== null && data.value > 0) {
        return Math.round(data.value);
        } else if (data.properties && data.properties.value !== undefined) {
        return Math.round(data.properties.value);
        } else {
        console.warn("No valid population density data in response");
        return null;
        }
    } catch (error) {
        console.error("Error fetching population density:", error);
        return null;
    }
    }

    function updatePopulationSlider(density) {
    const slider = document.getElementById("popDensity");
    const label = document.getElementById("popDensityValue");
    if (!slider || !label) return;
    
    const clampedDensity = Math.min(Math.max(density, 0), 10000);
    slider.value = clampedDensity;
    label.textContent = clampedDensity.toLocaleString() + " /km²";
    
    label.style.color = "#00ff88";
    label.style.transform = "scale(1.15)";
    setTimeout(() => {
        label.style.color = "#00d4ff";
        label.style.transform = "scale(1)";
    }, 500);
    
    console.log(`Population slider updated to: ${clampedDensity}`);
    }

    function showPopulationFeedback(message, isLoading = false) {
    const label = document.getElementById("popDensityValue");
    if (!label) return;
    
    if (isLoading) {
        label.textContent = message;
        label.style.color = "#ffaa00";
        label.style.fontStyle = "italic";
    } else {
        label.style.fontStyle = "normal";
    }
    }

    // ===== USGS Seismic Design API =====
    async function getSeismicData(lat, lon) {
    const url = `https://earthquake.usgs.gov/ws/designmaps/asce7-22.json?latitude=${lat}&longitude=${lon}&riskCategory=II&siteClass=C&title=ImpactSite`;
    
    try {
        console.log(`Fetching seismic data for: ${lat}, ${lon}`);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`USGS Seismic API error: ${response.status}`);
        
        const data = await response.json();
        console.log("Seismic data received:", data);
        
        if (data.response && data.response.data) {
        return {
            pgam: data.response.data.pgam || null,
            sdc: data.response.data.sdc || null,
            sds: data.response.data.sds || null,
            sd1: data.response.data.sd1 || null,
            latitude: lat,
            longitude: lon
        };
        }
        return null;
    } catch (error) {
        console.error("Error fetching seismic design data:", error);
        return null;
    }
    }

    function formatSeismicData(seismic) {
    if (!seismic || (!seismic.pgam && !seismic.sdc)) {
        return `<div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255, 255, 255, 0.08);">
        <p style="color: #ff9800; font-size: 13px; line-height: 1.7;">
            <b>⚠️ Seismic Conditions:</b><br>
            Seismic data unavailable for this location.
        </p>
        </div>`;
    }

    let sdcDescription = "";
    switch(seismic.sdc) {
        case "A": sdcDescription = "Minimal seismic risk"; break;
        case "B": sdcDescription = "Low seismic risk"; break;
        case "C": sdcDescription = "Moderate seismic risk"; break;
        case "D": sdcDescription = "High seismic risk"; break;
        case "E": 
        case "F": sdcDescription = "Very high seismic risk"; break;
        default: sdcDescription = "Unknown risk level";
    }

    return `<div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255, 255, 255, 0.08);">
        <p style="color: #a0aec0; font-size: 13px; line-height: 1.7; margin-bottom: 8px;">
        <b>🌍 Seismic Conditions at Impact Site:</b>
        </p>
        <p style="color: #ffffff; font-size: 13px; line-height: 1.6; margin: 6px 0;">
        <b style="color: #00d4ff;">Category ${seismic.sdc || 'N/A'}</b> - ${sdcDescription}
        </p>
        <p style="color: #a0aec0; font-size: 12px; line-height: 1.5; margin: 4px 0;">
        📊 Peak Ground Acceleration: <b style="color: #fff;">${seismic.pgam ? seismic.pgam.toFixed(3) + 'g' : 'N/A'}</b>
        </p>
        <p style="color: #a0aec0; font-size: 12px; line-height: 1.5; margin: 4px 0;">
        📈 Short-Period Response (SDS): <b style="color: #fff;">${seismic.sds ? seismic.sds.toFixed(3) + 'g' : 'N/A'}</b>
        </p>
        <p style="color: #a0aec0; font-size: 12px; line-height: 1.5; margin: 4px 0;">
        📉 1-Second Response (SD1): <b style="color: #fff;">${seismic.sd1 ? seismic.sd1.toFixed(3) + 'g' : 'N/A'}</b>
        </p>
    </div>`;
    }

    function calculateSeismicImpactModifier(pgam) {
    if (!pgam) return 1.0;
    return 1.0 + (Math.min(pgam, 1.0) * 0.15);
    }

    // ===== Map click: show meteor icon, fetch data =====
    map.on("click", async (e) => {
    const { lng, lat } = e.lngLat;
    impactLon = lng;
    impactLat = lat;

    if (meteorMarker) meteorMarker.remove();

    const el = document.createElement('div');
    el.style.width = '40px';
    el.style.height = '40px';
    el.style.backgroundImage = 'url(/static/meteor.png)';
    el.style.backgroundSize = 'contain';
    el.style.backgroundRepeat = 'no-repeat';
    el.style.backgroundPosition = 'center';
    el.style.cursor = 'pointer';
    el.style.filter = 'drop-shadow(0 0 8px rgba(255, 100, 0, 0.8))';

    meteorMarker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([lng, lat])
        .addTo(map);

    map.flyTo({ center: [lng, lat], zoom: 4, speed: 0.7, curve: 1.4, essential: true });

    showPopulationFeedback("Fetching...", true);

    const [seismic, popDensity] = await Promise.all([
        getSeismicData(lat, lng),
        fetchPopulationDensity(lat, lng)
    ]);

    seismicData = seismic;
    if (seismicData) console.log("Seismic data loaded:", seismicData);

    if (popDensity !== null && popDensity > 0) {
        fetchedPopDensity = popDensity;
        updatePopulationSlider(popDensity);
        console.log(`✓ Population density auto-updated: ${popDensity} people/km²`);
    } else {
        fetchedPopDensity = null;
        console.warn("Could not fetch population density, using manual slider value");
        showPopulationFeedback("", false);
    }
    });

    // ===== Utility Functions =====
    function removeIfExists(id) {
    if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(id)) map.removeSource(id);
    }

    function chooseZoomForCrater(craterMeters) {
    if (craterMeters <= 200) return 14;
    if (craterMeters <= 500) return 13;
    if (craterMeters <= 1000) return 12;
    if (craterMeters <= 2000) return 11;
    if (craterMeters <= 5000) return 10;
    if (craterMeters <= 10000) return 9;
    if (craterMeters <= 20000) return 8;
    if (craterMeters <= 50000) return 7;
    if (craterMeters <= 100000) return 6;
    return 5;
    }

    // ===== USGS Earthquake Historical Data =====
    async function fetchNearbyEarthquakes(lat, lon) {
    const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=${lat}&longitude=${lon}&maxradiuskm=500&limit=5&orderby=time`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`USGS API error: ${response.status}`);
        const data = await response.json();
        return data.features || [];
    } catch (error) {
        console.error("Error fetching earthquake data:", error);
        return [];
    }
    }

    function calculateEarthquakeEnergy(magnitude) {
    const energyJoules = Math.pow(10, 1.5 * magnitude + 4.8);
    return energyJoules / 4.184e15;
    }

    function getDirection(impactLat, impactLon, eqLat, eqLon) {
    const latDiff = eqLat - impactLat;
    const lonDiff = eqLon - impactLon;
    
    let direction = "";
    if (Math.abs(latDiff) > 0.5) direction += latDiff > 0 ? "N" : "S";
    if (Math.abs(lonDiff) > 0.5) direction += lonDiff > 0 ? "E" : "W";
    
    return direction || "near";
    }

    function formatEarthquakeComparison(asteroidEnergyMT, earthquakes, impactLat, impactLon) {
    if (!earthquakes || earthquakes.length === 0) {
        return `<div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255, 255, 255, 0.08);">
        <p style="color: #a0aec0; font-size: 13px; line-height: 1.7;">
            <b>🌊 Earthquake History:</b><br>
            No recent earthquake activity found within 500 km of this impact site.
        </p>
        </div>`;
    }

    let strongestEq = earthquakes[0];
    for (let eq of earthquakes) {
        if (eq.properties.mag > strongestEq.properties.mag) strongestEq = eq;
    }

    const magnitude = strongestEq.properties.mag;
    const place = strongestEq.properties.place || "Unknown location";
    const time = new Date(strongestEq.properties.time);
    const eqLat = strongestEq.geometry.coordinates[1];
    const eqLon = strongestEq.geometry.coordinates[0];
    
    const R = 6371;
    const dLat = (eqLat - impactLat) * Math.PI / 180;
    const dLon = (eqLon - impactLon) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(impactLat * Math.PI / 180) * Math.cos(eqLat * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    const direction = getDirection(impactLat, impactLon, eqLat, eqLon);
    const eqEnergy = calculateEarthquakeEnergy(magnitude);
    const ratio = asteroidEnergyMT / eqEnergy;
    
    let comparisonText = "";
    if (ratio >= 1) {
        comparisonText = `The asteroid impact releases <b style="color: #ff4500;">${ratio.toFixed(1)}× more energy</b> than this earthquake.`;
    } else {
        const inverseRatio = eqEnergy / asteroidEnergyMT;
        comparisonText = `This earthquake released <b style="color: #00d4ff;">${inverseRatio.toFixed(1)}× more energy</b> than the simulated asteroid impact.`;
    }
    
    const formattedDate = time.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return `<div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255, 255, 255, 0.08);">
        <p style="color: #a0aec0; font-size: 13px; line-height: 1.7; margin-bottom: 8px;">
        <b>🌊 Earthquake History:</b>
        </p>
        <p style="color: #ffffff; font-size: 13px; line-height: 1.6; margin: 6px 0;">
        <b style="color: #00d4ff;">Magnitude ${magnitude.toFixed(1)}</b> earthquake
        </p>
        <p style="color: #a0aec0; font-size: 12px; line-height: 1.5; margin: 4px 0;">
        📍 ${distance.toFixed(0)} km ${direction} · ${place}
        </p>
        <p style="color: #a0aec0; font-size: 12px; line-height: 1.5; margin: 4px 0;">
        📅 ${formattedDate}
        </p>
        <p style="color: #a0aec0; font-size: 12px; line-height: 1.5; margin: 4px 0;">
        ⚡ Earthquake energy: ${eqEnergy < 0.01 ? eqEnergy.toExponential(2) : eqEnergy.toFixed(3)} MT TNT
        </p>
        <p style="color: #ffffff; font-size: 13px; line-height: 1.7; margin-top: 10px; padding: 10px; background: rgba(0, 212, 255, 0.06); border-radius: 8px; border-left: 3px solid #00d4ff;">
        ${comparisonText}
        </p>
    </div>`;
    }

    // ===== Run Simulation (Update the existing event listener) =====
    document.getElementById("runBtn").addEventListener("click", async () => {
    // Validate all inputs first
    if (!validateAllInputs()) {
        alert("Please correct the invalid inputs before running the simulation.");
        return;
    }
    
    if (impactLat === null || impactLon === null) {
        alert("Please select an impact site on the globe first!");
        return;
    }

    if (meteorMarker) {
        meteorMarker.remove();
        meteorMarker = null;
    }

    if (currentPulseAnimation) {
        clearInterval(currentPulseAnimation);
        currentPulseAnimation = null;
    }

    let populationDensity = fetchedPopDensity !== null && fetchedPopDensity > 0 
        ? fetchedPopDensity 
        : parseFloat(document.getElementById("popDensity").value);

    const payload = {
        diameter_km: parseFloat(document.getElementById("diameter").value),
        velocity_km_s: parseFloat(document.getElementById("velocity").value),
        angle_deg: parseFloat(document.getElementById("angle").value),
        population_density_per_km2: populationDensity,
        density_kg_m3: parseFloat(document.getElementById("composition").value),
        lat: impactLat,
        lon: impactLon,
    };

    // Rest of the simulation code remains the same...
    const div = document.getElementById("resultsOverlay");
    div.style.display = "block";
    const content = div.querySelector(".results-content");
    if (content) {
        content.innerHTML = `<p style="text-align: center; color: #00d4ff;">Loading simulation data...</p>`;
    }

    let data, earthquakes;
    try {
        const [simResponse, eqData] = await Promise.all([
        fetch("/simulate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        }),
        fetchNearbyEarthquakes(impactLat, impactLon)
        ]);
        
        if (!simResponse.ok) throw new Error("Server error " + simResponse.status);
        data = await simResponse.json();
        earthquakes = eqData;
    } catch (err) {
        console.error("Simulation fetch error:", err);
        if (content) {
        content.innerHTML = `<p style="color: #ff4500;">Error running simulation. Check console for details.</p>`;
        }
        return;
    }

    let seismicModifier = 1.0;
    let modifiedCraterDepth = data.crater_depth_m;
    
    if (seismicData && seismicData.pgam) {
        seismicModifier = calculateSeismicImpactModifier(seismicData.pgam);
        modifiedCraterDepth = data.crater_depth_m * seismicModifier;
    }

    const craterRadiusKm = (data.crater_d_m / 2) / 1000;
    const fireballRadiusKm = craterRadiusKm * 3;
    const shockwaveRadiusKm = craterRadiusKm * 8;

    const layersToRemove = ["impact-point", "crater-line", "crater-fill", "crater-glow", "fireball-line", "fireball-fill", "shockwave-line", "shockwave-fill"];
    const sourcesToRemove = ["impact-point", "crater-fill", "crater-glow", "fireball-fill", "shockwave-fill"];
    
    layersToRemove.forEach(id => { if (map.getLayer(id)) map.removeLayer(id); });
    sourcesToRemove.forEach(id => { if (map.getSource(id)) map.removeSource(id); });

    const craterGeo = turf.circle([impactLon, impactLat], craterRadiusKm, { steps: 128, units: "kilometers" });
    const fireballGeo = turf.circle([impactLon, impactLat], fireballRadiusKm, { steps: 128, units: "kilometers" });
    const shockwaveGeo = turf.circle([impactLon, impactLat], shockwaveRadiusKm, { steps: 128, units: "kilometers" });

    
    map.addSource("shockwave-fill", { type: "geojson", data: shockwaveGeo });
    map.addLayer({
        id: "shockwave-fill",
        type: "fill",
        source: "shockwave-fill",
        paint: { "fill-color": "#ff4500", "fill-opacity": 0.08 },
    });
    map.addLayer({
        id: "shockwave-line",
        type: "line",
        source: "shockwave-fill",
        paint: { "line-color": "#ff4500", "line-width": 1, "line-opacity": 0.3 },
    });

    map.addSource("fireball-fill", { type: "geojson", data: fireballGeo });
    map.addLayer({
        id: "fireball-fill",
        type: "fill",
        source: "fireball-fill",
        paint: { "fill-color": "#ff8c00", "fill-opacity": 0.25 },
    });
    map.addLayer({
        id: "fireball-line",
        type: "line",
        source: "fireball-fill",
        paint: { "line-color": "#ff6600", "line-width": 1.5, "line-opacity": 0.5 },
    });

    map.addSource("crater-glow", { type: "geojson", data: craterGeo });
    map.addLayer({
        id: "crater-glow",
        type: "line",
        source: "crater-glow",
        paint: {
        "line-color": "#ffaa00ff",
        "line-width": 8,
        "line-blur": 6,
        "line-opacity": 0.6,
        },
    });

    map.addSource("crater-fill", { type: "geojson", data: craterGeo });
    map.addLayer({
        id: "crater-fill",
        type: "fill",
        source: "crater-fill",
        paint: { "fill-color": "#1a1a1a", "fill-opacity": 0.92 },
    });
    map.addLayer({
        id: "crater-line",
        type: "line",
        source: "crater-fill",
        paint: { "line-color": "#d4a574", "line-width": 2.5 },
    });

    map.addSource("impact-point", {
        type: "geojson",
        data: {
        type: "FeatureCollection",
        features: [{ type: "Feature", geometry: { type: "Point", coordinates: [impactLon, impactLat] } }],
        },
    });
    map.addLayer({
        id: "impact-point",
        type: "circle",
        source: "impact-point",
        paint: {
        "circle-radius": 5,
        "circle-color": "#ffffff",
        "circle-stroke-color": "#ff0000",
        "circle-stroke-width": 2,
        "circle-opacity": 0.95,
        },
    });

    const zoomLevel = chooseZoomForCrater(data.crater_d_m);
    map.flyTo({ center: [impactLon, impactLat], zoom: zoomLevel, speed: 0.9, curve: 1.4, essential: true });

    let pulseDirection = 1;
    let pulseSize = 5;
    currentPulseAnimation = setInterval(() => {
        pulseSize += pulseDirection * 0.5;
        if (pulseSize >= 8) pulseDirection = -1;
        if (pulseSize <= 5) pulseDirection = 1;
        if (map.getLayer("impact-point")) {
        map.setPaintProperty("impact-point", "circle-radius", pulseSize);
        } else {
        clearInterval(currentPulseAnimation);
        currentPulseAnimation = null;
        }
    }, 80);

    const earthquakeComparison = formatEarthquakeComparison(data.energy_mt, earthquakes, impactLat, impactLon);
    const seismicInfo = formatSeismicData(seismicData);

    let popSourceNote = "";
    if (fetchedPopDensity !== null && fetchedPopDensity > 0) {
        popSourceNote = ` <span style="color: #00ff88; font-size: 11px;">(auto-fetched from WorldPop)</span>`;
    }

    let depthNote = "";
    if (seismicModifier > 1.0) {
        const percentIncrease = ((seismicModifier - 1.0) * 100).toFixed(1);
        depthNote = ` <span style="color: #ff9800; font-size: 11px;">(+${percentIncrease}% due to ground instability)</span>`;
    }

    // Add NEO source indicator if using selected NEO data
    let neoSourceNote = "";
    if (selectedNEO) {
        neoSourceNote = `<p style="margin-top: 16px; padding: 12px; background: rgba(99, 102, 241, 0.1); border-radius: 8px; border-left: 3px solid #6366f1;">
        <b style="color: #8b5cf6;">Using NASA NEO Data:</b><br>
        <span style="color: #a0aec0; font-size: 12px;">${selectedNEO.name}</span>
        </p>`;
    }

    if (content) {
        content.innerHTML = `
        ${neoSourceNote}
        <p><b>Crater Diameter:</b> ${data.crater_d_m.toFixed(0)} m (${(data.crater_d_m / 1000).toFixed(2)} km)</p>
        <p><b>Crater Depth:</b> ${modifiedCraterDepth.toFixed(0)} m${depthNote}</p>
        <p><b>Impact Speed:</b> ${data.velocity_mph.toLocaleString()} mph</p>
        <p><b>Energy Released:</b> ${data.energy_mt.toLocaleString()} MT TNT</p>
        <p><b>Fireball Radius:</b> <span style="color:#ff6600;">${fireballRadiusKm.toFixed(2)} km</span></p>
        <p><b>Shockwave Radius:</b> <span style="color:#ff4500;">${shockwaveRadiusKm.toFixed(2)} km</span></p>
        <p><b>Population Density:</b> ${populationDensity.toLocaleString()} /km²${popSourceNote}</p>
        <p><b>Population Impact:</b> ${data.vaporized_population.toLocaleString()}</p>
        <p style="margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255, 255, 255, 0.08); display: block; color: #a0aec0; font-size: 13px; line-height: 1.7;">${data.summary_text}</p>
        ${seismicInfo}
        ${earthquakeComparison}
        `;
    }
    });

    // ========================================
    // NASA NEO INTEGRATION
    // ========================================

    // ----- Replace the early static neoButton/neoModal block with a safe, lazy initializer -----
    /*
    Original code previously did:
    const neoButton = document.getElementById('neoButton');
    const neoModal = document.getElementById('neoModal');
    const closeNeoModal = document.getElementById('closeNeoModal');
    const neoContent = document.getElementById('neoContent');

    neoButton.addEventListener('click', () => {
    neoModal.style.display = 'block';
    fetchNASANEOData();
    });
    closeNeoModal.addEventListener('click', () => {
    neoModal.style.display = 'none';
    });
    neoModal.addEventListener('click', (e) => {
    if (e.target === neoModal) { neoModal.style.display = 'none'; }
    });
    */
    function initNEOControls() {
	// Find the NEO button; if missing, nothing to do (button could be inserted later)
	const neoButton = document.getElementById('neoButton');
	if (!neoButton) return;

	// Use lazy DOM lookups inside handlers so elements parsed after this script are found at click time.
	neoButton.addEventListener('click', async () => {
		const neoModal = document.getElementById('neoModal');
		const neoContent = document.getElementById('neoContent');

		// Safely show modal if present
		if (neoModal) neoModal.style.display = 'block';

		// Provide immediate feedback in the modal content area (if exists)
		if (neoContent) {
			neoContent.innerHTML = `
				<div class="neo-loading">
					<div class="spinner"></div>
					<p>Fetching NASA NEO data...</p>
				</div>
			`;
		}

		// Fetch data (function itself is robust)
		await fetchNASANEOData();
	});

	// Close button (guarded)
	const closeNeoModal = document.getElementById('closeNeoModal');
	if (closeNeoModal) {
		closeNeoModal.addEventListener('click', () => {
			const neoModal = document.getElementById('neoModal');
			if (neoModal) neoModal.style.display = 'none';
		});
	}

	// Clicking outside the panel to close (global listener; checks modal existence at runtime)
	document.addEventListener('click', (e) => {
		const neoModal = document.getElementById('neoModal');
		if (neoModal && e.target === neoModal) {
			neoModal.style.display = 'none';
		}
	});
}

// Initialize immediately (handles cases where modal is already in DOM),
// and also again after DOMContentLoaded to be safe if some elements are parsed later.
try { initNEOControls(); } catch (err) { console.warn('NEO init (early) failed, will retry on DOMContentLoaded', err); }
document.addEventListener('DOMContentLoaded', () => {
	try { initNEOControls(); } catch (err) { console.error('NEO init failed on DOMContentLoaded', err); }
});

    // ===== Fetch NASA NEO Data =====
    // ...existing code...
    async function fetchNASANEOData() {
        neoContent.innerHTML = `
            <div class="neo-loading">
            <div class="spinner"></div>
            <p>Fetching NASA NEO data...</p>
            </div>
        `;
    
        try {
            console.log('Fetching NASA NEO data from:', NASA_NEO_FEED_URL);
            const response = await fetch(NASA_NEO_FEED_URL);
            
            if (!response.ok) {
            throw new Error(`NASA API error: ${response.status}`);
            }
    
            const data = await response.json();
            console.log('NASA NEO data received:', data);
            displayNEOList(data);
    
            // --- DEBUG: show raw JSON response with a toggle ---
            // Create toggle button
            const toggleBtn = document.createElement('button');
            toggleBtn.id = 'toggleRawNeoBtn';
            toggleBtn.className = 'btn-small';
            toggleBtn.textContent = 'Show Raw JSON';
            toggleBtn.style.marginTop = '12px';
    
            // Create pre element for pretty JSON
            const pre = document.createElement('pre');
            pre.id = 'neoRaw';
            pre.style.display = 'none';
            pre.style.maxHeight = '320px';
            pre.style.overflow = 'auto';
            pre.style.background = '#0b1220';
            pre.style.color = '#cbd5e1';
            pre.style.padding = '12px';
            pre.style.borderRadius = '6px';
            pre.style.marginTop = '8px';
            pre.textContent = JSON.stringify(data, null, 2);
    
            // Append to neoContent
            neoContent.appendChild(toggleBtn);
            neoContent.appendChild(pre);
    
            toggleBtn.addEventListener('click', () => {
                const isHidden = pre.style.display === 'none';
                pre.style.display = isHidden ? 'block' : 'none';
                toggleBtn.textContent = isHidden ? 'Hide Raw JSON' : 'Show Raw JSON';
                // also log to console on reveal
                if (isHidden) console.log('NASA NEO raw payload:', data);
            });
            // --- end debug UI ---
    
        } catch (error) {
            console.error('Error fetching NASA NEO data:', error);
            neoContent.innerHTML = `
            <div class="neo-error">
                <p>Unable to fetch NASA NEO data. Please try again later.</p>
                <p style="font-size: 12px; margin-top: 8px; color: #a0aec0;">Error: ${error.message}</p>
            </div>
            `;
        }
    }
    // ...existing code...
    // ===== Display NEO List =====
    function displayNEOList(data) {
    const neoObjects = [];
    
    if (data.near_earth_objects) {
        Object.keys(data.near_earth_objects).forEach(date => {
        data.near_earth_objects[date].forEach(neo => {
            neoObjects.push(neo);
        });
        });
    }

    if (neoObjects.length === 0) {
        neoContent.innerHTML = `
        <div class="neo-error">
            <p>No near-earth objects found in the current feed.</p>
        </div>
        `;
        return;
    }

    neoObjects.sort((a, b) => {
        const dateA = new Date(a.close_approach_data[0]?.close_approach_date_full || 0);
        const dateB = new Date(b.close_approach_data[0]?.close_approach_date_full || 0);
        return dateA - dateB;
    });

    let html = '<div class="neo-content">';
    
    neoObjects.slice(0, 20).forEach((neo) => {
        const closeApproach = neo.close_approach_data[0] || {};
        
        const name = neo.name || 'Unknown';
        const diameterMin = neo.estimated_diameter?.kilometers?.estimated_diameter_min || 0;
        const diameterMax = neo.estimated_diameter?.kilometers?.estimated_diameter_max || 0;
        const diameterAvg = ((diameterMin + diameterMax) / 2).toFixed(2);
        const velocityKmS = (parseFloat(closeApproach.relative_velocity?.kilometers_per_second) || 0).toFixed(2);
        const missDistanceKm = (parseFloat(closeApproach.miss_distance?.kilometers) || 0).toLocaleString();
        const approachDate = closeApproach.close_approach_date_full || 'Unknown';
        const isHazardous = neo.is_potentially_hazardous_asteroid;

        html += `
        <div class="neo-item">
            <div class="neo-item-name">
            ${name}
            ${isHazardous ? '<span class="neo-hazard-badge">HAZARDOUS</span>' : ''}
            </div>
            <div class="neo-item-details">
            <div class="neo-detail">
                <span title="Average estimated diameter of the asteroid">📏 Diameter:</span>
                <strong>${diameterAvg} km</strong>
            </div>
            <div class="neo-detail">
                <span title="Relative velocity as it approaches Earth">🚀 Velocity:</span>
                <strong>${velocityKmS} km/s</strong>
            </div>
            <div class="neo-detail">
                <span title="Distance by which the asteroid will miss Earth">🌍 Miss Distance:</span>
                <strong>${missDistanceKm} km</strong>
            </div>
            <div class="neo-detail">
                <span title="Date and time of closest approach to Earth">📅 Approach Date:</span>
                <strong>${new Date(approachDate).toLocaleDateString()}</strong>
            </div>
            </div>
            <button class="neo-view-orbit-btn" data-neo-id="${neo.id}" data-neo='${JSON.stringify(neo).replace(/'/g, "&#39;")}'>
            View Orbit & Simulate
            </button>
        </div>
        `;
    });

    html += '</div>';
    neoContent.innerHTML = html;

    document.querySelectorAll('.neo-view-orbit-btn').forEach(button => {
        button.addEventListener('click', function() {
        const neoData = JSON.parse(this.dataset.neo.replace(/&#39;/g, "'"));
        const neoId = this.dataset.neoId;
        fetchNEODetails(neoId, neoData);
        });
    });
    }

    // ===== Fetch Detailed NEO Data with Orbital Elements =====
    async function fetchNEODetails(neoId, basicData) {
    try {
        console.log(`Fetching detailed data for NEO ${neoId}`);
        const url = `${NASA_NEO_DETAIL_URL}${neoId}?api_key=${NASA_API_KEY}`;
        const response = await fetch(url);
        
        if (!response.ok) {
        throw new Error(`NASA API error: ${response.status}`);
        }

        const detailData = await response.json();
        console.log('Detailed NEO data received:', detailData);
        
        selectedNEO = detailData;
        showOrbitVisualization(detailData);

    } catch (error) {
        console.error('Error fetching NEO details:', error);
        alert('Unable to fetch detailed orbital data. Proceeding with basic data.');
        selectedNEO = basicData;
        showOrbitVisualization(basicData);
    }
    }

    // ===== Orbital Visualization Modal =====
    const orbitModal = document.getElementById('orbitModal');
    const orbitPanel = document.getElementById('orbitPanel');
    const closeOrbitModal = document.getElementById('closeOrbitModal');
    const orbitTitle = document.getElementById('orbitTitle');
    const orbitInfo = document.getElementById('orbitInfo');
    const selectImpactBtn = document.getElementById('selectImpactBtn');

    closeOrbitModal.addEventListener('click', () => {
    orbitModal.style.display = 'none';
    stopOrbitAnimation();
    });

    orbitModal.addEventListener('click', (e) => {
    if (e.target === orbitModal) {
        orbitModal.style.display = 'none';
        stopOrbitAnimation();
    }
    });

    selectImpactBtn.addEventListener('click', () => {
    orbitModal.style.display = 'none';
    neoModal.style.display = 'none';
    stopOrbitAnimation();
    
    if (selectedNEO) {
        const closeApproach = selectedNEO.close_approach_data?.[0] || {};
        const diameterMin = selectedNEO.estimated_diameter?.kilometers?.estimated_diameter_min || 0;
        const diameterMax = selectedNEO.estimated_diameter?.kilometers?.estimated_diameter_max || 0;
        const diameterAvg = (diameterMin + diameterMax) / 2;
        const velocityKmS = parseFloat(closeApproach.relative_velocity?.kilometers_per_second) || 20;
        
        updateSimulatorParameters(diameterAvg, velocityKmS);
        
        alert(`Loaded data for ${selectedNEO.name}!\n\nDiameter: ${diameterAvg.toFixed(2)} km\nVelocity: ${velocityKmS.toFixed(2)} km/s\n\nNow click on the globe to select an impact site, then click "Run Simulation".`);
    }
    });

    function updateSimulatorParameters(diameter, velocity) {
    const diameterSlider = document.getElementById('diameter');
    const velocitySlider = document.getElementById('velocity');
    
    if (diameterSlider) {
        const minD = parseFloat(diameterSlider.min) || 0.1;
        const maxD = parseFloat(diameterSlider.max) || 10;
        const clampedD = Math.min(Math.max(diameter, minD), maxD);
        diameterSlider.value = clampedD;
        diameterSlider.dispatchEvent(new Event('input', { bubbles: true }));
    }

    if (velocitySlider) {
        const minV = parseFloat(velocitySlider.min) || 5;
        const maxV = parseFloat(velocitySlider.max) || 70;
        const clampedV = Math.min(Math.max(velocity, minV), maxV);
        velocitySlider.value = clampedV;
        velocitySlider.dispatchEvent(new Event('input', { bubbles: true }));
    }
    }

    // ===== 3D Orbital Visualization with Three.js =====
    function showOrbitVisualization(neoData) {
    orbitModal.style.display = 'block';
    orbitTitle.textContent = neoData.name || 'Asteroid Orbit';
    
    const closeApproach = neoData.close_approach_data?.[0] || {};
    const orbitalData = neoData.orbital_data || {};
    
    const diameterMin = neoData.estimated_diameter?.kilometers?.estimated_diameter_min || 0;
    const diameterMax = neoData.estimated_diameter?.kilometers?.estimated_diameter_max || 0;
    const diameterAvg = ((diameterMin + diameterMax) / 2).toFixed(3);
    const velocityKmS = (parseFloat(closeApproach.relative_velocity?.kilometers_per_second) || 0).toFixed(2);
    const missDistanceKm = (parseFloat(closeApproach.miss_distance?.kilometers) || 0).toLocaleString();
    const approachDate = closeApproach.close_approach_date_full ? new Date(closeApproach.close_approach_date_full).toLocaleString() : 'Unknown';
    
    const semiMajorAxis = parseFloat(orbitalData.semi_major_axis) || 1.5;
    const eccentricity = parseFloat(orbitalData.eccentricity) || 0.2;
    const inclination = parseFloat(orbitalData.inclination) || 5;
    const perihelion = parseFloat(orbitalData.perihelion_distance) || 1.0;
    const aphelion = parseFloat(orbitalData.aphelion_distance) || 2.0;
    
    orbitInfo.innerHTML = `
        <div class="orbit-info-grid">
        <div class="orbit-info-item">
            <div class="orbit-info-label">Diameter</div>
            <div class="orbit-info-value">${diameterAvg} km</div>
        </div>
        <div class="orbit-info-item">
            <div class="orbit-info-label">Velocity</div>
            <div class="orbit-info-value">${velocityKmS} km/s</div>
        </div>
        <div class="orbit-info-item">
            <div class="orbit-info-label">Miss Distance</div>
            <div class="orbit-info-value">${missDistanceKm} km</div>
        </div>
        <div class="orbit-info-item">
            <div class="orbit-info-label">Closest Approach</div>
            <div class="orbit-info-value">${new Date(closeApproach.close_approach_date_full || Date.now()).toLocaleDateString()}</div>
        </div>
        <div class="orbit-info-item">
            <div class="orbit-info-label">Semi-Major Axis</div>
            <div class="orbit-info-value">${semiMajorAxis.toFixed(3)} AU</div>
        </div>
        <div class="orbit-info-item">
            <div class="orbit-info-label">Eccentricity</div>
            <div class="orbit-info-value">${eccentricity.toFixed(3)}</div>
        </div>
        <div class="orbit-info-item">
            <div class="orbit-info-label">Inclination</div>
            <div class="orbit-info-value">${inclination.toFixed(2)}°</div>
        </div>
        <div class="orbit-info-item">
            <div class="orbit-info-label">Perihelion</div>
            <div class="orbit-info-value">${perihelion.toFixed(3)} AU</div>
        </div>
        </div>
    `;
    
    initOrbitScene(semiMajorAxis, eccentricity, inclination);
    }

    function initOrbitScene(semiMajorAxis, eccentricity, inclination) {
    const container = document.getElementById('orbitCanvas');
    container.innerHTML = '';
    
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    orbitScene = new THREE.Scene();
    orbitScene.background = new THREE.Color(0x000000);
    
    orbitCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    orbitCamera.position.set(0, 10, 20);
    orbitCamera.lookAt(0, 0, 0);
    
    orbitRenderer = new THREE.WebGLRenderer({ antialias: true });
    orbitRenderer.setSize(width, height);
    container.appendChild(orbitRenderer.domElement);
    
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    orbitScene.add(ambientLight);
    
    const sunLight = new THREE.PointLight(0xffffff, 2, 100);
    sunLight.position.set(0, 0, 0);
    orbitScene.add(sunLight);
    
    const sunGeometry = new THREE.SphereGeometry(1, 32, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffaa00,
        emissive: 0xffaa00,
        emissiveIntensity: 1
    });
    const sun = new THREE.Mesh(sunGeometry, sunMaterial);
    orbitScene.add(sun);
    
    const sunGlowGeometry = new THREE.SphereGeometry(1.3, 32, 32);
    const sunGlowMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffaa00,
        transparent: true,
        opacity: 0.3
    });
    const sunGlow = new THREE.Mesh(sunGlowGeometry, sunGlowMaterial);
    orbitScene.add(sunGlow);
    
    const earthOrbitRadius = 5;
    const earthGeometry = new THREE.SphereGeometry(0.5, 32, 32);
    const earthMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x2233ff,
        emissive: 0x112288,
        emissiveIntensity: 0.2
    });
    const earth = new THREE.Mesh(earthGeometry, earthMaterial);
    earth.position.set(earthOrbitRadius, 0, 0);
    orbitScene.add(earth);
    
    const earthOrbitPoints = [];
    for (let i = 0; i <= 64; i++) {
        const angle = (i / 64) * Math.PI * 2;
        earthOrbitPoints.push(new THREE.Vector3(
        Math.cos(angle) * earthOrbitRadius,
        0,
        Math.sin(angle) * earthOrbitRadius
        ));
    }
    const earthOrbitGeometry = new THREE.BufferGeometry().setFromPoints(earthOrbitPoints);
    const earthOrbitMaterial = new THREE.LineBasicMaterial({ color: 0x4444ff, opacity: 0.3, transparent: true });
    const earthOrbitLine = new THREE.Line(earthOrbitGeometry, earthOrbitMaterial);
    orbitScene.add(earthOrbitLine);
    
    const a = semiMajorAxis * 5;
    const e = eccentricity;
    const b = a * Math.sqrt(1 - e * e);
    const c = a * e;
    
    const asteroidOrbitPoints = [];
    for (let i = 0; i <= 128; i++) {
        const angle = (i / 128) * Math.PI * 2;
        const x = a * Math.cos(angle) - c;
        const z = b * Math.sin(angle);
        const incRad = (inclination * Math.PI) / 180;
        const y = z * Math.sin(incRad);
        const zAdjusted = z * Math.cos(incRad);
        asteroidOrbitPoints.push(new THREE.Vector3(x, y, zAdjusted));
    }
    const asteroidOrbitGeometry = new THREE.BufferGeometry().setFromPoints(asteroidOrbitPoints);
    const asteroidOrbitMaterial = new THREE.LineBasicMaterial({ color: 0xff6600, linewidth: 2 });
    const asteroidOrbitLine = new THREE.Line(asteroidOrbitGeometry, asteroidOrbitMaterial);
    orbitScene.add(asteroidOrbitLine);
    
    const asteroidGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const asteroidMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xaaaaaa,
        roughness: 0.8,
        metalness: 0.2
    });
    const asteroid = new THREE.Mesh(asteroidGeometry, asteroidMaterial);
    orbitScene.add(asteroid);
    
    let angle = 0;
    function animateOrbit() {
        orbitAnimationId = requestAnimationFrame(animateOrbit);
        
        angle += 0.005;
        const x = a * Math.cos(angle) - c;
        const z = b * Math.sin(angle);
        const incRad = (inclination * Math.PI) / 180;
        const y = z * Math.sin(incRad);
        const zAdjusted = z * Math.cos(incRad);
        asteroid.position.set(x, y, zAdjusted);
        
        const earthAngle = angle * 0.3;
        earth.position.set(
        Math.cos(earthAngle) * earthOrbitRadius,
        0,
        Math.sin(earthAngle) * earthOrbitRadius
        );
        
        orbitCamera.position.x = Math.cos(angle * 0.1) * 20;
        orbitCamera.position.z = Math.sin(angle * 0.1) * 20;
        orbitCamera.lookAt(0, 0, 0);
        
        orbitRenderer.render(orbitScene, orbitCamera);
    }
    
    animateOrbit();
    }

    function stopOrbitAnimation() {
    if (orbitAnimationId) {
        cancelAnimationFrame(orbitAnimationId);
        orbitAnimationId = null;
    }
    if (orbitRenderer) {
        orbitRenderer.dispose();
        orbitRenderer = null;
    }
    orbitScene = null;
    orbitCamera = null;
    }

    document.getElementById("defendEarthBtn").addEventListener("click", () => {
  window.location.href = "/game";
});

document.getElementById("defendEarthBtn").addEventListener("click", () => {
  window.location.href = "/game";
});

document.addEventListener("DOMContentLoaded", () => {
  const neoButton = document.getElementById("neoButton");
  const defendButton = document.getElementById("defendEarthBtn");

  if (neoButton) {
    neoButton.addEventListener("click", () => {
      alert("NASA NEOs button clicked!"); // You can open a modal or panel here
    });
  }

  if (defendButton) {
    defendButton.addEventListener("click", () => {
      window.location.href = "/game";
    });
  }
});
// ===== NASA NEO BUTTON & MODAL =====

document.addEventListener("DOMContentLoaded", () => {
  const neoButton = document.getElementById("neoButton");
  const neoModal = document.getElementById("neoModal");
  const neoContent = document.getElementById("neoContent");
  const closeNeoModal = document.getElementById("closeNeoModal");

  if (!neoButton) {
    console.error("NASA NEO button not found in DOM");
    return;
  }

  // When click NEO button → open modal and fetch NASA data
  neoButton.addEventListener("click", async () => {
    console.log("NASA NEOs button clicked"); // 🔍 check in console
    neoModal.style.display = "flex";
    neoContent.innerHTML = `
      <div class="neo-loading">
        <div class="spinner"></div>
        <p>Fetching NASA NEO data...</p>
      </div>
    `;

    try {
      const response = await fetch("https://api.nasa.gov/neo/rest/v1/feed?api_key=VCiJZ8rLYXP1dfTf6ImhFAIT51uGnP8dE1pIUhg9");
      const data = await response.json();

      const allAsteroids = Object.values(data.near_earth_objects).flat();
      const html = allAsteroids.slice(0, 15).map(neo => {
        const name = neo.name;
        const size = neo.estimated_diameter.kilometers.estimated_diameter_max.toFixed(2);
        const speed = parseFloat(neo.close_approach_data[0].relative_velocity.kilometers_per_second).toFixed(1);
        const date = neo.close_approach_data[0].close_approach_date_full;
        const hazard = neo.is_potentially_hazardous_asteroid ? "⚠️ Hazardous" : "✅ Safe";

        return `
          <div class="neo-item">
            <h4>${name}</h4>
            <p><strong>Diameter:</strong> ${size} km</p>
            <p><strong>Velocity:</strong> ${speed} km/s</p>
            <p><strong>Close Approach:</strong> ${date}</p>
            <p><strong>Status:</strong> ${hazard}</p>
          </div>
        `;
      }).join("");

      neoContent.innerHTML = `<div class="neo-list">${html}</div>`;
    } catch (error) {
      neoContent.innerHTML = `<p style="color:red;">Failed to load NASA data.</p>`;
      console.error("NEO fetch error:", error);
    }
  });

  // Close modal when clicking the ×
  closeNeoModal.addEventListener("click", () => {
    neoModal.style.display = "none";
  });

  // Close when clicking outside the panel
  neoModal.addEventListener("click", (e) => {
    if (e.target === neoModal) neoModal.style.display = "none";
  });
});
