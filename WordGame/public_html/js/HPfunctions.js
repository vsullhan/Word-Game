/**
 * Purpose: This file contains the client side code for the homepage html page.
 */



function redirToSetup(type){
    if(type == 'SP1'){
        window.location.href = './../gameModeSetups/SPMode1Setup.html';
    }
    else if(type == 'SP2'){
        window.location.href = './../gameModeSetups/SPMode2Setup.html';
    }
    else if(type == 'MP1'){
        window.location.href = './../gameModeSetups/MPMode1Setup.html';
    }
    else{ // is helpPage
        window.location.href = './../helpPage.html';
    }
}



function redirToLBPage(){
    window.location.href = '/leaderboardPage.html';
}

/**
 * Hit the server to get the users stats to display on the homepage.
 */
function fillRecords() {
    let SPR1 = document.getElementById("SPRecord1");
    let SPR2 = document.getElementById("SPRecord2");
    let MPR1 = document.getElementById("MPRecord1");
    let MPR2 = document.getElementById("MPRecord2");
    
    let p = fetch('/get/records', {
        method: 'GET',
        credentials: 'include',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
    });
    let e = p.then((response) => {
        return response.json(); //Expecting an object with the records
    });
    e.then((JsonObj) => {
        SPR1.innerText = SPR1.innerText + JsonObj.highscore;
        SPR2.innerText = SPR2.innerText + JsonObj.roundsPlayed;
        MPR1.innerText = MPR1.innerText + JsonObj.wins;
        MPR2.innerText = MPR2.innerText + JsonObj.losses;
    });
    p.catch((error) => {
        console.log("something happened " + error);
    });
}
window.onload = fillRecords;

