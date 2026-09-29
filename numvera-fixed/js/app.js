/* Numvera Naija — production client */
const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s ?? '').replace(/[&<>'"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])
  );
const uid = () => crypto.randomUUID();
const localKey = 'numvera_plans_v6';
const activityKey = 'numvera_activity_v6';
const reminderKey = 'numvera_reminders_v6';
const themeKey = 'numvera_theme_v1';
const money = (n) => `₦${Number(n || 0).toLocaleString()}`;
const today = () => new Date();
const isoDate = (d) => new Date(d).toISOString().slice(0, 10);

let sb = null;
let user = null;
let plans = [];
let active = null;
let realtimeChannel = null;
let currentView = 'today';
let cloudReady = false;

const scenarios = [
  ['Home and Life', 'Moving house'],
  ['Home and Life', 'Renovate a home'],
  ['Home and Life', 'Set up a new apartment'],
  ['Home and Life', 'Buy furniture'],
  ['Home and Life', 'Send belongings to another city'],
  ['Home and Life', 'Plan a house cleaning'],
  ['Events', 'Plan a wedding'],
  ['Events', 'Plan a birthday'],
  ['Events', 'Plan a naming ceremony'],
  ['Events', 'Plan a traditional introduction'],
  ['Events', 'Plan a funeral and family arrangements'],
  ['Events', 'Plan an anniversary'],
  ['Events', 'Plan a graduation'],
  ['Events', 'Plan a proposal'],
  ['Events', 'Plan a family gathering'],
  ['Events', 'Plan a church event'],
  ['Travel', 'Plan a trip'],
  ['Travel', 'Relocate to another city'],
  ['Travel', 'Prepare for a flight'],
  ['Travel', 'Plan a group vacation'],
  ['Travel', 'Plan a road trip'],
  ['Travel', 'Send belongings to another city'],
  ['Education', 'Prepare for exams'],
  ['Education', 'School admission'],
  ['Education', 'University preparation'],
  ['Education', 'Scholarship application'],
  ['Education', 'Certification exam'],
  ['Education', 'School project'],
  ['Career', 'Job search'],
  ['Career', 'Job application batch'],
  ['Career', 'Prepare for interview'],
  ['Career', 'Build a portfolio'],
  ['Career', 'Start a new job'],
  ['Career', 'Career certification'],
  ['Money', 'Group contribution'],
  ['Money', 'Split shared expenses'],
  ['Money', 'Savings goal'],
  ['Money', 'Debt repayment plan'],
  ['Money', 'Plan a major purchase'],
  ['Money', 'Monthly family budget'],
  ['Purchases', 'Buy a used car'],
  ['Purchases', 'Buy a laptop or phone'],
  ['Purchases', 'Move into a new rental'],
  ['Purchases', 'Buy home appliances'],
  ['Health and Care', 'Organise a hospital visit'],
  ['Health and Care', 'Support a family member'],
  ['Health and Care', 'Prepare for a new baby'],
  ['Health and Care', 'Plan a care schedule'],
  ['Documents', 'Apply for official documents'],
  ['Documents', 'Handle an official process'],
  ['Documents', 'Prepare travel documents'],
  ['Documents', 'Prepare a visa application'],
  ['Business', 'Prepare for a market day'],
  ['Business', 'Run a pop up event'],
  ['Business', 'Deliver a client project'],
  ['Business', 'Launch a small side hustle'],
  ['Business', 'Prepare a product order'],
  ['Business', 'Prepare a client meeting'],
  ['Business', 'Plan a business trip'],
  ['Personal', 'Prepare a personal milestone'],
  ['Personal', 'Plan a surprise'],
  ['Personal', 'Organise a gift'],
  ['Personal', 'Plan a move out'],
  ['Personal', 'Start a personal project'],
  ['Personal', 'Custom plan'],
];

/* ---------- local helpers ---------- */
function localPlans() {
  try {
    return JSON.parse(localStorage.getItem(localKey) || '[]');
  } catch {
    return [];
  }
}

function saveLocal() {
  localStorage.setItem(localKey, JSON.stringify(plans));
}

function activityLog() {
  try {
    return JSON.parse(localStorage.getItem(activityKey) || '[]');
  } catch {
    return [];
  }
}

function logActivity(text, workspaceId = null) {
  const a = activityLog();
  a.unshift({
    id: uid(),
    text,
    workspace_id: workspaceId,
    at: new Date().toISOString(),
  });
  localStorage.setItem(activityKey, JSON.stringify(a.slice(0, 150)));
}

function setSyncState(text, kind = '') {
  const el = $('syncState');
  if (!el) return;
  el.textContent = text;
  el.className = 'syncState' + (kind ? ' ' + kind : '');
}

function modal(html) {
  $('modalContent').innerHTML = html;
  $('modal').classList.remove('hidden');
}

function close() {
  $('modal').classList.add('hidden');
}

$('closeModal').onclick = close;
$('modal').addEventListener('click', (e) => {
  if (e.target.id === 'modal') close();
});

/* ---------- theme ---------- */
function preferredTheme() {
  return (
    localStorage.getItem(themeKey) ||
    (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light')
  );
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const dark = theme === 'dark';
  $('themeBtn').textContent = dark ? 'Day' : 'Night';
  localStorage.setItem(themeKey, theme);
}

function toggleTheme() {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
}

$('themeBtn').onclick = toggleTheme;
applyTheme(preferredTheme());

/* ---------- views ---------- */
function switchView(v) {
  currentView = v;
  document.querySelectorAll('.view').forEach((x) => x.classList.add('hidden'));
  const map = {
    today: 'todayView',
    workspaces: 'workspacesView',
    tasks: 'tasksView',
    activity: 'activityView',
  };
  $(map[v])?.classList.remove('hidden');
  document.querySelectorAll('.tab, .mobileNavButton').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === v);
  });
}

