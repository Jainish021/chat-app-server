const express = require("express")
const multer = require("multer")
const sharp = require("sharp")
const generator = require('generate-password')
const User = require("../models/user")
const Friends = require("../models/friends")
const Chats = require("../models/chats")
const auth = require("../middleware/auth")
const { sendWelcomeEmail, sendCancellationEmail, sendTemporaryPassword, sendVerificationCode } = require("../emails/account")
const router = new express.Router()
const oneHourInMilliseconds = 60 * 60 * 1000

const generateTemporaryPassword = () => {
    return generator.generate({
        length: 15,
        numbers: true,
        symbols: false,
        lowercase: true,
        uppercase: true,
        strict: true
    })
}

router.post('/users', async (req, res) => {
    const regEx = /[a-zA-Z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,8}(.[a-z{2,8}])?/g
    if (req.body.password !== req.body.password2) {
        res.status(400).send({ error: "Passwords do not match." })
    } else if (req.body.password.includes(" ")) {
        res.status(400).send({ error: "Passwords can not contain space." })
    } else if (!regEx.test(req.body.email)) {
        res.status(400).send({ error: "Invalid email." })
    }

    const verificationCode = generateTemporaryPassword()
    const { password2, ...userData } = req.body
    const user = new User(userData)
    user.temporaryPassword = verificationCode
    user.temporaryPasswordExpiration = Date.now() + oneHourInMilliseconds
    const friends = new Friends({ userId: user._id })
    try {
        await user.save()
        await friends.save()
        sendWelcomeEmail(user.email, user.username, verificationCode)
        res.status(200).send({ user })
    } catch (e) {
        res.status(400).send({ error: "user already regitered" })
    }
})

router.post('/users/verification', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email })
        if (user.temporaryPassword === req.body.verificationCode && user.temporaryPasswordExpiration > Date.now()) {
            user.temporaryPassword = null
            user.temporaryPasswordExpiration = null
            user.verified = true
            const token = await user.generateAuthToken()
            user.tokens.token = token
            await user.save()
            res.status(200).send({ verified: true, token: token })
        } else {
            const verificationCode = generateTemporaryPassword()
            user.temporaryPassword = verificationCode
            user.temporaryPasswordExpiration = Date.now() + oneHourInMilliseconds
            await user.save()
            sendVerificationCode(user.email, user.username, verificationCode)
            res.status(200).send({ verified: false })
        }
    } catch (e) {
        res.status(500).send()
    }
})

router.post('/users/username', async (req, res) => {
    if (req.body.username.includes(" ")) {
        res.status(400).send({ error: "Username cannot contain space." })
    }
    try {
        const username = await User.where({ username: req.body.username }).findOne()
        if (username) {
            res.send({ error: "Username already in use." })
        }
        res.send()
    }
    catch (e) {
        res.send()
    }
})

router.post("/users/login", async (req, res) => {
    try {
        const user = await User.findByCredentials(req.body.email, req.body.password)
        let verificationCode = ""
        if (!user.verified) {
            if (user.temporaryPasswordExpiration < Date.now()) {
                verificationCode = generateTemporaryPassword()
                user.temporaryPassword = verificationCode
                user.temporaryPasswordExpiration = Date.now() + oneHourInMilliseconds
                await user.save()
            } else {
                verificationCode = user.temporaryPassword
            }
            sendVerificationCode(user.email, user.username, verificationCode)
            res.status(200).send({ user })
        } else {
            const token = await user.generateAuthToken()
            res.status(200).send({ user, token })
        }
    } catch (e) {
        res.status(400).send()
    }
})

router.post("/users/logout", auth, async (req, res) => {
    try {
        req.user.tokens = req.user.tokens.filter((token) => {
            return token.token !== req.token
        })
        await req.user.save()
        res.send()
    } catch (e) {
        res.status(500).send()
    }
})

router.post("/users/logoutAll", auth, async (req, res) => {
    try {
        req.user.tokens = []
        await req.user.save()
        res.send()
    } catch (e) {
        res.status(500).send()
    }
})

