const { ipcRenderer } = require('electron');
const messages = document.getElementById('messages');

ipcRenderer.on('message', function (e, message) {
  console.log('>> info: details received');
  let li = document.createElement('li');
  li.appendChild(document.createTextNode(message));
  messages.appendChild(li);
});
