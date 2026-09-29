// transacciones.js
// Operaciones que tocan varias tablas o necesitan varias validaciones.
// Si algo falla en medio, se hace rollback y no se guarda nada.

class Transacciones {
    // Recibe el pool desde afuera (inyección de dependencias)
    constructor(db) {
      this.db = db;
    }
  
    // Método que reutilizan todas las transacciones:
    // abre la transacción, corre el trabajo, y hace commit o rollback.
    async ejecutar(trabajo) {
      const conexion = await this.db.getConnection();
      try {
        await conexion.beginTransaction();
        const resultado = await trabajo(conexion);
        await conexion.commit();
        return resultado;
      } catch (error) {
        await conexion.rollback();
        throw error; // lo atrapa el menú y muestra el mensaje
      } finally {
        conexion.release(); // siempre devolver la conexión al pool
      }
    }
  
    // 1. Matricular un estudiante en un horario
    async matricular(estudianteId, horarioId) {
      return this.ejecutar(async (con) => {
        const [estudiante] = await con.execute('SELECT id FROM students WHERE id = ?', [estudianteId]);
        if (estudiante.length === 0) throw new Error('El estudiante no existe.');
  
        // FOR UPDATE bloquea la fila para que dos matrículas al mismo tiempo no pasen el cupo
        const [horario] = await con.execute(
          `SELECT cs.id, cs.active, cl.capacity
           FROM courses_schedules cs
           JOIN classrooms cl ON cl.id = cs.classroom_id
           WHERE cs.id = ? FOR UPDATE`,
          [horarioId]
        );
        if (horario.length === 0) throw new Error('El horario no existe.');
        if (!horario[0].active) throw new Error('El horario está inactivo.');
  
        const [repetida] = await con.execute(
          'SELECT id FROM inscriptions WHERE student_id = ? AND course_schedule = ? AND active = 1',
          [estudianteId, horarioId]
        );
        if (repetida.length > 0) throw new Error('El estudiante ya está inscrito en ese horario.');
  
        const [cupo] = await con.execute(
          'SELECT COUNT(*) AS total FROM inscriptions WHERE course_schedule = ? AND active = 1',
          [horarioId]
        );
        if (cupo[0].total >= horario[0].capacity) {
          throw new Error(`El salón está lleno (capacidad: ${horario[0].capacity}).`);
        }
  
        const [resultado] = await con.execute(
          'INSERT INTO inscriptions (course_schedule, student_id, register_date, active) VALUES (?, ?, NOW(), 1)',
          [horarioId, estudianteId]
        );
        return resultado.insertId;
      });
    }
  
    // 2. Cancelar una inscripción (borra sus notas y la deja inactiva)
    async cancelar(inscripcionId) {
      return this.ejecutar(async (con) => {
        const [inscripcion] = await con.execute(
          'SELECT id, active FROM inscriptions WHERE id = ? FOR UPDATE',
          [inscripcionId]
        );
        if (inscripcion.length === 0) throw new Error('La inscripción no existe.');
        if (!inscripcion[0].active) throw new Error('La inscripción ya estaba cancelada.');
  
        const [notas] = await con.execute('DELETE FROM rates WHERE inscription_id = ?', [inscripcionId]);
        await con.execute('UPDATE inscriptions SET active = 0 WHERE id = ?', [inscripcionId]);
        return notas.affectedRows; // cuántas notas se borraron
      });
    }
  
    // 3. Registrar la nota de una inscripción
    async registrarNota(inscripcionId, nota, comentario) {
      return this.ejecutar(async (con) => {
        if (nota < 0 || nota > 100) throw new Error('La nota debe estar entre 0 y 100.');
  
        const [inscripcion] = await con.execute(
          'SELECT id, active FROM inscriptions WHERE id = ? FOR UPDATE',
          [inscripcionId]
        );
        if (inscripcion.length === 0) throw new Error('La inscripción no existe.');
        if (!inscripcion[0].active) throw new Error('La inscripción está cancelada.');
  
        const [yaTiene] = await con.execute('SELECT id FROM rates WHERE inscription_id = ?', [inscripcionId]);
        if (yaTiene.length > 0) throw new Error('Esa inscripción ya tiene una nota registrada.');
  
        const [resultado] = await con.execute(
          'INSERT INTO rates (inscription_id, rate, comments) VALUES (?, ?, ?)',
          [inscripcionId, nota, comentario]
        );
        return resultado.insertId;
      });
    }
  
    // 4. Trasladar una inscripción a otro horario del MISMO curso
    async trasladar(inscripcionId, nuevoHorarioId) {
      return this.ejecutar(async (con) => {
        const [inscripcion] = await con.execute(
          `SELECT i.id, i.active, i.student_id, i.course_schedule, cs.course_id
           FROM inscriptions i
           JOIN courses_schedules cs ON cs.id = i.course_schedule
           WHERE i.id = ? FOR UPDATE`,
          [inscripcionId]
        );
        if (inscripcion.length === 0) throw new Error('La inscripción no existe.');
        if (!inscripcion[0].active) throw new Error('La inscripción está cancelada.');
        if (inscripcion[0].course_schedule === nuevoHorarioId) {
          throw new Error('El estudiante ya está en ese horario.');
        }
  
        const [nuevo] = await con.execute(
          `SELECT cs.id, cs.course_id, cs.active, cl.capacity
           FROM courses_schedules cs
           JOIN classrooms cl ON cl.id = cs.classroom_id
           WHERE cs.id = ? FOR UPDATE`,
          [nuevoHorarioId]
        );
        if (nuevo.length === 0) throw new Error('El nuevo horario no existe.');
        if (!nuevo[0].active) throw new Error('El nuevo horario está inactivo.');
        if (nuevo[0].course_id !== inscripcion[0].course_id) {
          throw new Error('Solo se puede trasladar a otro horario del mismo curso.');
        }
  
        const [repetida] = await con.execute(
          'SELECT id FROM inscriptions WHERE student_id = ? AND course_schedule = ? AND active = 1',
          [inscripcion[0].student_id, nuevoHorarioId]
        );
        if (repetida.length > 0) throw new Error('El estudiante ya tiene una inscripción activa en el nuevo horario.');
  
        const [cupo] = await con.execute(
          'SELECT COUNT(*) AS total FROM inscriptions WHERE course_schedule = ? AND active = 1',
          [nuevoHorarioId]
        );
        if (cupo[0].total >= nuevo[0].capacity) {
          throw new Error(`El salón del nuevo horario está lleno (capacidad: ${nuevo[0].capacity}).`);
        }
  
        await con.execute('UPDATE inscriptions SET course_schedule = ? WHERE id = ?', [nuevoHorarioId, inscripcionId]);
      });
    }
  }
  
  module.exports = Transacciones;