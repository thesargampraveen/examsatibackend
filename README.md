# ExamSaathi Backend

Express + MongoDB (Mongoose) REST API for the ExamSaathi app.

## Run

```bash
npm install
npm run seed   # one-time: seed sample exam centers
npm start      # or: npm run dev (auto-restart on changes)
```

Requires `MONGO_URI` in `.env` to be reachable — see the Atlas IP whitelist note in the root README.

## Mock OTP

Dev mode returns `devOtp` in the send-otp response so you can log in without an SMS provider.

## Structure

```
src/
├── db/db.js              Mongo connection
├── models/               User, ExamCenter, Connection, Message, GuideTip, SafetyReport, ArrivalLog
├── middleware/auth.js    JWT bearer auth
├── routes/               auth, centers, partners, connections, chat, guide, safety
├── seed/seed.js          Sample exam centers
└── server.js             App entry — connects DB, then listens
```
