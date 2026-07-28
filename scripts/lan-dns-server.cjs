const dgram = require('dgram');
const net = require('net');
const dnsPacket = require('dns-packet');

const DOMAIN = 'millennium.com';
const PORT = parseInt(process.env.DNS_PORT, 10) || 53;
const UPSTREAM = process.env.DNS_UPSTREAM || '8.8.8.8';

const LAN_IP = process.argv[2];
if (!LAN_IP) {
  console.error('Uso: node scripts/lan-dns-server.cjs <LAN_IP>');
  console.error('Ex.:  node scripts/lan-dns-server.cjs 192.168.100.155');
  process.exit(1);
}

function forwardQuery(query, cb) {
  const client = dgram.createSocket('udp4');
  client.send(query, 0, query.length, 53, UPSTREAM, (err) => {
    if (err) { client.close(); return cb(err); }
    client.once('message', (msg) => {
      client.close();
      cb(null, msg);
    });
    client.once('error', (e) => { client.close(); cb(e); });
    setTimeout(() => { client.close(); cb(new Error('timeout')); }, 5000);
  });
}

const server = dgram.createSocket('udp4');

server.on('message', (msg, rinfo) => {
  let request;
  try { request = dnsPacket.decode(msg); } catch { return; }

  if (request.type !== 'query') return;

  const questions = request.questions || [];
  const localAnswers = [];

  for (const q of questions) {
    const name = q.name?.toLowerCase() ?? '';
    if (q.type === 'A' && (name === DOMAIN || name.endsWith('.' + DOMAIN))) {
      localAnswers.push({
        name: q.name,
        type: 'A',
        ttl: 60,
        data: LAN_IP,
      });
    }
  }

  if (localAnswers.length > 0) {
    const response = dnsPacket.encode({
      type: 'response',
      id: request.id,
      flags: dnsPacket.RECURSION_DESIRED,
      questions,
      answers: localAnswers,
    });
    server.send(response, rinfo.port, rinfo.address);
    return;
  }

  forwardQuery(msg, (err, upstreamMsg) => {
    if (err) {
      const response = dnsPacket.encode({
        type: 'response',
        id: request.id,
        flags: dnsPacket.RECURSION_DESIRED | dnsPacket.SERVFAIL,
        questions,
        answers: [],
      });
      server.send(response, rinfo.port, rinfo.address);
      return;
    }
    server.send(upstreamMsg, rinfo.port, rinfo.address);
  });
});

server.on('listening', () => {
  const addr = server.address();
  console.log(`millennium.com -> ${LAN_IP}:3030`);
  console.log(`DNS rodando em ${addr.address}:${addr.port}`);
  console.log(`Upstream DNS: ${UPSTREAM}:53`);
});

server.on('error', (err) => {
  console.error('DNS server error:', err.message);
  process.exit(1);
});

server.bind(PORT, '0.0.0.0');
