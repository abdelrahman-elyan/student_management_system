<?php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

switch ($method) {
    case 'GET':
        if ($action === 'single') getUser($_GET['id'] ?? 0);
        else getUsers();
        break;
    case 'POST':   createUser();              break;
    case 'PUT':    updateUser($_GET['id'] ?? 0); break;
    case 'DELETE': deleteUser($_GET['id'] ?? 0); break;
    default: echo json_encode(['success' => false, 'message' => 'Method not allowed']);
}

function getUsers() {
    $conn = getConnection();
    $role = $_GET['role'] ?? '';
    $search = $_GET['search'] ?? '';

    $where = []; $params = []; $types = '';

    if ($role)   { $where[] = "u.role = ?";                             $params[] = $role;       $types .= 's'; }
    if ($search) { $where[] = "(u.username LIKE ? OR u.full_name LIKE ? OR u.email LIKE ?)";
                   $s = "%$search%"; $params = array_merge($params,[$s,$s,$s]); $types .= 'sss'; }

    $wc  = $where ? 'WHERE '.implode(' AND ',$where) : '';
    $sql = "SELECT u.id, u.username, u.full_name, u.email, u.role, u.ref_id, u.created_at,
                   CASE
                     WHEN u.role='student' THEN CONCAT(s.first_name,' ',s.last_name)
                     WHEN u.role='teacher' THEN CONCAT(t.first_name,' ',t.last_name)
                     ELSE NULL
                   END as linked_name,
                   CASE
                     WHEN u.role='student' THEN s.student_id
                     WHEN u.role='teacher' THEN t.teacher_id
                     ELSE NULL
                   END as linked_code
            FROM users u
            LEFT JOIN students s ON u.role='student' AND u.ref_id=s.id
            LEFT JOIN teachers t ON u.role='teacher' AND u.ref_id=t.id
            $wc ORDER BY u.created_at DESC";

    $stmt = $conn->prepare($sql);
    if ($params) $stmt->bind_param($types, ...$params);
    $stmt->execute();
    echo json_encode(['success' => true, 'data' => $stmt->get_result()->fetch_all(MYSQLI_ASSOC)]);
    $conn->close();
}

