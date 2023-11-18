const jwt = require("jsonwebtoken")
const User = require("../models/user")

const socketAuth = async (userDetails) => {
    try {
        const decoded = jwt.verify(userDetails.token, process.env.JWT_SECRET)

        const user = await User.findOne({ _id: decoded._id, 'tokens.token': userDetails.token })

        if (!user) {
            throw new Error()
        }

        userDetails.userId = decoded._id

        next()
    } catch (e) {

    }
}

module.exports = socketAuth