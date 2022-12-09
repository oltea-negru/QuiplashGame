'use strict';

//Set up express
const express = require('express');
const app = express();
const axios = require('axios');
const config = require('./config.json');
const cloud_server = config.CLOUD_SERVER;
const player_login = config.PLAYER_LOGIN;
const player_register = config.PLAYER_REGISTER;
const key = config.APP_KEY;
const headers = { 'x-functions-key': key };

//Setup socket.io
const server = require('http').Server(app);
const io = require('socket.io')(server);



//Setup static page handling
app.set('view engine', 'ejs');
app.use('/static', express.static('public'));

//Handle client interface on /
app.get('/', (req, res) =>
{
  res.render('client');
});
//Handle display interface on /display
app.get('/display', (req, res) =>
{
  res.render('display');
});

//Start the server
function startServer()
{
  const PORT = process.env.PORT || 8080;
  server.listen(PORT, () =>
  {
    console.log(`Server listening on port ${PORT}`);
  });
}

function updateAll()
{
  console.log('Update all');
  for (let [player, socket] of playersToSockets)
  {
    console.log('Socket ' + socket.id);
    updatePlayer(socket);
  }
}

function updatePlayer(socket)
{
  const current = socketsToPlayers.get(socket);
  const player = players.get(current);
  const data = { state: gameState.state, players: gameState.players, audience: gameState.audience, me: player };
  socket.emit('stateChange', data);

}

async function handleLogin(socket, username, password)
{
  console.log('Login: ' + username + ' ' + password);
  let res = await axios.post(cloud_server + player_login,
    { "username": username, "password": password },
    { headers: headers })
    .then((response) =>
    {
      if (response.data.result == false)
      {
        socket.emit('error', response.data.msg)
      }
      else
      {
        playersToSockets.set(username, socket);
        socketsToPlayers.set(socket, username);

        if (gameState.players.length < 2 && gameState.state == 0)
        {
          if (!gameState.players.includes(username))
            gameState.players.push(username);
          players.set(username, { username: username, score: 0, state: 2, password: password });
        }
        else if (gameState.players.length >= 2 || gameState.state > 0)
        {
          if (!gameState.audience.includes(username))
            gameState.audience.push(username);
          players.set(username, { username: username, score: 0, state: 2, password: password });
        }
        updateAll();
      }
    });

}

async function handleRegister(socket, username, password)
{
  console.log('Register: ' + username + ' ' + password);
  let res = await axios.post(cloud_server + player_register,
    { "username": username, "password": password },
    { headers: headers })
    .then((response) =>
    {
      if (response.data.result == false)
      {
        socket.emit('error', response.data.msg)
      }
      else
      {
        playersToSockets.set(username, socket);
        socketsToPlayers.set(socket, username);

        if (gameState.players.length < 2 && gameState.state == 0)
        {
          if (!gameState.players.includes(username))
            gameState.players.push(username);
          players.set(username, { username: username, score: 0, state: 2, password: password });
        }
        else if (gameState.players.length >= 2 || gameState.state > 0)
        {
          if (!gameState.audience.includes(username))
            gameState.audience.push(username);
          players.set(username, { username: username, score: 0, state: 2, password: password });
        }
        updateAll();
      }
    });

}

let players = new Map();
let playersToSockets = new Map();
let socketsToPlayers = new Map();
let gameState = { state: 0, players: [], audience: [] };

//Handle new connection
io.on('connection', socket =>
{
  console.log('New connection');

  //Handle disconnection
  socket.on('disconnect', () =>
  {
    console.log('Dropped connection');
  });

  socket.on('login', (username, password) =>
  {
    console.log('Login!!!!');
    handleLogin(socket, username, password);
  });

  socket.on('register', (username, password) =>
  {
    console.log('REgister!!!!');
    handleRegister(socket, username, password);
  });
});

//Start server
if (module === require.main)
{
  startServer();
}

module.exports = server;

