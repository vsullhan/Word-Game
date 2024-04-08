/**
 * Purpose: This file contains the client code for the Leaderboards html page.
 * hot potato.
 */



// Constants for DOM elements we'll updated throughout
let wLB = document.getElementById("winsLeaderboard");
let pLB = document.getElementById("pointsLeaderboard");
let rLB = document.getElementById("roundsLeaderboard");

function loadLeaderboards(){
    // get the top n players with the highest wins
    let p1 = fetch("/getMostWins");
    p1.then((response) => {
        return response.text();
    }).then ((text) => {
        return JSON.parse(text);
    }).then((JsonObj) => {
        // expecting text to be an object with usernames mapped to their respective stat
        let winsLB = "";
        console.log(JsonObj);
        let usernames = Object.keys(JsonObj);
        // usernames is a list of the usernames in text, with text[uname] being the stat
        for(let a = 0; a < usernames.length; a++){
            uname = usernames[a];
            winsLB += uname + ": " + JsonObj[uname] + "\n";
        }
        wLB.innerText = winsLB;
    }).catch((err) => {
        console.log("Getting wins LB failed");
        console.log(err);
    });

    // get the top n players with the most points
    let p2 = fetch("/getMostPoints");
    p2.then((response) => {
        return response.text();
    }).then ((text) => {
        return JSON.parse(text);
    }).then((JsonObj) => {
        // expecting text to be an object with usernames mapped to their respective stat
        let pointsLB = "";
        console.log(JsonObj);
        let usernames = Object.keys(JsonObj);
        // usernames is a list of the usernames in text, with text[uname] being the stat
        for(let b = 0; b < usernames.length; b++){
            uname = usernames[b];
            pointsLB += uname + ": " + JsonObj[uname] + "\n";
        }
        pLB.innerText = pointsLB;
    }).catch((err) => {
        console.log("Getting points LB failed");
        console.log(err);
    });
    
    // get the top n players with the most rounds played
    let p3 = fetch("/getMostRounds");
    p3.then((response) => {
        return response.text();
    }).then ((text) => {
        return JSON.parse(text);
    }).then((JsonObj) => {
        // expecting text to be an object with usernames mapped to their respective stat
        let roundsLB = "";
        console.log(JsonObj);
        let usernames = Object.keys(JsonObj);
        // usernames is a list of the usernames in text, with text[uname] being the stat
        for(let c = 0; c < usernames.length; c++){
            uname = usernames[c];
            roundsLB += uname + ": " + JsonObj[uname] + "\n";
        }
        rLB.innerText = roundsLB;
    }).catch((err) => {
        console.log("Getting rounds LB failed");
        console.log(err);
    });
}


function redirToHome(){
    window.location.href = "../homePage.html";
}

window.onload = loadLeaderboards;
