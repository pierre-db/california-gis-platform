/**
 * Global application state
 * Centralized state management for better organization and maintainability
 */
const appState = {
    // Map-related state
    map: null,
    baseLayerDefault: null,
    overlayLayerRight: null,
    geojsonLayers: null,
    overlayOpacity: 0.7,
    tileServerUrl: "http://localhost:5001",

    // Selection state
    selectedYearRight: "2024",
    selectedTheme: "agriculture",
    selectedIndicator: "none",
    selectedDistrict: null,

    // UI element references
    graphSwitchDiv: null,
    graphDiv: null,
    graphYearlyDiv: null,

    // Chart configuration
    graphLayout: null,
    graphYearlyLayout: null,
    graphConfig: null,

    // Feature flags
    eventsChecked: true,

    // Data
    indicator_descriptions: null,
    aoi_geojson: null,
    waterlevels_geojson: null,

    // Theme colors - will be initialized from CSS variables
    colors: {
        primary: null,
        secondary: null,
        grey: null
    }
};

/**
 * Initialize the map and chart when the DOM is loaded.
 */
document.addEventListener("DOMContentLoaded", async () => {
    // Initialize colors from CSS variables
    appState.colors.primary = getComputedStyle(document.documentElement).getPropertyValue('--bs-primary').trim();
    appState.colors.secondary = getComputedStyle(document.documentElement).getPropertyValue('--bs-secondary').trim();
    appState.colors.grey = getComputedStyle(document.documentElement).getPropertyValue('--bs-gray').trim();

    appState.map = L.map("map", { center: [36.866, -119.244], zoom: 6 });
    appState.selectedYearRight = "2025";

    await fetchJsonData();
    initializeMap();
    initializeCharts();
    initializeRightPanel();
    initializeLeftPanel();

    // hide the spinner once everything has been initialized
    document.getElementById("spinner").remove();

    startIntro(false);
});

/**
 * Use fetch to fetch a json file
 * @param {String} file - The path to the file to fetch
 */
async function fetchFile (file) {
return fetch(file)
    .then(function (response) {
        if (response.status == 404) {
            console.log(`Error 404: ${file} not found`);
            return null;
        } else {
            return response.json();
        }
    });
}

/**
 * Concurrently load data variables from JSON files
 */
async function fetchJsonData () {
    await Promise.all([
        fetchFile("./resources/data/indicator_descriptions.json"),
        fetchFile("./resources/data/aoi.json"),
        fetchFile("./resources/data/waterlevels.json")]).then((values) => {
            appState.indicator_descriptions = values[0];
            appState.aoi_geojson = values[1];
            appState.waterlevels_geojson = values[2];
        });
}

/**
 * Toggle the right panel's visibility when the button is clicked.
 */
document.getElementById("button-toggle-right-panel").addEventListener("click", () => {
    document.getElementById("right-panel").classList.toggle("open");
    appState.map.invalidateSize();
});

/**
 * Handle year slider input on the right side.
 */
document.getElementById("year-slider-right").addEventListener("input", () => {
    appState.selectedYearRight = document.getElementById("year-slider-right").value;
    document.getElementById("selected-year-right").textContent = appState.selectedYearRight;

    if (appState.selectedIndicator != "none") {
        appState.map.removeLayer(appState.overlayLayerRight);
        
        if (!appState.indicator_descriptions[appState.selectedIndicator] || ((appState.indicator_descriptions[appState.selectedIndicator].type || 'vector') == 'vector')) {
            appState.overlayLayerRight = getVectorLayer(appState.selectedIndicator, appState.selectedYearRight).addTo(appState.map);
            appState.overlayLayerRight.bringToBack();
        } else {
            appState.overlayLayerRight = L.tileLayer(getOverlayUrl(appState.selectedIndicator, appState.selectedYearRight), {
                zIndex: 1000,
                opacity: appState.overlayOpacity,
            }).addTo(appState.map).bringToFront();
        }
    }

    updateRightPanel();
});


/**
 * Handle the theme selection
 * @param {Event} event - The click event.
 */
