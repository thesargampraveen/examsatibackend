const Connection = require('../models/Connection');

// Annotates a list of user docs with the current user's connection status to each.
// Sets `connectionStatus`: 'none' | 'pending_sent' | 'pending_received' | 'friends'
// and `requestSent` (true when the current user has a pending outgoing request).
module.exports = async function annotateConnections(userId, users) {
  if (!users.length) return;
  const ids = users.map((u) => u._id);
  const conns = await Connection.find({
    $or: [
      { requester: userId, recipient: { $in: ids } },
      { requester: { $in: ids }, recipient: userId },
    ],
  })
    .select('requester recipient status')
    .lean();

  const byOther = new Map();
  const uid = String(userId);
  for (const c of conns) {
    const outgoing = String(c.requester) === uid;
    byOther.set(String(outgoing ? c.recipient : c.requester), { status: c.status, outgoing });
  }

  for (const u of users) {
    const c = byOther.get(String(u._id));
    if (!c || c.status === 'declined') {
      u.connectionStatus = 'none';
    } else if (c.status === 'accepted') {
      u.connectionStatus = 'friends';
    } else {
      u.connectionStatus = c.outgoing ? 'pending_sent' : 'pending_received';
    }
    u.requestSent = u.connectionStatus === 'pending_sent';
  }
};
