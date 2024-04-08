/**
 * Purpose: This file contains the server side code for the Final Group Project.
 */

/**
 * Various constants for libraries used, data structures, etc.
 * There will be more comments when some complex code appears.
 * This code below is just setup stuff for the server mainly.
 */
var cookiert = require("cookie");
const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const path = require('path');
const http = require('http');
const cookie = require('cookie-parser');
const fs = require('fs');
const readLine = require('readline');
const app = express();
const { Server } = require("socket.io");
app.use(cookie());
app.use(express.static(path.join(__dirname, '/../public_html')));
app.use(express.json());
const port = 3000; // This will be 80.
const db = mongoose.connection;
const mongoDBURL = "mongodb://127.0.0.1:27017/";
const allWords = []; // all words we have from our dictionary file.
const gamePage = path.join(__dirname, '/../public_html/games/multiPlayer1.html'); // for mp page to be spa
mongoose.connect(mongoDBURL, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});
db.on('error', console.error.bind(console, 'MongoDB connection error'));


/**
 * Our schemas for MongoDB are below. 
 */

var Schema = mongoose.Schema;

// A User Object
var UserSchema = new Schema({
    username: String,
    hash: String,
    salt: String,
    highscore: Number,
    wins: Number,
    losses: Number,
    roundsPlayed: Number,
    sessions: [Object]
});
var User = mongoose.model('User', UserSchema);

// A single player game session object
var SessionSchema = new Schema({
    user: Object,
    score: Number,
    currentPhrase: String,
    aiDifficulty: String,
    guessedWords: [String],
    mode: String,
    id: Number,
    rounds: Number
});
var Session = mongoose.model('Session', SessionSchema);

// A multiplayer session object
var MultiplayerSchema = new Schema({
    scores: [Number], // each index is a user score in order of users list below
    users: [String], // usernames
    id: Number,
    currentPhrase: String
    // add diff later once the whole thing is working.
});

var MulitplayerSession = mongoose.model('MultiplayerSession', MultiplayerSchema);



/**
 * Initial setting up of server. We have to do it in this manner to leverage
 * socket.io for multiplayer but express is still being used for the main
 * server backend.
 */
const server = app.listen(port, async () => {
    console.log(`Server is running on port ${port}`);
    loadWords();
    let e = MulitplayerSession.deleteMany({}).exec(); // we only want 1 mp session at a time.
    e.then(() => {
        console.log("deleted mp sessions");
    });
});

const io = new Server(server);

/**
 * This is where majority of socket.io code is located.
 */


/**
 * Various constants to assist with keeping track of a multiplayer game state.
 */
var mpPlayers = 0;
var mpGameID = 0;
var playerArr = [];
var mpGame = false;
var cookieUser = [];
var mpRoundsPlayed = 0;
var socketsOfPlayers = [];

// Init socket.io object. 
const socketIO = io.of('/multiplayer');


/**
 * This huge route is essentially the driver for multiplayer to work in our project.
 * The workflow is basically this:
 * 1. A client navigates to the multiplayer page
 * 2. They click Create/Join game
 * 3. This route gets triggered on the page they get loaded to and they're joined to a session
 * 4. Once 2 players have joined, the game begins.
 * More comments will follow below for more specific implementation bits.
 * The biggest take away is that the MP side of things is acting as an SPA (Single Page App) to 
 * be able to get multiplayer working.
 */
