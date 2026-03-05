import { Composition, registerRoot } from "remotion";
import {
	CompositionScene,
	// @ts-expect-error - Webpack needs this without .js, but tsc needs .js
} from "./compositions/scene";

const RemotionRoot = () => (
	<>
		<Composition
			id="CompositionScene"
			component={CompositionScene}
			calculateMetadata={({ props }) => {
				const sceneProps = props;
				const fps = (sceneProps.FPS as number) || 30;
				return {
					durationInFrames: sceneProps.durationInMS
						? Math.round(((sceneProps.durationInMS as number) / 1000) * fps)
						: fps,
					fps,
					width: sceneProps.viewportWidth,
					height: sceneProps.viewportHeight,
				};
			}}
		/>
	</>
);

registerRoot(RemotionRoot);
