import React from "react";
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
				const sceneProps = props as any;
				return {
					durationInFrames:
						sceneProps.durationInFrames ||
						sceneProps.durationInMS ||
						1 * (sceneProps.fps || 30),
					fps: sceneProps.fps || 30,
					width: sceneProps.width || sceneProps.viewportWidth || 1920,
					height: sceneProps.height || sceneProps.viewportHeight || 1080,
				};
			}}
		/>
	</>
);

registerRoot(RemotionRoot);