app.get('/multiplayer', (req, res) => {
    const socketIO = io.of('/multiplayer');
    const gamePage = path.join(__dirname, '/../public_html/games/multiPlayer1.html'); // will be sent to clients when game begins.

    /**
     * This handler gets triggered when a client navigates to the multiplayer waiting room page. 
     * 1. Client is connected to the socketIO room for the game
     * 2. When 2 people have joined, game begins.
     */
    socketIO.on('connection', (socket) => {
        var cookies = cookiert.parse(socket.handshake.headers.cookie);
        let username = cookies.login.split(":")[2].split(",")[0].slice(1, cookies.login.split(":")[2].split(",")[0].length - 1);
        /**
         * Needed to keep track of current players due to cookie issues. 
         */
        if (cookieUser.length !== 2) {
            cookieUser.push(username);
            socketsOfPlayers.push(socket.id);
        }
        if (mpPlayers >= 2) { // only supporting 2 users currently as it gets buggier the more we add.
            return;
        }
        console.log("user connected");
        socket.join("all_users"); // join client to this room so the socket can talk to everyone at once later.
        /** for testing */
        socketIO.to("all_users").emit('customEvent', "joined a room"); // send the clients a msg that they've joined the room
        mpPlayers += 1
        /**
         * This if statement essentially begins the game once the server verifies 2 players have connected.
         * We init a multiplayer session and inform the clients what the phrase is and the game begins.
         */
        if (mpPlayers == 2) {
            let mpSession = new MulitplayerSession({
                users: cookieUser,
                id: req.cookies.login.gameID,
                scores: [0, 0],
                currentPhrase: "" // only 2 players for now but could change
            });
            let sesh = mpSession.save();
            sesh.then(async () => {
                /**
                 * This is to be able to send the clients the html page contents to render when the game begins.
                 */
                const content = await fs.readFile(gamePage, 'utf8', (err, data) => {
                    if (err) throw err;
                    let tmp = data.split("\n");
                    tmp.reverse().pop();
                    tmp = tmp.reverse();
                    /**
                     * Emit an event to all clients to go load the html contents from above. 
                     */
                    socketIO.to("all_users").emit('gameStart', tmp.join("\n")); // clients go update yourselves
                    mpGame = true;
                    // get a phrase.
                    const substr = nextRound();
                    socketIO.to("all_users").emit('getSubStr', substr); // send phrase to all clients
                });
            });
        }
        /**
         * If any user disconnects, we delete any sessions active and leave them from the all_users room.
         */
        socket.on('disconnect', () => {
            console.log("user disconnected");
            socket.leave("all_users");
            mpPlayers -= 1;
            let e = MulitplayerSession.deleteMany({}).exec();
            e.then(() => {
                console.log("deleted mp sessions");
            });
        });

        /**
         * Socket listener to give client the score of their opponent.
         * This code has a race condition that we've been unable to fix but left this in anyways.
         * We think it's better to have this then not have it.
         */
        socket.on("getOppScore", () => {
            let val = 0;
            var cookies = cookiert.parse(socket.handshake.headers.cookie);
            let username = cookies.login.split(":")[2].split(",")[0].slice(1, cookies.login.split(":")[2].split(",")[0].length - 1);
            let index = cookieUser.indexOf(username);
            cookieUser.forEach((user) => {
                if (user !== username) {
                    let session = MulitplayerSession.findOne({}).exec();
                    session.then((sesh) => {
                        /**
                         * This code below is meant to show the client the opponent score,
                         * but this a race condition. Sometimes it shows it correctly, other
                         * times it doesn't but leaving in regardless.
                         */
                        socketIO.to(socket.id).emit("oppScore", sesh.scores[val]);

                    });
                } else {
                    val += 1;
                }
            })
        });

        /**
         * This listener handles taking a guess input from a client and validating if it contains the phrase
         * the clients must include in their guess. 
         */
        socket.on('checkWord', (guess) => {
            var cookies = cookiert.parse(socket.handshake.headers.cookie);
            let username = cookies.login.split(":")[2].split(",")[0].slice(1, cookies.login.split(":")[2].split(",")[0].length - 1);
            // We have to do the above because otherwise, the cookie we get is only for one user.

            let s = MulitplayerSession.findOne({}).exec(); // Only planning on 1 session at a time.
            s.then((sesh) => {
                if (guess.includes(sesh.currentPhrase) && allWords.includes(guess)) {
                    // calculate points and update score in mp session object in MongoDB.
                    let user = sesh.users.findIndex((elem) => elem === username);
                    let currentTime = new Date().getTime();
                    let awardPoints = 10000 - (currentTime - countDownDate);
                    let currPoints = sesh.scores[user];
                    let totalPoints = awardPoints + currPoints;
                    sesh.scores[user] = totalPoints; // update session score for this user.
                    let e = sesh.save();
                    e.then(() => {
                        console.log("session saved");
                    });
                    socketIO.to(socket.id).emit("correctGuess", totalPoints); // inform the client their guess was good
                } else {
                    socketIO.to(socket.id).emit("badGuess"); // inform them their guess was bad.
                }
            });
            s.catch((error) => {
                console.log("couldnt get mp sesh", error);
            });
        })
    });
});

