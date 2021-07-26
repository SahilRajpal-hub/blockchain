const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const { urlencoded, json } = require("body-parser");
const Blockchain = require("./blockchain");
const { v1: uuidv1 } = require("uuid");
const rp = require("request-promise");
const port = process.argv[2];

const nodeAddress = uuidv1().split("-").join("");

const blockchain = new Blockchain();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.get("/blockchain", (req, res) => {
  res.send(blockchain);
});

app.post("/transaction", (req, res) => {
  const newTransaction = req.body;
  const blockIndex =
    blockchain.addTransactionToPendingTransactions(newTransaction);
  res.json({
    note: `Transactions will be added to block ${blockIndex}.`,
  });
});

app.post("/transaction/broadcast", (req, res) => {
  const newTransaction = blockchain.createNewTransaction(
    req.body.amount,
    req.body.sender,
    req.body.recipient
  );
  blockchain.addTransactionToPendingTransactions(newTransaction);

  const requestPromises = [];
  blockchain.networkNodes.forEach((networkNodeUrl) => {
    const requestOptions = {
      uri: networkNodeUrl + "/transaction",
      method: "POST",
      body: newTransaction,
      json: true,
    };

    requestPromises.push(rp(requestOptions));
  });

  Promise.all(requestPromises).then((data) => {
    res.json({ note: "Transaction created and broadcast successfully" });
  });
});

app.get("/mine", (req, res) => {
  const lastBlock = blockchain.getLastBlock();
  const previousBlockHash = lastBlock["hash"];

  const currentBlockData = {
    transactions: blockchain.pendingTransactions,
    index: lastBlock["index"] + 1,
  };
  const nonce = blockchain.proofOfWork(previousBlockHash, currentBlockData);

  const hash = blockchain.hashBlock(previousBlockHash, currentBlockData, nonce);

  const newBlock = blockchain.createNewBlock(nonce, previousBlockHash, hash);

  const requestPromises = [];
  blockchain.networkNodes.forEach((networkNodeUrl) => {
    const requestOptions = {
      uri: networkNodeUrl + "/receive-new-block",
      method: "POST",
      body: { newBlock: newBlock },
      json: true,
    };

    requestPromises.push(rp(requestOptions));
  });

  Promise.all(requestPromises)
    .then((data) => {
      const requestOptions = {
        uri: blockchain.currentNetworkUrl + "/transaction/broadcast",
        method: "POST",
        body: {
          amount: 12.5,
          sender: "00",
          recipient: nodeAddress,
        },
        json: true,
      };

      return rp(requestOptions);
    })
    .then((data) => {
      res.json({
        note: "New Block mined successfull",
        block: newBlock,
      });
    });
});

//register the new block in chain
app.post("/receive-new-block", (req, res) => {
  const newBlock = req.body.newBlock;
  const lastBlock = blockchain.getLastBlock();
  const correctHash = newBlock.previousBlockHash === lastBlock.hash;
  const correctIndex = newBlock["index"] === lastBlock['index']+1;

  if (correctHash && correctIndex) {
    blockchain.chain.push(newBlock);
    blockchain.pendingTransactions = [];
    res.json({
      note: "New Block received and accepted",
      newBlock: newBlock,
    });
  } else {
    res.json({
      note: "New Block Rejected",
      newBlock: newBlock,
    });
  }
});

// register a node and broadcast it to the network
app.post("/register-and-broadcast-node", (req, res) => {
  const newNodeUrl = req.body.newNodeUrl;
  if (blockchain.networkNodes.indexOf(newNodeUrl) == -1)
    blockchain.networkNodes.push(newNodeUrl);

  const registerNodePromises = [];
  blockchain.networkNodes.forEach((networkNodeUrl) => {
    const requestOptions = {
      uri: networkNodeUrl + "/register-node",
      method: "POST",
      body: { newNodeUrl: newNodeUrl },
      json: true,
    };

    registerNodePromises.push(rp(requestOptions));
  });

  Promise.all(registerNodePromises)
    .then((data) => {
      const bulkRegisterOptions = {
        uri: newNodeUrl + "/register-nodes-bulk",
        method: "POST",
        body: {
          allNetworkNodes: [
            ...blockchain.networkNodes,
            blockchain.currentNetworkUrl,
          ],
        },
        json: true,
      };

      return rp(bulkRegisterOptions);
    })
    .then((data) => {
      res.json({ note: "New Node registered with network successfully" });
    });
});

// register a node with network
app.post("/register-node", (req, res) => {
  const newNodeUrl = req.body.newNodeUrl;
  const nodeNotAlreadyPresent =
    blockchain.networkNodes.indexOf(newNodeUrl) === -1;
  const notCurrentNode = blockchain.currentNetworkUrl !== newNodeUrl;
  if (nodeNotAlreadyPresent && notCurrentNode)
    blockchain.networkNodes.push(newNodeUrl);
  res.json({ note: "New Node registered successfully." });
});

// register multiple node at once
app.post("/register-nodes-bulk", (req, res) => {
  const allNetworkNodes = req.body.allNetworkNodes;
  allNetworkNodes.forEach((networkNodeUrl) => {
    const nodeNotAlreadyPresent =
      blockchain.networkNodes.indexOf(networkNodeUrl) === -1;
    const notCurrentNode = blockchain.currentNetworkUrl !== networkNodeUrl;

    if (nodeNotAlreadyPresent && notCurrentNode) {
      blockchain.networkNodes.push(networkNodeUrl);
    }
  });
  res.json({ note: "Bulk registration successful." });
});


app.get('/consensus', (req, res) => {
  const requestPromises = [];

  blockchain.networkNodes.forEach(networkNodeUrl => {
    const requestOptions = {
      uri: networkNodeUrl+'/blockchain',
      method: 'GET',
      json: true
    }
    requestPromises.push(rp(requestOptions));
  })

  Promise.all(requestPromises)
  .then(blockchains => {
    const currentChainLength = blockchain.chain.length;
    let maxChainLength = currentChainLength;
    let newLongestChain = null;
    let newPendingTransactions = null;

    blockchains.forEach(blockchain => {
      if(blockchain.chain.length > maxChainLength){
        maxChainLength=blockchain.chain.length;
        newLongestChain=blockchain.chain;
        newPendingTransactions=blockchain.pendingTransactions;
      }
    })

    if(!newLongestChain || (newLongestChain && !blockchain.chainIsValid(newLongestChain))){
      res.json({
        note: 'Current Chain is not replaced.',
        chain: blockchain.chain
      })
    }
    else {  // else if(newLongestChain && blockchain.chainIsValid(newLongestChain))   ---> same
      blockchain.chain = newLongestChain;
      blockchain.pendingTransactions = newPendingTransactions;
      res.json({
        note: 'This chain has been replaced',
        chain: newLongestChain
      })
    }
  })
});


app.get('/block/:blockhash', (req, res) => {
  const blockhash = req.params.blockhash;
  const correctBlock = blockchain.getBlock(blockhash);
  res.json({
    block: correctBlock
  });
})

app.get('/transaction/:transactionId', (req, res) => {
  const transactionId = req.params.transactionId;
  const transactionData = blockchain.getTransaction(transactionId);

  res.json({
    transaction: transactionData.transaction,
    block: transactionData.block
  })
})

app.get('/address/:address', (req, res) => {
  const address = req.params.address;
  const addressData = blockchain.getAddressData(address);
  res.json({
    addressData: addressData
  });
})


app.get('/block-explorer', (req, res) => {
  res.sendFile('./block-explorer/index.html', {root: __dirname})
})

app.listen(port, () => console.log(`Server listening on port ${port}...`));
