// main.js
// Punto de entrada: conecta a MySQL, arma los objetos y arranca el menú.

const { crearPool, crearInterfaz, crearRepositorios, traducirError } = require('./funciones');
const Menu = require('./menu');
const Transacciones = require('./transacciones');

async function main() {
  const db = crearPool();
  const rl = crearInterfaz();

  try {
    // Pruebo la conexión antes de mostrar el menú
    await db.query('SELECT 1');
    console.log('Conexión a MySQL lista.');

    const repositorios = crearRepositorios(db);
    const transacciones = new Transacciones(db);
    const menu = new Menu(rl, repositorios, transacciones);

    await menu.iniciar();
  } catch (error) {
    console.log('Error:', traducirError(error));
  } finally {
    rl.close();
    await db.end(); // cerrar el pool para que el programa termine
  }
}

main();