document.getElementById("themes-selector").addEventListener("change", (event) => {
    if (appState.selectedTheme == event.target.value) {
        return;
    }
    if (appState.overlayLayerRight) {
        appState.map.removeLayer(appState.overlayLayerRight);
        appState.overlayLayerRight = null;
    }

    // desactivate the current indicator and select the indicator "none"
    document.querySelector("input[name='indicator'][value='" + appState.selectedIndicator + "']").checked = false;
    let indicatorNone = document.querySelector("input[name='indicator'][value='none']");
    indicatorNone.checked = true;
    indicatorNone.dispatchEvent(new Event('click'));

    document.querySelectorAll(".layer."+ appState.selectedTheme).forEach((div) => div.classList.toggle("visible"));
    appState.selectedTheme = event.target.value;
    document.querySelectorAll(".layer." + appState.selectedTheme).forEach((div) => div.classList.toggle("visible"));
    updateRightPanel();
});

/**
 * Handle radio button clicks for indicators
 * for each radio button `r`.
 * @param {Event} event - The click event.
 */
document.getElementsByName("indicator").forEach((r) =>
    r.addEventListener("click", function (event) {
        if (appState.selectedIndicator == event.target.value) {
            return;
        }
        if (appState.selectedIndicator != "none") {
            const arrow = document.querySelector("input[name='indicator'][value='" + appState.selectedIndicator + "']").parentElement.querySelector("span.fa");
            arrow.classList.toggle("visible");
            arrow.classList.remove('expanded');

            const infoDiv = document.querySelector("#left-panel #legend-container");
            if (infoDiv) document.querySelector("#left-panel #legend-container").remove();
        }
        appState.selectedIndicator = event.target.value;
        if (appState.selectedIndicator != "none") {
            const arrow = event.target.parentElement.querySelector("span.fa");
            arrow.classList.toggle("visible");
        }
        if (appState.overlayLayerRight) {
            appState.map.removeLayer(appState.overlayLayerRight);
            appState.overlayLayerRight = null;
        }
        if (!appState.indicator_descriptions[appState.selectedIndicator] || (appState.indicator_descriptions[appState.selectedIndicator].type || 'vector') == 'vector') {
            appState.overlayLayerRight = getVectorLayer(appState.selectedIndicator, appState.selectedYearRight).addTo(appState.map);
            appState.overlayLayerRight.bringToBack();
        } else if (appState.selectedIndicator != "none"){
            appState.overlayLayerRight = L.tileLayer(getOverlayUrl(appState.selectedIndicator, appState.selectedYearRight), {
                zIndex: 1000,
                opacity: appState.overlayOpacity,
            }).addTo(appState.map).bringToFront();
        }
        updateRightPanel();
    })
);

/**
 * Handle checkbox clicks for layers
 * for each checkbox `c`.
 * @param {Event} event - The click event.
 */
document.getElementsByName("layer").forEach((c) =>
    c.addEventListener("click", function (event) {
        const layer = event.target.value;
        if (event.target.checked) {
            appState.map.addLayer(appState.geojsonLayers[layer]);
        } else {
            appState.map.removeLayer(appState.geojsonLayers[layer]);
        }
    })
);

/**
 * Handle checkbox clicks for alternative layers
 * for each checkbox `c`.
 * @param {Event} event - The click event.
 */
document.getElementsByName("layer_alt").forEach((c) =>
    c.addEventListener("click", function (event) {
        const layer = event.target.value;
        if (event.target.checked) {
            fetchFile(`./resources/data/${layer}.json`)
                .then(function (geojson) {
                    appState.geojsonLayers[layer] = L.geoJSON(geojson, {
                        style: {
                            color: appState.colors.grey,
                            weight: 2,
                            opacity: 0.2,
                            fillColor: appState.colors.grey,
                            fillOpacity: 0.0,
                        },
                    });
                    appState.map.addLayer(appState.geojsonLayers[layer]);
                    appState.geojsonLayers[layer].bringToBack();
                });

        } else {
            appState.map.removeLayer(appState.geojsonLayers[layer]);
        }
    })
);

/**
 * Start the introductory tour when the button is clicked.
 */
document.getElementById("button-start-intro").addEventListener("click", () => {
    startIntro(true);
});

/**
 * Update the right panel based on the selected indicator and year.
 * This function is called when the selected indicator or year changes or when the split view mode is toggled.
 */
