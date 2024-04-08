/**
 * Purpose: This file contains the client code for the Multiplayer Waiting Room
 * html page and the Multiplayer1.html page. This file's main purpose is if we wanted
 * to pivot to a different approach for multiplayer in the future.
 */

let subWordBtn = document.getElementById('submitWord');
let timer = document.getElementById("timerDisplay");
let substr = document.getElementById("substr");
let notif = document.getElementById("notif");
let leaderBoard = document.getElementById("gameLeaderboard");
let roundsPlayed = 0;
let currScore = 0;
let diff = "";

// Get initial value for substr
function startGame(){
    console.log("start game of mpfunctions js file");
    let p1 = fetch("/get/Difficulty");
    p1.then((response) => {
        return response.text();
    }).then((text) => {
        diff = text;
    }).catch((err) => {
        console.log("Game start went wrong");
        console.log(err);
    });
    
    let p2 = fetch("/getNewSubstr");
    p2.then((response) => {
        return response.text();
    }).then((text) => {
        newRound(text);
    }).catch((err) => {
        console.log("Game start went wrong");
        console.log(err);
    });

    updateGameLB(); // When game starts, should just have all of the users with zero points
}

function updateGameLB(){
    /** Should req information of current game state from server, updates display with information recieved*/
    let p = fetch("/getGameState");
    p.then((response) => {
        return response.text(); 
    }).then((text) => {
        // text should be an object containing users in the game and their current point total 
        // update gameLeaderboard
    });
}

/**
* Timer
*/
var countDownDate = new Date().getTime();
// checks to see if time is up every 1/2 second
var myfunc = setInterval(function() {
    var now = new Date().getTime();
    var timePast = now - countDownDate;
    var t = 0;

    if(diff == "Easy"){
        t = 10000;
    }
    else if(diff == "Medium"){
        t = 7500;
    }
    else{
        t = 5000;
    }
    
    if (timePast > t){
        // end round
        let info = {points: currScore};
        let p1 = fetch("/sendCurrScore", {
            method: 'POST',
            body: JSON.stringify(info),
            headers: { 'Content-Type': 'application/json'}
        });
        p1.then((response) => {
            //Doesn't really need to return anything, is only for sending info to server
            return response.text();
        }).then((text) => {
            // p2 is embedded in p1 to ensure that the players' current scores are up to date
            // expects a string that is the new substring
            let p2 = fetch("/getNewSubstr");
            p2.then((response) => {
                return response.text();
            }).then((text) => {
                newRound(text);
            }).catch((err) => {
                console.log("Something with timer went wrong");
                console.log(err);
            });
        }).catch((err) => {
            console.log("sending score didn't work");
            console.log(err);
        });
    }
    // because of the way it checks every half second and Math.floor, the first sec will be 9
    // and the last one will be -1, so I added 1 to make it display 10-0 instead (tested in Easy
    // difficulty, should work the same for others)
    let secLeft = Math.floor(((10000-timePast)/1000)) +1;
    timer.innerText = "" + secLeft;
}, 500);

/**
* Takes the input from the user, sends it to the server to check if the word is in our database.
* If it is, give the user points, reset timer, start next round. If not, change display to say
* try again. Clears the input text box
*/
subWordBtn.addEventListener('click', (ev)=>{
    let input = document.getElementById("wordInput");
    let info = {word: input.value};
    let currentTime = new Date().getTime();

    /**
    * Sends input to server, expecting a string that is 'WRONG' if the word is not in database,
    * or a string that is the new substring if it is
    */
    let p = fetch("/checkWord", {
        method: 'POST',
        body: JSON.stringify(info),
        headers: { 'Content-Type': 'application/json'}
    });
    p.then((response) => {
        return response.text();
    }).then((text) => {
        if (text == 'WRONG'){
            notif.innerText = "Not a word, try again";
        }
        else{
            notif.innerText = "Correct! Guess next word";
            // calculate points and add to pointsDisp
            let awardPoints = 10000 - (currentTime - countDownDate);
            currScore += awardPoints;
            //points.innerText = "Points: " + totalPoints;
            //newRound(text); Do not call yet, let timer run out then call to keep game the same for all users
        }
    }).catch((err) => {
        console.log("Something went wrong");
        console.log(err);  
    });
});

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
* Starts a new round
*/
function newRound(wrd){
    // check if num of rounds played > some number
    if (roundsPlayed > 10){
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
        updateGameLb();
        countDownDate = new Date().getTime();
        substr.innerText = "Substring: " + wrd;
        roundsPlayed += 1;
        //console.log(roundsPlayed);
    }  
}
window.onload = startGame;

/**
 * Any socket.io code will be below this comment.
 */
// const socket = io();

