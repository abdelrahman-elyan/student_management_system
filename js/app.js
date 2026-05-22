// ================================================
// Student Management System - Main App
// ================================================

// ─── State ───────────────────────────────────────
const State = {
  user: null,
  departments: [],
  courses: [],
  teachers: [],
  currentPage: 'dashboard',
  students:     { data: [], pagination: {}, filters: { search: '', department: '', status: '', page: 1, limit: 10 } },
  coursesState: { data: [], filters: { search: '', department: '' } },
  enrollments:  { data: [], filters: { student_id: '', course_id: '', semester: '', status: '' } },
};

// ─── Utilities ───────────────────────────────────
const avatarColors = ['#1a3a5c','#2563a8','#059669','#7c3aed','#be123c','#d97706','#0e7490'];
const getColor  = (name) => avatarColors[(name.charCodeAt(0) + (name.charCodeAt(1)||0)) % avatarColors.length];
const initials  = (fn, ln) => ((fn?.[0]||'') + (ln?.[0]||'')).toUpperCase();
const formatDate= (d) => d ? new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—';
const escHtml   = (s) => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const semList   = () => { const y=new Date().getFullYear(); return [`Fall ${y}`,`Spring ${y}`,`Summer ${y}`,`Fall ${y-1}`,`Spring ${y-1}`]; };

function toast(msg, type='success') {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<span>${{success:'✓',error:'✕',info:'ℹ'}[type]||'•'}</span><span>${escHtml(msg)}</span>`;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity='0'; t.style.transform='translateX(30px)'; t.style.transition='all 0.3s ease'; setTimeout(()=>t.remove(),300); }, 3000);
}

function confirmDialog(title, message, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal modal-sm"><div class="modal-body" style="text-align:center;padding:32px 24px;"><div class="confirm-icon">⚠️</div><h3 style="margin-bottom:8px;">${escHtml(title)}</h3><p class="confirm-msg">${escHtml(message)}</p></div><div class="modal-footer" style="justify-content:center;"><button class="btn btn-outline" id="confirmCancel">Cancel</button><button class="btn btn-danger" id="confirmOk">Delete</button></div></div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#confirmCancel').onclick = () => overlay.remove();
  overlay.querySelector('#confirmOk').onclick = () => { overlay.remove(); onConfirm(); };
  overlay.onclick = (e) => { if (e.target===overlay) overlay.remove(); };
}

// ─── Navigation ──────────────────────────────────
function navigate(page) {
  State.currentPage = page;
  document.querySelectorAll('#app .nav-item').forEach(el => el.classList.toggle('active', el.dataset.page===page));
  document.querySelectorAll('#app .page-view').forEach(el => { el.classList.remove('active'); el.style.display='none'; });
  const pg = document.getElementById(page+'Page');
  if (pg) { pg.classList.add('active'); pg.style.display='block'; }
  const titles = { dashboard:['Dashboard','Overview & statistics'], students:['Students','Manage student records'], teachers:['Teachers','Manage faculty'], courses:['Courses','Manage courses & curriculum'], enrollments:['Enrollments','Manage course enrollments'], departments:['Departments','Manage academic departments'], users:['User Accounts','Create & manage system accounts'] };
  const t = titles[page] || ['',''];
  document.querySelector('#app .page-title h1').textContent = t[0];
  document.querySelector('#app .page-title p').textContent  = t[1];
  const loaders = { dashboard: loadDashboard, students: loadStudents, teachers: loadTeachers, courses: loadCourses, enrollments: loadEnrollments, departments: loadDepartments, users: loadUsers };
  if (loaders[page]) loaders[page]();
}

function spNavigate(page) {
  document.querySelectorAll('#studentPortalApp .nav-item').forEach(el => el.classList.toggle('active', el.dataset.page===page));
  document.querySelectorAll('#studentPortalApp .page-view').forEach(el => { el.classList.remove('active'); el.style.display='none'; });
  const pg = document.getElementById(page+'Page');
  if (pg) { pg.classList.add('active'); pg.style.display='block'; }
  const titles = {'sp-dashboard':['My Dashboard','Academic overview'],'sp-courses':['My Courses','Enrolled courses & grades'],'sp-enroll':['Register Course','Enroll in new courses']};
  const t = titles[page]||['',''];
  document.getElementById('spPageTitle').textContent = t[0];
  document.getElementById('spPageSub').textContent   = t[1];
  if (page==='sp-dashboard') loadStudentDashboard();
  if (page==='sp-courses')   loadStudentCourses();
  if (page==='sp-enroll')    loadStudentEnroll();
}

function tpNavigate(page) {
  document.querySelectorAll('#teacherPortalApp .nav-item').forEach(el => el.classList.toggle('active', el.dataset.page===page));
  document.querySelectorAll('#teacherPortalApp .page-view').forEach(el => { el.classList.remove('active'); el.style.display='none'; });
  const pg = document.getElementById(page+'Page');
  if (pg) { pg.classList.add('active'); pg.style.display='block'; }
  const titles = {'tp-dashboard':['My Dashboard','Teaching overview'],'tp-courses':['My Courses','Manage students & grades']};
  const t = titles[page]||['',''];
  document.getElementById('tpPageTitle').textContent = t[0];
  document.getElementById('tpPageSub').textContent   = t[1];
  if (page==='tp-dashboard') loadTeacherDashboard();
  if (page==='tp-courses')   loadTeacherCourses();
}

// ─── Login / Auth ─────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('loginBtn');
  const err = document.getElementById('loginError');
  btn.disabled = true; btn.innerHTML = '<span class="loading-spinner"></span> Signing in...';
  err.style.display = 'none';

  const res = await API.login({ username: document.getElementById('username').value, password: document.getElementById('password').value });
  if (res.success) {
    State.user = res.user;
    document.getElementById('loginPage').style.display = 'none';
    await launchPortal(res.user);
  } else {
    err.textContent = res.message || 'Login failed';
    err.style.display = 'block';
    btn.disabled = false; btn.textContent = 'Sign In';
  }
}

async function launchPortal(user) {
  if (user.role === 'student') {
    document.getElementById('studentPortalApp').style.display = 'flex';
    document.getElementById('spUserName').textContent = user.full_name;
    document.getElementById('spUserAvatar').textContent = user.full_name.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
    spNavigate('sp-dashboard');
  } else if (user.role === 'teacher') {
    document.getElementById('teacherPortalApp').style.display = 'flex';
    document.getElementById('tpUserName').textContent = user.full_name;
    document.getElementById('tpUserAvatar').textContent = user.full_name.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
    tpNavigate('tp-dashboard');
  } else {
    // admin or staff
    document.getElementById('app').style.display = 'flex';
    document.getElementById('sidebarUserName').textContent = user.full_name;
    document.getElementById('sidebarUserRole').textContent = user.role;
    document.getElementById('sidebarUserAvatar').textContent = user.full_name.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
    await loadDepartments(true);
    await loadTeachers(true);
    navigate('dashboard');
  }
}

function handleLogout() { _logout(); }
async function _logout() {
  await API.logout();
  State.user = null;
  ['app','studentPortalApp','teacherPortalApp'].forEach(id => document.getElementById(id).style.display='none');
  document.getElementById('loginPage').style.display = 'flex';
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
}

// ══════════════════════════════════════════════════
//   STUDENT PORTAL
// ══════════════════════════════════════════════════
async function loadStudentDashboard() {
  const el = document.getElementById('sp-dashboardPage');
  el.innerHTML = '<div class="page-loading"><div class="loading-spinner"></div><span>Loading...</span></div>';
  const res = await API.getStudentPortal(State.user.ref_id);
  if (!res.success) { el.innerHTML='<div class="empty-state"><p>Failed to load</p></div>'; return; }
  const s = res.data;

  const gradeClass = (gl) => gl ? (gl.startsWith('A')?'grade-a':gl.startsWith('B')?'grade-b':gl.startsWith('C')?'grade-c':'grade-f') : '';
  const gpaColor   = (g) => g>=3.5?'#16a34a':g>=3.0?'#2563eb':g>=2.0?'#d97706':'#dc2626';

  const completedEnrollments = (s.enrollments||[]).filter(e=>e.grade!==null && e.status!=='Dropped');
  const activeEnrollments    = (s.enrollments||[]).filter(e=>e.status==='Enrolled');

  el.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card blue"><div class="stat-icon">📚</div><div class="stat-info"><div class="stat-value">${(s.enrollments||[]).length}</div><div class="stat-label">Total Courses</div></div></div>
      <div class="stat-card green"><div class="stat-icon">✅</div><div class="stat-info"><div class="stat-value">${activeEnrollments.length}</div><div class="stat-label">Currently Enrolled</div></div></div>
      <div class="stat-card amber"><div class="stat-icon">🏅</div><div class="stat-info"><div class="stat-value">${s.total_credits_earned||0}</div><div class="stat-label">Credits Earned</div></div></div>
      <div class="stat-card purple"><div class="stat-icon">📊</div><div class="stat-info">
        <div class="stat-value" style="color:${gpaColor(s.gpa||0)}">${s.gpa !== null ? s.gpa : '—'}</div>
        <div class="stat-label">Cumulative GPA</div>
      </div></div>
    </div>
    <div class="charts-row">
      <div class="chart-card" style="flex:1">
        <h3>📋 Student Information</h3>
        <div class="detail-grid">
          <div class="detail-item"><label>Student ID</label><p>${escHtml(s.student_id)}</p></div>
          <div class="detail-item"><label>Department</label><p>${escHtml(s.department_name||'—')}</p></div>
          <div class="detail-item"><label>Email</label><p>${escHtml(s.email)}</p></div>
          <div class="detail-item"><label>Status</label><p><span class="badge badge-${(s.status||'').toLowerCase()}">${escHtml(s.status)}</span></p></div>
          <div class="detail-item"><label>Enrolled Since</label><p>${formatDate(s.enrollment_date)}</p></div>
        </div>
      </div>
      ${completedEnrollments.length ? `
      <div class="chart-card" style="flex:1">
        <h3>📈 Recent Grades</h3>
        <div class="table-wrapper">
          <table><thead><tr><th>Course</th><th>Grade</th><th>Letter</th></tr></thead>
          <tbody>${completedEnrollments.slice(0,5).map(e=>`
            <tr>
              <td><strong>${escHtml(e.course_code)}</strong><br><small>${escHtml(e.course_name)}</small></td>
              <td>${e.grade||'—'}</td>
              <td><span class="${gradeClass(e.grade_letter)}">${escHtml(e.grade_letter||'—')}</span></td>
            </tr>`).join('')}
          </tbody></table>
        </div>
      </div>` : ''}
    </div>`;
}

