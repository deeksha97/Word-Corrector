// imports
const { app: guiApp, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const socketClient = require('socket.io-client');
const ss = require('socket.io-stream');
const formatMessage = require('./utils/messages');
let lineReader = require('readline');

const bodyParser = require('body-parser');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const clientSocket = socketClient('http://localhost:5000');

// common utils
const {
  users,
  userJoin,
  userLeave,
  getRoomUsers,
  checkUsername,
} = require('./utils/users');

// misspelled words lexicon
const { misspelledWords } = require('./misspelled_words_lexicon');

// Setting static folder
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

//setting admin name to bot
const botName = 'Bot';
const pollingTime = 60 * 1000;

// create GUI window
if (require('electron-squirrel-startup')) {
  guiApp.quit();
}

const createWelcomeWindow = () => {
  guiWindow = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true,
    },
    width: 600,
    height: 600,
  });

  // load the GUI file for the window
  guiWindow.loadFile(path.join(__dirname, 'gui.html'));
  guiWindow.on('close', () => {
    guiWindow.webContents.session.clearCache(() => {
      guiWindow.close();
      app.quit();
    });
  });
};

guiApp.on('ready', createWelcomeWindow);

// gracefully exit the program on close
guiApp.on('window-all-closed', () => {
  if (process.platform == 'darwin') {
    guiApp.quit();
  }
});

// show the window after compilation
guiApp.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWelcomeWindow();
  }
});

// start timer for the poller
setInterval(() => {
  console.info('>> info: polling all connected clients');
  io.clients((error, clients) => {
    if (error) throw error;
    console.log(clients); // => [6em3d4TJP8Et9EMNAAAA, G5p55dHhGgUnLUctAAAB]
  });
  guiWindow.webContents.send(
    'message',
    '>> info: polling all connected clients'
  );

  io.emit('polling', formatMessage(botName, 'Server polling for new words...'));
}, pollingTime);

clientSocket.emit('backup', { room: 'backup' });

clientSocket.on('misspledLexicon', ({ word }) => {
  if (word) {
    console.log('>> info: new lexicon word received', word);
    guiWindow.webContents.send(
      'message',
      `>> info: New Lexicon Word Received ${word}`
    );
    if (!(word in misspelledWords)) {
      misspelledWords[word] = word;
    }
  }
});

clientSocket.on('disconnect', () => {
  guiWindow.webContents.send(
    'message',
    `>> info: Primary servevr disconnected`
  );
});

