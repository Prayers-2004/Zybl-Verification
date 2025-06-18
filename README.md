# IMPORTANT: Bug Fixes

## `navigator.getUserMedia`

`navigator.getUserMedia` is now deprecated and is replaced by `navigator.mediaDevices.getUserMedia`. To fix this bug replace all versions of `navigator.getUserMedia` with `navigator.mediaDevices.getUserMedia`

## Low-end Devices Bug

The video eventListener for `play` fires up too early on low-end machines, before the video is fully loaded, which causes errors to pop up from the Face API and terminates the script (tested on Debian [Firefox] and Windows [Chrome, Firefox]). Replaced by `playing` event, which fires up when the media has enough data to start playing.

# Face Detection App

## Setup Instructions

### Firebase Configuration

1. Copy `src/config/firebase.config.template.js` to `src/config/firebase.config.js`
2. Update the configuration values in `firebase.config.js` with your Firebase project details:
   - Get these values from your Firebase Console -> Project Settings -> Web App
   - Generate a secure encryption key for face vector encryption

```javascript
// Example configuration
export const firebaseConfig = {
  projectId: "your-project-id",
  authDomain: "your-project-id.firebaseapp.com",
  storageBucket: "your-project-id.appspot.com",
  apiKey: "your-api-key",
  messagingSenderId: "your-messaging-sender-id",
  appId: "your-app-id"
};

export const ENCRYPTION_KEY = "your-encryption-key";
```

### Security Notes

- Never commit `firebase.config.js` to version control
- Keep your encryption key secure
- Use Firebase security rules to protect your data

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

### `npm test`

Launches the test runner in the interactive watch mode.

### `npm run build`

Builds the app for production to the `build` folder.
