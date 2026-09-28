/** Dev utility: inspect stage / tile state (?debug exposes window.__stage). */
import { chromium } from "@playwright/test";
(async () => {
  const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("console", (m) => console.log("console:", m.type(), m.text()));
  await page.goto("http://localhost:4399/burnt-norton/2?debug" + (process.argv[3] ?? ""), { waitUntil: "networkidle" });
  await page.waitForSelector(".movement-heading.is-tiling", { timeout: 15000 });
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => {
    const st = (window as any).__stage;
    const tl = st.tiles;
    const u = tl.mesh.material.uniforms;
    u.uTessera.value.set(1, 0, 0);
    const m = tl.mesh.material;
    if (location.hash === "#solid") { m.fragmentShader = "void main(){ gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); }"; m.needsUpdate = true; }
    const pos = tl.mesh.geometry.getAttribute("aHome");
    const tgt = tl.mesh.geometry.getAttribute("aTarget");
    return {
      uT: u.uT.value, uFade: u.uFade.value, origin: [u.uOrigin.value.x, u.uOrigin.value.y], emblem: [u.uEmblem.value.x, u.uEmblem.value.y],
      res: [u.uRes.value.x, u.uRes.value.y], cell: u.uCell.value, home0: [pos.getX(0), pos.getY(0)], target0: [tgt.getX(0), tgt.getY(0)],
      count: tl.mesh.geometry.instanceCount, blending: tl.mesh.material.blending, visible: tl.mesh.visible,
      sceneChildren: tl.scene.children.length, canvas: [st.canvas.width, st.canvas.height], autoClear: st.renderer.autoClear,
      programs: st.renderer.info.programs?.length, calls: st.renderer.info.render.calls,
    };
  });
  console.log(JSON.stringify(info, null, 1));
  await page.waitForTimeout(300);
  await page.screenshot({ path: process.argv[2] + "/dbg-red.png", clip: { x: 220, y: 0, width: 700, height: 500 } });
  await browser.close();
})();
