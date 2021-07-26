const sha256 = require("sha256");
const { v1: uuidv1 } = require("uuid");
const currentNetworkUrl = process.argv[3];

function Blockchain() {
  this.chain = [];
  this.pendingTransactions = [];
  this.currentNetworkUrl = currentNetworkUrl;
  this.networkNodes = [];

  this.createNewBlock(100, "0", "0");
}

Blockchain.prototype.createNewBlock = function (
  nonce,
  previousBlockHash,
  hash
) {
  const newBlock = {
    index: this.chain.length + 1,
    timeStamp: Date.now(),
    transactions: this.pendingTransactions,
    nonce: nonce,
    hash: hash,
    previousBlockHash: previousBlockHash,
  };

  this.pendingTransactions = [];
  this.chain.push(newBlock);

  return newBlock;
};

Blockchain.prototype.getLastBlock = function () {
  return this.chain[this.chain.length - 1];
};

Blockchain.prototype.createNewTransaction = function (
  amount,
  sender,
  recipient
) {
  const newTransaction = {
    amount: amount,
    sender: sender,
    recipient: recipient,
    transactionId: uuidv1().split("-").join(""),
  };

  return newTransaction;
};

Blockchain.prototype.addTransactionToPendingTransactions = function (
  transactionObj
) {
  this.pendingTransactions.push(transactionObj);
  return this.getLastBlock["index"] + 1;
};

Blockchain.prototype.hashBlock = function (
  previousBlockHash,
  currentBlockData,
  nonce
) {
  const dataAsString =
    previousBlockHash + nonce.toString() + JSON.stringify(currentBlockData);
  const hash = sha256(dataAsString);
  return hash;
};

Blockchain.prototype.proofOfWork = function (
  previousBlockHash,
  currentBlockData
) {
  let nonce = 0;
  let hash = this.hashBlock(previousBlockHash, currentBlockData, nonce);
  while (hash.substring(0, 4) !== "0000") {
    nonce++;
    hash = this.hashBlock(previousBlockHash, currentBlockData, nonce);
  }

  return nonce;
};

Blockchain.prototype.chainIsValid = function (blockchain) {
  let validChain = true;
  for (var i = 1; i < blockchain.length; i++) {
    const currentBlock = blockchain[i];
    const previousBlock = blockchain[i - 1];
    const blockHash = this.hashBlock(
      previousBlock["hash"],
      {
        transactions: currentBlock["transactions"],
        index: currentBlock["index"],
      },
      currentBlock["nonce"]
    );

    if(blockHash.substr(0,4)!=='0000') 
      validChain = false;

    if (currentBlock["previousBlockHash"] !== previousBlock["hash"])
      validChain = false;
  }

  const genesisBlock = blockchain[0];
  const correctNonce = genesisBlock['nonce']==='100';
  const correctGenesisBlockHash = genesisBlock['hash']==='0';
  const correctPreviousBlockHash = genesisBlock['previousBlockHash']==='0';
  const correctTransactions = genesisBlock['transactions'].length===9;

  if(!correctNonce || !correctGenesisBlockHash || !correctPreviousBlockHash || !correctTransactions) validChain=false;

  return validChain;
};

Blockchain.prototype.getBlock = function(blockhash) {
  let correctBlock = null;
  this.chain.forEach(block => {
    if(block.hash === blockhash){
      correctBlock = block;
    }
  });
  return correctBlock;
}

Blockchain.prototype.getTransaction = function(transactionId) {
  let correctBlock = null;
  let correctTransaction = null
  this.chain.forEach(block => {
    block.transactions.forEach(transaction => {
      if(transaction.transactionId === transactionId){
        correctTransaction = transaction;
        currentBlock = block;
      }
    })
  });
  return {
    transaction: correctTransaction,
    block: correctBlock
  };
}

Blockchain.prototype.getAddressData = function(address) {
  let addressTransactions = [];
  this.chain.forEach(block => {
    block.transactions.forEach(transaction => {
      if(transaction.recipient===address || transaction.sender===address){
        addressTransactions.push(transaction);
      }
    })
  });
  
  let balance = 0;
  addressTransactions.forEach(transaction => {
    if(transaction.recipient===address) balance+=transaction.amount;
    else if(transaction.sender===address) balance-=transaction.amount;
  })

  return {
    addressTransactions: addressTransactions,
    addressBalance: balance
  }
}

module.exports = Blockchain;