/**
 * This function handles cleaning up the multiplayer variables, sessions and other
 * code that was used during the game. This function also updates every User's highscores
 * and wins/losses where appropriate.
 */
function cleanUpMPGame() {
    let highest = 0; // highest score
    let winner = ""; // user who won the game.
    let s = MulitplayerSession.findOne({}).exec(); // Only planning on 1 session at a time.
    let sesher = [];
    s.then((sesh) => {
        sesher = sesh.scores;
        for (var i = 0; i < sesh.scores.length; i++) {
            if (highest < sesh.scores[i]) {
                highest = sesh.scores[i];
                winner = sesh.users[i];
            }
        }
        let e = User.findOne({ username: winner }).exec();
        e.then((user) => {
            if (!user) {
                return;
            }
            user.wins = user.wins + 1;
            if (user.highscore < highest) {
                user.highscore = highest;
            }
            let t = user.save();
            t.then(() => {
                const winningStr = `${winner} has won the game with a score of ${highest}!`;
                // updating rest of players in the game with losses and if they got a new highscore.
                for (var i = 0; i < cookieUser.length; i++) {
                    let r = User.findOne({ username: cookieUser[i] }).exec();
                    r.then((player) => {
                        if (player.highscore < sesher[i]) {
                            player.highscore = sesher[i];
                        }
                        if (player.username !== winner) {
                            player.losses = player.losses + 1;
                        }
                        let v = player.save();
                        v.then((t) => {
                            console.log("updated rest of players");
                        });
                    });
                    r.catch((error) => {
                        console.log("couldn't update a user");
                    })
                }
                mpPlayers = 0;
                mpGameID = 0;
                playerArr = [];
                mpGame = false;
                cookieUser = [];
                mpRoundsPlayed = 0;
                socketIO.to("all_users").emit("endingMsg", winningStr); // inform all users of who won and what their score was.
            })
        });
        e.catch((error) => {
            console.log("SOME ERROR IN CLEAN UP GAME", error);
        });
    });
}


/**
 * This function handles getting the next phrase for the next round of the game.
 * 
 * @returns New phrase to be sent to all of the clients
 */
function nextRound() {
    if (mpRoundsPlayed > 9) { // 10 rounds in the multiplayer game and then ends.
        cleanUpMPGame();
        return "END";
    }

    /**
     * Loop to get a valid phrase and then return it.
     */
    while (true) {
        let randomNum = Math.floor(Math.random() * allWords.length);
        let currentWord = allWords[randomNum];
        if (currentWord.length < 4 || currentWord === null) {
            continue; // choose another one
        }
        const start = Math.floor(Math.random() * (currentWord.length - 2 + 1));
        const substr = currentWord.slice(start, start + 2);
        let s = MulitplayerSession.findOne({}).exec(); // Only planning on 1 session at a time.
        s.then((sesh) => {
            sesh.currentPhrase = substr;

            let e = sesh.save();
        });
        s.catch((error) => {
            console.log("couldnt get mp sesh");
        });
        return substr;
    }
}


/**
 * Function that runs every 1/2 second to send updated timer to clients in a MP session
 * When no mp session happening, it becomes a NOOP.
 */
var countDownDate = new Date().getTime();
// checks to see if time is up every 1/2 second
setInterval(function () {
    if (!mpGame) {
        countDownDate = new Date().getTime();
        return;
    }
    var now = new Date().getTime();
    var timePast = now - countDownDate;
    var t = 10000;
    if (timePast > t) {
        // begin next round
        mpRoundsPlayed += 1;
        const substr = nextRound();
        if (substr === "END") {
            return;
        }
        console.log("new substr", substr);

        socketIO.to("all_users").emit('getSubStr', substr);
        countDownDate = new Date().getTime();
    }
    // because of the way it checks every half second and Math.floor, the first sec will be 9
    // and the last one will be -1, so I added 1 to make it display 10-0 instead
    let secLeft = Math.floor(((10000 - timePast) / 1000)) + 1;
    socketIO.to("all_users").emit("timerVal", secLeft);
}, 1000);

/**
 * End of Socketio multiplayer code.
*/



