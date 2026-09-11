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
      socket.on("live:frame", (data: { frame: string; cursor?: { x: number; y: number }; activeWindow?: string }) => {
        const employeeId = user.employeeId;
        if (!employeeId) return;
        const payload = { 
          employeeId, 
          frame: data.frame, 
          cursor: data.cursor || { x: 0, y: 0 }, 
          activeWindow: data.activeWindow || "Desktop Workspace",
          timestamp: Date.now() 
        };
        const adminRoom = `admin:${employeeId}`;
        ns.to(adminRoom).emit("live:frame", payload);
        ns.to("admin:all").emit("live:frame", payload);
        if (ns !== io) {
          io.to(adminRoom).emit("live:frame", payload);
          io.to("admin:all").emit("live:frame", payload);
        }
      });

      // Admin side: join a room for a specific employee
      socket.on("watch:employee", (employeeId: string) => {
        if (!employeeId) return;
        const room = `admin:${employeeId}`;
        socket.join(room);
      });

      // Admin side: watch all active employees simultaneously
      socket.on("watch:all", () => {
        socket.join("admin:all");
      });

      socket.on("disconnect", () => {
        // Rooms are auto-managed by Socket.io
      });
    });
  };

  attachHandlers(io.of("/live"));
  attachHandlers(io);
};
