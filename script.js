/*
    LeadFlow CRM - Firebase Edition v12.0 (Full & Final Application)
    This script contains all logic for all features, pages, and real-time database operations,
    with UI designs inspired by user screenshots.
*/
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('login-form')) {
        initializeApp();
    }
});

function initializeApp() {
    // --- PART 1: FIREBASE SETUP ---
    // PASTE YOUR FIREBASE CONFIGURATION OBJECT HERE.
    const firebaseConfig = {
    apiKey: "AIzaSyB0lWOPYmPsNFTdOIqdhAPmgzN_83DMHds",
    authDomain: "leadflow-crm-app.firebaseapp.com",
    projectId: "leadflow-crm-app",
    storageBucket: "leadflow-crm-app.firebasestorage.app",
    messagingSenderId: "826778688600",
    appId: "1:826778688600:web:25aef6586f9cfffeb43e2d"
  };
    // --- INITIALIZE FIREBASE (ONLY ONCE) ---
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const db = firebase.firestore();
    const auth = firebase.auth();

    // --- GLOBAL STATE & DOM ELEMENTS ---
    const AppState = { currentUser: null, userDetails: null };
    const loginView = document.getElementById('login-view');
    const appContainer = document.getElementById('app-container');
    const loginForm = document.getElementById('login-form');
    const logoutBtn = document.getElementById('logout-btn');
    const mainContent = document.getElementById('main-content');
    
    // --- HELPER FUNCTIONS ---
    const formatCurrency = amount => `₹${Number(amount || 0).toLocaleString('en-IN')}`;
    const formatDate = ts => ts ? new Date(ts.seconds * 1000).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A';

    // --- AUTHENTICATION & CORE APP FLOW ---
    auth.onAuthStateChanged(async user => {
        if (user) {
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (userDoc.exists) {
                AppState.currentUser = user;
                AppState.userDetails = { uid: user.uid, ...userDoc.data() };
                showApp();
            } else { logout(); }
        } else {
            AppState.currentUser = null;
            AppState.userDetails = null;
            showLogin();
        }
    });

    async function handleLoginSubmit(e) {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const name = document.getElementById('name').value;
        const button = document.getElementById('login-button');
        button.disabled = true; button.textContent = 'Processing...';

        try {
            const usersSnapshot = await db.collection('users').limit(1).get();
            if (usersSnapshot.empty) {
                if (!name) throw new Error('Please provide your name to create the admin account.');
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                await db.collection('users').doc(userCredential.user.uid).set({ name, email, role: 'admin' });
            } else {
                await auth.signInWithEmailAndPassword(email, password);
            }
        } catch (error) {
            alert(`Error: ${error.message}`);
        } finally {
            button.disabled = false;
        }
    }

    function logout() { auth.signOut(); }

    function showLogin() {
        if (!appContainer || !loginView) return;
        appContainer.style.display = 'none';
        loginView.style.display = 'block';
        db.collection('users').limit(1).get().then(snapshot => {
            const title = document.getElementById('login-title');
            const button = document.getElementById('login-button');
            const nameGroup = document.getElementById('name-group');
            if (snapshot.empty) {
                title.textContent = 'Create Super Admin Account'; button.textContent = 'Create Admin';
                nameGroup.style.display = 'block';
            } else {
                title.textContent = 'Login to your account'; button.textContent = 'Login';
                nameGroup.style.display = 'none';
            }
        });
    }

    function showApp() {
        loginView.style.display = 'none'; appContainer.style.display = 'block';
        document.getElementById('user-email').textContent = AppState.userDetails.email;
        document.getElementById('user-role').textContent = AppState.userDetails.role;
        renderNavbar(); handleHashChange();
    }
    
    // --- ROUTING & PAGE RENDERING ---
    window.addEventListener('hashchange', handleHashChange);
    
    function renderNavbar() {
        const nav = document.getElementById('navbar');
        const isAdmin = AppState.userDetails.role === 'admin';
        const navItems = [
            { name: 'Dashboard', page: 'dashboard' }, { name: 'Leads', page: 'leads' },
            { name: 'Fundraisers', page: 'fundraisers' }, { name: 'Payments', page: 'payments' },
            { name: 'Calls', page: 'calls' }, { name: 'Admin', page: 'admin', adminOnly: true }
        ];
        nav.innerHTML = navItems.filter(item => !item.adminOnly || isAdmin)
            .map(item => `<a href="#${item.page}" class="nav-link" data-page="${item.page}">${item.name}</a>`).join('');
    }

    function handleHashChange() {
        const hash = window.location.hash.substring(1) || 'dashboard';
        const [page, query] = hash.split('?');
        const params = new URLSearchParams(query);
        renderPage(page, params);
        updateActiveNav(page);
    }
    
    function renderPage(page, params) {
        mainContent.innerHTML = `<div class="card"><p>Loading...</p></div>`;
        switch (page) {
            case 'dashboard': renderDashboard(); break;
            case 'leads': renderLeadsList(); break;
            case 'add_lead': renderAddLeadForm(); break;
            case 'lead_detail': renderLeadDetail(params.get('id')); break;
            case 'fundraisers': renderFundraisersList(); break;
            case 'fundraiser_create': renderFundraiserCreateForm(params.get('leadId'), params.get('fundId')); break;
            case 'fundraiser_detail': renderFundraiserDetail(params.get('id')); break;
            case 'payments': renderPaymentsList(); break;
            case 'calls': renderCallsList(); break;
            case 'admin': renderAdminPanel(); break;
            default: mainContent.innerHTML = `<div class="card"><h1>Page Not Found</h1></div>`;
        }
    }

    function updateActiveNav(currentPage) {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.page === currentPage.split('_')[0]);
        });
    }

    // --- ALL PAGE RENDERING FUNCTIONS ---
    
    async function renderDashboard() {
        mainContent.innerHTML = `<div class="page-header"><h1>Dashboard</h1></div><div class="kpi-grid"></div><div class="dashboard-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 24px;"></div>`;
        const kpiGrid = mainContent.querySelector('.kpi-grid');
        const grid = mainContent.querySelector('.dashboard-grid');
        grid.innerHTML = Array(4).fill('<div class="card"><p>Loading stats...</p></div>').join('');
        try {
            const [usersSnap, fundsSnap, paymentsSnap, leadsSnap, callsSnap] = await Promise.all([
                db.collection('users').get(), db.collection('fundraisers').get(), 
                db.collection('payments').orderBy('date', 'desc').get(), 
                db.collection('leads').get(), db.collection('calls').get()
            ]);
            const users = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const fundraisers = fundsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const allPayments = paymentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const leads = leadsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            const oneWeekAgo = new Date(); oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            const recentPayments = allPayments.filter(p => p.date && p.date.toDate() >= oneWeekAgo);
            const totalFundsRaised = allPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
            
            kpiGrid.innerHTML = `
                <div class="kpi-card"><div class="kpi-icon">...</div><div class="kpi-info"><h3>${leads.length}</h3><p>Total Leads</p></div></div>
                <div class="kpi-card"><div class="kpi-icon">...</div><div class="kpi-info"><h3>${callsSnap.size}</h3><p>Total Calls</p></div></div>
                <div class="kpi-card"><div class="kpi-icon">...</div><div class="kpi-info"><h3>${fundraisers.length}</h3><p>Active Fundraisers</p></div></div>
                <div class="kpi-card"><div class="kpi-icon">...</div><div class="kpi-info"><h3>${formatCurrency(totalFundsRaised)}</h3><p>Total Funds Raised</p></div></div>
            `;
            
            const perfScores = users.map(user => {
                const userFunds = fundraisers.filter(f => f.owner === user.email).map(f => f.id);
                const total = recentPayments.filter(p => userFunds.includes(p.fundId)).reduce((s, p) => s + (p.amount || 0), 0);
                return { name: user.name, total, paymentCount: recentPayments.filter(p => userFunds.includes(p.fundId)).length };
            });
            
            const topPerformers = perfScores.sort((a, b) => b.total - a.total).slice(0, 5);
            const recentFundraisers = fundraisers.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).slice(0, 5);
            
            grid.innerHTML = `
                <div class="card"><h3><svg...> Recent Payments</h3>${allPayments.slice(0,5).map(p => `<div class="list-item"><div class="list-item-main"><div class="name">${formatCurrency(p.amount)} from ${p.donor}</div><div class="detail">${p.recordedBy}</div></div><span class="status-badge success">Captured</span></div>`).join('')}</div>
                <div class="card"><h3>🏆 Top Performers (This Week)</h3>${topPerformers.map(e => `<div class="list-item"><div class="list-item-main"><div class="name">${e.name}</div><div class="detail">${e.paymentCount} payments</div></div><div class="list-item-value">${formatCurrency(e.total)}</div></div>`).join('') || '<p class="muted">No activity.</p>'}</div>
                <div class="card"><h3>🚀 Recently Launched</h3>${recentFundraisers.map(f => `<div class="list-item"><div class="list-item-main"><div class="name">${f.title}</div><div class="detail">${f.owner}</div></div><a href="#lead_detail?id=${f.leadId}" class="btn small ghost">View</a></div>`).join('')}</div>
                <div class="card"><h3>⭐ Top Fundraisers This Week</h3>${topPerformers.map(e => `<div class="list-item"><div class="list-item-main"><div class="name">${e.name}</div></div><div class="list-item-value">${formatCurrency(e.total)}</div></div>`).join('')}</div>`;

        } catch (error) { console.error("Dashboard Error:", error); grid.innerHTML = `<div class="card"><p>Error loading dashboard data.</p></div>`; }
    }

    async function renderLeadsList() {
        mainContent.innerHTML = `<div class="page-header"><h1>Leads</h1><a href="#add_lead" class="btn">+ New Lead</a></div>
        <div class="card filter-card"><div id="filter-container" class="filter-grid"></div></div><div id="table-container"></div>`;
        const campaignsSnap = await db.collection('campaigns').get();
        const campaigns = campaignsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        document.getElementById('filter-container').innerHTML = `<input type="text" id="search-text" placeholder="Name, Social, Email or Phone"><select id="campaign-filter"><option value="">All Campaigns</option>${campaigns.map(c => `<option value="${c.id}">${c.product}</option>`).join('')}</select>`;
        
        const runQuery = () => {
            const container = document.getElementById('table-container');
            container.innerHTML = `<div class="card"><p>Loading leads...</p></div>`;
            let query = db.collection('leads');
            if (AppState.userDetails.role !== 'admin') query = query.where('owner', '==', AppState.userDetails.email);
            const campaignFilter = document.getElementById('campaign-filter').value;
            if (campaignFilter) query = query.where('campaignId', '==', campaignFilter);
            const searchText = document.getElementById('search-text').value.toLowerCase();
            
            query.orderBy('createdAt', 'desc').onSnapshot(snapshot => {
                let leads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                if (searchText) { leads = leads.filter(lead => Object.values(lead).some(val => String(val).toLowerCase().includes(searchText))); }
                if (leads.length === 0) { container.innerHTML = `<div class="card"><p>No leads found.</p></div>`; return; }
                container.innerHTML = `<table><thead><tr><th>Name</th><th>Instagram</th><th>Campaign</th><th>Last Activity</th><th></th></tr></thead><tbody>
                    ${leads.map(lead => `<tr><td>${lead.name}</td><td>@${lead.instagram || 'N/A'}</td><td>${campaigns.find(c=>c.id === lead.campaignId)?.product || 'N/A'}</td><td><span class="status-badge ${lead.lastActivity?.toLowerCase() || 'new'}">${lead.lastActivity || 'New'}</span></td>
                        <td><a href="#lead_detail?id=${lead.id}" class="btn small">View</a></td></tr>`).join('')}</tbody></table>`;
            });
        };
        document.getElementById('search-text').addEventListener('input', runQuery);
        document.getElementById('campaign-filter').addEventListener('change', runQuery);
        runQuery();
    }

    async function renderAddLeadForm() {
        const campaignsSnap = await db.collection('campaigns').orderBy('product').get();
        const campaigns = campaignsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        mainContent.innerHTML = `<div class="page-header"><h1>Create New Lead</h1></div><div class="card"><form id="add-lead-form">
            <h3>Contact Information</h3><hr style="margin: 16px 0; border-color: #f3f4f6;">
            <div class="form-grid">
                <div><label>First Name</label><input id="firstName" required></div><div><label>Last Name</label><input id="lastName"></div>
                <div><label>Email</label><input id="email" type="email"></div><div><label>Mobile</label><input id="phone"></div>
                <div><label>City</label><input id="city"></div><div><label>State</label><input id="state"></div>
                <div><label>Country</label><input id="country"></div><div><label>Pincode</label><input id="pincode"></div>
            </div>
            <h3 style="margin-top: 24px;">Social Media</h3><hr style="margin: 16px 0; border-color: #f3f4f6;">
            <div><label>Instagram Handle</label><input id="instagram" placeholder="username only (without @)"></div>
             <h3 style="margin-top: 24px;">Lead Assignment</h3><hr style="margin: 16px 0; border-color: #f3f4f6;">
            <div class="form-grid">
                <div><label>Organisation / Product</label><select id="campaignId" required><option value="">Select campaign</option>${campaigns.map(c => `<option value="${c.id}">${c.product}</option>`).join('')}</select></div>
                <div></div>
                <div><label>Lead Code (Profession)</label><input id="leadCode"></div>
                <div><label>Source Code (Your IG Handle)</label><input id="sourceCode" value="${AppState.userDetails.instagram || ''}"></div>
            </div>
            <div style="text-align: right; margin-top: 24px;"><a href="#leads" class="btn ghost">Cancel</a><button type="submit" class="btn">Save Lead</button></div>
        </form></div>`;
        document.getElementById('add-lead-form').addEventListener('submit', async e => {
            e.preventDefault();
            const campaignId = document.getElementById('campaignId').value;
            const firstName = document.getElementById('firstName').value.trim();
            if (!firstName || !campaignId) { return alert('First Name and Campaign are required.'); }
            
            const instagramHandle = document.getElementById('instagram').value.trim().replace('@','');
            if(instagramHandle){
                const existingLead = await db.collection('leads').where('instagram', '==', instagramHandle).limit(1).get();
                if(!existingLead.empty){
                    const existingData = existingLead.docs[0].data();
                    return alert(`This Instagram handle is already taken by: ${existingData.owner}`);
                }
            }

            const newLead = {
                name: `${firstName} ${document.getElementById('lastName').value}`.trim(), 
                campaignId, phone: document.getElementById('phone').value, email: document.getElementById('email').value,
                city: document.getElementById('city').value, state: document.getElementById('state').value,
                country: document.getElementById('country').value, pincode: document.getElementById('pincode').value,
                leadCode: document.getElementById('leadCode').value, sourceCode: document.getElementById('sourceCode').value,
                instagram: instagramHandle, owner: AppState.userDetails.email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(), lastActivity: 'New'
            };
            try {
                const docRef = await db.collection('leads').add(newLead);
                window.location.hash = `#lead_detail?id=${docRef.id}`;
            } catch (error) { alert(`Error: ${error.message}`); }
        });
    }

    function renderLeadDetail(id) {
         mainContent.innerHTML = `<div class="card"><p>Loading Lead Details...</p></div>`;
         db.collection('leads').doc(id).onSnapshot(async doc => {
            if (!doc.exists) { mainContent.innerHTML = 'Lead not found.'; return; }
            const lead = { id: doc.id, ...doc.data() };
            const campaignDoc = lead.campaignId ? await db.collection('campaigns').doc(lead.campaignId).get() : null;
            const campaign = campaignDoc?.exists ? campaignDoc.data() : { product: 'N/A' };
            mainContent.innerHTML = `<div class="detail-grid"><div>
                <div class="card"><div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;">
                    <div style="width: 60px; height: 60px; background-color: #e5e7eb; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; color: var(--muted-text-color);">${lead.name.charAt(0)}</div>
                    <div><h1 style="font-size: 24px; margin: 0;">${lead.name}</h1><p style="color: var(--muted-text-color); margin: 0;">${campaign.product}</p><p style="font-size: 14px; color: var(--muted-text-color); margin-top: 4px;">Assigned to ${lead.owner}</p></div>
                </div><h3>Socials & Contact</h3><p><strong>Instagram:</strong> <a href="https://instagram.com/${lead.instagram}" target="_blank">@${lead.instagram || 'N/A'}</a></p>
                <p><strong>Phone:</strong> ${lead.phone || 'N/A'}</p><p><strong>Email:</strong> ${lead.email || 'N/A'}</p></div>
                <div class="card" id="fundraisers-container"></div></div>
                <div><div class="card" id="activity-container"></div></div></div>`;
            renderActivitiesAndForm(id, lead.name);
            renderLeadFundraisersAndPayments(id);
         });
    }

    function renderActivitiesAndForm(leadId, leadName) {
        const container = document.getElementById('activity-container');
        db.collection('leads').doc(leadId).collection('activities').orderBy('when', 'desc').limit(5).onSnapshot(snapshot => {
            const activities = snapshot.docs.map(doc => doc.data());
            container.innerHTML = `
                <div style="display:flex; justify-content: space-between; align-items: center;"><h3>Recent Calls</h3><a href="#calls" class="btn small ghost">View All</a></div>
                <div style="margin-top: 16px;">${activities.map(act => `<div class="activity-item" style="padding: 8px 0;"><div class="activity-header"><span class="activity-type">${act.note || act.result}</span><span class="activity-meta" style="font-size: 12px;">${act.result} &middot; ${formatDate(act.when)}</span></div></div>`).join('') || '<p class="muted">No recent activities.</p>'}</div>
                <h3 style="margin-top: 24px;">Track Activity</h3><form id="activity-form" style="margin-top: 16px;">
                    <label>Result</label><select id="activity-result" required><option>DMed</option><option>Called</option><option>Emailed</option><option>Follow-up</option><option>Not Interested</option><option>Success</option></select>
                    <label style="margin-top:16px;">Notes</label><textarea id="activity-note" rows="3" placeholder="Add notes about this call..."></textarea>
                    <button type="submit" class="btn" style="margin-top: 16px; width: 100%;">Save Activity</button></form>`;
            document.getElementById('activity-form').addEventListener('submit', async e => {
                e.preventDefault();
                const note = document.getElementById('activity-note').value;
                const result = document.getElementById('activity-result').value;
                if (!result) return;
                const activityData = { result, note, by: AppState.userDetails.email, when: firebase.firestore.FieldValue.serverTimestamp() };
                await db.collection('leads').doc(leadId).collection('activities').add(activityData);
                await db.collection('calls').add({ leadId, leadName, ...activityData });
                await db.collection('leads').doc(leadId).update({ lastActivity: result });
                document.getElementById('activity-form').reset();
            });
        });
    }

    function renderLeadFundraisersAndPayments(leadId) {
        const container = document.getElementById('fundraisers-container');
        db.collection('fundraisers').where('leadId', '==', leadId).onSnapshot(snapshot => {
            const fundraisers = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
            container.innerHTML = `<div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 16px;"><h3>Fundraisers</h3><a href="#fundraiser_create?leadId=${leadId}" class="btn small">+ Add New</a></div>
            <div>${fundraisers.map(f => {
                const progress = f.target > 0 ? ((f.collected || 0) / f.target) * 100 : 0;
                const paymentUrl = f.razorpayPageId ? `https://rzp.io/l/${f.razorpayPageId}` : '';
                return `<div class="list-item"><div class="list-item-main" style="width:100%"><div style="display:flex;justify-content:space-between;align-items:center;"><a href="#fundraiser_create?fundId=${f.id}" class="name">${f.title}</a> ${paymentUrl ? `<a href="${paymentUrl}" target="_blank" class="btn small">Pay Link</a>`:''}</div><div class="detail">${formatCurrency(f.collected)} / ${formatCurrency(f.target)}</div><div class="progress-bar-container"><div class="progress-bar" style="width: ${progress}%"></div></div></div></div>`;
            }).join('') || '<p class="muted">No fundraisers yet.</p>'}</div>
            <div id="payment-confirmation-container" style="margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 24px;"></div>`;
            if(AppState.userDetails.role === 'admin') renderPaymentConfirmationForm(fundraisers);
        });
    }

    function renderPaymentConfirmationForm(fundraisers) {
        const container = document.getElementById('payment-confirmation-container');
        if (!fundraisers || fundraisers.length === 0) { container.innerHTML = ''; return; }
        container.innerHTML = `<h4>Confirm a New Payment</h4><form id="payment-confirmation-form">
            <div class="form-grid-2">
                <div><label>Fundraiser</label><select id="payment-fundraiser-id" required>${fundraisers.map(f => `<option value="${f.id}">${f.title}</option>`).join('')}</select></div>
                <div><label>Payment ID</label><input id="payment-id" placeholder="pay_..." required></div>
                <div><label>Amount Paid</label><input id="payment-amount" type="number" step="0.01" required></div>
                <div><label>Donor's Name</label><input id="payment-donor" value="Anonymous"></div>
            </div><button type="submit" class="btn" style="margin-top: 16px;">Confirm Payment</button></form>`;
        document.getElementById('payment-confirmation-form').addEventListener('submit', async e => {
            e.preventDefault();
            const [fundId, paymentId, amount, donor] = [document.getElementById('payment-fundraiser-id').value, document.getElementById('payment-id').value, Number(document.getElementById('payment-amount').value), document.getElementById('payment-donor').value];
            if (!fundId || !paymentId || !amount) return alert('Please fill all payment fields.');
            try {
                const existingPayment = await db.collection('payments').where('razorpayId', '==', paymentId).limit(1).get();
                if (!existingPayment.empty) throw new Error('This Payment ID has already been recorded.');
                await db.collection('payments').add({ fundId, donor, amount, razorpayId: paymentId, date: firebase.firestore.FieldValue.serverTimestamp(), method: 'Razorpay (Confirmed)', recordedBy: AppState.userDetails.email });
                await db.collection('fundraisers').doc(fundId).update({ collected: firebase.firestore.FieldValue.increment(amount) });
                alert('Payment confirmed and totals updated!');
                document.getElementById('payment-confirmation-form').reset();
            } catch(error) { alert(`Error: ${error.message}`); }
        });
    }
    
    async function renderFundraiserCreateForm(leadId, fundId) {
        const isEditing = !!fundId;
        let fundraiser = {}, lead;
        if (isEditing) {
            const doc = await db.collection('fundraisers').doc(fundId).get();
            if (doc.exists) fundraiser = { id: doc.id, ...doc.data() };
            const leadDoc = await db.collection('leads').doc(fundraiser.leadId).get();
            if (leadDoc.exists) lead = { id: leadDoc.id, ...leadDoc.data() };
        } else {
            const leadDoc = await db.collection('leads').doc(leadId).get();
            if (leadDoc.exists) lead = { id: leadDoc.id, ...leadDoc.data() };
        }
        if (!lead) { mainContent.innerHTML = 'Lead not found.'; return; }
        mainContent.innerHTML = `<div class="page-header"><h1>${isEditing ? 'Edit' : 'Create'} Fundraiser</h1></div><p>For Lead: <strong>${lead.name}</strong></p>
        <div class="card"><form id="fundraiser-form">
            <div class="form-grid">
                <div><label>Name</label><input id="title" value="${fundraiser.title || ''}" required></div>
                <div><label>Units</label><input id="units" type="number" value="${fundraiser.units || ''}"></div>
                <div><label>Amount (Target)</label><input id="target" type="number" value="${fundraiser.target || ''}" required></div>
                <div><label>Minimum Donation</label><input id="minDonation" type="number" value="${fundraiser.minDonation || ''}"></div>
            </div>
            <div style="margin-top:1rem;"><label>Fundraiser URL</label><input id="url" value="${fundraiser.url || ''}"></div>
            <div style="margin-top:1rem;"><label>Razorpay Payment Page ID</label><input id="razorpayPageId" value="${fundraiser.razorpayPageId || ''}"></div>
            <div style="margin-top:1rem;"><label>End Date</label><input id="endDate" type="date" value="${fundraiser.endDate || ''}"></div>
            <div style="margin-top:1rem;"><label>Campaign Description</label><textarea id="description" rows="5">${fundraiser.description || ''}</textarea></div>
            <div style="text-align: right; margin-top: 24px;"><a href="#lead_detail?id=${lead.id}" class="btn ghost">Cancel</a><button type="submit" class="btn">Save Fundraiser</button></div>
        </form></div>`;
        document.getElementById('fundraiser-form').addEventListener('submit', async e => {
            e.preventDefault();
            const data = {
                title: document.getElementById('title').value, units: Number(document.getElementById('units').value),
                target: Number(document.getElementById('target').value), minDonation: Number(document.getElementById('minDonation').value),
                url: document.getElementById('url').value, razorpayPageId: document.getElementById('razorpayPageId').value,
                endDate: document.getElementById('endDate').value, description: document.getElementById('description').value,
            };
            try {
                if (isEditing) {
                    await db.collection('fundraisers').doc(fundId).update(data);
                } else {
                    await db.collection('fundraisers').add({ ...data, leadId, owner: AppState.userDetails.email, collected: 0, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
                }
                window.location.hash = `#lead_detail?id=${lead.id}`;
            } catch (error) { alert(`Error: ${error.message}`); }
        });
    }

    function renderFundraisersList() {
        mainContent.innerHTML = `<div class="page-header"><h1>Fundraisers</h1></div><div id="table-container"></div>`;
        let query = db.collection('fundraisers');
        if (AppState.userDetails.role !== 'admin') query = query.where('owner', '==', AppState.userDetails.email);
        query.orderBy('createdAt', 'desc').onSnapshot(async snapshot => {
            if (snapshot.empty) { mainContent.querySelector('#table-container').innerHTML = `<div class="card"><p>No fundraisers found.</p></div>`; return; }
            const fundraisers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const leadsSnap = await db.collection('leads').get();
            const leads = leadsSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));
            mainContent.querySelector('#table-container').innerHTML = `<table><thead><tr><th>Name</th><th>Lead</th><th>Target</th><th>Collected</th><th>Progress</th><th>Owner</th><th></th></tr></thead><tbody>
            ${fundraisers.map(f => {
                const lead = leads.find(l => l.id === f.leadId);
                const progress = f.target > 0 ? (((f.collected || 0) / f.target) * 100).toFixed(0) : 0;
                return `<tr><td><a href="#fundraiser_detail?id=${f.id}">${f.title}</a></td><td>${lead ? `<a href="#lead_detail?id=${lead.id}">${lead.name}</a>` : 'N/A'}</td><td>${formatCurrency(f.target)}</td><td>${formatCurrency(f.collected)}</td><td><div class="progress-bar-container"><div class="progress-bar" style="width: ${progress}%"></div></div> ${progress}%</td><td>${f.owner}</td><td><a href="#fundraiser_create?fundId=${f.id}" class="btn small">Edit</a></td></tr>`
            }).join('')}</tbody></table>`;
        });
    }
    
    function renderPaymentsList() {
        mainContent.innerHTML = `<div class="page-header"><h1>Payments</h1></div><div id="table-container"></div>`;
        let query = db.collection('payments');
        if (AppState.userDetails.role !== 'admin') {
            query = query.where('recordedBy', '==', AppState.userDetails.email);
        }
        query.orderBy('date', 'desc').onSnapshot(async snapshot => {
            if (snapshot.empty) { mainContent.querySelector('#table-container').innerHTML = `<div class="card"><p>No payments found.</p></div>`; return; }
            const payments = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
            mainContent.querySelector('#table-container').innerHTML = `<table><thead><tr><th>Donor</th><th>Amount</th><th>Method</th><th>Date</th><th>Recorded By</th></tr></thead><tbody>
            ${payments.map(p => `<tr><td>${p.donor}</td><td>${formatCurrency(p.amount)}</td><td>${p.method}</td><td>${formatDate(p.date)}</td><td>${p.recordedBy}</td></tr>`).join('')}
            </tbody></table>`;
        });
    }

    function renderCallsList() {
        mainContent.innerHTML = `<div class="page-header"><h1>Calls & Activities</h1></div><div id="table-container"></div>`;
        let query = db.collection('calls');
        if (AppState.userDetails.role !== 'admin') query = query.where('by', '==', AppState.userDetails.email);
        query.orderBy('when', 'desc').onSnapshot(snapshot => {
            if (snapshot.empty) { mainContent.querySelector('#table-container').innerHTML = `<div class="card"><p>No activities found.</p></div>`; return; }
            const calls = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
            mainContent.querySelector('#table-container').innerHTML = `<table><thead><tr><th>Lead</th><th>Result</th><th>Note</th><th>Executive</th><th>Date</th></tr></thead><tbody>
            ${calls.map(c => `<tr><td><a href="#lead_detail?id=${c.leadId}">${c.leadName}</a></td><td><span class="status-badge ${c.result.toLowerCase().replace(' ','')}">${c.result}</span></td><td>${c.note}</td><td>${c.by}</td><td>${formatDate(c.when)}</td></tr>`).join('')}
            </tbody></table>`;
        });
    }
    
    async function renderFundraiserDetail(id){
        mainContent.innerHTML = `<div class="card"><p>Loading fundraiser details...</p></div>`;
        const fundDoc = await db.collection('fundraisers').doc(id).get();
        if(!fundDoc.exists){ mainContent.innerHTML = `<h1>Fundraiser not found</h1>`; return; }
        const fundraiser = {id: fundDoc.id, ...fundDoc.data()};
        const leadDoc = await db.collection('leads').doc(fundraiser.leadId).get();
        const lead = leadDoc.exists ? leadDoc.data() : {};
        mainContent.innerHTML = `<div class="page-header"><div><h1>${fundraiser.title}</h1><p class="muted">Lead: <a href="#lead_detail?id=${fundraiser.leadId}">${lead.name || 'N/A'}</a></p></div><div><a href="#fundraiser_create?fundId=${id}" class="btn">Edit</a><a href="#lead_detail?id=${fundraiser.leadId}" class="btn ghost">Back to Lead</a></div></div>
        <div class="card"><h2>Banner image would appear here</h2></div>
        <div class="detail-grid">
            <div class="card"><h3>Fundraiser Details</h3><p><strong>URL:</strong> ${fundraiser.url || 'N/A'}</p><p><strong>Razorpay ID:</strong> ${fundraiser.razorpayPageId || 'N/A'}</p></div>
            <div class="card"><h3>Financial Information</h3><p><strong>Target:</strong> ${formatCurrency(fundraiser.target)}</p><p><strong>Collected:</strong> ${formatCurrency(fundraiser.collected)}</p></div>
        </div>
        <div class="card" id="payments-for-fundraiser"><h3>Recent Payments</h3></div>`;
        db.collection('payments').where('fundId', '==', id).orderBy('date', 'desc').onSnapshot(snap => {
            const payments = snap.docs.map(d => d.data());
            document.getElementById('payments-for-fundraiser').innerHTML += `<table><thead><tr><th>Donor</th><th>Amount</th><th>Date</th></tr></thead><tbody>
            ${payments.map(p => `<tr><td>${p.donor}</td><td>${formatCurrency(p.amount)}</td><td>${formatDate(p.date)}</td></tr>`).join('')}</tbody></table>`
        });
    }

    async function renderAdminPanel() {
        if (AppState.userDetails.role !== 'admin') { window.location.hash = '#dashboard'; return; }
        mainContent.innerHTML = `<div class="page-header"><h1>Admin Panel</h1></div><div class="detail-grid">
            <div class="card" id="users-card"></div><div class="card" id="campaigns-card"></div></div>`;
        
        db.collection('users').onSnapshot(snapshot => {
            const users = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
            document.getElementById('users-card').innerHTML = `<h3>Manage Users</h3><form id="add-user-form" style="margin-bottom:20px"><div class="form-grid"><input id="new-name" placeholder="Name" required><input id="new-email" type="email" placeholder="Email" required><input id="new-password" type="password" placeholder="Set Password" required><select id="new-role"><option value="executive">Executive</option><option value="admin">Admin</option></select></div><button type="submit" class="btn" style="margin-top:16px">Create User</button></form>
            <table><thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead><tbody>
            ${users.map(u => `<tr><td>${u.name}</td><td>${u.email}</td><td>${u.role}</td></tr>`).join('')}</tbody></table>`;
            document.getElementById('add-user-form').addEventListener('submit', async e => {
                e.preventDefault();
                const [name, email, password, role] = [document.getElementById('new-name').value, document.getElementById('new-email').value, document.getElementById('new-password').value, document.getElementById('new-role').value];
                alert("This feature will create a new user in both the authentication system and the database. Please inform the user of their password.");
                try {
                    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                    await db.collection('users').doc(userCredential.user.uid).set({ name, email, role });
                    document.getElementById('add-user-form').reset();
                    alert('User created successfully!');
                } catch(error){ alert(`Error: ${error.message}`); }
            });
        });
        
        db.collection('campaigns').onSnapshot(snapshot => {
            const campaigns = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
            document.getElementById('campaigns-card').innerHTML = `<h3>Manage Campaigns</h3><form id="campaign-form"><label>Campaign Name</label><input id="campaign-name" required><button type="submit" class="btn" style="margin-top:8px">Add Campaign</button></form>
            <div style="margin-top:20px">${campaigns.map(c => `<div class="list-item">${c.product}</div>`).join('')}</div>`;
            document.getElementById('campaign-form').addEventListener('submit', async e => {
                e.preventDefault();
                await db.collection('campaigns').add({ product: document.getElementById('campaign-name').value, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
                document.getElementById('campaign-form').reset();
            });
        });
    }

    // --- EVENT LISTENERS ---
    loginForm.addEventListener('submit', handleLoginSubmit);
    logoutBtn.addEventListener('click', logout);
}
