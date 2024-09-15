import { Caster, PartCache, HighFidelityBehavior, ActiveCast } from "@rbxts/nextcast";
import { ReplicatedStorage, Workspace, Players } from "@rbxts/services";
import { Events } from "server/network";

interface UserData {
	UserID: number;
	TargetID: number | unknown;
	User_Team: Team;
	UUID: number;
}
const WeaponSystemEffectsFolder = ReplicatedStorage.WaitForChild("Effects").WaitForChild("WeaponSystem") as Folder;
const GunsFolder = WeaponSystemEffectsFolder.WaitForChild("Guns") as Folder;
const BulletTemplate = GunsFolder.WaitForChild("BalaNormal") as BasePart;
const BulletCacheFolder = Workspace.WaitForChild("BulletCache") as Folder;

const BulletCache = new PartCache(BulletTemplate.Clone(), 100, BulletCacheFolder);
const NextCastCaster = new Caster<UserData>();

const CastBehavior = Caster.newBehavior();
CastBehavior.CosmeticBulletProvider = BulletCache;
CastBehavior.CosmeticBulletContainer = Workspace;
CastBehavior.Acceleration = Vector3.zero;
CastBehavior.AutoIgnoreContainer = false;
CastBehavior.SphereSize = 0;

Events.fireBullet.connect((player, origin, direction, bulletSpeed, max_range) => {
	print(`[SERVER] Received fireBullet event from player: ${player.Name}`);

	CastBehavior.MaxDistance = max_range;

	const simBullet = NextCastCaster.Fire(origin, direction, bulletSpeed, CastBehavior);
	print("[SERVER] Bullet fired!");

	simBullet.Caster.LengthChanged.Connect(
		(
			cast: ActiveCast<UserData>,
			lastPoint: Vector3,
			rayDirection: Vector3,
			segmentLength: number,
			segmentVelocity: Vector3,
			cosmeticBulletObject?: BasePart,
		) => {
			if (cosmeticBulletObject) {
				cosmeticBulletObject.CFrame = new CFrame(lastPoint, lastPoint.add(rayDirection));
			}
		},
	);

	simBullet.Caster.RayHit.Connect((cast, result) => {
		const cosmeticBullet = cast.RayInfo.CosmeticBulletObject as BasePart;
		if (cosmeticBullet) {
			BulletCache?.ReturnPart(cosmeticBullet);
		}
	});

	simBullet.Caster.CastTerminating.Connect(() => {
		const cosmeticBullet = CastBehavior.CosmeticBulletProvider?.GetPart();
		if (cosmeticBullet) {
			BulletCache?.ReturnPart(cosmeticBullet);
		}
	});
});
