let workingCSV = []; // Global workingCSV variable
let mapMarkers = {}; // Store map markers by their index
let map; // Global map variable
let userPolygon = null; // Store the user-drawn polygon
let addToListButton; // Declare addToListButton in the global scope

function initializeMap() {
    if (!map) {
        map = L.map('map').setView([51.505, -0.09], 2);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        }).addTo(map);

        // Right-click to copy coordinates
        map.on("contextmenu", function(e) {
            const latlng = e.latlng;
            const coord = `${latlng.lat.toFixed(6)},${latlng.lng.toFixed(6)}`;
            navigator.clipboard.writeText(coord).then(function() {
                alert("Copied the coordinate: " + coord);
            }, function(err) {
                console.error("Could not copy text: ", err);
            });
        });

        // Initialize the draw control and pass it the FeatureGroup of editable layers
        const drawnItems = new L.FeatureGroup();
        map.addLayer(drawnItems);

        const drawControl = new L.Control.Draw({
            edit: {
                featureGroup: drawnItems
            },
            draw: {
                polygon: true,
                polyline: false,
                rectangle: false,
                circle: false,
                marker: false,
                circlemarker: false
            }
        });
        map.addControl(drawControl);

        // Event handler for when a polygon is created
        map.on(L.Draw.Event.CREATED, function(event) {
            const layer = event.layer;

            if (userPolygon) {
                map.removeLayer(userPolygon);
            }

            userPolygon = layer;
            drawnItems.addLayer(layer);

            // Enable the "Add to List" button
            addToListButton.disabled = false;
        });

        plotEmitters();
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const systemTypeSelect = document.getElementById('system-type-select');
    const systemNameSelect = document.getElementById('system-name-select');
    const emitterNameContainer = document.getElementById('emitter-name-container');
    const workingCSVPreview = document.getElementById('working-csv-preview');
    addToListButton = document.createElement('button'); // Initialize the button here
    addToListButton.innerText = 'Add to List';
    addToListButton.className = 'blue-green';
    addToListButton.disabled = true; // Initially disable the button

    function createOption(value) {
        const option = document.createElement('option');
        option.value = value;
        option.text = value;
        return option;
    }

    // Populate the system type dropdown
    if (typeof systemTypes !== 'undefined' && Array.isArray(systemTypes)) {
        systemTypes.forEach(systemType => {
            systemTypeSelect.appendChild(createOption(systemType));
        });
    }

    systemTypeSelect.addEventListener('change', () => {
        const systemType = systemTypeSelect.value;
        systemNameSelect.innerHTML = '<option value="">Select System</option>';
        emitterNameContainer.innerHTML = '';

        if (systemType && typeof systemNames !== 'undefined' && systemNames[systemType]) {
            const names = systemNames[systemType];
            names.forEach(name => {
                systemNameSelect.appendChild(createOption(name));
            });
        }
    });

    systemNameSelect.addEventListener('change', () => {
        const systemType = systemTypeSelect.value;
        const systemName = systemNameSelect.value;
        emitterNameContainer.innerHTML = '';

        if (systemName) {
            const filteredEmitters = emitters.filter(row => row.systemType === systemType && row.systemName === systemName);
            filteredEmitters.forEach(emitter => {
                const div = document.createElement('div');
                div.innerHTML = `<label>${emitter.emitterName} <input type="number" min="0" placeholder="Count" data-emitter-name="${emitter.emitterName}" data-elnot="${emitter.elnot}" data-freq="${emitter.freq}"></label>`;
                emitterNameContainer.appendChild(div);
            });

            emitterNameContainer.appendChild(addToListButton); // Append button here to ensure it is visible

            addToListButton.addEventListener('click', () => {
                const countInputs = document.querySelectorAll('[data-emitter-name]');
                if (userPolygon) {
                    console.log(`User polygon: ${userPolygon}`); // Debug userPolygon
                    countInputs.forEach(input => {
                        const count = parseInt(input.value);
                        if (count > 0) {
                            for (let i = 0; i < count; i++) {
                                const emitterName = input.getAttribute('data-emitter-name');
                                const emitterData = filteredEmitters.find(row => row.emitterName === emitterName);
                                const location = generateRandomLatLonInPolygon(userPolygon);
                                console.log(`Generated location: ${location}`); // Debug location generation
                                const newEntry = {
                                    systemType: emitterData.systemType,
                                    systemName: emitterData.systemName,
                                    emitterName: emitterName,
                                    elnot: emitterData.elnot,
                                    freq: emitterData.freq,
                                    location: location // Generate random location within polygon
                                };
                                workingCSV.push(newEntry);
                            }
                        }
                    });
                    updateCSVPreview();
                    plotEmitters();
                }
            });
        }
    });

    function generateRandomLatLonInPolygon(polygon) {
        let point;
        do {
            point = turf.randomPoint(1, { bbox: turf.bbox(polygon.toGeoJSON()) }).features[0].geometry.coordinates;
        } while (!turf.booleanPointInPolygon(point, polygon.toGeoJSON()));
        const latlng = L.latLng(point[1], point[0]);
        return `${latlng.lat.toFixed(6)},${latlng.lng.toFixed(6)}`;
    }

    function generateRandomLatLonNearby(lat, lon, maxDistanceFeet = 500) {
        const maxDistanceMeters = maxDistanceFeet * 0.3048;
        const randomDistance = Math.random() * maxDistanceMeters;
        const randomAngle = Math.random() * 2 * Math.PI;
        const deltaLat = randomDistance * Math.cos(randomAngle) / 111320; // Approx conversion from meters to degrees
        const deltaLon = randomDistance * Math.sin(randomAngle) / (111320 * Math.cos(lat * Math.PI / 180));
        return `${(lat + deltaLat).toFixed(6)},${(lon + deltaLon).toFixed(6)}`;
    }

    function updateCSVPreview() {
        if (workingCSV.length === 0) {
            workingCSVPreview.innerHTML = '<p>No data added yet.</p>';
            return;
        }

        const table = document.createElement('table');
        const headerRow = document.createElement('tr');
        const headers = ['Select', 'System Type', 'System Name', 'Emitter Name', 'ELNOT', 'Frequency', 'Location'];
        headers.forEach(header => {
            const th = document.createElement('th');
            th.textContent = header;
            headerRow.appendChild(th);
        });
        table.appendChild(headerRow);

        workingCSV.forEach((row, index) => {
            const tr = document.createElement('tr');
            tr.addEventListener('click', () => {
                tr.classList.toggle('selected');
            });

            const selectTd = document.createElement('td');
            const selectCheckbox = document.createElement('input');
            selectCheckbox.type = 'checkbox';
            selectTd.appendChild(selectCheckbox);
            tr.appendChild(selectTd);

            Object.values(row).forEach((value, idx) => {
                const td = document.createElement('td');
                const input = document.createElement('input');
                input.type = 'text';
                input.value = value;
                if (headers[idx] === 'Location') {
                    input.classList.add('location-input');
                }
                input.addEventListener('change', () => {
                    workingCSV[index][Object.keys(row)[idx]] = input.value;
                });
                td.appendChild(input);
                tr.appendChild(td);
            });

            table.appendChild(tr);
        });

        workingCSVPreview.innerHTML = '';
        workingCSVPreview.appendChild(table);
    }

    function clearMapMarkers() {
        Object.values(mapMarkers).forEach(marker => {
            marker.remove();
        });
        mapMarkers = {};
    }

    function plotEmitters() {
        clearMapMarkers();
        workingCSV.forEach((row, index) => {
            const [lat, lon] = row.location.split(',').map(Number); // Ensure correct parsing

            const customIcon = L.divIcon({
                className: 'custom-div-icon',
                html: `<div class="custom-icon"><img src="./pictures/icon2.png" alt="icon"><span>${row.emitterName}</span></div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });

            const marker = L.marker([lat, lon], { draggable: true, icon: customIcon }).addTo(map);
            marker.on("dragend", function(e) {
                const latlng = e.target.getLatLng();
                const newLocation = `${latlng.lat.toFixed(6)},${latlng.lng.toFixed(6)}`; // Ensure no space between lat and lon
                row.location = newLocation;
                updateLocationBox(newLocation, index);
            });
            mapMarkers[index] = marker;
        });
    }

    function updateLocationBox(newLocation, index) {
        const locationInput = document.querySelector(`#working-csv-preview tr:nth-child(${index + 2}) input.location-input`);
        if (locationInput) {
            locationInput.value = newLocation;
        }
    }

    function sendIrcMessage(message, delay = 0) {
        return new Promise((resolve) => {
            setTimeout(() => {
                fetch('http://localhost:3000/send-message', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ message: message })
                })
                .then(response => {
                    if (response.ok) {
                        console.log('Message sent successfully:', message);
                    } else {
                        console.error('Failed to send message:', message);
                    }
                    resolve(); // Resolve the promise after the message is sent
                })
                .catch(error => {
                    console.error('Error:', error);
                    resolve(); // Resolve the promise even if there is an error
                });
            }, delay);
        });
    }

    function handlePlayData() {
        const minTolerance = parseFloat(document.getElementById('min-tolerance').value);
        const maxTolerance = parseFloat(document.getElementById('max-tolerance').value);

        const delayInterval = 3000; // 3 seconds delay
        let delay = 0;
        const promises = [];

        // Add initialization message
        promises.push(sendIrcMessage('Initializing data flow from GIRI', delay));
        delay += delayInterval; // Increment delay for the next message

        workingCSV.forEach(row => {
            const semiMaj = (Math.random() * (maxTolerance - minTolerance) + minTolerance).toFixed(2);
            const semiMin = (Math.random() * 0.75 * semiMaj).toFixed(2);
            const orientation = Math.floor(Math.random() * 180) + 1;
            const [lat, lon] = row.location.split(',').map(Number);
            const message = `${row.systemType} // ${row.systemName} // ${row.emitterName} // ${row.elnot} // ${row.freq} // ${semiMin} // ${semiMaj} // ${orientation} // ${lat.toFixed(6)},${lon.toFixed(6)}`;

            promises.push(sendIrcMessage(message, delay)); // Send message with a delay
            delay += delayInterval; // Increment delay for the next message
        });

        // Add a promise to send the end message
        promises.push(sendIrcMessage('***END OF DATA***', delay));

        // Use Promise.all to ensure all messages are sent sequentially
        Promise.all(promises).then(() => {
            console.log('All messages sent, including end message.');
        });
    }

    // Remove existing event listener and add a new one
    document.getElementById('play-data').removeEventListener('click', handlePlayData);
    document.getElementById('play-data').addEventListener('click', handlePlayData);

    document.getElementById('generate-data').addEventListener('click', () => {
        const minTolerance = parseFloat(document.getElementById('min-tolerance').value);
        const maxTolerance = parseFloat(document.getElementById('max-tolerance').value);

        const headers = ['class', 'type', 'system', 'elnt', 'freq', 'min', 'maj', 'orient', 'lat', 'lon'];
        const finalCSV = workingCSV.map(row => {
            const semiMaj = (Math.random() * (maxTolerance - minTolerance) + minTolerance).toFixed(2);
            const semiMin = (Math.random() * 0.75 * semiMaj).toFixed(2);
            const orientation = Math.floor(Math.random() * 180) + 1;
            const [lat, lon] = row.location.split(',').map(Number);

            return [
                row.systemType, row.systemName, row.emitterName, row.elnot, row.freq,
                semiMaj, semiMin, orientation, lat.toFixed(6), lon.toFixed(6)
            ].join(',');
        });

        const csvContent = `${headers.join(',')}\n${finalCSV.join('\n')}`;
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'generated_data.csv';
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
    });

    document.getElementById('randomize').addEventListener('click', () => {
        workingCSV = workingCSV.sort(() => Math.random() - 0.5);
        updateCSVPreview();
        plotEmitters();
    });

    document.getElementById('cluster-selected').addEventListener('click', () => {
        const selectedRows = document.querySelectorAll('#working-csv-preview tr.selected');
        const indicesToCluster = Array.from(selectedRows).map(row => Array.from(row.parentElement.children).indexOf(row) - 1);
        const newEntries = [];

        indicesToCluster.forEach(index => {
            const row = workingCSV[index];
            const [lat, lon] = row.location.split(',').map(Number);
            const numCopies = Math.floor(Math.random() * 4) + 2; // Random number between 2 and 5

            for (let i = 0; i < numCopies; i++) {
                const newLocation = generateRandomLatLonNearby(lat, lon);
                const newEntry = { ...row, location: newLocation };
                newEntries.push(newEntry);
            }
        });

        workingCSV = workingCSV.concat(newEntries);
        updateCSVPreview();
        plotEmitters();
    });

    document.getElementById('delete-selected').addEventListener('click', () => {
        const selectedRows = document.querySelectorAll('#working-csv-preview tr.selected');
        const indicesToRemove = Array.from(selectedRows).map(row => Array.from(row.parentElement.children).indexOf(row) - 1);
        workingCSV = workingCSV.filter((_, index) => !indicesToRemove.includes(index));
        clearMapMarkers();
        updateCSVPreview();
        plotEmitters();
    });

    document.getElementById('clear-all').addEventListener('click', () => {
        workingCSV = [];
        clearMapMarkers();
        updateCSVPreview();
    });

    // Initialize the map when the placeholder is clicked
    const mapPlaceholder = document.getElementById('map-placeholder');
    const mapDiv = document.getElementById('map');

    mapPlaceholder.addEventListener('click', function() {
        mapPlaceholder.style.display = 'none';
        mapDiv.style.display = 'block';
        initializeMap();
    });

    // Add event listener for "Play Data" button
    document.getElementById('play-data').addEventListener('click', handlePlayData);
});
