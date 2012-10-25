var net = require('net'),
	events = require('events'),
	util = require('util'),
	os = require('os');

var RTMPHandshake = require('./handshake');

var log = function(){ console.log.apply(null, arguments); };

var RTMPClient = module.exports = function(socket) {
	this.socket = socket;
	this.state = 'connecting'; 
	socket.on('connect', this.onSocketConnect.bind(this));
};

RTMPClient.prototype.onSocketConnect = function() {
	// On connection send handshake
	this.handshake = new RTMPHandshake(this);
	this.handshake.on('error', function(err) {
		log('handshake error:',err);
	});
	this.handshake.on('complete', function() {
		console.log('handshake complete');
	});
	this.handshake.sendClientHandshake();
};

RTMPClient.connect = function(host, port) {
	return new RTMPClient(net.connect(port || 1935, host));
}