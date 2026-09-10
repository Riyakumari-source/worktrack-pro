import { Server as SocketIOServer } from "socket.io";
import jwt from "jsonwebtoken";
import { appConfig } from "../config/app.config";

/**
 * Initialise live streaming socket handlers.
 *
 * Namespace: /live
 *   - Employees emit `live:frame` with { frame: string (dataURL), cursor: {x:number,y:number}, activeWindow?: string }
 *   - Admins emit `watch:employee` with employeeId to join a room receiving that employee's frames.
 *   - Server forwards frames to the corresponding admin room.
 */
export const initLiveSocket = (io: SocketIOServer) => {
  const liveNs = io.of("/live");

  // JWT authentication for every socket connection
  liveNs.use((socket, next) => {
    const token =
      (socket.handshake.auth && socket.handshake.auth.token) ||
      (socket.handshake.headers.authorization && socket.handshake.headers.authorization.split(" ")[1]);
    if (!token) {
      return next(new Error("Authentication error: missing token"));
    }
    try {
      const payload: any = jwt.verify(token, appConfig.jwtSecret);
      // Attach user info to socket for later use
      socket.data.user = payload;
      next();
    } catch (err) {
      return next(new Error("Authentication error: invalid token"));
    }
  });

  liveNs.on("connection", (socket) => {
    const user = socket.data.user as any;
    if (!user) {
      socket.disconnect();
      return;
    }

    // Employee side: send live frame
    socket.on("live:frame", (data: { frame: string; cursor: { x: number; y: number }; activeWindow?: string }) => {
      const employeeId = user.employeeId; // assume JWT contains employeeId
      if (!employeeId) return;
      const adminRoom = `admin:${employeeId}`;
      // Broadcast to all admins watching this employee
      liveNs.to(adminRoom).emit("live:frame", { employeeId, ...data });
    });

    // Admin side: join a room for a specific employee
    socket.on("watch:employee", (employeeId: string) => {
      if (!employeeId) return;
      const room = `admin:${employeeId}`;
      socket.join(room);
    });

    socket.on("disconnect", () => {
      // No special cleanup needed – rooms are auto-managed by Socket.io
    });
  });
};
