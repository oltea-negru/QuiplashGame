
var socket = null;

//Prepare game
var app = new Vue({
    el: '#game',
    data: {
        error: '',
        me: { username: 'test10', score: 0, state: 0, password: 'test10test', voteIndex: 0, stats: [], openStats: false },
        gameState: {
            state: false,
            round: 0,
            currentPrompts: [],
            currentAnswers: [],
            currentPlayerPairs: [],
            whoAnswered: [],
            voteCount: [],
            roundScores: [],
            globalScores: [],
            scores: []
        },
        players: [],
        audience: [],
        prompt1: '',
        prompt2: '',
        clicked: false,
        countDown: 10,
        secondClicked: false,
        audio: false,
        prompt: '',
        answer: '',
        answer1: '',
        answer2: '',
    },
    mounted: function ()
    {
        connect();
        var myTrack = new window.Audio('@/public/audio.mp3');
        myTrack.play();
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
            this.countDownTimer();
            socket.emit('startGame');

        },
        createPrompt()
        {
            socket.emit('createPrompt', this.me.username, this.me.password, this.prompt);
            this.prompt = '';
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
            this.answer2 = '';
        },
        voteFor()
        {
            if (this.clicked == true)
                this.secondClicked = true;
            this.clicked = true;
            socket.emit('voteFor', this.gameState.currentPrompts[this.me.voteIndex], this.answer);
        },
        toggleStats()
        {
            this.me.openStats = !this.me.openStats;
        },
        async play() 
        {
            this.audio = true;
        },
        vote()
        {
            socket.emit('vote');

        },
        increaseVotingIndex()
        {
            socket.emit('increaseVotingIndex');
        },
        seeScores()
        {
            socket.emit('seeScores');
        },
        selectAnswer(answer)
        {
            this.answer = answer;
        },
        getLeaderboard()
        {
            socket.emit('getLeaderboard');
        },
        countDownTimer()
        {
            if (this.countDown > 0)
            {
                setTimeout(() =>
                {
                    this.countDown -= 1
                    this.countDownTimer()
                }, 1000)
            }
        }

    },
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
        app.prompt1 = '';
        app.prompt2 = '';
        app.prompt = '';
        app.answer = '';
        app.answer1 = '';
        app.answer2 = '';
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

    socket.on("changeClick", () =>
    {
        app.clicked = false;
    })

    socket.on("resetMeState", () =>
    {
        app.prompt1 = '';
        app.prompt2 = '';
        app.prompt = '';
        app.answer = '';
        app.answer1 = '';
        app.answer2 = '';
    });

    socket.on("stats", function (res)
    {
        app.me.stats = res.prompts;
        console.log(res);
    });

}
