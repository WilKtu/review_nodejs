// funciones.js
// Aquí está lo que usa todo el programa: la conexión, las clases del CRUD
// (con herencia y polimorfismo) y funciones pequeñas de apoyo.

const mysql = require('mysql2/promise');
const readline = require('readline/promises');

// ---------------------------------------------------------------
// 1. Conexión a MySQL
// ---------------------------------------------------------------
// Los datos se leen de variables de entorno; si no existen uso valores por defecto.
const config = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sistema_academico',
  waitForConnections: true,
  connectionLimit: 5,
};

function crearPool() {
  return mysql.createPool(config);
}

function crearInterfaz() {
  return readline.createInterface({ input: process.stdin, output: process.stdout });
}

// ---------------------------------------------------------------
// 2. Funciones de apoyo
// ---------------------------------------------------------------

async function preguntar(rl, texto) {
  const respuesta = await rl.question(texto);
  return respuesta.trim();
}

// Convierte una fecha a texto "AAAA-MM-DD HH:MM" para mostrarla
function formatoFecha(valor) {
  if (!valor) return '';
  const f = new Date(valor);
  if (isNaN(f)) return String(valor);
  const dos = (n) => String(n).padStart(2, '0');
  return `${f.getFullYear()}-${dos(f.getMonth() + 1)}-${dos(f.getDate())} ${dos(f.getHours())}:${dos(f.getMinutes())}`;
}

// Recibe un Date o un texto "AAAA-MM-DD HH:MM" y devuelve siempre un Date
function aFecha(valor) {
  if (valor instanceof Date) return valor;
  return new Date(String(valor).replace(' ', 'T'));
}

function esEmailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function esFechaValida(texto) {
  const formatoOk = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?$/.test(texto);
  return formatoOk && !isNaN(aFecha(texto));
}

// Traduce los errores de MySQL a mensajes que se entiendan
function traducirError(error) {
  switch (error.code) {
    case 'ER_DUP_ENTRY':
      return 'Ya existe un registro con ese valor (dato repetido).';
    case 'ER_NO_REFERENCED_ROW_2':
      return 'Uno de los ids que escribiste no existe en su tabla (llave foránea).';
    case 'ER_ROW_IS_REFERENCED_2':
      return 'No se puede eliminar: hay otros registros que dependen de este.';
    case 'ECONNREFUSED':
      return 'No se pudo conectar a MySQL. ¿Está encendido el servidor?';
    case 'ER_ACCESS_DENIED_ERROR':
      return 'Usuario o contraseña de MySQL incorrectos (revisa DB_USER y DB_PASSWORD).';
    case 'ER_BAD_DB_ERROR':
      return 'La base de datos no existe. Ejecuta primero docs/base_datos.sql';
    default:
      return error.message;
  }
}

// Pide un número entero positivo (para los ids)
async function pedirEntero(rl, texto) {
  while (true) {
    const entrada = await preguntar(rl, texto);
    if (/^\d+$/.test(entrada) && Number(entrada) > 0) return Number(entrada);
    console.log('Escribe un número entero mayor que 0.');
  }
}

// Pide UN campo según su tipo. Si "actual" viene definido estamos editando
// y con solo dar Enter se deja el valor que ya tenía.
async function pedirCampo(rl, campo, actual) {
  const editando = actual !== undefined;

  while (true) {
    let pista = '';
    if (campo.tipo === 'activo') pista = ' (s/n)';
    if (campo.tipo === 'fecha') pista = ' (AAAA-MM-DD o AAAA-MM-DD HH:MM)';
    if (editando) {
      const mostrar = campo.tipo === 'fecha' ? formatoFecha(actual) : (actual ?? '');
      pista += ` [actual: ${mostrar}]`;
    }

    const entrada = await preguntar(rl, `${campo.etiqueta}${pista}: `);

    // Enter sin escribir nada
    if (entrada === '') {
      if (editando) return actual;
      if (campo.tipo === 'activo') return 1;
      if (!campo.requerido) return null;
      console.log('Este campo es obligatorio.');
      continue;
    }

    if (campo.tipo === 'entero') {
      if (!/^-?\d+$/.test(entrada)) {
        console.log('Tiene que ser un número entero.');
        continue;
      }
      return Number(entrada);
    }

    if (campo.tipo === 'fecha') {
      if (!esFechaValida(entrada)) {
        console.log('Fecha no válida. Ejemplo: 2026-10-01 o 2026-10-01 08:00');
        continue;
      }
      return entrada;
    }

    if (campo.tipo === 'activo') {
      const t = entrada.toLowerCase();
      if (t === 's' || t === 'si' || t === 'sí' || t === '1') return 1;
      if (t === 'n' || t === 'no' || t === '0') return 0;
      console.log('Responde s o n.');
      continue;
    }

    // texto normal
    if (campo.max && entrada.length > campo.max) {
      console.log(`Máximo ${campo.max} caracteres.`);
      continue;
    }
    return entrada;
  }
}

