import { Server as SocketIOServer } from "socket.io";
import jwt from "jsonwebtoken";
import { appConfig } from "../config/app.config";

/**
 * Initialise live streaming socket handlers.
 * Supports both `/live` namespace and root namespace for seamless client compatibility.
 *
 *   - Employees emit `live:frame` with { frame: string (dataURL), cursor: {x:number,y:number}, activeWindow?: string }
 *   - Admins emit `watch:employee` with employeeId to join a room receiving that employee's frames.
 *   - Server forwards frames to the corresponding admin room.
 */
export const initLiveSocket = (io: SocketIOServer) => {
  const attachHandlers = (ns: any) => {
    // JWT authentication for every socket connection
    ns.use((socket: any, next: any) => {
      const token =
        (socket.handshake.auth && socket.handshake.auth.token) ||
        (socket.handshake.headers.authorization && socket.handshake.headers.authorization.split(" ")[1]);
      if (!token) {
        return next(new Error("Authentication error: missing token"));
      }
      try {
        const payload: any = jwt.verify(token, appConfig.jwtSecret);
        socket.data.user = payload;
        next();
      } catch (err) {
        return next(new Error("Authentication error: invalid token"));
      }
    });

    ns.on("connection", (socket: any) => {
      const user = socket.data.user as any;
      if (!user) {
        socket.disconnect();
        return;
      }

      // Employee side: send live frame
      socket.on("live:frame", (data: { frame: string; cursor: { x: number; y: number }; activeWindow?: string }) => {
        const employeeId = user.employeeId;
        if (!employeeId) return;
        const adminRoom = `admin:${employeeId}`;
        ns.to(adminRoom).emit("live:frame", { employeeId, ...data });
        if (ns !== io) {
          io.to(adminRoom).emit("live:frame", { employeeId, ...data });
        }
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

  attachHandlers(io.of("/live"));
  attachHandlers(io);
};
