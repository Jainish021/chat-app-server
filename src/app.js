const path = require("path")
const express = require("express")
const http = require("http")
const cors = require("cors")
const mongoose = require("./db/mongoose")
const userRouter = require("./routers/user")
const friendsRouter = require("./routers/friends")
const chatsRouter = require("./routers/chats")

const app = express()

app.use(express.json())
app.use(userRouter)
app.use(friendsRouter)
app.use(chatsRouter)

app.use(cors({ origin: process.env.ORIGIN }))

const server = http.createServer(app)

module.exports = { app, server }