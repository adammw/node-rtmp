var AMF = require('./amf');

module.exports = RTMPPacket;

function RTMPPacket( ) {
    this.header = new RTMPPacketHeader();
    this.body = new RTMPPacketBody();
}
RTMPPacket.prototype.serialize = function() {
    const RTMP_MAX_HEADER_SIZE = 18;
    const RTMP_DEFAULT_CHUNKSIZE = 128;
    var bChunkSize = this.chunkSize || RTMP_DEFAULT_CHUNKSIZE;

    this.buffer = new Buffer(4096);
    this.header.bodySize = (this.body.length) ?
        this.body.serialize(this.buffer.slice(RTMP_MAX_HEADER_SIZE)) : 0;
        
    var hOffset = this.header.serialize(this.buffer, RTMP_MAX_HEADER_SIZE);
    var hSize = RTMP_MAX_HEADER_SIZE - hOffset;
    var bOffset = RTMP_MAX_HEADER_SIZE;
    var packetSize = this.header.bodySize;
    var chunks = [this.buffer.slice(hOffset, RTMP_MAX_HEADER_SIZE)];
    while (packetSize) {
        if (packetSize < bChunkSize) {
            bChunkSize = packetSize;
        } 
            
        chunks.push(this.buffer.slice(bOffset, bOffset+bChunkSize));
        packetSize -= bChunkSize;
        bOffset += bChunkSize;
        
        if (packetSize > 0) {
            chunks.push(this.header.chunkHeader());
        }
    }
    //return this.buffer.slice(hOffset, RTMP_MAX_HEADER_SIZE+this.header.bodySize);
    return chunks;
};

/* Constants */
RTMPPacket.RTMP_PACKET_SIZE_LARGE = 0;
RTMPPacket.RTMP_PACKET_SIZE_MEDIUM = 1;
RTMPPacket.RTMP_PACKET_SIZE_SMALL = 2;
RTMPPacket.RTMP_PACKET_SIZE_MINIMUM = 3;
RTMPPacket.RTMP_PACKET_TYPE_CHUNK_SIZE =        0x01;
RTMPPacket.RTMP_PACKET_TYPE_BYTES_READ_REPORT=  0x03;
RTMPPacket.RTMP_PACKET_TYPE_CONTROL=            0x04;
RTMPPacket.RTMP_PACKET_TYPE_SERVER_BW=          0x05;
RTMPPacket.RTMP_PACKET_TYPE_CLIENT_BW=          0x06;
RTMPPacket.RTMP_PACKET_TYPE_AUDIO =             0x08;
RTMPPacket.RTMP_PACKET_TYPE_VIDEO =             0x09;
RTMPPacket.RTMP_PACKET_TYPE_FLEX_STREAM_SEND=   0x0F;
RTMPPacket.RTMP_PACKET_TYPE_FLEX_SHARED_OBJECT= 0x10;
RTMPPacket.RTMP_PACKET_TYPE_FLEX_MESSAGE=       0x11;
RTMPPacket.RTMP_PACKET_TYPE_INFO =              0x12;
RTMPPacket.RTMP_PACKET_TYPE_SHARED_OBJECT =     0x13;
RTMPPacket.RTMP_PACKET_TYPE_INVOKE =            0x14;
RTMPPacket.RTMP_PACKET_TYPE_FLASH_VIDEO =       0x16;

function RTMPPacketHeader( ) {
    this._headerType = RTMPPacket.RTMP_PACKET_SIZE_LARGE;
    this.hasAbsTimestamp = 0;
    this.timestamp = 0;
    this.channel = 0;
    this.infoField2 = 0;
    this.packetType = 0;
    this.__defineGetter__("headerType", function(){ return this._headerType; });
    this.__defineSetter__("headerType", function(headerType) {
        if (headerType > 3 || headerType < 0)
            throw new Error("Sanity Check Failed: header type of: "+headerType);
        this._headerType = headerType;
    });
};
/**
 * Writes to a buffer the RTMP packet header
 * @param[out] buf
 * @param[in] end
 * @return offset from start of buf where header begins
 */
RTMPPacketHeader.prototype.serialize = function( buf , end ) {
    const packetSize = [ 12, 8, 4, 1 ];
    
    var nSize = packetSize[this.headerType];
    var hSize = nSize;
    var cSize = 0;
    var t = this.timestamp; // - last
    var hOffset = 0;
    
    if (this.bodySize) {
        hOffset = end - nSize;
    } else {
        hOffset = 6;
    }
    
    if (this.channel > 319)
        cSize = 2;
    else if (this.channel > 63)
        cSize = 1;
    if (cSize) {
        hOffset -= cSize;
        hSize += cSize;
    }
    
    if (nSize > 1 && t >= 0xffffff)
    {
        hOffset -= 4;
        hSize += 4;
    }
    
    var hPos = hOffset;
    var c = this.headerType << 6;
    switch(cSize) {
        case 0:
            c |= this.channel;
            break;
        case 1:
            break;
        case 2:
            c |= 1;
            break;
    }
    buf[hPos++] = c;
    if (cSize)
    {
        var tmp = this.channel - 64;
        buf[hPos++] = tmp & 0xff;
        if (cSize == 2)
            buf[hPos++] = tmp >> 8;
    }
    
    var amf = new AMF(buf);
    
    if (nSize > 1)
    {
        hPos += amf.writeInt24( (t > 0xffffff) ? 0xffffff : t, hPos);
    }
    if (nSize > 4)
    {
        hPos += amf.writeInt24( this.bodySize, hPos );
        buf[hPos++] = this.packetType;
    }
    
    if (nSize > 8)
    {
        buf.writeInt32LE(this.infoField2, hPos );
        hPos += 4;
    }
    
    if (nSize > 1 && t >= 0xffffff) {
        hPos += amf.writeInt32( t, hPos );
    }
    
    return hOffset;
};
RTMPPacketHeader.prototype.chunkHeader = function() {
    var cSize = 0;
    if (this.channel > 319)
        cSize = 2;
    else if (this.channel > 63)
        cSize = 1;
    hSize = (cSize) ? cSize+1 : 1;
    var header = new Buffer(hSize);
    var c = this.headerType << 6;
    switch(cSize) {
        case 0:
            c |= this.channel;
            break;
        case 1:
            break;
        case 2:
            c |= 1;
            break;
    }
    header[0] = (0xc0 | c);
    if (cSize) {
        var tmp = this.channel - 64;
        header[1] = tmp & 0xff;
        if (cSize == 2)
            header[2] = tmp >> 8;
    }
    return header;
};
function RTMPPacketBody( ) {
    
};
RTMPPacketBody.prototype = new Array();
RTMPPacketBody.prototype.constructor = RTMPPacketBody;
RTMPPacketBody.prototype.serialize = function( buf ) {
    var bPos = 0;
    var amf = new AMF( buf );
    for (var i = 0; i < this.length; i++) {
        bPos += amf.write( this[i] , bPos );
    }
    return bPos;
};