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
let playersToPromptsToAnswers = new Map();
let promptsToAnswers = new Map();
let promptsToPlayersToVotes = new Map();
let currentPrompts = [];
let currentPlayerPairs = [];
let currentAnswers = [];
let whoAnswered = [];
let voteCount = [];

let gameState = {
  state: 0,
  players: [],
  audience: [],
  round: 1,
  currentPrompts: [],
  currentAnswers: [],
  currentPlayerPairs: [],
  voteCount: [],
  whoAnswered: [],
  roundScores: [],
  globalScores: [],
};

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
    state: gameState,
    players: gameState.players,
    audience: gameState.audience,
    me: player,
    error: '',
    prompt1: '',
    prompt2: '',
    prompt: '',
    answer: '',
    answer1: '',
    answer2: '',
  };
  console.log('Update player: ' + current);
  socket.emit('stateChange', data);
}

function updatePlayersPrompts(currentPrompts, currentPlayerPairs)
{
  for (let i = 0; i < currentPlayerPairs.length; i++)
  {
    let socket1 = playersToSockets.get(currentPlayerPairs[i][0]);
    let socket2 = playersToSockets.get(currentPlayerPairs[i][1]);

    socket1.emit('promptToAnswer', currentPrompts[i]);
    socket2.emit('promptToAnswer', currentPrompts[i]);
  }

  gameState.state++;
  updateAll();
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
          players.set(username, { username: username, score: 0, state: 2, password: password, voteIndex: 0 });
        }
        else if (gameState.players.length >= 3 || gameState.state > 0)
        {
          if (!gameState.audience.includes(username))
            gameState.audience.push(username);
          players.set(username, { username: username, score: 0, state: 2, password: password, voteIndex: 0 });
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
        socket.emit('promptCreated');
      }
    });
}

