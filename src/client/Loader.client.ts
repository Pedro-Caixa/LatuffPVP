import { Components } from "@flamework/components";
import { Dependency } from "@flamework/core";
import { Gun } from "../shared/components/GunComponent";
import { Players } from "@rbxts/services";

const components = Dependency<Components>();
components.addComponent<Gun>(game);
