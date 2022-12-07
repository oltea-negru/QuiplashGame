var socket = null;

//Prepare game
var app = new Vue({
    el: '#game',
    data: {
        error: null,
        me: { name: '', score: 0, state: 0 },
        state: { state: false },
        players: {},
        chatmessage: '',
    },
    mounted: function ()
    {
        connect();
    },
    methods: {
        handleStatus(state)
        {
            this.state.state = !state;
        },
        reverseState()
        {
            socket.emit('stateChange', this.state.state);
        }
    }
});

function connect()
{
    //Prepare web socket
    socket = io();

    //Connect
    socket.on('connect', function ()
    {
        app.state.state = 0;
    });

    //Handle connection error
    socket.on('connect_error', function (message)
    {
        app.error = message;
        alert('Unable to connect: ' + message);
    });

    //Handle disconnection
    socket.on('disconnect', function ()
    {
        alert('Disconnected');
        app.state.state = false;
    });

    // //Handle incoming chat message
    // socket.on('chat', function (message)
    // {
    //     app.handleChat(message);
    // });

    socket.on('stateChange', function (state)
    {
        app.handleStatus(state);
    });


}
