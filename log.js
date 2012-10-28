var BP_OFFSET = exports.BP_OFFSET = 9;
var BP_GRAPH = exports.BP_GRAPH = 60;
var BP_LEN = exports.BP_LEN = 80;

var hexdig = "0123456789abcdef";

var isprint = function( c ) {
    return (c > 0x1f && c < 0x7f);
}

var log = module.exports = function() {
    console.log.apply(null, arguments);
}

log.warn = function() {
    console.warn.apply(null, arguments);
}

log.logHex = function( data ) {
    var line = new Buffer(BP_LEN);
    for (var i = 0; i < data.length; i++) {
        var n = i % 16;
        var off;
        if ( !n ) {
            if ( i ) process.stdout.write(line.toString()+"\n");
            line.fill(' ');
            
            off = i % 0x0ffff;
            
            line[2] = hexdig[0x0f & (off >> 12)].charCodeAt();
            line[3] = hexdig[0x0f & (off >> 8)].charCodeAt();
            line[4] = hexdig[0x0f & (off >> 4)].charCodeAt();
            line[5] = hexdig[0x0f & off].charCodeAt();
            line[6] = ':'.charCodeAt();
        }
        
        off = BP_OFFSET + n*3 + ((n >= 8)?1:0);
		line[off] = hexdig[0x0f & ( data[i] >> 4 )].charCodeAt();
		line[off+1] = hexdig[0x0f & data[i]].charCodeAt();

		off = BP_GRAPH + n + ((n >= 8)?1:0);

		if ( isprint( data[i] )) {
			line[BP_GRAPH + n + ((n >= 8)?1:0)] = data[i];
		} else {
			line[BP_GRAPH + n + ((n >= 8)?1:0)] = '.'.charCodeAt();
		}
    }
    process.stdout.write(line.toString()+"\n");
}