// listen for incoming requests and events
io.on('connection', (socket) => {
  //check if username already exists
  socket.on('checkUsername', ({ username }) => {
    console.log('>>info: checking username', username);
    guiWindow.webContents.send('message', `>> info: Checking Username`);
    const userNameExists = checkUsername(username);
    console.log('>>info: result of checkusername', userNameExists);
    socket.emit('checkUsernameResult', {
      userNameExists: userNameExists,
      username: username,
    });
  });

  // allow user to connect if username is not taken
  socket.on('joinRoom', ({ username, room }) => {
    const user = userJoin(socket.id, username, room);

    //register user locally on the server
    socket.join(user.room);
    console.log('>> info: New user joined');

    guiWindow.webContents.send('message', `>> info: ${username} has joined`);

    // Welcome message to the user
    console.log('>> info: Welcome message');
    socket.emit('message', formatMessage(botName, 'Welcome to Word Corrector'));
    guiWindow.webContents.send('message', `>> info: Welcome Message `);
    // Broadcast to all the other users when a new user has joined
    console.log('>> info: broadcasting new connection');

    socket.broadcast
      .to(user.room)
      .emit('message', formatMessage(botName, `${user.username} has joined`));

    // send info to users about all the other users connected
    io.to(user.room).emit('roomUsers', {
      room: user.room,
      users: getRoomUsers(user.room),
    });
  });

  // receive file data
  ss(socket).on('file', async function (stream, data) {
    //getting file data from client as a stream
    let fileNameArray = data.fileName.split('.');

    //adding socket id to the filename for uniqueness
    const fileName =
      fileNameArray[0] + '_' + socket.id + '.' + fileNameArray[1];
    console.log('>>info: Mofified File Name', data.fileName);
    const filePath = path.join(__dirname, 'uploads', fileName);

    // saving the file locally
    stream.pipe(
      fs.createWriteStream(filePath).on('close', () => {
        // sending message to the user that file has been successfully uploaded
        socket.emit(
          'message',
          formatMessage(botName, `${data.fileName} successfully uploaded`)
        );
        guiWindow.webContents.send(
          'message',
          `>> info: File successfully uploaded`
        );

        // function to read file contents for correction
        readFileContent(fileName, socket.id);

        // sending a signal to the user that the corrected file is ready to download
        socket.emit(
          'message',
          formatMessage(botName, 'File corrected and ready to download')
        );
        guiWindow.webContents.send(
          'message',
          `>> info: Corrected File ready to download `
        );
      })
    );

    // event to for user to download the file
    socket.emit('task', {
      fileName: fileName,
    });
  });

  //Receiving words in lexicon
  socket.on('misspledLexicon', ({ word }) => {
    if (word) {
      console.log('>> info: new lexicon word received', word);
      guiWindow.webContents.send(
        'message',
        `>> info: New Lexicon Word Received ${word}`
      );
      if (!(word in misspelledWords)) {
        misspelledWords[word] = word;
      }
    }
  });

  // Runs when client disconnects
  socket.on('disconnect', () => {
    // remove user from user-list
    const user = userLeave(socket.id);

    if (user) {
      // broadcasting message about the user leaving
      io.to(user.room).emit(
        'message',
        formatMessage(botName, `${user.username} has left`)
      );
      console.log('>>>info: user left');
      guiWindow.webContents.send('message', `>> info: ${user.username} left `);

      // update connected users list on the client end
      io.to(user.room).emit('roomUsers', {
        room: user.room,
        users: getRoomUsers(user.room),
      });
    }

    if (!users.length) {
      saveChangesToFile();
    }
  });
});

// read and correct the file
function readFileContent(fileName) {
  console.log('>> info: Inside readFileContent');
  const interface = lineReader.createInterface({
    input: fs.createReadStream(path.join(__dirname, 'uploads', fileName)),
  });
  console.log('>> info: Line reader Interface created.');
  let output = fs.createWriteStream(path.join(__dirname, 'download', fileName));
  console.log('>> info: Output file created.');

  // reading uploaded file line by line and correct the content
  interface.on('line', function (line) {
    console.log('>> info: Read Line');

    // split sentences into words
    let array = line.split(' ');
    console.log('>> info: Line converted to array', array);
    for (let i = 0; i < array.length; i++) {
      if (array[i].toLowerCase() in misspelledWords) {
        array[i] = '[' + array[i] + ']';
      }
    }
    console.log('>> info: Words converted', array);

    // convert words back in sentences
    output.write(array.join(' '));
  });
}

// Download file
app.get('/download', function (req, res) {
  const filedownload = `${__dirname}/download/${req.query.filename}`;
  res.download(filedownload);
  console.log('>> info: File downloaded');
  guiWindow.webContents.send('message', `>> info: File Downloaded`);
});

const saveChangesToFile = () => {
  return new Promise((resolve, reject) => {
    const misspelledWordsFile = `const misspelledWords = ${JSON.stringify(
      misspelledWords
    )}; module.exports = {misspelledWords};`;
    fs.writeFileSync(
      'misspelled_words_lexicon.js',
      misspelledWordsFile,
      'utf8',
      () => console.log('>> info: new words added to file')
    );
    return resolve;
  });
};

// server port number
const PORT = process.env.PORT || 8000;

// start a local server

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
// guiWindow.webContents.send('message', `>> info: Server running on Port 5000 `);

// clear console logs
console.clear();

// process.on('SIGINT', () => {
//   saveChangesToFile().then(() => process.exit());
// });