document.querySelectorAll('.tab, .mobileNavButton').forEach((btn) => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

/* ---------- filter categories ---------- */
scenarios.forEach(([c]) => {
  if (!$('filter').querySelector(`option[value="${c}"]`)) {
    const o = document.createElement('option');
    o.value = c;
    o.textContent = c;
    $('filter').append(o);
  }
});

$('search')?.addEventListener('input', render);
$('filter')?.addEventListener('change', render);

/* ---------- auth ---------- */
function renderAuth() {
  $('authBtn').textContent = user ? 'Sign out' : 'Sign in';
  $('authPanel').classList.toggle('hidden', !!user);
}

async function doSignIn(e) {
  e.preventDefault();
  const email = $('email').value.trim();
  const password = $('password').value;
  if (!sb) {
    $('authMsg').textContent =
      'Cloud connection is not ready. Check that Supabase environment variables are set on Vercel.';
    return;
  }
  if (!email || !password) {
    $('authMsg').textContent = 'Enter your email and password.';
    return;
  }
  $('authMsg').textContent = 'Signing in…';
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    console.error('signIn error', error);
    $('authMsg').textContent =
      error.message === 'Invalid login credentials'
        ? 'We could not sign you in. Please check your email and password.'
        : error.message;
    return;
  }
  user = data.user;
  $('authMsg').textContent = '';
  renderAuth();
  await load();
}

async function doCreateAccount() {
  const email = $('email').value.trim();
  const password = $('password').value;
  if (!sb) {
    $('authMsg').textContent =
      'Cloud connection is not ready. Check that Supabase environment variables are set on Vercel.';
    return;
  }
  if (!email || !password) {
    $('authMsg').textContent = 'Enter your email and password to create an account.';
    return;
  }
  if (password.length < 6) {
    $('authMsg').textContent = 'Password must be at least 6 characters.';
    return;
  }
  $('authMsg').textContent = 'Creating account…';
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) {
    console.error('signUp error', error);
    $('authMsg').textContent = error.message;
    return;
  }
  if (data.session) {
    user = data.user;
    $('authMsg').textContent = 'Account created. You are signed in.';
    renderAuth();
    await load();
  } else {
    $('authMsg').textContent =
      'Your account was created, but email confirmation is required before you can continue. Check your inbox.';
  }
}

$('authForm').addEventListener('submit', doSignIn);
$('createAccountBtn').addEventListener('click', doCreateAccount);
$('authBtn').onclick = async () => {
  if (user && sb) {
    await sb.auth.signOut();
    user = null;
    plans = localPlans();
    setSyncState('Signed out', 'offline');
    renderAuth();
    render();
  } else {
    $('authPanel').classList.toggle('hidden');
  }
};

/* ---------- cloud init ---------- */
async function init() {
  let runtimeUrl = window.NUMVERA_CONFIG?.url || localStorage.getItem('numvera_supabase_url') || '';
  let runtimeKey =
    window.NUMVERA_CONFIG?.anonKey || localStorage.getItem('numvera_supabase_anon_key') || '';

  if (!runtimeUrl || !runtimeKey) {
    try {
      const r = await fetch('/api/config', { headers: { accept: 'application/json' } });
      if (r.ok) {
        const c = await r.json();
        runtimeUrl = c.supabaseUrl || '';
        runtimeKey = c.supabaseAnonKey || '';
        cloudReady = !!c.configured;
      } else {
        console.error('config endpoint status', r.status);
      }
    } catch (e) {
      console.error('config fetch failed', e);
    }
  } else {
    cloudReady = true;
  }

  if (runtimeUrl && runtimeKey && window.supabase) {
    sb = window.supabase.createClient(runtimeUrl, runtimeKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    const { data } = await sb.auth.getSession();
    user = data.session?.user || null;
    sb.auth.onAuthStateChange((_event, session) => {
      user = session?.user || null;
      renderAuth();
      load();
    });
    setSyncState(user ? 'Synced' : 'Ready to sign in', user ? 'synced' : '');
  } else {
    plans = localPlans();
    setSyncState('Offline — changes will sync when you reconnect', 'offline');
  }

  renderAuth();
  await load();
  loadReminders();
}

async function load() {
  if (!sb || !user) {
    plans = localPlans();
    render();
    return;
  }

  setSyncState('Syncing…');
  const { data, error } = await sb
    .from('workspaces')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('load workspaces error', error);
    plans = localPlans();
    const code = error.code || '';
    const msg = (error.message || '').toLowerCase();
    if (code === '42P01' || msg.includes('does not exist') || msg.includes('relation')) {
      setSyncState('Database not ready — run schema.sql in Supabase', 'error');
    } else if (code === '42501' || msg.includes('permission') || msg.includes('policy') || msg.includes('rls')) {
      setSyncState('Access blocked — check Row Level Security policies', 'error');
    } else if (msg.includes('jwt') || msg.includes('session') || code === 'PGRST301') {
      setSyncState('Session issue — sign out and sign in again', 'error');
    } else {
      setSyncState('Could not reach cloud data — check browser console', 'error');
    }
  } else {
    plans = data || [];
    saveLocal();
    setSyncState('Synced', 'synced');
  }
  render();

  if (realtimeChannel) {
    sb.removeChannel(realtimeChannel);
  }
  realtimeChannel = sb
    .channel('numvera-workspaces')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'workspaces' },
      () => load()
    )
    .subscribe();
}

