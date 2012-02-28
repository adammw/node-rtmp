var net = require('net'),
    os = require('os'),
    RTMPPacket = require('./packet');
    
const RTMP_SIG_SIZE = 1536;

var socket = net.connect(1935, 'cp98428.edgefcs.net', function() {
    console.log('tcp socket connected');
    
    // HandShake
    var clientbuf = new Buffer(RTMP_SIG_SIZE + 1);
    var clientsig = clientbuf.slice(1);
    clientbuf[0] = 0x03;		/* not encrypted */
    
    var uptime = new Buffer(4);
    uptime.writeUInt32BE(os.uptime() * 1000, 0);
    uptime.copy(clientsig);
    clientsig.fill(0, 0, 8);
    //clientsig.fill(0, 4, 4+4);
    
    clientsig.fill(0xff, 8);
    //for (var i = 8; i < RTMP_SIG_SIZE; i++)
    //    clientsig[i] = (Math.random() * 0xff);
    
    socket.write(clientbuf);
        
    
    var type = null;
    var serversig = new Buffer(RTMP_SIG_SIZE);
    var bytesread = 0;
    var bytesremaining = serversig.length;
    var serverHandshakeRecv = false;
    
    socket.on('data', function(serverbuf) {
        console.log('recieved data: ', serverbuf);
        var offset = 0;
        if (!type) {
            type = serverbuf.readUInt8(0);
            console.log("Type Answer:", type);
            
            if (type != clientbuf.readUInt8(0));
                console.warn("Type mismatch: client sent",clientbuf.readUInt8(0),", server answered", type);
            
            offset = 1;
        }

        var end = (serverbuf.length > bytesremaining) ? bytesremaining + offset : serverbuf.length;
        serverbuf.copy(serversig, serversig.length - bytesremaining, offset, end);
        bytesremaining -= end;
        console.log("bytes remaining: "+ bytesremaining);  
      
        if (bytesremaining == 0) {
    
            console.log('full packet!');
            
            if (!serverHandshakeRecv) {
                /* decode server response */
                console.log('serversig',serversig);
                var suptime = serversig.readUInt32BE(0);
                console.log("Server Uptime :", suptime);
                console.log("FMS Version   : "+serversig[4]+"."+serversig[5]+"."+serversig[6]+"."+serversig[7]);
                
                // send 2nd part of handshake
                socket.write(serversig);
                
                bytesremaining = RTMP_SIG_SIZE;
                serverHandshakeRecv = true;
                
                if (end < serverbuf.length) {
                    serverbuf.copy(serversig, 0, end + 1); 
                    bytesremaining -= serverbuf.length - end - 1;
                }
            } else {
                // verify 2nd part of handshake response is clientsig
                
                for (var i = 0; i < serversig.length; i++) {
                    if (serversig[i] != clientsig[i]) {
                        console.log("client signature does not match!");
                        socket.end();
                        return;
                    }
                }
                console.log("client signature matches");
                
                // SendConnectPacket
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
                var chunks = packet.serialize();
                var log = require('./log');
                socket.setNoDelay(true);
                for (var i = 1; i < chunks.length; i+= 2) {
                    log.logHex(chunks[i-1]);
                    log.logHex(chunks[i]);
                    var buf = new Buffer(chunks[i-1].length + chunks[i].length);
                    chunks[i-1].copy(buf);
                    chunks[i].copy(buf, chunks[i-1].length);
                    socket.write(buf);
                }
            }
        } else if (bytesremaining > 0) {
            console.log("waiting for full packet");
        } else {
            console.error("serversig > RTMP_SIG_SIZE");
            socket.end();
        }
    });
});