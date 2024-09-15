type Gun = Tool & {
	Handle: MeshPart & {
		Shot: Part & {
			GunShotLight: SpotLight;
			Smoke1: ParticleEmitter;
			Smoke2: ParticleEmitter;
			WeldConstraint: WeldConstraint;
		};
		Slide: MeshPart;
	};
}
