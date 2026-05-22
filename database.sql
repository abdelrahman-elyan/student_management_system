-- ================================================
-- Student Management System - Database Schema
-- Alexandria National University
-- ================================================

CREATE DATABASE IF NOT EXISTS student_management;
USE student_management;

-- Departments Table
CREATE TABLE IF NOT EXISTS departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Students Table
CREATE TABLE IF NOT EXISTS students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id VARCHAR(20) NOT NULL UNIQUE,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone VARCHAR(20),
    date_of_birth DATE,
    gender ENUM('Male', 'Female') NOT NULL,
    address TEXT,
    department_id INT,
    enrollment_date DATE NOT NULL,
    status ENUM('Active', 'Inactive', 'Graduated', 'Suspended') DEFAULT 'Active',
    profile_image VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);

-- Teachers Table
CREATE TABLE IF NOT EXISTS teachers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    teacher_id VARCHAR(20) NOT NULL UNIQUE,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone VARCHAR(20),
    department_id INT,
    status ENUM('Active', 'Inactive') DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);

-- Courses Table
CREATE TABLE IF NOT EXISTS courses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course_code VARCHAR(20) NOT NULL UNIQUE,
    course_name VARCHAR(100) NOT NULL,
    credits INT NOT NULL DEFAULT 3,
    department_id INT,
    teacher_id INT DEFAULT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL
);

-- Enrollments Table
CREATE TABLE IF NOT EXISTS enrollments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    course_id INT NOT NULL,
    semester VARCHAR(20) NOT NULL,
    midterm DECIMAL(5,2) DEFAULT NULL,
    assignments DECIMAL(5,2) DEFAULT NULL,
    final_exam DECIMAL(5,2) DEFAULT NULL,
    grade DECIMAL(4,2) DEFAULT NULL,
    grade_letter VARCHAR(2) DEFAULT NULL,
    enrollment_date DATE NOT NULL,
    status ENUM('Enrolled', 'Completed', 'Dropped', 'Failed') DEFAULT 'Enrolled',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_enrollment (student_id, course_id, semester),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- Users Table (Admin/Staff/Student/Teacher accounts)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    role ENUM('admin', 'staff', 'student', 'teacher') DEFAULT 'staff',
    ref_id INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================================================
-- Sample Data
-- ================================================

INSERT INTO departments (name, code) VALUES
('Computer Science', 'CS'),
('Information Technology', 'IT'),
('Mathematics', 'MATH'),
('Physics', 'PHYS'),
('Business Administration', 'BUS');

-- Admin User (password: admin123)
INSERT INTO users (username, password, full_name, email, role) VALUES
('admin', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'System Administrator', 'admin@university.edu', 'admin');

-- Sample Teachers
INSERT INTO teachers (teacher_id, first_name, last_name, email, phone, department_id, status) VALUES
('TCH001', 'Mohamed', 'Salah', 'mohamed.salah@faculty.edu', '01011111111', 1, 'Active'),
('TCH002', 'Layla', 'Hassan', 'layla.hassan@faculty.edu', '01022222222', 2, 'Active'),
('TCH003', 'Karim', 'Nasser', 'karim.nasser@faculty.edu', '01033333333', 3, 'Active');

-- Sample Courses
INSERT INTO courses (course_code, course_name, credits, department_id, teacher_id, description) VALUES
('CS101', 'Introduction to Programming', 3, 1, 1, 'Basic programming concepts using Python'),
('CS201', 'Data Structures', 3, 1, 1, 'Arrays, linked lists, trees, and graphs'),
('CS301', 'Database Systems', 3, 1, 1, 'Relational databases and SQL'),
('CS401', 'Software Engineering', 3, 1, NULL, 'SDLC, design patterns, and best practices'),
('IT101', 'Networking Fundamentals', 3, 2, 2, 'Basic networking concepts and protocols'),
('MATH101', 'Calculus I', 3, 3, 3, 'Differential and integral calculus'),
('MATH201', 'Linear Algebra', 3, 3, 3, 'Vectors, matrices, and linear transformations');

-- Sample Students
INSERT INTO students (student_id, first_name, last_name, email, phone, date_of_birth, gender, department_id, enrollment_date, status) VALUES
('STU001', 'Ahmed', 'Hassan', 'ahmed.hassan@student.edu', '01012345678', '2002-03-15', 'Male', 1, '2022-09-01', 'Active'),
('STU002', 'Sara', 'Mohamed', 'sara.mohamed@student.edu', '01098765432', '2002-07-22', 'Female', 1, '2022-09-01', 'Active'),
('STU003', 'Omar', 'Ali', 'omar.ali@student.edu', '01123456789', '2001-11-30', 'Male', 2, '2021-09-01', 'Active'),
('STU004', 'Nour', 'Ibrahim', 'nour.ibrahim@student.edu', '01234567890', '2003-01-10', 'Female', 3, '2023-09-01', 'Active'),
('STU005', 'Youssef', 'Mahmoud', 'youssef.m@student.edu', '01087654321', '2000-05-18', 'Male', 1, '2020-09-01', 'Graduated');

-- Sample Enrollments
INSERT INTO enrollments (student_id, course_id, semester, midterm, assignments, final_exam, grade, grade_letter, enrollment_date, status) VALUES
(1, 1, 'Fall 2022', 80, 90, 85, 85.00, 'B+', '2022-09-01', 'Completed'),
(1, 2, 'Spring 2023', 95, 88, 90, 91.00, 'A', '2023-02-01', 'Completed'),
(1, 3, 'Fall 2023', NULL, NULL, NULL, NULL, NULL, '2023-09-01', 'Enrolled'),
(2, 1, 'Fall 2022', 90, 95, 92, 92.00, 'A', '2022-09-01', 'Completed'),
(2, 3, 'Fall 2023', NULL, NULL, NULL, NULL, NULL, '2023-09-01', 'Enrolled'),
(3, 5, 'Fall 2021', 75, 80, 78, 77.67, 'C+', '2021-09-01', 'Completed'),
(4, 6, 'Fall 2023', NULL, NULL, NULL, NULL, NULL, '2023-09-01', 'Enrolled');

-- Student user accounts (password: student123)
INSERT INTO users (username, password, full_name, email, role, ref_id) VALUES
('ahmed.hassan', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Ahmed Hassan', 'ahmed.hassan@student.edu', 'student', 1),
('sara.mohamed', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Sara Mohamed', 'sara.mohamed@student.edu', 'student', 2);

-- Teacher user accounts (password: teacher123)
INSERT INTO users (username, password, full_name, email, role, ref_id) VALUES
('mohamed.salah', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Mohamed Salah', 'mohamed.salah@faculty.edu', 'teacher', 1),
('layla.hassan', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Layla Hassan', 'layla.hassan@faculty.edu', 'teacher', 2);
