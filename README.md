# Sistema de Gestión Académica (consola)

Proyecto hecho con **Node.js** y **MySQL** para practicar bases de datos y
programación orientada a objetos. Es una aplicación de consola que permite
hacer un **CRUD** sobre las 10 tablas de un sistema académico y ejecutar
algunas **transacciones** (matricular, cancelar, calificar y trasladar).

## Tecnologías

- Node.js 18 o superior
- MySQL 8
- Librería [mysql2](https://www.npmjs.com/package/mysql2) (con promesas)

## Estructura del proyecto

```
gestion-academica/
├── docs/
│   ├── requerimientos.md   # qué debe hacer el sistema
│   └── base_datos.sql      # script de la base de datos + datos de prueba
├── src/
│   ├── main.js             # punto de entrada
│   ├── menu.js             # menús de la consola
│   ├── transacciones.js    # operaciones con commit y rollback
│   └── funciones.js        # conexión, clases del CRUD y funciones de apoyo
├── .gitignore
├── package.json
└── README.md
```

## Cómo ejecutarlo

1. Clonar el repositorio e instalar las dependencias:

   ```bash
   npm install
   ```

2. Crear la base de datos (esto también inserta datos de prueba):

   ```bash
   mysql -u root -p < docs/base_datos.sql
   ```

3. Configurar la conexión con variables de entorno. Si no se definen, usa
   `localhost`, usuario `root`, sin contraseña y la base `sistema_academico`.

   ```bash
   # Linux / Mac
   export DB_PASSWORD="mi_clave"

   # Windows (PowerShell)
   $env:DB_PASSWORD="mi_clave"
   ```

   Variables disponibles: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.

4. Iniciar la aplicación:

   ```bash
   npm start
   ```

## Cómo se usa

Al iniciar aparece un menú principal con una opción por tabla y otra para las
transacciones. Dentro de cada tabla se puede:

1. Listar
2. Buscar por id
3. Crear
4. Actualizar (con Enter se deja el valor que ya tenía)
5. Eliminar (pide confirmación)

Las fechas se escriben así: `2026-10-01` o `2026-10-01 08:00`.

## Transacciones

Están en `src/transacciones.js` y usan `beginTransaction`, `commit` y `rollback`.
Si algo falla, no se guarda nada.

| Transacción | Qué hace |
|-------------|----------|
| Matricular | Inscribe a un estudiante revisando que el horario esté activo, que no esté repetido y que haya cupo en el salón. |
| Cancelar | Borra las notas de la inscripción y la deja inactiva. |
| Registrar nota | Guarda la nota (0 a 100) de una inscripción activa. Solo una nota por inscripción. |
| Trasladar | Mueve al estudiante a otro horario **del mismo curso**, si hay cupo. |

Un truco para probar el cupo: el horario 1 usa el salón `A101`, que tiene capacidad
para 3 personas. Al matricular estudiantes en ese horario, el cuarto debe ser rechazado.

## Principios que apliqué

- **Herencia:** `RepositorioBase` tiene el CRUD genérico y cada tabla (`Estudiantes`,
  `Cursos`, `Salones`...) hereda de ella.
- **Polimorfismo:** las clases hijas sobrescriben métodos como `validar()`, `formatear()`
  y `listar()`. El menú llama a esos métodos sin saber de qué tabla se trata.
- **SOLID:**
  - **S** (una sola responsabilidad): cada clase maneja una tabla; el menú solo muestra
    cosas y `Transacciones` solo se ocupa de las transacciones.
  - **O** (abierto/cerrado): para agregar una tabla nueva se crea otra clase hija sin
    modificar las demás.
  - **L** (sustitución de Liskov): cualquier hija se puede usar donde se espera
    `RepositorioBase`.
  - **I** (segregación de interfaces): cada clase expone solo los métodos que se usan.
  - **D** (inversión de dependencias): la conexión se crea en `main.js` y se pasa a las
    clases por el constructor, no la crean ellas.

## Cosas que aprendí

- Usar `?` en las consultas para evitar inyección SQL.
- Que `SELECT ... FOR UPDATE` bloquea filas y evita que dos matrículas pasen el cupo.
- Liberar siempre la conexión con `release()` dentro de un `finally`.
- Traducir los errores de MySQL a mensajes que un usuario entienda.

## Autor

Will — estudiante de Campuslands (desarrollo de software y bases de datos).