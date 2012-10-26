var events = require('events'),
	util = require('util');
var RTMPChunk = require('./chunk');

// message contains chunks - parses incoming chunks into complete messages and 
//   segments outgoing messages into chunks
var RTMPMessage = module.exports = function() {
	this.lastChunk = null;
	this.chunkSize = 128;
	this.chunks = [];
}
util.inherits(RTMPMessage, events.EventEmitter);
RTMPMessage.prototype.__defineGetter__('lastChunk', function() {
	return (this.chunks.length) ? this.chunks[this.chunks.length-1] : null;
});
RTMPMessage.prototype.__defineGetter__('basicHeader', function() {
	return this.chunks[0].basicHeader;
});
RTMPMessage.prototype.__defineGetter__('messageHeader', function() {
	return this.chunks[0].messageHeader;
});
RTMPMessage.prototype.__defineGetter__('data', function() {
	var data = [];
	for (var i = 0; i < this.chunks.length; i++) {
		data.push(this.chunks[i].chunkData);
	}
	return Buffer.concat(data); //TODO: potential optimisation point
});

// Warning! because RTMPChunk reaches in and uses these values, the order of modification/access is important
RTMPMessage.prototype.parseData = function(data) {
	// TODO: support where entire message doesn't fit within one data event, hence chunk data needs to be concatenated
	do {
		var chunk = new RTMPChunk(data, this);

		// Set number of bytes remaining in message
		if (!this.hasOwnProperty('bytesRemaining'))
			this.bytesRemaining = chunk.messageHeader.messageLength;

		this.emit('chunk', chunk);

		//debug
		console.log("basicHeader:", chunk.basicHeader, "messageHeader:", chunk.messageHeader, "chunkLength", chunk.chunkLength, "byteLength:", chunk.byteLength);

		// Slice buffer so its starts at the next chunk
		data = data.slice(chunk.byteLength);

		// Update bytes remaining in message
		this.bytesRemaining -= chunk.chunkLength;

		// Save chunk
		this.chunks.push(chunk);
	} while(this.bytesRemaining != 0);

	// Emit message complete event
	this.emit("complete");

	//TODO: do something with remaining data (there could be some if the data events aren't split on a message boundary)
	if (data.length)
		console.log("unparsed data remaining:", data, "("+data.length+" bytes)");
};