var _ = require('underscore') // for _.clone

// Monkey-patch Buffer
Buffer.prototype.readUint24BE = function(offset) {
	return (this.readUInt8(offset) << 16) + (this.readUInt8(offset+1) << 8) + this.readUInt8(offset+2);
}

var RTMPChunk = module.exports = function(buffer, parentMessage) {
	this.buffer = buffer; // parameter should be moved to read/write functions
	this.message = parentMessage;
}
// TODO: getters and setters should all be rewritten so that they affect only the internal state variables
// and don't depend on a buffer. the internal state should then be written or read to/from a buffer with a 
// read and write function, similar to the AMF library
RTMPChunk.prototype.__defineGetter__('basicHeader', function() {
	if (this._basicHeader) return this._basicHeader;
	var chunkType = (this.buffer.readUInt8(0))>>6;
	var chunkStreamId = this.buffer.readUInt8(0) & (0x3f);
	var headerLength = 1;
	if (chunkStreamId == 0) {
		chunkStreamId = this.buffer.readUInt8(1) + 64;
		headerLength = 2;
	} else if (chunkStreamId == 1) {
		chunkStreamId = this.buffer.readUInt8(2)*256 + this.buffer.readUInt8(1) + 64;
		headerLength = 3;
	} else if (chunkStreamId == 2) { // low-level protocol message ?
		//TODO: Set Chunk Size / Abort Message 
	} 
	this._basicHeader = {
		chunkType: chunkType,
		chunkStreamId: chunkStreamId,
		byteLength: headerLength
	};
	return this._basicHeader;
});
RTMPChunk.prototype.__defineSetter__('basicHeader', function(header) {
	if (typeof header != "object" || !header.hasOwnProperty('chunkType') || !header.hasOwnProperty('chunkStreamId'))
		throw new Error("must set basicHeader to an object containing chunkType and chunkStreamId");
	if (header.chunkType < 0 || header.chunkType > 3)
		throw new Error("chunkType out of range (0-3)");
	if (header.chunkStreamId < 3 || header.chunkStreamId > 65599)
		throw new Error("chunkStreamId out of range (3-65599)")
	this._basicHeader.chunkType = header.chunkType;
	this._basicHeader.chunkStreamId = header.chunkStreamId;

	if (this._basicHeader.chunkStreamId >= 3 && this._basicHeader.chunkStreamId <= 63) {
		this.buffer[0] = (this._basicHeader.chunkType<<6)|this._basicHeader.chunkStreamId;
		this._basicHeader.byteLength = 1;
	} else if (this._basicHeader.chunkStreamId >= 64 && this._basicHeader.chunkStreamId <= 319) {
		this.buffer[0] = (this._basicHeader.chunkType<<6);
		this.buffer[1] = this._basicHeader.chunkStreamId - 64;
		this._basicHeader.byteLength = 2;
	} else if (this._basicHeader.chunkStreamId >= 320 && this._basicHeader.chunkStreamId <= 65599) {
		this.buffer[0] = (this._basicHeader.chunkType<<6)|1;
		this.buffer[0] = (this._basicHeader.chunkStreamId % 256) - 64;
		this.buffer[2] = this._basicHeader.chunkStreamId / 256;
		this._basicHeader.byteLength = 3;
	} 
});
RTMPChunk.prototype.__defineGetter__('messageHeaderOffset', function() {
	return this.basicHeader.byteLength;
});
RTMPChunk.prototype.__defineGetter__('messageHeader', function() {
	if (this._messageHeader) return this._messageHeader;
	var messageHeader = (this.message.lastChunk && this.message.lastChunk != this) ? _.clone(this.message.lastChunk.messageHeader) : {};
	var offset = this.messageHeaderOffset;
	switch(this.basicHeader.chunkType) {
		case 0:
			// Type-0 has absolute timestamp
			messageHeader.timestamp = this.buffer.readUint24BE(offset);
			offset += 3;
			messageHeader.messageLength = this.buffer.readUint24BE(offset);
			offset += 3;
			messageHeader.messageType = this.buffer.readUInt8(offset++);
			messageHeader.messageStream = this.buffer.readUInt32BE(offset);
			offset += 4;
			break;
		case 1:
			// Type-1/2 have relative timestamp
			messageHeader.timestampDelta = this.buffer.readUint24BE(offset);
			messageHeader.timestamp += messageHeader.timestampDelta
			offset += 3
			messageHeader.messageLength = this.buffer.readUint24BE(offset);
			offset += 3
			messageHeader.messageType = this.buffer.readUInt8(offset++);
			break;
		case 2: 
			messageHeader.timestampDelta = this.buffer.readUint24BE(offset); 
			offset += 3
			messageHeader.timestamp += messageHeader.timestampDelta
			break;
		case 3:
		default:
			messageHeader.timestamp += (messageHeader.timestampDelta) ? messageHeader.timestampDelta : messageHeader.timestamp;
			break;

	}
	messageHeader.byteLength = offset - this.messageHeaderOffset;
	this._messageHeader = messageHeader;
	return this._messageHeader;
});
//TODO: messageHeader setter
RTMPChunk.prototype.__defineGetter__('extendedTimestampOffset', function() {
	return this.messageHeaderOffset + this.messageHeader.byteLength;
});
RTMPChunk.prototype.__defineGetter__('extendedTimestamp', function() {
	// if the normal timestamp is 0xffffff then this is used and is 4 bytes,
	// otherwise it is 0 bytes and unused
	if (this.messageHeader.timestamp != 0xffffff) {
		return {byteLength: 0};
	} else {
		return {
			extendedTimestamp: this.buffer.readUInt32BE(this.extendedTimestampOffset),
			byteLength: 4
		};
	}
});
//TODO: extendedTimestamp setter (will need to call messageHeader setter to change timestamp/delta field to 0xffffff)
RTMPChunk.prototype.__defineGetter__('chunkDataOffset', function() {
	return this.extendedTimestampOffset + this.extendedTimestamp.byteLength;
});
RTMPChunk.prototype.__defineGetter__('chunkLength', function() {
	if (!this.hasOwnProperty('_chunkLength'))
		this._chunkLength = (this.message.hasOwnProperty('bytesRemaining')) ? Math.min(this.message.chunkSize,this.message.bytesRemaining) : this.message.chunkSize;
	return this._chunkLength
})
RTMPChunk.prototype.__defineGetter__('chunkData', function() {
	//chunk size is the maximum chunk size for all but the last chunk of a message 
	//(or the only chunk for a small message) which has the remaining bytes
	//
	// therefore somehow the chunks need to relate together to a message, and the 
	// message needs to know how many bytes (of payload) are remaining
	//
	//return this.buffer.slice(this.chunkDataOffset,???);
	return this.buffer.slice(this.chunkDataOffset,this.chunkDataOffset+this.chunkLength)
});
RTMPChunk.prototype.__defineGetter__('byteLength', function() {
	return this.chunkDataOffset + this.chunkLength;
});