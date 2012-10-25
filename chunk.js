var RTMPChunk = module.exports = function(buffer) {
	this.buffer = buffer;
}
RTMPChunk.prototype.__defineGetter__('basicHeader', function() {
	if (this._basicHeader) return this._basicHeader;

	var chunkType = this.buffer.readUInt8(0) & (3<<6);
	var chunkStreamId = this.buffer.readUInt8(0) & (0x3f);
	var headerLength = 1;
	if (chunkStreamId == 0) {
		chunkStreamId = this.buffer.readUInt8(1) + 64;
		headerLength = 2;
	} else if (chunkStreamId == 1) {
		chunkStreamId = this.buffer.readUInt8(2)*256 + this.buffer.readUInt8(1) + 64;
		headerLength = 3;
	} else if (chunkStreamId == 2) { // low-level protocol message ?
		//TODO
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
	var messageLength = 0;
	// To properley parse >0 we need access to the previous chunk
	switch(this.basicHeader.chunkType) {
		case 0:
			//TODO parsing
			messageLength = 11;
			break;
		case 1:
			//TODO parsing
			messageLength = 7;
			break;
		case 2: 
			//TODO parsing
			messageLength = 3;
			break;
		case 3:
		default:
			//??
	}
	this._messageHeader = {
		byteLength: messageLength
	}
	return this._messageHeader;
});
RTMPChunk.prototype.__defineGetter__('extendedTimestampOffset', function() {
	return this.messageHeaderOffset + this.messageHeader.byteLength;
});
RTMPChunk.prototype.__defineGetter__('extendedTimestamp', function() {
	// if the normal timestamp is 0xffffff then this is used and is 4 bytes,
	// otherwise it is 0 bytes and unused
	//TODO
});
RTMPChunk.prototype.__defineGetter__('chunkDataOffset', function() {
	return this.extendedTimestampOffset + this.extendedTimestamp.byteLength;
});
RTMPChunk.prototype.__defineGetter__('chunkData', function() {
	//chunk size is the maximum chunk size for all but the last chunk of a message 
	//(or the only chunk for a small message) which has the remaining bytes
	//
	// therefore somehow the chunks need to relate together to a message, and the 
	// message needs to know how many bytes (of payload) are remaining
	//
	//return this.buffer.splice(this.chunkDataOffset,???);
});