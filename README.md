# Walkie-Talkie App (Expo + Socket.IO)

A real push-to-talk walkie-talkie app:
- **Backend**: Node.js + Express + Socket.IO — relays voice clips between users in the same "channel" (room) and tracks who's online / who's speaking.
- **Mobile**: Expo (React Native) app that runs directly in **Expo Go**. Hold the button to record, release to send. Everyone else in the channel hears it automatically.

> Note on "live streaming": true continuous audio streaming over raw sockets needs native audio modules that Expo Go doesn't support. This app uses the same pattern real walkie-talkie apps use over data networks — **press, talk, release, and it's instantly relayed and played** on everyone else's phone. It feels and behaves like a walkie-talkie.

---

## 1. Run the backend

```bash
cd backend
npm install
npm start
```

You should see:
```
Walkie-Talkie server listening on port 3001
```

Find your computer's **LAN IP address** (your phone will connect to this, not "localhost"):
- Mac/Linux: `ifconfig | grep inet`
- Windows: `ipconfig` (look for IPv4 Address)

It'll look like `192.168.1.20`. Your phone and computer must be on the **same Wi-Fi network**.

Test it worked by opening `http://YOUR_IP:3001/health` in a browser — you should see `{"ok":true,...}`.

---

## 2. Run the mobile app

```bash
cd mobile
npm install
npx expo start
```

This prints a QR code. Open the **Expo Go** app on your phone and scan it (Android: scan directly in Expo Go; iOS: scan with the Camera app).

This project targets **Expo SDK 54** (matches the current Expo Go app as of mid-2026). If Expo Go on your phone has since updated to a newer SDK and you see an "incompatible SDK" error again, run this in the `mobile` folder to auto-align every package with your installed Expo Go version:
```bash
npx expo install expo@latest
npx expo install --fix
```
Then delete `node_modules` and reinstall (`npm install`) before running `npx expo start` again.

---

## 3. Use it

1. On the join screen, enter:
   - **Server URL**: `http://YOUR_IP:3001` (the IP from step 1)
   - **Your name**
   - **Channel**: any word, e.g. `general` — everyone using the same channel name talks together
2. Tap **Join Channel**.
3. **Hold** the orange button to talk, **release** to send. It plays automatically on every other connected phone in that channel.
4. Open the app on a second phone (or a friend's phone on the same Wi-Fi) with the same server URL and channel to test two-way communication.

---

## Deploying the backend so it works over the internet (not just local Wi-Fi)

Right now this only works when phones are on the same network as your computer. To use it anywhere:
1. Deploy the `backend` folder to a host like Render, Railway, Fly.io, or a VPS (it's a plain Node/Express/Socket.IO app — no changes needed).
2. Use the deployed `https://your-app.onrender.com` URL as the "Server URL" in the app instead of your local IP.

---

## Project structure

```
walkie-talkie-app/
├── backend/
│   ├── package.json
│   └── server.js          # Express + Socket.IO server (rooms, relay, presence)
└── mobile/
    ├── package.json
    ├── app.json            # Expo config + mic permissions
    ├── babel.config.js
    └── App.js              # Full app: join screen + push-to-talk screen
```

## How it works

1. Client connects with Socket.IO and emits `join` with `{ username, channel }`.
2. Server tracks users per channel, broadcasts `user-list` on join/leave.
3. On press-in, client starts `expo-av` recording and emits `speaking-start` (so others see a "speaking" indicator).
4. On release, client stops recording, base64-encodes the audio file, and emits `audio` with the payload.
5. Server relays that `audio` event to everyone else in the same channel.
6. Receiving clients write the base64 back to a temp file with `expo-file-system` and play it instantly with `expo-av`.

## Troubleshooting

- **"Connection failed" in the app**: double check the server URL uses your computer's LAN IP (not `localhost`), and that your phone + computer are on the same Wi-Fi. Some routers/hotspots isolate devices from each other — try a different network if it still fails.
- **No microphone permission prompt**: make sure you're running inside Expo Go (permissions are declared in `app.json`); reinstall Expo Go if it was previously denied.
- **Audio doesn't play on receiving end**: check the Metro logs for errors — usually a network hiccup while writing/reading the temp file; retry.
