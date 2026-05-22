<?php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

switch ($method) {
    case 'GET':
        if ($action === 'single') getStudent($_GET['id'] ?? 0);
        elseif ($action === 'stats') getStats();
        else getStudents();
        break;
    case 'POST':   addStudent();                    break;
    case 'PUT':    updateStudent($_GET['id'] ?? 0); break;
    case 'DELETE': deleteStudent($_GET['id'] ?? 0); break;
    default: echo json_encode(['success' => false, 'message' => 'Method not allowed']);
}

function getStudents() {
    $conn = getConnection();
    $search     = $_GET['search']     ?? '';
    $department = $_GET['department'] ?? '';
    $status     = $_GET['status']     ?? '';
    $page   = max(1, (int)($_GET['page']  ?? 1));
    $limit  = (int)($_GET['limit'] ?? 10);
    $offset = ($page - 1) * $limit;

    $where = []; $params = []; $types = '';

    if ($search) {
        $where[] = "(s.first_name LIKE ? OR s.last_name LIKE ? OR s.student_id LIKE ? OR s.email LIKE ?)";
        $s = "%$search%";
        $params = array_merge($params, [$s,$s,$s,$s]); $types .= 'ssss';
    }
    if ($department) { $where[] = "s.department_id = ?"; $params[] = $department; $types .= 'i'; }
    if ($status)     { $where[] = "s.status = ?";        $params[] = $status;     $types .= 's'; }

    $wc = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $countStmt = $conn->prepare("SELECT COUNT(*) as total FROM students s $wc");
    if ($params) $countStmt->bind_param($types, ...$params);
    $countStmt->execute();
    $total = $countStmt->get_result()->fetch_assoc()['total'];

    $sql = "SELECT s.*, d.name as department_name,
                   u.username as login_username
            FROM students s
            LEFT JOIN departments d ON s.department_id = d.id
            LEFT JOIN users u ON u.role='student' AND u.ref_id=s.id
            $wc ORDER BY s.created_at DESC LIMIT ? OFFSET ?";
    $stmt = $conn->prepare($sql);
    $params[] = $limit; $params[] = $offset; $types .= 'ii';
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $students = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $conn->close();

    echo json_encode([
        'success' => true,
        'data' => $students,
        'pagination' => [
            'total' => (int)$total,
            'page'  => $page,
            'limit' => $limit,
            'pages' => (int)ceil($total / $limit)
        ]
    ]);
}

