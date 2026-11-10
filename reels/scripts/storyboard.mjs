// One PNG per scene, taken when everything in it is on screen.
import { execFileSync } from "node:child_process";

const frames = {
  "01-capa": 72,
  "02-jornal": 160,
  "03-aviso": 335,
  "04-em-andamento": 420,
  "05-lei": 580,
  "06-antes-depois": 760,
  "07-pergunta": 900,
};

execFileSync("npx", ["remotion", "bundle", "--out-dir=build"], { stdio: "inherit" });
for (const [name, frame] of Object.entries(frames)) {
  execFileSync("npx", ["remotion", "still", "build", "velmont-m1-paulinho", `out/storyboard/${name}.png`, `--frame=${frame}`], {
    stdio: "inherit",
  });
}
