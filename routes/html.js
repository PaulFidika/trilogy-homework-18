const path = require("path")
const router = require("express").Router()

router.get(["/", "/index"], (req, res) => {
    res.status(200)
        .sendFile(path.join(__dirname, '../public', 'index.html'))
})

module.exports = router