async function loadStudentCourses() {
  const el = document.getElementById('sp-coursesPage');
  el.innerHTML = '<div class="page-loading"><div class="loading-spinner"></div><span>Loading...</span></div>';
  const res = await API.getStudentPortal(State.user.ref_id);
  if (!res.success) { el.innerHTML='<div class="empty-state"><p>Failed to load</p></div>'; return; }
  const enrollments = res.data.enrollments || [];

  const gradeClass = (gl) => gl?(gl.startsWith('A')?'grade-a':gl.startsWith('B')?'grade-b':gl.startsWith('C')?'grade-c':'grade-f'):'';
  const statusClass = {Enrolled:'enrolled',Completed:'completed',Dropped:'dropped',Failed:'failed'};

  el.innerHTML = `
    <div class="data-card">
      <div class="data-card-header"><h3>📚 My Enrolled Courses</h3></div>
      <div class="table-wrapper">
        ${enrollments.length ? `
        <table>
          <thead><tr><th>Course</th><th>Semester</th><th>Teacher</th><th>Midterm</th><th>Assignments</th><th>Final</th><th>Grade</th><th>Letter</th><th>Status</th><th></th></tr></thead>
          <tbody>${enrollments.map(e=>`
            <tr>
              <td><strong>${escHtml(e.course_code)}</strong><br><small>${escHtml(e.course_name)}</small><br><small style="color:var(--text-muted)">${e.credits} credits</small></td>
              <td>${escHtml(e.semester)}</td>
              <td>${escHtml(e.teacher_name||'—')}</td>
              <td>${e.midterm!==null?e.midterm:'—'}</td>
              <td>${e.assignments!==null?e.assignments:'—'}</td>
              <td>${e.final_exam!==null?e.final_exam:'—'}</td>
              <td>${e.grade!==null?e.grade:'—'}</td>
              <td><span class="${gradeClass(e.grade_letter)}">${escHtml(e.grade_letter||'—')}</span></td>
              <td><span class="badge badge-${statusClass[e.status]||'enrolled'}">${escHtml(e.status)}</span></td>
              <td>${e.status==='Enrolled'?`<button class="btn btn-sm btn-outline" style="color:var(--danger)" onclick="studentDropCourse(${e.id})">Drop</button>`:'—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>` : '<div class="empty-state"><div class="empty-icon">📚</div><h3>No enrolled courses</h3><p>Go to "Register Course" to enroll</p></div>'}
      </div>
    </div>`;
}

async function loadStudentEnroll() {
  const el = document.getElementById('sp-enrollPage');
  el.innerHTML = `
    <div class="data-card">
      <div class="data-card-header"><h3>➕ Register for a Course</h3></div>
      <div style="padding:20px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
        <select id="enrollSemesterSel" class="form-control" style="width:200px;">
          ${semList().map(s=>`<option value="${s}">${s}</option>`).join('')}
        </select>
        <button class="btn btn-primary" onclick="loadAvailableCourses()">🔍 Show Available Courses</button>
      </div>
      <div id="availableCoursesContainer"></div>
    </div>`;
}

async function loadAvailableCourses() {
  const semester  = document.getElementById('enrollSemesterSel').value;
  const container = document.getElementById('availableCoursesContainer');
  container.innerHTML = '<div class="page-loading"><div class="loading-spinner"></div><span>Loading available courses...</span></div>';

  const res = await API.getAvailableCourses(State.user.ref_id, semester);

  if (!res.success) {
    container.innerHTML = `<div style="padding:20px;color:var(--danger);font-size:14px;">⚠️ ${escHtml(res.message||'Failed to load courses')}</div>`;
    return;
  }

  const courses    = res.data || [];
  const myDeptId   = res.student_dept_id;

  if (!courses.length) {
    container.innerHTML = '<div class="empty-state" style="padding:40px"><div class="empty-icon">✅</div><h3>All done!</h3><p>You are already enrolled in all available courses for this semester.</p></div>';
    return;
  }

  const myDeptCourses    = courses.filter(c => c.department_id == myDeptId);
  const otherCourses     = courses.filter(c => c.department_id != myDeptId);

  const renderRows = (list, showDeptBadge) => list.map(c => `
    <tr>
      <td>
        <strong>${escHtml(c.course_code)}</strong>
        ${showDeptBadge && c.department_id == myDeptId ? '<span style="margin-left:6px;font-size:10px;background:#dbeafe;color:#1d4ed8;border-radius:10px;padding:1px 7px;vertical-align:middle">Your Dept</span>' : ''}
      </td>
      <td>
        ${escHtml(c.course_name)}
        ${c.description ? `<br><small style="color:var(--text-muted)">${escHtml(c.description)}</small>` : ''}
      </td>
      <td>${escHtml(c.department_name||'—')}</td>
      <td>${escHtml(c.teacher_name||'—')}</td>
      <td style="text-align:center"><strong>${c.credits}</strong></td>
      <td>
        <button class="btn btn-sm btn-primary"
          onclick="studentEnrollCourse(${c.id},'${escHtml(semester)}','${escHtml(c.course_name)}')">
          ➕ Enroll
        </button>
      </td>
    </tr>`).join('');

  let html = '<div class="table-wrapper"><table><thead><tr><th>Code</th><th>Course Name</th><th>Department</th><th>Teacher</th><th style=\"text-align:center\">Credits</th><th>Action</th></tr></thead><tbody>';

  if (myDeptCourses.length) {
    html += `<tr><td colspan="6" style="background:#f0f9ff;padding:8px 16px;font-size:12px;font-weight:700;color:#0369a1;border-top:2px solid #bae6fd;">📘 Your Department Courses (${myDeptCourses.length})</td></tr>`;
    html += renderRows(myDeptCourses, false);
  }

  if (otherCourses.length) {
    html += `<tr><td colspan="6" style="background:#f8fafc;padding:8px 16px;font-size:12px;font-weight:700;color:#64748b;border-top:2px solid #e2e8f0;">📗 Other Department Courses (${otherCourses.length})</td></tr>`;
    html += renderRows(otherCourses, false);
  }

  html += '</tbody></table></div>';
  container.innerHTML = html;
}

async function studentEnrollCourse(courseId, semester, courseName) {
  const res = await API.studentEnroll(State.user.ref_id, { course_id: courseId, semester });
  if (res.success) { toast(`Enrolled in ${courseName}`); loadAvailableCourses(); }
  else toast(res.message, 'error');
}

async function studentDropCourse(enrollId) {
  confirmDialog('Drop Course','Are you sure you want to drop this course?', async () => {
    const res = await API.studentDrop(State.user.ref_id, enrollId);
    if (res.success) { toast('Course dropped'); loadStudentCourses(); }
    else toast(res.message,'error');
  });
}

// ══════════════════════════════════════════════════
//   TEACHER PORTAL
// ══════════════════════════════════════════════════
let _teacherCourses = [];

async function loadTeacherDashboard() {
  const el = document.getElementById('tp-dashboardPage');
  el.innerHTML = '<div class="page-loading"><div class="loading-spinner"></div><span>Loading...</span></div>';
  const res = await API.getTeacherCourses(State.user.ref_id);
  if (!res.success) { el.innerHTML='<div class="empty-state"><p>Failed to load</p></div>'; return; }
  _teacherCourses = res.data;
  const totalStudents = _teacherCourses.reduce((a,c)=>a+parseInt(c.enrolled_count||0),0);

  el.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card blue"><div class="stat-icon">📚</div><div class="stat-info"><div class="stat-value">${_teacherCourses.length}</div><div class="stat-label">My Courses</div></div></div>
      <div class="stat-card green"><div class="stat-icon">👥</div><div class="stat-info"><div class="stat-value">${totalStudents}</div><div class="stat-label">Total Students</div></div></div>
    </div>
    <div class="data-card" style="margin-top:24px;">
      <div class="data-card-header"><h3>📚 My Courses</h3><button class="btn btn-primary" onclick="tpNavigate('tp-courses')">View All →</button></div>
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Code</th><th>Course Name</th><th>Department</th><th style="text-align:center">Students</th></tr></thead>
          <tbody>${_teacherCourses.map(c=>`
            <tr>
              <td><strong>${escHtml(c.course_code)}</strong></td>
              <td>${escHtml(c.course_name)}</td>
              <td>${escHtml(c.department_name||'—')}</td>
              <td style="text-align:center"><span class="badge badge-enrolled">${c.enrolled_count}</span></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

async function loadTeacherCourses() {
  const el = document.getElementById('tp-coursesPage');
  el.innerHTML = '<div class="page-loading"><div class="loading-spinner"></div><span>Loading...</span></div>';
  const res = await API.getTeacherCourses(State.user.ref_id);
  if (!res.success) { el.innerHTML='<div class="empty-state"><p>Failed to load</p></div>'; return; }
  _teacherCourses = res.data;

  if (!_teacherCourses.length) {
    el.innerHTML = '<div class="data-card"><div class="empty-state"><div class="empty-icon">📚</div><h3>No courses assigned</h3><p>Contact admin to assign courses</p></div></div>';
    return;
  }

  el.innerHTML = `<div class="data-card">
    <div class="data-card-header"><h3>📚 My Courses — Select to Manage Students</h3></div>
    <div style="display:flex;flex-wrap:wrap;gap:16px;padding:20px;" id="tpCourseCards"></div>
  </div>
  <div id="tpStudentSection" style="margin-top:24px;"></div>`;

  const cardsEl = document.getElementById('tpCourseCards');
  _teacherCourses.forEach(c => {
    const card = document.createElement('div');
    card.style.cssText = 'border:2px solid var(--border);border-radius:12px;padding:16px;cursor:pointer;min-width:200px;transition:border-color 0.2s;';
    card.innerHTML = `<div style="font-weight:700;font-size:15px;">${escHtml(c.course_code)}</div><div style="color:var(--text-muted);font-size:13px;margin-top:4px;">${escHtml(c.course_name)}</div><div style="margin-top:8px;"><span class="badge badge-enrolled">${c.enrolled_count} students</span></div>`;
    card.onclick = () => { document.querySelectorAll('#tpCourseCards > div').forEach(d=>d.style.borderColor='var(--border)'); card.style.borderColor='var(--primary)'; loadCourseStudents(c.id, c.course_name); };
    cardsEl.appendChild(card);
  });
}

async function loadCourseStudents(courseId, courseName) {
  const el = document.getElementById('tpStudentSection');
  el.innerHTML = '<div class="page-loading"><div class="loading-spinner"></div></div>';
  const res = await API.getCourseStudents(State.user.ref_id, courseId);
  if (!res.success) { el.innerHTML='<p style="color:var(--danger);padding:20px">'+res.message+'</p>'; return; }
  const students = res.data;

  const gradeClass = (gl) => gl?(gl.startsWith('A')?'grade-a':gl.startsWith('B')?'grade-b':gl.startsWith('C')?'grade-c':'grade-f'):'';
  const statusClass = {Enrolled:'enrolled',Completed:'completed',Dropped:'dropped',Failed:'failed'};

  el.innerHTML = `
    <div class="data-card">
      <div class="data-card-header">
        <h3>👥 Students — ${escHtml(courseName)}</h3>
        <span style="font-size:13px;color:var(--text-muted)">${students.length} student(s)</span>
      </div>
      ${students.length ? `
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Student</th><th>Semester</th><th>Midterm<br><small style="font-weight:400">(30%)</small></th><th>Assignments<br><small style="font-weight:400">(20%)</small></th><th>Final Exam<br><small style="font-weight:400">(50%)</small></th><th>Grade</th><th>Letter</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>${students.map(s=>`
            <tr>
              <td>${escHtml(s.student_name)}<br><small style="color:var(--text-muted)">${escHtml(s.student_code)}</small></td>
              <td>${escHtml(s.semester)}</td>
              <td>${s.midterm!==null?s.midterm:'—'}</td>
              <td>${s.assignments!==null?s.assignments:'—'}</td>
              <td>${s.final_exam!==null?s.final_exam:'—'}</td>
              <td>${s.grade!==null?s.grade:'—'}</td>
              <td><span class="${gradeClass(s.grade_letter)}">${escHtml(s.grade_letter||'—')}</span></td>
              <td><span class="badge badge-${statusClass[s.status]||'enrolled'}">${escHtml(s.status)}</span></td>
              <td><button class="btn btn-sm btn-outline" onclick="teacherGradeModal(${s.enrollment_id},'${escHtml(s.student_name)}',${s.midterm??'null'},${s.assignments??'null'},${s.final_exam??'null'},'${escHtml(s.status)}',${courseId},'${escHtml(courseName)}')">📝 Grade</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>` : '<div class="empty-state" style="padding:40px"><p>No students enrolled yet</p></div>'}
    </div>`;
}

function teacherGradeModal(enrollId, studentName, midterm, assignments, finalExam, status, courseId, courseName) {
  showModal('Update Grade — ' + studentName, `
    <p style="margin-bottom:16px;color:var(--text-muted);font-size:13px">Course: <strong>${escHtml(courseName)}</strong></p>
    <p style="font-size:12px;color:var(--text-muted);margin-bottom:16px;">Grade = Midterm×30% + Assignments×20% + Final×50%</p>
    <form id="teacherGradeForm">
      <div class="form-row cols-3">
        <div class="form-group"><label class="form-label">Midterm (0–100)</label><input class="form-control" type="number" name="midterm" min="0" max="100" step="0.1" value="${midterm!==null?midterm:''}" placeholder="—"></div>
        <div class="form-group"><label class="form-label">Assignments (0–100)</label><input class="form-control" type="number" name="assignments" min="0" max="100" step="0.1" value="${assignments!==null?assignments:''}" placeholder="—"></div>
        <div class="form-group"><label class="form-label">Final Exam (0–100)</label><input class="form-control" type="number" name="final_exam" min="0" max="100" step="0.1" value="${finalExam!==null?finalExam:''}" placeholder="—"></div>
      </div>
      <div class="form-group"><label class="form-label">Status</label>
        <select class="form-control" name="status">
          <option ${status==='Enrolled'?'selected':''}>Enrolled</option>
          <option ${status==='Completed'?'selected':''}>Completed</option>
          <option ${status==='Failed'?'selected':''}>Failed</option>
          <option ${status==='Dropped'?'selected':''}>Dropped</option>
        </select>
      </div>
    </form>`,
    async () => {
      const data = Object.fromEntries(new FormData(document.getElementById('teacherGradeForm')));
      const res = await API.updateTeacherGrade(State.user.ref_id, enrollId, data);
      if (res.success) {
        toast('Grade saved' + (res.grade_letter ? ' — ' + res.grade + ' (' + res.grade_letter + ')' : ''));
        closeModal();
        loadCourseStudents(courseId, courseName);
      } else toast(res.message, 'error');
    }, 'Save Grade', 'modal-sm');
}

// ══════════════════════════════════════════════════
//   ADMIN — Dashboard
// ══════════════════════════════════════════════════
async function loadDashboard() {
  const el = document.getElementById('dashboardPage');
  el.innerHTML = '<div class="page-loading"><div class="loading-spinner"></div><span>Loading dashboard...</span></div>';
  const res = await API.getStats();
  if (!res.success) { el.innerHTML = '<div class="empty-state"><p>Failed to load stats</p></div>'; return; }
  const s = res.data;

  el.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card blue"><div class="stat-icon">👥</div><div class="stat-info"><div class="stat-value">${s.total_students}</div><div class="stat-label">Total Students</div></div></div>
      <div class="stat-card green"><div class="stat-icon">✅</div><div class="stat-info"><div class="stat-value">${s.active_students}</div><div class="stat-label">Active Students</div></div></div>
      <div class="stat-card amber"><div class="stat-icon">🎓</div><div class="stat-info"><div class="stat-value">${s.graduated}</div><div class="stat-label">Graduated</div></div></div>
      <div class="stat-card purple"><div class="stat-icon">📚</div><div class="stat-info"><div class="stat-value">${s.total_courses}</div><div class="stat-label">Courses</div></div></div>
      <div class="stat-card cyan"><div class="stat-icon">📋</div><div class="stat-info"><div class="stat-value">${s.total_enrollments}</div><div class="stat-label">Active Enrollments</div></div></div>
      <div class="stat-card rose"><div class="stat-icon">🏛️</div><div class="stat-info"><div class="stat-value">${s.total_departments}</div><div class="stat-label">Departments</div></div></div>
    </div>
    <div class="charts-row">
      <div class="chart-card">
        <h3>📊 Students by Department</h3>
        <div class="bar-chart" id="deptChart"></div>
      </div>
      <div class="chart-card">
        <h3>🧩 Students by Status</h3>
        <div class="donut-chart-wrapper">
          <canvas id="statusCanvas" width="140" height="140"></canvas>
          <div class="donut-legend" id="statusLegend"></div>
        </div>
      </div>
    </div>`;

  const maxCount = Math.max(...s.by_department.map(d=>d.count), 1);
  const deptChart = document.getElementById('deptChart');
  s.by_department.forEach(d => {
    const pct = Math.round((d.count/maxCount)*100);
    deptChart.innerHTML += `<div class="bar-item"><span class="bar-label" title="${escHtml(d.name)}">${escHtml(d.name.length>14?d.name.substring(0,13)+'…':d.name)}</span><div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div><span class="bar-value">${d.count}</span></div>`;
  });

  const statusColors = {Active:'#16a34a',Inactive:'#94a3b8',Graduated:'#2563eb',Suspended:'#dc2626'};
  const total = s.by_status.reduce((a,b)=>a+parseInt(b.count),0)||1;
  const canvas = document.getElementById('statusCanvas');
  const ctx = canvas.getContext('2d');
  let startAngle = -Math.PI/2;
  const legend = document.getElementById('statusLegend');
  s.by_status.forEach(item => {
    const slice = (parseInt(item.count)/total)*2*Math.PI;
    ctx.beginPath(); ctx.moveTo(70,70); ctx.arc(70,70,55,startAngle,startAngle+slice);
    ctx.fillStyle = statusColors[item.status]||'#94a3b8'; ctx.fill();
    startAngle += slice;
    legend.innerHTML += `<div class="legend-item"><div class="legend-dot" style="background:${statusColors[item.status]||'#94a3b8'}"></div><span>${escHtml(item.status)}: <strong>${item.count}</strong></span></div>`;
  });
  ctx.beginPath(); ctx.arc(70,70,32,0,2*Math.PI); ctx.fillStyle='white'; ctx.fill();
  ctx.fillStyle='#1e2a38'; ctx.font='bold 20px DM Sans,sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(total,70,70);
}

// ══════════════════════════════════════════════════
//   ADMIN — Students
// ══════════════════════════════════════════════════
async function loadStudents() {
  const f = State.students.filters;
  const tableBody = document.getElementById('studentsTableBody');
  if (tableBody) tableBody.innerHTML = '<tr><td colspan="8" class="page-loading"><div class="loading-spinner"></div></td></tr>';
  const res = await API.getStudents(f);
  if (!res.success) { toast(res.message,'error'); return; }
  State.students.data = res.data;
  State.students.pagination = res.pagination;
  renderStudentsTable(res.data);
  renderPagination(res.pagination, (p)=>{ State.students.filters.page=p; loadStudents(); }, 'studentsPagination');
}

function renderStudentsTable(students) {
  const tbody = document.getElementById('studentsTableBody');
  if (!tbody) return;
  if (!students.length) { tbody.innerHTML='<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">🎓</div><h3>No students found</h3></div></td></tr>'; return; }
  tbody.innerHTML = students.map(s => {
    const color = getColor(s.first_name);
    const init  = initials(s.first_name, s.last_name);
    const badgeClass = {Active:'active',Inactive:'inactive',Graduated:'graduated',Suspended:'suspended'}[s.status]||'inactive';
    const loginBadge = s.login_username
      ? `<span class="badge badge-active" title="Username: ${escHtml(s.login_username)}">🔑 ${escHtml(s.login_username)}</span>`
      : `<span class="badge badge-inactive">No account</span>`;
    return `<tr>
      <td><div class="student-info-cell">
        <div class="student-avatar" style="background:${color}">${init}</div>
        <div><div class="student-name">${escHtml(s.first_name+' '+s.last_name)}</div><div class="student-id-text">${escHtml(s.student_id)}</div></div>
      </div></td>
      <td>${escHtml(s.email)}</td>
      <td>${escHtml(s.department_name||'—')}</td>
      <td>${escHtml(s.gender)}</td>
      <td>${formatDate(s.enrollment_date)}</td>
      <td><span class="badge badge-${badgeClass}">${escHtml(s.status)}</span></td>
      <td>${loginBadge}</td>
      <td><div style="display:flex;gap:6px;">
        <button class="btn btn-sm btn-outline btn-icon" onclick="viewStudent(${s.id})" title="View">👁️</button>
        <button class="btn btn-sm btn-outline btn-icon" onclick="editStudentModal(${s.id})" title="Edit">✏️</button>
        <button class="btn btn-sm btn-outline btn-icon" style="color:var(--danger)" onclick="deleteStudentConfirm(${s.id},'${escHtml(s.first_name+' '+s.last_name)}')" title="Delete">🗑️</button>
      </div></td>
    </tr>`;
  }).join('');
}

function renderPagination(pagination, onPageChange, containerId) {
  const container = document.getElementById(containerId);
  if (!container || !pagination) return;
  const { total, page, limit, pages } = pagination;
  const from = Math.min((page-1)*limit+1, total);
  const to   = Math.min(page*limit, total);
  let btns = '';
  btns += `<button class="page-btn" onclick="(${onPageChange.toString()})(${page-1})" ${page<=1?'disabled':''}>‹</button>`;
  for (let i=Math.max(1,page-2); i<=Math.min(pages,page+2); i++) {
    btns += `<button class="page-btn ${i===page?'active':''}" onclick="(${onPageChange.toString()})(${i})">${i}</button>`;
  }
  btns += `<button class="page-btn" onclick="(${onPageChange.toString()})(${page+1})" ${page>=pages?'disabled':''}>›</button>`;
  container.innerHTML = `<span class="pagination-info">Showing ${from}–${to} of ${total} results</span><div class="page-btns">${btns}</div>`;
}

function openAddStudentModal() {
  const deptOptions = State.departments.map(d=>`<option value="${d.id}">${escHtml(d.name)}</option>`).join('');
  showModal('Add New Student', `
    <form id="addStudentForm">
      <div class="form-row cols-2">
        <div class="form-group"><label class="form-label">First Name <span class="required">*</span></label><input class="form-control" name="first_name" required placeholder="e.g. Ahmed"></div>
        <div class="form-group"><label class="form-label">Last Name <span class="required">*</span></label><input class="form-control" name="last_name" required placeholder="e.g. Hassan"></div>
      </div>
      <div class="form-group"><label class="form-label">Email <span class="required">*</span></label><input class="form-control" type="email" name="email" required></div>
      <div class="form-row cols-2">
        <div class="form-group"><label class="form-label">Phone</label><input class="form-control" name="phone" placeholder="010xxxxxxxx"></div>
        <div class="form-group"><label class="form-label">Date of Birth</label><input class="form-control" type="date" name="date_of_birth"></div>
      </div>
      <div class="form-row cols-2">
        <div class="form-group"><label class="form-label">Gender <span class="required">*</span></label>
          <select class="form-control" name="gender" required><option value="">Select...</option><option>Male</option><option>Female</option></select>
        </div>
        <div class="form-group"><label class="form-label">Department</label>
          <select class="form-control" name="department_id"><option value="">— None —</option>${deptOptions}</select>
        </div>
      </div>
      <div class="form-row cols-2">
        <div class="form-group"><label class="form-label">Enrollment Date <span class="required">*</span></label><input class="form-control" type="date" name="enrollment_date" required value="${new Date().toISOString().split('T')[0]}"></div>
        <div class="form-group"><label class="form-label">Status</label>
          <select class="form-control" name="status"><option>Active</option><option>Inactive</option><option>Graduated</option><option>Suspended</option></select>
        </div>
      </div>
      <div class="form-group"><label class="form-label">Address</label><textarea class="form-control" name="address" rows="2"></textarea></div>
      <hr style="margin:16px 0;border-color:var(--border)">
      <p style="font-size:13px;font-weight:600;color:var(--primary);margin-bottom:12px;">🔑 Student Login Account (optional)</p>
      <div class="form-row cols-2">
        <div class="form-group"><label class="form-label">Username</label><input class="form-control" name="username" placeholder="e.g. ahmed.hassan"></div>
        <div class="form-group"><label class="form-label">Password</label><input class="form-control" type="password" name="password" placeholder="Set initial password"></div>
      </div>
    </form>`,
    async () => {
      const data = Object.fromEntries(new FormData(document.getElementById('addStudentForm')));
      const res  = await API.addStudent(data);
      if (res.success) {
        let msg = 'Student added! ID: ' + res.student_id;
        if (res.account_created) msg += ' | Login: ' + data.username;
        toast(msg); closeModal(); loadStudents();
      } else toast(res.message, 'error');
    }, 'Add Student');
}

async function editStudentModal(id) {
  const res = await API.getStudent(id);
  if (!res.success) { toast('Failed to load student','error'); return; }
  const s = res.data;
  const deptOptions = State.departments.map(d=>`<option value="${d.id}" ${d.id==s.department_id?'selected':''}>${escHtml(d.name)}</option>`).join('');
  const statusOpts  = ['Active','Inactive','Graduated','Suspended'].map(st=>`<option ${st===s.status?'selected':''}>${st}</option>`).join('');

  showModal('Edit Student', `
    <form id="editStudentForm">
      <div class="form-row cols-2">
        <div class="form-group"><label class="form-label">First Name</label><input class="form-control" name="first_name" required value="${escHtml(s.first_name)}"></div>
        <div class="form-group"><label class="form-label">Last Name</label><input class="form-control" name="last_name" required value="${escHtml(s.last_name)}"></div>
      </div>
      <div class="form-group"><label class="form-label">Email</label><input class="form-control" type="email" name="email" required value="${escHtml(s.email)}"></div>
      <div class="form-row cols-2">
        <div class="form-group"><label class="form-label">Phone</label><input class="form-control" name="phone" value="${escHtml(s.phone||'')}"></div>
        <div class="form-group"><label class="form-label">Date of Birth</label><input class="form-control" type="date" name="date_of_birth" value="${s.date_of_birth||''}"></div>
      </div>
      <div class="form-row cols-2">
        <div class="form-group"><label class="form-label">Gender</label>
          <select class="form-control" name="gender"><option ${s.gender==='Male'?'selected':''}>Male</option><option ${s.gender==='Female'?'selected':''}>Female</option></select>
        </div>
        <div class="form-group"><label class="form-label">Department</label>
          <select class="form-control" name="department_id"><option value="">— None —</option>${deptOptions}</select>
        </div>
      </div>
      <div class="form-row cols-2">
        <div class="form-group"><label class="form-label">Enrollment Date</label><input class="form-control" type="date" name="enrollment_date" value="${s.enrollment_date||''}"></div>
        <div class="form-group"><label class="form-label">Status</label><select class="form-control" name="status">${statusOpts}</select></div>
      </div>
      <div class="form-group"><label class="form-label">Address</label><textarea class="form-control" name="address" rows="2">${escHtml(s.address||'')}</textarea></div>
      ${s.login_username ? `<hr style="margin:16px 0;border-color:var(--border)"><p style="font-size:13px;color:var(--text-muted)">Current login: <strong>${escHtml(s.login_username)}</strong></p>
      <div class="form-group"><label class="form-label">New Password (leave blank to keep current)</label><input class="form-control" type="password" name="new_password" placeholder="New password..."></div>` : ''}
    </form>`,
    async () => {
      const data   = Object.fromEntries(new FormData(document.getElementById('editStudentForm')));
      const result = await API.updateStudent(id, data);
      if (result.success) { toast('Student updated'); closeModal(); loadStudents(); }
      else toast(result.message,'error');
    }, 'Save Changes');
}

async function viewStudent(id) {
  const res = await API.getStudent(id);
  if (!res.success) { toast('Failed to load','error'); return; }
  const s = res.data;
  const color = getColor(s.first_name);
  const init  = initials(s.first_name, s.last_name);
  const badgeClass = {Active:'active',Inactive:'inactive',Graduated:'graduated',Suspended:'suspended'}[s.status]||'inactive';
  const gradeClass  = (gl) => gl?(gl.startsWith('A')?'grade-a':gl.startsWith('B')?'grade-b':gl.startsWith('C')?'grade-c':'grade-f'):'';

  const enrollHtml = s.enrollments?.length ? `
    <table><thead><tr><th>Course</th><th>Semester</th><th>Grade</th><th>Status</th><th></th></tr></thead>
    <tbody>${s.enrollments.map(e=>`<tr>
      <td><strong>${escHtml(e.course_code)}</strong> — ${escHtml(e.course_name)}</td>
      <td>${escHtml(e.semester)}</td>
      <td><span class="${gradeClass(e.grade_letter)}">${e.grade ? e.grade+' ('+escHtml(e.grade_letter)+')' : '—'}</span></td>
      <td><span class="badge badge-${e.status.toLowerCase()}">${escHtml(e.status)}</span></td>
      <td>${e.status==='Enrolled'?`<button class="btn btn-sm btn-outline" style="color:var(--danger);font-size:11px;" onclick="adminDropCourse(${e.id},${s.id},'${escHtml(e.course_name)}')">Drop</button>`:'—'}</td>
    </tr>`).join('')}</tbody></table>` : '<div class="empty-state" style="padding:20px"><p>No enrollments yet</p></div>';

  showModal('Student Profile', `
    <div class="profile-header">
      <div class="profile-avatar-lg" style="background:${color}">${init}</div>
      <div><h2>${escHtml(s.first_name+' '+s.last_name)}</h2><p>ID: ${escHtml(s.student_id)} &nbsp;|&nbsp; <span class="badge badge-${badgeClass}">${escHtml(s.status)}</span></p></div>
    </div>
    <div class="tabs">
      <button class="tab-btn active" onclick="switchTab(this,'infoTab')">📋 Info</button>
      <button class="tab-btn" onclick="switchTab(this,'enrollTab')">📚 Enrollments (${s.enrollments?.length||0})</button>
    </div>
    <div id="infoTab" class="tab-content active">
      <div class="detail-grid">
        <div class="detail-item"><label>Email</label><p>${escHtml(s.email)}</p></div>
        <div class="detail-item"><label>Phone</label><p>${escHtml(s.phone||'—')}</p></div>
        <div class="detail-item"><label>Date of Birth</label><p>${formatDate(s.date_of_birth)}</p></div>
        <div class="detail-item"><label>Gender</label><p>${escHtml(s.gender)}</p></div>
        <div class="detail-item"><label>Department</label><p>${escHtml(s.department_name||'—')}</p></div>
        <div class="detail-item"><label>Login</label><p>${escHtml(s.login_username||'No account')}</p></div>
        <div class="detail-item" style="grid-column:1/-1"><label>Address</label><p>${escHtml(s.address||'—')}</p></div>
      </div>
    </div>
    <div id="enrollTab" class="tab-content">
      <div style="padding:12px 0 8px;display:flex;justify-content:flex-end;">
        <button class="btn btn-primary" style="font-size:13px;" onclick="adminEnrollCourseModal(${s.id},'${escHtml(s.first_name+' '+s.last_name)}')">➕ Enroll in Course</button>
      </div>
      <div class="table-wrapper">${enrollHtml}</div>
    </div>`,
    null, null, 'modal-lg');
}

async function adminEnrollCourseModal(studentId, studentName) {
  const semOpts = semList().map(s=>`<option value="${s}">${s}</option>`).join('');
  showModal('Enroll ' + studentName + ' in a Course', `
    <div style="display:flex;gap:12px;align-items:center;margin-bottom:16px;flex-wrap:wrap;">
      <select id="adminEnrollSem" class="form-control" style="width:200px;">${semOpts}</select>
      <button class="btn btn-primary" onclick="adminLoadAvailableCourses(${studentId})">🔍 Show Available Courses</button>
    </div>
    <div id="adminCourseList"></div>`,
    null, null, 'modal-lg');
  setTimeout(() => adminLoadAvailableCourses(studentId), 100);
}

async function adminLoadAvailableCourses(studentId) {
  const sem = document.getElementById('adminEnrollSem')?.value;
  const container = document.getElementById('adminCourseList');
  if (!container || !sem) return;
  container.innerHTML = '<div class="page-loading"><div class="loading-spinner"></div><span>Loading available courses...</span></div>';
  const res = await API.getAvailableCourses(studentId, sem);
  if (!res.success) { container.innerHTML = `<div style="color:var(--danger);padding:12px">⚠️ ${escHtml(res.message||'Failed to load')}</div>`; return; }
  const courses = res.data || [];
  if (!courses.length) { container.innerHTML = '<div class="empty-state" style="padding:30px"><p>Student is already enrolled in all available courses for this semester.</p></div>'; return; }
  container.innerHTML = `<div class="table-wrapper"><table>
    <thead><tr><th>Code</th><th>Course Name</th><th>Department</th><th>Teacher</th><th style="text-align:center">Credits</th><th>Action</th></tr></thead>
    <tbody>${courses.map(c=>`<tr>
      <td><strong>${escHtml(c.course_code)}</strong></td>
      <td>${escHtml(c.course_name)}</td>
      <td>${escHtml(c.department_name||'—')}</td>
      <td>${escHtml(c.teacher_name||'—')}</td>
      <td style="text-align:center">${c.credits}</td>
      <td><button class="btn btn-sm btn-primary" onclick="adminDoEnroll(${studentId},${c.id},'${sem}','${escHtml(c.course_name)}')">➕ Enroll</button></td>
    </tr>`).join('')}
    </tbody></table></div>`;
}

async function adminDoEnroll(studentId, courseId, semester, courseName) {
  const res = await API.studentEnroll(studentId, { course_id: courseId, semester });
  if (res.success) { toast('Enrolled in ' + courseName + ' ✓'); adminLoadAvailableCourses(studentId); }
  else toast(res.message, 'error');
}

async function adminDropCourse(enrollId, studentId, courseName) {
  confirmDialog('Drop Course', 'Remove "' + courseName + '" from this student?', async () => {
    const res = await API.deleteEnrollment(enrollId);
    if (res.success) { toast('Course removed'); viewStudent(studentId); }
    else toast(res.message, 'error');
  });
}

function switchTab(btn, tabId) {
  btn.closest('.modal,.page-view').querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  btn.closest('.modal,.page-view').querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(tabId)?.classList.add('active');
}

function deleteStudentConfirm(id, name) {
  confirmDialog('Delete Student', `Delete "${name}"? This will also remove all their enrollments.`, async () => {
    const res = await API.deleteStudent(id);
    if (res.success) { toast('Student deleted'); loadStudents(); }
    else toast(res.message,'error');
  });
}

// ══════════════════════════════════════════════════
//   ADMIN — Teachers
// ══════════════════════════════════════════════════
async function loadTeachers(silent=false) {
  const res = await API.getTeachers();
  if (!res.success) return;
  State.teachers = res.data;
  if (!silent) renderTeachersTable(res.data);
}

function renderTeachersTable(teachers) {
  const tbody = document.getElementById('teachersTableBody');
  if (!tbody) return;
  if (!teachers.length) { tbody.innerHTML='<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">👨‍🏫</div><h3>No teachers</h3></div></td></tr>'; return; }
  tbody.innerHTML = teachers.map(t => {
    const color = getColor(t.first_name);
    const init  = initials(t.first_name, t.last_name);
    return `<tr>
      <td><div class="student-info-cell">
        <div class="student-avatar" style="background:${color}">${init}</div>
        <div><div class="student-name">${escHtml(t.first_name+' '+t.last_name)}</div><div class="student-id-text">${escHtml(t.teacher_id)}</div></div>
      </div></td>
      <td>${escHtml(t.email)}</td>
      <td>${escHtml(t.department_name||'—')}</td>
      <td><span class="badge badge-${t.status==='Active'?'active':'inactive'}">${escHtml(t.status)}</span></td>
      <td><span class="badge" style="background:#d1fae5;color:#065f46;font-size:11px;">teacher</span></td>
      <td><span class="badge badge-${t.has_account?'active':'inactive'}">${t.login_username||'No account'}</span></td>
      <td><div style="display:flex;gap:6px;">
        <button class="btn btn-sm btn-outline btn-icon" onclick="editTeacherModal(${t.id})" title="Edit">✏️</button>
        <button class="btn btn-sm btn-outline btn-icon" style="color:var(--danger)" onclick="deleteTeacherConfirm(${t.id},'${escHtml(t.first_name+' '+t.last_name)}')" title="Delete">🗑️</button>
      </div></td>
    </tr>`;
  }).join('');
}

function openAddTeacherModal() {
  const deptOptions = State.departments.map(d=>`<option value="${d.id}">${escHtml(d.name)}</option>`).join('');
  showModal('Add New Teacher', `
    <form id="addTeacherForm">
      <div class="form-row cols-2">
        <div class="form-group"><label class="form-label">First Name <span class="required">*</span></label><input class="form-control" name="first_name" required placeholder="e.g. Mohamed"></div>
        <div class="form-group"><label class="form-label">Last Name <span class="required">*</span></label><input class="form-control" name="last_name" required placeholder="e.g. Salah"></div>
      </div>
      <div class="form-group"><label class="form-label">Email <span class="required">*</span></label><input class="form-control" type="email" name="email" required></div>
      <div class="form-row cols-2">
        <div class="form-group"><label class="form-label">Phone</label><input class="form-control" name="phone" placeholder="010xxxxxxxx"></div>
        <div class="form-group"><label class="form-label">Department</label>
          <select class="form-control" name="department_id"><option value="">— None —</option>${deptOptions}</select>
        </div>
      </div>
      <div class="form-group"><label class="form-label">Status</label>
        <select class="form-control" name="status"><option>Active</option><option>Inactive</option></select>
      </div>
      <hr style="margin:16px 0;border-color:var(--border)">
      <p style="font-size:13px;font-weight:600;color:var(--primary);margin-bottom:12px;">🔑 Teacher Login Account (optional)</p>
      <div class="form-row cols-2">
        <div class="form-group"><label class="form-label">Username</label><input class="form-control" name="username" placeholder="e.g. mohamed.salah"></div>
        <div class="form-group"><label class="form-label">Password</label><input class="form-control" type="password" name="password" placeholder="Set initial password"></div>
      </div>
    </form>`,
    async () => {
      const data = Object.fromEntries(new FormData(document.getElementById('addTeacherForm')));
      const res  = await API.addTeacher(data);
      if (res.success) {
        let msg = 'Teacher added! ID: ' + res.teacher_id;
        if (res.account_created) msg += ' | Login: ' + data.username;
        toast(msg); closeModal(); loadTeachers();
      } else toast(res.message,'error');
    }, 'Add Teacher');
}

async function editTeacherModal(id) {
  const res = await API.getTeacher(id);
  if (!res.success) return;
  const t = res.data;
  const deptOptions = State.departments.map(d=>`<option value="${d.id}" ${d.id==t.department_id?'selected':''}>${escHtml(d.name)}</option>`).join('');
  showModal('Edit Teacher', `
    <form id="editTeacherForm">
      <div class="form-row cols-2">
        <div class="form-group"><label class="form-label">First Name</label><input class="form-control" name="first_name" value="${escHtml(t.first_name)}"></div>
        <div class="form-group"><label class="form-label">Last Name</label><input class="form-control" name="last_name" value="${escHtml(t.last_name)}"></div>
      </div>
      <div class="form-group"><label class="form-label">Email</label><input class="form-control" type="email" name="email" value="${escHtml(t.email)}"></div>
      <div class="form-row cols-2">
        <div class="form-group"><label class="form-label">Phone</label><input class="form-control" name="phone" value="${escHtml(t.phone||'')}"></div>
        <div class="form-group"><label class="form-label">Department</label>
          <select class="form-control" name="department_id"><option value="">— None —</option>${deptOptions}</select>
        </div>
      </div>
      <div class="form-group"><label class="form-label">Status</label>
        <select class="form-control" name="status"><option ${t.status==='Active'?'selected':''}>Active</option><option ${t.status==='Inactive'?'selected':''}>Inactive</option></select>
      </div>
    </form>`,
    async () => {
      const data   = Object.fromEntries(new FormData(document.getElementById('editTeacherForm')));
      const result = await API.updateTeacher(id, data);
      if (result.success) { toast('Teacher updated'); closeModal(); loadTeachers(); }
      else toast(result.message,'error');
    }, 'Save Changes');
}

function deleteTeacherConfirm(id, name) {
  confirmDialog('Delete Teacher', `Delete "${name}"? Their login account will also be removed.`, async () => {
    const res = await API.deleteTeacher(id);
    if (res.success) { toast('Teacher deleted'); loadTeachers(); }
    else toast(res.message,'error');
  });
}

// ══════════════════════════════════════════════════
//   ADMIN — Courses
// ══════════════════════════════════════════════════
async function loadCourses() {
  const f = State.coursesState.filters;
  const tbody = document.getElementById('coursesTableBody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="page-loading"><div class="loading-spinner"></div></td></tr>';
  const res = await API.getCourses(f);
  if (!res.success) { toast(res.message,'error'); return; }
  State.coursesState.data = res.data;
  renderCoursesTable(res.data);
}

function renderCoursesTable(courses) {
  const tbody = document.getElementById('coursesTableBody');
  if (!tbody) return;
  if (!courses.length) { tbody.innerHTML='<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📚</div><h3>No courses found</h3></div></td></tr>'; return; }
  tbody.innerHTML = courses.map(c=>`<tr>
    <td><strong>${escHtml(c.course_code)}</strong></td>
    <td>${escHtml(c.course_name)}</td>
    <td>${escHtml(c.department_name||'—')}</td>
    <td>${escHtml(c.teacher_name||'—')}</td>
    <td style="text-align:center">${c.credits}</td>
    <td style="text-align:center"><span class="badge badge-enrolled">${c.enrolled_count}</span></td>
    <td><div style="display:flex;gap:6px;">
      <button class="btn btn-sm btn-outline btn-icon" onclick="editCourseModal(${c.id})" title="Edit">✏️</button>
      <button class="btn btn-sm btn-outline btn-icon" style="color:var(--danger)" onclick="deleteCourseConfirm(${c.id},'${escHtml(c.course_name)}')" title="Delete">🗑️</button>
    </div></td>
  </tr>`).join('');
}

function openAddCourseModal() {
  const deptOptions    = State.departments.map(d=>`<option value="${d.id}">${escHtml(d.name)}</option>`).join('');
  const adminOption = (State.user && (State.user.role==='admin'||State.user.role==='staff'))
    ? `<option value="admin_${State.user.id}" data-isadmin="1">${escHtml(State.user.full_name)} (Admin)</option>`
    : '';
  const teacherOptions = State.teachers.map(t=>`<option value="${t.id}">${escHtml(t.first_name+' '+t.last_name)}</option>`).join('');
  const allTeacherOptions = adminOption + teacherOptions;
  showModal('Add New Course', `
    <form id="addCourseForm">
      <div class="form-row cols-2">
        <div class="form-group"><label class="form-label">Course Code <span class="required">*</span></label><input class="form-control" name="course_code" required placeholder="e.g. CS101"></div>
        <div class="form-group"><label class="form-label">Credits</label><input class="form-control" type="number" name="credits" min="1" max="6" value="3"></div>
      </div>
      <div class="form-group"><label class="form-label">Course Name <span class="required">*</span></label><input class="form-control" name="course_name" required></div>
      <div class="form-row cols-2">
        <div class="form-group"><label class="form-label">Department</label>
          <select class="form-control" name="department_id"><option value="">— None —</option>${deptOptions}</select>
        </div>
        <div class="form-group"><label class="form-label">Teacher</label>
          <select class="form-control" name="teacher_id"><option value="">— None —</option>${allTeacherOptions}</select>
        </div>
      </div>
      <div class="form-group"><label class="form-label">Description</label><textarea class="form-control" name="description" rows="3"></textarea></div>
    </form>`,
    async () => {
      const data = Object.fromEntries(new FormData(document.getElementById('addCourseForm')));
      const res  = await API.addCourse(data);
      if (res.success) { toast('Course added'); closeModal(); loadCourses(); }
      else toast(res.message,'error');
    }, 'Add Course');
}

async function editCourseModal(id) {
  const res = await API.getCourse(id);
  if (!res.success) return;
  const c = res.data;
  const deptOptions    = State.departments.map(d=>`<option value="${d.id}" ${d.id==c.department_id?'selected':''}>${escHtml(d.name)}</option>`).join('');
  const adminOption2 = (State.user && (State.user.role==='admin'||State.user.role==='staff'))
    ? `<option value="admin_${State.user.id}" ${c.teacher_id==null&&c.teacher_name===State.user.full_name?'selected':''} data-isadmin="1">${escHtml(State.user.full_name)} (Admin)</option>`
    : '';
  const teacherOptions = State.teachers.map(t=>`<option value="${t.id}" ${t.id==c.teacher_id?'selected':''}>${escHtml(t.first_name+' '+t.last_name)}</option>`).join('');
  const allTeacherOptions2 = adminOption2 + teacherOptions;
  showModal('Edit Course', `
    <form id="editCourseForm">
      <div class="form-row cols-2">
        <div class="form-group"><label class="form-label">Course Code</label><input class="form-control" name="course_code" value="${escHtml(c.course_code)}"></div>
        <div class="form-group"><label class="form-label">Credits</label><input class="form-control" type="number" name="credits" value="${c.credits}" min="1" max="6"></div>
      </div>
      <div class="form-group"><label class="form-label">Course Name</label><input class="form-control" name="course_name" value="${escHtml(c.course_name)}"></div>
      <div class="form-row cols-2">
        <div class="form-group"><label class="form-label">Department</label>
          <select class="form-control" name="department_id"><option value="">— None —</option>${deptOptions}</select>
        </div>
        <div class="form-group"><label class="form-label">Teacher</label>
          <select class="form-control" name="teacher_id"><option value="">— None —</option>${allTeacherOptions2}</select>
        </div>
      </div>
      <div class="form-group"><label class="form-label">Description</label><textarea class="form-control" name="description" rows="3">${escHtml(c.description||'')}</textarea></div>
    </form>`,
    async () => {
      const data   = Object.fromEntries(new FormData(document.getElementById('editCourseForm')));
      const result = await API.updateCourse(id, data);
      if (result.success) { toast('Course updated'); closeModal(); loadCourses(); }
      else toast(result.message,'error');
    }, 'Save Changes');
}

function deleteCourseConfirm(id, name) {
  confirmDialog('Delete Course', `Delete "${name}"?`, async () => {
    const res = await API.deleteCourse(id);
    if (res.success) { toast('Course deleted'); loadCourses(); }
    else toast(res.message,'error');
  });
}

// ══════════════════════════════════════════════════
//   ADMIN — Enrollments (fix: load courses+students)
// ══════════════════════════════════════════════════
async function loadEnrollments() {
  const tbody = document.getElementById('enrollmentsTableBody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="page-loading"><div class="loading-spinner"></div></td></tr>';
  const res = await API.getEnrollments(State.enrollments.filters);
  if (!res.success) return;
  State.enrollments.data = res.data;
  renderEnrollmentsTable(res.data);
}

function renderEnrollmentsTable(enrollments) {
  const tbody = document.getElementById('enrollmentsTableBody');
  if (!tbody) return;
  if (!enrollments.length) { tbody.innerHTML='<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">📋</div><h3>No enrollments found</h3></div></td></tr>'; return; }
  const gradeClass  = (gl) => gl?(gl.startsWith('A')?'grade-a':gl.startsWith('B')?'grade-b':gl.startsWith('C')?'grade-c':'grade-f'):'';
  const statusClass = {Enrolled:'enrolled',Completed:'completed',Dropped:'dropped',Failed:'failed'};
  tbody.innerHTML = enrollments.map(e=>`<tr>
    <td>${escHtml(e.student_name)}<br><small style="color:var(--text-muted)">${escHtml(e.student_code)}</small></td>
    <td><strong>${escHtml(e.course_code)}</strong><br><small>${escHtml(e.course_name)}</small></td>
    <td>${escHtml(e.semester)}</td>
    <td><span class="${gradeClass(e.grade_letter)}">${e.grade ? e.grade+' ('+escHtml(e.grade_letter)+')' : '—'}</span></td>
    <td><span class="badge badge-${statusClass[e.status]||'enrolled'}">${escHtml(e.status)}</span></td>
    <td><div style="display:flex;gap:6px;">
      <button class="btn btn-sm btn-outline btn-icon" onclick="gradeModal(${e.id},'${escHtml(e.student_name)}','${escHtml(e.course_name)}')" title="Grade">📝</button>
      <button class="btn btn-sm btn-outline btn-icon" style="color:var(--danger)" onclick="deleteEnrollConfirm(${e.id})" title="Remove">🗑️</button>
    </div></td>
  </tr>`).join('');
}

async function openAddEnrollmentModal() {
  // *** FIX: always fetch fresh data so dropdowns are populated ***
  const [studRes, courseRes] = await Promise.all([
    API.getStudents({ limit: 1000, page: 1 }),
    API.getCourses({})
  ]);

  const studentOptions = (studRes.data||[]).map(s=>`<option value="${s.id}">${escHtml(s.student_id+' — '+s.first_name+' '+s.last_name)}</option>`).join('');
  const courseOptions  = (courseRes.data||[]).map(c=>`<option value="${c.id}">${escHtml(c.course_code+' — '+c.course_name)}</option>`).join('');
  const semOptions     = semList().map(s=>`<option>${s}</option>`).join('');

  showModal('Add Enrollment', `
    <form id="addEnrollForm">
      <div class="form-group"><label class="form-label">Student <span class="required">*</span></label>
        <select class="form-control" name="student_id" required><option value="">Select student...</option>${studentOptions}</select>
      </div>
      <div class="form-group"><label class="form-label">Course <span class="required">*</span></label>
        <select class="form-control" name="course_id" required><option value="">Select course...</option>${courseOptions}</select>
      </div>
      <div class="form-group"><label class="form-label">Semester <span class="required">*</span></label>
        <select class="form-control" name="semester" required>${semOptions}</select>
      </div>
    </form>`,
    async () => {
      const data = Object.fromEntries(new FormData(document.getElementById('addEnrollForm')));
      const res  = await API.addEnrollment(data);
      if (res.success) { toast('Enrollment added'); closeModal(); loadEnrollments(); }
      else toast(res.message,'error');
    }, 'Enroll');
}

function gradeModal(id, studentName, courseName) {
  showModal('Update Grade', `
    <p style="margin-bottom:16px;color:var(--text-muted);font-size:14px"><strong>${escHtml(studentName)}</strong> — ${escHtml(courseName)}</p>
    <form id="gradeForm">
      <div class="form-row cols-3">
        <div class="form-group"><label class="form-label">Midterm (30%)</label><input class="form-control" type="number" name="midterm" min="0" max="100" step="0.1" placeholder="0–100"></div>
        <div class="form-group"><label class="form-label">Assignments (20%)</label><input class="form-control" type="number" name="assignments" min="0" max="100" step="0.1" placeholder="0–100"></div>
        <div class="form-group"><label class="form-label">Final (50%)</label><input class="form-control" type="number" name="final_exam" min="0" max="100" step="0.1" placeholder="0–100"></div>
      </div>
      <div class="form-group"><label class="form-label">Status</label>
        <select class="form-control" name="status">
          <option>Enrolled</option><option>Completed</option><option>Dropped</option><option>Failed</option>
        </select>
      </div>
    </form>`,
    async () => {
      const data = Object.fromEntries(new FormData(document.getElementById('gradeForm')));
      const res  = await API.updateEnrollment(id, data);
      if (res.success) { toast('Grade updated'+(res.grade_letter?' — '+res.grade+' ('+res.grade_letter+')':'')); closeModal(); loadEnrollments(); }
      else toast(res.message,'error');
    }, 'Save Grade', 'modal-sm');
}

function deleteEnrollConfirm(id) {
  confirmDialog('Remove Enrollment','Remove this enrollment record?', async () => {
    const res = await API.deleteEnrollment(id);
    if (res.success) { toast('Enrollment removed'); loadEnrollments(); }
    else toast(res.message,'error');
  });
}

// ══════════════════════════════════════════════════
//   ADMIN — Departments
// ══════════════════════════════════════════════════
async function loadDepartments(silent=false) {
  const res = await API.getDepartments();
  if (!res.success) return;
  State.departments = res.data;
  if (!silent) renderDepartmentsTable(res.data);
  // Update filter dropdowns
  document.querySelectorAll('.dept-filter-select').forEach(el => {
    el.innerHTML = '<option value="">All Departments</option>' + res.data.map(d=>`<option value="${d.id}">${escHtml(d.name)}</option>`).join('');
  });
}

function renderDepartmentsTable(depts) {
  const tbody = document.getElementById('deptsTableBody');
  if (!tbody) return;
  if (!depts.length) { tbody.innerHTML='<tr><td colspan="4"><div class="empty-state"><div class="empty-icon">🏛️</div><h3>No departments</h3></div></td></tr>'; return; }
  tbody.innerHTML = depts.map(d=>`<tr>
    <td><strong>${escHtml(d.code)}</strong></td>
    <td>${escHtml(d.name)}</td>
    <td style="text-align:center"><span class="badge badge-active">${d.student_count}</span></td>
    <td><button class="btn btn-sm btn-outline btn-icon" style="color:var(--danger)" onclick="deleteDeptConfirm(${d.id},'${escHtml(d.name)}')" title="Delete">🗑️</button></td>
  </tr>`).join('');
}

function openAddDeptModal() {
  showModal('Add Department', `
    <form id="addDeptForm">
      <div class="form-group"><label class="form-label">Name <span class="required">*</span></label><input class="form-control" name="name" required placeholder="e.g. Computer Science"></div>
      <div class="form-group"><label class="form-label">Code <span class="required">*</span></label><input class="form-control" name="code" required placeholder="e.g. CS" style="text-transform:uppercase"></div>
    </form>`,
    async () => {
      const data = Object.fromEntries(new FormData(document.getElementById('addDeptForm')));
      data.code  = data.code.toUpperCase();
      const res  = await API.addDepartment(data);
      if (res.success) { toast('Department added'); closeModal(); loadDepartments(); }
      else toast(res.message,'error');
    }, 'Add Department', 'modal-sm');
}

function deleteDeptConfirm(id, name) {
  confirmDialog('Delete Department', `Delete "${name}"? Students will be unassigned.`, async () => {
    const res = await API.deleteDepartment(id);
    if (res.success) { toast('Department deleted'); loadDepartments(); }
    else toast(res.message,'error');
  });
}

// ─── Modal Helper ─────────────────────────────────
function showModal(title, bodyHtml, onSave, saveBtnText='Save', sizeClass='') {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'activeModal';
  overlay.innerHTML = `
    <div class="modal ${sizeClass}">
      <div class="modal-header">
        <h3>${escHtml(title)}</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      ${onSave ? `<div class="modal-footer">
        <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" id="modalSaveBtn" onclick="handleModalSave()">${escHtml(saveBtnText)}</button>
      </div>` : ''}
    </div>`;
  document.body.appendChild(overlay);
  overlay.onclick = (e) => { if (e.target===overlay) closeModal(); };
  if (onSave) window._modalSaveHandler = onSave;
}

async function handleModalSave() {
  const btn = document.getElementById('modalSaveBtn');
  if (!btn || !window._modalSaveHandler) return;
  btn.disabled = true;
  btn.innerHTML = '<span class="loading-spinner"></span>';
  try { await window._modalSaveHandler(); } finally { if (btn) { btn.disabled=false; btn.textContent = btn.dataset.label||'Save'; } }
}

function closeModal() { document.getElementById('activeModal')?.remove(); window._modalSaveHandler=null; }

// ─── Search/Filter Handlers ───────────────────────
function setupFilters() {
  ['studentsSearch','studentsFilterDept','studentsFilterStatus'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', debounce(() => {
      State.students.filters.search     = document.getElementById('studentsSearch')?.value||'';
      State.students.filters.department = document.getElementById('studentsFilterDept')?.value||'';
      State.students.filters.status     = document.getElementById('studentsFilterStatus')?.value||'';
      State.students.filters.page = 1;
      loadStudents();
    }, 400));
  });
  ['coursesSearch','coursesFilterDept'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', debounce(() => {
      State.coursesState.filters.search     = document.getElementById('coursesSearch')?.value||'';
      State.coursesState.filters.department = document.getElementById('coursesFilterDept')?.value||'';
      loadCourses();
    }, 400));
  });
}

