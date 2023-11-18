const { json } = require("express")
const socketAuth = require("../middleware/socketAuth")

userIdSocket = {}

const setupSocketIO = (io) => {
    io.on('connection', async (socket) => {
        // console.log(`A client connected: ${socket.id}`)
        const userDetails = {
            token: socket.handshake.query.token,
            userId: ''
        }

        try {
            await socketAuth(userDetails)
            // console.log(userDetails)
            // console.log(socket)
            userIdSocket[userDetails.userId] = socket
            // console.log(userIdSocket)

            socket.on('disconnect', () => {
                // console.log(`A client disconnected: ${socket.id}`)
                userIdSocket[userDetails.userId] = ''
            })
        } catch (error) {
            // Handle authentication error
            console.error('Authentication error:', error.message)
            socket.disconnect(true) // Disconnect the client due to authentication failure
        }
    })
}

const sendMessage = (userId, messageInformation) => {
    // console.log(userIdSocket[userId])
    socket = userIdSocket[userId]
    socket && socket.emit('message', JSON.stringify(messageInformation))
}

module.exports = { setupSocketIO, sendMessage }