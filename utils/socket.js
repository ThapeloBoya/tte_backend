let io;

const initSocket = (serverIo) => {
  io = serverIo;
};

const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
};

module.exports = { initSocket, getIO };