function debounce(fn, ms) { let t; return (...args) => { clearTimeout(t); t=setTimeout(()=>fn(...args),ms); }; }

// ─── Init ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);
  document.getElementById('spLogoutBtn').addEventListener('click', _logout);
  document.getElementById('tpLogoutBtn').addEventListener('click', _logout);

  document.querySelectorAll('#app .nav-item').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.page));
  });
  document.querySelectorAll('#studentPortalApp .nav-item').forEach(el => {
    el.addEventListener('click', () => spNavigate(el.dataset.page));
  });
  document.querySelectorAll('#teacherPortalApp .nav-item').forEach(el => {
    el.addEventListener('click', () => tpNavigate(el.dataset.page));
  });

  setupFilters();

  // Check existing session
  const session = await API.checkSession();
  if (session.loggedIn) {
    State.user = session.user;
    document.getElementById('loginPage').style.display = 'none';
    await loadDepartments(true);
    await loadTeachers(true);
    await launchPortal(session.user);
  }
});

// ══════════════════════════════════════════════════
//   ADMIN — User Accounts Management
// ══════════════════════════════════════════════════

const _usersFilters = { search: '', role: '' };

function usersSearchHandler() {
  _usersFilters.search = document.getElementById('usersSearch')?.value || '';
  loadUsers();
}
function usersRoleFilter() {
  _usersFilters.role = document.getElementById('usersFilterRole')?.value || '';
  loadUsers();
}

