import { useEffect, useRef } from 'react';

export function FluidTankReferenceRuntime() {
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    frame.src = '/pixi-lab/fluids.html';
  }, []);

  return (
    <iframe
      ref={frameRef}
      title="Fluid Tank reference runtime"
      className="h-full w-full border-0"
      sandbox="allow-scripts allow-same-origin"
    />
  );
}