/* ---------- persist ---------- */
function workspacePayload(plan) {
  return {
    id: plan.id,
    title: plan.title,
    description: plan.description || null,
    category: plan.category || null,
    target_date: plan.target_date || null,
    location: plan.location || null,
    status: plan.status || 'Active',
    priority: plan.priority || 'Normal',
    budget: Number(plan.budget || 0),
    tasks: plan.tasks || [],
    members: plan.members || [],
    files: plan.files || [],
    expenses: plan.expenses || [],
    contributions: plan.contributions || [],
    comments: plan.comments || [],
    created_by: plan.created_by || user?.id || null,
    updated_at: new Date().toISOString(),
  };
}

async function persist(plan = active) {
  saveLocal();
  if (!sb || !user || !plan) return { ok: true, local: true };

  const payload = workspacePayload(plan);
  const { data, error } = await sb.from('workspaces').upsert(payload).select().single();

  if (error) {
    console.error('persist error', error);
    setSyncState('Could not sync — saved on this device', 'error');
    return { ok: false, error };
  }

  // Ensure owner membership row exists (supports collaboration RLS)
  try {
    await sb.from('workspace_members').upsert(
      {
        workspace_id: plan.id,
        user_id: user.id,
        email: user.email,
        role: 'owner',
      },
      { onConflict: 'workspace_id,user_id' }
    );
  } catch (e) {
    console.warn('member upsert skipped', e);
  }

  if (data) {
    const idx = plans.findIndex((p) => p.id === plan.id);
    if (idx >= 0) plans[idx] = { ...plans[idx], ...data };
    if (active?.id === plan.id) active = plans[idx] ?? { ...active, ...data };
  }

  setSyncState('Synced', 'synced');
  return { ok: true, data };
}

/* ---------- planning helpers ---------- */
function allTasks() {
  return plans.flatMap((p) => (p.tasks || []).map((t) => ({ ...t, workspace: p })));
}

function dueSoon(t) {
  if (!t.due || t.done) return false;
  const d = new Date(t.due);
  const n = Date.now();
  return d - n <= 604800000 && d - n > -86400000;
}

function priorityRank(p) {
  return p === 'High' ? 3 : p === 'Normal' ? 2 : 1;
}

function smartNext(p) {
  const open = (p.tasks || []).filter((t) => !t.done);
  if (!open.length) return 'Everything is complete';
  const overdue = open.filter((t) => t.due && new Date(t.due) < today());
  if (overdue.length) {
    return overdue.sort(
      (a, b) => priorityRank(b.priority) - priorityRank(a.priority)
    )[0].title;
  }
  const dated = open
    .filter((t) => t.due)
    .sort((a, b) => new Date(a.due) - new Date(b.due));
  if (dated.length) return dated[0].title;
  const high = open.filter((t) => t.priority === 'High');
  return (high[0] || open[0]).title;
}