/**
 * This route handles creating an account based on the username and password given in the request.
 * This route uses salting and hashing.
 */
app.post('/account/create/', (req, res) => {
    let user = User.find({ username: req.body.user }).exec();
    user.then((results) => {
        if (results.length == 0) {
            let salt = crypto.randomBytes(16).toString('hex');
            let hashed = crypto.pbkdf2Sync(req.body.pass, salt, 1000, 64, 'sha256').toString('hex');
            let newUser = new User({
                username: req.body.user,
                hash: hashed,
                salt: salt,
                highscore: 0,
                wins: 0,
                losses: 0,
                roundsPlayed: 0,
                sessions: []
            });
            let p = newUser.save();
            p.then(() => {
                res.end('USER CREATED');
            });
            p.catch(() => {
                res.end('DATABASE SAVE ISSUE');
            });
        } else {
            res.end('USERNAME ALREADY TAKEN');
        }
    });
    user.catch((error) => {
        console.log("error: ", error);
        res.status(401).send("Error creating user account");
    });
});


/**
 * This route logs a user in if the provided username and password match a user in our database.
 * This route also sets up the cookie for the user.
 */
app.post('/account/login', (req, res) => {
    let user = User.find({ username: req.body.user }).exec();
    user.then((results) => {
        if (results.length == 0) {
            return res.status(401).send("Invalid User Credentials");
        }
        let u = results[0];
        const hashed = crypto.pbkdf2Sync(req.body.pass, u.salt, 1000, 64, 'sha256').toString('hex');
        if (hashed === u.hash) {
            // cookie stuff here 
            let sid = Math.floor(Math.random() * 1000000000);
            // removed session call because don't need to make one here.
            res.cookie("login",
                { username: req.body.user, sessionID: sid, gameID: 0, mpmode: "" },
                { maxAge: 60 * 60 * 1000 });
            res.status(200).send('Login successful');
        } else {
            res.status(401).send("Invalid Credentials")
        }
    })
    user.catch((error) => {
        console.log(error);
        res.send('Invalid Credentials');
    })
});



/**
 * Route to get all users and their highscores for leaderboard purposes.
 */
app.get('/users/scores', (req, res) => {
    let users = User.find({}).exec();
    let scoresArr = [];
    users.then((results) => {
        if (results.length === 0) {
            res.send([]);
            return;
        }
        results.forEach((result) => {
            let obj = { user: result.username, score: result.highscore };
            scoresArr.push(obj);
        });
        scoresArr.sort((a, b) => a.highscore - b.highscore);
        res.send(scoresArr);
    })
    users.catch((error) => {
        console.log('Error with getting scores')
        res.send("ERROR " + error);
        return 1;
    });
});


/**
 * This route returns all of the stats for the current logged in user to be displayed on the home page.
 */
app.get('/get/records', (req, res) => {
    let username = req.cookies.login.username;
    let user = User.findOne({ username: username }).exec();
    user.then((result) => {
        res.json({ highscore: result.highscore, wins: result.wins, losses: result.losses, roundsPlayed: result.roundsPlayed });
        // res.send(result); // sending whole obj but might change.
    });
    user.catch((error) => {
        res.status(401).send("Something happened getting user info");
    });
});

/**
 * This route creates a single player game session.
 */
app.post('/createGame', (req, res) => {
    let difficulty = req.body.diff;
    let mode = req.body.mode;
    let username = req.cookies.login.username;
    let sid = Math.floor(Math.random() * 1000000000);
    let user = User.find({ username: username }).exec();
    user.then((result) => {
        console.log(result);
        let actualUser = result[0];
        let session = new Session({
            user: actualUser,
            score: 0,
            currentPhrase: '',
            aiDifficulty: difficulty,
            guessedWords: [],
            mode: mode,
            id: sid,
            rounds: 0
        });
        // This code should be deleted but we're leaving just in case. But this shouldn't ever get run.
        if (req.body.mode == "MPM1" && mpPlayers > 0) {
            res.cookie("login",
                { username: req.cookies.login.username, sessionID: req.cookies.login.sessionID, gameID: mpGameID, mpmode: difficulty },
                { maxAge: 60 * 60 * 1000 });
            console.log("Joined MP Game");
            res.send("Joined MP Game");
        }
        let saved = session.save();
        saved.then(() => {
            // updating the cookie to hold session id so we can look up later.
            res.cookie("login",
                { username: req.cookies.login.username, sessionID: req.cookies.login.sessionID, gameID: sid, mpmode: difficulty },
                { maxAge: 60 * 60 * 1000 });
            console.log("session created");
            res.send("Game Session Created");
        })
    });
    user.catch((error) => {
        console.log(error);
        res.send("ERROR: ", error);
    })
});

