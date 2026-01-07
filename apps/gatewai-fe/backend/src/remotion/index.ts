// remotion/index.ts
import { registerRoot } from 'remotion';
import { MyVideo } from './MyVideo';

registerRoot(() => {
  return (
    <Composition
      id="MyComp"
      component={MyVideo}
      durationInFrames={150}
      fps={30}
      width={1280}
      height={720}
    />
  );
});