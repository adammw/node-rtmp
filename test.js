var AMF = require('./amf');
var RTMPClient = require('./client');
var RTMPPacket = require('./packet');
var RTMPMessage = require('./message');

// NEXT THING TO DO:
// abstract away the commandName/transactionId/commandObj details currently in RTMPMessage
// into RTMPCommand / RTMPPacket / RTMPInvokePacket or something like that
// I guess client should then have two methods, 
//   1. sendPacket or sendData (not sure of name) that sends a rtmpmessage with the channel, messageType and raw data specified
// and 2. sendInvoke that takes in commandName, transactionId, commandObj, arguments; generates the AMF for it; then calls sendPacket above with channel 0x03 (?? fixed or next available channel?) and RTMP_MESSAGE_TYPE_INVOKE

var rtmp = RTMPClient.connect('cp98428.edgefcs.net', function() {
	console.log("connected!");

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

    rtmp.sendPacket(0x03, RTMPMessage.RTMP_MESSAGE_TYPE_INVOKE, buf);
    */

    rtmp.sendInvoke("connect", 1, {
        app: "ondemand?auth=daEaparbYcMbbaOd0cMdHavcvdja3a8c0bB-bpctkg-vga-Jxt&slist=vod/&aifp=vod",
        flashVer: "MAC 10,0,32,18",
        tcUrl: "rtmp://cp98428.edgefcs.net:1935/ondemand?auth=daEaparbYcMbbaOd0cMdHavcvdja3a8c0bB-bpctkg-vga-Jxt&slist=vod/&aifp=vod",
        fpad: false,
        capabilities: 15.0,
        audioCodecs: 3191.0,
        videoCodecs: 252.0,
        videoFunction: 1.0,
    });

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