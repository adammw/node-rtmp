var net = require('net'),
    events = require('events'),
    util = require('util'),
    os = require('os');

require('buffertools'); // used for Buffer.compare

const RTMP_SIG_SIZE = 1536;

function defineConstant(obj, name, value) {
    obj.__defineGetter__(name, function() { return value; });
}
function defineConstants(obj, dict) {
    for (key in dict)
        defineConstant(obj, key, dict[key]);
}

var S0Chunk = function(buffer) {
    if (buffer && buffer instanceof Buffer) {
        this.buffer = buffer.slice(0, S0Chunk.byteLength);
    } else {
        this.buffer = new Buffer(S0Chunk.byteLength);
        this.setDefaults();
    }
}
defineConstant(S0Chunk, 'byteLength', 1);
S0Chunk.prototype.isValid = function() {
    return (this.version == 0x03);
}
S0Chunk.prototype.__defineGetter__('version', function() {
    return this.buffer.readUInt8(0);
});
S0Chunk.prototype.__defineSetter__('version', function(version) {
    this.buffer.writeUInt8(version, 0);
});
S0Chunk.prototype.setDefaults = function() {
    this.version = 0x03;
}
var C0Chunk = S0Chunk;

var S1Chunk = function(buffer) {
    if (buffer && buffer instanceof Buffer) {
        this.buffer = buffer.slice(0, S1Chunk.byteLength);
    } else {
        this.buffer = new Buffer(S1Chunk.byteLength);
        this.setDefaults();
    }
}
defineConstant(S1Chunk, 'byteLength', RTMP_SIG_SIZE);
S1Chunk.prototype.__defineGetter__('time', function() {
    return this.buffer.readUInt32BE(0);
});
S1Chunk.prototype.__defineSetter__('time', function(time) {
    this.buffer.writeUInt32BE(time, 0);
});
S1Chunk.prototype.__defineGetter__('fmsVersion', function() {
    if (this.zeros == 0) return null;
    return this.buffer.readUInt8(4) + '.' + this.buffer.readUInt8(5) + '.' + this.buffer.readUInt8(6) + '.' + this.buffer.readUInt8(7);
});
S1Chunk.prototype.__defineGetter__('zeros', function() {
    return this.buffer.readUInt32BE(4);
});
S1Chunk.prototype.__defineSetter__('zeros', function(zeros) {
    this.buffer.writeUInt32BE(zeros, 4);
});
S1Chunk.prototype.__defineGetter__('random', function() {
    return this.buffer.slice(8);
});
S1Chunk.prototype.__defineSetter__('random', function(buffer) {
    if (buffer instanceof Buffer)
        buffer.copy(this.buffer, 8, 0, 1528);
    else if (typeof buffer == 'number')
        this.buffer.fill(buffer, 8, S1Chunk.byteLength);
    else
        throw new Error("ArgumentError");
});
S1Chunk.prototype.isValid = function() {
    // check for all zeros (bytes 4-7)
    // (note that typically this ends up making most packets invalid as they specify the version of FMS here)
    // TODO: perhaps loosen restriction and/or check fms version is valid?
    return (this.zeros == 0);
};
S1Chunk.prototype.setDefaults = function() {
    this.time = os.uptime() * 1000;
    this.zeros = 0x00;
    this.random = 0xff;
}
var C1Chunk = S1Chunk;

var S2Chunk = function(buffer) {
    if (buffer && buffer instanceof Buffer) {
        this.buffer = buffer.slice(0, S2Chunk.byteLength);
    } else {
        this.buffer = new Buffer(S2Chunk.byteLength);
        this.setDefaults();
    }
}
defineConstant(S2Chunk, 'byteLength', RTMP_SIG_SIZE);
S2Chunk.prototype.__defineGetter__('time', function() {
    return this.buffer.readUInt32BE(0);
});
S2Chunk.prototype.__defineSetter__('time', function(time) {
    this.buffer.writeUInt32BE(time, 0);
});
S2Chunk.prototype.__defineGetter__('time2', function() {
    return this.buffer.readUInt32BE(4);
});
S2Chunk.prototype.__defineSetter__('time2', function(time2) {
    this.buffer.writeUInt32BE(time2, 4);
});
S2Chunk.prototype.__defineGetter__('random', function() {
    return this.buffer.slice(8);
});
S2Chunk.prototype.__defineSetter__('random', function(buffer) {
    if (buffer instanceof Buffer)
        buffer.copy(this.buffer, 8, 0, 1528);
    else if (typeof buffer == 'number')
        this.buffer.fill(buffer, 8, S1Chunk.byteLength);
    else
        throw new Error("ArgumentError");
});
S2Chunk.prototype.isValid = function(c1chunk) {
    // Compare the recieved chunk with the sent chunk's time and random value
    return (this.time == c1chunk.time && this.random.compare(c1chunk.random) == 0);
}
S2Chunk.prototype.setDefaults = function(c1chunk) {
    this.time2 = os.uptime() * 1000;
}
S2Chunk.prototype.copyFromS1 = S2Chunk.prototype.copyFromC1 = function(c1chunk) {
    this.time = c1chunk.time;
    this.random = c1chunk.random;
}
var C2Chunk = S2Chunk;


