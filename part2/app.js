'use strict';

const { reverse } = require('dns');
//Set up express
const express = require('express');
const app = express();

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

//Chat message
function handleChat(message)
{
  console.log('Handling chat: ' + message);
  io.emit('chat', message);
}

function handleState(state)
{
  console.log('Handling state: ' + state);
  io.emit('stateChange', state);
}

//Handle new connection
io.on('connection', socket =>
{
  console.log('New connection');

  //Handle on chat message received
  socket.on('chat', message =>
  {
    handleChat(message);
  });

  socket.on('stateChange', state =>
  {
    handleState(state);
  });

  //Handle disconnection
  socket.on('disconnect', () =>
  {
    console.log('Dropped connection');
  });

  socket.on('stateChange', (state) =>
  {
    console.log('State!!!!');
    handleState(state);
  });
});

//Start server
if (module === require.main)
{
  startServer();
}

module.exports = server;

