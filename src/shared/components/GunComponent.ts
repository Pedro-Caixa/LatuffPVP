import { BaseComponent, Component } from "@flamework/components";
import { OnStart } from "@flamework/core";
import { Caster, PartCache, HighFidelityBehavior, ActiveCast } from "@rbxts/nextcast";
import { ReplicatedStorage, RunService, UserInputService, Workspace } from "@rbxts/services";
import WeaponConfig from "shared/Weapon.Config.json";

interface UserData {
	UserID: number;
	TargetID: number | unknown;
	User_Team: Team;
	UUID: number;
}

interface GunAttributes {
	max_ammo: number;
	damage: number;
	headshot_damage: number;
	range: number;
	reload_time: number;
	weapon_type: string;
	shoot_delay: number;
	bullet_speed: number;
}

interface GunsConfig {
	[key: string]: GunAttributes;
}

interface Attributes {
	ammo: number;
	max_ammo: number;
	damage: number;
	headshot_damage: number;
	range: number;
	reload_time: number;
	weapon_type: string;
	shoot_delay: number;
	bullet_speed: number;
}

const Guns: GunsConfig = WeaponConfig.Guns;
const WeaponSystemEffectsFolder = ReplicatedStorage.WaitForChild("Effects").WaitForChild("WeaponSystem") as Folder;
const GunsFolder = WeaponSystemEffectsFolder.WaitForChild("Guns") as Folder;
const BulletTemplate = GunsFolder.WaitForChild("BalaNormal") as BasePart;
const BulletCacheFolder = Workspace.WaitForChild("BulletCache") as Folder;
const BULLET_GRAVITY = new Vector3(0, -Workspace.Gravity, 0);

@Component({
	defaults: {
		ammo: 10,
		max_ammo: 10,
		damage: 12,
		headshot_damage: 24,
		range: 50,
		reload_time: 2,
		weapon_type: "Semi",
		shoot_delay: 0.1,
		bullet_speed: 1000,
	},
	tag: "GunFramework",
})
export class Gun extends BaseComponent<Attributes> implements OnStart {
	private reloading = false;
	private runServiceConnection: RBXScriptConnection | undefined;
	private isMouseDown: boolean = false;
	private canFire: boolean = true;

	private BulletCache: PartCache | undefined;
	private NextCastCaster = new Caster<UserData>();
	private raycastParams: RaycastParams = new RaycastParams();
	private CastBehavior = Caster.newBehavior();

	onStart(): void {
		if (this.isTool()) {
			print("Gun component is attached to a Tool instance: " + this.instance.Name);
			const tool = this.instance as Tool;
			const gunId = tool.GetAttribute("Gun_ID") as string;

			if (gunId && Guns[gunId]) {
				const gunConfig = Guns[gunId];
				this.attributes.max_ammo = gunConfig.max_ammo;
				this.attributes.ammo = gunConfig.max_ammo;
				this.attributes.damage = gunConfig.damage;
				this.attributes.headshot_damage = gunConfig.headshot_damage;
				this.attributes.range = gunConfig.range;
				this.attributes.reload_time = gunConfig.reload_time;
				this.attributes.weapon_type = gunConfig.weapon_type;
				this.attributes.shoot_delay = gunConfig.shoot_delay;
				this.attributes.bullet_speed = gunConfig.bullet_speed;
				//this.attributes.Sounds = gunConfig.Sounds;
				print(`Gun configuration loaded for ${gunId}`);
			} else {
				warn(`No configuration found for Gun_ID: ${gunId}`);
			}

			this.NextCastCaster = new Caster<UserData>();

			const CastParams = new RaycastParams();
			CastParams.IgnoreWater = true;
			CastParams.FilterType = Enum.RaycastFilterType.Exclude;
			CastParams.FilterDescendantsInstances = [];

			this.CastBehavior = Caster.newBehavior();
			this.CastBehavior.RaycastParams = CastParams;
			this.CastBehavior.MaxDistance = this.attributes.range;
			this.CastBehavior.HighFidelityBehavior = HighFidelityBehavior.Default;

			this.BulletCache = new PartCache(BulletTemplate.Clone(), 100, BulletCacheFolder);

			this.CastBehavior.CosmeticBulletProvider = this.BulletCache;

			this.CastBehavior.CosmeticBulletContainer = game.GetService("Workspace");
			this.CastBehavior.Acceleration = Vector3.zero;
			this.CastBehavior.AutoIgnoreContainer = false;
			this.CastBehavior.SphereSize = 0;

			this.configureInputService();

			tool.Equipped.Connect(() => {
				this.startMonitoringInput();
			});

			tool.Unequipped.Connect(() => {
				this.stopMonitoringInput();
			});
			this.NextCastCaster.RayHit.Connect((cast, result) => {
				const cosmeticBullet = cast.RayInfo.CosmeticBulletObject as BasePart;
				if (cosmeticBullet) {
					this.BulletCache?.ReturnPart(cosmeticBullet);
				}
			});
		} else {
			warn("Gun component is not attached to a Tool instance.");
		}
	}