async function getPrompts()
{
  let totalPrompts = [];
  var numberOfPrompts = gameState.players.length % 2 == 1 ? gameState.players.length : gameState.players.length / 2;

  console.log('Get prompts: ' + numberOfPrompts);

  let res = await axios.post(cloud_server + prompts_get,
    {
      "prompts": numberOfPrompts
    },
    { headers: headers }).then((response) =>
    {
      response.data.forEach((prompt) => totalPrompts.push(prompt.text));
    });

  let playerPairs = [];
  for (let i = 0; i < totalPrompts.length; i++)
  {
    playerPairs.push([]);
    whoAnswered.push([]);
    voteCount.push([]);
  }

  for (let i = 0; i < totalPrompts.length; i++)
  {
    let j = i + 1;
    if (j == totalPrompts.length)
      j = 0;
    playerPairs[i].push(gameState.players[i]);
    playerPairs[i].push(gameState.players[j]);
  }
  console.log('Total prompts: ', totalPrompts);

  currentPrompts = totalPrompts;
  currentPlayerPairs = playerPairs;

  updatePlayersPrompts(totalPrompts, playerPairs);

  for (let i = 0; i < totalPrompts.length; i++)
  {
    let aux = new Map();
    if (playersToPromptsToAnswers.has(playerPairs[i][0]))
      aux = playersToPromptsToAnswers.get(playerPairs[i][0]);
    aux.set(totalPrompts[i], "");

    let aux2 = new Map();
    if (playersToPromptsToAnswers.has(playerPairs[i][1]))
      aux2 = playersToPromptsToAnswers.get(playerPairs[i][1]);
    aux2.set(totalPrompts[i], "");

    playersToPromptsToAnswers.set(playerPairs[i][0], aux);
    playersToPromptsToAnswers.set(playerPairs[i][1], aux2);

    promptsToAnswers.set(totalPrompts[i], []);

    console.log(playerPairs);
  }

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

function handleAnswer(username, answer, prompt)
{
  let aux = playersToPromptsToAnswers.get(username);
  aux.set(prompt, answer);
  playersToPromptsToAnswers.set(username, aux);

  let aux2 = promptsToAnswers.get(prompt);
  aux2.push(answer);
  promptsToAnswers.set(prompt, aux2);

  let aux3 = new Map();
  if (promptsToPlayersToVotes.has(prompt))
    aux3 = promptsToPlayersToVotes.get(prompt);

  aux3.set(username, 0);
  promptsToPlayersToVotes.set(prompt, aux3);

  console.log(promptsToPlayersToVotes, "promptToPlayersToVotes");

}

function handleVoting()
{
  for (let prompt of currentPrompts)
  {
    let answers = promptsToAnswers.get(prompt);
    currentAnswers.push(answers);
  }

  console.log(currentAnswers, "currentAnswers form");

  for (let i = 0; i < currentAnswers.length; i++)
  {
    let aux = currentAnswers[i];
    let temp = currentPrompts[i];
    let players = [];
    let votes = [];
    for (let answer of aux)
    {
      for (let [key, value] of playersToPromptsToAnswers)
      {
        for (let [key2, value2] of value)
        {
          if (key2 == temp && value2 == answer)
          {
            let aux = promptsToPlayersToVotes.get(temp);
            let aux2 = aux.get(key);
            votes.push(aux2);
            players.push(key);
            break;
          }
        }
      }
    }
    whoAnswered[i] = players;
    voteCount[i] = votes;

  }

  console.log(whoAnswered, "whoAnswered ");
  console.log(voteCount, "voteCount ");

  gameState.state = 3;
  gameState.currentPrompts = currentPrompts;
  gameState.currentAnswers = currentAnswers;
  gameState.currentPlayerPairs = currentPlayerPairs;
  gameState.whoAnswered = whoAnswered;
  gameState.voteCount = voteCount;

  updateAll();
}

function handleVote(prompt, answer)
{
  var player = null;

  for (let [key, value] of playersToPromptsToAnswers)
  {
    for (let [key2, value2] of value)
    {
      if (key2 == prompt && value2 == answer)
      {
        player = key;
        break;
      }
    }
  }

  let aux = promptsToPlayersToVotes.get(prompt);
  let votes = aux.get(player);
  votes++;
  aux.set(player, votes);
  promptsToPlayersToVotes.set(prompt, aux);

  console.log(gameState.voteCount, "gameState.voteCount beeeeeeeeeeeeeeeeefore");

  for (let i = 0; i < gameState.whoAnswered.length; i++)
  {
    if (gameState.whoAnswered[i].includes(player) && gameState.currentPrompts[i] == prompt)
    {
      if (gameState.whoAnswered[i][0] == player)
      {
        for (let [key, value] of promptsToPlayersToVotes.get(prompt))
          if (key == player)
            gameState.voteCount[i][0] = value;
      }
      else if (gameState.whoAnswered[i][1] == player)
      {
        for (let [key, value] of promptsToPlayersToVotes.get(prompt))
          if (key == player)
            gameState.voteCount[i][1] = value;
      }
    }
  }

  console.log(gameState.voteCount, "gameState.voteCount afterrrrrrrrrrrrrrrrrrr");

  console.log("Incresing score of player: ", player, " by ", gameState.round * 100);
  let data = players.get(player);
  data.score += gameState.round * 100;
  players.set(player, data);
  console.log("New score", data.score, "for player", player);
  updateAll();

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
    if (gameState.players.length < 3)
      socket.emit('error', 'Not enough players! We need at least 3 players to start the game!');
    else
    {
      gameState.state = 1;
      updateAll();
    }
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
    getPrompts();
  });

  socket.on('submitAnswer', (username, answer, prompt) =>
  {
    handleAnswer(username, answer, prompt);
  });

  socket.on('vote', () =>
  {
    handleVoting();
  });

  socket.on("voteFor", (prompt, answer) =>
  {
    handleVote(prompt, answer);
  });

  socket.on("seeScores", () =>
  {
    let results = [];
    players.forEach((value, key) => { results.push(value.score) });
    gameState.state = 4;
    gameState.roundScores = results;
    updateAll();
  });

  socket.on("increaseVotingIndex", () =>
  {
    for (let [player, data] of players)
    {
      data.voteIndex++;
      players.set(player, data);
    }
    updateAll();
  })

  socket.on('nextRound', () =>
  {
    if (gameState.round == 3)
    {
      gameState.state = 5;
    }
    else
    {
      console.log('Next round');
      gameState.round++;
      gameState.state = 1;
      gameState.currentPrompts = [];
      gameState.currentAnswers = [];
      gameState.currentPlayerPairs = [];
      gameState.whoAnswered = [];
      gameState.voteCount = [];
      gameState.roundScores = [];

      for (let [player, data] of players)
      {
        data.voteIndex = 0;
        players.set(player, data);
      }
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