// Recorre todos los campos de un repositorio y arma el objeto con los datos
async function pedirDatos(rl, campos, actual = null) {
  const datos = {};
  for (const campo of campos) {
    const valorActual = actual ? actual[campo.nombre] : undefined;
    datos[campo.nombre] = await pedirCampo(rl, campo, valorActual);
  }
  return datos;
}

// ---------------------------------------------------------------
// 3. Clase base del CRUD (HERENCIA)
// ---------------------------------------------------------------
// Aquí está el CRUD genérico. Cada tabla hereda de esta clase y solo
// cambia lo que necesita (campos, validaciones, cómo se muestra).
//
// SOLID:
//  - S: cada clase se encarga de UNA tabla.
//  - O: para agregar una tabla nueva se crea una clase nueva, sin tocar las demás.
//  - L: cualquier hija se puede usar donde se espera RepositorioBase.
//  - I: el menú solo usa los métodos que necesita (listar, crear, etc.).
//  - D: la clase recibe la conexión "db" desde afuera, no la crea ella misma.
class RepositorioBase {
  constructor(db, tabla, nombreVisible, campos) {
    this.db = db;
    this.tabla = tabla;
    this.nombreVisible = nombreVisible;
    this.campos = campos; // lista de campos que se piden al crear/actualizar
  }

  // Las hijas pueden sobrescribirlo (POLIMORFISMO). Devuelve lista de errores.
  validar(datos) {
    return [];
  }

  // Prepara una fila para mostrarla en la tabla de la consola.
  formatear(fila) {
    const limpia = {};
    for (const [clave, valor] of Object.entries(fila)) {
      if (valor instanceof Date) limpia[clave] = formatoFecha(valor);
      else if (clave === 'active') limpia[clave] = valor ? 'Sí' : 'No';
      else limpia[clave] = valor;
    }
    return limpia;
  }

  mostrar(filas) {
    if (filas.length === 0) {
      console.log('No hay registros.');
      return;
    }
    console.table(filas.map((fila) => this.formatear(fila)));
  }

  async listar() {
    const [filas] = await this.db.query(`SELECT * FROM ${this.tabla} ORDER BY id`);
    return filas;
  }

  async buscarPorId(id) {
    const [filas] = await this.db.execute(`SELECT * FROM ${this.tabla} WHERE id = ?`, [id]);
    return filas[0] || null;
  }

  async crear(datos) {
    const columnas = this.campos.map((c) => c.nombre);
    const valores = columnas.map((c) => datos[c]);
    const signos = columnas.map(() => '?').join(', ');
    const sql = `INSERT INTO ${this.tabla} (${columnas.join(', ')}) VALUES (${signos})`;
    const [resultado] = await this.db.execute(sql, valores);
    return resultado.insertId;
  }

  async actualizar(id, datos) {
    const sets = this.campos.map((c) => `${c.nombre} = ?`).join(', ');
    const valores = this.campos.map((c) => datos[c.nombre]);
    const sql = `UPDATE ${this.tabla} SET ${sets} WHERE id = ?`;
    const [resultado] = await this.db.execute(sql, [...valores, id]);
    return resultado.affectedRows;
  }

  async eliminar(id) {
    const [resultado] = await this.db.execute(`DELETE FROM ${this.tabla} WHERE id = ?`, [id]);
    return resultado.affectedRows;
  }
}

// ---------------------------------------------------------------
// 4. Clases hijas (una por tabla)
// ---------------------------------------------------------------

class TiposIdentificacion extends RepositorioBase {
  constructor(db) {
    super(db, 'identification_types', 'Tipos de identificación', [
      { nombre: 'code', etiqueta: 'Código', tipo: 'texto', requerido: true, max: 6 },
      { nombre: 'name', etiqueta: 'Nombre', tipo: 'texto', requerido: true, max: 100 },
      { nombre: 'description', etiqueta: 'Descripción (opcional)', tipo: 'texto', requerido: false, max: 250 },
    ]);
  }
}

class Ciudades extends RepositorioBase {
  constructor(db) {
    super(db, 'cities', 'Ciudades', [
      { nombre: 'code', etiqueta: 'Código', tipo: 'texto', requerido: true, max: 10 },
      { nombre: 'name', etiqueta: 'Nombre', tipo: 'texto', requerido: true, max: 100 },
    ]);
  }
}

