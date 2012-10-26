var events = require('events'),
	util = require('util');
var RTMPChunk = require('./chunk');

function defineConstant(obj, name, value) {
    obj.__defineGetter__(name, function() { return value; });
}
function defineConstants(obj, dict) {
    for (key in dict)
        defineConstant(obj, key, dict[key]);
}

// message contains chunks - parses incoming chunks into complete messages and 
//   segments outgoing messages into chunks
var RTMPMessage = module.exports = function() {
	this.lastChunk = null;
	this.chunkSize = 128;
	this.chunks = [];
}
util.inherits(RTMPMessage, events.EventEmitter);
defineConstants(RTMPMessage, {
	RTMP_MESSAGE_TYPE_CHUNK_SIZE:         0x01;
	RTMP_MESSAGE_TYPE_BYTES_READ_REPORT:  0x03;
	RTMP_MESSAGE_TYPE_CONTROL:            0x04;
	RTMP_MESSAGE_TYPE_SERVER_BW:          0x05;
	RTMP_MESSAGE_TYPE_CLIENT_BW:          0x06;
	RTMP_MESSAGE_TYPE_AUDIO:              0x08;
	RTMP_MESSAGE_TYPE_VIDEO:              0x09;
	RTMP_MESSAGE_TYPE_FLEX_STREAM_SEND:   0x0F;
	RTMP_MESSAGE_TYPE_FLEX_SHARED_OBJECT: 0x10;
	RTMP_MESSAGE_TYPE_FLEX_MESSAGE:       0x11;
	RTMP_MESSAGE_TYPE_INFO:               0x12;
	RTMP_MESSAGE_TYPE_SHARED_OBJECT:      0x13;
	RTMP_MESSAGE_TYPE_INVOKE:             0x14;
	RTMP_MESSAGE_TYPE_FLASH_VIDEO:        0x16;
});
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
	if (this.messageHeader.messageType == RTMPMessage.RTMP_MESSAGE_TYPE_INVOKE) {
		this.amf = new AMF(this.rawData);
		return this.amf;
	} else {
		return this.rawData;
	}
});
RTMPMessage.prototype.__defineGetter__('rawData', function() {
	if (this._rawData) return this._rawData;
	var data = [];
	for (var i = 0; i < this.chunks.length; i++) {
		data.push(this.chunks[i].chunkData);
	}
	this._rawData = Buffer.concat(data); //TODO: concat is time & memory consuming, array of buffers or stream I/O would be better
	return this._rawData; 
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