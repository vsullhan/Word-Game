/**
 * Purpose: This file contains the js code for the index.html page (login page)
 */


/**
 * Function to hit the server to add another account to mongoDB.
 */
function addUser() {
    let username = document.getElementById("usernm2").value;
    let password = document.getElementById("pwd2").value;
    let reqBody = {
        user: username,
        pass: password
    };
    fetch('/account/create', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(reqBody),
    })
        .then(response => response.status)
        .then(data => {
            console.log('POST request status:', data);
        })
}

/**
 * Function to handle logging in the user and changing the page if successful.
 */
function login() {
    let username = document.getElementById("usernm").value;
    let password = document.getElementById("pwd").value;
    let reqBody = {
        user: username,
        pass: password
    };
    let p = fetch('/account/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(reqBody),
    })
    p.then((data) => {
        if (data.ok) {
            console.log("would redirect to the homepage. " + data);
            window.location.href = './homePage.html';
        } else {
            console.log("SOMETHING WENT WRONG");
        }
    })
    p.catch((error) => {
        console.log("something happened " + error);
    })
}