async function loadUsers() {
  // Ensure fresh data for dropdowns
  if (!State.students.data || State.students.data.length === 0) { const sr = await API.getStudents({ limit:1000, page:1 }); if(sr.success) State.students.data = sr.data; }
  const tbody = document.getElementById('usersTableBody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="page-loading"><div class="loading-spinner"></div></td></tr>';
  const res = await API.getUsers(_usersFilters);
  if (!res.success) { toast(res.message, 'error'); return; }
  renderUsersTable(res.data);
}

const roleColors = { admin: '#7c3aed', staff: '#0e7490', teacher: '#059669', student: '#2563eb' };
const roleIcons  = { admin: '🛡️', staff: '👤', teacher: '👨‍🏫', student: '🎓' };

function renderUsersTable(users) {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;
  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">🔑</div><h3>No user accounts found</h3><p>Create the first account using the button above</p></div></td></tr>';
    return;
  }
  tbody.innerHTML = users.map(u => {
    const color  = roleColors[u.role] || '#64748b';
    const icon   = roleIcons[u.role]  || '👤';
    const initls = (u.full_name || 'U').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    const linkedBadge = u.linked_name
      ? `<span style="font-size:12px;background:#f1f5f9;border-radius:6px;padding:3px 8px;color:#334155">${escHtml(u.linked_code)} — ${escHtml(u.linked_name)}</span>`
      : `<span style="font-size:12px;color:var(--text-muted)">—</span>`;
    const isSelf = State.user && State.user.id == u.id;
    return `<tr>
      <td>
        <div class="student-info-cell">
          <div class="student-avatar" style="background:${color}">${initls}</div>
          <div>
            <div class="student-name">${escHtml(u.full_name)}</div>
            <div class="student-id-text">ID #${u.id}</div>
          </div>
        </div>
      </td>
      <td><code style="background:#f1f5f9;padding:2px 8px;border-radius:5px;font-size:13px">${escHtml(u.username)}</code></td>
      <td style="font-size:13px">${escHtml(u.email)}</td>
      <td>
        <span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600;background:${color}20;color:${color}">
          ${icon} ${u.role.charAt(0).toUpperCase() + u.role.slice(1)}
        </span>
      </td>
      <td>${linkedBadge}</td>
      <td style="font-size:12px;color:var(--text-muted)">${formatDate(u.created_at)}</td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-sm btn-outline btn-icon" onclick="editUserModal(${u.id})" title="Edit">✏️</button>
          ${!isSelf ? `<button class="btn btn-sm btn-outline btn-icon" style="color:var(--danger)" onclick="deleteUserConfirm(${u.id},'${escHtml(u.username)}')" title="Delete">🗑️</button>` : '<span style="padding:4px 8px;font-size:11px;color:var(--text-muted)">(you)</span>'}
        </div>
      </td>
    </tr>`;
  }).join('');
}

