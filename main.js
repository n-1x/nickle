"use strict"

const MAX_GUESSES = 6;
const WORD_LENGTH = 5;
const LENGTH_OF_KEYBOARD_ANIM = 1 * 1000;
const SHRINK_TIME = 0.3 * 1000;
const API_URL = "https://beautiful-mica-sundial.glitch.me";

//game won't start until these promises resolve
const g_initPromises = [
    fetch("./wordlist.txt").then(res => res.text()),
    fetch("./wordlist_guesses.txt").then(res => res.text())
];

let g_currentGame = null;
let g_wordList = null;  //words that could be chosen as the target
let g_guessList = null; //allowed guesses
let g_MessageElement = null;
const g_keyMap = {}; // maps key text to a dom node
const g_startTime = new Date();

class Game {
    #guessRows;
    #currentRow;
    #charNumber = 0;
    #guessNumber = 0;
    #targetWord;
    #guesses = [];
    #gameOver = false;

    constructor(initialGuesses) {
        this.#guessRows = document.querySelectorAll(".guessRow");
        this.updateCurrentRow();
        this.setTargetWord();

        if (initialGuesses) {
            for (const guess of initialGuesses) {
                for (const char of guess) {
                    this.addChar(char, true);
                }
                this.submitWord();
            }
        }
    }
    
    updateCurrentRow() {
        const nodeList = this.#guessRows[this.#guessNumber].querySelectorAll(".guessChar");
        this.#currentRow = Array.from(nodeList);
        this.#charNumber = 0;
    }

    setTargetWord() {
        const rand = seed => {
            const r = (seed * 346542.12783198276 * Math.sin(seed + 12376293876.18769876));
            return r - Math.floor(r);
        };

        const now = new Date();
        const seed = parseInt(`${now.getFullYear()}${now.getMonth()}${now.getDate()}`);
        const randIndex = Math.floor(rand(seed) * g_wordList.length);
        this.#targetWord = g_wordList[randIndex].toUpperCase();
    }

    addChar(char, skipBounce = false) {
        const upChar = char.toUpperCase();

        if (this.#gameOver) {
            return;
        }

        if (this.#charNumber === WORD_LENGTH) {
            return;
        }

        if (g_keyMap[upChar].classList.contains("notInWord")) {
            return;
        }

        const charElement = this.#currentRow[this.#charNumber];
        charElement.innerText = upChar;

        if (!skipBounce) {
            charElement.classList.add("bounce");
            g_keyMap[upChar].classList.add("bounce");
        }
        ++this.#charNumber;
    }

    delChar() {
        if (this.#charNumber === 0 || this.#gameOver) {
            return;
        }

        --this.#charNumber;

        const charElement = this.#currentRow[this.#charNumber];
        charElement.innerText = "";
        charElement.classList.remove("bounce");
    }

    submitWord() {
        if (this.#gameOver) {
            return;
        }

        const word = this.#currentRow.map(element => element.innerText).join("");
        this.makeGuess(word);
    }

    #updateClassesIf(unusedChars, className, predicate) {
        this.#currentRow.forEach((guessCharElement, i) => {
            const guessChar = guessCharElement.innerText;
            guessCharElement.classList.add("submitted");

            if (predicate(guessChar, i)) {
                guessCharElement.classList.remove("wordContains");
                guessCharElement.classList.add(className);

                const keyElement = g_keyMap[guessChar];
                // remove word contains from key so it can be overriden with correctPosition
                keyElement.classList.remove("wordContains");
                keyElement.classList.add(className);

                // remove char from unused list
                const unusedIndex = unusedChars.indexOf(guessChar);
                if (unusedIndex >= 0) {
                    unusedChars.splice(unusedIndex, 1);
                }
            }
        });
    }
    
    makeGuess(word) {
        const upWord = word.toUpperCase();

        if (upWord.length !== WORD_LENGTH) {
            showMessage("Guess must be five characters")
            return;
        }
        
        if (!g_guessList.includes(upWord)) {
            showMessage("Not in word list");
            return;
        }

        // characters from the target word that haven't been either
        // contained or matched yet.
        const unusedChars = this.#targetWord.split("");

        // These stages are separate so that a letter will not be marked as 
        // wordContains but then used for correctPosition when checking a 
        // character later in the guess
        this.#updateClassesIf(unusedChars, "correctPosition", (char, i) => this.#targetWord.charAt(i) === char);
        this.#updateClassesIf(unusedChars, "wordContains", char => unusedChars.includes(char));
        this.#updateClassesIf(unusedChars, "notInWord", char => !this.#targetWord.includes(char));
        
        this.#guesses.push(upWord);
        window.localStorage.guesses = JSON.stringify(this.#guesses);
        window.localStorage.lastSaveTime = Date.now();

        ++this.#guessNumber;
        if (unusedChars.length === 0) {
            this.#endGame(true);
        }
        else if (this.#guessNumber === MAX_GUESSES) {
            this.#endGame(false);
        }
        else {
            this.updateCurrentRow();
        }
    }

    #endGame(victory) {
        this.#gameOver = true;

        const keyboard = document.getElementById("keyboard");
        keyboard.classList.add("slideBottom");

        setTimeout(() => {
            keyboard.remove();
            createEndGamePlate(victory, this.#guessNumber);
        }, LENGTH_OF_KEYBOARD_ANIM);
    }

    getBoardState() {
        const state = [];

        for (const row of this.#guessRows) {
            const stateRow = [];

            for (const el of row.querySelectorAll(".submitted")) {
                if (el.classList.contains("correctPosition")) {
                    stateRow.push(3);
                }
                else if (el.classList.contains("wordContains")) {
                    stateRow.push(2);
                }
                else {
                    stateRow.push(1);
                }
            }

            state.push(stateRow);
        }

        return state;
    }
}

