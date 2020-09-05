const router = require("express").Router()
const path = require('path')
const Transaction = require("../models/transaction.js")

router.post("/api/transaction", ({ body }, res) => {
  console.log('api post route hit')
  console.log(body)
  Transaction.create(body)
    .then(dbTransaction => {
      res.status(200).json(dbTransaction);
    })
    .catch(err => {
      res.status(404).json(err);
    });
});

router.post("/api/transaction/bulk", ({ body }, res) => {
  Transaction.insertMany(body)
    .then(dbTransaction => {
      res.status(200).json(dbTransaction);
    })
    .catch(err => {
      res.status(404).json(err);
    });
});

router.get("/api/transaction", (req, res) => {
  console.log('cheese-------------------------------')
  console.log(Transaction)
  Transaction.find({}).sort({ date: -1 })
    .then(dbTransaction => {
      console.log('monkey--------------------')
      console.log(res)
      res.status(200).json(dbTransaction);
    })
    .catch(err => {
      res.status(404).json(err);
    });
});

module.exports = router;