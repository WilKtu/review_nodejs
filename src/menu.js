// menu.js
// Todo lo que se ve en la consola: menús, preguntas y mensajes.

const { preguntar, pedirEntero, pedirDatos, traducirError } = require('./funciones');

class Menu {
  // Recibe todo desde afuera: la interfaz de lectura, los repositorios y las transacciones
  constructor(rl, repositorios, transacciones) {
    this.rl = rl;
    this.repositorios = repositorios;
    this.transacciones = transacciones;
  }

  // ----- Menú principal -----
  async iniciar() {
    const claves = Object.keys(this.repositorios);
    let salir = false;

    while (!salir) {
      console.log('\n========== SISTEMA ACADÉMICO ==========');
      claves.forEach((clave, i) => {
        console.log(`${i + 1}. ${this.repositorios[clave].nombreVisible}`);
      });
      console.log(`${claves.length + 1}. Transacciones`);
      console.log('0. Salir');

      const opcion = await preguntar(this.rl, 'Elige una opción: ');
      const numero = Number(opcion);

      if (opcion === '0') {
        salir = true;
        console.log('¡Hasta luego!');
      } else if (numero >= 1 && numero <= claves.length) {
        await this.menuCrud(this.repositorios[claves[numero - 1]]);
      } else if (numero === claves.length + 1) {
        await this.menuTransacciones();
      } else {
        console.log('Opción no válida.');
      }
    }
  }

  // ----- Menú CRUD -----
  // Este mismo método sirve para las 10 tablas: recibe un repositorio cualquiera
  // y llama a sus métodos. Eso es polimorfismo.
  async menuCrud(repo) {
    let volver = false;

    while (!volver) {
      console.log(`\n--- ${repo.nombreVisible} ---`);
      console.log('1. Listar');
      console.log('2. Buscar por id');
      console.log('3. Crear');
      console.log('4. Actualizar');
      console.log('5. Eliminar');
      console.log('0. Volver');

      const opcion = await preguntar(this.rl, 'Elige una opción: ');

      try {
        switch (opcion) {
          case '1':
            repo.mostrar(await repo.listar());
            break;
          case '2':
            await this.buscar(repo);
            break;
          case '3':
            await this.crear(repo);
            break;
          case '4':
            await this.actualizar(repo);
            break;
          case '5':
            await this.eliminar(repo);
            break;
          case '0':
            volver = true;
            break;
          default:
            console.log('Opción no válida.');
        }
      } catch (error) {
        console.log('Error:', traducirError(error));
      }
    }
  }

  async buscar(repo) {
    const id = await pedirEntero(this.rl, 'Id a buscar: ');
    const fila = await repo.buscarPorId(id);
    if (!fila) {
      console.log('No se encontró ningún registro con ese id.');
      return;
    }
    repo.mostrar([fila]);
  }

  async crear(repo) {
    console.log(`\nNuevo registro en ${repo.nombreVisible}`);
    const datos = await pedirDatos(this.rl, repo.campos);

    const errores = repo.validar(datos);
    if (errores.length > 0) {
      errores.forEach((e) => console.log('-', e));
      console.log('No se guardó el registro.');
      return;
    }

    const id = await repo.crear(datos);
    console.log(`Registro creado con id ${id}.`);
  }

  async actualizar(repo) {
    const id = await pedirEntero(this.rl, 'Id a actualizar: ');
    const actual = await repo.buscarPorId(id);
    if (!actual) {
      console.log('No se encontró ningún registro con ese id.');
      return;
    }

    console.log('Presiona Enter para dejar el valor actual.');
    const datos = await pedirDatos(this.rl, repo.campos, actual);

    const errores = repo.validar(datos);
    if (errores.length > 0) {
      errores.forEach((e) => console.log('-', e));
      console.log('No se actualizó el registro.');
      return;
    }

    await repo.actualizar(id, datos);
    console.log('Registro actualizado.');
  }

  async eliminar(repo) {
    const id = await pedirEntero(this.rl, 'Id a eliminar: ');
    const fila = await repo.buscarPorId(id);
    if (!fila) {
      console.log('No se encontró ningún registro con ese id.');
      return;
    }

    repo.mostrar([fila]);
    const confirmar = await preguntar(this.rl, '¿Seguro que quieres eliminarlo? (s/n): ');
    if (confirmar.toLowerCase() !== 's') {
      console.log('Eliminación cancelada.');
      return;
    }

    await repo.eliminar(id);
    console.log('Registro eliminado.');
  }

  // ----- Menú de transacciones -----
  async menuTransacciones() {
    let volver = false;

    while (!volver) {
      console.log('\n--- Transacciones ---');
      console.log('1. Matricular estudiante en un horario');
      console.log('2. Cancelar una inscripción');
      console.log('3. Registrar la nota de una inscripción');
      console.log('4. Trasladar estudiante a otro horario del mismo curso');
      console.log('0. Volver');

      const opcion = await preguntar(this.rl, 'Elige una opción: ');

      try {
        switch (opcion) {
          case '1': {
            const estudianteId = await pedirEntero(this.rl, 'Id del estudiante: ');
            const horarioId = await pedirEntero(this.rl, 'Id del horario: ');
            const id = await this.transacciones.matricular(estudianteId, horarioId);
            console.log(`Matrícula realizada. Id de la inscripción: ${id}`);
            break;
          }
          case '2': {
            const inscripcionId = await pedirEntero(this.rl, 'Id de la inscripción: ');
            const notasBorradas = await this.transacciones.cancelar(inscripcionId);
            console.log(`Inscripción cancelada. Notas eliminadas: ${notasBorradas}`);
            break;
          }
          case '3': {
            const inscripcionId = await pedirEntero(this.rl, 'Id de la inscripción: ');
            const nota = await pedirEntero(this.rl, 'Nota (0 a 100): ');
            const comentario = await preguntar(this.rl, 'Comentario (opcional): ');
            await this.transacciones.registrarNota(inscripcionId, nota, comentario || null);
            console.log('Nota registrada.');
            break;
          }
          case '4': {
            const inscripcionId = await pedirEntero(this.rl, 'Id de la inscripción: ');
            const nuevoHorarioId = await pedirEntero(this.rl, 'Id del nuevo horario: ');
            await this.transacciones.trasladar(inscripcionId, nuevoHorarioId);
            console.log('Traslado realizado.');
            break;
          }
          case '0':
            volver = true;
            break;
          default:
            console.log('Opción no válida.');
        }
      } catch (error) {
        // Si la transacción falló ya se hizo rollback, aquí solo mostramos el motivo
        console.log('No se pudo completar la transacción:', traducirError(error));
      }
    }
  }
}

module.exports = Menu;