function smartPlan(text) {
  const s = text.toLowerCase();
  let category = 'Personal';
  let scenario = 'Custom plan';
  for (const [c, n] of scenarios) {
    const needle = n
      .toLowerCase()
      .replace('plan a ', '')
      .replace('plan ', '')
      .replace('prepare for ', '')
      .replace('organise ', '')
      .replace('organize ', '');
    if (s.includes(needle)) {
      category = c;
      scenario = n;
      break;
    }
  }
  if (s.includes('wedding')) {
    category = 'Events';
    scenario = 'Plan a wedding';
  } else if (s.includes('birthday')) {
    category = 'Events';
    scenario = 'Plan a birthday';
  } else if (s.includes('move') || s.includes('relocat')) {
    category = 'Home and Life';
    scenario = 'Moving house';
  } else if (s.includes('trip') || s.includes('travel') || s.includes('flight')) {
    category = 'Travel';
    scenario = 'Plan a trip';
  } else if (s.includes('exam') || s.includes('school') || s.includes('university')) {
    category = 'Education';
    scenario = 'Prepare for exams';
  } else if (s.includes('job') || s.includes('interview')) {
    category = 'Career';
    scenario = 'Job search';
  } else if (s.includes('contribution') || s.includes('save') || s.includes('debt')) {
    category = 'Money';
    scenario = 'Group contribution';
  }

  const title = text.trim().replace(/\.$/, '') || scenario;
  const target = (s.match(/(?:by|on|before)\s+(\d{4}[\-/]\d{1,2}[\-/]\d{1,2})/) || [])[1] || '';

  const taskMap = {
    'Plan a wedding': [
      'Set the date',
      'Choose venue',
      'Set the budget',
      'List guests',
      'Choose vendors',
      'Plan outfits',
      'Send invitations',
      'Track contributions',
      'Confirm final details',
    ],
    'Plan a birthday': [
      'Set the date',
      'Choose venue',
      'Set the budget',
      'Prepare guest list',
      'Plan food and drinks',
      'Arrange decoration',
      'Send invitations',
      'Confirm final details',
    ],
    'Moving house': [
      'Confirm new place',
      'Set moving date',
      'List belongings',
      'Arrange transport',
      'Pack and label boxes',
      'Handle utilities and address updates',
      'Move and check everything',
    ],
    'Plan a trip': [
      'Choose destination',
      'Set travel dates',
      'Set the budget',
      'Arrange transport',
      'Book accommodation',
      'Prepare documents',
      'Pack essentials',
      'Confirm final details',
    ],
    'Prepare for exams': [
      'List subjects',
      'Collect study materials',
      'Create study schedule',
      'Set practice sessions',
      'Review weak areas',
      'Prepare exam day items',
    ],
    'Job search': [
      'Update CV',
      'Prepare portfolio',
      'List target roles',
      'Submit applications',
      'Track applications',
      'Prepare for interviews',
      'Follow up',
    ],
    'Group contribution': [
      'Define target amount',
      'List contributors',
      'Set contribution dates',
      'Record payments',
      'Follow up on pending payments',
      'Confirm total',
    ],
    'Custom plan': [
      'Define the outcome',
      'List the people involved',
      'List important things',
      'Set important dates',
      'Set the budget if needed',
      'Assign responsibilities',
      'Track progress',
    ],
  };

  const tasks = taskMap[scenario] || taskMap['Custom plan'];
  return { title, category, scenario, tasks, target: target || null };
}

/* ---------- render ---------- */
function card(p) {
  const ts = p.tasks || [];
  const done = ts.filter((t) => t.done).length;
  const pc = ts.length ? Math.round((done / ts.length) * 100) : 0;
  return `<article class="card">
    <span class="eyebrow">${esc(p.category || 'Plan')}</span>
    <h3>${esc(p.title)}</h3>
    <p>${esc(p.description || '')}</p>
    <div class="progress"><i style="width:${pc}%"></i></div>
    <small class="muted">${pc}% complete · Next: ${esc(smartNext(p))}</small>
    <div class="meta">
      <span class="tag">${esc(p.status || 'Active')}</span>
      <span class="tag">${esc(p.priority || 'Normal')}</span>
      <span class="tag">${p.target_date ? new Date(p.target_date).toLocaleDateString() : 'No date'}</span>
    </div>
    <div class="cardActions">
      <button type="button" class="btn" onclick="openPlan('${p.id}')">Open</button>
      <button type="button" class="btn dangerOutline" onclick="event.stopPropagation();deleteWorkspace('${p.id}')">Delete</button>
    </div>
  </article>`;
}

function renderActivity() {
  const a = activityLog();
  $('activityList').innerHTML =
    a
      .slice(0, 50)
      .map(
        (x) =>
          `<div class="row"><span>${esc(x.text)}</span><small class="muted">${new Date(x.at).toLocaleString()}</small></div>`
      )
      .join('') || '<div class="empty">No activity yet.</div>';
}

