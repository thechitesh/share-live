export type RoomStatus = 'CREATED' | 'LIVE' | 'ENDED';

export interface Room {
  roomId: string;
  hostId: string;
  hostName: string;
  status: RoomStatus;
  createdAt: Date;
  startedAt?: Date;
  endedAt?: Date;
  viewerIds: Set<string>;
  cleanupTimeout?: ReturnType<typeof setTimeout>;
  hostReconnectionTimeout?: ReturnType<typeof setTimeout>;
}

const rooms = new Map<string, Room>();

export function createRoom(roomId: string, hostId: string, hostName: string): Room {
  const room: Room = {
    roomId,
    hostId,
    hostName,
    status: 'CREATED',
    createdAt: new Date(),
    viewerIds: new Set(),
  };
  rooms.set(roomId, room);
  console.log(`[RoomManager] Room created: ${roomId} by ${hostName}`);
  return room;
}

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

export function setRoomLive(roomId: string): Room | undefined {
  const room = rooms.get(roomId);
  if (!room) return undefined;
  room.status = 'LIVE';
  room.startedAt = new Date();
  console.log(`[RoomManager] Room LIVE: ${roomId}`);
  return room;
}

export function endRoom(roomId: string): Room | undefined {
  const room = rooms.get(roomId);
  if (!room) return undefined;
  room.status = 'ENDED';
  room.endedAt = new Date();

  // Clean up after 5 minutes
  room.cleanupTimeout = setTimeout(() => {
    rooms.delete(roomId);
    console.log(`[RoomManager] Room cleaned up: ${roomId}`);
  }, 5 * 60 * 1000);

  console.log(`[RoomManager] Room ENDED: ${roomId}`);
  return room;
}

export function addViewer(roomId: string, viewerId: string): boolean {
  const room = rooms.get(roomId);
  if (!room) return false;
  if (room.viewerIds.size >= 10) return false; // max 10 viewers
  room.viewerIds.add(viewerId);
  return true;
}

export function removeViewer(roomId: string, viewerId: string): void {
  const room = rooms.get(roomId);
  if (!room) return;
  room.viewerIds.delete(viewerId);
}

export function getViewerCount(roomId: string): number {
  const room = rooms.get(roomId);
  return room ? room.viewerIds.size : 0;
}

export function getRoomMetadata(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) return null;
  return {
    roomId: room.roomId,
    hostName: room.hostName,
    status: room.status,
    createdAt: room.createdAt,
    startedAt: room.startedAt,
    viewerCount: room.viewerIds.size,
  };
}

export function getAllRooms() {
  return Array.from(rooms.values()).map(room => getRoomMetadata(room.roomId));
}
