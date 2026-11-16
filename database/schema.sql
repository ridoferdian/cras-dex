CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','dosen','mahasiswa') NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  token_hash CHAR(64) NOT NULL PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_sessions_user (user_id),
  INDEX idx_sessions_expiry (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assessments (
  id CHAR(36) NOT NULL PRIMARY KEY,
  student_id BIGINT UNSIGNED NOT NULL,
  project_name VARCHAR(100) NOT NULL,
  description VARCHAR(500) NOT NULL,
  project_category VARCHAR(80) NOT NULL,
  image_data MEDIUMTEXT NULL,
  image_name VARCHAR(255) NULL,
  ability TINYINT UNSIGNED NOT NULL,
  experience TINYINT UNSIGNED NOT NULL,
  available_time TINYINT UNSIGNED NOT NULL,
  tools TINYINT UNSIGNED NOT NULL,
  score TINYINT UNSIGNED NOT NULL,
  readiness VARCHAR(20) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_assessments_student_date (student_id, created_at),
  CONSTRAINT fk_assessments_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_ability CHECK (ability <= 5),
  CONSTRAINT chk_experience CHECK (experience <= 5),
  CONSTRAINT chk_available_time CHECK (available_time <= 5),
  CONSTRAINT chk_tools CHECK (tools <= 5),
  CONSTRAINT chk_score CHECK (score <= 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lecturer_students (
  lecturer_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (lecturer_id, student_id),
  CONSTRAINT fk_lecturer FOREIGN KEY (lecturer_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_categories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assessment_indicators (
  indicator_key VARCHAR(40) NOT NULL PRIMARY KEY,
  label VARCHAR(100) NOT NULL,
  weight TINYINT UNSIGNED NOT NULL,
  options_json JSON NOT NULL,
  advice VARCHAR(500) NOT NULL,
  CONSTRAINT chk_indicator_weight CHECK (weight <= 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lecturer_feedback (
  assessment_id CHAR(36) NOT NULL,
  lecturer_id BIGINT UNSIGNED NOT NULL,
  message VARCHAR(1000) NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (assessment_id, lecturer_id),
  CONSTRAINT fk_feedback_assessment FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
  CONSTRAINT fk_feedback_lecturer FOREIGN KEY (lecturer_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