function render() {
  const q = ($('search')?.value || '').toLowerCase();
  const cat = $('filter')?.value || 'all';
  const view = plans.filter(
    (p) =>
      (!q ||
        (p.title + ' ' + (p.description || '') + ' ' + (p.location || ''))
          .toLowerCase()
          .includes(q)) &&
      (cat === 'all' || p.category === cat)
  );

  $('plans').innerHTML =
    view.map(card).join('') ||
    '<div class="empty full">No workspaces yet. Tell Numvera what you are trying to get done.</div>';

  const tasks = allTasks();
  const open = tasks.filter((t) => !t.done);
  $('planCount').textContent = plans.length;
  $('taskCount').textContent = open.length;
  $('memberCount').textContent = new Set(
    plans.flatMap((p) => (p.members || []).map((m) => m.email || m.user_id))
  ).size;
  $('dueCount').textContent = open.filter(dueSoon).length;

  const next = open
    .sort((a, b) => {
      const ad = a.due ? new Date(a.due).getTime() : Infinity;
      const bd = b.due ? new Date(b.due).getTime() : Infinity;
      return ad - bd || priorityRank(b.priority) - priorityRank(a.priority);
    })
    .slice(0, 7);

  $('nextList').innerHTML =
    next
      .map(
        (t) =>
          `<div class="row"><div class="rowMain"><input type="checkbox" onchange="quickToggle('${t.workspace.id}','${t.id}')"><span><b>${esc(t.title)}</b><small class="muted">${esc(t.workspace.title)} · ${t.due ? 'Due ' + new Date(t.due).toLocaleDateString() : 'No date'} · ${esc(t.priority || 'Normal')}</small></span></div><button class="btn small" onclick="openPlan('${t.workspace.id}')">Open</button></div>`
      )
      .join('') || '<div class="empty">You are clear for now.</div>';

  const expenses = plans.reduce(
    (n, p) => n + (p.expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0),
    0
  );
  const contrib = plans.reduce(
    (n, p) => n + (p.contributions || []).reduce((s, e) => s + Number(e.amount || 0), 0),
    0
  );
  $('moneySnapshot').innerHTML = `<div class="moneyGrid">
    <div class="moneyCard"><span>Expenses</span><b>${money(expenses)}</b></div>
    <div class="moneyCard"><span>Contributions</span><b>${money(contrib)}</b></div>
    <div class="moneyCard"><span>Workspaces</span><b>${plans.length}</b></div>
  </div>`;

  const myEmail = user?.email || '';
  const mine = open.filter(
    (t) => !t.assignee_email || t.assignee_email === myEmail || !myEmail
  );
  $('myTasks').innerHTML =
    mine
      .map(
        (t) =>
          `<div class="row"><div class="rowMain"><input type="checkbox" onchange="quickToggle('${t.workspace.id}','${t.id}')"><span><b>${esc(t.title)}</b><small class="muted">${esc(t.workspace.title)}</small></span></div><button class="btn small" onclick="openPlan('${t.workspace.id}')">Open</button></div>`
      )
      .join('') || '<div class="empty">No open tasks assigned to you.</div>';

  renderActivity();
}

/* ---------- create workspace ---------- */
async function saveNewWorkspace(plan) {
  plans.unshift(plan);
  active = plan;
  logActivity(`Created workspace “${plan.title}”`, plan.id);
  const result = await persist(plan);
  if (!result.ok && sb && user) {
    alert(
      'We could not create this workspace in the cloud. ' +
        (result.error?.message || 'Please try again.')
    );
  }
  close();
  render();
  openPlan(plan.id);
}

async function createPlanFromForm(e) {
  if (e.target.id !== 'planForm') return;
  e.preventDefault();
  const s = $('scenario').selectedOptions[0];
  const title = $('title').value.trim();
  if (!title) {
    alert('Please enter a workspace title.');
    return;
  }
  const p = {
    id: uid(),
    title,
    description: $('desc').value.trim(),
    category: s.dataset.cat,
    target_date: $('date').value || null,
    location: $('location').value.trim(),
    status: 'Active',
    priority: $('priority').value,
    budget: Number($('budget').value || 0),
    tasks: [
      {
        id: uid(),
        title: 'Define the first important step',
        done: false,
        due: $('date').value || null,
        priority: 'High',
        assignee_email: null,
      },
      {
        id: uid(),
        title: 'List the people involved',
        done: false,
        due: null,
        priority: 'Normal',
        assignee_email: null,
      },
      {
        id: uid(),
        title: 'Set the important date',
        done: false,
        due: $('date').value || null,
        priority: 'Normal',
        assignee_email: null,
      },
    ],
    members: user
      ? [{ user_id: user.id, email: user.email, role: 'owner' }]
      : [],
    files: [],
    expenses: [],
    contributions: [],
    comments: [],
    created_by: user?.id || null,
  };
  await saveNewWorkspace(p);
}

window.openManualCreate = () =>
  modal(`<h2>Create a workspace</h2>
    <form id="planForm">
      <div class="formgrid">
        <label>Situation
          <select id="scenario">${scenarios
            .map(
              (x) =>
                `<option value="${esc(x[1])}" data-cat="${esc(x[0])}">${esc(x[1])}</option>`
            )
            .join('')}
          </select>
        </label>
        <label>Title<input id="title" required placeholder="Your workspace name"></label>
        <label class="full">Description<textarea id="desc" rows="3" placeholder="What are you trying to get done?"></textarea></label>
        <label>Target date<input id="date" type="date"></label>
        <label>Location<input id="location" placeholder="Ilorin, Lagos or another place"></label>
        <label>Priority<select id="priority"><option>Normal</option><option>High</option><option>Low</option></select></label>
        <label>Budget in ₦<input id="budget" type="number" min="0" placeholder="Optional"></label>
      </div>
      <button type="submit" class="btn primary">Create workspace</button>
    </form>`);

$('modal').addEventListener('submit', createPlanFromForm);

function openSmartCreate() {
  modal(`<span class="eyebrow">SMART PLANNER</span>
    <h2>What are you trying to get done?</h2>
    <p class="muted">One sentence is enough. Numvera will set up the workspace and a starter to-do list.</p>
    <textarea id="smartText" rows="5" placeholder="I am moving from Ilorin to Lagos in November and need to organise the move."></textarea>
    <div class="suggestions">
      <button type="button" class="btn" onclick="fillSmart('I am planning my wedding for December and need to organise the venue, guests and payments.')">Wedding</button>
      <button type="button" class="btn" onclick="fillSmart('I am moving to a new apartment next month and need to organise everything.')">Moving</button>
      <button type="button" class="btn" onclick="fillSmart('I am planning a five day trip and need to arrange transport, accommodation and documents.')">Trip</button>
    </div>
    <button type="button" class="btn primary" onclick="previewSmart()">Build my plan</button>
    <p class="muted" style="margin-top:12px"><button type="button" class="btn ghost" onclick="openManualCreate()">Or create manually</button></p>`);
}