function updateRightPanel() {
    if (!appState.selectedDistrict) {
        admId = "none"
        document.getElementById("right-panel-title").textContent = appState.indicator_descriptions["none"]["info_panel_title"];
        document.getElementById("right-panel-subtitle").textContent = "";
        document.getElementById("right-panel-intro").innerHTML = appState.indicator_descriptions["none"]["info_panel_subtitle"];
        
        document.getElementById("right-panel-pop-stats").textContent = "";
        document.getElementById("right-panel-idps-stats").textContent = "";

        ["agriculture", "water", "climate"].forEach((indicator) => {
            document.getElementById(indicator + "-indicator-value").classList.remove("low", "mid", "hight");
        });
        document.querySelectorAll("#right-panel .indicator-label").forEach((p) => p.classList.remove("visible"));

        updateCharts([], [], [], []);

        return;
    } 
    admId = appState.selectedDistrict.feature.properties.district;
    Promise.all([
        fetchFile(`./resources/data/indicators_values/monthly/${appState.selectedYearRight}-${admId}.json`),
        fetchFile(`./resources/data/indicators_values/${admId}.json`)
    ]).then(function (values) {
        const indicators_values = Object.assign(values[0] || {}, values[1] || {});
        document.getElementById("right-panel-title").textContent = appState.selectedDistrict.feature.properties.district;
        document.getElementById("right-panel-intro").innerHTML = "";

        if (indicators_values) {
            document.getElementById("right-panel-pop-stats").innerHTML = '<span class="fa fa-users" aria-hidden="true"></span>' + indicators_values["n_population"].toLocaleString();
            document.getElementById("right-panel-idps-stats").innerHTML = '<span class="fa fa-area" aria-hidden="true"></span>' + indicators_values["population_density"].toLocaleString();
            
            // update the gauges
            // ["agriculture", "water", "climate"].forEach((indicator) => {
            //     document.getElementById(indicator + "-indicator-value").classList.remove("low", "mid", "hight");
            //     const classLevel = { 0: "low", 1: "mid", 2: "hight" }[indicators_values[indicator]];
            //     document.getElementById(indicator + "-indicator-value").classList.add(classLevel);
            // });
            // document.querySelectorAll("#right-panel .indicator-label").forEach((p) => p.classList.add("visible"));
            
            updateCharts(indicators_values[appState.selectedIndicator + "_ts"] || [],
                        indicators_values[appState.selectedIndicator + "_yearly_ts"] || [],
                        indicators_values[appState.selectedIndicator + "_avg_ts"] || [],
                        indicators_values[appState.selectedIndicator + "_std_ts"] || []);
        }
        else { 
            console.log("WARNING: Resource not found");
        }
    });
}

/**
 * Generate the info to display on the left panel indicator legend for the selected indicator
 * This function is called when the selected indicator arrow down is toggled
 * @param {HTMLElement} containerDiv
 * @param {String} indicator
 */
function generateIndicatorLegend(containerDiv, indicator) {
    const indicator_description = appState.indicator_descriptions[indicator];
    containerDiv.innerHTML = `<div id="legend-bar" style="display: none">
                                    <img src="" id="legend-bar-img" />
                                    <svg role="presentation" width="100%" height="10" xmlns="http://www.w3.org/2000/svg">
                                        <rect class="range-tick" x="0%" y="3" width="1" height="10"></rect>
                                        <rect class="range-tick" x="100%" y="3" width="1" height="10"></rect>
                                    </svg>
                                    <div class="tick-labels">
                                        <div class="tick-min" id="tick-min-info-panel">vmin</div>
                                        <div class="tick-max" id="tick-max-info-panel">vmax</div>
                                    </div>
                                </div>
                                <div id="legend-color" style="display: none">
                                    <div class="legend-row">
                                        <span class="color-wrapper">
                                            <span class="color-box" id="info-panel-color-box" style="background: #ff0000"></span>
                                        </span>
                                        <label id="color-label">Label</label>
                                    </div>
                                </div>
                                <div id="info-panel-subtitle"></div>
                                <p id="info-panel-source"></p>`;
    containerDiv.querySelector("#info-panel-subtitle").innerHTML = indicator_description["info_panel_subtitle"];
    containerDiv.querySelector("#info-panel-source").innerHTML = indicator_description["source"];
    if (indicator_description["stretch_range"]) {
        containerDiv.querySelector("#legend-bar").style.display = "block";
        containerDiv.querySelector(
            "#legend-bar-img"
        ).src = `resources/img/cmap-${indicator_description["colormap"]}-bar.webp`;
        containerDiv.querySelector("#tick-min-info-panel").textContent = "" + indicator_description["stretch_range"][0];
        containerDiv.querySelector("#tick-max-info-panel").textContent = "" + indicator_description["stretch_range"][1];
    } else {
        containerDiv.querySelector("#legend-bar").style.display = "none";
    }
    if (indicator_description["binary_color"] && indicator_description["binary_label"]) {
        containerDiv.querySelector("#legend-color").style.display = "block";
        containerDiv.querySelector("#info-panel-color-box").style.backgroundColor = `#${indicator_description["binary_color"]}`;
        containerDiv.querySelector("#color-label").textContent = indicator_description["binary_label"];
    } else {
        containerDiv.querySelector("#legend-color").style.display = "none";
    }
}

