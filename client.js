var net = require('net'),
	events = require('events'),
	util = require('util'),
	os = require('os');

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
		console.log("new message");
		this.message = new RTMPMessage(data);
		this.message.on('complete', this.onMessage.bind(this));
	}
	this.message.parseData(data);
}


RTMPClient.prototype.onMessage = function() {
	this.emit("message", this.message);
}

//TODO: update to chunk/message system
RTMPClient.prototype.sendPacket = function(packet) {
	// If we aren't handshaken, then defer sending until we have
	if (!this.handshake || this.handshake.state != RTMPHandshake.STATE_HANDSHAKE_DONE) {
		this.on('connect', (function(){
			this.sendPacket(packet);
		}).bind(this));
		return;
	}

	var chunks = packet.serialize();
    this.socket.setNoDelay(true);
    log("sending RTMP packet...");

    //TODO: this is ugly.. fix it
    for (var i = 1; i < chunks.length; i+= 2) {
        log.logHex(chunks[i-1]);
        log.logHex(chunks[i]);
        var buf = new Buffer(chunks[i-1].length + chunks[i].length);
        chunks[i-1].copy(buf);
        chunks[i].copy(buf, chunks[i-1].length);
        this.socket.write(buf);
    }
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