# QuiplashGame

A clone of the popular Quiplash game from the Jackbox Party Pack.

Part 1 (Python and Azure) holds the stateless and persistent components of the game - the users and the prompts. Azure functions are used to allow people to register, login, submit prompts and to allow for the retrieval of prompts and player data.

Part 2 (Javascript and Google App Engine) holds the stateful part of the game using a NodeJS server running on Google App Engine, creating a game instance where prompts are retrieved from Part I and players submit answers and their scoring. A clientside application using VueJS is used for client-based interaction and communication with the server.

Instructions:

1. cd part2
2. npm start
3. Join with mininim 3 sockets and enjoy :)
