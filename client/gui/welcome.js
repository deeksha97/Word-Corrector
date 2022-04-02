const { ipcRenderer } = require('electron');

const joinChat = document.getElementById('join-chat');
const username = document.getElementById('username');
let socketAddress = 'http://localhost:5000';
let socket = io(socketAddress);

joinChat.addEventListener('submit', (e) => {
  e.preventDefault();
  console.log('>>info: Join chat submit', username.value);
  socket.emit('checkUsername', { username: username.value }); //sending checkUsername to server
  console.log('>>info: checkUsername emitted');
});

const handleConnectionError = () => {
  socketAddress = 'http://localhost:8000';
  socket = io(socketAddress);
  registerSocketEvents();
};

const registerSocketEvents = () => {
  //checking for same usernames
  socket.on('checkUsernameResult', ({ userNameExists, username }) => {
    console.log('>>info: Result', userNameExists);

    //condition to see if same username
    if (!userNameExists) {
      console.log('>> info: connect client');
      ipcRenderer.send('userLoggedIn', { username, room: 'wordCorrector' });
    } else {
      console.log('User already exsists');

      //error message foer username already exists
      const errorDiv = document.createElement('div');
      errorDiv.innerHTML =
        '<div style="color:red; margin: 20px 0 0 0;">This username has already been taken</div>';
      joinChat.appendChild(errorDiv);
    }
  });
};

socket.on('connect_error', () => {
  handleConnectionError();
});

socket.on('connect_failed', () => {
  handleConnectionError();
});

socket.on('disconnect', () => {
  handleConnectionError();
});

registerSocketEvents();
