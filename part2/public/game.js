var socket = null;

//Prepare game
var app = new Vue({
    el: '#game',
    data: {
        error: '',
        me: { username: 'test10', score: 0, state: 0, password: 'test10test', },
        gameState: { state: false, round: 0, prompt: '' },
        players: [],
        audience: [],
        clicked: false,
        prompt1: '',
        prompt2: '',
        promptToAnswer: '',
        answer: '',
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
            socket.emit('startGame');
        },
        createPrompt()
        {
            socket.emit('createPrompt', this.me.username, this.me.password, this.prompt);
        },
        nextRound()
        {
            socket.emit('nextRound');
        },
        getPrompts()
        {
            socket.emit('getPrompts');
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
        app.gameState.state = 0;
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
        app.gameState.state = false;
    });

    socket.on('error', function (res)
    {
        alert(res);
    });

    socket.on('stateChange', function (res)
    {
        app.gameState = res.state;
        app.players = res.players;
        app.me = res.me;
        app.audience = res.audience;
        app.error = res.error;
        app.prompt = res.prompt;
    });

    socket.on('promptCreated', () =>
    {
        app.clicked = true;
        app.prompt = '';
    });

    socket.on('promptToAnswer', function (res)
    {
        if (app.prompt1 == '')
        {
            app.prompt1 = res;
        }
        else
        {
            app.prompt2 = res;
        }

        console.log(app.prompt1);
        console.log(app.prompt2);
    })

}
