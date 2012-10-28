var util = require('util')

function defineConstant(obj, name, value) {
    obj.__defineGetter__(name, function() { return value; });
}
function defineConstants(obj, dict) {
    for (key in dict)
        defineConstant(obj, key, dict[key]);
}

var AMF = module.exports = function( buf ) {
    this.buf = buf;
};

defineConstants(AMF, {
    AMF_NUMBER:         0,
    AMF_BOOLEAN:        1,
    AMF_STRING:         2,
    AMF_OBJECT:         3,
    AMF_MOVIECLIP:      4,
    AMF_NULL:           5,
    AMF_UNDEFINED:      6,
    AMF_REFERENCE:      7,
    AMF_ECMA_ARRAY:     8,
    AMF_OBJECT_END:     9,
    AMF_STRICT_ARRAY:   10,
    AMF_DATE:           11,
    AMF_LONG_STRING:    12,
    AMF_UNSUPPORTED:    13,
    AMF_RECORDSET:      14,
    AMF_XML_DOC:        15,
    AMF_TYPED_OBJECT:   16,
    AMF_AVMPLUS:        17,
    AMF_INVALID:        0xff
})

var normaliseType = function(data) {
    if (data instanceof AMFType)
        return data
    if (typeof data == 'string')
        return new AMFString(data)
    if (typeof data == 'number')
        return new AMFNumber(data)
    if (typeof data == 'object')
        return new AMFObject(data)
    if (typeof data == 'boolean')
        return new AMFBoolean(data)
    throw new Error("No mapping to AMF type (type: " + typeof data + ")");
}

var AMFType = function() {}
var AMFNumber = function(data) {
    if (data) {
        if (typeof data == "number")
            this.value = data;
        else
            throw new Error("ArgumentError: Argument must be a number");
    }
}
util.inherits(AMFNumber, AMFType);
defineConstant(AMFNumber.prototype, 'type', AMF.AMF_NUMBER)
AMFNumber.prototype.__defineGetter__('byteLength', function() {
    return 8;
})
AMFNumber.prototype.read = function(buf) {
    return (this.value = buf.readDoubleBE(0));
}
AMFNumber.prototype.write = function(buf) {
    buf.writeDoubleBE(this.value, 0);
}
var AMFBoolean = function(data) {
    if (data !== undefined) {
        if (typeof data == "boolean")
            this.value = data;
        else
            throw new Error("ArgumentError: Argument must be a boolean");
    }
}
util.inherits(AMFBoolean, AMFType);
defineConstant(AMFBoolean.prototype, 'type', AMF.AMF_BOOLEAN)
AMFBoolean.prototype.__defineGetter__('byteLength', function() {
    return 1;
})
AMFBoolean.prototype.read = function(buf) {
    return (this.value = Boolean(buf.readUInt8(0)));
}
AMFBoolean.prototype.write = function(buf) {
    buf.writeUInt8(Number(this.value), 0);
}
var AMFString = function(data) {
    if (data) {
        if (typeof data == "string")
            this.value = data;
        else
            throw new Error("ArgumentError: Argument must be a string")
    }
}
util.inherits(AMFString, AMFType);
defineConstant(AMFString.prototype, 'type', AMF.AMF_STRING)
AMFString.prototype.__defineGetter__('byteLength', function() {
    return Buffer.byteLength(this.value) + 2;
})
AMFString.prototype.read = function(buf) {
    var len = buf.readUInt16BE(0);
    return (this.value = buf.toString('utf8', 2, 2+len));
}
AMFString.prototype.write = function(buf) {
    buf.writeUInt16BE(Buffer.byteLength(this.value), 0);
    buf.write(this.value, 2);
}
var AMFObject = function(data) {
    if (data) {
        if (typeof data == "object")
            this.value = data
        else
            throw new Error("ArgumentError: Argument must be a object")
    }
}
util.inherits(AMFObject, AMFType);
defineConstant(AMFObject.prototype, 'type', AMF.AMF_OBJECT)
AMFObject.prototype.__defineGetter__('byteLength', function() {
    var byteLength = 0;
    for (var k in this.value) {
        if (!this.value.hasOwnProperty(k)) continue;
        var type = normaliseType(this.value[k]);
        byteLength += 2;                    // 2 byte key length 
        byteLength += Buffer.byteLength(k); // key name byte length
        byteLength++;                       // 1 byte type id
        byteLength += type.byteLength;      // type length
    }
    byteLength += 3; // 3 byte object end marker
    return byteLength;
})
AMFObject.prototype.read = function(buf) {
    var offset = 0;
    this.value = {};
    while(buf.readUInt16BE(offset) !== 0 && buf.readUInt8(offset+2) != AMF.AMF_OBJECT_END) {
        var keyLen = buf.readUInt16BE(offset);
        offset += 2;
        var key = buf.toString('utf8', offset, offset += keyLen);
        var des = new AMF.AMFDeserialiser(buf.slice(offset));
        var data = des.getType();
        this.value[key] = data;
        offset += des.byteLength;
    }
    return this.value;
}
AMFObject.prototype.write = function(buf) {
    var offset = 0;
    for (var k in this.value) {
        if (!this.value.hasOwnProperty(k)) continue;
        buf.writeUInt16BE(Buffer.byteLength(k), offset);
        offset += 2;
        buf.write(k, offset);
        offset += Buffer.byteLength(k);
        var ser = new AMF.AMFSerialiser(this.value[k]);
        ser.write(buf.slice(offset, offset += ser.byteLength));
    }
    buf.writeUInt16BE(0, offset);
    offset += 2;
    buf.writeUInt8(AMF.AMF_OBJECT_END, offset);
}
var AMFNull = function() {
    this.value = null;
}
util.inherits(AMFNull, AMFType);
defineConstant(AMFNull.prototype, 'type', AMF.AMF_NULL)
AMFNull.prototype.__defineGetter__('byteLength', function() {
    return 0;
})
AMFNull.prototype.read = function() {
    return null;
}
AMFNull.prototype.write = function() {}

var amfTypeMap = {}
    amfTypeMap[AMF.AMF_NUMBER]=AMFNumber;
    amfTypeMap[AMF.AMF_BOOLEAN]=AMFBoolean;
    amfTypeMap[AMF.AMF_STRING]=AMFString;
    amfTypeMap[AMF.AMF_OBJECT]=AMFObject;
    amfTypeMap[AMF.AMF_NULL]=AMFNull;

AMF.AMFSerialiser = function(data) {
    this.value = data;
}
AMF.AMFSerialiser.prototype.__defineGetter__('byteLength', function() {
    var type = normaliseType(this.value)
    return type.byteLength + 1; // +1 for type marker
})
AMF.AMFSerialiser.prototype.write = function(buf) {
    ///if (!buf)
    ///    buf = new Buffer(this.byteLength)
    var type = normaliseType(this.value)

    // write type marker
    buf.writeUInt8(type.type, 0);
    type.write(buf.slice(1));
    ///return buf;
}

AMF.AMFDeserialiser = function(buf) {
    this.buf = buf;
}
AMF.AMFDeserialiser.prototype.__defineGetter__('byteLength', function() {
    return this.getType().byteLength + 1; // +1 for type marker
})
AMF.AMFDeserialiser.prototype.getType = function() {
    var typeMarker = this.buf.readUInt8(0);
    if (!amfTypeMap.hasOwnProperty(typeMarker))
        throw new Error("Undecodable type: " + typeMarker);
    var type = new amfTypeMap[typeMarker]();
    type.read(this.buf.slice(1));
    return type;
}
AMF.AMFDeserialiser.prototype.read = function() {
    return this.getType().value;
}

/** old **/

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