function getUser($id) {
    if (!$id) { echo json_encode(['success'=>false,'message'=>'ID required']); return; }
    $conn = getConnection();
    $stmt = $conn->prepare("SELECT id, username, full_name, email, role, ref_id, created_at FROM users WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    echo json_encode(['success'=>true,'data'=>$stmt->get_result()->fetch_assoc()]);
    $conn->close();
}

function createUser() {
    $data = json_decode(file_get_contents('php://input'), true) ?? $_POST;

    $required = ['username','password','full_name','email','role'];
    foreach ($required as $f) {
        if (empty($data[$f])) { echo json_encode(['success'=>false,'message'=>"Field '$f' is required"]); return; }
    }

    $allowed_roles = ['admin','staff','student','teacher'];
    if (!in_array($data['role'], $allowed_roles)) { echo json_encode(['success'=>false,'message'=>'Invalid role']); return; }

    $conn   = getConnection();
    $hashed = password_hash($data['password'], PASSWORD_DEFAULT);
    $refId  = !empty($data['ref_id']) ? (int)$data['ref_id'] : null;

    // Auto-create a Teacher record if role=teacher and no existing teacher linked
    if ($data['role'] === 'teacher' && !$refId) {
        $nameParts = explode(' ', trim($data['full_name']), 2);
        $firstName = $nameParts[0];
        $lastName  = isset($nameParts[1]) ? $nameParts[1] : $nameParts[0];

        $cnt = $conn->query("SELECT COUNT(*) as c FROM teachers")->fetch_assoc()['c'] + 1;
        $teacherCode = 'TCH' . str_pad($cnt, 3, '0', STR_PAD_LEFT);
        // Make sure it's unique
        $chk = $conn->prepare("SELECT id FROM teachers WHERE teacher_id = ?");
        $chk->bind_param("s", $teacherCode);
        $chk->execute();
        while ($chk->get_result()->num_rows > 0) {
            $cnt++;
            $teacherCode = 'TCH' . str_pad($cnt, 3, '0', STR_PAD_LEFT);
            $chk->bind_param("s", $teacherCode);
            $chk->execute();
        }

        $tStmt = $conn->prepare("INSERT INTO teachers (teacher_id, first_name, last_name, email, status) VALUES (?,?,?,?,'Active')");
        $tStmt->bind_param("ssss", $teacherCode, $firstName, $lastName, $data['email']);

        if ($tStmt->execute()) {
            $refId = $conn->insert_id;
        } else {
            // Email might already exist in teachers table — try to find it
            $findStmt = $conn->prepare("SELECT id FROM teachers WHERE email = ?");
            $findStmt->bind_param("s", $data['email']);
            $findStmt->execute();
            $found = $findStmt->get_result()->fetch_assoc();
            if ($found) {
                $refId = $found['id'];
            } else {
                echo json_encode(['success'=>false,'message'=>'Failed to create teacher record: '.$conn->error]);
                $conn->close(); return;
            }
        }
    }

    // Auto-create a Student record if role=student and no existing student linked
    if ($data['role'] === 'student' && !$refId) {
        // Parse full_name into first/last
        $nameParts = explode(' ', trim($data['full_name']), 2);
        $firstName = $nameParts[0];
        $lastName  = isset($nameParts[1]) ? $nameParts[1] : $nameParts[0];

        // Generate a unique student_id: STU + timestamp + random
        $studentCode = 'STU' . date('y') . str_pad(rand(1, 9999), 4, '0', STR_PAD_LEFT);
        // Make sure it's unique
        $chk = $conn->prepare("SELECT id FROM students WHERE student_id = ?");
        $chk->bind_param("s", $studentCode);
        $chk->execute();
        while ($chk->get_result()->num_rows > 0) {
            $studentCode = 'STU' . date('y') . str_pad(rand(1, 9999), 4, '0', STR_PAD_LEFT);
            $chk->bind_param("s", $studentCode);
            $chk->execute();
        }

        $enrollDate = date('Y-m-d');
        $gender     = !empty($data['gender']) ? $data['gender'] : 'Male';

        $sStmt = $conn->prepare("INSERT INTO students (student_id, first_name, last_name, email, gender, enrollment_date, status) VALUES (?,?,?,?,?,?,'Active')");
        $sStmt->bind_param("ssssss", $studentCode, $firstName, $lastName, $data['email'], $gender, $enrollDate);

        if ($sStmt->execute()) {
            $refId = $conn->insert_id;
        } else {
            // Email might already exist in students table — try to find it
            $findStmt = $conn->prepare("SELECT id FROM students WHERE email = ?");
            $findStmt->bind_param("s", $data['email']);
            $findStmt->execute();
            $found = $findStmt->get_result()->fetch_assoc();
            if ($found) {
                $refId = $found['id'];
            } else {
                echo json_encode(['success'=>false,'message'=>'Failed to create student record: '.$conn->error]);
                $conn->close(); return;
            }
        }
    }

    $stmt = $conn->prepare("INSERT INTO users (username, password, full_name, email, role, ref_id) VALUES (?,?,?,?,?,?)");
    $stmt->bind_param("sssssi", $data['username'], $hashed, $data['full_name'], $data['email'], $data['role'], $refId);

    if ($stmt->execute()) {
        echo json_encode(['success'=>true,'message'=>'User created successfully','id'=>$conn->insert_id,'ref_id'=>$refId]);
    } else {
        $err = $conn->error;
        if (strpos($err,'Duplicate')!==false && strpos($err,'username')!==false)
            echo json_encode(['success'=>false,'message'=>'Username already exists']);
        elseif (strpos($err,'Duplicate')!==false && strpos($err,'email')!==false)
            echo json_encode(['success'=>false,'message'=>'Email already exists']);
        else
            echo json_encode(['success'=>false,'message'=>'Failed: '.$err]);
    }
    $conn->close();
}

function updateUser($id) {
    if (!$id) { echo json_encode(['success'=>false,'message'=>'ID required']); return; }
    $data = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $conn = getConnection();

    // Update password only if provided
    if (!empty($data['password'])) {
        $hashed = password_hash($data['password'], PASSWORD_DEFAULT);
        $stmt = $conn->prepare("UPDATE users SET username=?, full_name=?, email=?, role=?, password=? WHERE id=?");
        $stmt->bind_param("sssssi", $data['username'], $data['full_name'], $data['email'], $data['role'], $hashed, $id);
    } else {
        $stmt = $conn->prepare("UPDATE users SET username=?, full_name=?, email=?, role=? WHERE id=?");
        $stmt->bind_param("ssssi", $data['username'], $data['full_name'], $data['email'], $data['role'], $id);
    }

    if ($stmt->execute()) {
        echo json_encode(['success'=>true,'message'=>'User updated successfully']);
    } else {
        $err = $conn->error;
        if (strpos($err,'Duplicate')!==false) echo json_encode(['success'=>false,'message'=>'Username or email already exists']);
        else echo json_encode(['success'=>false,'message'=>'Failed: '.$err]);
    }
    $conn->close();
}

function deleteUser($id) {
    if (!$id) { echo json_encode(['success'=>false,'message'=>'ID required']); return; }
    // Prevent deleting self
    $conn = getConnection();
    $stmt = $conn->prepare("DELETE FROM users WHERE id=?");
    $stmt->bind_param("i", $id);
    echo json_encode(['success'=>$stmt->execute(),'message'=>'User deleted']);
    $conn->close();
}
?>
