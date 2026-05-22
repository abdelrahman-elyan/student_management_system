<?php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

switch ($method) {
    case 'GET':
        if ($action === 'single')    getTeacher($_GET['id'] ?? 0);
        elseif ($action === 'portal') teacherPortal();
        else getTeachers();
        break;
    case 'POST':   addTeacher();                    break;
    case 'PUT':    updateTeacher($_GET['id'] ?? 0); break;
    case 'DELETE': deleteTeacher($_GET['id'] ?? 0); break;
    default: echo json_encode(['success' => false, 'message' => 'Method not allowed']);
}

function getTeachers() {
    $conn = getConnection();
    $sql = "SELECT t.*, d.name as department_name,
                   u.username as login_username,
                   IF(u.id IS NOT NULL, 1, 0) as has_account
            FROM teachers t
            LEFT JOIN departments d ON t.department_id = d.id
            LEFT JOIN users u ON u.role='teacher' AND u.ref_id=t.id
            ORDER BY t.first_name";
    $result = $conn->query($sql);
    echo json_encode(['success' => true, 'data' => $result->fetch_all(MYSQLI_ASSOC)]);
    $conn->close();
}

function getTeacher($id) {
    if (!$id) { echo json_encode(['success' => false, 'message' => 'ID required']); return; }
    $conn = getConnection();
    $stmt = $conn->prepare("SELECT t.*, d.name as department_name FROM teachers t LEFT JOIN departments d ON t.department_id = d.id WHERE t.id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $teacher = $stmt->get_result()->fetch_assoc();
    echo json_encode(['success' => true, 'data' => $teacher]);
    $conn->close();
}

function teacherPortal() {
    $conn = getConnection();
    $teacherId = (int)($_GET['teacher_id'] ?? 0);
    if (!$teacherId) { echo json_encode(['success'=>false,'message'=>'teacher_id required']); return; }

    $stmt = $conn->prepare("SELECT t.*, d.name as department_name FROM teachers t LEFT JOIN departments d ON t.department_id = d.id WHERE t.id = ?");
    $stmt->bind_param("i", $teacherId);
    $stmt->execute();
    $teacher = $stmt->get_result()->fetch_assoc();
    if (!$teacher) { echo json_encode(['success'=>false,'message'=>'Teacher not found']); return; }

    $cStmt = $conn->prepare("
        SELECT c.*, d.name as department_name,
               COUNT(e.id) as enrolled_count
        FROM courses c
        LEFT JOIN departments d ON c.department_id = d.id
        LEFT JOIN enrollments e ON c.id = e.course_id
        WHERE c.teacher_id = ?
        GROUP BY c.id
        ORDER BY c.course_name
    ");
    $cStmt->bind_param("i", $teacherId);
    $cStmt->execute();
    $teacher['courses'] = $cStmt->get_result()->fetch_all(MYSQLI_ASSOC);

    echo json_encode(['success' => true, 'data' => $teacher]);
    $conn->close();
}

function addTeacher() {
    $data = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $required = ['first_name','last_name','email'];
    foreach ($required as $f) {
        if (empty($data[$f])) { echo json_encode(['success'=>false,'message'=>"Field '$f' is required"]); return; }
    }

    $conn = getConnection();
    $cnt = $conn->query("SELECT COUNT(*) as c FROM teachers")->fetch_assoc()['c'] + 1;
    $teacherId = 'TCH' . str_pad($cnt, 3, '0', STR_PAD_LEFT);

    $deptId = !empty($data['department_id']) ? (int)$data['department_id'] : null;
    $phone  = $data['phone'] ?? null;
    $status = $data['status'] ?? 'Active';

    $stmt = $conn->prepare("INSERT INTO teachers (teacher_id, first_name, last_name, email, phone, department_id, status) VALUES (?,?,?,?,?,?,?)");
    $stmt->bind_param("sssssis", $teacherId, $data['first_name'], $data['last_name'], $data['email'], $phone, $deptId, $status);

    if ($stmt->execute()) {
        $newId = $conn->insert_id;
        $accountCreated = false;

        if (!empty($data['username']) && !empty($data['password'])) {
            $hashed   = password_hash($data['password'], PASSWORD_DEFAULT);
            $fullName = $data['first_name'] . ' ' . $data['last_name'];
            $uStmt    = $conn->prepare("INSERT INTO users (username, password, full_name, email, role, ref_id) VALUES (?,?,?,?,?,?)");
            $uStmt->bind_param("sssssi", $data['username'], $hashed, $fullName, $data['email'], 'teacher', $newId);
            $accountCreated = $uStmt->execute();
        }
        echo json_encode(['success'=>true,'message'=>'Teacher added','teacher_id'=>$teacherId,'id'=>$newId,'account_created'=>$accountCreated]);
    } else {
        $err = $conn->error;
        if (strpos($err,'Duplicate')!==false) echo json_encode(['success'=>false,'message'=>'Email already exists']);
        else echo json_encode(['success'=>false,'message'=>'Failed: '.$err]);
    }
    $conn->close();
}

function updateTeacher($id) {
    if (!$id) { echo json_encode(['success'=>false,'message'=>'ID required']); return; }
    $data = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $conn = getConnection();
    $deptId = !empty($data['department_id']) ? (int)$data['department_id'] : null;
    $phone  = $data['phone'] ?? null;
    $status = $data['status'] ?? 'Active';
    $stmt = $conn->prepare("UPDATE teachers SET first_name=?, last_name=?, email=?, phone=?, department_id=?, status=? WHERE id=?");
    $stmt->bind_param("ssssisi", $data['first_name'], $data['last_name'], $data['email'], $phone, $deptId, $status, $id);
    echo json_encode(['success'=>$stmt->execute(), 'message'=>'Updated']);
    $conn->close();
}

function deleteTeacher($id) {
    if (!$id) { echo json_encode(['success'=>false,'message'=>'ID required']); return; }
    $conn = getConnection();
    $uStmt = $conn->prepare("DELETE FROM users WHERE role='teacher' AND ref_id=?");
    $uStmt->bind_param("i", $id);
    $uStmt->execute();
    $stmt = $conn->prepare("DELETE FROM teachers WHERE id=?");
    $stmt->bind_param("i", $id);
    echo json_encode(['success'=>$stmt->execute(),'message'=>'Teacher deleted']);
    $conn->close();
}
?>
