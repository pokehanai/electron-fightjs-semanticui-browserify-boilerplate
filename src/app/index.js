'use strict';

require('babel-polyfill');
require('dotenv').config();

import { app, BrowserWindow, crashReporter } from 'electron';

let mainWindow = null;
if (process.env.NODE_ENV === 'develop') {
  crashReporter.start({
    companyName: 'example.com',
    autoSubmit: false,
    submitURL: 'http://example.com',
  });
}

app.on('window-all-closed', () => {
  if (process.platform != 'darwin') {
    app.quit();
  }
});

app.on('ready', () => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 800
  });

  if (process.env.NODE_ENV === 'develop') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.loadURL('file://' + __dirname + '/../renderer/index.html');

  mainWindow.on('closed', function() {
    mainWindow = null;
  });
});
