<?php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

switch ($method) {
    case 'GET':    getEnrollments(); break;
    case 'POST':   addEnrollment();  break;
    case 'PUT':    updateEnrollment($_GET['id'] ?? 0); break;
    case 'DELETE': deleteEnrollment($_GET['id'] ?? 0); break;
}

function getEnrollments() {
    $conn = getConnection();
    $studentId = $_GET['student_id'] ?? '';
    $courseId  = $_GET['course_id']  ?? '';
    $semester  = $_GET['semester']   ?? '';
    $status    = $_GET['status']     ?? '';

    $where = []; $params = []; $types = '';

    if ($studentId) { $where[] = "e.student_id = ?"; $params[] = $studentId; $types .= 'i'; }
    if ($courseId)  { $where[] = "e.course_id = ?";  $params[] = $courseId;  $types .= 'i'; }
    if ($semester)  { $where[] = "e.semester = ?";   $params[] = $semester;  $types .= 's'; }
    if ($status)    { $where[] = "e.status = ?";     $params[] = $status;    $types .= 's'; }

    $wc  = $where ? 'WHERE ' . implode(' AND ', $where) : '';
    $sql = "SELECT e.*,
                   CONCAT(s.first_name, ' ', s.last_name) as student_name,
                   s.student_id as student_code,
                   c.course_name, c.course_code, c.credits
            FROM enrollments e
            JOIN students s ON e.student_id = s.id
            JOIN courses c  ON e.course_id  = c.id
            $wc ORDER BY e.created_at DESC";

    $stmt = $conn->prepare($sql);
    if ($params) $stmt->bind_param($types, ...$params);
    $stmt->execute();
    echo json_encode(['success' => true, 'data' => $stmt->get_result()->fetch_all(MYSQLI_ASSOC)]);
    $conn->close();
}

function addEnrollment() {
    $data = json_decode(file_get_contents('php://input'), true) ?? $_POST;

    if (empty($data['student_id']) || empty($data['course_id']) || empty($data['semester'])) {
        echo json_encode(['success' => false, 'message' => 'Student, course, and semester are required']);
        return;
    }

    $conn = getConnection();
    $check = $conn->prepare("SELECT id FROM enrollments WHERE student_id=? AND course_id=? AND semester=?");
    $check->bind_param("iis", $data['student_id'], $data['course_id'], $data['semester']);
    $check->execute();
    if ($check->get_result()->num_rows > 0) {
        echo json_encode(['success' => false, 'message' => 'Student already enrolled in this course for this semester']);
        $conn->close(); return;
    }

    $stmt = $conn->prepare("INSERT INTO enrollments (student_id, course_id, semester, enrollment_date, status) VALUES (?, ?, ?, CURDATE(), 'Enrolled')");
    $stmt->bind_param("iis", $data['student_id'], $data['course_id'], $data['semester']);

    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Enrollment added successfully', 'id' => $conn->insert_id]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to add enrollment: ' . $conn->error]);
    }
    $conn->close();
}

function updateEnrollment($id) {
    if (!$id) { echo json_encode(['success' => false, 'message' => 'ID required']); return; }
    $data = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $conn = getConnection();

    $midterm     = isset($data['midterm'])     && $data['midterm']     !== '' ? (float)$data['midterm']     : null;
    $assignments = isset($data['assignments']) && $data['assignments'] !== '' ? (float)$data['assignments'] : null;
    $finalExam   = isset($data['final_exam'])  && $data['final_exam']  !== '' ? (float)$data['final_exam']  : null;

    // Auto-compute grade from components if all present
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

    $status = $data['status'] ?? 'Enrolled';
    $stmt = $conn->prepare("UPDATE enrollments SET midterm=?, assignments=?, final_exam=?, grade=?, grade_letter=?, status=? WHERE id=?");
    $stmt->bind_param("ddddssi", $midterm, $assignments, $finalExam, $grade, $gradeLetter, $status, $id);

    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Grade updated successfully', 'grade_letter' => $gradeLetter, 'grade' => $grade]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to update: ' . $conn->error]);
    }
    $conn->close();
}

function deleteEnrollment($id) {
    if (!$id) { echo json_encode(['success' => false, 'message' => 'ID required']); return; }
    $conn = getConnection();
    $stmt = $conn->prepare("DELETE FROM enrollments WHERE id = ?");
    $stmt->bind_param("i", $id);
    echo json_encode(['success' => $stmt->execute(), 'message' => 'Enrollment removed']);
    $conn->close();
}
?>