function openCreateUserModal() {
  const studentOptions = (State.students.data || []).map(s =>
    `<option value="${s.id}">${escHtml(s.student_id + ' — ' + s.first_name + ' ' + s.last_name)}</option>`
  ).join('');
  const teacherOptions = State.teachers.map(t =>
    `<option value="${t.id}">${escHtml(t.teacher_id + ' — ' + t.first_name + ' ' + t.last_name)}</option>`
  ).join('');

  showModal('Create User Account', `
    <form id="createUserForm" autocomplete="off">
      <div class="form-group">
        <label class="form-label">Role <span class="required">*</span></label>
        <div class="role-picker" id="rolePicker">
          <label class="role-option" data-role="admin">
            <input type="radio" name="role" value="admin" required>
            <div class="role-card"><span class="role-icon">🛡️</span><span class="role-label">Admin</span></div>
          </label>
          <label class="role-option" data-role="staff">
            <input type="radio" name="role" value="staff">
            <div class="role-card"><span class="role-icon">👤</span><span class="role-label">Staff</span></div>
          </label>
          <label class="role-option" data-role="teacher">
            <input type="radio" name="role" value="teacher">
            <div class="role-card"><span class="role-icon">👨‍🏫</span><span class="role-label">Teacher</span></div>
          </label>
          <label class="role-option" data-role="student">
            <input type="radio" name="role" value="student">
            <div class="role-card"><span class="role-icon">🎓</span><span class="role-label">Student</span></div>
          </label>
        </div>
      </div>

      <div id="linkSection" style="display:none;margin-bottom:16px;">
        <div class="form-group" id="linkStudentGroup" style="display:none;">
          <label class="form-label">Link to Existing Student</label>
          <select class="form-control" name="ref_id" id="linkStudentSel">
            <option value="">— Select student (optional) —</option>${studentOptions}
          </select>
        </div>
        <div class="form-group" id="linkTeacherGroup" style="display:none;">
          <label class="form-label">Link to Existing Teacher</label>
          <select class="form-control" name="ref_id" id="linkTeacherSel">
            <option value="">— Select teacher (optional) —</option>${teacherOptions}
          </select>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Full Name <span class="required">*</span></label>
        <input class="form-control" name="full_name" id="newUserFullName" required placeholder="e.g. Ahmed Hassan" autocomplete="off">
      </div>
      <div class="form-group">
        <label class="form-label">Email <span class="required">*</span></label>
        <input class="form-control" type="email" name="email" id="newUserEmail" required placeholder="e.g. ahmed@university.edu" autocomplete="off">
      </div>
      <hr style="margin:16px 0;border-color:var(--border)">
      <p style="font-size:13px;font-weight:600;margin-bottom:12px;color:var(--primary)">🔐 Login Credentials</p>
      <div class="form-row cols-2">
        <div class="form-group">
          <label class="form-label">Username <span class="required">*</span></label>
          <input class="form-control" name="username" required placeholder="e.g. ahmed.hassan" autocomplete="new-password">
        </div>
        <div class="form-group">
          <label class="form-label">Password <span class="required">*</span></label>
          <input class="form-control" type="password" name="password" required placeholder="Set a strong password" autocomplete="new-password">
        </div>
      </div>
    </form>`,
    async () => {
      const form = document.getElementById('createUserForm');
      const data = Object.fromEntries(new FormData(form));
      if (!data.role)     { toast('Please select a role', 'error'); return; }
      if (!data.full_name || !data.email || !data.username || !data.password) {
        toast('Please fill all required fields', 'error'); return;
      }
      const res = await API.createUser(data);
      if (res.success) { toast('Account created — Username: ' + data.username); closeModal(); loadUsers(); }
      else toast(res.message, 'error');
    }, 'Create Account');

  // Role picker interaction
  setTimeout(() => {
    document.querySelectorAll('#rolePicker input[type=radio]').forEach(radio => {
      radio.addEventListener('change', () => {
        document.querySelectorAll('.role-card').forEach(c => c.classList.remove('selected'));
        radio.closest('.role-card').classList.add('selected');
        const role = radio.value;
        const linkSection      = document.getElementById('linkSection');
        const linkStudentGroup = document.getElementById('linkStudentGroup');
        const linkTeacherGroup = document.getElementById('linkTeacherGroup');
        if (role === 'student') {
          linkSection.style.display = 'block'; linkStudentGroup.style.display = 'block'; linkTeacherGroup.style.display = 'none';
        } else if (role === 'teacher') {
          linkSection.style.display = 'block'; linkTeacherGroup.style.display = 'block'; linkStudentGroup.style.display = 'none';
        } else {
          linkSection.style.display = 'none';
        }
        // Auto-fill name/email from linked record
        const sel = document.getElementById(role === 'student' ? 'linkStudentSel' : 'linkTeacherSel');
        if (sel) sel.addEventListener('change', () => autoFillFromLink(role, sel.value));
      });
    });
  }, 50);
}

