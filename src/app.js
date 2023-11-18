const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const mongoose = require("./db/mongoose")
const userRouter = require("./routers/user")
const friendsRouter = require("./routers/friends")
const chatsRouter = require("./routers/chats")
const { setupSocketIO } = require('./routers/socket')

const app = express()

app.use((req, res, next) => {
    console.log(`Received a ${req.method} request to ${req.originalUrl}`)
    next()
})


app.use(express.json())
app.use(userRouter)
app.use(friendsRouter)
app.use(chatsRouter)

const server = http.createServer(app)
const io = new Server(server,
    {
        cors: {
            origin: process.env.ORIGIN,
            methods: ["GET", "POST"],
        },
    })

setupSocketIO(io)

module.exports = { app, server }