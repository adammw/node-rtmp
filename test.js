var AMF = require('./amf');
var RTMPClient = require('./client');
var RTMPPacket = require('./packet');
var RTMPMessage = require('./message');

var rtmp = RTMPClient.connect('cp98428.edgefcs.net', function() {
	console.log("connected!");

    // TODO: replace RTMPPacket with RTMPChunk/RTMPMessage-based alternative
	var packet = new RTMPPacket();
	packet.header.channel = 0x03;
	packet.header.headerType = RTMPPacket.RTMP_PACKET_SIZE_LARGE;
	packet.header.packetType = RTMPPacket.RTMP_PACKET_TYPE_INVOKE;
	packet.body.push("connect");
	packet.body.push(1); //numInvokes
	packet.body.push({
	    app: "ondemand?auth=daEaparbYcMbbaOd0cMdHavcvdja3a8c0bB-bpctkg-vga-Jxt&slist=vod/&aifp=vod",
	    flashVer: "MAC 10,0,32,18",
	    tcUrl: "rtmp://cp98428.edgefcs.net:1935/ondemand?auth=daEaparbYcMbbaOd0cMdHavcvdja3a8c0bB-bpctkg-vga-Jxt&slist=vod/&aifp=vod",
	    fpad: false,
	    capabilities: 15.0,
	    audioCodecs: 3191.0,
	    videoCodecs: 252.0,
	    videoFunction: 1.0,
	});
	rtmp.sendPacket(packet);

    /*var s1 = new AMF.AMFSerialiser("connect");
    var s2 = new AMF.AMFSerialiser(1);
    var s3 = new AMF.AMFSerialiser({
        app: "ondemand?auth=daEaparbYcMbbaOd0cMdHavcvdja3a8c0bB-bpctkg-vga-Jxt&slist=vod/&aifp=vod",
        flashVer: "MAC 10,0,32,18",
        tcUrl: "rtmp://cp98428.edgefcs.net:1935/ondemand?auth=daEaparbYcMbbaOd0cMdHavcvdja3a8c0bB-bpctkg-vga-Jxt&slist=vod/&aifp=vod",
        fpad: false,
        capabilities: 15.0,
        audioCodecs: 3191.0,
        videoCodecs: 252.0,
        videoFunction: 1.0,
    });
    var buf = new Buffer(s1.byteLength + s2.byteLength + s3.byteLength);
    s1.write(buf.slice(0,s1.byteLength));
    s2.write(buf.slice(s1.byteLength,s1.byteLength + s2.byteLength));
    s3.write(buf.slice(s1.byteLength + s2.byteLength));

    var message = new RTMPMessage();
    message.sendData(buf);*/
});
/*rtmp.on('message', function(message) {
    console.log("RTMP MESSAGE", "Type:",message.messageHeader.messageType);
});*/
rtmp.on('error', function(args) {
    console.log("RTMP ERROR", args);
});
rtmp.on('close', function(args) {
    console.log("RTMP connection closed");
});