async function autoFillFromLink(role, refId) {
  if (!refId) return;
  if (role === 'student') {
    const s = State.students.data.find(s => s.id == refId);
    if (s) {
      document.getElementById('newUserFullName').value = s.first_name + ' ' + s.last_name;
      document.getElementById('newUserEmail').value    = s.email;
    }
  } else if (role === 'teacher') {
    const t = State.teachers.find(t => t.id == refId);
    if (t) {
      document.getElementById('newUserFullName').value = t.first_name + ' ' + t.last_name;
      document.getElementById('newUserEmail').value    = t.email;
    }
  }
}

async function editUserModal(id) {
  const res = await API.getUser(id);
  if (!res.success) { toast('Failed to load', 'error'); return; }
  const u = res.data;

  showModal('Edit User — ' + escHtml(u.username), `
    <form id="editUserForm" autocomplete="off">
      <div class="form-group">
        <label class="form-label">Role</label>
        <select class="form-control" name="role">
          <option value="admin"   ${u.role==='admin'  ?'selected':''}>🛡️ Admin</option>
          <option value="staff"   ${u.role==='staff'  ?'selected':''}>👤 Staff</option>
          <option value="teacher" ${u.role==='teacher'?'selected':''}>👨‍🏫 Teacher</option>
          <option value="student" ${u.role==='student'?'selected':''}>🎓 Student</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Full Name <span class="required">*</span></label>
        <input class="form-control" name="full_name" required value="${escHtml(u.full_name)}">
      </div>
      <div class="form-group">
        <label class="form-label">Email <span class="required">*</span></label>
        <input class="form-control" type="email" name="email" required value="${escHtml(u.email)}">
      </div>
      <div class="form-group">
        <label class="form-label">Username <span class="required">*</span></label>
        <input class="form-control" name="username" required value="${escHtml(u.username)}" autocomplete="off">
      </div>
      <div class="form-group">
        <label class="form-label">New Password <small style="color:var(--text-muted)">(leave blank to keep current)</small></label>
        <input class="form-control" type="password" name="password" placeholder="Enter new password..." autocomplete="new-password">
      </div>
    </form>`,
    async () => {
      const data = Object.fromEntries(new FormData(document.getElementById('editUserForm')));
      const result = await API.updateUser(id, data);
      if (result.success) { toast('User updated'); closeModal(); loadUsers(); }
      else toast(result.message, 'error');
    }, 'Save Changes');
}

function deleteUserConfirm(id, username) {
  confirmDialog('Delete Account', `Delete account "${username}"? This action cannot be undone.`, async () => {
    const res = await API.deleteUser(id);
    if (res.success) { toast('Account deleted'); loadUsers(); }
    else toast(res.message, 'error');
  });
}
