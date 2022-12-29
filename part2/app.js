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
let promptsSubmitted = [];

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
  scores: [],
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

// Iterate through all players and update their state
function updateAll()
{
  console.log('Update all');
  for (let [player, socket] of playersToSockets)
  {
    updatePlayer(socket);
  }
}

// Update a single player
function updatePlayer(socket)
{
  const playerUsername = socketsToPlayers.get(socket);
  const playerState = players.get(playerUsername);
  const data = {
    state: gameState,
    players: gameState.players,
    audience: gameState.audience,
    me: playerState,
    error: '',
    prompt1: '',
    prompt2: '',
    prompt: '',
    answer: '',
    answer1: '',
    answer2: '',
  };
  console.log('Update player: ' + playerUsername);
  socket.emit('stateChange', data);
}

// Validates the player's login credentials against cloud database and adds them to the game with the appropriate state
async function login(socket, username, password)
{
  console.log('Login: ' + username + ' ' + password);
  await axios.post(cloud_server + player_login,
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
        getStats(socket);

        // If there are less than 3 players and the game hasn't started, add as player
        if (gameState.players.length < 3 && gameState.state == 0)
        {
          if (!gameState.players.includes(username))
            gameState.players.push(username);
          players.set(username, { username: username, score: 0, state: 2, password: password, voteIndex: 0, stats: [], openStats: false });
        }
        // If there are 3 or more players or if the game has started, add as audience member
        else if (gameState.players.length >= 3 || gameState.state > 0)
        {
          if (!gameState.audience.includes(username))
            gameState.audience.push(username);
          players.set(username, { username: username, score: 0, state: 2, password: password, voteIndex: 0, stats: [], openStats: false });
        }
        updateAll();
      }
    }).catch((error) => console.log(error));

}

// Validates the player's registration credentials and adds them to the game with the appropriate state as well as registering them on the cloud
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

        // If there are less than 3 players and the game hasn't started, add as player
        if (gameState.players.length < 3 && gameState.state == 0)
        {
          if (!gameState.players.includes(username))
            gameState.players.push(username);
          players.set(username, { username: username, score: 0, state: 2, password: password, voteIndex: 0, stats: [], openStats: false });
        }
        // If there are 3 or more players or if the game has started, add as audience member
        else if (gameState.players.length >= 3 || gameState.state > 0)
        {
          if (!gameState.audience.includes(username))
            gameState.audience.push(username);
          players.set(username, { username: username, score: 0, state: 2, password: password, voteIndex: 0, stats: [], openStats: false });
        }
        updateAll();
      }
    }).catch((error) => console.log(error));

}

// Handles the player's request to create a prompt and sends it to the cloud
async function createPrompt(socket, username, password, prompt)
{
  console.log('Create prompt: ' + prompt);
  await axios.post(cloud_server + prompt_create_prompt,
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
        promptsSubmitted.push(prompt);
      }
    }).catch((error) => console.log(error));
}

// Retrieves 50% of needed prompts from the cloud if available, otherwise uses the prompts already submitted
async function getPrompts()
{
  let totalPrompts = [];
  var numberOfPrompts = gameState.players.length % 2 == 1 ? gameState.players.length : gameState.players.length / 2;
  var requestNumber = promptsSubmitted.length < numberOfPrompts / 2 ? numberOfPrompts : parseInt(numberOfPrompts / 2, 10);

  console.log('Get prompts: ' + numberOfPrompts);

  await axios.post(cloud_server + prompts_get,
    {
      "prompts": requestNumber
    },
    { headers: headers }).then((response) =>
    {
      if (response.data.length < requestNumber)
      {
        totalPrompts = promptsSubmitted;
        promptsSubmitted = [];
      }
      else
      {
        response.data.forEach((prompt) => totalPrompts.push(prompt.text));
        let aux = totalPrompts.concat(promptsSubmitted.slice(0, promptsSubmitted.length - requestNumber));
        totalPrompts = aux;
      }

    });

  currentPrompts = totalPrompts;
  console.log('Total prompts: ', totalPrompts);
  console.log('Current prompts: ', currentPrompts);

  createPlayerPairs();
}

