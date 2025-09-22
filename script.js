/*
    LeadFlow CRM - Single File Application Logic
    Handles all data, routing, rendering, and business logic.
*/

document.addEventListener('DOMContentLoaded', () => {
    // --- DATA KEYS & UTILITIES ---
    const KEYS = {
        USERS: 'crm_users_v3',
        CAMPAIGNS: 'crm_campaigns_v3',
        LEADS: 'crm_leads_v3',
        FUNDRAISERS: 'crm_fundraisers_v3',
        PAYMENTS: 'crm_payments_v3',
        CURRENT_USER: 'crm_current_user_v3'
    };

    const AppState = {
        currentUser: null,
        currentPage: 'dashboard',
        // Pagination, search, sort state
        tableState: {
            leads: { page: 1, perPage: 10, search: '', sortBy: 'createdAt', sortOrder: 'desc' },
            fundraisers: { page: 1, perPage: 10, search: '', sortBy: 'createdAt', sortOrder: 'desc' },
            payments: { page: 1, perPage: 10, search: '', sortBy: 'date', sortOrder: 'desc' },
            calls: { page: 1, perPage: 10, search: '', sortBy: 'when', sortOrder: 'desc' },
            users: { page: 1, perPage: 10, search: '', sortBy: 'name', sortOrder: 'asc' },
            campaigns: { page: 1, perPage: 10, search: '', sortBy: 'organisation', sortOrder: 'asc' }
        },
        currentLeadFilter: 'all' // For admin lead filtering
    };

    // --- Core Data Functions ---
    const load = key => JSON.parse(localStorage.getItem(key) || '[]');
    const save = (key, data) => localStorage.setItem(key, JSON.stringify(data));
    const uid = prefix => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
    const nowISO = () => new Date().toISOString();
    const formatCurrency = amount => `₹${Number(amount || 0).toLocaleString('en-IN')}`;
    const formatDate = isoString => isoString ? new Date(isoString).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A';
    
    // --- INITIALIZATION ---
    function init() {
        const loginForm = document.getElementById('login-form');
        loginForm.addEventListener('submit', handleLoginSubmit);

        document.getElementById('logout-btn').addEventListener('click', logout);
        
        // Modal listeners
        document.querySelector('.close-modal').addEventListener('click', closeModal);
        document.getElementById('csv-modal').addEventListener('click', (e) => e.target === document.getElementById('csv-modal') && closeModal());
        document.getElementById('csv-upload-area').addEventListener('click', () => document.getElementById('csv-file-input').click());
        document.getElementById('csv-file-input').addEventListener('change', handleFileSelect);

        checkAuth();
    }

    // --- AUTHENTICATION ---
    function checkAuth() {
        const user = JSON.parse(localStorage.getItem(KEYS.CURRENT_USER));
        const users = load(KEYS.USERS);

        if (users.length === 0) {
            setupFirstAdmin();
        } else if (user && users.find(u => u.id === user.id)) { // Verify user still exists
            AppState.currentUser = user;
            showApp();
        } else {
            logout(); // Clear invalid user session
            showLogin();
        }
    }

    function setupFirstAdmin() {
        document.getElementById('login-title').textContent = 'Create Super Admin Account';
        document.getElementById('login-button').textContent = 'Create Admin';
        document.getElementById('name-group').style.display = 'block';
    }
    
    function handleLoginSubmit(e) {
        e.preventDefault();
        const users = load(KEYS.USERS);
        const email = e.target.email.value.trim().toLowerCase();
        const password = e.target.password.value;
        const name = e.target.name.value.trim();

        if (users.length === 0) {
            // Creating first admin
            if (!name || !email || !password) {
                alert('Please fill all fields to create the admin account.');
                return;
            }
            const admin = { id: uid('user'), name, email, password, role: 'admin' };
            save(KEYS.USERS, [admin]);
            login(admin);
        } else {
            // Normal login
            const user = users.find(u => u.email === email && u.password === password);
            if (user) {
                login(user);
            } else {
                alert('Invalid email or password.');
            }
        }
    }

    function login(user) {
        AppState.currentUser = user;
        localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(user));
        showApp();
    }
    
    function logout() {
        AppState.currentUser = null;
        localStorage.removeItem(KEYS.CURRENT_USER);
        window.location.hash = '';
        showLogin();
    }
    
    function showLogin() {
        document.getElementById('login-view').style.display = 'block';
        document.getElementById('app-container').style.display = 'none';
        document.getElementById('login-form').reset();
        document.getElementById('name-group').style.display = 'none';
        if(load(KEYS.USERS).length > 0) {
            document.getElementById('login-title').textContent = 'Login to your account';
            document.getElementById('login-button').textContent = 'Login';
        }
    }

    function showApp() {
        document.getElementById('login-view').style.display = 'none';
        document.getElementById('app-container').style.display = 'block';
        document.getElementById('user-email').textContent = AppState.currentUser.email;
        document.getElementById('user-role').textContent = AppState.currentUser.role;
        setupRouting();
        renderNavbar();
        handleHashChange();
    }
    
    // --- ROUTING ---
    function setupRouting() {
        window.addEventListener('hashchange', handleHashChange);
    }
    
    function navigate(page, params = {}) {
        const query = new URLSearchParams(params).toString();
        window.location.hash = query ? `${page}?${query}` : page;
    }

    function handleHashChange() {
        const hash = window.location.hash.substring(1);
        const [page, query] = hash.split('?');
        AppState.currentPage = page || 'dashboard';
        const params = new URLSearchParams(query);
        renderPage(AppState.currentPage, params);
        updateActiveNav();
    }
    
    function renderPage(page, params) {
        const main = document.getElementById('main-content');
        main.innerHTML = ''; // Clear previous content
        // Reset table states when navigating away from a list view
        Object.keys(AppState.tableState).forEach(key => {
            AppState.tableState[key].page = 1;
            AppState.tableState[key].search = '';
        });

        switch (page) {
            case 'dashboard': renderDashboard(); break;
            case 'leads': renderLeadsList(); break;
            case 'lead_detail': renderLeadDetail(params.get('id')); break;
            case 'add_lead': renderAddLeadForm(); break;
            case 'fundraisers': renderFundraisersList(); break;
            case 'fundraiser_create': renderFundraiserForm(params.get('leadId'), params.get('fundId')); break;
            case 'payments': renderPaymentsList(); break;
            case 'calls': renderCallsList(); break;
            case 'admin': renderAdminPanel(); break;
            default: renderDashboard();
        }
    }
    
    function renderNavbar() {
        const nav = document.getElementById('navbar');
        const isAdmin = AppState.currentUser.role === 'admin';
        const navItems = [
            { name: 'Dashboard', page: 'dashboard' },
            { name: 'Leads', page: 'leads' },
            { name: 'Fundraisers', page: 'fundraisers' },
            { name: 'Payments', page: 'payments' },
            { name: 'Calls', page: 'calls' },
            { name: 'Admin', page: 'admin', adminOnly: true }
        ];

        nav.innerHTML = navItems
            .filter(item => !item.adminOnly || isAdmin)
            .map(item => `<a href="#${item.page}" class="nav-link" data-page="${item.page}">${item.name}</a>`)
            .join('');
    }

    function updateActiveNav() {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.page === AppState.currentPage);
        });
    }

    // --- DATA GETTERS & HELPERS ---
    const isUserAdmin = () => AppState.currentUser?.role === 'admin';

    function getVisibleData(key, filterByUser = true) {
        let data = load(key);
        if (isUserAdmin() || !filterByUser) {
            return data;
        }
        const userEmail = AppState.currentUser.email;
        switch (key) {
            case KEYS.LEADS:
            case KEYS.FUNDRAISERS:
                return data.filter(item => item.owner === userEmail);
            case KEYS.CALLS:
                 return data.filter(item => item.by === userEmail);
            case KEYS.PAYMENTS:
                const userFundraisers = getVisibleData(KEYS.FUNDRAISERS, true).map(f => f.id);
                return data.filter(p => userFundraisers.includes(p.fundId) || p.recordedBy === userEmail);
            default:
                return data;
        }
    }
    
    function applyTableState(data, key) {
        const state = AppState.tableState[key];
        
        // Search
        if (state.search) {
            const searchTerm = state.search.toLowerCase();
            data = data.filter(item => 
                Object.values(item).some(val => 
                    String(val).toLowerCase().includes(searchTerm)
                )
            );
        }

        // Sort
        data.sort((a, b) => {
            let valA = a[state.sortBy];
            let valB = b[state.sortBy];

            // Handle nested properties for sorting (e.g., fundraiser.title)
            if (state.sortBy.includes('.')) {
                const keys = state.sortBy.split('.');
                valA = a[keys[0]] ? a[keys[0]][keys[1]] : null;
                valB = b[keys[0]] ? b[keys[0]][keys[1]] : null;
            }
            
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();
            
            if (valA === null || valA === undefined) return 1;
            if (valB === null || valB === undefined) return -1;

            if (valA < valB) return state.sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return state.sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        return data;
    }

    function renderSortableHeader(label, sortKey, tableKey) {
        const state = AppState.tableState[tableKey];
        const isCurrentSort = state.sortBy === sortKey;
        const icon = isCurrentSort ? (state.sortOrder === 'asc' ? '▲' : '▼') : '';
        return `<th class="sortable" onclick="setSort('${tableKey}', '${sortKey}')">${label} ${icon}</th>`;
    }

    window.setSort = (tableKey, sortKey) => {
        const state = AppState.tableState[tableKey];
        if (state.sortBy === sortKey) {
            state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
            state.sortBy = sortKey;
            state.sortOrder = 'desc'; // Default to descending for new columns
        }
        handleHashChange(); // Re-render the current page to apply sort
    };
    
    // --- RENDER FUNCTIONS ---
    function renderDashboard() {
        const main = document.getElementById('main-content');
        const leads = load(KEYS.LEADS);
        const fundraisers = load(KEYS.FUNDRAISERS);
        const payments = load(KEYS.PAYMENTS);
        const users = load(KEYS.USERS);
        
        // 1. Top 5 Executives (this week)
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const recentPayments = payments.filter(p => new Date(p.date) >= oneWeekAgo);

        const execScores = users.filter(u => u.role === 'executive').map(exec => {
            const execFundraisers = fundraisers.filter(f => f.owner === exec.email).map(f => f.id);
            const totalCollected = recentPayments
                .filter(p => execFundraisers.includes(p.fundId))
                .reduce((sum, p) => sum + p.amount, 0);
            return { name: exec.name, total: totalCollected };
        });
        const topExecutives = execScores.sort((a, b) => b.total - a.total).slice(0, 5);

        // 2. 5 Recent Fundraisers
        const recentFundraisers = fundraisers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
        
        // 3. Top 5 Fundraisers (all time)
        const topFundraisers = fundraisers.sort((a, b) => b.collected - a.collected).slice(0, 5);

        // 4. 15 Recent Payments
        const recentPaymentsList = payments.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 15);
        
        const campaigns = load(KEYS.CAMPAIGNS);
        const getCampaignName = (fundraiser) => {
            const lead = leads.find(l => l.id === fundraiser.leadId);
            const campaign = campaigns.find(c => c.id === lead?.campaignId);
            return campaign ? `${campaign.organisation} / ${campaign.product}` : 'N/A';
        };

        main.innerHTML = `
            <div class="page-header"><h1>Dashboard</h1></div>
            <div class="dashboard-grid">
                <div class="dashboard-card">
                    <h3>🏆 Top Executives (This Week)</h3>
                    <div id="top-execs-list">
                        ${topExecutives.map(e => `
                            <div class="list-item">
                                <div class="list-item-main"><div class="name">${e.name}</div></div>
                                <div class="list-item-value">${formatCurrency(e.total)}</div>
                            </div>
                        `).join('') || '<p class="muted">No activity this week.</p>'}
                    </div>
                </div>
                <div class="dashboard-card">
                    <h3>✨ Recent Fundraisers</h3>
                     <div id="recent-funds-list">
                        ${recentFundraisers.map(f => `
                            <div class="list-item">
                                <div class="list-item-main">
                                    <div class="name">${f.title}</div>
                                    <div class="detail">${f.owner} &middot; ${getCampaignName(f)}</div>
                                </div>
                                <div class="list-item-value secondary">${formatCurrency(f.collected)}</div>
                            </div>
                        `).join('') || '<p class="muted">No fundraisers created yet.</p>'}
                    </div>
                </div>
                <div class="dashboard-card">
                    <h3>🚀 Top Fundraisers (All Time)</h3>
                    <div id="top-funds-list">
                       ${topFundraisers.map(f => `
                            <div class="list-item">
                                <div class="list-item-main">
                                    <div class="name">${f.title}</div>
                                    <div class="detail">${f.owner}</div>
                                </div>
                                <div class="list-item-value">${formatCurrency(f.collected)}</div>
                            </div>
                        `).join('') || '<p class="muted">No fundraisers available.</p>'}
                    </div>
                </div>
                <div class="dashboard-card">
                    <h3>💰 Recent Payments</h3>
                    <div id="recent-payments-list">
                        ${recentPaymentsList.map(p => {
                            const fundraiser = fundraisers.find(f => f.id === p.fundId);
                            const lead = leads.find(l => l.id === fundraiser?.leadId);
                            const campaign = campaigns.find(c => c.id === lead?.campaignId);
                            return `
                                <div class="list-item">
                                    <div class="list-item-main">
                                        <div class="name">${formatCurrency(p.amount)} from ${p.donor}</div>
                                        <div class="detail">${campaign?.product || 'N/A'} &middot; by ${p.recordedBy}</div>
                                    </div>
                                </div>
                            `;
                        }).join('') || '<p class="muted">No payments recorded yet.</p>'}
                    </div>
                </div>
            </div>
        `;
    }
    
    // ... (The rest of the JS code for other pages, CSV handling, etc. will go here)
    // This is a large file, so I will continue with the rest of the functions.
    // Make sure to copy the entire content of this box.
    
    function renderLeadsList() {
        const main = document.getElementById('main-content');
        
        let headerHTML = `
            <div class="page-header">
                <h1>Leads</h1>
                <button class="btn" id="add-lead-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    Add Lead
                </button>
            </div>
        `;

        let controlsHTML = `
            <div class="controls">
                <div class="search-box">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <input type="text" id="search-input" placeholder="Search leads..." value="${AppState.tableState.leads.search}">
                </div>
        `;
        
        if (isUserAdmin()) {
            const users = load(KEYS.USERS);
            controlsHTML += `
                <select id="exec-filter">
                    <option value="all">All Executives</option>
                    ${users.filter(u=>u.role==='executive').map(u => `<option value="${u.email}" ${AppState.currentLeadFilter === u.email ? 'selected' : ''}>${u.name}</option>`).join('')}
                </select>
                <button class="btn ghost" id="import-leads-btn">Import CSV</button>
                <button class="btn ghost" id="export-leads-btn">Export CSV</button>
            `;
        }
        controlsHTML += '</div>';

        main.innerHTML = headerHTML + controlsHTML + '<div id="table-container"></div>';

        document.getElementById('add-lead-btn').addEventListener('click', () => navigate('add_lead'));
        document.getElementById('search-input').addEventListener('input', (e) => {
            AppState.tableState.leads.search = e.target.value;
            renderLeadsTable();
        });

        if (isUserAdmin()) {
            document.getElementById('exec-filter').addEventListener('change', (e) => {
                AppState.currentLeadFilter = e.target.value;
                renderLeadsTable();
            });
            document.getElementById('import-leads-btn').addEventListener('click', () => openModal('leads'));
            document.getElementById('export-leads-btn').addEventListener('click', exportLeadsToCSV);
        }

        renderLeadsTable();
    }
    
    function renderLeadsTable() {
        const container = document.getElementById('table-container');
        if (!container) return;
        
        let leads = isUserAdmin() ? load(KEYS.LEADS) : getVisibleData(KEYS.LEADS);

        if (isUserAdmin() && AppState.currentLeadFilter !== 'all') {
            leads = leads.filter(l => l.owner === AppState.currentLeadFilter);
        }

        const campaigns = load(KEYS.CAMPAIGNS);
        const leadsWithDetails = leads.map(lead => ({
            ...lead,
            campaignName: campaigns.find(c => c.id === lead.campaignId)?.product || 'N/A'
        }));

        const processedData = applyTableState(leadsWithDetails, 'leads');
        const paginatedData = paginate(processedData, AppState.tableState.leads.page, AppState.tableState.leads.perPage);

        container.innerHTML = `
            <table>
                <thead>
                    <tr>
                        ${renderSortableHeader('Name', 'name', 'leads')}
                        ${renderSortableHeader('Phone', 'phone', 'leads')}
                        ${renderSortableHeader('Campaign', 'campaignName', 'leads')}
                        ${renderSortableHeader('Owner', 'owner', 'leads')}
                        ${renderSortableHeader('Created', 'createdAt', 'leads')}
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    ${paginatedData.map(l => `
                        <tr>
                            <td>${l.name}</td>
                            <td>${l.phone || '-'}</td>
                            <td>${l.campaignName}</td>
                            <td>${l.owner}</td>
                            <td>${formatDate(l.createdAt)}</td>
                            <td><a href="#lead_detail?id=${l.id}" class="btn small">View</a></td>
                        </tr>
                    `).join('') || '<tr><td colspan="6" style="text-align:center; padding: 20px;">No leads found.</td></tr>'}
                </tbody>
            </table>
            ${renderPagination(processedData.length, AppState.tableState.leads, 'leads')}
        `;
    }

    function renderPagination(totalItems, state, key) {
        const totalPages = Math.ceil(totalItems / state.perPage);
        if (totalPages <= 1) return '';

        let html = '<div class="pagination">';
        for (let i = 1; i <= totalPages; i++) {
            html += `<button class="btn ghost small ${i === state.page ? 'active' : ''}" onclick="changePage('${key}', ${i})">${i}</button>`;
        }
        html += '</div>';
        return html;
    }
    
    window.changePage = (key, page) => {
        AppState.tableState[key].page = page;
        handleHashChange();
    };

    function paginate(items, page, perPage) {
        return items.slice((page - 1) * perPage, page * perPage);
    }

    // --- CSV Functionality ---
    function openModal(type) {
        document.getElementById('csv-modal-title').textContent = `Import ${type.charAt(0).toUpperCase() + type.slice(1)}`;
        document.getElementById('csv-file-input').dataset.type = type;
        document.getElementById('csv-modal').style.display = 'flex';
    }

    function closeModal() {
        document.getElementById('csv-modal').style.display = 'none';
        document.getElementById('csv-file-input').value = '';
    }

    function handleFileSelect(event) {
        const file = event.target.files[0];
        const type = event.target.dataset.type;
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const text = e.target.result;
                if (type === 'leads') importLeadsFromCSV(text);
                if (type === 'payments') importPaymentsFromCSV(text);
            };
            reader.readAsText(file);
        }
    }
    
    function parseCSV(text) {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        const header = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const rows = lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
            let rowObject = {};
            header.forEach((col, index) => {
                rowObject[col] = values[index];
            });
            return rowObject;
        });
        return { header, rows };
    }

    function importLeadsFromCSV(csvText) {
        try {
            const { header, rows } = parseCSV(csvText);
            const requiredHeaders = ['name', 'phone', 'email', 'instagram', 'campaignId'];
            if (!requiredHeaders.every(h => header.includes(h))) {
                alert(`CSV must contain headers: ${requiredHeaders.join(', ')}`);
                return;
            }
            
            let leads = load(KEYS.LEADS);
            const campaigns = load(KEYS.CAMPAIGNS);
            let addedCount = 0;
            
            rows.forEach(row => {
                const campaign = campaigns.find(c => c.id === row.campaignId);
                if (!campaign) return; // Skip if campaign doesn't exist

                leads.push({
                    id: uid('lead'),
                    name: row.name,
                    phone: row.phone || '',
                    email: row.email || '',
                    instagram: row.instagram || '',
                    campaignId: row.campaignId,
                    owner: AppState.currentUser.email,
                    createdAt: nowISO(),
                    activities: []
                });
                addedCount++;
            });
            
            save(KEYS.LEADS, leads);
            alert(`${addedCount} leads imported successfully!`);
            closeModal();
            handleHashChange();
        } catch (error) {
            alert('Error parsing CSV file. Please check the format.');
            console.error(error);
        }
    }
    
    function importPaymentsFromCSV(csvText) {
        try {
            const { header, rows } = parseCSV(csvText);
            // Assuming Razorpay format with 'payment_page_id', 'payment_amount', 'customer_name', 'payment_date'
            const requiredHeaders = ['payment_page_id', 'payment_amount', 'customer_name', 'payment_date'];
             if (!requiredHeaders.every(h => header.includes(h))) {
                alert(`CSV must contain Razorpay headers: ${requiredHeaders.join(', ')}`);
                return;
            }
            
            let payments = load(KEYS.PAYMENTS);
            let fundraisers = load(KEYS.FUNDRAISERS);
            let addedCount = 0;
            
            rows.forEach(row => {
                const fundraiser = fundraisers.find(f => f.razorpayPageId === row.payment_page_id);
                if (!fundraiser) return; // Skip if no matching fundraiser

                payments.push({
                    id: uid('pay'),
                    fundId: fundraiser.id,
                    donor: row.customer_name || 'Anonymous',
                    amount: parseFloat(row.payment_amount) || 0,
                    date: new Date(row.payment_date).toISOString(),
                    method: 'Razorpay',
                    recordedBy: AppState.currentUser.email,
                    createdAt: nowISO()
                });

                // Update fundraiser collected amount
                const fundIndex = fundraisers.findIndex(f => f.id === fundraiser.id);
                if (fundIndex > -1) {
                    fundraisers[fundIndex].collected += parseFloat(row.payment_amount) || 0;
                }
                addedCount++;
            });
            
            save(KEYS.PAYMENTS, payments);
            save(KEYS.FUNDRAISERS, fundraisers);
            alert(`${addedCount} payments imported and fundraisers updated!`);
            closeModal();
            handleHashChange();
        } catch (error) {
            alert('Error parsing payments CSV file. Please ensure it is a valid Razorpay report.');
            console.error(error);
        }
    }
    
    function exportLeadsToCSV() {
        const leads = getVisibleData(KEYS.LEADS, false); // Export all for admin
        const headers = ['id', 'name', 'phone', 'email', 'instagram', 'campaignId', 'owner', 'createdAt'];
        let csvContent = headers.join(',') + '\n';
        
        leads.forEach(lead => {
            const row = headers.map(header => `"${(lead[header] || '').toString().replace(/"/g, '""')}"`).join(',');
            csvContent += row + '\n';
        });
        
        downloadCSV(csvContent, 'leads_export.csv');
    }

    function downloadCSV(content, fileName) {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", fileName);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }
    
    function renderAddLeadForm() {
        const main = document.getElementById('main-content');
        const campaigns = load(KEYS.CAMPAIGNS);
        main.innerHTML = `
            <div class="page-header"><h1>Add New Lead</h1></div>
            <div class="card">
                <form id="add-lead-form">
                    <div class="form-grid-2">
                        <div>
                            <label for="name">Lead Name</label>
                            <input type="text" id="name" required>
                        </div>
                        <div>
                            <label for="campaignId">Campaign</label>
                            <select id="campaignId" required>
                                <option value="">Select a campaign</option>
                                ${campaigns.map(c => `<option value="${c.id}">${c.organisation} / ${c.product}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label for="phone">Phone</label>
                            <input type="tel" id="phone">
                        </div>
                         <div>
                            <label for="email">Email</label>
                            <input type="email" id="email">
                        </div>
                        <div style="grid-column: 1 / -1;">
                            <label for="instagram">Instagram Handle</label>
                            <input type="text" id="instagram" placeholder="@username or full URL">
                        </div>
                    </div>
                    <div style="text-align: right; margin-top: 24px;">
                        <a href="#leads" class="btn ghost">Cancel</a>
                        <button type="submit" class="btn">Save Lead</button>
                    </div>
                </form>
            </div>
        `;
        document.getElementById('add-lead-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const leads = load(KEYS.LEADS);
            const newLead = {
                id: uid('lead'),
                name: document.getElementById('name').value,
                campaignId: document.getElementById('campaignId').value,
                phone: document.getElementById('phone').value,
                email: document.getElementById('email').value,
                instagram: document.getElementById('instagram').value,
                owner: AppState.currentUser.email,
                createdAt: nowISO(),
                activities: []
            };
            if (!newLead.phone && !newLead.email && !newLead.instagram) {
                alert('Please provide at least one contact method (Phone, Email, or Instagram).');
                return;
            }
            leads.push(newLead);
            save(KEYS.LEADS, leads);
            alert('Lead created successfully!');
            navigate('lead_detail', { id: newLead.id });
        });
    }

    // --- You can add the other render functions (renderLeadDetail, renderFundraisersList, etc.) here following the same pattern ---
    // Make sure all event listeners are correctly set up inside their respective render functions.

    init();
});