/* WATER SPORTS CANOE CLUB STATISTICS - FRONTEND LOGIC */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Core State
    const state = {
        rawData: window.CSK_DATA || { clubs: [], global_totals: {} },
        filteredClubs: [],
        activeFilters: {
            searchQuery: '',
            yearStart: 2012,
            yearEnd: 2026,
            discipline: 'ALL', // 'ALL', 'SLALOM', 'SJEZD'
            onlyDomestic: true
        },
        sorting: {
            field: 'races', // 'name', 'races', 'competitors'
            order: 'desc'  // 'asc', 'desc'
        },
        charts: {
            trend: null,
            racesBar: null,
            competitorsBar: null
        },
        expandedClub: null // Name of current expanded club
    };

    // 2. Initialize UI Components
    initDropdowns();
    setupEventListeners();
    updateDashboard();

    // --- INITIALIZATION ---
    function initDropdowns() {
        const startSelect = document.getElementById('yearStart');
        const endSelect = document.getElementById('yearEnd');

        // Available years range
        const minYear = 2012;
        const maxYear = 2026;

        startSelect.innerHTML = '';
        endSelect.innerHTML = '';

        for (let y = minYear; y <= maxYear; y++) {
            const optStart = document.createElement('option');
            optStart.value = y;
            optStart.textContent = y;
            startSelect.appendChild(optStart);

            const optEnd = document.createElement('option');
            optEnd.value = y;
            optEnd.textContent = y;
            endSelect.appendChild(optEnd);
        }

        // Set defaults
        startSelect.value = minYear;
        endSelect.value = maxYear;
        
        state.activeFilters.yearStart = minYear;
        state.activeFilters.yearEnd = maxYear;
    }

    // --- EVENT LISTENERS ---
    function setupEventListeners() {
        // Club Search (with debounce)
        const searchInput = document.getElementById('clubSearch');
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                state.activeFilters.searchQuery = e.target.value.trim().toLowerCase();
                updateDashboard();
            }, 150);
        });

        // Year selectors
        document.getElementById('yearStart').addEventListener('change', (e) => {
            const val = parseInt(e.target.value, 10);
            state.activeFilters.yearStart = val;
            
            // Validation: start must be <= end
            const endSelect = document.getElementById('yearEnd');
            if (val > parseInt(endSelect.value, 10)) {
                endSelect.value = val;
                state.activeFilters.yearEnd = val;
            }
            updateDashboard();
        });

        document.getElementById('yearEnd').addEventListener('change', (e) => {
            const val = parseInt(e.target.value, 10);
            state.activeFilters.yearEnd = val;

            // Validation: end must be >= start
            const startSelect = document.getElementById('yearStart');
            if (val < parseInt(startSelect.value, 10)) {
                startSelect.value = val;
                state.activeFilters.yearStart = val;
            }
            updateDashboard();
        });

        // Discipline toggles
        const disciplineButtons = document.querySelectorAll('.btn-toggle');
        disciplineButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                disciplineButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                state.activeFilters.discipline = btn.getAttribute('data-discipline');
                updateDashboard();
            });
        });

        // Domestic Only checkbox listener
        document.getElementById('onlyDomestic').addEventListener('change', (e) => {
            state.activeFilters.onlyDomestic = e.target.checked;
            updateDashboard();
        });

        // Table headers sorting
        const headers = document.querySelectorAll('.th-sort');
        headers.forEach(header => {
            header.addEventListener('click', () => {
                const field = header.getAttribute('data-sort');
                
                if (state.sorting.field === field) {
                    state.sorting.order = state.sorting.order === 'asc' ? 'desc' : 'asc';
                } else {
                    state.sorting.field = field;
                    state.sorting.order = 'desc'; // Default to desc for numeric, can change for name
                    if (field === 'name') state.sorting.order = 'asc';
                }

                // Update class indicators
                headers.forEach(h => {
                    h.classList.remove('sort-asc', 'sort-desc');
                });
                header.classList.add(state.sorting.order === 'asc' ? 'sort-asc' : 'sort-desc');

                renderTable();
            });
        });
    }

    // --- DATA PROCESSING CORE ---
    function updateDashboard() {
        processAndFilterData();
        renderKPIs();
        renderCharts();
        renderTable();
    }

    function processAndFilterData() {
        const { searchQuery, yearStart, yearEnd, discipline, onlyDomestic } = state.activeFilters;
        
        // Loop through raw clubs and recalculate statistical metrics based on filtered races
        const processed = [];

        state.rawData.clubs.forEach(rawClub => {
            // Exclude unassigned/international "Neznámý oddíl" if "Jen domácí" is checked
            if (onlyDomestic && rawClub.name === "Neznámý oddíl") {
                return;
            }

            // Check if club name matches search
            if (searchQuery && !rawClub.name.toLowerCase().includes(searchQuery)) {
                return;
            }

            // Filter individual races
            const filteredRaces = rawClub.races.filter(race => {
                // Year check
                if (race.year < yearStart || race.year > yearEnd) {
                    return false;
                }

                // Discipline check
                if (discipline === 'SLALOM') {
                    return race.discipline === 'SLALOM' || race.discipline === 'KROS';
                } else if (discipline === 'SJEZD') {
                    return race.discipline === 'SJEZD';
                }

                return true; // 'ALL'
            });

            // If no races match filters, omit this club from the results
            if (filteredRaces.length === 0) {
                return;
            }

            // Recalculate filtered stats
            const stats = {
                all_races: filteredRaces.length,
                all_competitors: 0,
                slalom_races: 0,
                slalom_competitors: 0,
                sjezd_races: 0,
                sjezd_competitors: 0,
                kros_races: 0,
                kros_competitors: 0
            };

            filteredRaces.forEach(r => {
                stats.all_competitors += r.competitors;
                if (r.discipline === 'SLALOM') {
                    stats.slalom_races += 1;
                    stats.slalom_competitors += r.competitors;
                } else if (r.discipline === 'SJEZD') {
                    stats.sjezd_races += 1;
                    stats.sjezd_competitors += r.competitors;
                } else if (r.discipline === 'KROS') {
                    stats.kros_races += 1;
                    stats.kros_competitors += r.competitors;
                }
            });

            processed.push({
                name: rawClub.name,
                races: filteredRaces,
                totals: stats
            });
        });

        state.filteredClubs = processed;
    }

    // --- KPI RENDERING ---
    function renderKPIs() {
        let totalRaces = 0;
        let totalCompetitors = 0;
        let topClub = { name: 'Žádný', count: 0 };

        state.filteredClubs.forEach(club => {
            totalRaces += club.totals.all_races;
            totalCompetitors += club.totals.all_competitors;

            if (club.totals.all_races > topClub.count) {
                topClub.name = club.name;
                topClub.count = club.totals.all_races;
            }
        });

        const avgParticipation = totalRaces > 0 ? (totalCompetitors / totalRaces).toFixed(1) : '0.0';

        // Render to DOM
        document.getElementById('kpiRacesCount').textContent = formatNumber(totalRaces);
        document.getElementById('kpiCompetitorsCount').textContent = formatNumber(totalCompetitors);
        
        const topClubEl = document.getElementById('kpiTopClubName');
        topClubEl.textContent = topClub.name;
        topClubEl.title = topClub.name; // Tooltip for clipped text
        document.getElementById('kpiTopClubDesc').textContent = `pořádal ${formatNumber(topClub.count)} akcí`;

        document.getElementById('kpiAvgParticipation').textContent = avgParticipation;
    }

    // --- CHARTS RENDERING (Chart.js) ---
    function renderCharts() {
        renderTrendChart();
        renderRacesBarChart();
        renderCompetitorsBarChart();
    }

    function renderTrendChart() {
        if (state.charts.trend) {
            state.charts.trend.destroy();
        }

        const { yearStart, yearEnd, discipline } = state.activeFilters;
        
        // Prepare year range labels
        const labels = [];
        const racesTrend = [];
        const competitorsTrend = [];

        for (let y = yearStart; y <= yearEnd; y++) {
            labels.push(y.toString());
            
            // Calculate sum for this year across filtered clubs
            let yrRaces = 0;
            let yrComps = 0;

            state.filteredClubs.forEach(club => {
                club.races.forEach(r => {
                    if (r.year === y) {
                        yrRaces++;
                        yrComps += r.competitors;
                    }
                });
            });

            racesTrend.push(yrRaces);
            competitorsTrend.push(yrComps);
        }

        const ctx = document.getElementById('trendChart').getContext('2d');
        
        // Define beautiful gradients
        const gradientComps = ctx.createLinearGradient(0, 0, 0, 300);
        gradientComps.addColorStop(0, 'rgba(0, 210, 255, 0.4)');
        gradientComps.addColorStop(1, 'rgba(0, 210, 255, 0.02)');

        state.charts.trend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Počet startů (průtok)',
                        data: competitorsTrend,
                        borderColor: '#00d2ff',
                        borderWidth: 3,
                        pointBackgroundColor: '#00d2ff',
                        pointHoverRadius: 7,
                        backgroundColor: gradientComps,
                        fill: true,
                        yAxisID: 'yCompetitors',
                        tension: 0.3
                    },
                    {
                        label: 'Počet závodů',
                        data: racesTrend,
                        borderColor: '#00f2fe',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        pointBackgroundColor: '#00f2fe',
                        yAxisID: 'yRaces',
                        tension: 0.2,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#e2e8f0',
                            font: { family: 'Inter', size: 12 }
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8' }
                    },
                    yCompetitors: {
                        type: 'linear',
                        position: 'left',
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8' },
                        title: { display: true, text: 'Účast (celkový průtok lodí)', color: '#94a3b8' }
                    },
                    yRaces: {
                        type: 'linear',
                        position: 'right',
                        grid: { drawOnChartArea: false }, // Only draw grid for left axis
                        ticks: { color: '#94a3b8' },
                        title: { display: true, text: 'Počet akcí', color: '#94a3b8' }
                    }
                }
            }
        });
    }

    function renderRacesBarChart() {
        if (state.charts.racesBar) {
            state.charts.racesBar.destroy();
        }

        // Sort top 10 clubs by races
        const sorted = [...state.filteredClubs]
            .sort((a, b) => b.totals.all_races - a.totals.all_races)
            .slice(0, 10);

        const labels = sorted.map(c => c.name);
        const data = sorted.map(c => c.totals.all_races);

        const ctx = document.getElementById('racesBarChart').getContext('2d');
        
        state.charts.racesBar = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels.map(l => l.length > 25 ? l.substring(0, 22) + '...' : l),
                datasets: [{
                    label: 'Počet akcí',
                    data: data,
                    backgroundColor: 'rgba(0, 242, 254, 0.85)',
                    hoverBackgroundColor: '#00f2fe',
                    borderRadius: 6,
                    borderWidth: 0
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8' }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { color: '#e2e8f0', font: { family: 'Inter', size: 11 } }
                    }
                }
            }
        });
    }

    function renderCompetitorsBarChart() {
        if (state.charts.competitorsBar) {
            state.charts.competitorsBar.destroy();
        }

        // Sort top 10 clubs by competitors
        const sorted = [...state.filteredClubs]
            .sort((a, b) => b.totals.all_competitors - a.totals.all_competitors)
            .slice(0, 10);

        const labels = sorted.map(c => c.name);
        const data = sorted.map(c => c.totals.all_competitors);

        const ctx = document.getElementById('competitorsBarChart').getContext('2d');

        state.charts.competitorsBar = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels.map(l => l.length > 25 ? l.substring(0, 22) + '...' : l),
                datasets: [{
                    label: 'Průtok (startů)',
                    data: data,
                    backgroundColor: 'rgba(255, 83, 118, 0.85)',
                    hoverBackgroundColor: '#ff5376',
                    borderRadius: 6,
                    borderWidth: 0
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8' }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { color: '#e2e8f0', font: { family: 'Inter', size: 11 } }
                    }
                }
            }
        });
    }

    // --- DATA TABLE RENDERING ---
    function renderTable() {
        const body = document.getElementById('clubsTableBody');
        const recordsCount = document.getElementById('tableRecordsCount');
        
        body.innerHTML = '';

        // Sort filtered clubs
        const { field, order } = state.sorting;
        const sortedClubs = [...state.filteredClubs].sort((a, b) => {
            let valA, valB;

            if (field === 'name') {
                valA = a.name;
                valB = b.name;
                return order === 'asc' ? valA.localeCompare(valB, 'cs') : valB.localeCompare(valA, 'cs');
            } else if (field === 'races') {
                valA = a.totals.all_races;
                valB = b.totals.all_races;
            } else if (field === 'competitors') {
                valA = a.totals.all_competitors;
                valB = b.totals.all_competitors;
            }

            return order === 'asc' ? valA - valB : valB - valA;
        });

        recordsCount.textContent = `Zobrazeno ${sortedClubs.length} oddílů`;

        if (sortedClubs.length === 0) {
            body.innerHTML = `<tr><td colspan="7" class="text-center" style="padding: 40px; color: var(--text-muted);">Žádné oddíly neodpovídají nastaveným filtrům.</td></tr>`;
            return;
        }

        sortedClubs.forEach((club, index) => {
            const isExpanded = state.expandedClub === club.name;
            const clubRowId = `club-row-${index}`;
            const detailRowId = `detail-row-${index}`;
            
            // Generate initials for avatar
            const initials = club.name
                .replace(/^(TJ|SK|KK|SKK|KVS|VK)\s+/i, '')
                .substring(0, 2)
                .toUpperCase();

            const avgParticipation = club.totals.all_races > 0 ? (club.totals.all_competitors / club.totals.all_races).toFixed(1) : '0.0';

            // Main Row
            const tr = document.createElement('tr');
            tr.id = clubRowId;
            tr.className = `club-row ${isExpanded ? 'active' : ''}`;
            tr.innerHTML = `
                <td>
                    <div class="club-name-cell">
                        <div class="club-avatar">${initials}</div>
                        <span>${club.name}</span>
                    </div>
                </td>
                <td class="text-center font-heading" style="font-weight:700; font-size:15px;">${club.totals.all_races}</td>
                <td class="text-center">
                    <span class="badge-sub badge-slalom">${club.totals.slalom_races} sl</span>
                    <span class="badge-sub" style="color:var(--text-muted); padding: 0 4px;">/</span>
                    <span class="badge-sub badge-sjezd">${club.totals.sjezd_races} sj</span>
                    ${club.totals.kros_races > 0 ? `<span class="badge-sub" style="color:var(--text-muted); padding: 0 4px;">/</span><span class="badge-sub badge-kros">${club.totals.kros_races} kr</span>` : ''}
                </td>
                <td class="text-center font-heading" style="font-weight:700; font-size:15px; color:var(--accent-blue);">${formatNumber(club.totals.all_competitors)}</td>
                <td class="text-center">
                    <span class="badge-sub badge-slalom">${formatNumber(club.totals.slalom_competitors)} sl</span>
                    <span class="badge-sub" style="color:var(--text-muted); padding: 0 4px;">/</span>
                    <span class="badge-sub badge-sjezd">${formatNumber(club.totals.sjezd_competitors)} sj</span>
                    ${club.totals.kros_competitors > 0 ? `<span class="badge-sub" style="color:var(--text-muted); padding: 0 4px;">/</span><span class="badge-sub badge-kros">${formatNumber(club.totals.kros_competitors)} kr</span>` : ''}
                </td>
                <td class="text-center font-heading" style="color:var(--accent-purple); font-weight:600;">${avgParticipation}</td>
                <td class="text-center">
                    <button class="detail-btn" aria-label="Zobrazit detaily závodů" aria-expanded="${isExpanded}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </button>
                </td>
            `;

            // Toggle Expand Click
            const toggleHandler = () => {
                if (state.expandedClub === club.name) {
                    state.expandedClub = null;
                    document.getElementById(clubRowId).classList.remove('active');
                    document.getElementById(detailRowId).style.display = 'none';
                    const wrapper = document.getElementById(`wrapper-${index}`);
                    wrapper.style.maxHeight = '0px';
                } else {
                    // Collapse existing
                    if (state.expandedClub) {
                        const prevIdx = sortedClubs.findIndex(c => c.name === state.expandedClub);
                        if (prevIdx !== -1) {
                            const prevRow = document.getElementById(`club-row-${prevIdx}`);
                            if (prevRow) prevRow.classList.remove('active');
                            const prevDetail = document.getElementById(`detail-row-${prevIdx}`);
                            if (prevDetail) prevDetail.style.display = 'none';
                            const prevWrapper = document.getElementById(`wrapper-${prevIdx}`);
                            if (prevWrapper) prevWrapper.style.maxHeight = '0px';
                        }
                    }

                    // Expand this one
                    state.expandedClub = club.name;
                    document.getElementById(clubRowId).classList.add('active');
                    const detailRow = document.getElementById(detailRowId);
                    detailRow.style.display = 'table-row';
                    
                    // Trigger CSS transition
                    setTimeout(() => {
                        const wrapper = document.getElementById(`wrapper-${index}`);
                        wrapper.style.maxHeight = '500px';
                    }, 10);
                }
            };

            tr.addEventListener('click', (e) => {
                // Ignore if clicked on a link or button directly, but handle everything else
                if (e.target.closest('button')) return;
                toggleHandler();
            });
            tr.querySelector('.detail-btn').addEventListener('click', toggleHandler);

            body.appendChild(tr);

            // Collapsible Detail Row
            const detailTr = document.createElement('tr');
            detailTr.id = detailRowId;
            detailTr.className = 'detail-row';
            detailTr.style.display = isExpanded ? 'table-row' : 'none';
            detailTr.innerHTML = `
                <td colspan="7">
                    <div class="detail-wrapper" id="wrapper-${index}" style="max-height: ${isExpanded ? '500px' : '0px'}">
                        <div class="detail-content">
                            <div class="detail-header-actions">
                                <h4 class="detail-title">Historie pořádaných akcí (${club.races.length} závodů)</h4>
                                <input type="text" id="detail-search-${index}" class="detail-search" placeholder="Hledat v závodech oddílu...">
                            </div>
                            <div class="races-list-container">
                                <table class="races-grid-table">
                                    <thead>
                                        <tr>
                                            <th style="width: 100px;">Rok / Datum</th>
                                            <th>Název závodu</th>
                                            <th style="width: 120px;">Disciplína</th>
                                            <th style="width: 150px; text-align: center;">Počet závodníků v cíli</th>
                                        </tr>
                                    </thead>
                                    <tbody id="races-grid-body-${index}">
                                        <!-- Races list populated dynamically -->
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </td>
            `;
            body.appendChild(detailTr);

            // Populate races grid inside detail row
            renderRacesList(club.races, index, '');

            // Inner Search Logic
            setTimeout(() => {
                const innerSearch = document.getElementById(`detail-search-${index}`);
                if (innerSearch) {
                    innerSearch.addEventListener('input', (e) => {
                        const q = e.target.value.toLowerCase().trim();
                        renderRacesList(club.races, index, q);
                    });
                }
            }, 50);
        });
    }

    function renderRacesList(races, index, query) {
        const tbody = document.getElementById(`races-grid-body-${index}`);
        if (!tbody) return;
        
        tbody.innerHTML = '';

        const filtered = races.filter(r => {
            return !query || r.name.toLowerCase().includes(query) || r.date.includes(query) || r.discipline.toLowerCase().includes(query);
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="no-races-row">Žádné závody neodpovídají hledání.</td></tr>`;
            return;
        }

        filtered.forEach(r => {
            let discClass = 'pill-slalom';
            let discLabel = 'Slalom';
            
            if (r.discipline === 'SJEZD') {
                discClass = 'pill-sjezd';
                discLabel = 'Sjezd';
            } else if (r.discipline === 'KROS') {
                discClass = 'pill-kros';
                discLabel = 'Kros';
            }

            const rTr = document.createElement('tr');
            rTr.innerHTML = `
                <td style="color:var(--text-secondary); font-weight: 500;">
                    <div style="font-size: 11px; color:var(--text-muted);">${r.year}</div>
                    <div>${r.date}</div>
                </td>
                <td style="font-weight:600; color:#fff;">${r.name}</td>
                <td><span class="badge-pill ${discClass}">${discLabel}</span></td>
                <td style="text-align: center; font-weight: 700; font-size: 13px; color:var(--accent-teal);">${formatNumber(r.competitors)}</td>
            `;
            tbody.appendChild(rTr);
        });
    }

    // --- HELPER UTILITIES ---
    function formatNumber(num) {
        // Formats number to Czech thousand separator standard (e.g. 1 250)
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    }
});
