'use strict';

//Set up express
const express = require('express');
const app = express();
const axios = require('axios');
const config = require('./config.json');

//Setup constants from config file
const cloud_server = config.CLOUD_SERVER;
const player_login = config.PLAYER_LOGIN;
const player_register = config.PLAYER_REGISTER;
const prompt_create_prompt = config.PROMPT_CREATE;
const prompts_get = config.PROMPTS_GET;
const prompt_delete = config.PROMPT_DELETE;
const prompt_edit = config.PROMPT_EDIT;
const prompt_get_text = config.PROMPTS_GET_TEXT;
const player_top = config.PLAYER_TOP;
const player_update = config.PLAYER_UPDATE;
const key = config.APP_KEY;
const headers = { 'x-functions-key': key };

//Setup server side game state
let players = new Map();
let playersToSockets = new Map();
let socketsToPlayers = new Map();
let gameState = { state: 0, players: [], audience: [], round: 1, currentPrompts: [] };

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
    updatePlayer(socket);
  }
}

function updatePlayer(socket)
{
  const current = socketsToPlayers.get(socket);
  const player = players.get(current);
  const data = {
    state: { state: gameState.state, round: gameState.round },
    players: gameState.players,
    audience: gameState.audience,
    me: player,
    error: '',
    prompt: ''
  };
  console.log('Update player: ' + current);
  socket.emit('stateChange', data);
}

async function login(socket, username, password)
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

        if (gameState.players.length < 3 && gameState.state == 0)
        {
          if (!gameState.players.includes(username))
            gameState.players.push(username);
          players.set(username, { username: username, score: 0, state: 2, password: password });
        }
        else if (gameState.players.length >= 3 || gameState.state > 0)
        {
          if (!gameState.audience.includes(username))
            gameState.audience.push(username);
          players.set(username, { username: username, score: 0, state: 2, password: password });
        }
        updateAll();
      }
    });

}

async function register(socket, username, password)
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

        if (gameState.players.length < 3 && gameState.state == 0)
        {
          if (!gameState.players.includes(username))
            gameState.players.push(username);
          players.set(username, { username: username, score: 0, state: 2, password: password });
        }
        else if (gameState.players.length >= 3 || gameState.state > 0)
        {
          if (!gameState.audience.includes(username))
            gameState.audience.push(username);
          players.set(username, { username: username, score: 0, state: 2, password: password });
        }
        updateAll();
      }
    });

}

async function createPrompt(socket, username, password, prompt)
{
  console.log('Create prompt: ' + prompt);
  let res = await axios.post(cloud_server + prompt_create_prompt,
    { "username": username, "password": password, "text": prompt },
    { headers: headers })
    .then((response) =>
    {
      if (response.data.result == false)
      {
        socket.emit('error', response.data.msg)
      }
      else
      {
        // gameState.currentPrompts.push(prompt);
        socket.emit('promptCreated');
      }
    });
}

async function handleGetPrompts()
{
  let totalPrompts = [];
  var numberOfPrompts = gameState.players.length % 2 == 1 ? gameState.players.length : gameState.players.length / 2;

  let res = await axios.post(cloud_server + prompts_get,
    {
      "prompts": numberOfPrompts
    },
    { headers: headers }).then((response) =>
    {
      response.data.forEach((prompt) => totalPrompts.push(prompt.text));
    });

  console.log(totalPrompts);
  let playerPairs = [];
  for (let i = 0; i < totalPrompts.length; i++)
  {
    playerPairs.push([]);
  }

  for (let i = 0; i < totalPrompts.length; i++)
  {
    let randomIndex = Math.floor(Math.random() * gameState.players.length);
    while (searchForArray(playerPairs, [gameState.players[randomIndex], gameState.players[i]]) != -1 ||
      randomIndex == i
    )
    {
      randomIndex = Math.floor(Math.random() * gameState.players.length);
    }
    playerPairs[i].push(gameState.players[i]);
    playerPairs[i].push(gameState.players[randomIndex]);
  }
  console.log(playerPairs);
  console.log('Total prompts: ', totalPrompts);
}

function searchForArray(haystack, needle)
{
  var i, j, current;
  for (i = 0; i < haystack.length; ++i)
  {
    if (needle.length === haystack[i].length)
    {
      current = haystack[i];
      for (j = 0; j < needle.length && needle[j] === current[j]; ++j);
      if (j === needle.length)
        return i;
    }
  }
  return -1;
}



//Handle new connection
io.on('connection', socket =>
{
  console.log('New connection');

  socket.on('login', (username, password) =>
  {
    login(socket, username, password);
  });

  socket.on('register', (username, password) =>
  {
    register(socket, username, password);
  });

  socket.on('startGame', () =>
  {
    console.log('Start game');
    gameState.state = 1;
    updateAll();
  });

  //Handle disconnection
  socket.on('disconnect', () =>
  {
    console.log('Dropped connection');
    const current = socketsToPlayers.get(socket);
    if (current != undefined)
    {
      players.delete(current);
      playersToSockets.delete(current);
      socketsToPlayers.delete(socket);
      gameState.players = gameState.players.filter(e => e != current);
      gameState.audience = gameState.audience.filter(e => e != current);
      updateAll();
    }

  });

  socket.on('createPrompt', (username, password, prompt) =>
  {
    createPrompt(socket, username, password, prompt);
  });

  socket.on('getPrompts', () =>
  {
    handleGetPrompts();
  })

  socket.on('nextRound', () =>
  {
    console.log('Next round');
    gameState.round++;
    if (gameState.round > 3)
    {
      gameState.state = 2;
    }
    updateAll();
  });



});

//Start server
if (module === require.main)
{
  startServer();
}

module.exports = server;

