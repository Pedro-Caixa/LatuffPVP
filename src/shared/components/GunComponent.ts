import { BaseComponent, Component } from "@flamework/components";
import { OnStart } from "@flamework/core";
import FastCast, { Caster, FastCastBehavior } from "@rbxts/fastcast";
import { ReplicatedStorage, RunService, UserInputService, Workspace } from "@rbxts/services";
import WeaponConfig from "shared/Weapon.Config.json";

interface GunInstance extends Instance {
	handle: BasePart;
}

interface GunAttributes {
	max_ammo: number;
	damage: number;
	headshot_damage: number;
	range: number;
	reload_time: number;
	weapon_type: string;
	shoot_delay: number;
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
}

const Guns: GunsConfig = WeaponConfig.Guns;

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
	},
	tag: "GunFramework",
})
export class Gun extends BaseComponent<Attributes> implements OnStart {
	private reloading = false;
	private runServiceConnection: RBXScriptConnection | undefined;
	private isMouseDown: boolean = false;
	private canFire: boolean = true;
	private caster: Caster = new FastCast();
	private casterBehavior: FastCastBehavior = FastCast.newBehavior();

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
				print(`Gun configuration loaded for ${gunId}`);
			} else {
				warn(`No configuration found for Gun_ID: ${gunId}`);
			}

			print(this.instance.FindFirstChild("Handle"));

			this.caster = new FastCast();

			this.casterBehavior = FastCast.newBehavior();
			this.casterBehavior.RaycastParams = new RaycastParams();
			this.casterBehavior.RaycastParams.FilterType = Enum.RaycastFilterType.Exclude;
			this.casterBehavior.RaycastParams.FilterDescendantsInstances = [
				game.GetService("Players").LocalPlayer.Character!,
			];

			this.configureInputService();

			tool.Equipped.Connect(() => {
				this.startMonitoringInput();
			});

			tool.Unequipped.Connect(() => {
				this.stopMonitoringInput();
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
			warn("CurrentCamera is not available");
			return new Vector3();
		}

		const mouseLocation = UserInputService.GetMouseLocation();
		const mouseRay = camera.ViewportPointToRay(mouseLocation.X, mouseLocation.Y);
		return mouseRay.Direction.Unit.mul(this.attributes.range);
	}

	private startMonitoringInput(): void {
		this.runServiceConnection = RunService.Heartbeat.Connect(() => {
			if (this.isMouseDown && this.canFire) {
				const direction = this.getFireDirection();
				if (this.attributes.weapon_type === "Auto") {
					this.startAutoFire(direction);
				} else if (this.attributes.weapon_type === "Semi") {
					this.canFire = false;
					this.shoot(direction);
					task.spawn(() => {
						task.wait(this.attributes.shoot_delay);
						this.canFire = true;
					});
				}
			}
		});
	}

	private async startAutoFire(direction: Vector3): Promise<void> {
		while (this.isMouseDown && this.attributes.ammo > 0 && !this.reloading) {
			this.canFire = false;
			this.shoot(direction);
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

	shoot(direction: Vector3): void {
		if (this.reloading) {
			print("Cannot shoot while reloading.");
			return;
		}

		if (this.attributes.ammo > 0) {
			this.attributes.ammo--;
			print(`Shot fired! Damage: ${this.attributes.damage}, Ammo left: ${this.attributes.ammo}`);
			this.fire(direction);
		} else {
			this.reload();
		}
	}

	private fire(direction: Vector3): void {
		const origin = this.instance.FindFirstChild("Handle") as BasePart | undefined;
		if (origin) {
			this.caster.Fire(origin.Position, direction, 100, this.casterBehavior);
		} else {
			warn("Handle not found on the tool.");
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