window.fillSmart = (t) => {
  const el = $('smartText');
  if (el) el.value = t;
};

window.previewSmart = () => {
  const text = $('smartText').value.trim();
  if (!text) return;
  const p = smartPlan(text);
  modal(`<span class="eyebrow">PLAN READY</span>
    <h2>${esc(p.title)}</h2>
    <p class="muted">Category: ${esc(p.category)} · Scenario: ${esc(p.scenario)}</p>
    <div class="list">${p.tasks
      .map(
        (t, i) =>
          `<div class="row"><span>${i + 1}. ${esc(t)}</span><small class="muted">Suggested</small></div>`
      )
      .join('')}</div>
    <p class="muted">Next action: ${esc(p.tasks[0])}</p>
    <button type="button" class="btn primary" onclick='createSmart(${JSON.stringify(p).replace(/</g, '\\u003c')})'>Create workspace</button>`);
};

window.createSmart = async (p) => {
  const plan = {
    id: uid(),
    title: p.title,
    description: `Smart plan for ${p.scenario}`,
    category: p.category,
    target_date: p.target || null,
    location: '',
    status: 'Active',
    priority: 'Normal',
    budget: 0,
    tasks: p.tasks.map((t, i) => ({
      id: uid(),
      title: t,
      done: false,
      due: i === 0 ? p.target || null : null,
      priority: i === 0 ? 'High' : 'Normal',
      assignee_email: null,
    })),
    members: user ? [{ user_id: user.id, email: user.email, role: 'owner' }] : [],
    files: [],
    expenses: [],
    contributions: [],
    comments: [],
    created_by: user?.id || null,
  };
  await saveNewWorkspace(plan);
};

$('newPlan').onclick = openSmartCreate;

/* ---------- workspace detail ---------- */
window.openPlan = async (id) => {
  active = plans.find((p) => p.id === id);
  if (!active) return;

  const members = active.members || [];
  const tasks = active.tasks || [];
  const openTasks = tasks.filter((t) => !t.done);
  const spent = (active.expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0);
  const contrib = (active.contributions || []).reduce(
    (s, e) => s + Number(e.amount || 0),
    0
  );

  modal(`<div class="wsHead">
      <span class="eyebrow">${esc(active.category || 'Workspace')}</span>
      <h2>${esc(active.title)}</h2>
      <p class="muted">${esc(active.description || 'No description yet.')}</p>
      <div class="meta">
        ${active.target_date ? `<span class="tag">Due ${new Date(active.target_date).toLocaleDateString()}</span>` : ''}
        ${active.location ? `<span class="tag">${esc(active.location)}</span>` : ''}
        <span class="tag">${esc(active.priority || 'Normal')} priority</span>
      </div>
    </div>

    <div class="nextBox">
      <span class="eyebrow">NEXT STEP</span>
      <b>${esc(smartNext(active))}</b>
      <small class="muted">${openTasks.length} open · ${tasks.length - openTasks.length} done</small>
    </div>

    <div class="wsSection">
      <div class="sectionHead"><h3>To-do</h3></div>
      <div class="list">${tasks.length ? tasks
        .map(
          (t) =>
            `<div class="row">
              <div class="rowMain">
                <input type="checkbox" ${t.done ? 'checked' : ''} onchange="toggleTask('${t.id}')">
                <span class="${t.done ? 'done' : ''}"><b>${esc(t.title)}</b>
                  <small class="muted">${t.due ? new Date(t.due).toLocaleDateString() : ''}${t.assignee_email ? ' · ' + esc(t.assignee_email) : ''}</small>
                </span>
              </div>
            </div>`
        )
        .join('') : '<p class="muted">No tasks yet.</p>'}</div>
      <div class="addRow">
        <input id="newTask" placeholder="Add a to-do…">
        <button type="button" class="btn primary" onclick="addTask()">Add</button>
      </div>
    </div>

    <div class="wsSection">
      <div class="sectionHead"><h3>Money</h3>
        <div class="inlineActions">
          <button type="button" class="btn small" onclick="addExpense()">Expense</button>
          <button type="button" class="btn small" onclick="addContribution()">Contribution</button>
        </div>
      </div>
      <div class="moneyGrid compact">
        <div class="moneyCard"><span>Budget</span><b>${money(active.budget)}</b></div>
        <div class="moneyCard"><span>Spent</span><b>${money(spent)}</b></div>
        <div class="moneyCard"><span>In</span><b>${money(contrib)}</b></div>
      </div>
      <div class="list mutedList">${[
        ...(active.expenses || []).map((e) => `<div class="row"><span>${esc(e.note)}</span><b class="danger">−${money(e.amount)}</b></div>`),
        ...(active.contributions || []).map((e) => `<div class="row"><span>${esc(e.person)}</span><b class="good">+${money(e.amount)}</b></div>`),
      ].join('') || '<p class="muted">No money recorded yet.</p>'}</div>
    </div>

    <div class="wsSection">
      <div class="sectionHead"><h3>People & notes</h3>
        <div class="inlineActions">
          <button type="button" class="btn small" onclick="invite()">Invite</button>
          <button type="button" class="btn small" onclick="addComment()">Note</button>
          <button type="button" class="btn small" onclick="uploadFile()">File</button>
          <button type="button" class="btn small" onclick="remind()">Remind</button>
        </div>
      </div>
      <div class="list">${members
        .map((m) => `<div class="row"><span>${esc(m.email || 'Member')}</span><small class="muted">${esc(m.role || 'member')}</small></div>`)
        .join('') || '<p class="muted">Just you for now.</p>'}
      ${(active.comments || [])
        .slice(0, 5)
        .map((c) => `<div class="row"><span>${esc(c.text)}</span><small class="muted">${esc(c.author || '')}</small></div>`)
        .join('')}
      ${(active.files || [])
        .map((f) => `<div class="row"><span>📎 ${esc(f.name)}</span></div>`)
        .join('')}
      </div>
    </div>

    <div class="wsFooter">
      <button type="button" class="btn dangerOutline" onclick="deleteWorkspace('${active.id}')">Delete workspace</button>
    </div>`);
};

