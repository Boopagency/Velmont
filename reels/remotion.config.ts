import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);
// paper(), noise() and the other @remotion/effects need WebGL. swangle is software GL,
// so renders work on machines without a GPU; WebGPU on software GL drops frames.
Config.setChromiumOpenGlRenderer("swangle");
Config.setPreferredEffectBackend("webgl2");
// Use the Chrome already on the machine when there is one, so renders work offline.
if (process.env.REMOTION_CHROME) Config.setBrowserExecutable(process.env.REMOTION_CHROME);
