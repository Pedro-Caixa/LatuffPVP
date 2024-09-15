import { Networking } from "@flamework/networking";

interface ClientToServerEvents {
	fireBullet(origin: Vector3, direction: Vector3, bulletSpeed: number, max_range: number): void;
}

interface ServerToClientEvents {
	bulletHit: (hitPosition: Vector3) => void;
}

interface ClientToServerFunctions {}

interface ServerToClientFunctions {}

export const GlobalEvents = Networking.createEvent<ClientToServerEvents, ServerToClientEvents>();
export const GlobalFunctions = Networking.createFunction<ClientToServerFunctions, ServerToClientFunctions>();

export const Events = GlobalEvents.createClient({});
