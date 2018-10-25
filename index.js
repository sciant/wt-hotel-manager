const Web3 = require('web3');
const fs = require('fs');
const path = require('path');
const ecies = require("eth-ecies");


//Reads authentication configuration file
var auth = fs.readFileSync(path.resolve(__dirname, './config/auth.json'), 'utf8');
auth = JSON.parse(auth);

// Reads hotel contract's interface
var hotelABI = fs.readFileSync(path.resolve(__dirname, './config/hotelABI.json'), 'utf8');
hotelABI = JSON.parse(hotelABI);


// Creates connection to our ethereum node and creates contract instance.
web3Con = new Web3(new Web3.providers.WebsocketProvider('ws://localhost:8545'));
contract =new web3Con.eth.Contract(hotelABI,auth.hotelAddress);

// Function to decryot data with hotel's private key
function decryptData(data){
  var decryptedData = ecies.decrypt(Buffer.from(auth.managerPrivateKey.slice(2),"hex"),
   Buffer.from(data,"hex"));
   console.log(JSON.parse(decryptedData.toString()));
  return JSON.parse(decryptedData.toString());
}


// Accepts booking with given Id
function acceptBooking(id, contract){
  // Create raw transaction object
  var acceptMethod = contract.methods.acceptBooking(id);
  var encodedABI = acceptMethod.encodeABI();
  var tx = {
    from: auth.managerAddress,
    to: auth.hotelAddress,
    gas: 2000000,
    data: encodedABI
  };
// Sign and send raw transaction
  web3Con.eth.accounts.signTransaction(tx, auth.managerPrivateKey).then(signed => {
    var tran = web3Con.eth.sendSignedTransaction(signed.rawTransaction);

    tran.on('error', console.error);
  });
}

// Rejects booking with given Id
function rejectBooking(id, contract){
  // Create raw transaction object
  var acceptMethod = contract.methods.acceptBooking(id);
  var encodedABI = acceptMethod.encodeABI();
  var tx = {
    from: auth.managerAddress,
    to: auth.hotelAddress,
    gas: 2000000,
    data: encodedABI
  };
// Sign and send raw transaction
  web3Con.eth.accounts.signTransaction(tx, auth.managerPrivateKey).then(signed => {
    var tran = web3Con.eth.sendSignedTransaction(signed.rawTransaction);

    tran.on('transactionHash', hash => {
      console.log('hash');
      console.log(hash);
    });

    tran.on('receipt', receipt => {
      console.log('reciept');
      console.log(receipt);
    });

    tran.on('error', console.error);
  });
}


// Initialises cancellatioon object for easier calculations
function createCancellation(from,to,amount){
  if (from.length != to.length || from.length != amount.length) return false;
  var result = [];
  for(var i=0;i<from.length;i++){
    result.push({from: parseInt(from[i]), to: parseInt(to[i]), amount: Number(amount[i])});
  }
  return result;
}


// TODO: Implemet booking request validation
function checkBookingRequest(data, cancellation, total){
  return true;
}



// Listens to newBookingRequest event
contract.events.newBookingRequest((err, events)=>{
  // Extract booking request's data
  var d = events.returnValues;
  var sender = d._sender,
      data = decryptData(d._encryptedData),
      cancellation = createCancellation(d._cancellationFrom, d._cancellationTo, d._cancellationAmount),
      total = Number(d._total),
      reqId = Number(d._id);

  // Checks if the booking request is good deal for the hotel
  var isBookingRequestRight = checkBookingRequest(data, cancellation, total);
  if (isBookingRequestRight){
    acceptBooking(reqId, contract);
  }else{
    declineBooking(reqId)
  }
})