class Estudiantes extends RepositorioBase {
  constructor(db) {
    super(db, 'students', 'Estudiantes', [
      { nombre: 'code', etiqueta: 'Código', tipo: 'texto', requerido: true, max: 14 },
      { nombre: 'firstName', etiqueta: 'Nombres', tipo: 'texto', requerido: true, max: 60 },
      { nombre: 'lastName', etiqueta: 'Apellidos', tipo: 'texto', requerido: true, max: 60 },
      { nombre: 'identification_type_id', etiqueta: 'Id del tipo de identificación', tipo: 'entero', requerido: true },
      { nombre: 'identificationNumber', etiqueta: 'Número de documento', tipo: 'texto', requerido: true, max: 16 },
      { nombre: 'gender', etiqueta: 'Género', tipo: 'texto', requerido: true, max: 20 },
      { nombre: 'birthdate', etiqueta: 'Fecha de nacimiento', tipo: 'fecha', requerido: true },
      { nombre: 'email', etiqueta: 'Correo (opcional)', tipo: 'texto', requerido: false, max: 60 },
      { nombre: 'address', etiqueta: 'Dirección (opcional)', tipo: 'texto', requerido: false, max: 100 },
      { nombre: 'city_id', etiqueta: 'Id de la ciudad', tipo: 'entero', requerido: true },
    ]);
  }

  // Sobrescribo validar (polimorfismo)
  validar(datos) {
    const errores = [];
    if (datos.email && !esEmailValido(datos.email)) errores.push('El correo no tiene un formato válido.');
    if (aFecha(datos.birthdate) > new Date()) errores.push('La fecha de nacimiento no puede ser futura.');
    return errores;
  }

  // Sobrescribo formatear y reutilizo el de la clase padre con super
  formatear(fila) {
    const f = super.formatear(fila);
    return {
      id: f.id,
      codigo: f.code,
      nombre: `${f.firstName} ${f.lastName}`,
      documento: f.identificationNumber,
      correo: f.email,
      nacimiento: f.birthdate,
      ciudad_id: f.city_id,
    };
  }
}

class Profesores extends RepositorioBase {
  constructor(db) {
    super(db, 'teachers', 'Profesores', [
      { nombre: 'firstName', etiqueta: 'Nombres', tipo: 'texto', requerido: true, max: 60 },
      { nombre: 'lastName', etiqueta: 'Apellidos', tipo: 'texto', requerido: true, max: 60 },
      { nombre: 'identification_type_id', etiqueta: 'Id del tipo de identificación', tipo: 'entero', requerido: true },
      { nombre: 'identificationNumber', etiqueta: 'Número de documento', tipo: 'texto', requerido: true, max: 16 },
      { nombre: 'email', etiqueta: 'Correo', tipo: 'texto', requerido: true, max: 100 },
    ]);
  }

  validar(datos) {
    const errores = [];
    if (!esEmailValido(datos.email)) errores.push('El correo no tiene un formato válido.');
    return errores;
  }

  formatear(fila) {
    const f = super.formatear(fila);
    return {
      id: f.id,
      nombre: `${f.firstName} ${f.lastName}`,
      documento: f.identificationNumber,
      correo: f.email,
    };
  }
}

class Salones extends RepositorioBase {
  constructor(db) {
    super(db, 'classrooms', 'Salones', [
      { nombre: 'code', etiqueta: 'Código', tipo: 'texto', requerido: true, max: 10 },
      { nombre: 'description', etiqueta: 'Descripción', tipo: 'texto', requerido: true, max: 250 },
      { nombre: 'capacity', etiqueta: 'Capacidad', tipo: 'entero', requerido: true },
      { nombre: 'active', etiqueta: 'Activo', tipo: 'activo', requerido: false },
    ]);
  }

  validar(datos) {
    const errores = [];
    if (datos.capacity <= 0) errores.push('La capacidad debe ser mayor que 0.');
    return errores;
  }
}

class Cursos extends RepositorioBase {
  constructor(db) {
    super(db, 'courses', 'Cursos', [
      { nombre: 'code', etiqueta: 'Código', tipo: 'texto', requerido: true, max: 10 },
      { nombre: 'description', etiqueta: 'Descripción', tipo: 'texto', requerido: true, max: 250 },
      { nombre: 'intensity', etiqueta: 'Intensidad (horas por semana)', tipo: 'entero', requerido: true },
      { nombre: 'weight', etiqueta: 'Peso (créditos)', tipo: 'entero', requerido: true },
      { nombre: 'active', etiqueta: 'Activo', tipo: 'activo', requerido: false },
    ]);
  }

