var AMF = module.exports = function( buf ) {
    this.buf = buf;
};

/* Constants */
AMF.AMF_NUMBER = 0;
AMF.AMF_BOOLEAN = 1;
AMF.AMF_STRING = 2;
AMF.AMF_OBJECT = 3;
AMF.AMF_MOVIECLIP = 4;
AMF.AMF_NULL = 5;
AMF.AMF_UNDEFINED = 6;
AMF.AMF_REFERENCE = 7;
AMF.AMF_ECMA_ARRAY = 8;
AMF.AMF_OBJECT_END = 9;
AMF.AMF_STRICT_ARRAY = 10;
AMF.AMF_DATE = 11;
AMF.AMF_LONG_STRING = 12;
AMF.AMF_UNSUPPORTED = 13;
AMF.AMF_RECORDSET = 14;
AMF.AMF_XML_DOC = 15;
AMF.AMF_TYPED_OBJECT = 16;
AMF.AMF_AVMPLUS = 17;
AMF.AMF_INVALID = 0xff;

AMF.prototype.writeInt16 = function( value, offset ) {
    offset = offset || 0;
    this.buf[offset + 1] = value & 0xff;
    this.buf[offset] = value >> 8;
    return 2;
};
AMF.prototype.writeInt24 = function( value, offset ) {
    offset = offset || 0;
    this.buf[offset + 2] = value & 0xff;
    this.buf[offset + 1] = value >> 8;
    this.buf[offset] = value >> 16;
    return 3;
};
AMF.prototype.writeInt32 = function( value, offset ) {
    offset = offset || 0;
    this.buf[offset + 3] = value & 0xff;
    this.buf[offset + 2] = value >> 8;
    this.buf[offset + 1] = value >> 16;
    this.buf[offset] = value >> 24;
    return 4;
};
AMF.prototype.writeBoolean = function( value, offset ) {
    this.buf[offset] = AMF.AMF_BOOLEAN;
    this.buf[offset+1] = (value) ? 0x01 : 0x00;
    return 2;
};
AMF.prototype.writeNumber = function( value, offset ) {
    this.buf[offset] = AMF.AMF_NUMBER;
    this.buf.writeDoubleBE( value, offset+1 );
    return 9;
};
AMF.prototype.writeString = function( str, offset ) {
    offset = offset || 0;
    var pos = offset;
    
    var len = Buffer.byteLength( str );
    if ( len < 65536 ) {
        this.buf[pos++] = AMF.AMF_STRING;
        pos += this.writeInt16( len , pos );
    } else {
        this.buf[pos++] = AMF.AMF_LONG_STRING;
        pos += this.writeInt32( len , pos )
    }
    
    pos += this.buf.write( str, pos );
    
    return pos - offset;
};
AMF.prototype.writeObject = function( obj, offset ) {
    offset = offset || 0;
    var pos = offset;
    this.buf[pos++] = AMF.AMF_OBJECT;
    
    for (var k in obj) {
        if (!obj.hasOwnProperty(k)) continue;        
        var kl = Buffer.byteLength( k );
        pos += this.writeInt16( kl, pos );
        pos += this.buf.write( k, pos );
        pos += this.write(obj[k], pos );
    }
    
    /* end of object - 0x00 0x00 0x09 */
    this.buf[pos++] = 0;
    this.buf[pos++] = 0;
    this.buf[pos++] = AMF.AMF_OBJECT_END;

    return pos - offset;
};
AMF.prototype.write = function( value, offset ) {
    if (typeof value == 'boolean') {
        return this.writeBoolean( value, offset );
    } else if (typeof value == 'string') {
        return this.writeString( value , offset );
    } else if (typeof value == 'number') {
        return this.writeNumber( value , offset );
    } else if (typeof value == 'object') {
        return this.writeObject( value , offset );
    } else {
        console.log('unknown type', typeof value);
        return 0;
    }
}