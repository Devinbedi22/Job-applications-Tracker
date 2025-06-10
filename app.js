const BASE_URL = 'http://localhost:5500/api/applications';
const LOGIN_URL = 'http://localhost:5500/api/login';
const SIGNUP_URL = 'http://localhost:5500/api/register';
const EXTERNAL_JOBS_URL = 'http://localhost:5500/api/external-jobs';

let token = localStorage.getItem('token');

const loginSection = document.getElementById('login-section');
const signupSection = document.getElementById('signup-section');
const appSection = document.getElementById('app-section');
const form = document.getElementById('application-form');
const applicationsList = document.getElementById('applications-list');
const externalJobsList = document.getElementById('external-jobs-list');

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('login-btn').addEventListener('click', login);
  document.getElementById('signup-btn').addEventListener('click', signup);
  document.getElementById('show-signup').addEventListener('click', () => toggleAuthMode(false));
  document.getElementById('show-login').addEventListener('click', () => toggleAuthMode(true));

  // Autofill today’s date
  const dateInput = document.getElementById('dateApplied');
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

  if (token) {
    showApp();
    fetchApplications();
  }
});

function toggleAuthMode(showLogin) {
  loginSection.style.display = showLogin ? 'block' : 'none';
  signupSection.style.display = showLogin ? 'none' : 'block';
}

async function login() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  try {
    const res = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (res.ok) {
      token = data.token;
      localStorage.setItem('token', token);
      showApp();
      fetchApplications();
    } else {
      alert(data.message || data.error || 'Login failed');
    }
  } catch (err) {
    console.error('Login error:', err);
    alert('Login failed. Check your server connection.');
  }
}

async function signup() {
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;

  try {
    const res = await fetch(SIGNUP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (res.ok) {
      alert('Signup successful! Please login.');
      toggleAuthMode(true);
    } else {
      alert(data.message || data.error || 'Signup failed');
    }
  } catch (err) {
    console.error('Signup error:', err);
    alert('Signup failed. Check your server connection.');
  }
}

function showApp() {
  loginSection.style.display = 'none';
  signupSection.style.display = 'none';
  appSection.style.display = 'block';
}

function logout() {
  localStorage.removeItem('token');
  token = null;
  loginSection.style.display = 'block';
  signupSection.style.display = 'none';
  appSection.style.display = 'none';
}

async function fetchApplications() {
  try {
    const res = await fetch(BASE_URL, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (res.status === 401) {
      logout();
      alert('Session expired. Please login again.');
      return;
    }

    const data = await res.json();
    if (!Array.isArray(data)) {
      throw new Error('Expected array but got: ' + typeof data);
    }

    renderApplications(data);
  } catch (err) {
    console.error('Fetch applications error:', err);
    alert('Error fetching applications.');
  }
}

function renderApplications(applications) {
  applicationsList.innerHTML = '';
  applications.forEach(app => {
    const date = new Date(app.dateApplied);
    const dateStr = isNaN(date.getTime()) ? 'Invalid Date' : date.toDateString();

    const div = document.createElement('div');
    div.className = 'job-card'; // new class instead of .card
    div.innerHTML = `
    <h3>${app.jobTitle} <span style="font-weight: normal;">@ ${app.company}</span></h3>
    <p><strong>📍 Location:</strong> ${app.location}</p>
    <p><strong>📅 Date:</strong> ${dateStr}</p>
    <p><strong>📌 Status:</strong> ${app.status}</p>
    ${app.notes ? `<p><strong>📝 Notes:</strong> ${app.notes}</p>` : ''}
    `;

    applicationsList.appendChild(div);
  });
}

function filterApplications() {
  const title = document.getElementById('filterTitle').value.toLowerCase();
  const company = document.getElementById('filterCompany').value.toLowerCase();
  const status = document.getElementById('filterStatus').value;

  const cards = document.querySelectorAll('#applications-list .job-card');
  cards.forEach(card => {
    const text = card.innerText.toLowerCase();
    const show =
      (!title || text.includes(title)) &&
      (!company || text.includes(company)) &&
      (!status || text.includes(status.toLowerCase()));
    card.style.display = show ? 'block' : 'none';
  });
}

function resetFilters() {
  document.getElementById('filterTitle').value = '';
  document.getElementById('filterCompany').value = '';
  document.getElementById('filterStatus').value = '';
  filterApplications();
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const newApp = {
    jobTitle: document.getElementById('jobTitle').value,
    company: document.getElementById('company').value,
    location: document.getElementById('location').value,
    status: document.getElementById('status').value,
    notes: document.getElementById('notes').value
  };

  const dateInput = document.getElementById('dateApplied').value;
  const parsedDate = new Date(dateInput);

  if (!dateInput || isNaN(parsedDate.getTime())) {
    alert('Please enter a valid application date.');
    return;
  }

  newApp.dateApplied = parsedDate.toISOString();

  try {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(newApp)
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || errorData.error || 'Failed to add application');
    }

    await fetchApplications();
    form.reset();
    document.getElementById('dateApplied').value = new Date().toISOString().split('T')[0];
  } catch (err) {
    console.error(err);
    alert('Error adding application: ' + err.message);
  }
});

async function fetchExternalJobs() {
  const query = document.getElementById('searchQuery').value.trim();
  if (!query) {
    alert('Please enter a search query.');
    return;
  }

  externalJobsList.innerHTML = '<p>Searching jobs...</p>';

  try {
    const res = await fetch(`${EXTERNAL_JOBS_URL}?query=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (!Array.isArray(data)) {
      throw new Error('Invalid response from external jobs API');
    }

    if (data.length === 0) {
      externalJobsList.innerHTML = '<p>No jobs found for that query.</p>';
      return;
    }

    externalJobsList.innerHTML = '';
    data.slice(0, 10).forEach(job => {
      const jobCard = document.createElement('div');
      jobCard.className = 'card';
      jobCard.innerHTML = `
        <h3>${job.job_title} <span style="font-weight: normal;">@ ${job.employer_name}</span></h3>
        <p><strong>📍 Location:</strong> ${job.job_city || 'N/A'}, ${job.job_country || ''}</p>
        <p><strong>💼 Type:</strong> ${job.job_employment_type || 'N/A'}</p>
        <p><strong>🔗 Link:</strong> <a href="${job.job_apply_link}" target="_blank">Apply Here</a></p>
      `;
      externalJobsList.appendChild(jobCard);
    });
  } catch (err) {
    console.error('Error fetching external jobs:', err);
    externalJobsList.innerHTML = '<p style="color:red;">Failed to fetch jobs.</p>';
  }
}