/**
 * Update the chart based on the selected indicator and year.
 * This function is called when the right panel is updated.
 * @param {Array} yIndYear - The current year ts
 * @param {Array} yIndYearly - The yearly ts
 * @param {Array} yIndAvg - The average year ts
 * @param {Array} yIndStdAvg - The average year std ts
 * @param {Array} yEventsYear - The current year events ts
 * @param {Array} yEventsAvg - The current year events ts
 */
function updateCharts(yIndYear, yIndYearly, yIndAvg, yIndStdAvg) {
    const x = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const xYearly = ["2020", "2021", "2022", "2023", "2024", "2025"];
    const units = { cropmask: "ha", waterextent: "ha", waterlevels: "m", precipitations: "mm", temperature: "°C" };
    const unitString = (units[appState.selectedIndicator] ? " (" + units[appState.selectedIndicator] + ")" : "");
    const hovertemplate = appState.selectedIndicator == "ndvi" ? "%{y:.3f}" : "%{y:,.2f}" + unitString;
    

    if (appState.selectedIndicator == "none" || yIndYearly.length == 0) {
        appState.graphSwitchDiv.style.display = "none";
    } else {
        appState.graphSwitchDiv.style.display = "block";
     }

    if (appState.selectedIndicator == "none" || yIndYear.length == 0) { // ["none", "cropmask", "population"].includes(appState.selectedIndicator)
        if (appState.selectedIndicator == "none" ||
            (appState.selectedIndicator == "waterlevels" && yIndYearly.length == 0)) {
            appState.graphDiv.style.display = "none";
        } else if (!appState.graphSwitchDiv.classList.contains("checked")) { 
            appState.graphDiv.style.display = "block";
        }
        // Put a place holder instead of the graph
        appState.graphDiv.innerHTML = "<div id='place-holder'>No monthly data available</div>";
        // Remove the chart
        Plotly.purge(appState.graphDiv);
    } else {
        const placeHolder = document.getElementById("place-holder");
        if (placeHolder) placeHolder.remove();

        appState.graphLayout["title"] = { text: appState.selectedIndicator, font: { size: 14 } };
        if (appState.graphSwitchDiv.classList.contains("checked")) {
            appState.graphDiv.style.display = "none";
        } else {
            appState.graphDiv.textContent = "";
            appState.graphDiv.style.display = "block";
        }
        // generate yLower and yUpper
        const yIndStdAvgUpper = [];
        const yIndStdAvgLower = [];
        for (let i = 0; i < yIndAvg.length; i++) {
            yIndStdAvgUpper.push(yIndAvg[i] + yIndStdAvg[i]);
            yIndStdAvgLower.unshift(yIndAvg[i] - yIndStdAvg[i]);
        }
        const graphData = [
            {
                x: x,
                y: yIndYear,
                name: appState.selectedYearRight,
                marker: { color: appState.colors.primary },
                hovertemplate: hovertemplate
            },
            {
                x: x,
                y: yIndAvg,
                name: "average",
                marker: { color: appState.colors.grey },
                hovertemplate: hovertemplate
            },
            {
                x: [...x, ...[...x].reverse()],
                y: [...yIndStdAvgUpper, ...yIndStdAvgLower],
                mode: 'none',
                fill: 'toself',
                name: 'std',
                fillcolor: "#6f6f6f33",
                hovertemplate: hovertemplate
            }];
        Plotly.newPlot(appState.graphDiv, graphData, appState.graphLayout, appState.graphConfig);
    }
    if (appState.selectedIndicator == "none" || yIndYearly.length == 0) {
        // Remove the chart
        appState.graphYearlyDiv.style.display = "none";
        Plotly.purge(appState.graphYearlyDiv);
    } else {
        appState.graphYearlyLayout["title"] = {text: appState.selectedIndicator + unitString, font: { size: 14 }};
        if (appState.graphSwitchDiv.classList.contains("checked")) {
            appState.graphYearlyDiv.style.display = "block";
        } else { 
            appState.graphYearlyDiv.style.display = "none";
        }
        const barsColors = Array(xYearly.length).fill(appState.colors.grey);
        barsColors[xYearly.indexOf(appState.selectedYearRight)] = appState.colors.primary;
        const graphYearlyData = [
            {
                x: xYearly,
                y: yIndYearly,
                name: "Yearly",
                type: "bar",
                orientation: "v",
                marker: { color: barsColors },
                hovertemplate: hovertemplate
            }];
        Plotly.newPlot(appState.graphYearlyDiv, graphYearlyData, appState.graphYearlyLayout, appState.graphConfig);
    }
    const disclaimerDiv = document.getElementById("right-panel-disclaimer");
    if (appState.selectedYearRight == 2025 && appState.selectedIndicator != "none" && yIndYearly.length > 0) {
        disclaimerDiv.innerHTML = appState.indicator_descriptions["none"]["info_panel_disclaimer"];
        disclaimerDiv.classList.add("visible");
    }
    else {
        disclaimerDiv.innerHTML = "";
        disclaimerDiv.classList.remove("visible");
    }
    if (!appState.selectedDistrict) {
        // Remove the chart
        appState.graphDiv.style.display = "none";
        Plotly.purge(appState.graphDiv);
    }
}

