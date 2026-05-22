<?php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? 'courses';
$teacherId = (int)($_GET['teacher_id'] ?? 0);

if (!$teacherId) { echo json_encode(['success'=>false,'message'=>'teacher_id required']); exit; }

switch ($action) {
    case 'courses':  getTeacherCourses($teacherId);               break;
    case 'students': getCourseStudents($teacherId);               break;
    case 'grade':    updateGrade($teacherId);                     break;
    default: echo json_encode(['success'=>false,'message'=>'Invalid action']);
}

function getTeacherCourses($teacherId) {
    $conn = getConnection();
    $stmt = $conn->prepare("
        SELECT c.*, d.name as department_name,
               COUNT(e.id) as enrolled_count
        FROM courses c
        LEFT JOIN departments d ON c.department_id = d.id
        LEFT JOIN enrollments e ON c.id = e.course_id AND e.status != 'Dropped'
        WHERE c.teacher_id = ?
        GROUP BY c.id
        ORDER BY c.course_name
    ");
    $stmt->bind_param("i", $teacherId);
    $stmt->execute();
    echo json_encode(['success'=>true,'data'=>$stmt->get_result()->fetch_all(MYSQLI_ASSOC)]);
    $conn->close();
}

function getCourseStudents($teacherId) {
    $courseId = (int)($_GET['course_id'] ?? 0);
    if (!$courseId) { echo json_encode(['success'=>false,'message'=>'course_id required']); return; }

    $conn = getConnection();
    // Verify teacher owns course
    $chk = $conn->prepare("SELECT id FROM courses WHERE id=? AND teacher_id=?");
    $chk->bind_param("ii", $courseId, $teacherId);
    $chk->execute();
    if ($chk->get_result()->num_rows === 0) { echo json_encode(['success'=>false,'message'=>'Unauthorized']); $conn->close(); return; }

    $stmt = $conn->prepare("
        SELECT e.id as enrollment_id, e.semester, e.status,
               e.midterm, e.assignments, e.final_exam, e.grade, e.grade_letter,
               s.id as student_id, s.student_id as student_code,
               CONCAT(s.first_name,' ',s.last_name) as student_name,
               s.email
        FROM enrollments e
        JOIN students s ON e.student_id = s.id
        WHERE e.course_id = ?
        ORDER BY s.first_name
    ");
    $stmt->bind_param("i", $courseId);
    $stmt->execute();
    echo json_encode(['success'=>true,'data'=>$stmt->get_result()->fetch_all(MYSQLI_ASSOC)]);
    $conn->close();
}

function updateGrade($teacherId) {
    $enrollId = (int)($_GET['enroll_id'] ?? 0);
    if (!$enrollId) { echo json_encode(['success'=>false,'message'=>'enroll_id required']); return; }

    $data = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $conn = getConnection();

    // Verify teacher owns this enrollment's course
    $chk = $conn->prepare("SELECT e.id FROM enrollments e JOIN courses c ON e.course_id = c.id WHERE e.id=? AND c.teacher_id=?");
    $chk->bind_param("ii", $enrollId, $teacherId);
    $chk->execute();
    if ($chk->get_result()->num_rows === 0) { echo json_encode(['success'=>false,'message'=>'Unauthorized']); $conn->close(); return; }

    $midterm     = isset($data['midterm'])     && $data['midterm']     !== '' ? (float)$data['midterm']     : null;
    $assignments = isset($data['assignments']) && $data['assignments'] !== '' ? (float)$data['assignments'] : null;
    $finalExam   = isset($data['final_exam'])  && $data['final_exam']  !== '' ? (float)$data['final_exam']  : null;

    // Compute overall grade: Midterm 30%, Assignments 20%, Final 50%
    $grade = null; $gradeLetter = null;
    if ($midterm !== null && $assignments !== null && $finalExam !== null) {
        $grade = round($midterm * 0.30 + $assignments * 0.20 + $finalExam * 0.50, 2);
    } elseif (isset($data['grade']) && $data['grade'] !== '') {
        $grade = (float)$data['grade'];
    }

    if ($grade !== null) {
        if ($grade >= 90)      $gradeLetter = 'A';
        elseif ($grade >= 85)  $gradeLetter = 'B+';
        elseif ($grade >= 80)  $gradeLetter = 'B';
        elseif ($grade >= 75)  $gradeLetter = 'C+';
        elseif ($grade >= 70)  $gradeLetter = 'C';
        elseif ($grade >= 65)  $gradeLetter = 'D+';
        elseif ($grade >= 60)  $gradeLetter = 'D';
        else                   $gradeLetter = 'F';
    }

    $status = $data['status'] ?? null;

    $stmt = $conn->prepare("UPDATE enrollments SET midterm=?, assignments=?, final_exam=?, grade=?, grade_letter=?, status=COALESCE(?,status) WHERE id=?");
    $stmt->bind_param("ddddssi", $midterm, $assignments, $finalExam, $grade, $gradeLetter, $status, $enrollId);

    if ($stmt->execute()) {
        echo json_encode(['success'=>true,'message'=>'Grade updated','grade'=>$grade,'grade_letter'=>$gradeLetter]);
    } else {
        echo json_encode(['success'=>false,'message'=>'Failed: '.$conn->error]);
    }
    $conn->close();
}
?>