/**
* Returns the difficulty of the current single player session
*/
app.get('/get/Difficulty', (req, res) => {
    let session = Session.findOne({ id: req.cookies.login.gameID }).exec();
    session.then((result) => {
        let difficulty = result.aiDifficulty;
        res.send(difficulty);
    });
    session.catch((error) => {
        console.log(error);
        res.send("ERROR");
    });
});

/**
 * Route to give the client a new phrase for the next round of the game.
 * This will only grab words that are >= 4 in length.
 */
app.get('/getNewSubstr', (req, res) => {
    while (true) {
        /**
         * Add code here to get the current game session from cookie.
         */
        let randomNum = Math.floor(Math.random() * allWords.length);
        let currentWord = allWords[randomNum];
        if (currentWord.length < 4) {
            continue; // choose another one
        }
        let session = Session.findOne({ id: req.cookies.login.gameID }).exec();
        session.then((result) => {
            let difficulty = result.aiDifficulty;
            if (difficulty === 'Easy') {
                difficulty = 2;
            } else if (difficulty === 'Medium') {
                difficulty = 3;
            } else { // hard difficulty
                difficulty = 4;
            }
            const start = Math.floor(Math.random() * (currentWord.length - difficulty + 1));
            const substr = currentWord.slice(start, start + difficulty);
            result.currentPhrase = substr;
            let t = result.save();
            t.then(() => {
                res.send(substr);
            });
        })
        session.catch((error) => {
            console.log("getNewSubstr broke");
            console.log(error);
            res.send("ERROR");
            return;
        });
        break;

    }
});

/**
 * This function is intended as a helper in some cases to get another phrase if need be during the game mode
 * survival mainly. 
 * 
 * @param {express request object} req 
 * @returns a string which is our next phrase
 */
function getWord(req) {
    let substr = "";
    while (true) {
        let randomNum = Math.floor(Math.random() * allWords.length);
        let currentWord = allWords[randomNum];
        if (currentWord.length < 4) {
            continue; // choose another one
        }
        let session = Session.findOne({ id: req.cookies.login.gameID }).exec();
        session.then((result) => {
            let difficulty = result.aiDifficulty;
            if (difficulty === 'Easy') {
                difficulty = 2;
            } else if (difficulty === 'Medium') {
                difficulty = 3;
            } else { // hard difficulty
                difficulty = 4;
            }
            const start = Math.floor(Math.random() * (currentWord.length - difficulty + 1));
            substr = currentWord.slice(start, start + difficulty);
            result.currentPhrase = substr;
            let t = result.save();
            t.then(() => {
                return substr;
            });
        })
        session.catch((error) => {
            console.log("SOME ERROR");
            return;
        });
        console.log(substr);
        return substr;
    }
}



/**
 * This route will end the current game.
 */
app.post('/gameOver', (req, res) => {
    let session = Session.findOne({ id: req.cookies.login.gameID }).exec();
    session.then((sesh) => {
        /** making it so that the session updates from what the client sends in the body before comparing
         * to user's records, for single player mainly.
         */
        let typeOfGame = req.body.type;
        let gameStat = req.body.gameStat;
        let user = User.findOne({ username: req.cookies.login.username }).exec();
        user.then((result) => {
            if (typeOfGame == "SP1") {
                // know that gameStat is points
                sesh.score = gameStat;
                if (result.highscore < sesh.score) {
                    result.highscore = sesh.score;
                }
            }
            else if (typeOfGame == "SP2") {
                // know that gameStat is rounds played
                sesh.rounds = gameStat;
                if (result.roundsPlayed < sesh.rounds) {
                    result.roundsPlayed = sesh.rounds;
                }
            }
            result.sessions.push(sesh);
            res.cookie("login",
                { username: req.cookies.login.username, sessionID: req.cookies.login.sessionID, gameID: 0, mpmode: req.cookies.login.mpmode },
                { maxAge: 60 * 60 * 1000 }); //resetting gameID to 0 so we know no current game.
            let e = result.save();
            e.then(() => {
                res.send("Game Over"); // not strictly necessary.
            });
        });
        user.catch((error) => {
            res.send("Error getting user to update sessions ", error);
            return;
        })
    });
    session.catch((error) => {
        res.send("ERROR ", error);
    });
})


