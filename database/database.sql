-- =====================================================
-- Base de datos: sistema_academico
-- Sistema de gestión académica (Campuslands)
-- Ejecutar con:  mysql -u root -p < docs/base_datos.sql
-- =====================================================

DROP DATABASE IF EXISTS sistema_academico;
CREATE DATABASE sistema_academico CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sistema_academico;

-- -----------------------------------------------------
-- Tablas que no dependen de otras
-- -----------------------------------------------------

CREATE TABLE identification_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(6) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(250)
);

CREATE TABLE cities (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE classrooms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(10) NOT NULL UNIQUE,
    description VARCHAR(250) NOT NULL,
    capacity INT NOT NULL,
    active TINYINT NOT NULL DEFAULT 1
);

CREATE TABLE courses (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(10) NOT NULL UNIQUE,
    description VARCHAR(250) NOT NULL,
    intensity INT NOT NULL,   -- horas por semana
    weight INT NOT NULL,      -- peso (créditos) del curso
    active TINYINT NOT NULL DEFAULT 1
);

-- -----------------------------------------------------
-- Tablas que dependen de las anteriores
-- -----------------------------------------------------

CREATE TABLE students (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(14) NOT NULL UNIQUE,
    firstName VARCHAR(60) NOT NULL,
    lastName VARCHAR(60) NOT NULL,
    identification_type_id INT NOT NULL,
    identificationNumber VARCHAR(16) NOT NULL,
    gender VARCHAR(20) NOT NULL,
    birthdate DATETIME NOT NULL,
    email VARCHAR(60),
    address VARCHAR(100),
    city_id BIGINT NOT NULL,
    FOREIGN KEY (identification_type_id) REFERENCES identification_types(id),
    FOREIGN KEY (city_id) REFERENCES cities(id)
);

CREATE TABLE teachers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    firstName VARCHAR(60) NOT NULL,
    lastName VARCHAR(60) NOT NULL,
    identification_type_id INT NOT NULL,
    identificationNumber VARCHAR(16) NOT NULL,
    email VARCHAR(100) NOT NULL,
    FOREIGN KEY (identification_type_id) REFERENCES identification_types(id)
);

CREATE TABLE topics (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    course_id BIGINT NOT NULL,
    code VARCHAR(10) NOT NULL,
    title VARCHAR(100) NOT NULL,
    description VARCHAR(250),
    active TINYINT NOT NULL DEFAULT 1,
    FOREIGN KEY (course_id) REFERENCES courses(id)
);

CREATE TABLE courses_schedules (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    course_id BIGINT NOT NULL,
    teacher_id BIGINT NOT NULL,
    classroom_id INT NOT NULL,
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    active TINYINT NOT NULL DEFAULT 1,
    FOREIGN KEY (course_id) REFERENCES courses(id),
    FOREIGN KEY (teacher_id) REFERENCES teachers(id),
    FOREIGN KEY (classroom_id) REFERENCES classrooms(id)
);

CREATE TABLE inscriptions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    course_schedule BIGINT NOT NULL,
    student_id BIGINT NOT NULL,
    register_date DATETIME NOT NULL,
    active TINYINT NOT NULL DEFAULT 1,
    FOREIGN KEY (course_schedule) REFERENCES courses_schedules(id),
    FOREIGN KEY (student_id) REFERENCES students(id)
);

CREATE TABLE rates (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    inscription_id BIGINT NOT NULL,
    rate BIGINT NOT NULL,
    comments VARCHAR(250),
    FOREIGN KEY (inscription_id) REFERENCES inscriptions(id)
);

-- -----------------------------------------------------
-- Datos de prueba (para no empezar con todo vacío)
-- -----------------------------------------------------

INSERT INTO identification_types (code, name, description) VALUES
('CC',  'Cédula de ciudadanía',  'Documento para mayores de edad'),
('TI',  'Tarjeta de identidad',  'Documento para menores de edad'),
('CE',  'Cédula de extranjería', 'Documento para extranjeros residentes'),
('PAS', 'Pasaporte',             'Documento internacional');

INSERT INTO cities (code, name) VALUES
('BOG', 'Bogotá'),
('MED', 'Medellín'),
('CLO', 'Cali'),
('BGA', 'Bucaramanga');

INSERT INTO classrooms (code, description, capacity, active) VALUES
('A101', 'Sala de cómputo 1', 3, 1),
('A102', 'Sala de cómputo 2', 25, 1),
('B201', 'Auditorio pequeño', 40, 1);

INSERT INTO courses (code, description, intensity, weight, active) VALUES
('BD01',  'Bases de datos con MySQL',      6, 4, 1),
('JS01',  'Programación con JavaScript',   8, 5, 1),
('WEB01', 'Desarrollo web frontend',       6, 4, 1);

INSERT INTO topics (course_id, code, title, description, active) VALUES
(1, 'T01', 'Modelo entidad-relación', 'Diseño de diagramas ER', 1),
(1, 'T02', 'Consultas SQL',           'SELECT, JOIN y subconsultas', 1),
(2, 'T01', 'Variables y funciones',   'Fundamentos del lenguaje', 1),
(2, 'T02', 'Clases y objetos',        'POO en JavaScript', 1);

INSERT INTO teachers (firstName, lastName, identification_type_id, identificationNumber, email) VALUES
('Laura',  'Gómez',  1, '52123456', 'laura.gomez@campus.com'),
('Andrés', 'Pérez',  1, '80987654', 'andres.perez@campus.com');

INSERT INTO students (code, firstName, lastName, identification_type_id, identificationNumber, gender, birthdate, email, address, city_id) VALUES
('EST-0001', 'Camila', 'Rojas',   1, '1098765432', 'Femenino',  '2002-03-15 00:00:00', 'camila@correo.com', 'Calle 10 # 5-20', 4),
('EST-0002', 'Juan',   'Martínez', 1, '1012345678', 'Masculino', '2001-11-02 00:00:00', 'juan@correo.com',   'Carrera 7 # 12-30', 1),
('EST-0003', 'Sofía',  'Díaz',    1, '1023456789', 'Femenino',  '2003-07-21 00:00:00', 'sofia@correo.com',  'Av. 80 # 45-10', 2),
('EST-0004', 'Pedro',  'López',   1, '1034567890', 'Masculino', '2000-01-30 00:00:00', 'pedro@correo.com',  'Calle 50 # 20-15', 3);

INSERT INTO courses_schedules (course_id, teacher_id, classroom_id, start_date, end_date, active) VALUES
(1, 1, 1, '2026-10-01 08:00:00', '2026-12-15 12:00:00', 1),   -- salón A101 con capacidad 3 (sirve para probar el cupo)
(2, 2, 2, '2026-10-01 14:00:00', '2026-12-15 18:00:00', 1);

INSERT INTO inscriptions (course_schedule, student_id, register_date, active) VALUES
(1, 1, NOW(), 1),
(2, 2, NOW(), 1);

INSERT INTO rates (inscription_id, rate, comments) VALUES
(1, 90, 'Muy buen desempeño en las consultas');