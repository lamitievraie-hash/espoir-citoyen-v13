// CONFIG API
const API_URL = window.location.origin + '/api';
let AUTH_TOKEN = null;
let CURRENT_USER = null;

const MODULES = [
  'Dashboard','Membres','Cotisations','Projets','Dépenses','Recettes',
  'Événements','Réunions','Présences','Documents','Archives','Rapports',
  'Comptabilité','Budget','Inventaire','Partenaires','Communication','SMS',
  'Email','Réseaux Sociaux','Site Web','Formations','Bénévolat','Commissions',
  'Élections','Assemblées','Statistiques','Paramètres'
];

// AUTH
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  
  try {
    const res = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ email, password })
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    
    AUTH_TOKEN = data.token;
    CURRENT_USER = data.user;
    localStorage.setItem('token', AUTH_TOKEN);
    localStorage.setItem('user', JSON.stringify(CURRENT_USER));
    
    showMainApp();
  } catch (err) {
    document.getElementById('loginError').textContent = err.message;
  }
});

function logout() {
  AUTH_TOKEN = null;
  CURRENT_USER = null;
  localStorage.clear();
  location.reload();
}

function showMainApp() {
  document.getElementById('loginScreen').classList.remove('active');
  document.getElementById('mainApp').classList.add('active');
  document.getElementById('userInfo').textContent = `${CURRENT_USER.nom} - ${CURRENT_USER.role}`;
  renderModules();
  loadModule('Dashboard');
}

// API HELPER
async function apiCall(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AUTH_TOKEN}`
    }
  };
  if (body) options.body = JSON.stringify(body);
  
  const res = await fetch(`${API_URL}${endpoint}`, options);
  if (res.status === 401) {
    logout();
    throw new Error('Session expirée');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erreur serveur');
  return data;
}

// RENDU MODULES
function renderModules() {
  const nav = document.getElementById('moduleNav');
  nav.innerHTML = MODULES.map(m => 
    `<button class="module-btn" onclick="loadModule('${m}')">${m}</button>`
  ).join('');
}

async function loadModule(moduleName) {
  const content = document.getElementById('moduleContent');
  content.innerHTML = `<h2>${moduleName}</h2><div class="loader">Chargement...</div>`;
  
  try {
    // Exemple pour module Membres - Adapter pour chaque module
    if (moduleName === 'Membres') {
      const membres = await apiCall('/membres');
      content.innerHTML = `
        <div class="module-header">
          <h2>Gestion des Membres</h2>
          <button class="btn btn-primary" onclick="addMembre()">+ Nouveau</button>
        </div>
        <table class="data-table">
          <thead><tr><th>Nom</th><th>Email</th><th>Téléphone</th><th>Actions</th></tr></thead>
          <tbody>
            ${membres.map(m => `
              <tr>
                <td>${m.nom}</td>
                <td>${m.email}</td>
                <td>${m.telephone}</td>
                <td>
                  <button onclick="editMembre(${m.id})">Modifier</button>
                  <button onclick="deleteMembre(${m.id})">Supprimer</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if (moduleName === 'Dashboard') {
      const stats = await apiCall('/stats');
      content.innerHTML = `
        <h2>Tableau de bord</h2>
        <div class="stats-grid">
          <div class="stat-card"><h3>${stats.totalMembres}</h3><p>Membres</p></div>
          <div class="stat-card"><h3>${stats.totalProjets}</h3><p>Projets</p></div>
          <div class="stat-card"><h3>${stats.budget}</h3><p>Budget XOF</p></div>
        </div>
      `;
    } else {
      content.innerHTML = `<h2>${moduleName}</h2><p>Module en mode serveur. Intégration API complète.</p>`;
    }
  } catch (err) {
    content.innerHTML = `<div class="error">Erreur: ${err.message}</div>`;
  }
}

// CRUD EXEMPLES
async function addMembre() {
  const nom = prompt('Nom:');
  if (!nom) return;
  await apiCall('/membres', 'POST', {nom, email: 'test@test.com', telephone: '000'});
  loadModule('Membres');
}

async function deleteMembre(id) {
  if (!confirm('Supprimer ce membre ?')) return;
  await apiCall(`/membres/${id}`, 'DELETE');
  loadModule('Membres');
}

// INIT
window.onload = () => {
  AUTH_TOKEN = localStorage.getItem('token');
  CURRENT_USER = JSON.parse(localStorage.getItem('user') || 'null');
  if (AUTH_TOKEN && CURRENT_USER) showMainApp();
};