router.get("/users/me", auth, async (req, res) => {
    try {
        res.send(req.user)
    } catch (e) {
        res.status(500).send({ error: "Unable to find user!" })
    }
})


router.patch("/users/me", auth, async (req, res) => {
    const updates = Object.keys(req.body)
    const allowedUpdates = ['name', 'email', 'password', 'age']
    const isValidOperation = updates.every((update) => allowedUpdates.includes(update))

    if (!isValidOperation) {
        return res.status(400).send({ error: 'Invalid updates!' })
    }
    try {
        updates.forEach((update) => req.user[update] = req.body[update])

        const user = await req.user.save(req.user)

        if (!user) {
            return res.status(404).send()
        }
        res.status(201).send(req.user)
    } catch (e) {
        res.status(400).send(e)
    }
})

router.delete('/users/me', auth, async (req, res) => {
    const userId = req.user._id.toString()
    try {
        const friendList = await Friends.findOne({ userId: req.user._id.toString() })
        const idsToUpdate = friendList.friends.map(doc => doc.friend)
        const chatIds = friendList.friends.map(doc => doc.friend < userId ? doc.friend + userId : userId + doc.friend)

        await Friends.updateMany(
            { "userId": { $in: idsToUpdate } },
            { $pull: { "friends": { "friend": userId } } },
        )

        await Friends.deleteOne({ "userId": userId })
        await Chats.deleteMany({ "chatId": { $in: chatIds } })
        await req.user.deleteOne()
        sendCancellationEmail(req.user.email, req.user.username)
        res.send(req.user)
    } catch (e) {
        res.status(500).send()
    }
})

const avatar = multer({
    limits: {
        fileSize: 1000000
    },
    fileFilter(req, file, cb) {
        if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
            return cb(new Error("Please upload image in jpg, jpeg or png format"))
        }
        cb(undefined, true)
    }
})


router.post("/users/me/avatar", auth, avatar.single('avatar'), async (req, res) => {
    const buffer = await sharp(req.file.buffer).resize({ width: 250, heigh: 250 }).png().toBuffer()

    req.user.avatar = buffer
    await req.user.save()
    res.send({ avatar: req.user.avatar.toString('base64') })
}, (error, req, res, next) => {
    res.status(400).send({ error: error.message })
})

router.delete("/users/me/avatar", auth, async (req, res) => {
    try {
        req.user.avatar = undefined
        await req.user.save()
        res.send()
    } catch (e) {
        res.status(500).send()
    }
})

router.get("/users/:id/avatar", async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
        if (!user || !user.avatar) {
            throw new Error()
        }

        res.send(user.avatar.toString('base64'))
    } catch (e) {
        res.status(404).send()
    }
})

router.post("/users/forgotPassword", async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email })
        if (!user.temporaryPassword || !user.temporaryPasswordExpiration || !user.temporaryPasswordExpiration > Date.now()) {
            const password = generateTemporaryPassword()
            user.temporaryPassword = password
            user.temporaryPasswordExpiration = Date.now() + oneHourInMilliseconds
            await user.save()
        }
        sendTemporaryPassword(user.email, user.username, user.temporaryPassword)
        res.status(200).send({ "success": "Temporary password is sent to the registered email." })
    } catch (e) {
        res.status(503).send()
    }
})

router.post("/users/changePassword", async (req, res) => {
    if (req.body.password !== req.body.password2) {
        res.status(400).send({ error: "Passwords do not match." })
    } else if (req.body.password.includes(" ")) {
        res.status(400).send({ error: "Passwords can not contain space." })
    }

    try {
        const user = await User.findOne({ email: req.body.email })
        user.password = req.body.password
        user.temporaryPassword = null
        user.temporaryPasswordExpiration = null
        await user.save()
        res.status(200).send()
    } catch (e) {
        res.status(500).send()
    }

})

module.exports = router