var RTMPClient = require('./client');
var RTMPPacket = require('./packet');

var rtmp = RTMPClient.connect('cp98428.edgefcs.net', function() {
	console.log("connected!");
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
});
rtmp.on('message', function(message) {
    console.log("GOT RTMP MESSAGE!", "Type:",message.messageHeader.messageType, message.data);
});