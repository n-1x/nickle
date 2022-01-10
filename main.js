"use strict"

const MAX_GUESSES = 6;
const WORD_LENGTH = 5;
const LENGTH_OF_KEYBOARD_ANIM = 1;
const API_URL = "https://beautiful-mica-sundial.glitch.me";

class Game {
    #guessRows;
    #currentRow;
    #charNumber = 0;
    #guessNumber = 0;
    #targetWord;
    #guesses = [];
    #gameOver = false;
    #guessedSinceSave = false;

    constructor(initialGuesses) {
        this.#guessRows = document.querySelectorAll(".guessRow");
        this.updateCurrentRow();
        this.setTargetWord();

        if (initialGuesses) {
            // Stop these auto guesses counting as a new finish.
            // Used to hide the name input on the scoreboard
            this.#guessedSinceSave = false;

            for (const guess of initialGuesses) {
                for (const char of guess) {
                    this.addChar(char, true);
                }
                this.submitWord();
            }

            this.#guessedSinceSave = true;
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
        const randIndex = Math.floor(rand(seed) * wordList.length);
        this.#targetWord = wordList[randIndex].toUpperCase();
    }

    addChar(char, skipBounce = false) {
        const upChar = char.toUpperCase();

        if (this.#gameOver) {
            return;
        }

        if (this.#charNumber === WORD_LENGTH) {
            return;
        }

        if (keyMap[upChar].classList.contains("notInWord")) {
            return;
        }

        const charElement = this.#currentRow[this.#charNumber];
        charElement.innerText = upChar;

        if (!skipBounce) {
            charElement.classList.add("bounce");
            keyMap[upChar].classList.add("bounce");
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
                // Correct position class cannot be overridden
                if (!guessCharElement.classList.contains("correctPosition")) {
                    guessCharElement.classList.add(className);
                    keyMap[guessChar].classList.add(className);

                    // remove char from unused list
                    const unusedIndex = unusedChars.indexOf(guessChar);
                    if (unusedIndex >= 0) {
                        unusedChars.splice(unusedIndex, 1);
                    }
                }
            }
        });
    }
    
    makeGuess(word) {
        if (word.length !== WORD_LENGTH) {
            showMessage("Guess must be five characters")
            return;
        }
        
        if (!wordList.includes(word.toLowerCase())) {
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
        
        this.#guesses.push(word);
        window.localStorage.setItem("guesses", JSON.stringify(this.#guesses));
        window.localStorage.setItem("lastSaveTime", (new Date()).getTime());

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

        const allowSubmit = this.#guessedSinceSave;
        setTimeout(() => {
            keyboard.remove();
            createScoreboard(victory, allowSubmit, this.#guessNumber - 1);
        }, LENGTH_OF_KEYBOARD_ANIM * 1000);
    }
}

let currentGame = null;
let wordList = null;
let message = null;
const keyMap = {}; // maps key text to a dom node

function isTimeFromToday(aTime) {
    const date = new Date(parseInt(aTime));
    const now = new Date();

    return date.getFullYear() === now.getFullYear()
        && date.getMonth() === now.getMonth()
        && date.getDate() === now.getDate();
}

function submitHighScore(e, numGuesses) {
    e.preventDefault();
    const name = e.target.querySelector("input").value;

    if (name.length < 5) {
        showMessage("Name must be at least five characters");
    }
    else {
        showMessage("Submitting score");
        e.target.classList.add("shrink");

        fetch(`${API_URL}?game=nickle&score=${numGuesses}&name=${name}`, {
            method: "PUT"
        });
    }

    return false;
}

function createScoreboard(victory, allowSubmit, numGuesses) {
    const template = document.getElementById("scoreboardTemplate");
    const parent = document.getElementById("container");

    const node = template.content.cloneNode(true);
    const title = node.querySelector(".title");
    
    const endGameMessage = node.querySelector(".endGameMessage");
    endGameMessage.innerText = victory ? "Congratulations" : "Unlcuky";

    const inputForm = node.querySelector(".highScoreForm");
    inputForm.onsubmit = e => {
        submitHighScore(e, numGuesses);
    }

    if (!victory || !allowSubmit) {
        inputForm.remove();
    }

    parent.appendChild(node);

    fetch(`${API_URL}?game=nickle`)
        .then(res => res.json())
        .then(highScores => {
            const template = document.getElementById("scoreEntryTemplate");
            const scores = document.querySelector(".scores");

            const scoresFromToday = highScores.filter(({submitTime}) => isTimeFromToday(submitTime));

            console.dir(scoresFromToday)

            for (const {name, score, submitTime} of scoresFromToday) {
                const newNode = template.content.cloneNode(true);
                const nameEl = newNode.querySelector(".name");
                const numGuessesEl = newNode.querySelector(".numGuesses");
                const timeEl = newNode.querySelector(".time");

                nameEl.innerText = name;
                numGuessesEl.innerText = score;
                timeEl.innerText = (new Date(parseInt(submitTime))).toLocaleTimeString();
                scores.appendChild(newNode);
            }

            if (scoresFromToday.length > 0) {
                title.innerText = "Today's Scores";
                scores.classList.remove("hidden");
            }
            else {
                title.innerText = "No scores submitted yet.";
            }
        });
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
        keyMap[text] = element;
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
                currentGame.submitWord();
            };
            rowDiv.appendChild(enterKey);
        }

        for (const char of row) {
            const key = createKey(char);
            key.onclick = () => {
                currentGame.addChar(char);
            };
            rowDiv.appendChild(key);
        }

        if (rowNum === 2) {
            const backspaceKey = createKey("<==");
            backspaceKey.classList.add("backspaceKey");
            backspaceKey.onclick = () => {
                currentGame.delChar();
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
    message.innerText = text;
    message.classList.add("animate");
}

window.onload = () => {
    fetch("./wordlist.txt").then(res => res.text()).then(words => {
        wordList = words.split("\r\n");

        const lastSaveTime = window.localStorage.getItem("lastSaveTime");
        let savedGuesses = [];

        if (isTimeFromToday(lastSaveTime)) {
            savedGuesses = JSON.parse(window.localStorage.getItem("guesses"));
        }
        else {
            window.localStorage.clear();
        }
        
        createKeyboard();
        createGuessBoxes();
        currentGame = new Game(savedGuesses);
    });

    message = document.getElementById("message");
    message.onanimationend = () => {
        message.classList.remove("animate");
    }
}

window.onkeydown = e => {
    if (e.key >= "a" && e.key <= "z") {
        currentGame.addChar(e.key);
    }
    else if (e.key === "Backspace") {
        currentGame.delChar();
    }
    else if (e.key === "Enter") {
        currentGame.submitWord();
    }
}