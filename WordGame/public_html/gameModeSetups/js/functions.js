/* Purpose: This file contains the client side js code for the singleplayer */

function createGame(type, difficulty){
    let reqBody = {diff: difficulty, mode: type};
    let p = fetch("/createGame", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(reqBody),
    });
    p.then((response) => {
        return response.text();
    }).then((text) => {
        console.log(text);
        //switch to game html
        if (type == 'SPM1'){
            window.location.href = "/../../games/singlePlayer1.html";
        }
        else if (type == 'SPM2'){
            window.location.href = "/../../games/singlePlayer2.html";
        }
        else if (type == 'MPM1'){
            window.location.href = "/gameModeSetups/WaitingRooms/MPWaitRoom.html";
        }
        else{
            window.location.href = "/../../games/multiPlayer2.html";
        }
    });
}

/**
* Should send player to already existing game
*/
function joinGame(){
    window.location.href = "/gameModeSetups/WaitingRooms/MPWaitRoom.html";
}