// Creates the player pairs for the current round
function createPlayerPairs()
{
  let playerPairs = [];
  for (let i = 0; i < currentPrompts.length; i++)
  {
    playerPairs.push([]);
    whoAnswered.push([]);
    voteCount.push([]);
  }

  console.log('Player pairs: ', playerPairs);
  console.log('Who answered: ', whoAnswered);
  console.log('Vote count: ', voteCount);

  for (let i = 0; i < currentPrompts.length; i++)
  {
    let j = i + 1;
    if (j == currentPrompts.length)
      j = 0;
    playerPairs[i].push(gameState.players[i]);
    playerPairs[i].push(gameState.players[j]);
  }


  currentPlayerPairs = playerPairs;

  updatePlayersPrompts(currentPrompts, playerPairs);

  for (let i = 0; i < currentPrompts.length; i++)
  {
    let aux = new Map();
    if (playersToPromptsToAnswers.has(playerPairs[i][0]))
      aux = playersToPromptsToAnswers.get(playerPairs[i][0]);
    aux.set(currentPrompts[i], "");

    let aux2 = new Map();
    if (playersToPromptsToAnswers.has(playerPairs[i][1]))
      aux2 = playersToPromptsToAnswers.get(playerPairs[i][1]);
    aux2.set(currentPrompts[i], "");

    playersToPromptsToAnswers.set(playerPairs[i][0], aux);
    playersToPromptsToAnswers.set(playerPairs[i][1], aux2);

    promptsToAnswers.set(currentPrompts[i], []);
  }

  console.log('Players pairs: ', playerPairs);
  console.log('Players to prompts to answers: ', playersToPromptsToAnswers);
  console.log('Prompts to answersssssssssssss: ', promptsToAnswers);

}

// Updates the pairs of players with their corresponding prompt
function updatePlayersPrompts(currentPrompts, currentPlayerPairs)
{
  console.log('Update players prompts');

  for (let i = 0; i < currentPlayerPairs.length; i++)
  {
    let socket1 = playersToSockets.get(currentPlayerPairs[i][0]);
    let socket2 = playersToSockets.get(currentPlayerPairs[i][1]);

    socket1.emit('promptToAnswer', currentPrompts[i]);
    socket2.emit('promptToAnswer', currentPrompts[i]);

    console.log(currentPrompts[i], "import here");
  }

  gameState.state++;
  updateAll();
}

// Handles the player's request to submit an answer and sends it to the cloud
function submitAnswer(username, answer, prompt)
{
  console.log('Submit answer: ', answer, ' for prompt: ', prompt, ' by player: ', username);
  let aux = playersToPromptsToAnswers.get(username);
  aux.set(prompt, answer);
  playersToPromptsToAnswers.set(username, aux);

  let aux2 = [];
  if (promptsToAnswers.has(prompt))
    aux2 = promptsToAnswers.get(prompt);
  aux2.push(answer);
  promptsToAnswers.set(prompt, aux2);

  let aux3 = new Map();
  if (promptsToPlayersToVotes.has(prompt))
    aux3 = promptsToPlayersToVotes.get(prompt);

  aux3.set(username, 0);
  promptsToPlayersToVotes.set(prompt, aux3);

  console.log(promptsToPlayersToVotes, "promptToPlayersToVotes");
  console.log(promptsToAnswers, "promptsToAnswers");
  console.log(playersToPromptsToAnswers, "playersToPromptsToAnswers");

}