var RTMPHandshake = module.exports = function(client) {
    events.EventEmitter.call(this);
    if (client instanceof net.Socket) {
        this.socket = client;
    } else if (typeof client == "object" && client.socket instanceof net.Socket) {
        this.socket = client.socket;
    } else {
        throw new Error("Invalid arguments, requires RTMPClient or net.Socket");
    }
    this.socket.on('data', this.onResponse.bind(this));
    this.state = RTMPHandshake.STATE_UNINITIALIZED;
};
util.inherits(RTMPHandshake, events.EventEmitter);
defineConstants(RTMPHandshake, {
    STATE_UNINITIALIZED: 0,
    STATE_VERSION_SENT: 1,
    STATE_ACK_SENT: 2,
    STATE_HANDSHAKE_DONE: 3
})
//TODO: sendServerHandshake
RTMPHandshake.prototype.sendClientHandshake = function() {
    this.sendC0C1();
    this.on('s1recieved', function() {
        this.sendC2();

        /* Change to ACK_SENT state */
        this.state = RTMPHandshake.STATE_ACK_SENT;
        this.emit('stateChange');
    });
};
RTMPHandshake.prototype.sendC0C1 = function() {
    /* Create temporary buffer for both */
    var handshakeBuf = new Buffer(C0Chunk.byteLength + C1Chunk.byteLength);

    /* C0 Handshake Chunk */
    this.c0chunk = new C0Chunk(handshakeBuf);
    this.c0chunk.setDefaults();

    /* C1 Handshake Chunk */
    this.c1chunk = new C1Chunk(handshakeBuf.slice(C0Chunk.byteLength));
    this.c1chunk.setDefaults();
    
    /* Send C0 + C1 */
    this.socket.write(handshakeBuf);

    /* Change to VERSION_SENT state */
    this.state = RTMPHandshake.STATE_VERSION_SENT;
    this.emit('stateChange');
};
RTMPHandshake.prototype.sendC2 = function() {
    this.c2chunk = new C2Chunk();
    this.c2chunk.copyFromS1(this.s1chunk);
    this.socket.write(this.c2chunk.buffer);
};
RTMPHandshake.prototype.onResponse = function(chunk) {
    if (this.remainingChunk && this.remainingChunk.length) {
        chunk = Buffer.concat([this.remainingChunk, chunk], this.remainingChunk.length + chunk.length)
    }

    if (!this.s0chunk && chunk.length >= S0Chunk.byteLength) {
        this.s0chunk = new S0Chunk(chunk);
        chunk = chunk.slice(S0Chunk.byteLength);
        if (!this.s0chunk.isValid())
            this.emit('error', 's0 invalid');
        this.emit('s0recieved', this.s0chunk);
    }
    if (!this.s1chunk && chunk.length >= S1Chunk.byteLength) {
        this.s1chunk = new S1Chunk(chunk);
        chunk = chunk.slice(S1Chunk.byteLength);
        if (!this.s1chunk.isValid())
            this.emit('error', 's1 invalid');
        this.emit('s1recieved', this.s1chunk);
    }
    if (!this.s2chunk && chunk.length >= S2Chunk.byteLength) {
        this.s2chunk = new S2Chunk(chunk);
        chunk = chunk.slice(S2Chunk.byteLength);
        if (!this.s2chunk.isValid(this.c1chunk)) 
            this.emit('error', 's2 invalid');
        this.emit('s2recieved', this.s2chunk);

        /* Change to HANDSHAKE_DONE state */
        this.state = RTMPHandshake.STATE_HANDSHAKE_DONE;
        this.emit('stateChange');
        this.emit('complete');
        
        /* Emit any left over data */
        this.emit('data', chunk);

        /* Clean up */
        this.socket.removeListener('data', this.onResponse.bind(this)); //TODO: test this actually removes the listener (not sure?)
        this.remainingChunk = null;
    }

    this.remainingChunk = chunk;
}