function isTimeFromToday(aTime) {
    const date = aTime instanceof Date ? aTime : new Date(parseInt(aTime));
    const now = new Date();

    return date.getFullYear() === now.getFullYear()
        && date.getMonth() === now.getMonth()
        && date.getDate() === now.getDate();
}

function submitHighScore(e, numGuesses) {
    e.preventDefault();
    const name = e.target.querySelector("input").value;

    if (name.length < 5) {
        showMessage("Five characters minimum");
    }
    else {
        showMessage("Submitting score");
        e.target.classList.add("shrink");

        fetch(`${API_URL}?game=nickle&daily=true&score=${numGuesses}&name=${name}`, {
            method: "PUT"
        }).then(() => {
            updateScoresTable();
        });
    }

    return false;
}

async function updateScoresTable() {
    const highScores = await (await fetch(`${API_URL}?game=nickle`)).json();
    const template = document.getElementById("scoreEntryTemplate");
    const scoresTable = document.getElementById("scoresTable");
    const tableRows = scoresTable.querySelector("tbody");
    const scoresFromToday = highScores.filter(({submitTime}) => isTimeFromToday(submitTime));
    const title = document.querySelector("#scoreboardContainer .title");
    
    // Flip score order because server returns highest score first
    scoresFromToday.sort((a, b) => {
        if (a.score !== b.score) {
            return a.score < b.score ? -1 : 1;
        }
        else {
            return a.time < b.time ? -1 : 1;
        }
    });
    
    tableRows.replaceChildren([]); //remove existing children
    for (const {name, score, submitTime} of scoresFromToday) {
        const newNode = template.content.cloneNode(true);
        const nameEl = newNode.querySelector(".name");
        const numGuessesEl = newNode.querySelector(".numGuesses");
        const timeEl = newNode.querySelector(".time");

        nameEl.innerText = name;
        numGuessesEl.innerText = score;
        timeEl.innerText = (new Date(parseInt(submitTime))).toLocaleTimeString();
        tableRows.appendChild(newNode);
    }

    if (scoresFromToday.length > 0) {
        title.innerText = "Today's Scores";
        scoresTable.classList.remove("shrink");
    }
    else {
        title.innerText = "No scores submitted yet.";
    }
}

function createScoreboard(parent) {
    const template = document.getElementById("scoreboardTemplate");
    const node = template.content.cloneNode(true);

    const closeButton = node.querySelector("#closeHighScoresButton");
    closeButton.onclick = () => {
        parent.classList.add("shrink");

        setTimeout(() => {
            //destroy the scoreboard so it updates
            //every time it's opened
            parent.replaceChildren([]);
            document.getElementById("gameContainer").classList.remove("shrink");
        }, SHRINK_TIME);
    }

    parent.appendChild(node);
    updateScoresTable();
}

