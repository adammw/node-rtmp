var _ = require('underscore') // for _.clone

// Monkey-patch Buffer
Buffer.prototype.readUInt24BE = function(offset) {
	return (this.readUInt8(offset) << 16) + (this.readUInt8(offset+1) << 8) + this.readUInt8(offset+2);
}
Buffer.prototype.writeUInt24BE = function(value, offset) {
	this[offset + 2] = value & 0xff;
    this[offset + 1] = value >> 8;
    this[offset] = value >> 16;
}

var RTMPChunk = module.exports = function(parentMessage, previousChunk) {
	this.message = parentMessage;
	this.previousChunk = previousChunk;
}
RTMPChunk.prototype.read = function(buf) {
	this.buffer = buf;
}
RTMPChunk.prototype.write = function(buf) {
	if (!buf)
		buf = new Buffer(this.byteLength)
	this.buffer = buf;

	// invoke setters to write to buffer
	if (!this._basicHeader || !this._messageHeader || !this._chunkData)
		throw new Error("basicHeader, messageHeader and chunkData must be set first");
	this.basicHeader = this._basicHeader;
	this.messageHeader = this._messageHeader;
	this.chunkData = this._chunkData;

	return this.buffer;
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
	if (!this._basicHeader) this._basicHeader = {};
	this._basicHeader.chunkType = header.chunkType;
	this._basicHeader.chunkStreamId = header.chunkStreamId;

	if (this._basicHeader.chunkStreamId >= 3 && this._basicHeader.chunkStreamId <= 63) {
		if (this.buffer) 
			this.buffer[0] = (this._basicHeader.chunkType<<6)|this._basicHeader.chunkStreamId;
		this._basicHeader.byteLength = 1;
	} else if (this._basicHeader.chunkStreamId >= 64 && this._basicHeader.chunkStreamId <= 319) {
		if (this.buffer) {
			this.buffer[0] = (this._basicHeader.chunkType<<6);
			this.buffer[1] = this._basicHeader.chunkStreamId - 64;
		}
		this._basicHeader.byteLength = 2;
	} else if (this._basicHeader.chunkStreamId >= 320 && this._basicHeader.chunkStreamId <= 65599) {
		if (this.buffer) {
			this.buffer[0] = (this._basicHeader.chunkType<<6)|1;
			this.buffer[0] = (this._basicHeader.chunkStreamId % 256) - 64;
			this.buffer[2] = this._basicHeader.chunkStreamId / 256;
		}
		this._basicHeader.byteLength = 3;
	} 
});
RTMPChunk.prototype.__defineGetter__('messageHeaderOffset', function() {
	return this.basicHeader.byteLength;
});
RTMPChunk.prototype.__defineGetter__('messageHeader', function() {
	if (this._messageHeader) return this._messageHeader;
	var messageHeader = (this.previousChunk) ? _.clone(this.previousChunk.messageHeader) : {};
	var offset = this.messageHeaderOffset;
	switch(this.basicHeader.chunkType) {
		case 0:
			// Type-0 has absolute timestamp
			messageHeader.timestamp = this.buffer.readUInt24BE(offset);
			offset += 3;
			messageHeader.messageLength = this.buffer.readUInt24BE(offset);
			offset += 3;
			messageHeader.messageType = this.buffer.readUInt8(offset++);
			messageHeader.messageStream = this.buffer.readUInt32LE(offset); //little-endian
			offset += 4;
			break;
		case 1:
			// Type-1/2 have relative timestamp
			messageHeader.timestampDelta = this.buffer.readUInt24BE(offset);
			messageHeader.timestamp += messageHeader.timestampDelta
			offset += 3
			messageHeader.messageLength = this.buffer.readUInt24BE(offset);
			offset += 3
			messageHeader.messageType = this.buffer.readUInt8(offset++);
			break;
		case 2: 
			messageHeader.timestampDelta = this.buffer.readUInt24BE(offset); 
			offset += 3
			messageHeader.timestamp += messageHeader.timestampDelta
			break;
		case 3:
			messageHeader.timestamp += (messageHeader.timestampDelta) ? messageHeader.timestampDelta : messageHeader.timestamp;
			break;
		default:
			throw new Error("Invalid chunk type "+this.basicHeader.chunkType);
	}
	messageHeader.byteLength = offset - this.messageHeaderOffset;
	this._messageHeader = messageHeader;
	return this._messageHeader;
});
RTMPChunk.prototype.__defineSetter__('messageHeader', function(header) {
	//TODO: dynamically change packet type depending on what's changed since last chunk
	if (typeof header != "object") //TODO: make more strict error checking
		throw new Error("argument must be object");
	this._messageHeader = _.extend({}, (this.previousChunk) ? this.previousChunk.messageHeader : {}, this._messageHeader || {}, header);
	if (this._basicHeader) {
		if (this.previousChunk) {
			//TODO other types
			if (this.previousChunk.messageHeader.timestamp == this._messageHeader.timestamp && 
				this.previousChunk.messageHeader.messageLength == this._messageHeader.messageLength &&
				this.previousChunk.messageHeader.messageType == this._messageHeader.messageType &&
				this.previousChunk.messageHeader.messageStream == this._messageHeader.messageStream) {
				console.log("headers the same");
				this.basicHeader.chunkType = 3;
			} else {
				console.log("headers not the same");
			}
		}

		var offset = this.messageHeaderOffset;
		switch(this.basicHeader.chunkType) {
			case 0:
				if (this.buffer) {
					// Type-0 has absolute timestamp
					this.buffer.writeUInt24BE(this._messageHeader.timestamp, offset);
					offset += 3;
					this.buffer.writeUInt24BE(this._messageHeader.messageLength, offset);
					offset += 3;
					this.buffer.writeUInt8(this._messageHeader.messageType, offset++);
					this.buffer.writeUInt32LE(this._messageHeader.messageStream, offset); //little-endian
				}
				this._messageHeader.byteLength = 11;
				break;
			case 1:
				if (this.buffer) {
					//TODO
				}
				this._messageHeader.byteLength = 7;
				break;
			case 2:
				if (this.buffer) {
					//TODO
				}
				this._messageHeader.byteLength = 3;
				break;
			case 3:
				if (this.buffer) {
					//TODO
				}
				this._messageHeader.byteLength = 0;
				break;
			default:
				throw new Error("Invalid chunk type "+this.basicHeader.chunkType);
			break;
		}
	}
});
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
	if (this._chunkData) return this._chunkData;
	return this.buffer.slice(this.chunkDataOffset,this.chunkDataOffset+this.chunkLength)
});
RTMPChunk.prototype.__defineSetter__('chunkData', function(data) {
	if (!(data instanceof Buffer)) throw new Error("chunkData must be a buffer"); //TODO: or array of buffers?
	this._chunkLength = data.length;
	if (this.buffer) {
		data.copy(this.buffer, this.chunkDataOffset);
		this._chunkData = this.buffer.slice(this.chunkDataOffset, this.chunkDataOffset+this._chunkLength)
	} else {
		this._chunkData = data; // we don't want to keep this around as it's better to get it directly from the buffer,
								// but without the buffer we have no choice, just make sure to get rid of it when we do
	}
});
RTMPChunk.prototype.__defineGetter__('byteLength', function() {
	return this.chunkDataOffset + this.chunkLength;
});