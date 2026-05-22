// ================================================
// Student Management System - API Module
// ================================================

const API = {
  base: 'php/',

  async request(endpoint, method = 'GET', data = null, params = {}) {
    const url = new URL(this.base + endpoint, window.location.href);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== '' && v !== null && v !== undefined) url.searchParams.set(k, v);
    });
    const options = { method, headers: {} };
    if (data && method !== 'GET') {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(data);
    }
    try {
      const res  = await fetch(url, options);
      const json = await res.json();
      return json;
    } catch (e) {
      console.error('API Error:', e);
      return { success: false, message: 'Network error. Check your server connection.' };
    }
  },

  // Auth
  login:        (d)       => API.request('auth.php', 'POST', d, { action: 'login' }),
  logout:       ()        => API.request('auth.php', 'GET', null, { action: 'logout' }),
  checkSession: ()        => API.request('auth.php', 'GET', null, { action: 'check' }),

  // Students
  getStudents:  (p)       => API.request('students.php', 'GET', null, p),
  getStudent:   (id)      => API.request('students.php', 'GET', null, { action: 'single', id }),
  addStudent:   (d)       => API.request('students.php', 'POST', d),
  updateStudent:(id, d)   => API.request('students.php?id=' + id, 'PUT', d),
  deleteStudent:(id)      => API.request('students.php?id=' + id, 'DELETE'),
  getStats:     ()        => API.request('students.php', 'GET', null, { action: 'stats' }),

  // Teachers
  getTeachers:  ()        => API.request('teachers.php', 'GET'),
  getTeacher:   (id)      => API.request('teachers.php', 'GET', null, { action: 'single', id }),
  addTeacher:   (d)       => API.request('teachers.php', 'POST', d),
  updateTeacher:(id, d)   => API.request('teachers.php?id=' + id, 'PUT', d),
  deleteTeacher:(id)      => API.request('teachers.php?id=' + id, 'DELETE'),
  getTeacherPortal:(tid)  => API.request('teachers.php', 'GET', null, { action: 'portal', teacher_id: tid }),

  // Courses
  getCourses:   (p)       => API.request('courses.php', 'GET', null, p),
  getCourse:    (id)      => API.request('courses.php', 'GET', null, { action: 'single', id }),
  addCourse:    (d)       => API.request('courses.php', 'POST', d),
  updateCourse: (id, d)   => API.request('courses.php?id=' + id, 'PUT', d),
  deleteCourse: (id)      => API.request('courses.php?id=' + id, 'DELETE'),

  // Departments
  getDepartments: ()      => API.request('courses.php', 'GET', null, { type: 'departments' }),
  addDepartment:  (d)     => API.request('courses.php?type=departments', 'POST', d),
  deleteDepartment:(id)   => API.request('courses.php?type=departments&id=' + id, 'DELETE'),

  // Enrollments
  getEnrollments: (p)     => API.request('enrollments.php', 'GET', null, p),
  addEnrollment:  (d)     => API.request('enrollments.php', 'POST', d),
  updateEnrollment:(id,d) => API.request('enrollments.php?id=' + id, 'PUT', d),
  deleteEnrollment:(id)   => API.request('enrollments.php?id=' + id, 'DELETE'),

  // Student Portal
  getStudentPortal: (sid)         => API.request('student_portal.php', 'GET', null, { action: 'info',      student_id: sid }),
  getAvailableCourses: (sid, sem) => API.request('student_portal.php', 'GET', null, { action: 'available', student_id: sid, semester: sem }),
  studentEnroll: (sid, d)         => API.request('student_portal.php?action=enroll&student_id=' + sid, 'POST', d),
  studentDrop: (sid, eid)         => API.request('student_portal.php?action=drop&student_id=' + sid + '&enroll_id=' + eid, 'GET'),

  // Teacher Portal
  getTeacherCourses:  (tid)        => API.request('teacher_portal.php', 'GET', null, { action: 'courses',  teacher_id: tid }),
  getCourseStudents:  (tid, cid)   => API.request('teacher_portal.php', 'GET', null, { action: 'students', teacher_id: tid, course_id: cid }),
  updateTeacherGrade: (tid, eid, d)=> API.request('teacher_portal.php?action=grade&teacher_id=' + tid + '&enroll_id=' + eid, 'PUT', d),
};

// Users Management
API.getUsers    = (p)       => API.request('users.php', 'GET', null, p);
API.getUser     = (id)      => API.request('users.php', 'GET', null, { action: 'single', id });
API.createUser  = (d)       => API.request('users.php', 'POST', d);
API.updateUser  = (id, d)   => API.request('users.php?id=' + id, 'PUT', d);
API.deleteUser  = (id)      => API.request('users.php?id=' + id, 'DELETE');