function getStudent($id) {
    if (!$id) { echo json_encode(['success' => false, 'message' => 'ID required']); return; }
    $conn = getConnection();
    $stmt = $conn->prepare("SELECT s.*, d.name as department_name, u.username as login_username FROM students s LEFT JOIN departments d ON s.department_id = d.id LEFT JOIN users u ON u.role='student' AND u.ref_id=s.id WHERE s.id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $student = $stmt->get_result()->fetch_assoc();

    if ($student) {
        $enStmt = $conn->prepare("SELECT e.*, c.course_name, c.course_code, c.credits FROM enrollments e JOIN courses c ON e.course_id = c.id WHERE e.student_id = ? ORDER BY e.enrollment_date DESC");
        $enStmt->bind_param("i", $id);
        $enStmt->execute();
        $student['enrollments'] = $enStmt->get_result()->fetch_all(MYSQLI_ASSOC);
        echo json_encode(['success' => true, 'data' => $student]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Student not found']);
    }
    $conn->close();
}

function addStudent() {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data) $data = $_POST;

    $required = ['first_name','last_name','email','gender','enrollment_date'];
    foreach ($required as $field) {
        if (empty($data[$field])) { echo json_encode(['success' => false, 'message' => "Field '$field' is required"]); return; }
    }

    $conn = getConnection();

    $year = date('Y');
    $countStmt = $conn->prepare("SELECT COUNT(*) as cnt FROM students WHERE YEAR(enrollment_date) = ?");
    $countStmt->bind_param("i", $year);
    $countStmt->execute();
    $cnt = $countStmt->get_result()->fetch_assoc()['cnt'] + 1;
    $studentId = 'STU' . $year . str_pad($cnt, 3, '0', STR_PAD_LEFT);

    $stmt = $conn->prepare("INSERT INTO students (student_id, first_name, last_name, email, phone, date_of_birth, gender, address, department_id, enrollment_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $deptId = !empty($data['department_id']) ? (int)$data['department_id'] : null;
    $phone  = $data['phone'] ?? null;
    $dob    = !empty($data['date_of_birth']) ? $data['date_of_birth'] : null;
    $address = $data['address'] ?? null;
    $status  = $data['status'] ?? 'Active';
    $stmt->bind_param("ssssssssiis", $studentId, $data['first_name'], $data['last_name'], $data['email'], $phone, $dob, $data['gender'], $address, $deptId, $data['enrollment_date'], $status);

    if ($stmt->execute()) {
        $newId = $conn->insert_id;
        $accountCreated = false;

        // Create login account if username+password provided
        if (!empty($data['username']) && !empty($data['password'])) {
            $hashed   = password_hash($data['password'], PASSWORD_DEFAULT);
            $fullName = $data['first_name'] . ' ' . $data['last_name'];
            $uStmt    = $conn->prepare("INSERT INTO users (username, password, full_name, email, role, ref_id) VALUES (?,?,?,?,?,?)");
            $uStmt->bind_param("sssssi", $data['username'], $hashed, $fullName, $data['email'], 'student', $newId);
            $accountCreated = $uStmt->execute();
        }
        echo json_encode(['success' => true, 'message' => 'Student added successfully', 'student_id' => $studentId, 'id' => $newId, 'account_created' => $accountCreated]);
    } else {
        $err = $conn->error;
        if (strpos($err, 'Duplicate') !== false) echo json_encode(['success' => false, 'message' => 'Email already exists']);
        else echo json_encode(['success' => false, 'message' => 'Failed to add student: ' . $err]);
    }
    $conn->close();
}

function updateStudent($id) {
    if (!$id) { echo json_encode(['success' => false, 'message' => 'ID required']); return; }
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data) $data = $_POST;

    $conn = getConnection();
    $stmt = $conn->prepare("UPDATE students SET first_name=?, last_name=?, email=?, phone=?, date_of_birth=?, gender=?, address=?, department_id=?, enrollment_date=?, status=? WHERE id=?");
    $deptId = !empty($data['department_id']) ? (int)$data['department_id'] : null;
    $dob    = !empty($data['date_of_birth']) ? $data['date_of_birth'] : null;
    $phone  = $data['phone'] ?? null;
    $address = $data['address'] ?? null;
    $stmt->bind_param("sssssssisii", $data['first_name'], $data['last_name'], $data['email'], $phone, $dob, $data['gender'], $address, $deptId, $data['enrollment_date'], $data['status'], $id);

    if ($stmt->execute()) {
        // Update linked user account if password change requested
        if (!empty($data['new_password'])) {
            $hashed = password_hash($data['new_password'], PASSWORD_DEFAULT);
            $pStmt  = $conn->prepare("UPDATE users SET password=? WHERE role='student' AND ref_id=?");
            $pStmt->bind_param("si", $hashed, $id);
            $pStmt->execute();
        }
        echo json_encode(['success' => true, 'message' => 'Student updated successfully']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to update: ' . $conn->error]);
    }
    $conn->close();
}

function deleteStudent($id) {
    if (!$id) { echo json_encode(['success' => false, 'message' => 'ID required']); return; }
    $conn = getConnection();
    // Delete linked user account
    $uStmt = $conn->prepare("DELETE FROM users WHERE role='student' AND ref_id=?");
    $uStmt->bind_param("i", $id);
    $uStmt->execute();
    $stmt = $conn->prepare("DELETE FROM students WHERE id = ?");
    $stmt->bind_param("i", $id);
    if ($stmt->execute()) echo json_encode(['success' => true, 'message' => 'Student deleted successfully']);
    else echo json_encode(['success' => false, 'message' => 'Failed to delete student']);
    $conn->close();
}

function getStats() {
    $conn = getConnection();
    $stats = [];
    $stats['total_students']      = $conn->query("SELECT COUNT(*) as c FROM students")->fetch_assoc()['c'];
    $stats['active_students']     = $conn->query("SELECT COUNT(*) as c FROM students WHERE status='Active'")->fetch_assoc()['c'];
    $stats['graduated']           = $conn->query("SELECT COUNT(*) as c FROM students WHERE status='Graduated'")->fetch_assoc()['c'];
    $stats['total_courses']       = $conn->query("SELECT COUNT(*) as c FROM courses")->fetch_assoc()['c'];
    $stats['total_enrollments']   = $conn->query("SELECT COUNT(*) as c FROM enrollments WHERE status='Enrolled'")->fetch_assoc()['c'];
    $stats['total_departments']   = $conn->query("SELECT COUNT(*) as c FROM departments")->fetch_assoc()['c'];
    $stats['by_department'] = $conn->query("SELECT d.name, COUNT(s.id) as count FROM departments d LEFT JOIN students s ON d.id = s.department_id GROUP BY d.id, d.name")->fetch_all(MYSQLI_ASSOC);
    $stats['by_status']     = $conn->query("SELECT status, COUNT(*) as count FROM students GROUP BY status")->fetch_all(MYSQLI_ASSOC);
    $conn->close();
    echo json_encode(['success' => true, 'data' => $stats]);
}
?>