window.deleteWorkspace = async (id) => {
  const plan = plans.find((p) => p.id === id) || active;
  if (!plan) return;
  const ok = confirm(`Delete “${plan.title}”? This cannot be undone.`);
  if (!ok) return;

  // Remove locally first
  plans = plans.filter((p) => p.id !== id);
  if (active?.id === id) active = null;
  saveLocal();
  logActivity(`Deleted workspace “${plan.title}”`, id);
  close();
  render();

  if (sb && user) {
    const { error } = await sb.from('workspaces').delete().eq('id', id);
    if (error) {
      console.error('delete workspace error', error);
      alert(
        'Could not delete from the cloud: ' +
          (error.message || 'Please try again.')
      );
      // Reload from server to restore truth
      await load();
      return;
    }
    setSyncState('Synced', 'synced');
  }
};

/* ---------- mutations ---------- */

window.quickToggle = async (wid, tid) => {
  const p = plans.find((x) => x.id === wid);
  const t = p?.tasks.find((x) => x.id === tid);
  if (!t) return;
  t.done = !t.done;
  active = p;
  logActivity(
    `${t.done ? 'Completed' : 'Reopened'} “${t.title}” in “${p.title}”`,
    wid
  );
  await persist(p);
  render();
};

window.toggleTask = async (tid) => {
  if (!active) return;
  const t = active.tasks.find((x) => x.id === tid);
  if (t) {
    t.done = !t.done;
    logActivity(
      `${t.done ? 'Completed' : 'Reopened'} “${t.title}” in “${active.title}”`,
      active.id
    );
    await persist(active);
    render();
    openPlan(active.id);
  }
};

window.assignTask = async (tid, email) => {
  const t = active?.tasks.find((x) => x.id === tid);
  if (t) {
    t.assignee_email = email || null;
    logActivity(`Assigned “${t.title}” to ${email || 'unassigned'}`, active.id);
    await persist(active);
    render();
  }
};

window.addTask = async () => {
  const v = $('newTask')?.value.trim();
  if (!v || !active) return;
  active.tasks = active.tasks || [];
  active.tasks.push({
    id: uid(),
    title: v,
    done: false,
    due: $('taskDue')?.value || null,
    priority: $('taskPriority')?.value || 'Normal',
    assignee_email: null,
  });
  logActivity(`Added task “${v}” to “${active.title}”`, active.id);
  await persist(active);
  openPlan(active.id);
  render();
};

window.addExpense = async () => {
  const note = prompt('What was the expense for?');
  const amount = Number(prompt('Amount in ₦'));
  if (!note || !amount) return;
  active.expenses = [
    ...(active.expenses || []),
    { id: uid(), note, amount, at: new Date().toISOString() },
  ];
  logActivity(`Logged expense “${note}” in “${active.title}”`, active.id);
  await persist(active);
  openPlan(active.id);
  render();
};

window.addContribution = async () => {
  const person = prompt('Who contributed?');
  const amount = Number(prompt('Amount in ₦'));
  if (!person || !amount) return;
  active.contributions = [
    ...(active.contributions || []),
    { id: uid(), person, amount, at: new Date().toISOString() },
  ];
  logActivity(`Logged contribution from ${person} in “${active.title}”`, active.id);
  await persist(active);
  openPlan(active.id);
  render();
};

window.addComment = async () => {
  const text = prompt('Add a comment or update');
  if (!text) return;
  active.comments = [
    ...(active.comments || []),
    {
      id: uid(),
      text,
      author: user?.email || 'You',
      at: new Date().toISOString(),
    },
  ];
  logActivity(`New comment in “${active.title}”`, active.id);
  await persist(active);
  openPlan(active.id);
};