/**
 * Get the URL for overlay layers based on the indicator and year.
 * This function is called when the selected indicator or year changes
 * @param {string} indicator - The selected indicator.
 * @param {number} year - The selected year.
 * @returns {string} - The URL for the overlay layer.
 */
function getOverlayUrl(indicator, year) {
    const colormap = appState.indicator_descriptions[indicator]["colormap"];
    let url = `${appState.tileServerUrl}/singleband/${indicator}/${year}/{z}/{x}/{y}.png?colormap=${colormap}`;

    const stretch_range = appState.indicator_descriptions[indicator]["stretch_range"];
    if (stretch_range) url += `&stretch_range=[${stretch_range}]`;
    const binaryColor = appState.indicator_descriptions[indicator]["binary_color"];
    if (binaryColor) url += `&explicit_color_map={"1":"${binaryColor}"}`;
    return url;
}

/**
 * Get a new geojson layer for a given year
 * This function is called when the selected indicator or year changes
 * @param {string} layerName - The selected layer.
 * @param {number} year - The selected year.
 * @returns {L.geoJSON} - The URL for the overlay layer.
 */
function getVectorLayer(layerName, year) {   
    const colormap = (v) => v < -0.8 ? "#c80f0f":
                                    v < -0.6 ? "#d44444":
                                    v < -0.4 ? "#e07a7a":
                                    v < -0.2 ? "#edafaf":
                                    v < 0 ?    "#f9e4e4":
                                    v < 0.2 ?  "#e3e3ff":
                                    v < 0.4 ?  "#aaaaff":
                                    v < 0.6 ?  "#7171ff":
                                    v < 0.8 ?  "#3939ff":
                                               "#0000ff";
    
    const layers = {
        "waterlevels": appState.waterlevels_geojson,
    };
    const layerOptions = {
        filter: (feature) => feature.properties.year == year
    };
    if (layerName.slice(-4) == "-var") {
        layers[layerName] = aoi_geojson;

        delete layerOptions["filter"];
        columnName = layerName.slice(0, -4);
        layerOptions["style"] = function (feature) {
            // indicatoValue = indicators_yearly_variance[feature.properties.district + '_' + appState.selectedYearRight][columnName];
            return {
                fillColor: colormap(indicatoValue),
                color: "black",
                weight: 1,
                opacity: 0.7,
                fillOpacity: 0.7
            };
        };
    } else { 
        layerOptions["pointToLayer"] = function (feature, latlng) {
            return L.circleMarker(latlng, {
                radius: Math.log(feature.properties.value)*2,
                fillColor: "#"+appState.indicator_descriptions[appState.selectedIndicator]["binary_color"] || appState.colors.primary,
                color: "#"+appState.indicator_descriptions[appState.selectedIndicator]["binary_color"] || appState.colors.primary,
                weight: 1,
                opacity: 0.7,
                fillOpacity: 0.7
            });
        };
    } 

    return L.geoJSON(layers[layerName], layerOptions);
}