function createEndGamePlate(victory, numGuesses) {
    const parent = document.getElementById("gameContainer");
    const template = document.getElementById("endGameTemplate");

    const node = template.content.cloneNode(true);
    
    const endGameMessage = node.querySelector(".endGameMessage");
    endGameMessage.innerText = victory ? "Congratulations" : "Unlucky";

    const inputForm = node.querySelector(".highScoreForm");
    inputForm.onsubmit = e => {
        submitHighScore(e, numGuesses);
        window.localStorage.submittedHighScore = true;
    }

    const nameInput = node.querySelector(".nameInput");
    nameInput.value = window.localStorage.name;
    nameInput.onchange = e => {
        window.localStorage.name = e.target.value
    }

    const shareButton = node.querySelector(".shareButton");
    shareButton.onclick = () => {
        const emojiArray = ["⬛", "🟨", "🟩"];
        const emojiBoard = g_currentGame.getBoardState()
            .map(row => row.map(i => emojiArray[i-1]).join("")).join("\n");

        navigator.clipboard.writeText(`Nickle ${(new Date()).toLocaleDateString()}\n\n${emojiBoard}`);
        showMessage("Copied to clipboard");
    }

    const showHighScoresButton = node.querySelector("#showHighScoresButton");
    const scoreboardContainer = document.getElementById("scoreboardContainer");
    showHighScoresButton.onclick = () => {
        parent.classList.add("shrink");

        createScoreboard(scoreboardContainer);

        setTimeout(()=>{
            scoreboardContainer.classList.remove("shrink");
        }, SHRINK_TIME);
    };

    const startedToday = isTimeFromToday(g_startTime);
    if (!startedToday) {
        showHighScoresButton.remove();
        shareButton.remove();
        inputForm.remove();
        endGameMessage.innerText = "Refresh to play today's game";
    }

    // for when user visits page after finishing the game
    if (!victory || window.localStorage.submittedHighScore) {
        inputForm.remove();
    }

    parent.appendChild(node);
}

function createKeyboard() {
    const parent = document.getElementById("keyboard");
    const rows = [
        "QWERTYUIOP",
        "ASDFGHJKL",
        "ZXCVBNM"
    ];

    const createKey = text => {
        const element = document.createElement("span");
        element.classList.add("keyboardKey");
        element.innerText = text;
        element.id = text;
        g_keyMap[text] = element;
        element.onanimationend = () => {
            element.classList.remove("bounce");
        }

        return element;
    }

    for (let rowNum = 0; rowNum < 3; ++rowNum) {
        const row = rows[rowNum];
        const rowDiv = document.createElement("div");
        rowDiv.classList.add("keyboardRow");

        if (rowNum === 2) {
            const enterKey = createKey("Guess");
            enterKey.classList.add("enterKey");
            enterKey.onclick = () => {
                g_currentGame.submitWord();
            };
            rowDiv.appendChild(enterKey);
        }

        for (const char of row) {
            const key = createKey(char);
            key.onclick = () => {
                g_currentGame.addChar(char);
            };
            rowDiv.appendChild(key);
        }

        if (rowNum === 2) {
            const backspaceKey = createKey("<==");
            backspaceKey.classList.add("backspaceKey");
            backspaceKey.onclick = () => {
                g_currentGame.delChar();
            };
            rowDiv.appendChild(backspaceKey);
        }

        parent.appendChild(rowDiv);
    }
}

function createGuessBoxes() {
    const parent = document.querySelector("#guesses");

    for (let i = 0; i < MAX_GUESSES; ++i) {
        const guessDiv = document.createElement("div");
        guessDiv.classList.add("guessRow");
        
        for (let j = 0; j < WORD_LENGTH; ++j) {
            const element = document.createElement("span");
            element.classList.add("guessChar");
            guessDiv.appendChild(element);
        }

        parent.appendChild(guessDiv);
    }
}

function showMessage(text) {
    g_MessageElement.innerText = text;
    g_MessageElement.classList.add("animate");
}

window.onload = async () => {
    const results = await Promise.all(g_initPromises);
    [g_wordList, g_guessList] = results.map(a => a.replaceAll(/[\r\n]+/g, "\n").toUpperCase().split("\n"));

    const {lastSaveTime, guesses} = window.localStorage;
    const name = window.localStorage.name || g_guessList[Math.floor(Math.random() * g_guessList.length)];

    let savedGuesses = [];

    if (isTimeFromToday(lastSaveTime)) {
        savedGuesses = JSON.parse(guesses);
    }
    else {
        window.localStorage.clear();
        window.localStorage.name = name; // restore name
    }
    
    createKeyboard();
    createGuessBoxes();
    g_currentGame = new Game(savedGuesses);

    g_MessageElement = document.getElementById("message");
    g_MessageElement.onanimationend = () => {
        g_MessageElement.classList.remove("animate");
    }
}

window.onkeydown = e => {
    if (e.key >= "a" && e.key <= "z") {
        g_currentGame.addChar(e.key);
    }
    else if (e.key === "Enter") {
        g_currentGame.submitWord();
    }
    else if (e.key === "Backspace") {
        g_currentGame.delChar();
    }

    if ((new URL(window.location)).hostname === "localhost") {
        switch(e.key) {
            case "1": 
                window.localStorage.clear();
                break;

            case "2" :
                window.location = window.location;
                break;
        }
    }
}
