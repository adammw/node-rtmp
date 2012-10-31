var net = require('net'),
	events = require('events'),
	util = require('util'),
	os = require('os');

var AMF = require('./amf');
var RTMPHandshake = require('./handshake');
var RTMPMessage = require('./message');

var log = require('./log');

var RTMPClient = module.exports = function(socket) {
	this.socket = socket;
	this.state = 'connecting'; 
	socket.on('connect', this.onSocketConnect.bind(this));
};
util.inherits(RTMPClient, events.EventEmitter);
RTMPClient.prototype.onSocketConnect = function() {
	// On connection send handshake
	this.handshake = new RTMPHandshake(this);
	this.handshake.on('error', function(err) {
		log.warn('handshake error:',err);
	});
	this.handshake.on('complete', (function() {
		log('handshake complete');
		this.socket.on('data', this.onData.bind(this));
		this.emit('connect');
	}).bind(this));
	this.handshake.sendClientHandshake();
};

RTMPClient.prototype.onData = function(data) {
	log("recieved RTMP data...", "(" + data.length + " bytes)");
	log.logHex(data);

	if (!this.message || this.message.bytesRemaining == 0) {
		this.message = new RTMPMessage(data);
		this.message.on('complete', this.onMessage.bind(this));
	}
	this.message.parseData(data);
}


RTMPClient.prototype.onMessage = function() {
	this.emit("message", this.message);

	if (this.message.messageHeader.messageType == RTMPMessage.RTMP_MESSAGE_TYPE_INVOKE) {
		switch (this.message.data.commandName) {
			case "_error":
				this.emit("error", this.message.data.arguments);
				break;
			case "close":
				this.socket.end();
				this.emit("close");
				break;
		}
	}
}

RTMPClient.prototype.sendInvoke = function(commandName, transactionId, commandObj, invokeArguments) {
	// TODO: create RTMPInvoke class to parse and/or handle this (that inherits from a general RTMPPacket class)
	var commandNameSerialiser = new AMF.AMFSerialiser(commandName);
    var transactionIdSerialiser = new AMF.AMFSerialiser(transactionId);
    var commandObjSerialiser = new AMF.AMFSerialiser(commandObj);
    if (invokeArguments !== undefined) {
    	var invokeArgumentsSerialiser = new AMF.AMFSerialiser(commandObj);
    }

    var amfLength = commandNameSerialiser.byteLength + transactionIdSerialiser.byteLength + commandObjSerialiser.byteLength + ((invokeArguments !== undefined) ? invokeArgumentsSerialiser.byteLength : 0);
    var amfOffset = 0;
    var amfData = new Buffer(amfLength);
    commandNameSerialiser.write(amfData.slice(amfOffset, commandNameSerialiser.byteLength));
    amfOffset += commandNameSerialiser.byteLength;
    transactionIdSerialiser.write(amfData.slice(amfOffset, amfOffset + transactionIdSerialiser.byteLength));
    amfOffset += transactionIdSerialiser.byteLength
    commandObjSerialiser.write(amfData.slice(amfOffset, amfOffset + commandObjSerialiser.byteLength));
    amfOffset += commandObjSerialiser.byteLength;
    if (invokeArguments !== undefined) {
    	invokeArgumentsSerialiser.write(amfData.slice(amfOffset, amfOffset + invokeArgumentsSerialiser.byteLength));
    }
	
	this.sendPacket(0x03, RTMPMessage.RTMP_MESSAGE_TYPE_INVOKE, amfData);	
}

RTMPClient.prototype.sendPacket = function(channel, messageType, data) {
	//TODO: Check if given a RTMPPacket object that specifies channel, messageType, data inside the object (e.g. RTMPInvoke)

	// If we aren't handshaken, then defer sending until we have
	if (!this.handshake || this.handshake.state != RTMPHandshake.STATE_HANDSHAKE_DONE) {
		this.on('connect', (function(){ // TODO: test this works correctly and does not end up with undefined parameters
			this.sendPacket(channel, messageType, data);
		}).bind(this));
		return;
	}

	var message = new RTMPMessage();
    var rawData = message.sendData(channel, messageType, data);
    log("sending RTMP packet...",  "(" + rawData.length + " bytes)");
    this.socket.write(rawData);
    log.logHex(rawData);
}

RTMPClient.prototype.sendRawData = function(packet) {
	log("sending raw data...", "(" + packet.length + " bytes)");
	log.logHex(packet);
	this.socket.write(packet);
}

RTMPClient.connect = function(host, port, connectListener) {
	const DEFAULT_PORT = 1935;
	if (!connectListener && typeof port == "function") {
		connectListener = port;
		port = DEFAULT_PORT;
	}
	var client = new RTMPClient(net.connect(port || DEFAULT_PORT, host));
	if (connectListener && typeof connectListener == "function") 
		client.on('connect', connectListener)
	return client;
}