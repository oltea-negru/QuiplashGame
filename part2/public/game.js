var socket = null;

//Prepare game
var app = new Vue({
    el: '#game',
    data: {
        error: '',
        me: { username: 'test10', score: 0, state: 0, password: 'test10test', voteIndex: 0 },
        gameState: {
            state: false,
            round: 1,
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
        countDown: 5,
        secondClicked: false,
        prompt: '',
        answer: '',
        answer1: '',
        answer2: '',
    },
    mounted: function ()
    {
        connect();
    },
    components: {

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
        createPrompt()
        {
            socket.emit('createPrompt', this.me.username, this.me.password, this.prompt);
            this.prompt = '';
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
        selectAnswer(answer)
        {
            this.answer = answer;
        },
        nextRound()
        {
            socket.emit('nextRound');
        },
        getPrompts()
        {
            socket.emit('getPrompts');
        },
        startGame()
        {
            socket.emit('startGame');
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
            else if (this.gameState.state == 1)
            {
                this.getPrompts(); this.countDown = 5; this.countDownTimer();
            }
            else if (this.gameState.state == 2)
            {
                this.vote();
                //  this.countDown = 5; this.countDownTimer();
            }
            else if (this.gameState.state == 3 && this.gameState.round < 4)
            {
                this.increaseVotingIndex(); this.countDown = 10; this.countDownTimer();
            }
            else if (this.gameState.state == 3 && this.gameState.round == 4)
            {
                this.seeScores();
                // this.countDown = 5; this.countDownTimer();
            }
            // else if (this.gameState.state == 4)
            // {
            //     this.getLeaderboard(); this.countDown = 5; this.countDownTimer();
            // }
            else
            {
                this.countDown = 5;
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
    })

    socket.on("gameStarted", () =>
    {
        app.countDownTimer();
    })

}
