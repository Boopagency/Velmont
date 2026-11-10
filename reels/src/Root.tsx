import { Composition, Folder } from "remotion";
import { M1Paulinho } from "./m1-paulinho/Video";
import { SCENES } from "./m1-paulinho/scenes";

const seconds = Object.values(SCENES).reduce((a, b) => a + b, 0);

export const RemotionRoot: React.FC = () => (
  <Folder name="Velmont-Reels">
    <Composition id="velmont-m1-paulinho" component={M1Paulinho} durationInFrames={seconds * 30} fps={30} width={1080} height={1920} />
  </Folder>
);
