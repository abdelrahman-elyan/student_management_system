<?php
require_once 'config.php';

$action    = $_GET['action'] ?? 'info';
$studentId = (int)($_GET['student_id'] ?? 0);

// Safety: if student_id=0 try to resolve from session username/email via users table
if (!$studentId) {
    echo json_encode(['success'=>false,'message'=>'student_id required']);
    exit;
}

switch ($action) {
    case 'info':      getStudentInfo($studentId);      break;
    case 'available': getAvailableCourses($studentId); break;
    case 'enroll':    enrollStudent($studentId);       break;
    case 'drop':      dropCourse($studentId);          break;
    default: echo json_encode(['success'=>false,'message'=>'Invalid action']);
}

/* ─── helpers ─────────────────────────────── */
function gradeToGpaPoints($grade) {
    if ($grade >= 90) return 4.0;
    if ($grade >= 85) return 3.7;
    if ($grade >= 80) return 3.3;
    if ($grade >= 75) return 3.0;
    if ($grade >= 70) return 2.7;
    if ($grade >= 65) return 2.3;
    if ($grade >= 60) return 2.0;
    return 0.0;
}

/* ─── Student info + enrollments + GPA ─────── */
function getStudentInfo($studentId) {
    $conn = getConnection();

    $stmt = $conn->prepare("
        SELECT s.*, d.name as department_name
        FROM students s
        LEFT JOIN departments d ON s.department_id = d.id
        WHERE s.id = ?
    ");
    $stmt->bind_param("i", $studentId);
    $stmt->execute();
    $student = $stmt->get_result()->fetch_assoc();

    if (!$student) {
        echo json_encode(['success'=>false,'message'=>'Student not found (ID='.$studentId.')']);
        $conn->close(); return;
    }

    $eStmt = $conn->prepare("
        SELECT e.*, c.course_name, c.course_code, c.credits,
               CONCAT(t.first_name,' ',t.last_name) as teacher_name
        FROM enrollments e
        JOIN courses c ON e.course_id = c.id
        LEFT JOIN teachers t ON c.teacher_id = t.id
        WHERE e.student_id = ?
        ORDER BY e.enrollment_date DESC
    ");
    $eStmt->bind_param("i", $studentId);
    $eStmt->execute();
    $enrollments = $eStmt->get_result()->fetch_all(MYSQLI_ASSOC);

    $totalCredits = 0; $totalPoints = 0;
    foreach ($enrollments as $e) {
        if ($e['grade'] !== null && $e['status'] !== 'Dropped') {
            $pts = gradeToGpaPoints((float)$e['grade']);
            $totalPoints  += $pts * $e['credits'];
            $totalCredits += $e['credits'];
        }
    }

    $student['enrollments']         = $enrollments;
    $student['gpa']                 = $totalCredits > 0 ? round($totalPoints / $totalCredits, 2) : null;
    $student['total_credits_earned'] = $totalCredits;

    echo json_encode(['success'=>true,'data'=>$student]);
    $conn->close();
}

/* ─── Available courses (not yet enrolled, same dept shown first) ─── */
function getAvailableCourses($studentId) {
    $conn     = getConnection();
    $semester = $_GET['semester'] ?? '';
    if (!$semester) {
        echo json_encode(['success'=>false,'message'=>'semester required']);
        $conn->close(); return;
    }

    // Get student's department
    $dStmt = $conn->prepare("SELECT department_id FROM students WHERE id = ?");
    $dStmt->bind_param("i", $studentId);
    $dStmt->execute();
    $row = $dStmt->get_result()->fetch_assoc();

    if (!$row) {
        echo json_encode(['success'=>false,'message'=>'Student not found']);
        $conn->close(); return;
    }

    $deptId = $row['department_id']; // may be NULL

    // All courses not already enrolled in this semester
    // Order: student's own department first, then others
    $stmt = $conn->prepare("
        SELECT c.*,
               d.name as department_name,
               CONCAT(t.first_name,' ',t.last_name) as teacher_name,
               CASE WHEN c.department_id = ? THEN 0 ELSE 1 END as dept_order
        FROM courses c
        LEFT JOIN departments d ON c.department_id = d.id
        LEFT JOIN teachers t   ON c.teacher_id     = t.id
        WHERE c.id NOT IN (
            SELECT course_id
            FROM enrollments
            WHERE student_id = ? AND semester = ?
        )
        ORDER BY dept_order ASC, c.course_name ASC
    ");
    $stmt->bind_param("iis", $deptId, $studentId, $semester);
    $stmt->execute();
    $courses = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

    echo json_encode([
        'success'        => true,
        'data'           => $courses,
        'student_dept_id'=> $deptId
    ]);
    $conn->close();
}

/* ─── Enroll ────────────────────────────────── */
function enrollStudent($studentId) {
    $data     = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $courseId = (int)($data['course_id'] ?? 0);
    $semester = $data['semester'] ?? '';

    if (!$courseId || !$semester) {
        echo json_encode(['success'=>false,'message'=>'course_id and semester required']); return;
    }

    $conn = getConnection();
    $chk  = $conn->prepare("SELECT id FROM enrollments WHERE student_id=? AND course_id=? AND semester=?");
    $chk->bind_param("iis", $studentId, $courseId, $semester);
    $chk->execute();
    if ($chk->get_result()->num_rows > 0) {
        echo json_encode(['success'=>false,'message'=>'Already enrolled in this course for this semester']);
        $conn->close(); return;
    }

    $stmt = $conn->prepare("INSERT INTO enrollments (student_id, course_id, semester, enrollment_date, status) VALUES (?,?,?,CURDATE(),'Enrolled')");
    $stmt->bind_param("iis", $studentId, $courseId, $semester);
    if ($stmt->execute())
        echo json_encode(['success'=>true,'message'=>'Enrolled successfully']);
    else
        echo json_encode(['success'=>false,'message'=>'Failed: '.$conn->error]);
    $conn->close();
}

/* ─── Drop ──────────────────────────────────── */
function dropCourse($studentId) {
    $enrollId = (int)($_GET['enroll_id'] ?? 0);
    if (!$enrollId) { echo json_encode(['success'=>false,'message'=>'enroll_id required']); return; }

    $conn = getConnection();
    $stmt = $conn->prepare("UPDATE enrollments SET status='Dropped' WHERE id=? AND student_id=? AND status='Enrolled'");
    $stmt->bind_param("ii", $enrollId, $studentId);
    $stmt->execute();
    echo json_encode([
        'success' => $stmt->affected_rows > 0,
        'message' => $stmt->affected_rows > 0 ? 'Course dropped' : 'Could not drop course'
    ]);
    $conn->close();
}
?>
