const { ipcRenderer } = require('electron');

const chatForm = document.getElementById('chat-form');
const chatMessages = document.querySelector('.chat-messages');
const userList = document.getElementById('users');
const queueList = document.getElementById('queue');
const leaveApp = document.getElementById('leave-app');
const lexiconButton = document.getElementById('lexicon-button');
const lexiconWord = document.getElementById('lexicon');

let username, room;
let username1, room1;
const input = document.querySelector('input[type="file"]');

let socketAddress = 'http://localhost:5000';
let socket = io(socketAddress);
let ss = require('socket.io-stream');
let socketReconnected = false;

let lexiconQueue = [];

// Join Word corector
ipcRenderer.on('userInfo', function (e, { username, room }) {
  console.log('>> info: details received', username);
  username = username;
  username1 = username;
  room = room;
  room1 = room;
  registerSocketEvents();
  socket.emit('joinRoom', { username, room });
  console.log('>> info: joining room');
});

// detect server disconnection
socket.on('disconnect', () => {
  console.log('>> info: server diconnected', username1);
  outputMessage({
    username: 'Bot',
    text: 'Primary server disconnnected',
    time: formatAMPM(new Date()),
  });
  socketAddress = 'http://localhost:8000';
  socket = io(socketAddress);
  registerSocketEvents();
  socket.emit('joinRoom', { username: username1, room: room1 });
  outputMessage({
    username: 'Bot',
    text: 'Connected to secondary server',
    time: formatAMPM(new Date()),
  });
});

socket.on('connect_error', () => {
  if (!socketReconnected) {
    socketReconnected = true;
    socketAddress = 'http://localhost:8000';
    socket = io(socketAddress);
    registerSocketEvents();
    socket.emit('joinRoom', { username: username1, room: room1 });
    console.log('>> info: joining room');
    outputMessage({
      username: 'Bot',
      text: 'Connected to secondary server',
      time: formatAMPM(new Date()),
    });
  }
});

socket.on('connect_failed', () => {
  if (!socketReconnected) {
    socketReconnected = true;
    socketAddress = 'http://localhost:8000';
    socket = io(socketAddress);
    registerSocketEvents();
    socket.emit('joinRoom', { username: username1, room: room1 });
    console.log('>> info: joining room');
    outputMessage({
      username: 'Bot',
      text: 'Connected to secondary server',
      time: formatAMPM(new Date()),
    });
  }
});

const registerSocketEvents = () => {
  // Get users
  socket.on('roomUsers', ({ room, users }) => {
    console.log('>> info: adding users to UI');
    outputUsers(users);
  });

  // Message from server
  socket.on('message', (data) => {
    console.log(data);
    outputMessage(data);

    console.log('>> info: Message from server');

    // Scroll down
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });

  socket.on('task', (data) => {
    downloadfile(data);
  });

  // listen for server polls
  socket.on('polling', (data) => {
    outputMessage(data);
    for (let i = 0; i < lexiconQueue.length; i++) {
      sendAndPrint(i);
    }
    // Scroll down
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });
};

// file submission
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  console.log('>> info: File sent');

  var file = input.files[0];
  console.log(file.name);
  //checking if the file is .txt
  let fileNameArray = file.name.split('.'); //using split function to check for file type
  if (
    fileNameArray.length == 2 &&
    fileNameArray[fileNameArray.length - 1] == 'txt'
  ) {
    var stream = ss.createStream();

    // upload a file to the server.
    ss(socket).emit('file', stream, {
      username: username,
      fileName: file.name,
    });
    ss.createBlobReadStream(file).pipe(stream);
  } else {
    console.log('>> info: File Extention Invalid'); //when file uploaded is not in .txt
    const div = document.createElement('div');
    div.innerHTML =
      '<div style="margin: 5px 0 0 10px;">Upload a .txt File</div>';
    document.querySelector('#chat-form').appendChild(div);
  }
});

console.log('>> info: Going inside DOM');

// Output message to DOM
function outputMessage(message) {
  const div = document.createElement('div');
  div.classList.add('message');
  const p = document.createElement('p');
  p.classList.add('meta');
  p.innerText = message.username == 'Bot' ? '' : message.username;
  p.innerHTML += ` <span>(${message.time})</span> `;
  p.innerText += message.text;
  div.appendChild(p);
  document.querySelector('.chat-messages').appendChild(div);
}

//downloading a file when download button is added after checking the uploaded file
function downloadfile(data) {
  const endpoint = `${socketAddress}/download?filename=${data.fileName}`;
  const downloadbutton = document.getElementById('download_form');
  if (downloadbutton) {
    downloadbutton.remove();
    insertButton(endpoint);
  } else {
    insertButton(endpoint);
  }
}

//adding download button
function insertButton(endpoint) {
  const div = document.createElement('div');
  div.id = 'download_form';
  //adding download button after uploaded file is checked
  div.innerHTML = `<button onclick="location.href='${endpoint}'" type="button">Download Corrected File</button>`;
  document.querySelector('#chat-form').appendChild(div);
}

function sendAndPrint(i) {
  setTimeout(() => {
    socket.emit('misspledLexicon', { word: lexiconQueue.shift() });
    outputQueue();
  }, i * 500);
}

// register events for lexicon button
lexiconButton.addEventListener('click', pushData);
lexiconWord.addEventListener('keyup', function (event) {
  event.preventDefault();
  if (event.key == 'Enter') {
    lexiconButton.click();
  }
});

// keep entering data in the queue
function pushData() {
  const inputText = lexiconWord.value;
  if (inputText != '') {
    lexiconQueue.push(inputText);
    outputQueue();
  }
  lexiconWord.value = '';
}

// Add users to DOM
function outputUsers(users) {
  userList.innerHTML = '';
  users.forEach((user) => {
    const li = document.createElement('li');
    li.innerText = user.username;
    userList.appendChild(li);
  });

  console.log('>> info: users added');
}

// Add queue to DOM
function outputQueue() {
  queueList.innerHTML = '';
  lexiconQueue.forEach((lexicon) => {
    const li = document.createElement('li');
    li.innerText = lexicon;
    queueList.appendChild(li);
  });
}

//leave app using the leave button
leaveApp.addEventListener('click', () => {
  ipcRenderer.send('close-app');
});

// Time format utility
function formatAMPM(date) {
  var hours = date.getHours();
  var minutes = date.getMinutes();
  var ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  minutes = minutes < 10 ? '0' + minutes : minutes;
  var strTime = hours + ':' + minutes + ' ' + ampm;
  return strTime;
}