/**
 * Initialize the chart configuration.
 * This function is called when the DOM is loaded.
 */
function initializeCharts() {
    appState.graphSwitchDiv = document.getElementById("right-panel-switch-charts");

    // Chart for indicators
    appState.graphDiv = document.getElementById("right-panel-chart");
    appState.graphLayout = {
        margin: {
            t: 20,
            r: 0,
            l: 35,
            b: 0,
        },
        padding: 0,
        font: {size: 11},
        showlegend: true,
        legend: {
            orientation: "h",
            yanchor: "left",
            y: -0.2
        },
    };
    appState.graphConfig = {
        displayModeBar: false,
    };

    // Yearly chart for indicators
    appState.graphYearlyDiv = document.getElementById("right-panel-yearly-chart");
    appState.graphYearlyLayout = {
        margin: {
            t: 20,
            r: 0,
            l: 35,
            b: 20,
        },
        padding: 0,
        font: {size: 11},
        showlegend: false
    };
}


/**
 * Initialize the left panel with default values.
 * This function is called when the DOM is loaded.
 */
function initializeLeftPanel() {
    document.getElementById('year-slider-right').value = appState.selectedYearRight;
    document.querySelector('input[name="indicator"][value="none"]').checked = true;
    document.querySelectorAll(".layer").forEach((div) => {
        const indicator = div.querySelector("input").value;
        const indicator_description = appState.indicator_descriptions[indicator] || { left_panel_label: "", left_panel_tooltip: "" };
        
        div.querySelector(".left-panel-label").textContent = indicator_description["left_panel_label"];
        div.querySelector(".left-panel-tooltip").textContent = indicator_description["left_panel_tooltip"];
        div.querySelector("span.fa").addEventListener("click", function (event) {
            if (!event.target.classList.contains('expanded')) {
                event.target.classList.toggle('expanded');
            
                let infoDiv = document.createElement("div");
                infoDiv.setAttribute("id", "legend-container");
                event.target.after(infoDiv);
                generateIndicatorLegend(infoDiv, indicator);
            }
            else { 
                event.target.classList.toggle('expanded');

                const infoDiv = document.getElementById("legend-container");
                if (infoDiv) infoDiv.remove();
            }
        });
    });
    appState.selectedTheme = document.getElementById("themes-selector").value;
    document.querySelectorAll(".layer."+appState.selectedTheme).forEach((div) => {
        div.classList.toggle("visible");
    });
    document.querySelectorAll('input[type="checkbox"][name="layer"]').forEach((c) => {
        c.checked = true;
    });
}

/**
 * Initialize the right panel with default values.
 * This function is called when the DOM is loaded.
 */
function initializeRightPanel() {
    if (!appState.selectedDistrict) {
        admId = "none"
        document.getElementById("right-panel-title").textContent = appState.indicator_descriptions["none"]["info_panel_title"];
        document.getElementById("right-panel-intro").innerHTML = appState.indicator_descriptions["none"]["info_panel_subtitle"];
    }
    appState.graphSwitchDiv.addEventListener("click", function (event) { 
       appState.graphSwitchDiv.classList.toggle("checked");
        if (appState.graphSwitchDiv.classList.contains("checked")) {
            appState.graphDiv.style.display = "none";
            appState.graphYearlyDiv.style.display = "block";
        } else { 
            appState.graphDiv.style.display = "block";
            appState.graphYearlyDiv.style.display = "none";
        }
    })
}

/**
 * Initialize the map and its layers.
 * This function is called when the DOM is loaded.
 */
function initializeMap() {  
    appState.map.on("click", function () {
        if (appState.selectedDistrict) {
            appState.geojsonLayers["aoi"].resetStyle(appState.selectedDistrict);
            appState.selectedDistrict = null;
            updateRightPanel();
        }
    });

    // overlayLayerLeft = null;
    appState.overlayLayerRight = null;
    const aoiLayer = L.geoJSON(appState.aoi_geojson, {
        style: {
            color: "#ffff",
            weight: 2,
            opacity: 0.3,
            fillColor: "#000000",
            fillOpacity: 0.0,
        },
        onEachFeature: function (feature, layer) {
            layer.on({
                click: function (e) {
                    if (appState.selectedDistrict) {
                        appState.geojsonLayers["aoi"].resetStyle(appState.selectedDistrict);
                    }
    
                    let layer = e.target;
                    appState.selectedDistrict = layer;
                    updateRightPanel();
                
                    layer.setStyle({
                        weight: 5,
                        color: appState.colors.primary,
                        opacity: 0.8,
                        dashArray: ""
                    });
                
                    layer.bringToFront();
                    L.DomEvent.stopPropagation(e);
                }
            });
        }
    }).addTo(appState.map);
    appState.geojsonLayers = {
        "aoi": aoiLayer
    };

    initializeLeafletTools();
}

