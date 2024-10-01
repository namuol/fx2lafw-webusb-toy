import React from 'react';
import * as ogl from 'ogl';

class DataTimelineContext {
  constructor(public renderer: ogl.Renderer) {
    const gl = renderer.gl;

    // Triangle that covers viewport, with UVs that still span 0 > 1 across
    // viewport
    const geometry = new ogl.Geometry(gl, {
      position: {size: 2, data: new Float32Array([-1, -1, 3, -1, -1, 3])},
    });
    // Alternatively, you could use the Triangle class.

    const program = new ogl.Program(gl, {
      vertex: /* glsl */ `
        #pragma vscode_glsllint_stage: vert
        attribute vec2 position;

        void main() {
          gl_Position = vec4(position, 0, 1);
        }
      `,
      fragment: /* glsl */ `
        #pragma vscode_glsllint_stage: frag
        precision highp float;

        uniform vec2 iResolution;

        void main() {
          vec4 gridLineColor = vec4(1,1,0,1);
          float gridLineVisibility = (1.0 - (floor(mod(gl_FragCoord.x, 100.0))));
          gl_FragColor = gridLineColor * gridLineVisibility;
        }
      `,
      uniforms: {
        iResolution: {value: [800, 800]},
      },
    });

    const mesh = new ogl.Mesh(gl, {geometry, program});
    requestAnimationFrame(update);
    function update(_t: number) {
      requestAnimationFrame(update);

      program.uniforms.iResolution.value[0] = renderer.width;
      program.uniforms.iResolution.value[1] = renderer.height;

      // Don't need a camera if camera uniforms aren't required
      renderer.render({scene: mesh});
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function DataTimeline(_props: {data: Uint8Array}) {
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const c = React.useRef<DataTimelineContext | null>(null);

  React.useLayoutEffect(() => {
    if (wrapperRef.current == null) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry == null) return;
      const rect = entry.contentRect;
      if (rect == null) return;
      const {width, height} = rect;
      if (canvasRef.current == null) return;
      if (c.current == null) {
        c.current = new DataTimelineContext(
          new ogl.Renderer({
            canvas: canvasRef.current,
            width,
            height,
          }),
        );
      }
      c.current.renderer.setSize(width, height);
      c.current.renderer.setViewport(width, height);
    });
    observer.observe(wrapperRef.current);

    return () => {
      console.log('observer.disconnect()');
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={wrapperRef} className="self-stretch flex-grow overflow-hidden">
      <canvas ref={canvasRef} />
    </div>
  );
}
