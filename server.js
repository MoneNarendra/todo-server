const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const dbpath = path.join(__dirname, "todo.db");
const app = express();

app.use(express.json());
app.use(cors());

let db = null;
const PORT = process.env.PORT || 3000;

const initilaizeDbAndServer = async () => {
  try {
    (db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    })),
      app.listen(PORT, () => {
        console.log("Server Started...");
      });
  } catch (e) {
    console.log(`Error db: ${e.message}`);
    process.exit(1);
  }
};

initilaizeDbAndServer();

app.get("/todo/allUsers/", async (request, response) => {
  const getUsersQuery = `SELECT * FROM user`;
  const allUsers = await db.all(getUsersQuery);
  response.send(allUsers);
});

const AuthontecateUser = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid Access Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.send("Invalid Access Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

// SignIn User

app.post("/signIn/", async (request, response) => {
  const { username, name, password, gender, location } = request.body;

  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    const createUserQuery = `
        INSERT INTO
          user (username, name, password, gender)
        VALUES
          (
            '${username}',
            '${name}',
            '${hashedPassword}',
            '${gender}'
          )`;
    await db.run(createUserQuery);
    const createUserTable = `CREATE TABLE ${username} ( id TEXT, task TEXT, isCompleted BOOLEAN)`;
    await db.run(createUserTable);
    const payload = {
      username: username,
    };
    const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
    response.send(JSON.stringify({ jwtToken }));
  } else {
    response.status(400);
    response.send(JSON.stringify({ error_msg: "Username already taken" }));
  }
});

// Login User

app.post("/logIn/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send(JSON.stringify({ error_msg: "Invalid User" }));
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send(JSON.stringify({ error_msg: "Invalid Password" }));
    }
  }
});

// Add Todo

app.post("/todo/add/", AuthontecateUser, async (request, response) => {
  const { id, task, isCompleted } = request.body;
  const addTodoQuery = `
    INSERT INTO
      ${request.username} (id, task, isCompleted)
    VALUES
      (
        '${id}',
         '${task}',
         ${isCompleted}
      );`;

  const dbResponse = await db.run(addTodoQuery);
  response.send("created");
});

//All todos

app.get("/todo/allTodos/", AuthontecateUser, async (request, response) => {
  const getTodosQuery = `SELECT * FROM ${request.username}`;
  const allTodos = await db.all(getTodosQuery);
  response.send(allTodos);
});

//Delete todos

app.delete("/todo/delete/:id/", AuthontecateUser, async (request, response) => {
  const { id } = request.params;
  const deleteTodoQuery = `
    DELETE FROM
      ${request.username}
    WHERE
      id = '${id}';`;
  await db.run(deleteTodoQuery);
  response.send("Todo Deleted Successfully");
});

// Upadate Todo

app.put("/todo/update/:id", AuthontecateUser, async (request, response) => {
  const { id } = request.params;
  const bookDetails = request.body;
  const { task, isCompleted } = bookDetails;
  const updateTodoQuery = `
    UPDATE
       ${request.username}
    SET
        task='${task}',
        isCompleted = ${isCompleted}  
    WHERE
      id = '${id}';`;
  await db.run(updateTodoQuery);
  response.send("Todo Updated Successfully");
});

// User Details

app.get("/todo/userDetails/", AuthontecateUser, async (request, response) => {
  const getUserQuery = `SELECT name, username, gender FROM user WHERE username = '${request.username}'`;
  const userDetails = await db.get(getUserQuery);
  response.send(JSON.stringify(userDetails));
});

// Delete user

app.delete("/todo/deleteUser/", AuthontecateUser, async (request, response) => {
  const deleteUserQuery = `DELETE  FROM user WHERE username = '${request.username}'`;
  await db.run(deleteUserQuery);
  const deleteUserTableQuery = `DROP TABLE ${request.username}`;
  await db.run(deleteUserTableQuery);
  response.send("deleted Succfully");
});
