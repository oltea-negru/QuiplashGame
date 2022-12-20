var socket = null;

//Prepare game
var app = new Vue({
    el: '#game',
    data: {
        error: '',
        me: { username: 'test10', score: 0, state: 0, password: 'test10test', voteIndex: 0 },
        gameState: { state: false, round: 0, currentPrompts: [], currentAnswers: [], currentPlayerPairs: [] },
        players: [],
        audience: [],
        prompt1: '',
        prompt2: '',
        clicked: false,
        prompt: '',
        answer1: '',
        answer2: '',
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
        },
        submitAnswer()
        {
            socket.emit('submitAnswer', this.me.username, this.answer1, this.prompt1);
            this.prompt1 = this.prompt2;
            this.answer1 = this.answer2;
            this.prompt2 = '';
        },
        vote()
        {
            socket.emit('vote');
        },
        voteFor(answer)
        {
            socket.emit('voteFor', this.gameState.currentPrompts[this.me.voteIndex], answer);
        },
        seeScores()
        {
            socket.emit('seeScores');
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
        app.clicked = false;
    });

}
