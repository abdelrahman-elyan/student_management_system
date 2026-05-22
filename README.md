# 🎓 Student Management System
**Alexandria National University — Faculty of Computer and Information**
**Course: Software Engineering**

---

## 📋 Project Overview
A complete Student Management System built with:
- **Frontend:** HTML5, CSS3, JavaScript (Vanilla)
- **Backend:** PHP 7.4+
- **Database:** MySQL 5.7+ / MariaDB

---

## 🚀 Setup Instructions

### Requirements
- XAMPP / WAMP / LAMP / any PHP local server
- PHP 7.4 or higher
- MySQL 5.7 or higher
- A modern web browser

---

### Step 1 — Install XAMPP
Download from: https://www.apachefriends.org/
Install and start **Apache** and **MySQL** services.

---

### Step 2 — Copy Project Files
Copy the entire `student_management_system` folder to:
```
C:\xampp\htdocs\student_management_system\
```
*(On Mac/Linux: `/opt/lampp/htdocs/student_management_system/`)*

---

### Step 3 — Create the Database
1. Open your browser and go to: `http://localhost/phpmyadmin`
2. Click **"New"** in the left sidebar
3. Create a database named: `student_management`
4. Click the database, then go to the **"SQL"** tab
5. Open the file `database.sql` from this project
6. Copy all contents and paste into the SQL tab
7. Click **"Go"** to run the SQL

---

### Step 4 — Configure Database Connection
Open `php/config.php` and update if needed:
```php
define('DB_HOST', 'localhost');
define('DB_USER', 'root');     // Your MySQL username
define('DB_PASS', '');         // Your MySQL password (empty by default in XAMPP)
define('DB_NAME', 'student_management');
```

---

### Step 5 — Run the Application
Open your browser and go to:
```
http://localhost/student_management_system/
```

---

## 🔑 Default Login Credentials
| Field    | Value       |
|----------|-------------|
| Username | `admin`     |
| Password | `admin123`  |

---

## 📁 Project Structure
```
student_management_system/
├── index.html              → Main application entry point
├── database.sql            → Database schema & sample data
├── README.md               → This file
│
├── css/
│   └── style.css           → Main stylesheet
│
├── js/
│   ├── api.js              → API communication module
│   └── app.js              → Main application logic
│
└── php/
    ├── config.php          → Database configuration
    ├── auth.php            → Login / logout / session
    ├── students.php        → Students CRUD API
    ├── courses.php         → Courses & Departments API
    └── enrollments.php     → Enrollments & Grades API
```

---

## ✨ Features
- ✅ Secure login system with session management
- ✅ Dashboard with live statistics and charts
- ✅ Full Student CRUD (Create, Read, Update, Delete)
- ✅ Auto-generated Student IDs
- ✅ Course management
- ✅ Department management
- ✅ Enrollment management
- ✅ Grade entry with automatic letter grade calculation
- ✅ Search & filter across all modules
- ✅ Pagination
- ✅ Student profile with enrollment history
- ✅ Responsive design

---

## 📊 Grade Scale
| Grade | Letter |
|-------|--------|
| 90–100 | A |
| 85–89  | B+ |
| 80–84  | B |
| 75–79  | C+ |
| 70–74  | C |
| 65–69  | D+ |
| 60–64  | D |
| 0–59   | F |

---

## 👥 Team
*(Fill in your team members here)*

- Student 1: ___________________
- Student 2: ___________________
- Student 3: ___________________

---

*Software Engineering Final Project — Academic Year 2024/2025*