/**
 * Route to check if the word the user has guessed suffices for their prompt.
 */
app.post('/checkWord', (req, res) => {
    let session = Session.findOne({ id: req.cookies.login.gameID }).exec();
    session.then((result) => {
        let guess = req.body.word.toLowerCase(); // user's word
        let currentPhrase = result.currentPhrase; // current substr/phrase
        if (guess.includes(currentPhrase) && !result.guessedWords.includes(guess) && allWords.includes(guess)) {
            result.score += 1;
            result.guessedWords.push(guess);
            /**
             * Send back another phrase instead
             */
            res.send(getWord(req));
        } else if (result.guessedWords.includes(guess)) {
            res.send("You've already guessed this word!");
        } else {
            res.send("WRONG");
        }
    });
    session.catch((error) => {
        res.send("ERROR ", error);
        return;
    });
});

/**
* Gets a list of all users, sorts it from most wins to least, then sends the ten with the highest wins back to client
*/
app.get('/getMostWins', (req, res) => {
    let p = User.find({}).exec();
    p.then((users) => {
        if (users.length === 0) {
            // just in case there are no users in the database: something went wrong
            res.send({ nothing: "nothing" });
        }
        else {
            users.sort((a, b) => { return -(a.wins - b.wins) }); // return - so it sorts from greatest to least
            let winsLB = {};
            // Adds greatest ten or number of total users to winsLB, whichever is less
            for (let i = 0; i < users.length && i < 10; i++) {
                usr = users[i];
                uname = usr.username;
                winsLB[uname] = usr.wins;
            }
            res.send(JSON.stringify(winsLB));
        }
    });
    p.catch((err) => {
        console.log("Get users went wrong");
    });
});

/**
* Gets a list of all users, sorts it from most wins to least, then sends the ten with the highest wins back to client
*/
app.get('/getMostPoints', (req, res) => {
    let p = User.find({}).exec();
    p.then((users) => {
        if (users.length === 0) {
            // just in case there are no users in the database: something went wrong
            res.send({ nothing: "nothing" });
        }
        else {
            users.sort((a, b) => { return -(a.highscore - b.highscore) }); // return - so it sorts from greatest to least
            let pointsLB = {};
            // Adds greatest ten or number of total users to pointsLB, whichever is less
            for (let i = 0; i < users.length && i < 10; i++) {
                usr = users[i];
                uname = usr.username;
                pointsLB[uname] = usr.highscore;
            }
            res.send(JSON.stringify(pointsLB));
        }
    }).catch((err) => {
        console.log("Get users went wrong");
    });
});

/**
* Gets a list of all users, sorts it from most wins to least, then sends the ten with the highest wins back to client
*/
app.get('/getMostRounds', (req, res) => {
    let p = User.find({}).exec();
    p.then((users) => {
        if (users.length === 0) {
            // just in case there are no users in the database: something went wrong
            res.send({ nothing: "nothing" });
        }
        else {
            // return - so it sorts from greatest to least
            users.sort((a, b) => { return -(a.roundsPlayed - b.roundsPlayed) });
            let roundsLB = {};
            // Adds greatest ten or number of total users to roundsLB, whichever is less
            for (let i = 0; i < users.length && i < 10; i++) {
                usr = users[i];
                uname = usr.username;
                roundsLB[uname] = usr.roundsPlayed;
            }
            res.send(JSON.stringify(roundsLB));
        }
    }).catch((err) => {
        console.log("Get users went wrong");
    });
});

/**
 * Simple function to read in all of the words in our "dictionary".
 */
async function loadWords() {
    let fileStream = fs.createReadStream("words.txt");
    let rl = readLine.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });
    for await (const line of rl) {
        let realLine = line.toLowerCase();
        allWords.push(realLine);
    }
}