window.invite = async () => {
  const email = prompt('Email address to invite');
  if (!email) return;
  if (!sb || !user) {
    alert('Sign in to invite collaborators.');
    return;
  }
  const session = (await sb.auth.getSession()).data.session;
  if (!session) {
    alert('Your session expired. Please sign in again.');
    return;
  }
  const r = await fetch('/api/invite', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ workspace_id: active.id, email }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    alert(j.error || 'Invitation failed');
    return;
  }
  active.members = [
    ...(active.members || []),
    { email, role: 'member', user_id: j.user_id },
  ];
  logActivity(`Invited ${email} to “${active.title}”`, active.id);
  await persist(active);
  openPlan(active.id);
};

window.uploadFile = async () => {
  if (!sb || !user) {
    alert('Sign in to upload files.');
    return;
  }
  const input = document.createElement('input');
  input.type = 'file';
  input.onchange = async () => {
    const f = input.files[0];
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) {
      alert('Files must be 20 MB or smaller.');
      return;
    }
    const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${active.id}/${user.id}/${Date.now()}_${safe}`;
    const { error } = await sb.storage.from('workspace-files').upload(path, f);
    if (error) {
      console.error('upload error', error);
      alert(error.message || 'Upload failed.');
      return;
    }
    active.files = [
      ...(active.files || []),
      { name: f.name, path, size: f.size, at: new Date().toISOString() },
    ];
    logActivity(`Uploaded “${f.name}” to “${active.title}”`, active.id);
    await persist(active);
    openPlan(active.id);
  };
  input.click();
};

window.remind = async () => {
  const text = prompt('Reminder note');
  const when = prompt('Reminder date and time (YYYY-MM-DDTHH:MM)');
  if (!text || !when) return;
  const iso = new Date(when).toISOString();
  if (sb && user) {
    const { error } = await sb.from('reminders').insert({
      workspace_id: active.id,
      user_id: user.id,
      note: text,
      due_at: iso,
    });
    if (error) {
      console.error('reminder error', error);
      alert(error.message);
      return;
    }
  }
  const r = JSON.parse(localStorage.getItem(reminderKey) || '[]');
  r.push({ id: uid(), workspace_id: active.id, note: text, due_at: iso });
  localStorage.setItem(reminderKey, JSON.stringify(r));
  alert(
    'Reminder saved. Numvera will surface it while the app is open. Server-side scheduling can be added next.'
  );
};

function loadReminders() {
  const r = JSON.parse(localStorage.getItem(reminderKey) || '[]');
  const due = r.filter(
    (x) =>
      new Date(x.due_at) <= new Date() &&
      new Date(x.due_at) > new Date(Date.now() - 86400000)
  );
  if (due.length && 'Notification' in window) {
    if (Notification.permission === 'default') Notification.requestPermission();
    if (Notification.permission === 'granted') {
      due.forEach((x) => new Notification('Numvera reminder', { body: x.note }));
    }
  }
}

/* ---------- Ask Numvera ---------- */
$('askBtn').onclick = () =>
  modal(`<span class="eyebrow">ASK NUMVERA</span>
    <h2>Ask about your plans</h2>
    <p class="muted">Try questions like “what is due soon”, “how much have I spent” or “what should I do next”.</p>
    <input id="askText" placeholder="Ask Numvera">
    <button type="button" class="btn primary" onclick="answerAsk()">Ask</button>
    <div id="askAnswer" class="answer"></div>`);

window.answerAsk = () => {
  const q = ($('askText').value || '').toLowerCase();
  const tasks = allTasks().filter((t) => !t.done);
  let answer = '';
  if (q.includes('spent') || q.includes('expense')) {
    const n = plans.reduce(
      (s, p) => s + (p.expenses || []).reduce((x, e) => x + Number(e.amount || 0), 0),
      0
    );
    answer = `You have recorded ${money(n)} in expenses.`;
  } else if (q.includes('due')) {
    const due = tasks
      .filter((t) => t.due)
      .sort((a, b) => new Date(a.due) - new Date(b.due))
      .slice(0, 5);
    answer = due.length
      ? due
          .map(
            (t) =>
              `${esc(t.title)} (${esc(t.workspace.title)}) — ${new Date(t.due).toLocaleDateString()}`
          )
          .join('<br>')
      : 'Nothing is due soon.';
  } else if (q.includes('next')) {
    answer = plans.length
      ? plans
          .slice(0, 5)
          .map((p) => `<b>${esc(p.title)}</b>: ${esc(smartNext(p))}`)
          .join('<br>')
      : 'Create a workspace first.';
  } else if (q.includes('task')) {
    answer = `You have ${tasks.length} open tasks across ${plans.length} workspaces.`;
  } else if (q.includes('who') || q.includes('responsible')) {
    const assigned = tasks.filter((t) => t.assignee_email).slice(0, 8);
    answer = assigned.length
      ? assigned
          .map((t) => `${esc(t.title)} → ${esc(t.assignee_email)}`)
          .join('<br>')
      : 'No tasks are assigned yet.';
  } else {
    answer =
      'I can help with due tasks, spending, open tasks, next actions and who is responsible.';
  }
  $('askAnswer').innerHTML = `<div class="panel mini">${answer}</div>`;
};

/* boot */
init();
