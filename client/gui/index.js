const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let welcomeWindow, mainWindow;

if (require('electron-squirrel-startup')) {
  app.quit();
}

//creating welcome window where the user can enter a user name
const createWelcomeWindow = () => {
  welcomeWindow = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true,
    },
    width: 300,
    height: 250,
  });

  // load the GUI file for the window
  welcomeWindow.loadFile(path.join(__dirname, 'welcome.html'));
  welcomeWindow.on('close', () => {
    welcomeWindow.webContents.session.clearCache(() => {
      welcomeWindow.close();
      app.quit();
    });
  });
};

// creating new room window for the client
const createMainWindow = ({ username, room }) => {
  mainWindow = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true,
      preload: './room.js',
    },
    minHeight: 500,
    minWidth: 600,
  });

  // load the GUI file for the window
  mainWindow.loadFile(path.join(__dirname, 'room.html'));
  mainWindow.webContents.on('did-finish-load', function () {
    mainWindow.webContents.send('userInfo', { username, room });
  });

  mainWindow.on('close', () => {
    mainWindow.webContents.session.clearCache(() => {
      mainWindow.close();
      app.quit();
    });
  });
};

// open welcome window once the client is compiled
app.on('ready', createWelcomeWindow);

// gracefully exit the program on close
app.on('window-all-closed', () => {
  if (process.platform == 'darwin') {
    app.quit();
  }
});

// show the window after compilation
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWelcomeWindow();
  }
});

//when user logs in
ipcMain.on('userLoggedIn', (e, data) => {
  console.log('>> info: userLoggedIn');

  // close the username window and open the room window with socket connection to the servers
  welcomeWindow.close();
  createMainWindow(data);
});

// gracefully exit the code on closing the room window
ipcMain.on('close-app', (e) => {
  mainWindow.close();
  app.quit();
});
