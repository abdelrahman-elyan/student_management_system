<?php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$type   = $_GET['type']   ?? 'courses';
$action = $_GET['action'] ?? '';

if ($type === 'departments') {
    handleDepartments($method);
} else {
    handleCourses($method, $action);
}

function handleDepartments($method) {
    $conn = getConnection();
    if ($method === 'GET') {
        $result = $conn->query("SELECT d.*, COUNT(s.id) as student_count FROM departments d LEFT JOIN students s ON d.id = s.department_id GROUP BY d.id ORDER BY d.name");
        echo json_encode(['success' => true, 'data' => $result->fetch_all(MYSQLI_ASSOC)]);
    } elseif ($method === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $stmt = $conn->prepare("INSERT INTO departments (name, code) VALUES (?, ?)");
        $stmt->bind_param("ss", $data['name'], $data['code']);
        if ($stmt->execute()) echo json_encode(['success' => true, 'message' => 'Department added', 'id' => $conn->insert_id]);
        else echo json_encode(['success' => false, 'message' => 'Failed: ' . $conn->error]);
    } elseif ($method === 'DELETE') {
        $id = $_GET['id'] ?? 0;
        $stmt = $conn->prepare("DELETE FROM departments WHERE id = ?");
        $stmt->bind_param("i", $id);
        echo json_encode(['success' => $stmt->execute(), 'message' => 'Deleted']);
    }
    $conn->close();
}

function handleCourses($method, $action) {
    $conn = getConnection();

    if ($method === 'GET') {
        if ($action === 'single') {
            $id = $_GET['id'] ?? 0;
            $stmt = $conn->prepare("SELECT c.*, d.name as department_name, CONCAT(t.first_name,' ',t.last_name) as teacher_name FROM courses c LEFT JOIN departments d ON c.department_id = d.id LEFT JOIN teachers t ON c.teacher_id = t.id WHERE c.id = ?");
            $stmt->bind_param("i", $id);
            $stmt->execute();
            echo json_encode(['success' => true, 'data' => $stmt->get_result()->fetch_assoc()]);
        } else {
            $search = $_GET['search'] ?? '';
            $dept   = $_GET['department'] ?? '';
            $where  = []; $params = []; $types = '';
            if ($search) {
                $where[] = "(c.course_name LIKE ? OR c.course_code LIKE ?)";
                $s = "%$search%"; $params = [$s,$s]; $types = 'ss';
            }
            if ($dept) { $where[] = "c.department_id = ?"; $params[] = $dept; $types .= 'i'; }
            $wc  = $where ? 'WHERE ' . implode(' AND ', $where) : '';
            $sql = "SELECT c.*, d.name as department_name,
                           CONCAT(t.first_name,' ',t.last_name) as teacher_name,
                           COUNT(e.id) as enrolled_count
                    FROM courses c
                    LEFT JOIN departments d ON c.department_id = d.id
                    LEFT JOIN teachers t ON c.teacher_id = t.id
                    LEFT JOIN enrollments e ON c.id = e.course_id
                    $wc GROUP BY c.id ORDER BY c.course_name";
            $stmt = $conn->prepare($sql);
            if ($params) $stmt->bind_param($types, ...$params);
            $stmt->execute();
            echo json_encode(['success' => true, 'data' => $stmt->get_result()->fetch_all(MYSQLI_ASSOC)]);
        }
    } elseif ($method === 'POST') {
        $data   = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $deptId  = !empty($data['department_id']) ? (int)$data['department_id'] : null;
        $credits = (int)($data['credits'] ?? 3);
        $desc    = $data['description'] ?? null;
        $teachId = resolveTeacherId($conn, $data['teacher_id'] ?? null);
        $stmt   = $conn->prepare("INSERT INTO courses (course_code, course_name, credits, department_id, teacher_id, description) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->bind_param("ssiiss", $data['course_code'], $data['course_name'], $credits, $deptId, $teachId, $desc);
        if ($stmt->execute()) echo json_encode(['success' => true, 'message' => 'Course added', 'id' => $conn->insert_id]);
        else echo json_encode(['success' => false, 'message' => 'Failed: ' . $conn->error]);
    } elseif ($method === 'PUT') {
        $id   = $_GET['id'] ?? 0;
        $data = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $deptId  = !empty($data['department_id']) ? (int)$data['department_id'] : null;
        $credits = (int)($data['credits'] ?? 3);
        $desc    = $data['description'] ?? null;
        $teachId = resolveTeacherId($conn, $data['teacher_id'] ?? null);
        $stmt = $conn->prepare("UPDATE courses SET course_code=?, course_name=?, credits=?, department_id=?, teacher_id=?, description=? WHERE id=?");
        $stmt->bind_param("ssiissi", $data['course_code'], $data['course_name'], $credits, $deptId, $teachId, $desc, $id);
        echo json_encode(['success' => $stmt->execute(), 'message' => 'Updated']);
    } elseif ($method === 'DELETE') {
        $id   = $_GET['id'] ?? 0;
        $stmt = $conn->prepare("DELETE FROM courses WHERE id = ?");
        $stmt->bind_param("i", $id);
        echo json_encode(['success' => $stmt->execute(), 'message' => 'Deleted']);
    }
    $conn->close();
}

function resolveTeacherId($conn, $rawValue) {
    if (empty($rawValue)) return null;
    // If admin_X format: look up user, find or create teacher record
    if (strpos($rawValue, 'admin_') === 0) {
        $userId = (int)substr($rawValue, 6);
        $stmt = $conn->prepare("SELECT * FROM users WHERE id = ? AND role IN ('admin','staff')");
        $stmt->bind_param("i", $userId);
        $stmt->execute();
        $user = $stmt->get_result()->fetch_assoc();
        if (!$user) return null;
        // Check if teacher record already exists for this admin
        $chk = $conn->prepare("SELECT id FROM teachers WHERE email = ?");
        $chk->bind_param("s", $user['email']);
        $chk->execute();
        $existing = $chk->get_result()->fetch_assoc();
        if ($existing) return $existing['id'];
        // Create teacher record for admin
        $nameParts = explode(' ', $user['full_name'], 2);
        $firstName = $nameParts[0];
        $lastName  = $nameParts[1] ?? '';
        $cnt = $conn->query("SELECT COUNT(*) as c FROM teachers")->fetch_assoc()['c'] + 1;
        $teacherId = 'ADM' . str_pad($cnt, 3, '0', STR_PAD_LEFT);
        $ins = $conn->prepare("INSERT INTO teachers (teacher_id, first_name, last_name, email, status) VALUES (?,?,?,?,'Active')");
        $ins->bind_param("ssss", $teacherId, $firstName, $lastName, $user['email']);
        $ins->execute();
        return $conn->insert_id;
    }
    return (int)$rawValue ?: null;
}

?>
