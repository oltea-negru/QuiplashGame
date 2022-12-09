var socket = null;

//Prepare game
var app = new Vue({
    el: '#game',
    data: {
        me: { username: '', score: 0, state: 0, password: '' },
        state: { state: false },
        players: [],
        audience: [],
        chatmessage: '',
    },
    mounted: function ()
    {
        connect();
    },
    methods: {
        login()
        {
            socket.emit('login', this.me.username, this.me.password);
        },
        register()
        {
            socket.emit('register', this.me.username, this.me.password);
        },
        changeMeState(state)
        {
            this.me.state = state;
        },
        startGame()
        {
            console.log('Start game from client');
            socket.emit('startGame');
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

    socket.on('error', function (res)
    {
        alert(res);
    });

    socket.on('stateChange', function (res)
    {
        app.state = res.state;
        app.players = res.players;
        app.me = res.me;
        app.audience = res.audience;
    });



}
