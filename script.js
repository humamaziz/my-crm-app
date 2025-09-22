/*
    LeadFlow CRM - Complete Application Logic
    Handles all data, routing, rendering, and business logic.
*/

document.addEventListener('DOMContentLoaded', () => {
    // --- DATA KEYS & UTILITIES ---
    const KEYS = {
        USERS: 'crm_users_v4',
        CAMPAIGNS: 'crm_campaigns_v4',
        LEADS: 'crm_leads_v4',
        FUNDRAISERS: 'crm_fundraisers_v4',
        PAYMENTS: 'crm_payments_v4',
        CURRENT_USER: 'crm_current_user_v4'
    };

    const AppState = {
        currentUser: null,
        currentPage: 'dashboard',
        tableState: {
            leads: { page: 1, perPage: 10, search: '', sortBy: 'createdAt', sortOrder: 'desc' },
            fundraisers: { page: 1, perPage: 10, search: '', sortBy: 'createdAt', sortOrder: 'desc' },
            payments: { page: 1, perPage: 10, search: '', sortBy: 'date', sortOrder: 'desc' },
            calls: { page: 1, perPage: 10, search: '', sortBy: 'when', sortOrder: 'desc' },
            users: { page: 1, perPage: 10, search: '', sortBy: 'name', sortOrder: 'asc' },
            campaigns: { page: 1, perPage: 10, search: '', sortBy: 'organisation', sortOrder: 'asc' }
        },
        currentLeadFilter: 'all'
    };

    const load = key => JSON.parse(localStorage.getItem(key) || '[]');
    const save = (key, data) => localStorage.setItem(key, JSON.stringify(data));
    const uid = prefix => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
    const nowISO = () => new Date().toISOString();
    const formatCurrency = amount => `₹${Number(amount || 0).toLocaleString('en-IN')}`;
    const formatDate = isoString => isoString ? new Date(isoString).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A';
    
    function init() {
        document.getElementById('login-form').addEventListener('submit', handleLoginSubmit);
        document.getElementById('logout-btn').addEventListener('click', logout);
        document.querySelector('.close-modal').addEventListener('click', closeModal);
        document.getElementById('csv-modal').addEventListener('click', (e) => e.target === document.getElementById('csv-modal') && closeModal());
        document.getElementById('csv-upload-area').addEventListener('click', () => document.getElementById('csv-file-input').click());
        document.getElementById('csv-file-input').addEventListener('change', handleFileSelect);
        checkAuth();
    }

    function checkAuth() {
        const user = JSON.parse(localStorage.getItem(KEYS.CURRENT_USER));
        const users = load(KEYS.USERS);
        if (users.length === 0) {
            setupFirstAdmin();
        } else if (user && users.find(u => u.id === user.id)) {
            AppState.currentUser = user;
            showApp();
        } else {
            logout();
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
            if (!name || !email || !password) return alert('Please fill all fields.');
            const admin = { id: uid('user'), name, email, password, role: 'admin' };
            save(KEYS.USERS, [admin]);
            login(admin);
        } else {
            const user = users.find(u => u.email === email && u.password === password);
            if (user) login(user);
            else alert('Invalid email or password.');
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
        main.innerHTML = '';
        Object.keys(AppState.tableState).forEach(key => { AppState.tableState[key].page = 1; AppState.tableState[key].search = ''; });

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

    const isUserAdmin = () => AppState.currentUser?.role === 'admin';

    function getVisibleData(key) {
        let data = load(key);
        if (isUserAdmin()) return data;
        const userEmail = AppState.currentUser.email;
        switch (key) {
            case KEYS.LEADS:
            case KEYS.FUNDRAISERS:
                return data.filter(item => item.owner === userEmail);
            case KEYS.CALLS:
                 return data.filter(item => item.by === userEmail);
            case KEYS.PAYMENTS:
                const userFundraisers = getVisibleData(KEYS.FUNDRAISERS).map(f => f.id);
                return data.filter(p => userFundraisers.includes(p.fundId) || p.recordedBy === userEmail);
            default: return data;
        }
    }
    
    function applyTableState(data, key) {
        const state = AppState.tableState[key];
        if (state.search) {
            const searchTerm = state.search.toLowerCase();
            data = data.filter(item => Object.values(item).some(val => String(val).toLowerCase().includes(searchTerm)));
        }
        data.sort((a, b) => {
            let valA = a[state.sortBy], valB = b[state.sortBy];
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();
            if (valA < valB) return state.sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return state.sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
        return data;
    }

    function renderSortableHeader(label, sortKey, tableKey) {
        const state = AppState.tableState[tableKey];
        const isCurrent = state.sortBy === sortKey;
        const icon = isCurrent ? (state.sortOrder === 'asc' ? '▲' : '▼') : '';
        return `<th class="sortable" onclick="setSort('${tableKey}', '${sortKey}')">${label} ${icon}</th>`;
    }

    window.setSort = (tableKey, sortKey) => {
        const state = AppState.tableState[tableKey];
        if (state.sortBy === sortKey) state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
        else { state.sortBy = sortKey; state.sortOrder = 'desc'; }
        handleHashChange();
    };
    
    function renderPagination(total, state, key) {
        const totalPages = Math.ceil(total / state.perPage);
        if (totalPages <= 1) return '';
        let html = '<div class="pagination">';
        for (let i = 1; i <= totalPages; i++) {
            html += `<button class="btn ghost small ${i === state.page ? 'active' : ''}" onclick="changePage('${key}', ${i})">${i}</button>`;
        }
        return html + '</div>';
    }
    
    window.changePage = (key, page) => { AppState.tableState[key].page = page; handleHashChange(); };
    const paginate = (items, page, perPage) => items.slice((page - 1) * perPage, page * perPage);

    // --- RENDER FUNCTIONS ---
    function renderDashboard() {
        const main = document.getElementById('main-content');
        const fundraisers = load(KEYS.FUNDRAISERS), payments = load(KEYS.PAYMENTS), users = load(KEYS.USERS), leads = load(KEYS.LEADS), campaigns = load(KEYS.CAMPAIGNS);
        const oneWeekAgo = new Date(); oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const recentPayments = payments.filter(p => new Date(p.date) >= oneWeekAgo);
        const execScores = users.filter(u => u.role === 'executive').map(exec => {
            const execFunds = fundraisers.filter(f => f.owner === exec.email).map(f => f.id);
            const total = recentPayments.filter(p => execFunds.includes(p.fundId)).reduce((s, p) => s + p.amount, 0);
            return { name: exec.name, total };
        });
        const topExecutives = execScores.sort((a, b) => b.total - a.total).slice(0, 5);
        const recentFundraisers = fundraisers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
        const topFundraisers = fundraisers.sort((a, b) => b.collected - a.collected).slice(0, 5);
        const recentPaymentsList = payments.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 15);
        const getCampaignName = (fund) => {
            const lead = leads.find(l => l.id === fund.leadId);
            const camp = campaigns.find(c => c.id === lead?.campaignId);
            return camp ? `${camp.organisation} / ${camp.product}` : 'N/A';
        };
        main.innerHTML = `<div class="page-header"><h1>Dashboard</h1></div><div class="dashboard-grid"><!-- Cards injected here --></div>`;
        const grid = main.querySelector('.dashboard-grid');
        grid.innerHTML = `
            <div class="dashboard-card"><h3>🏆 Top Executives (This Week)</h3>${topExecutives.map(e => `<div class="list-item"><div class="list-item-main name">${e.name}</div><div class="list-item-value">${formatCurrency(e.total)}</div></div>`).join('') || '<p class="muted">No activity.</p>'}</div>
            <div class="dashboard-card"><h3>✨ Recent Fundraisers</h3>${recentFundraisers.map(f => `<div class="list-item"><div class="list-item-main"><div class="name">${f.title}</div><div class="detail">${f.owner} &middot; ${getCampaignName(f)}</div></div><div class="list-item-value secondary">${formatCurrency(f.collected)}</div></div>`).join('') || '<p class="muted">No fundraisers.</p>'}</div>
            <div class="dashboard-card"><h3>🚀 Top Fundraisers (All Time)</h3>${topFundraisers.map(f => `<div class="list-item"><div class="list-item-main"><div class="name">${f.title}</div><div class="detail">${f.owner}</div></div><div class="list-item-value">${formatCurrency(f.collected)}</div></div>`).join('') || '<p class="muted">No fundraisers.</p>'}</div>
            <div class="dashboard-card"><h3>💰 Recent Payments</h3>${recentPaymentsList.map(p => {
                const f = fundraisers.find(fund => fund.id === p.fundId);
                const l = leads.find(lead => lead.id === f?.leadId);
                const c = campaigns.find(camp => camp.id === l?.campaignId);
                return `<div class="list-item"><div class="list-item-main"><div class="name">${formatCurrency(p.amount)} from ${p.donor}</div><div class="detail">${c?.product || 'N/A'} &middot; by ${p.recordedBy}</div></div></div>`;
            }).join('') || '<p class="muted">No payments.</p>'}</div>`;
    }

    // --- ALL OTHER PAGE RENDERERS ---
    
    function renderLeadsList() {
        const main = document.getElementById('main-content');
        let controlsHTML = `<div class="controls"><div class="search-box"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg><input type="text" id="search-input" placeholder="Search leads..." value="${AppState.tableState.leads.search}"></div>`;
        if (isUserAdmin()) {
            const users = load(KEYS.USERS);
            controlsHTML += `<select id="exec-filter"><option value="all">All Executives</option>${users.filter(u=>u.role==='executive').map(u => `<option value="${u.email}" ${AppState.currentLeadFilter === u.email ? 'selected' : ''}>${u.name}</option>`).join('')}</select><button class="btn ghost" id="import-leads-btn">Import</button><button class="btn ghost" id="export-leads-btn">Export</button>`;
        }
        controlsHTML += '</div>';
        main.innerHTML = `<div class="page-header"><h1>Leads</h1><a href="#add_lead" class="btn">Add Lead</a></div>${controlsHTML}<div id="table-container"></div>`;
        document.getElementById('search-input').addEventListener('input', e => { AppState.tableState.leads.search = e.target.value; renderLeadsTable(); });
        if (isUserAdmin()) {
            document.getElementById('exec-filter').addEventListener('change', e => { AppState.currentLeadFilter = e.target.value; renderLeadsTable(); });
            document.getElementById('import-leads-btn').addEventListener('click', () => openModal('leads'));
            document.getElementById('export-leads-btn').addEventListener('click', exportLeadsToCSV);
        }
        renderLeadsTable();
    }

    function renderLeadsTable() {
        const container = document.getElementById('table-container');
        if (!container) return;
        let leads = isUserAdmin() ? load(KEYS.LEADS) : getVisibleData(KEYS.LEADS);
        if (isUserAdmin() && AppState.currentLeadFilter !== 'all') leads = leads.filter(l => l.owner === AppState.currentLeadFilter);
        const campaigns = load(KEYS.CAMPAIGNS);
        const data = leads.map(l => ({ ...l, campaignName: campaigns.find(c => c.id === l.campaignId)?.product || 'N/A' }));
        const processed = applyTableState(data, 'leads');
        const paginated = paginate(processed, AppState.tableState.leads.page, AppState.tableState.leads.perPage);
        container.innerHTML = `<table><thead><tr>${renderSortableHeader('Name', 'name', 'leads')}${renderSortableHeader('Phone', 'phone', 'leads')}${renderSortableHeader('Campaign', 'campaignName', 'leads')}${renderSortableHeader('Owner', 'owner', 'leads')}${renderSortableHeader('Created', 'createdAt', 'leads')}<th></th></tr></thead><tbody>${paginated.map(l => `<tr><td>${l.name}</td><td>${l.phone||'-'}</td><td>${l.campaignName}</td><td>${l.owner}</td><td>${formatDate(l.createdAt)}</td><td><a href="#lead_detail?id=${l.id}" class="btn small">View</a></td></tr>`).join('') || '<tr><td colspan="6" align="center" style="padding:20px;">No leads found.</td></tr>'}</tbody></table>${renderPagination(processed.length, AppState.tableState.leads, 'leads')}`;
    }

    function renderLeadDetail(id) {
        const main = document.getElementById('main-content');
        const leads = load(KEYS.LEADS);
        const lead = leads.find(l => l.id === id);
        if (!lead) { main.innerHTML = 'Lead not found.'; return; }
        
        const campaigns = load(KEYS.CAMPAIGNS);
        const campaign = campaigns.find(c => c.id === lead.campaignId);
        const allFundraisers = load(KEYS.FUNDRAISERS);
        const leadFundraisers = allFundraisers.filter(f => f.leadId === id);

        main.innerHTML = `
            <div class="page-header lead-detail-header">
                <div>
                    <h1>${lead.name}</h1>
                    <p class="muted">Owner: ${lead.owner}</p>
                </div>
                <a href="#leads" class="btn ghost">Back to Leads</a>
            </div>
            <div class="card">
                <h3>Lead Information</h3>
                <div class="lead-info-grid">
                    <p><strong>Phone:</strong> ${lead.phone || 'N/A'}</p>
                    <p><strong>Email:</strong> ${lead.email || 'N/A'}</p>
                    <p><strong>Instagram:</strong> ${lead.instagram || 'N/A'}</p>
                    <p><strong>Campaign:</strong> ${campaign ? `${campaign.organisation} / ${campaign.product}` : 'N/A'}</p>
                </div>
            </div>
            <div class="detail-grid">
                <div class="card">
                    <h3>Activity Log</h3>
                    <form id="activity-form" style="display: flex; gap: 8px; margin-bottom: 20px;">
                        <select id="activity-type" style="flex-grow: 0; width: 150px;">
                            <option>Called</option><option>Emailed</option><option>Follow-up</option><option>Not Interested</option>
                        </select>
                        <input id="activity-note" placeholder="Add a note..." style="flex-grow: 1;">
                        <button type="submit" class="btn">Save</button>
                    </form>
                    <div id="activity-list">
                        ${[...lead.activities].reverse().map(act => `
                            <div class="activity-item">
                                <div class="activity-header">
                                    <span class="activity-type">${act.type}</span>
                                    <span class="activity-meta">${act.by} &middot; ${formatDate(act.when)}</span>
                                </div>
                                ${act.note ? `<p class="activity-note">${act.note}</p>` : ''}
                            </div>
                        `).join('') || '<p class="muted">No activities yet.</p>'}
                    </div>
                </div>
                <div class="card">
                    <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <h3>Fundraisers</h3>
                        <a href="#fundraiser_create?leadId=${id}" class="btn small">+ Add</a>
                    </div>
                    <div id="fundraiser-list">
                        ${leadFundraisers.map(f => {
                            const progress = f.amount > 0 ? (f.collected / f.amount) * 100 : 0;
                            return `
                                <div class="list-item">
                                    <div class="list-item-main">
                                        <a href="#fundraiser_create?fundId=${f.id}" class="name">${f.title}</a>
                                        <div class="detail">${formatCurrency(f.collected)} / ${formatCurrency(f.amount)}</div>
                                        <div class="progress-bar-container"><div class="progress-bar" style="width: ${progress}%"></div></div>
                                    </div>
                                </div>`;
                        }).join('') || '<p class="muted">No fundraisers for this lead yet.</p>'}
                    </div>
                </div>
            </div>
        `;

        document.getElementById('activity-form').addEventListener('submit', e => {
            e.preventDefault();
            const type = document.getElementById('activity-type').value;
            const note = document.getElementById('activity-note').value;
            const activity = { type, note, by: AppState.currentUser.email, when: nowISO() };
            const leadIndex = leads.findIndex(l => l.id === id);
            leads[leadIndex].activities.push(activity);
            save(KEYS.LEADS, leads);
            // also create a call record
            const calls = load(KEYS.CALLS);
            calls.push({ id: uid('call'), leadId: id, ...activity });
            save(KEYS.CALLS, calls);
            renderLeadDetail(id); // Re-render to show new activity
        });
    }

    function renderAddLeadForm() {
        const main = document.getElementById('main-content');
        const campaigns = load(KEYS.CAMPAIGNS);
        main.innerHTML = `<div class="page-header"><h1>Add New Lead</h1></div><div class="card"><form id="add-lead-form"><div class="form-grid-2"><div><label for="name">Lead Name</label><input type="text" id="name" required></div><div><label for="campaignId">Campaign</label><select id="campaignId" required><option value="">Select a campaign</option>${campaigns.map(c => `<option value="${c.id}">${c.organisation} / ${c.product}</option>`).join('')}</select></div><div><label for="phone">Phone</label><input type="tel" id="phone"></div><div><label for="email">Email</label><input type="email" id="email"></div><div style="grid-column: 1 / -1;"><label for="instagram">Instagram Handle</label><input type="text" id="instagram" placeholder="@username or full URL"></div></div><div style="text-align: right; margin-top: 24px;"><a href="#leads" class="btn ghost">Cancel</a><button type="submit" class="btn">Save Lead</button></div></form></div>`;
        document.getElementById('add-lead-form').addEventListener('submit', e => {
            e.preventDefault();
            const newLead = { id: uid('lead'), name: document.getElementById('name').value, campaignId: document.getElementById('campaignId').value, phone: document.getElementById('phone').value, email: document.getElementById('email').value, instagram: document.getElementById('instagram').value, owner: AppState.currentUser.email, createdAt: nowISO(), activities: [] };
            if (!newLead.phone && !newLead.email && !newLead.instagram) return alert('Provide at least one contact method.');
            let leads = load(KEYS.LEADS); leads.push(newLead); save(KEYS.LEADS, leads);
            alert('Lead created!'); navigate('lead_detail', { id: newLead.id });
        });
    }
    
    function renderFundraiserForm(leadId, fundId) {
        const main = document.getElementById('main-content');
        const isEditing = !!fundId;
        const fundraisers = load(KEYS.FUNDRAISERS);
        const fundraiser = isEditing ? fundraisers.find(f => f.id === fundId) : {};
        if (isEditing && !fundraiser) { main.innerHTML = 'Fundraiser not found.'; return; }
        
        const actualLeadId = isEditing ? fundraiser.leadId : leadId;
        const leads = load(KEYS.LEADS);
        const lead = leads.find(l => l.id === actualLeadId);
        if (!lead) { main.innerHTML = 'Associated lead not found.'; return; }

        main.innerHTML = `
            <div class="page-header"><h1>${isEditing ? 'Edit' : 'Create'} Fundraiser</h1></div>
            <p style="margin-bottom: 16px;">For Lead: <strong>${lead.name}</strong></p>
            <div class="card">
                <form id="fundraiser-form">
                    <div class="form-grid-2">
                        <div><label>Title</label><input id="title" value="${fundraiser.title || ''}" required></div>
                        <div><label>Target Amount</label><input id="amount" type="number" value="${fundraiser.amount || ''}" required></div>
                        <div><label>End Date</label><input id="endDate" type="date" value="${fundraiser.endDate ? fundraiser.endDate.split('T')[0] : ''}"></div>
                        <div><label>Razorpay Page ID (optional)</label><input id="razorpayPageId" value="${fundraiser.razorpayPageId || ''}"></div>
                        <div style="grid-column: 1 / -1;"><label>Description</label><textarea id="description" rows="4">${fundraiser.desc || ''}</textarea></div>
                    </div>
                    <div style="text-align: right; margin-top: 24px;">
                        <a href="#lead_detail?id=${actualLeadId}" class="btn ghost">Cancel</a>
                        <button type="submit" class="btn">${isEditing ? 'Update' : 'Create'} Fundraiser</button>
                    </div>
                </form>
            </div>
        `;

        document.getElementById('fundraiser-form').addEventListener('submit', e => {
            e.preventDefault();
            const formData = {
                title: document.getElementById('title').value,
                amount: parseFloat(document.getElementById('amount').value),
                endDate: document.getElementById('endDate').value,
                razorpayPageId: document.getElementById('razorpayPageId').value,
                desc: document.getElementById('description').value,
            };

            if (isEditing) {
                const index = fundraisers.findIndex(f => f.id === fundId);
                fundraisers[index] = { ...fundraisers[index], ...formData };
            } else {
                fundraisers.push({
                    id: uid('fund'),
                    leadId: actualLeadId,
                    owner: AppState.currentUser.email,
                    createdAt: nowISO(),
                    collected: 0,
                    ...formData
                });
            }
            save(KEYS.FUNDRAISERS, fundraisers);
            alert(`Fundraiser ${isEditing ? 'updated' : 'created'}!`);
            navigate('lead_detail', { id: actualLeadId });
        });
    }

    // --- RENDER LISTS FOR Fundraisers, Payments, Calls ---
    
    function renderFundraisersList() {
        const main = document.getElementById('main-content');
        let controls = `<div class="controls"><div class="search-box"><input id="search-input" placeholder="Search fundraisers..." value="${AppState.tableState.fundraisers.search}"></div></div>`;
        main.innerHTML = `<div class="page-header"><h1>Fundraisers</h1></div>${controls}<div id="table-container"></div>`;
        document.getElementById('search-input').addEventListener('input', e => { AppState.tableState.fundraisers.search = e.target.value; renderFundraisersTable(); });
        renderFundraisersTable();
    }
    
    function renderFundraisersTable() {
        const container = document.getElementById('table-container');
        const fundraisers = getVisibleData(KEYS.FUNDRAISERS);
        const leads = load(KEYS.LEADS);
        const data = fundraisers.map(f => ({ ...f, leadName: leads.find(l => l.id === f.leadId)?.name || 'N/A' }));
        const processed = applyTableState(data, 'fundraisers');
        const paginated = paginate(processed, AppState.tableState.fundraisers.page, AppState.tableState.fundraisers.perPage);
        container.innerHTML = `<table><thead><tr>${renderSortableHeader('Title', 'title', 'fundraisers')}${renderSortableHeader('Lead', 'leadName', 'fundraisers')}${renderSortableHeader('Target', 'amount', 'fundraisers')}${renderSortableHeader('Collected', 'collected', 'fundraisers')}${renderSortableHeader('Owner', 'owner', 'fundraisers')}<th></th></tr></thead><tbody>${paginated.map(f => `<tr><td>${f.title}</td><td>${f.leadName}</td><td>${formatCurrency(f.amount)}</td><td>${formatCurrency(f.collected)}</td><td>${f.owner}</td><td><a href="#lead_detail?id=${f.leadId}" class="btn small">View Lead</a></td></tr>`).join('') || '<tr><td colspan="6" align="center" style="padding:20px;">No fundraisers found.</td></tr>'}</tbody></table>${renderPagination(processed.length, AppState.tableState.fundraisers, 'fundraisers')}`;
    }
    
    function renderPaymentsList() {
        const main = document.getElementById('main-content');
        let controls = `<div class="controls"><div class="search-box"><input id="search-input" placeholder="Search payments..." value="${AppState.tableState.payments.search}"></div>`;
        if (isUserAdmin()) controls += `<button class="btn ghost" id="import-payments-btn">Import Razorpay CSV</button>`;
        controls += `</div>`;
        main.innerHTML = `<div class="page-header"><h1>Payments</h1></div>${controls}<div id="table-container"></div>`;
        document.getElementById('search-input').addEventListener('input', e => { AppState.tableState.payments.search = e.target.value; renderPaymentsTable(); });
        if (isUserAdmin()) document.getElementById('import-payments-btn').addEventListener('click', () => openModal('payments'));
        renderPaymentsTable();
    }

    function renderPaymentsTable() {
        const container = document.getElementById('table-container');
        const payments = getVisibleData(KEYS.PAYMENTS);
        const fundraisers = load(KEYS.FUNDRAISERS);
        const data = payments.map(p => ({ ...p, fundraiserTitle: fundraisers.find(f => f.id === p.fundId)?.title || 'N/A' }));
        const processed = applyTableState(data, 'payments');
        const paginated = paginate(processed, AppState.tableState.payments.page, AppState.tableState.payments.perPage);
        container.innerHTML = `<table><thead><tr>${renderSortableHeader('Donor', 'donor', 'payments')}${renderSortableHeader('Amount', 'amount', 'payments')}${renderSortableHeader('Date', 'date', 'payments')}${renderSortableHeader('Fundraiser', 'fundraiserTitle', 'payments')}${renderSortableHeader('Method', 'method', 'payments')}</tr></thead><tbody>${paginated.map(p => `<tr><td>${p.donor}</td><td>${formatCurrency(p.amount)}</td><td>${formatDate(p.date)}</td><td>${p.fundraiserTitle}</td><td>${p.method}</td></tr>`).join('') || '<tr><td colspan="5" align="center" style="padding:20px;">No payments found.</td></tr>'}</tbody></table>${renderPagination(processed.length, AppState.tableState.payments, 'payments')}`;
    }

    function renderCallsList() {
        const main = document.getElementById('main-content');
        main.innerHTML = `<div class="page-header"><h1>Calls & Activities</h1></div><div class="controls"><div class="search-box"><input id="search-input" placeholder="Search activities..." value="${AppState.tableState.calls.search}"></div></div><div id="table-container"></div>`;
        document.getElementById('search-input').addEventListener('input', e => { AppState.tableState.calls.search = e.target.value; renderCallsTable(); });
        renderCallsTable();
    }
    
    function renderCallsTable() {
        const container = document.getElementById('table-container');
        const calls = getVisibleData(KEYS.CALLS);
        const leads = load(KEYS.LEADS);
        const data = calls.map(c => ({ ...c, leadName: leads.find(l => l.id === c.leadId)?.name || 'N/A' }));
        const processed = applyTableState(data, 'calls');
        const paginated = paginate(processed, AppState.tableState.calls.page, AppState.tableState.calls.perPage);
        container.innerHTML = `<table><thead><tr>${renderSortableHeader('Lead', 'leadName', 'calls')}${renderSortableHeader('Activity', 'type', 'calls')}${renderSortableHeader('Note', 'note', 'calls')}${renderSortableHeader('Date', 'when', 'calls')}${renderSortableHeader('Executive', 'by', 'calls')}</tr></thead><tbody>${paginated.map(c => `<tr><td><a href="#lead_detail?id=${c.leadId}">${c.leadName}</a></td><td>${c.type}</td><td>${c.note||'-'}</td><td>${formatDate(c.when)}</td><td>${c.by}</td></tr>`).join('') || '<tr><td colspan="5" align="center" style="padding:20px;">No activities found.</td></tr>'}</tbody></table>${renderPagination(processed.length, AppState.tableState.calls, 'calls')}`;
    }
    
    function renderAdminPanel() {
        if (!isUserAdmin()) { navigate('dashboard'); return; }
        const main = document.getElementById('main-content');
        main.innerHTML = `
            <div class="page-header"><h1>Admin Panel</h1></div>
            <div class="detail-grid">
                <div class="card">
                    <h3>Manage Users</h3>
                    <form id="add-user-form" style="margin-bottom: 20px;">
                        <div class="form-grid-2">
                            <div><label>Name</label><input id="new-user-name" required></div>
                            <div><label>Email</label><input id="new-user-email" type="email" required></div>
                            <div><label>Password</label><input id="new-user-password" type="password" required></div>
                            <div><label>Role</label><select id="new-user-role"><option value="executive">Executive</option><option value="admin">Admin</option></select></div>
                        </div>
                        <button type="submit" class="btn" style="margin-top: 16px;">Create User</button>
                    </form>
                    <div id="user-list-table"></div>
                </div>
                <div class="card">
                    <h3>Manage Campaigns</h3>
                    <form id="add-campaign-form" style="margin-bottom: 20px;">
                        <label>Organisation</label><input id="new-campaign-org" required>
                        <label>Product / Campaign Name</label><input id="new-campaign-prod" required>
                        <button type="submit" class="btn" style="margin-top: 16px;">Create Campaign</button>
                    </form>
                    <div id="campaign-list-table"></div>
                </div>
            </div>
        `;

        document.getElementById('add-user-form').addEventListener('submit', e => {
            e.preventDefault();
            const users = load(KEYS.USERS);
            const email = document.getElementById('new-user-email').value;
            if (users.find(u => u.email === email)) return alert('User with this email already exists.');
            users.push({ id: uid('user'), name: document.getElementById('new-user-name').value, email, password: document.getElementById('new-user-password').value, role: document.getElementById('new-user-role').value });
            save(KEYS.USERS, users);
            renderAdminPanel();
        });

        document.getElementById('add-campaign-form').addEventListener('submit', e => {
            e.preventDefault();
            const campaigns = load(KEYS.CAMPAIGNS);
            campaigns.push({ id: uid('camp'), organisation: document.getElementById('new-campaign-org').value, product: document.getElementById('new-campaign-prod').value });
            save(KEYS.CAMPAIGNS, campaigns);
            renderAdminPanel();
        });
        
        window.deleteUser = (id) => {
            if (!confirm('Are you sure you want to delete this user?')) return;
            let users = load(KEYS.USERS);
            users = users.filter(u => u.id !== id);
            save(KEYS.USERS, users);
            renderAdminPanel();
        };

        window.deleteCampaign = (id) => {
            if (!confirm('Are you sure you want to delete this campaign?')) return;
            let campaigns = load(KEYS.CAMPAIGNS);
            campaigns = campaigns.filter(c => c.id !== id);
            save(KEYS.CAMPAIGNS, campaigns);
            renderAdminPanel();
        };

        renderAdminTables();
    }
    
    function renderAdminTables() {
        const users = load(KEYS.USERS);
        document.getElementById('user-list-table').innerHTML = `<table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr></thead><tbody>${users.map(u => `<tr><td>${u.name}</td><td>${u.email}</td><td>${u.role}</td><td><button class="btn small danger" onclick="deleteUser('${u.id}')" ${u.email === AppState.currentUser.email ? 'disabled' : ''}>Delete</button></td></tr>`).join('')}</tbody></table>`;
        const campaigns = load(KEYS.CAMPAIGNS);
        document.getElementById('campaign-list-table').innerHTML = `<table><thead><tr><th>Organisation</th><th>Product</th><th></th></tr></thead><tbody>${campaigns.map(c => `<tr><td>${c.organisation}</td><td>${c.product}</td><td><button class="btn small danger" onclick="deleteCampaign('${c.id}')">Delete</button></td></tr>`).join('')}</tbody></table>`;
    }

    // --- CSV & File Handling ---
    function openModal(type) { document.getElementById('csv-modal-title').textContent = `Import ${type}`; document.getElementById('csv-file-input').dataset.type = type; document.getElementById('csv-modal').style.display = 'flex'; }
    function closeModal() { document.getElementById('csv-modal').style.display = 'none'; document.getElementById('csv-file-input').value = ''; }
    function handleFileSelect(e) {
        const file = e.target.files[0], type = e.target.dataset.type;
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (type === 'leads') importLeadsFromCSV(e.target.result);
                if (type === 'payments') importPaymentsFromCSV(e.target.result);
            };
            reader.readAsText(file);
        }
    }
    function parseCSV(text) {
        const lines = text.trim().split('\n');
        const header = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const rows = lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
            let row = {}; header.forEach((h, i) => row[h] = values[i]); return row;
        });
        return { header, rows };
    }
    function importLeadsFromCSV(csv) { /* Placeholder */ alert('Lead import logic to be added.'); closeModal(); }
    function importPaymentsFromCSV(csv) { /* Placeholder */ alert('Payment import logic to be added.'); closeModal(); }
    function exportLeadsToCSV() {
        const leads = load(KEYS.LEADS);
        const headers = ['id', 'name', 'phone', 'email', 'instagram', 'campaignId', 'owner', 'createdAt'];
        let csvContent = headers.join(',') + '\n' + leads.map(l => headers.map(h => `"${(l[h]||'').toString().replace(/"/g,'""')}"`).join(',')).join('\n');
        downloadCSV(csvContent, 'leads_export.csv');
    }
    function downloadCSV(content, fileName) {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url); link.setAttribute("download", fileName);
        link.style.visibility = 'hidden'; document.body.appendChild(link);
        link.click(); document.body.removeChild(link);
    }
    
    init();
});
