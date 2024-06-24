let workingCSV = []; // Global workingCSV variable
let mapMarkers = {}; // Store map markers by their index
let map; // Global map variable

document.addEventListener('DOMContentLoaded', function() {
    const systemTypeSelect = document.getElementById('system-type-select');
    const systemNameSelect = document.getElementById('system-name-select');
    const emitterNameContainer = document.getElementById('emitter-name-container');
    const workingCSVPreview = document.getElementById('working-csv-preview');

    function createOption(value) {
        const option = document.createElement('option');
        option.value = value;
        option.text = value;
        return option;
    }

    // Populate the system type dropdown
    systemTypes.forEach(systemType => {
        systemTypeSelect.appendChild(createOption(systemType));
    });

    systemTypeSelect.addEventListener('change', () => {
        const systemType = systemTypeSelect.value;
        systemNameSelect.innerHTML = '<option value="">Select System</option>';
        emitterNameContainer.innerHTML = '';

        if (systemType) {
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

            const addToListButton = document.createElement('button');
            addToListButton.innerText = 'Add to List';
            addToListButton.className = 'blue-green';
            addToListButton.addEventListener('click', () => {
                const countInputs = document.querySelectorAll('[data-emitter-name]');
                countInputs.forEach(input => {
                    const count = parseInt(input.value);
                    if (count > 0) {
                        for (let i = 0; i < count; i++) {
                            const emitterName = input.getAttribute('data-emitter-name');
                            const emitterData = filteredEmitters.find(row => row.emitterName === emitterName);
                            const newEntry = {
                                systemType: emitterData.systemType,
                                systemName: emitterData.systemName,
                                emitterName: emitterName,
                                elnot: emitterData.elnot,
                                freq: emitterData.freq,
                                location: generateRandomLatLon()
                            };
                            workingCSV.push(newEntry);
                        }
                    }
                });
                updateCSVPreview();
                plotEmitters();
            });
            emitterNameContainer.appendChild(addToListButton);
        }
    });

    function generateRandomLatLon() {
        const baseLat = 51.505; // Base latitude near the given point
        const baseLon = -0.09; // Base longitude near the given point
        const randomLat = baseLat + (Math.random() - 0.5) * (500 / 111); // Random latitude within 500 miles
        const randomLon = baseLon + (Math.random() - 0.5) * (500 / (111 * Math.cos(baseLat * Math.PI / 180))); // Random longitude within 500 miles
        return `${randomLat.toFixed(6)}, ${randomLon.toFixed(6)}`;
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
            const [lat, lon] = row.location.split(", ").map(Number);

            // Create a custom icon with the emitter name
            const customIcon = L.divIcon({
                className: 'custom-div-icon',
                html: `<div class="custom-icon"><img src="./pictures/icon2.png" alt="icon"><span>${row.emitterName}</span></div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });

            const marker = L.marker([lat, lon], { draggable: true, icon: customIcon }).addTo(map);
            marker.on("dragend", function(e) {
                const latlng = e.target.getLatLng();
                const newLocation = `${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`;
                row.location = newLocation;
                updateLocationBox(newLocation, index);
            });
            mapMarkers[index] = marker;
        });
    }

    function initializeMap() {
        if (!map) {
            map = L.map('map').setView([51.505, -0.09], 2);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            }).addTo(map);

            // Right-click to copy coordinates
            map.on("contextmenu", function(e) {
                const latlng = e.latlng;
                const coord = `${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`;
                navigator.clipboard.writeText(coord).then(function() {
                    alert("Copied the coordinate: " + coord);
                }, function(err) {
                    console.error("Could not copy text: ", err);
                });
            });
        }
        plotEmitters();
    }

    document.getElementById('generate-data').addEventListener('click', () => {
        const minTolerance = parseFloat(document.getElementById('min-tolerance').value);
        const maxTolerance = parseFloat(document.getElementById('max-tolerance').value);

        const finalCSV = workingCSV.map(row => {
            const semiMaj = (Math.random() * (maxTolerance - minTolerance) + minTolerance).toFixed(2);
            const semiMin = (Math.random() * 0.75 * semiMaj).toFixed(2);
            const orientation = Math.floor(Math.random() * 180) + 1;
            return `${row.systemType} // ${row.systemName} // ${row.emitterName} // ${row.elnot} // ${row.freq} // ${semiMaj} // ${semiMin} // ${orientation} // ${row.location}`;
        });

        const blob = new Blob([finalCSV.join('\n')], { type: 'text/csv' });
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

    function updateLocationBox(newLocation, index) {
        const locationInput = document.querySelector(`#working-csv-preview tr:nth-child(${index + 2}) input.location-input`);
        if (locationInput) {
            locationInput.value = newLocation;
        }
    }

    // Initialize the map when the map container is clicked
    document.getElementById('map').addEventListener('click', initializeMap);
});