// Advances the game to the voting state
function vote()
{
  console.log('Voting time');
  for (let prompt of currentPrompts)
  {
    let answers = promptsToAnswers.get(prompt);
    currentAnswers.push(answers);
  }

  console.log(currentAnswers, "currentAnswers");

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
    if (votes.length > 2)
    {
      whoAnswered[i] = Array.from(new Set(players));
      voteCount[i] = votes.slice(0, 2);
    }
    else
    {
      whoAnswered[i] = players;
      voteCount[i] = votes;
    }
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

// Handles the player's request to vote for an answer
function submitVote(prompt, answer) 
{
  var player = null;

  console.log("Voting for: ", prompt, " with the answer ", answer)

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
  console.log(gameState.round, "gameState.roundddddddddddddddddddddddddddddddddddddddddddddddddddddd")
  if (gameState.round == 4)
    data.score += 50;
  else
    data.score += gameState.round * 100;
  players.set(player, data);
  console.log("New score", data.score, "for player", player);
  io.emit("timeToVote");
  updateAll();

}

// Adds the score achieved by the player in this game to the cloud
async function addScoreToDb(username, score)
{
  console.log('Add score: ', score, 'to: ' + username);
  let password = players.get(username).password;
  await axios.post(cloud_server + player_update,
    { "username": username, "password": password, "add_to_score": score },
    { headers: headers })
    .then((response) =>
    {
      if (response.data.msg == "OK")
      {
        console.log("Score added");
      }
      else
      {
        console.log("Error adding score", response.data.msg);
      }
    }).catch((error) => console.log(error));
}

// Handles the end of the game scores
function handleTotalScores()
{
  console.log("Handling total scores");
  let aux = new Map();
  for (let [key, value] of players)
  {
    aux.set(key, value.score);
    if (value.score > 0)
      addScoreToDb(key, value.score);
  }
  let sortedAux = new Map([...aux.entries()].sort((a, b) => b[1] - a[1]));
  gameState.scores = Array.from(sortedAux.values());
  gameState.players = Array.from(sortedAux.keys());

  console.log(gameState.scores, "gameState.scores");
  console.log(gameState.players, "gameState.players");
  updateAll();
}

// Retrieves the leaderboard of best 5 players 
async function handleGetLeaderboard()
{
  console.log("Getting leaderboard");
  let res = await axios.post(cloud_server + player_top, { "top": 5 }, { headers: headers });
  console.log(res.data, "LEADERBOARD");
  let aux = new Map();
  for (let i = 0; i < res.data.length; i++)
  {
    aux.set(res.data[i].username, res.data[i].score);
  }
  let sortedAux = new Map([...aux.entries()].sort((a, b) => b[1] - a[1]));
  console.log(sortedAux, "global");

  gameState.globalScores = Array.from(sortedAux.values());
  gameState.players = Array.from(sortedAux.keys());
  gameState.state = 6;

  console.log(gameState.globalScores, "gameState.globalScores");
  console.log(gameState.players, "gameState.players");
  updateAll();
}

async function getStats(socket)
{
  console.log("Getting stats");
  let playerPrompts = [];
  let player = socketsToPlayers.get(socket);

  let res = await axios.post(cloud_server + prompts_get, { "players": [player] }, { headers: headers });
  res.data.forEach((value) => { playerPrompts.push(value.text) });

  socket.emit('stats', { "prompts": playerPrompts.slice(0, 5) });
}
// Handles the end of the round scores
function seeRoundScores()
{
  let results = [];
  players.forEach((value, key) => { results.push(value.score) });
  gameState.state = 4;
  gameState.roundScores = results;
  updateAll();
}

// Advances the game state to the next round
function nextRound()
{
  // If it's the last round, go to the end game state
  if (gameState.round == 4)
  {
    gameState.state = 5;
    handleTotalScores();
  }
  else
  {
    console.log('Next round');
    gameState.round++;
    gameState.state = 1;
    gameState.currentPrompts = [];
    gameState.currentAnswers = [];
    gameState.currentPlayerPairs = [];
    gameState.voteCount = [];
    gameState.whoAnswered = [];
    gameState.roundScores = [];
    gameState.scores = [];
    gameState.globalScores = [];
    promptsSubmitted = [];
    playersToPromptsToAnswers = new Map();
    promptsToAnswers = new Map();
    promptsToPlayersToVotes = new Map();
    currentPrompts = [];
    currentPlayerPairs = [];
    currentAnswers = [];
    whoAnswered = [];
    voteCount = [];
    promptsSubmitted = [];


    for (let [player, data] of players)
    {
      data.voteIndex = 0;
      players.set(player, data);
    }
  }

  io.emit("resetMeState");
  io.emit('changeClick');
  updateAll();
}

//Handle new connection
io.on('connection', socket =>
{
  console.log('New connection');

  //Handle login
  socket.on('login', (username, password) =>
  {
    login(socket, username, password);
  });

  //Handle register
  socket.on('register', (username, password) =>
  {
    register(socket, username, password);
  });

  //Handle start of game
  socket.on('startGame', () =>
  {
    console.log('Start game');
    // Check if there are enough players
    // if (gameState.players.length < 3)
    //   socket.emit('error', 'Not enough players! We need at least 3 players to start the game!');
    // else
    // {
    gameState.state = 1;
    io.emit("gameStarted");
    updateAll();
    // }
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

  // Handle creation of a prompt
  socket.on('createPrompt', (username, password, prompt) =>
  {
    createPrompt(socket, username, password, prompt);
  });

  // Handles retrieving the prompts
  socket.on('getPrompts', () =>
  {
    getPrompts();
  });

  // Handles submitting an answer
  socket.on('submitAnswer', (username, answer, prompt) =>
  {
    submitAnswer(username, answer, prompt);
  });

  // Handles advancing the game state to vote
  socket.on('vote', () =>
  {
    vote();
  });

  // Handles submitting a vote
  socket.on("voteFor", (prompt, answer) =>
  {
    submitVote(prompt, answer);
  });

  // Handles retrieving the scores of the current round
  socket.on("seeScores", () =>
  {
    seeRoundScores();
  });

  // Handles increasing the voting index of all players
  socket.on("increaseVotingIndex", () =>
  {
    for (let [player, data] of players)
    {
      data.voteIndex++;
      players.set(player, data);
    }
    updateAll();

  })

  // Handles advancing the game state to the next round
  socket.on('nextRound', () =>
  {
    nextRound();
  });

  // Handles retrieving the leaderboard of best 5 players
  socket.on("getLeaderboard", () =>
  {
    handleGetLeaderboard();
  })

});

//Start server
if (module === require.main)
{
  startServer();
}

module.exports = server;