/**
 * Hash plugin to generate bookmarkable / shareable URLs
 * add mouse coords display, bottom left
 */
function initializeLeafletTools() {
    // var hash = new L.Hash(map);

    L.control.mousePosition({
        position: 'bottomleft',
        separator: ', ',
        emptyString: 'Mouse coords',
        lngFirst: true,
        numDigits: 3,
        prefix: '(LON, LAT) = '
    }).addTo(appState.map);

    // base maps
    // visit https://leaflet-extras.github.io/leaflet-providers/preview/
    const baseLayerLight = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        zIndex: 1,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="http://cartodb.com/attributions">CartoDB</a>',
    });
    
    const baseLayerDark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
        zIndex: 1,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
    });

    const baseLayerOSM = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        zIndex: 1,
        attribution: 'Tiles © Esri - Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    });

    const baseLayerESRI = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        zIndex: 1,
        attribution: '© OpenStreetMap'
    }).addTo(appState.map);

    const baseMaps = {
        "Satellite": baseLayerESRI,
        "Light Map": baseLayerLight,
        "Dark Map": baseLayerDark,
        "OSM Map": baseLayerOSM
    };

    // add a toggle to switch tooltips on/off
    let tooltip = new L.LayerGroup();
    tooltip.on("add", function() {
        appState.geojsonLayers["aoi"].eachLayer(function (layer) {
            layer.bindTooltip(
                layer.feature.properties.district,
                { permanent: false, direction: "auto" }
            );
        });
        });
        tooltip.on("remove", function() {
            appState.geojsonLayers["aoi"].eachLayer(function(layer) {
                layer.unbindTooltip();
            });
        });
    
    layerControl = L.control.layers(baseMaps, { "Tooltips": tooltip }, { collapsed: true }).addTo(appState.map).setPosition('bottomright');
    L.control.scale().addTo(appState.map);
}
/**
 * Start the introductory tour.
 * This function is called when the DOM is loaded or when introductory tour button is clicked.
 * - call "startIntro(true);" if you want to force the display even if the tutorial has already been completed, e.g. with a link: <a href="javascript:void(0)" onclick="startIntro(true)">Start guided tour</a>
 * - call "startIntro(false);" in main page loading, e.g. "$(document).ready(function() { startIntro(false; });" so it is played on first access only
 */
function startIntro(override) {
    // recover previous execution status, if any
    // var name = 'IntroJS-SLS-Wheat-Mapping';
    // var value = localStorage.getItem(name);
    var intro = introJs();

    intro
        .setOptions({
            steps: [
                {
                    title: "Quick guided tour",
                    element: document.querySelector("#button-start-intro"),
                    intro: "<p>Click here to display this quick guided tour.",
                },
                {
                    element: document.querySelector("#right-year"),
                    intro: "Select the season with this slider.",
                    position: "right",
                },
                {
                    element: document.querySelector("#left-theme"),
                    intro: "Select a theme. Each theme contain a selection of indicators.",
                    position: "right",
                },
                {
                    element: document.querySelector("#left-indicator"),
                    intro: "Select an indicator. Each indicator depends on the selected year.",
                    position: "right",
                },
                {
                    element: document.querySelector("#content"),
                    intro: "Useful information about the selected indicator, district and year are displayed here.",
                    position: "left",
                },
                {
                    element: document.querySelector("#left-layer"),
                    intro: "Select overlay layers. These add extra information, independant of the year.",
                    position: "right",
                },
                {
                    title: "That's it!",
                    element: document.querySelector("#map"),
                    intro: "You can start exploring the data on the map by clicking on a district.",
                    position: "right",
                },
                
            ],
            dontShowAgain: true,
            dontShowAgainCookie: "Wheat-Mapping-Tour-Disabled",
            disableInteraction: false,
        });
    
    if (intro.isActive() || override) {
        intro.setDontShowAgain(false);
        intro.start();
        };
    
}