	private configureInputService(): void {
		UserInputService.InputBegan.Connect((input, gameProcessed) => {
			if (input.UserInputType === Enum.UserInputType.MouseButton1) {
				this.isMouseDown = true;
			} else if (input.UserInputType === Enum.UserInputType.Keyboard) {
				if (input.KeyCode === Enum.KeyCode.R) {
					this.reload();
				}
			}
		});

		UserInputService.InputEnded.Connect((input, gameProcessed) => {
			if (input.UserInputType === Enum.UserInputType.MouseButton1) {
				this.isMouseDown = false;
			}
		});
	}

	private getFireDirection(): Vector3 {
		const camera = Workspace.CurrentCamera;
		if (!camera) {
			throw warn("CurrentCamera is not available");
		}

		const mouseLocation = UserInputService.GetMouseLocation();
		const mouseRay = camera.ViewportPointToRay(mouseLocation.X, mouseLocation.Y);
		return mouseRay.Direction.Unit.mul(this.attributes.range);
	}

	private startMonitoringInput(): void {
		this.runServiceConnection = RunService.Heartbeat.Connect(() => {
			if (this.isMouseDown && this.canFire) {
				if (this.attributes.weapon_type === "Auto") {
					this.startAutoFire();
				} else if (this.attributes.weapon_type === "Semi") {
					this.canFire = false;
					this.shoot();
					task.spawn(() => {
						task.wait(this.attributes.shoot_delay);
						this.canFire = true;
					});
				}
			}
		});
	}

	private async startAutoFire(): Promise<void> {
		while (this.isMouseDown && this.attributes.ammo > 0 && !this.reloading) {
			this.canFire = false;
			this.shoot();
			await task.wait(this.attributes.shoot_delay);
		}
		this.canFire = true;
	}

	private stopMonitoringInput(): void {
		if (this.runServiceConnection) {
			this.runServiceConnection.Disconnect();
			this.runServiceConnection = undefined;
		}
	}

	shoot(): void {
		if (this.reloading) {
			print("Cannot shoot while reloading.");
			return;
		}

		if (this.attributes.ammo > 0) {
			this.attributes.ammo--;
			print(`Shot fired! Damage: ${this.attributes.damage}, Ammo left: ${this.attributes.ammo}`);
			const direction = this.getFireDirection();
			this.fire(direction);
		} else {
			this.reload();
		}
	}

	private getHandlePosition(): Vector3 | undefined {
		const tool = this.instance as Tool;
		const handle = tool.FindFirstChild("Handle") as BasePart;
		const firePosition = handle.FindFirstChild("ShootingAttachment") as Attachment;
		return firePosition ? firePosition.WorldPosition : undefined;
	}

	private fire(direction: Vector3): void {
		const origin = this.getHandlePosition();
		if (origin) {
			const simBullet = this.NextCastCaster.Fire(
				origin,
				direction,
				this.attributes.bullet_speed,
				this.CastBehavior,
			);
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
		} else {
			warn("Handle position is not available.");
		}
	}

	async reload(): Promise<void> {
		if (this.reloading) {
			print("Already reloading.");
			return;
		}

		this.reloading = true;
		print("Reloading...");
		await task.wait(this.attributes.reload_time);
		this.attributes.ammo = this.attributes.max_ammo;
		print(`Gun reloaded. Ammo is now ${this.attributes.ammo}`);
		this.reloading = false;
	}

	private isTool(): boolean {
		return this.instance.IsA("Tool");
	}
}
