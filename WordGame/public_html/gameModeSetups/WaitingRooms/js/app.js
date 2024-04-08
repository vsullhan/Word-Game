/**
 * Purpose: This file contains the client code for the Multiplayer Waiting Room
 * html page and the Multiplayer1.html page.
 */


// Constants for DOM elements we'll updated throughout
let subWordBtn = document.getElementById('submitWord');
let timer = document.getElementById("timerDisplay");
let substr = document.getElementById("substr");
let notif = document.getElementById("notif");
let leaderBoard = document.getElementById("gameLeaderboard");
let points = document.getElementById("pointsDisplay");
let exit = document.getElementById("exitButton");
let oppScore = document.getElementById("otherscore");
let roundsPlayed = 0;
let currScore = 0;
let diff = "Easy";



const style = "/../../../games/css/style.css"; 
var mainSocket = io('multiplayer');



/**
 * This onload function handles connecting to the server with socket.io
 * to get the multiplayer game set up. If the client is the only one in the room,
 * they will basically be waiting for the next user to join so the game can begin.
 */
window.onload = () => {
    const socket = io("/multiplayer");
    mainSocket = socket; // so we can use later to talk to the server socket.
    let e = fetch('/multiplayer');
    e.then(() => {
        console.log("error?")
    });

    // Inform client they joined an mp room
    socket.on('customEvent', (data) => {
        console.log('Received data:', data);
    });

    /**
     * This emitter handles setting up the page with new html contents and
     * resets the global vars so they work as expected.
     */
    socket.on('gameStart', (contents, cookie) => {
        document.getElementsByTagName("html")[0].innerHTML = contents;
        document.getElementById("cssFile").href = style;
        subWordBtn = document.getElementById('submitWord');
        timer = document.getElementById("timerDisplay");
        substr = document.getElementById("substr");
        notif = document.getElementById("notif");
        leaderBoard = document.getElementById("gameLeaderboard");
        points = document.getElementById("pointsDisplay");
        exit = document.getElementById("exitButton");
        oppScore = document.getElementById("otherscore");
    });

    /**
     * Emitter to receive another phrase to display
     */
    socket.on('getSubStr', (phrase) => {
        newRound(phrase);
        mainSocket.emit("getOppScore");
    });

    /**
     * Emitter to receive opponents current score.
     */
    socket.on("oppScore", (score) => {
        if (score) {
            oppScore.innerText = 'Opponent Score: ' + score; 
        } else {
            oppScore.innerText = 'Opponent Score: 0';
        }
        
    });

    /**
     * Emitter to receive timer value from server.
     */
    socket.on('timerVal', (number) => {
        console.log("timerval", number)
        timer.innerText = number;
    });

    /**
     * Emitter to update DOM elements if the client guess satisfied
     * the phrase.
     */
    socket.on('correctGuess', (score) => {
        console.log(score);
        points = document.getElementById("pointsDisplay");
        notif.innerText = "Correct! Please wait for the next word.";
        document.getElementById("wordInput").value = '';
        points.innerText = score;
    });

    // let user know their guess was bad.
    socket.on("badGuess", () => {
        notif.innerText = "Incorrect! Try again.";
    });

    // inform client who won the game as an alert.
    socket.on("endingMsg", (msg) => {
        alert(msg);
        exit.disabled = false;
        // window.location.href = '/homePage.html';
    });
};

// when exit game is clicked, go back to login screen. we have to do this sadly.
function redirectHome() {
    window.location.href = '/index.html';
}

/**
* Takes the input from the user, sends it to the server to check if the word is in our database.
* If it is, give the user points, reset timer, start next round. If not, change display to say
* try again. Clears the input text box
*/

function guessWord() {
    let input = document.getElementById("wordInput");
    let currentTime = new Date().getTime();
    console.log(input.value);
    console.log(mainSocket);
    mainSocket.emit("checkWord", input.value);
}

// This allows the user to just hit the enter button on their keyboard when the want to submit
// a word instead of having to manually click the submit button
document.addEventListener('keypress', (event)=>{
    // event.keyCode or event.which  property will have the code of the pressed key
    let keyCode = event.keyCode ? event.keyCode : event.which;

    // 13 points the enter key
    if(keyCode === 13) {
        // call click function of the buttonn 
        subWordBtn.click();
    }
});




/**
* Starts a new round or ends the game if this was single player.
* It can end the game as a backup in case server bugs out.
*/
function newRound(wrd){
    // check if num of rounds played > some number
    if (roundsPlayed > 9){
        // end game
        // Send stats from current game to server so sever can check records
        let info = {totalPoints: points.innerText.split(" ")[1]};
        let p = fetch("/gameOver", {
            method: 'POST',
            body: JSON.stringify(info),
            headers: { 'Content-Type': 'application/json'}
        });
        // not sure if this needs to expect something from server, going to write as if it doesn't for now
        p.then((response) => {
            return response.text();
        }).then((text) => {
            // send the user to game over .html page, from which they can navigate back to the home page
            window.location.href = "./../gameOver.html";
        }).catch((err) =>{
            console.log("Game end went wrong");
            console.log(err);
        });
    }
    else{
        //updateGameLb();
        countDownDate = new Date().getTime();
        substr.innerText = "Substring: " + wrd;
        roundsPlayed += 1;
    }  
}