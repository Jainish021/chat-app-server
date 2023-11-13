const sgMail = require("@sendgrid/mail")

sgMail.setApiKey(process.env.SENDGRID_API_KEY)

const sendWelcomeEmail = (email, name) => {
    sgMail.send({
        to: email,
        from: "jainish1999@gmail.com",
        subject: "Welcome to Howdy",
        text: `Welcome to the app, ${name}. \n\nI'm glad you joined Howdy. I'm always updating the app to add new features. So, I hope you'll like using it. \n\nFeel free to give me any feedback. \n\nThank you, \nJainish.`
    })
}

const sendCancellationEmail = (email, name) => {
    sgMail.send({
        to: email,
        from: "jainish1999@gmail.com",
        subject: "Goodbye",
        text: `Thanks for using Howdy, ${name}. \n\nIt's sad to see you go. I hope you had a good time. Do let me know if there is something that I could improve. \n\nThank you, \nJainish.`
    })
}

const sendTemporaryPassword = (email, name, tempPassword) => {
    sgMail.send({
        to: email,
        from: "jainish1999@gmail.com",
        subject: "Password reset request",
        text: `Hi ${name}, \n\nHere is your temporary password: ${tempPassword} \nUse it to gain access to your account. \nNote: It is valid for 1 hour. \n\nThank you, \nJainish.`
    })
}

module.exports = {
    sendWelcomeEmail,
    sendCancellationEmail,
    sendTemporaryPassword
}