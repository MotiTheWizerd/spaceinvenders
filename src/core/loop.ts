/** Fixed-timestep simulation with a variable-rate render. */
export function startLoop(step: number, update: (dt: number) => void, render: () => void): void {
  let last = performance.now();
  let acc = 0;

  const frame = (now: number) => {
    acc += Math.min(0.25, (now - last) / 1000); // avoid a spiral after tab switches
    last = now;
    while (acc >= step) {
      update(step);
      acc -= step;
    }
    render();
    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);
}