  validar(datos) {
    const errores = [];
    if (datos.intensity <= 0) errores.push('La intensidad debe ser mayor que 0.');
    if (datos.weight <= 0) errores.push('El peso debe ser mayor que 0.');
    return errores;
  }
}

class Temas extends RepositorioBase {
  constructor(db) {
    super(db, 'topics', 'Temas', [
      { nombre: 'course_id', etiqueta: 'Id del curso', tipo: 'entero', requerido: true },
      { nombre: 'code', etiqueta: 'Código', tipo: 'texto', requerido: true, max: 10 },
      { nombre: 'title', etiqueta: 'Título', tipo: 'texto', requerido: true, max: 100 },
      { nombre: 'description', etiqueta: 'Descripción (opcional)', tipo: 'texto', requerido: false, max: 250 },
      { nombre: 'active', etiqueta: 'Activo', tipo: 'activo', requerido: false },
    ]);
  }
}

class Horarios extends RepositorioBase {
  constructor(db) {
    super(db, 'courses_schedules', 'Horarios de cursos', [
      { nombre: 'course_id', etiqueta: 'Id del curso', tipo: 'entero', requerido: true },
      { nombre: 'teacher_id', etiqueta: 'Id del profesor', tipo: 'entero', requerido: true },
      { nombre: 'classroom_id', etiqueta: 'Id del salón', tipo: 'entero', requerido: true },
      { nombre: 'start_date', etiqueta: 'Fecha de inicio', tipo: 'fecha', requerido: true },
      { nombre: 'end_date', etiqueta: 'Fecha de fin', tipo: 'fecha', requerido: true },
      { nombre: 'active', etiqueta: 'Activo', tipo: 'activo', requerido: false },
    ]);
  }

  validar(datos) {
    const errores = [];
    if (aFecha(datos.end_date) <= aFecha(datos.start_date)) {
      errores.push('La fecha de fin debe ser posterior a la de inicio.');
    }
    return errores;
  }
}

class Inscripciones extends RepositorioBase {
  constructor(db) {
    super(db, 'inscriptions', 'Inscripciones', [
      { nombre: 'course_schedule', etiqueta: 'Id del horario del curso', tipo: 'entero', requerido: true },
      { nombre: 'student_id', etiqueta: 'Id del estudiante', tipo: 'entero', requerido: true },
      { nombre: 'register_date', etiqueta: 'Fecha de registro', tipo: 'fecha', requerido: true },
      { nombre: 'active', etiqueta: 'Activa', tipo: 'activo', requerido: false },
    ]);
  }

  // Aquí sobrescribo listar para que salgan los nombres y no solo los ids
  async listar() {
    const sql = `
      SELECT i.id,
             CONCAT(s.firstName, ' ', s.lastName) AS estudiante,
             c.description AS curso,
             i.course_schedule AS horario_id,
             i.register_date,
             i.active
      FROM inscriptions i
      JOIN students s ON s.id = i.student_id
      JOIN courses_schedules cs ON cs.id = i.course_schedule
      JOIN courses c ON c.id = cs.course_id
      ORDER BY i.id`;
    const [filas] = await this.db.query(sql);
    return filas;
  }
}

class Calificaciones extends RepositorioBase {
  constructor(db) {
    super(db, 'rates', 'Calificaciones', [
      { nombre: 'inscription_id', etiqueta: 'Id de la inscripción', tipo: 'entero', requerido: true },
      { nombre: 'rate', etiqueta: 'Nota (0 a 100)', tipo: 'entero', requerido: true },
      { nombre: 'comments', etiqueta: 'Comentarios (opcional)', tipo: 'texto', requerido: false, max: 250 },
    ]);
  }

  validar(datos) {
    const errores = [];
    if (datos.rate < 0 || datos.rate > 100) errores.push('La nota debe estar entre 0 y 100.');
    return errores;
  }
}

// Crea un objeto de cada clase y le pasa la conexión (inyección de dependencias).
// El menú los recorre a todos igual, sin importar de qué tabla sean.
function crearRepositorios(db) {
  return {
    tiposIdentificacion: new TiposIdentificacion(db),
    ciudades: new Ciudades(db),
    estudiantes: new Estudiantes(db),
    profesores: new Profesores(db),
    salones: new Salones(db),
    cursos: new Cursos(db),
    temas: new Temas(db),
    horarios: new Horarios(db),
    inscripciones: new Inscripciones(db),
    calificaciones: new Calificaciones(db),
  };
}

module.exports = {
  crearPool,
  crearInterfaz,
  crearRepositorios,
  preguntar,
  pedirEntero,
  pedirDatos,
  traducirError,
  RepositorioBase,
};